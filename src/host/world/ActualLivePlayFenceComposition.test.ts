import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { actualLivePlayExtensionOpenState, beginActualLivePlayWrite, recordActualLivePlayAdmission,
  beginActualLivePlayRegistration, assertActualLivePlayRegistrationUnchanged } from './ActualLivePlayFence';
import { installReceivedOwnerSchema } from './ActualReceivedUmpireDefenderSchema';
import { samePaSchema } from './SamePlateAppearanceReservationGuard';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Db = InstanceType<typeof DatabaseSync>;
const scope = { gameId: 'game-a', playId: 1, physicalPitchSourceId: 'pitch-a' };
// Raw exclusion fixtures exercise the two real Native namespaces together.
// They do not claim authenticated enrollment or physical execution.
const received = (db: Db) => {
  installReceivedOwnerSchema(db);
  const source = { sourceId: 'received-a', sourceVersion: 'fixture-v1', capability: 'received_umpire_defender_enrollment_v1',
    runtimeSourceId: 'runtime-a', physicalPitchSourceId: 'pitch-a', playerId: 'player-a', observationSourceId: 'observation-a',
    currentExecutionSourceId: 'execution-a', predecessorDecisionSourceId: 'decision-a', predecessorMotorSourceId: 'motor-a', predecessorAdoptionSourceId: 'adoption-a' };
  db.prepare('INSERT INTO actual_received_umpire_defender_enrollments VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    source.sourceId, source.sourceVersion, scope.gameId, scope.playId, scope.physicalPitchSourceId, source.playerId, source.runtimeSourceId,
    'call-a', 'send-a', 24, 'prefix', JSON.stringify(source), 'source-hash', '{}', 'snapshot-hash');
};
const reserved = (db: Db, target = scope) => {
  for (const sql of Object.values(samePaSchema)) db.exec(sql);
  db.prepare('INSERT INTO same_pa_successor_rights VALUES(?,?,?,?,?,?,?,?)').run(
    'reservation-a', target.physicalPitchSourceId, target.gameId, target.playId, 'blocked_execution_basis', null, null,
    JSON.stringify({ enrollmentSourceId: 'reservation-a', ...target }));
};
const census = (db: Db) => ({ schema: db.prepare('SELECT * FROM main.sqlite_master ORDER BY name').all(), changes: db.prepare('SELECT total_changes() AS n').get() });
for (const route of ['legacy', 'extension'] as const) for (const claims of ['none', 'received', 'reserved', 'both'] as const) {
  it(`composition ${route} with ${claims} preserves both ownership boundaries`, () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec('BEGIN');
      if (claims === 'received' || claims === 'both') received(db);
      if (claims === 'reserved' || claims === 'both') reserved(db);
      const before = census(db);
      const call = () => route === 'extension' ? actualLivePlayExtensionOpenState(db, scope)
        : beginActualLivePlayWrite(db, scope, { owner: 'batted_world_field_executions', sourceId: 'new-action' });
      if (claims === 'reserved' || claims === 'both') expect(call).toThrow(/same-PA reservation/);
      else if (route === 'legacy' && claims === 'received') expect(call).toThrow(/received.*pending/);
      else expect(call).not.toThrow();
      expect(census(db)).toEqual(before);
    } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
  });
}
for (const route of ['legacy', 'extension'] as const) it(`composition ${route} keeps a disjoint reservation separate from received ownership`, () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('BEGIN'); received(db); reserved(db, { gameId: 'other-game', playId: 2, physicalPitchSourceId: 'other-pitch' });
    const before = census(db);
    const call = () => route === 'extension' ? actualLivePlayExtensionOpenState(db, scope)
      : beginActualLivePlayWrite(db, scope, { owner: 'batted_world_field_executions', sourceId: 'new-action' });
    if (route === 'legacy') expect(call).toThrow(/received.*pending/);
    else expect(call).not.toThrow();
    expect(census(db)).toEqual(before);
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
});
for (const route of ['legacy', 'registration'] as const) it(`composition ${route} rechecks a reservation created after entry`, () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('BEGIN');
    const token = route === 'legacy' ? beginActualLivePlayWrite(db, scope, { owner: 'batted_world_field_executions', sourceId: 'new-action' })
      : beginActualLivePlayRegistration(db, scope);
    reserved(db); const before = census(db);
    expect(() => route === 'legacy' ? recordActualLivePlayAdmission(db, token) : assertActualLivePlayRegistrationUnchanged(db, token)).toThrow(/same-PA reservation/);
    expect(census(db)).toEqual(before);
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
});
