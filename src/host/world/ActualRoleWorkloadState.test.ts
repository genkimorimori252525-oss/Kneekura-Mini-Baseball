import { expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqlitePlayerWorkloadRecoveryStore, type AcceptedPlayerWorkloadBaseline } from './SqlitePlayerWorkloadRecoveryStore';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
const baseline: AcceptedPlayerWorkloadBaseline = { sourceId: 'baseline', sourceVersion: 'v1', personLinkSourceId: 'intake-p2',
  careerId: 'career-a', playerId: 'p2', createdAtDay: 1, fatigue: 0.1, recoveryCapacity: 0.5,
  policy: { policyId: 'fixture-only', version: 'v1', availableAtDay: 0, workloadFatiguePerUnit: 0.1, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } };
it('authenticates explicit baseline and exact historical prefix on same SQLite connection without reading later activity payload', () => {
  const f = officialPitchWorkloadFixture(true, true, join(mkdtempSync(join(tmpdir(), 'role-state-')), 'state.sqlite'));
  let activity = { sourceEventId: 'first', sourceVersion: 'v1', evidenceId: 'actual', careerId: 'career-a', playerId: 'p2', atDay: 10, kind: 'MATCH' as const, effortUnits: 2 };
  const w = f.track(openSqlitePlayerWorkloadRecoveryStore(f.path, f.links, { readAcceptedBaseline: () => baseline, readAcceptedActivity: () => activity }));
  try {
    expect(readActualRoleWorkloadState(f.db, 'career-a', 'p2')).toBeNull();
    const initial = w.initialize('baseline'); expect(readActualRoleWorkloadState(f.db, 'career-a', 'p2')).toEqual(initial);
    expect(() => readActualRoleWorkloadState(f.db, 'career-a', 'p2', undefined, 'different-original-person-link')).toThrow(/Person/);
    const first = w.apply('first', 0); activity = { ...activity, sourceEventId: 'later' }; w.apply('later', 1);
    expect(readActualRoleWorkloadState(f.db, 'career-a', 'p2', 1)).toEqual(first);
    f.db.prepare("UPDATE world_player_workload_activities SET source_json='not-json' WHERE source_id='later'").run();
    expect(readActualRoleWorkloadState(f.db, 'career-a', 'p2', 1)).toEqual(first);
    expect(() => readActualRoleWorkloadState(f.db, 'career-a', 'p2')).toThrow();
    f.db.prepare("UPDATE world_player_workload_baselines SET player_id='alias' WHERE source_id='baseline'").run();
    expect(() => readActualRoleWorkloadState(f.db, 'career-a', 'p2', 1)).toThrow();
  } finally { f.close(); }
});
it('same-connection prewrite state authentication observes uncommitted policy and Person corruption', () => {
  const f = officialPitchWorkloadFixture(true, true, join(mkdtempSync(join(tmpdir(), 'role-before-')), 'state.sqlite'));
  const w = f.track(openSqlitePlayerWorkloadRecoveryStore(f.path, f.links, { readAcceptedBaseline: () => baseline, readAcceptedActivity: () => null }));
  try { w.initialize('baseline'); f.db.exec('BEGIN IMMEDIATE');
    f.db.prepare("UPDATE world_player_workload_policies SET policy_json='{}'").run();
    expect(() => readActualRoleWorkloadState(f.db, 'career-a', 'p2')).toThrow(); f.db.exec('ROLLBACK');
    f.db.exec('BEGIN IMMEDIATE'); f.db.prepare("UPDATE world_player_person_links SET person_id='forged' WHERE source_id='intake-p2'").run();
    expect(() => readActualRoleWorkloadState(f.db, 'career-a', 'p2')).toThrow(); f.db.exec('ROLLBACK');
  } finally { f.close(); }
});
