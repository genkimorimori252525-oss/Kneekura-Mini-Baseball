import { afterEach, expect, it } from 'vitest';
import { assertManagerBeliefBoundary, readManagerBeliefBoundary } from './ManagerBeliefBoundary';
import { issueManagerRosterOpportunityFromBelief } from './ManagerRosterOpportunityFromBelief';
import { corruptManagerRosterAdmissionBefore, managerRosterAdmissionFixture,
  managerRosterAdmissionHeadExtent, managerRosterAdmissionSnapshot } from './ManagerRosterBeliefAdmission.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const sourceError = 'corrupt Manager belief boundary source or prefix';

it('rejects direct roster issue after old observation corruption with unchanged Manager head and count', () => {
  const { f, roster, accepted, direct } = managerRosterAdmissionFixture(cleanup);
  const headExtent = managerRosterAdmissionHeadExtent(f.db);
  const head = f.history.readHead('career-a', 'manager-a');
  corruptManagerRosterAdmissionBefore(f.db);
  expect(managerRosterAdmissionHeadExtent(f.db)).toEqual(headExtent);
  expect(f.history.readHead('career-a', 'manager-a')).toEqual(head);
  expect(() => readManagerBeliefBoundary(f.db, 'career-a', 'manager-a', 1)).toThrow(sourceError);
  expect(() => assertManagerBeliefBoundary(f.db, accepted, 'current')).toThrow(sourceError);
  const before = managerRosterAdmissionSnapshot(f.db);
  expect(() => roster.issueOpportunity(direct)).toThrow(sourceError);
  expect(managerRosterAdmissionSnapshot(f.db)).toBe(before);
  expect(roster.readOpportunity('career-a', 'club-a', 'decision-2')).toBeNull();
  expect(roster.readExecution('execution-2')).toBeNull();
});

it('rejects belief-derived roster issue after old observation corruption with unchanged Manager head and count', () => {
  const { f, roster, accepted, input } = managerRosterAdmissionFixture(cleanup);
  const headExtent = managerRosterAdmissionHeadExtent(f.db);
  const head = f.history.readHead('career-a', 'manager-a');
  corruptManagerRosterAdmissionBefore(f.db);
  expect(managerRosterAdmissionHeadExtent(f.db)).toEqual(headExtent);
  expect(f.history.readHead('career-a', 'manager-a')).toEqual(head);
  expect(() => readManagerBeliefBoundary(f.db, 'career-a', 'manager-a', 1)).toThrow(sourceError);
  expect(() => assertManagerBeliefBoundary(f.db, accepted, 'current')).toThrow(sourceError);
  const before = managerRosterAdmissionSnapshot(f.db);
  expect(() => issueManagerRosterOpportunityFromBelief(roster, f.history, input)).toThrow(sourceError);
  expect(managerRosterAdmissionSnapshot(f.db)).toBe(before);
  expect(roster.readOpportunity('career-a', 'club-a', 'decision-2')).toBeNull();
  expect(roster.readExecution('execution-2')).toBeNull();
});

it('rolls back the real roster opportunity INSERT and writer-local old observation mutation', () => {
  const { f, roster, accepted, direct } = managerRosterAdmissionFixture(cleanup);
  const headExtent = managerRosterAdmissionHeadExtent(f.db);
  const before = managerRosterAdmissionSnapshot(f.db);
  let sawWriterConnection = false, sawInsertedOpportunity = false, sawCorruptPrefix = false;
  const witness = witnessSqliteWrite(/INSERT INTO world_roster_opportunities\s/, db => {
    sawWriterConnection = db !== f.db;
    sawInsertedOpportunity = Boolean(db.prepare('SELECT 1 FROM world_roster_opportunities WHERE career_id=? AND club_id=? AND decision_id=?')
      .get('career-a', 'club-a', 'decision-2'));
    // The actual INSERT has finished; mutation uses that same writer connection
    // inside its real transaction. No alternate writer or synthetic receipt.
    corruptManagerRosterAdmissionBefore(db);
    expect(managerRosterAdmissionHeadExtent(db)).toEqual(headExtent);
    expect(() => readManagerBeliefBoundary(db, 'career-a', 'manager-a', 1)).toThrow(sourceError);
    sawCorruptPrefix = true;
    return sawWriterConnection && sawInsertedOpportunity && sawCorruptPrefix;
  });
  try {
    expect(() => {
      try { roster.issueOpportunity(direct); }
      finally {
        // These controls execute even on the intended no-rejection RED.
        expect(witness.wasReached()).toBe(true);
        expect(sawWriterConnection).toBe(true);
        expect(sawInsertedOpportunity).toBe(true);
        expect(sawCorruptPrefix).toBe(true);
      }
    }).toThrow(sourceError);
  } finally { witness.close(); }
  expect(managerRosterAdmissionSnapshot(f.db)).toBe(before);
  expect(roster.readOpportunity('career-a', 'club-a', 'decision-2')).toBeNull();
  expect(roster.readExecution('execution-2')).toBeNull();
  assertManagerBeliefBoundary(f.db, accepted, 'current');
});
