import { expect, it } from 'vitest';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { actualPlayerKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
it('records zero executed duration for actual persistent contact without advancing epsilon or consuming future coverage', () => {
  const x = battedWorldFieldFixture(undefined, true, true, undefined, {
    material: { restitution: 0, tangentialDamping: 0.25, spinDamping: 0.2 },
  });
  try {
    const first = x.fields.accept(x.source.sourceId), at = first.field.motion.world.moment;
    const prefix = { baseField: first, fields: battedWorldFieldEvidenceFromSqlite(x.f.db).scope(first), executions: [] };
    const selves = x.source.commands.map(c => actualPlayerKinematicsFromPrefix(c.playerId, prefix));
    const source: AcceptedBattedWorldFieldExecution = { sourceId: 'owned-zero-contact', sourceVersion: 'synthetic-v1',
      baseFieldSourceId: first.source.sourceId, previousExecutionSourceId: null, action: { kind: 'owned_motion_v1', checkpointThroughTick: at.ball.tick + 100,
        contributions: selves.map(s => ({ kind: 'retained', playerId: s.playerId, command: s.activeCommand })),
        knownWork: selves.map(s => ({ playerId: s.playerId, decisionSourceId: null, motorSourceId: null })) } };
    const sources = new Map([[source.sourceId, source]]);
    const store = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields, { readAcceptedExecution: id => sources.get(id) ?? null }));
    const value = store.accept(source.sourceId);
    if (value.execution.kind !== 'owned_motion_v1') throw new Error('missing owned contact');
    expect(value.execution.field.motion.world).toMatchObject({ kind: 'boundary', pendingReason: 'persistent_contact' });
    expect(value.execution.adoption.executedThrough).toEqual(value.execution.adoption.adoptedAt);
    expect(value.execution.adoption.executedThrough.elapsedSeconds).toBe(at.elapsedSeconds);
    expect(value.execution.adoption.status).toBe('physical_boundary');
    expect(value.execution.field.motion.actors).toEqual(first.field.motion.actors);
    expect(value.execution.adoption.contributors.every(c => c.motorAdoptionEventId === null)).toBe(true);
    expect(store.accept(source.sourceId)).toEqual(value);
  } finally { x.f.close(); }
});
