import { expect, it } from 'vitest';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { actualPlayerKinematicsEvidenceFromSqlite } from './SqliteActualPlayerKinematicsReader';
it.each(['motion_checkpoint_v1', 'retained_motion_checkpoint_v1'] as const)('%s preserves zero-time persistent contact through owned history and self', (kind) => {
  const x = battedWorldFieldFixture(undefined, true, true, undefined, {
    material: { restitution: 0, tangentialDamping: 0.25, spinDamping: 0.2 },
  });
  try {
    const first = x.fields.accept(x.source.sourceId), at = first.field.motion.world.moment;
    const source: AcceptedBattedWorldFieldExecution = { sourceId: 'same-time-checkpoint', sourceVersion: 'synthetic-v1',
      baseFieldSourceId: first.source.sourceId, previousExecutionSourceId: null,
      action: kind === 'motion_checkpoint_v1' ? { kind, availableAtTick: first.source.availableAtTick,
        coverageThroughTick: at.ball.tick + 100_000, checkpointThroughTick: at.ball.tick + 100, commands: first.source.commands }
        : { kind, checkpointThroughTick: at.ball.tick + 100 } };
    const sources = new Map([[source.sourceId, source]]);
    const store = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields, { readAcceptedExecution: id => sources.get(id) ?? null }));
    const second = store.accept(source.sourceId);
    expect(second.execution.field.motion.world).toMatchObject({ kind: 'boundary', pendingReason: 'persistent_contact' });
    expect(second.execution.field.motion.world.moment.elapsedSeconds).toBe(at.elapsedSeconds);
    const self = actualPlayerKinematicsEvidenceFromSqlite(x.f.db).read({ playerId: 'p2',
      physicalPitchSourceId: first.response.touch.worldContact.flight.source.physicalPitchSourceId,
      baseFieldSourceId: first.source.sourceId, executionSourceId: source.sourceId, mode: 'original' });
    expect(self.at.elapsedSeconds).toBe(at.elapsedSeconds);
    expect(self.activeCommand.sourceId).toBe(kind === 'motion_checkpoint_v1' ? source.sourceId : first.source.sourceId);
    const view: AcceptedBattedWorldFieldExecution = { ...source, sourceId: 'contact-history', previousExecutionSourceId: source.sourceId,
      action: { kind: 'whole_play_history' } };
    sources.set(view.sourceId, view); const value = store.accept(view.sourceId);
    if (value.execution.kind !== 'whole_play_history') throw new Error('history fixture');
    expect(value.execution.physicalHistory.horizon).toEqual(second.execution.field.motion.world.moment);
    expect(value.execution.physicalHistory.physicalSteps.at(-1)?.kind).toBe(kind === 'motion_checkpoint_v1' ? 'motion' : kind);
  } finally { x.f.close(); }
});
