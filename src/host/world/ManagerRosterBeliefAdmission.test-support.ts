import type { DatabaseSync } from 'node:sqlite';
import { expect } from 'vitest';
import { managerBoundaryFixture } from './ManagerBeliefBoundary.test-support';
import { assertManagerBeliefBoundary, readManagerBeliefBoundary } from './ManagerBeliefBoundary';
import { openSqliteManagerRosterDecisionStore, type IssueRosterOpportunityInput } from './SqliteManagerRosterDecisionStore';
import type { ManagerRosterOpportunityFromBeliefInput } from './ManagerRosterOpportunityFromBelief';
import { canonicalRosterEvidenceJson } from './RosterEvidenceJson';

// Explicit accepted fixture values are copied from the existing two-choice
// Manager history test. These are not production policy or calibration defaults.
export const managerRosterAdmissionFixture = (cleanup: (() => void)[]) => {
  const f = managerBoundaryFixture(cleanup);
  const observed = f.first();
  const roster = openSqliteManagerRosterDecisionStore(f.databasePath);
  let open = true;
  const close = () => { if (open) { roster.close(); open = false; } };
  cleanup.push(close);
  const original = roster.readOpportunity('career-a', 'club-a', 'decision-1')!;
  const accepted = readManagerBeliefBoundary(f.db, 'career-a', 'manager-a', 1)!;
  expect(accepted.state).toEqual(observed.state);
  assertManagerBeliefBoundary(f.db, accepted, 'current');
  const input: ManagerRosterOpportunityFromBeliefInput = {
    careerId: 'career-a', clubId: 'club-a', expectedClubRevision: 0,
    expectedRosterRevision: 1, clubAsOfDay: 12, control: original.control,
    decisionId: 'decision-2', contextId: 'roster-context-2', worldRevision: 1,
    managerId: 'manager-a', appointmentId: 'appointment-a',
    candidates: [{ actionId: 'rest-p1', command: {
      commandId: 'rest-p1', expectedRevision: 1, effectiveDay: 12,
      changes: [{ playerId: 'p1', availability: { status: 'AVAILABLE', evidenceId: 'recovered-1' } }],
    } }, { actionId: 'keep-p1', command: {
      commandId: 'keep-p1', expectedRevision: 1, effectiveDay: 12,
      changes: [{ playerId: 'p1', availability: { status: 'UNAVAILABLE', evidenceId: 'still-resting-1' } }],
    } }],
  };
  const { managerId, appointmentId, ...opportunity } = input;
  const direct: IssueRosterOpportunityInput = { ...opportunity,
    selectionAgent: { managerId, appointmentId, state: observed.state.agent } };
  return { f, roster, close, original, accepted, input, direct };
};

// Include every existing application table, not only the heads named by the
// consuming writer. sqlite_schema is included so a rejected issue cannot add DDL.
export const managerRosterAdmissionSnapshot = (db: Pick<DatabaseSync, 'prepare'>) => {
  const schema = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name").all();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name: string }[];
  return JSON.stringify({ schema, rows: Object.fromEntries(tables.map(({ name }) =>
    [name, db.prepare(`SELECT * FROM "${name.replace(/"/g, '""')}" ORDER BY rowid`).all()])) });
};

export const managerRosterAdmissionHeadExtent = (db: Pick<DatabaseSync, 'prepare'>) => ({
  head: db.prepare('SELECT * FROM world_manager_person_heads WHERE career_id=? AND manager_id=?').get('career-a', 'manager-a'),
  extent: db.prepare('SELECT count(*) AS n,max(revision) AS last FROM world_manager_belief_observations WHERE career_id=? AND manager_id=?')
    .get('career-a', 'manager-a'),
});

export const corruptManagerRosterAdmissionBefore = (db: Pick<DatabaseSync, 'prepare'>) => {
  const row = db.prepare('SELECT before_json FROM world_manager_belief_observations WHERE career_id=? AND manager_id=? AND revision=1')
    .get('career-a', 'manager-a') as { before_json: string };
  const before = JSON.parse(row.before_json);
  expect(before.agent.skills.operations).toBe(50);
  before.agent.skills.operations = 99;
  const changed = canonicalRosterEvidenceJson(before);
  expect(db.prepare('UPDATE world_manager_belief_observations SET before_json=? WHERE career_id=? AND manager_id=? AND revision=1')
    .run(changed, 'career-a', 'manager-a').changes).toBe(1);
  expect(changed).not.toBe(row.before_json);
  return changed;
};
