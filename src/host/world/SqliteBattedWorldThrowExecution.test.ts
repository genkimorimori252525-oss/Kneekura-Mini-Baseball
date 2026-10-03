import { expect, it } from 'vitest';
import { battedWorldThrowFixture as fixture } from './BattedWorldThrowFixtures.test-support';
import { openSqliteBattedWorldExecutionStore } from './SqliteBattedWorldExecutionStore';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

it('derives release from the own actual carried ball and own Player model, then reopens deterministically', () => {
  const { f, motions, motion, source, executions, model } = fixture();
  try {
    const value = executions.accept(source.sourceId);
    expect(value.execution.kind).toBe('throw'); if (value.execution.kind !== 'throw') throw new Error('throw fixture');
    expect(value.execution.model).toEqual(model); expect(value.execution.throw.kind).toBe('released');
    if (value.execution.throw.kind !== 'released') throw new Error('released fixture');
    expect(value.execution.throw.transfer.throwReadyTick).toBe(motion.motion.world.moment.ball.tick + 210);
    expect(value.execution.motion.carrierPlayerId).toBeNull(); expect(value.execution.throw.launch.releaseSpeedMps).toBe(20);
    const reopened = f.track(openSqliteBattedWorldExecutionStore(f.path, motions));
    expect(reopened.read(source.sourceId)).toEqual(value); expect(reopened.accept(source.sourceId)).toEqual(value);
    expect(motions.read(motion.source.sourceId)).toEqual(motion); expect(value).not.toHaveProperty('out'); expect(value).not.toHaveProperty('playEnd');
  } finally { f.close(); }
});
it.each(['missing', 'future', 'receiver', 'offense', 'result'] as const)('rejects %s throw model/intent without adopting caller evidence', (kind) => {
  const base = fixture();
  try {
    const { f, source, sources, executions, model } = base;
    if (source.action.kind !== 'throw') throw new Error('throw fixture');
    if (kind === 'future') {
      const changed = { ...model, source: { ...model.source, acceptedAtDay: base.actor.binding.gameDay + 1 } };
      f.db.prepare('UPDATE world_player_fielding_models SET accepted_at_day=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?')
        .run(changed.source.acceptedAtDay, json(changed.source), hash(changed.source), json(changed), hash(changed));
    } else sources.set(source.sourceId, { ...source, action: kind === 'missing' ? { ...source.action, modelSourceId: 'missing' }
      : kind === 'receiver' ? { ...source.action, receiverPlayerId: 'bench-player' }
      : kind === 'offense' ? { ...source.action, receiverPlayerId: base.motion.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.binding.playerId }
      : { ...source.action, releaseTick: 0 } } as typeof source);
    expect(() => executions.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_executions').get()).toEqual({ n: 0 });
  } finally { base.f.close(); }
});
it('rejects changed own fielding model on historical read and identical retry', () => {
  const { f, source, executions } = fixture();
  try {
    executions.accept(source.sourceId); f.db.exec("UPDATE world_player_fielding_models SET source_hash='changed'");
    expect(() => executions.read(source.sourceId)).toThrow(); expect(() => executions.accept(source.sourceId)).toThrow();
  } finally { f.close(); }
});
it('rejects another genuinely accepted active Player model as the actual carrier capability', () => {
  const base = fixture();
  try {
    const { f, model, fieldingSources, fielding, receiver, source, sources, executions } = base;
    const other = { ...model.source, sourceId: 'other-active-fielding', playerId: receiver.playerId, personLinkSourceId: receiver.personLinkSourceId };
    fieldingSources.set(other.sourceId, other); fielding.accept(other.sourceId);
    if (source.action.kind !== 'throw') throw new Error('throw fixture');
    sources.set(source.sourceId, { ...source, action: { ...source.action, modelSourceId: other.sourceId } });
    expect(() => executions.accept(source.sourceId)).toThrow(/Player model/);
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_executions').get()).toEqual({ n: 0 });
  } finally { base.f.close(); }
});
