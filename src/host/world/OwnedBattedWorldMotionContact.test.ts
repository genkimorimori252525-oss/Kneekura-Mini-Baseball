import { expect, it } from 'vitest';
import { actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualLocomotionFixture } from './ActualLocomotionFixtures.test-support';
import { actualPlayerKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

it('adopts a real motor once but consumes only its actual first-contact prefix and leaves the future tail unresolved', () => {
  const x = actualLocomotionFixture({ hold: true });
  try {
    if (x.executed.execution.kind !== 'acquisition_advance' || x.executed.execution.progress.kind !== 'secured') throw new Error('fixture');
    const at = x.executed.execution.progress.world.moment, p = x.baseField.response.touch.worldContact.flight.source.execution.ballFlightParameters;
    const dt = 5 / p.ticksPerSecond;
    const ay = 2 * (p.ballRadius - at.ball.position.y - at.ball.velocity.y * dt) / (dt * dt);
    const bootstrap: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'owned-contact-bootstrap', previousExecutionSourceId: x.executed.source.sourceId,
      action: { kind: 'motion_checkpoint_v1', availableAtTick: at.ball.tick, checkpointThroughTick: at.ball.tick + 1,
        coverageThroughTick: at.ball.tick + 100, commands: x.fieldSource.commands.map(c => c.playerId !== 'p2' ? c : { ...c,
          primitiveMotions: c.primitiveMotions.map(r => r.role !== 'glove' ? r : { ...r, offsetAcceleration: { x: 0, y: ay, z: 0 } }) }) } };
    x.sources.set(bootstrap.sourceId, bootstrap); const ready = x.executions.accept(bootstrap.sourceId);
    expect(ready.execution.field.motion.world.kind).not.toBe('boundary');
    x.locomotionSources.set(x.locomotionSource.sourceId, { ...x.locomotionSource, executionSourceId: bootstrap.sourceId });
    const motor = x.locomotion.accept(x.locomotionSource.sourceId);
    const originalRows = x.f.db.prepare('SELECT * FROM actual_locomotion_receipts').all();
    const prefix = { baseField: x.baseField, fields: battedWorldFieldEvidenceFromSqlite(x.f.db).scope(x.baseField),
      executions: battedWorldFieldExecutionEvidenceFromSqlite(x.f.db).scope(x.baseField, bootstrap.sourceId) };
    const selves = x.fieldSource.commands.map(c => actualPlayerKinematicsFromPrefix(c.playerId, prefix));
    const source: AcceptedBattedWorldFieldExecution = { ...bootstrap, sourceId: 'owned-first-contact', previousExecutionSourceId: bootstrap.sourceId,
      action: { kind: 'owned_motion_v1', checkpointThroughTick: motor.receipt.coverageEndTick,
        contributions: selves.map(s => s.playerId === 'p2' ? { kind: 'motor', playerId: s.playerId, motorSourceId: motor.source.sourceId }
          : { kind: 'retained', playerId: s.playerId, command: s.activeCommand }),
        knownWork: selves.map(s => ({ playerId: s.playerId, decisionSourceId: s.playerId === 'p2' ? x.decision.source.sourceId : null,
          motorSourceId: s.playerId === 'p2' ? motor.source.sourceId : null })) } };
    x.sources.set(source.sourceId, source); const saved = x.executions.accept(source.sourceId);
    if (saved.execution.kind !== 'owned_motion_v1') throw new Error('missing owned motion');
    const a = saved.execution.adoption;
    expect(saved.execution.composition.contributors.find(c => c.playerId === 'p2')!.rootAuthority).toMatchObject({
      owner: 'actual_locomotion_receipts', sourceId: motor.source.sourceId,
      adoptionOwner: 'batted_world_field_executions', adoptionSourceId: source.sourceId, adoptionSourceHash: actorHash(source),
    });
    expect(a.status).toBe('physical_boundary');
    expect(saved.execution.field.motion.cursor).toBeNull();
    expect(a.executedThrough.elapsedSeconds).toBe(saved.execution.field.motion.world.moment.elapsedSeconds);
    expect(a.executedThrough.elapsedSeconds).toBeGreaterThan(a.adoptedAt.elapsedSeconds);
    expect(a.executedThrough.elapsedSeconds).toBeLessThan((motor.receipt.coverageEndTick - a.adoptedAt.originTick) / p.ticksPerSecond);
    expect(a.contributors.filter(c => c.motorAdoptionEventId !== null)).toHaveLength(1);
    expect(a.contributors.every(c => c.executedThrough.elapsedSeconds === a.executedThrough.elapsedSeconds)).toBe(true);
    expect(x.locomotion.read(motor.source.sourceId)).toEqual(motor);
    expect(x.f.db.prepare('SELECT * FROM actual_locomotion_receipts').all()).toEqual(originalRows);
    expect(x.executions.accept(source.sourceId)).toEqual(saved);
    x.sources.set('unresolved-owned-contact', { ...source, sourceId: 'unresolved-owned-contact', previousExecutionSourceId: source.sourceId });
    expect(() => x.executions.accept('unresolved-owned-contact')).toThrow(/unresolved/);
  } finally { x.f.close(); }
});
