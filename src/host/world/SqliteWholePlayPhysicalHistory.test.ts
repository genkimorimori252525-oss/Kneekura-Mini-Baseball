import { expect, it } from 'vitest';
import { battedWorldFieldThrowFixture, battedWorldFieldExecutionFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

it('links the original pitch timeline to actual field capture and throw without rewriting physical or official history', () => {
  const x = battedWorldFieldThrowFixture();
  try {
    const thrown = x.executions.accept(x.source.sourceId);
    const original = x.baseField.response.touch.worldContact.flight.physicalPitch;
    const originalTimeline = JSON.stringify(original.result.pitch.resolution.timeline);
    const beforeMatch = x.f.db.prepare('SELECT * FROM matches WHERE match_id=?').get(original.frame.gameId);
    const source: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'whole-physical-history', previousExecutionSourceId: thrown.source.sourceId,
      action: { kind: 'whole_play_history' } };
    x.sources.set(source.sourceId, source); const value = x.executions.accept(source.sourceId);
    if (value.execution.kind !== 'whole_play_history') throw new Error('whole physical history');
    const history = value.execution.physicalHistory;
    expect(JSON.stringify(history.originalTimeline)).toBe(originalTimeline);
    expect(history.scope).toEqual({ gameId: original.frame.gameId, playId: original.frame.match.playId, physicalPitchSourceId: original.source.sourceId });
    expect(history.end).toEqual({ kind: 'unestablished' });
    expect(history.horizon).toEqual(thrown.execution.field.motion.world.moment);
    expect(history.physicalSteps.map((step) => step.kind)).toEqual(['motion', 'acquisition', 'throw']);
    const recordedThrow = history.physicalSteps.find((step) => step.kind === 'throw');
    if (recordedThrow?.kind !== 'throw' || thrown.execution.kind !== 'throw') throw new Error('actual retained throw');
    expect(recordedThrow.throw).toEqual(thrown.execution.throw);
    expect(recordedThrow.field).toEqual(thrown.execution.field);
    expect(value.execution.field).toEqual(thrown.execution.field);
    expect(history).not.toHaveProperty('playEnd'); expect(history).not.toHaveProperty('officialClosure');
    expect(x.f.db.prepare('SELECT * FROM matches WHERE match_id=?').get(original.frame.gameId)).toEqual(beforeMatch);
    expect(JSON.stringify(x.fields.read(x.baseField.source.sourceId)!.response.touch.worldContact.flight.physicalPitch.result.pitch.resolution.timeline)).toBe(originalTimeline);
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields));
    expect(reopened.read(source.sourceId)).toEqual(value);
    expect(reopened.accept(source.sourceId)).toEqual(value);
  } finally { x.f.close(); }
});

it('treats whole-history observation as a bounded view that does not duplicate physical steps or consume future payloads', () => {
  const x = battedWorldFieldExecutionFixture();
  try {
    const firstSource: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: x.baseField.source.sourceId, action: { kind: 'whole_play_history' } };
    x.sources.set(firstSource.sourceId, firstSource); const first = x.executions.accept(firstSource.sourceId);
    const secondSource: AcceptedBattedWorldFieldExecution = { ...firstSource, sourceId: 'whole-physical-history-2', previousExecutionSourceId: firstSource.sourceId };
    x.sources.set(secondSource.sourceId, secondSource); const second = x.executions.accept(secondSource.sourceId);
    if (first.execution.kind !== 'whole_play_history' || second.execution.kind !== 'whole_play_history') throw new Error('whole observers');
    expect(second.execution.physicalHistory.physicalSteps).toEqual(first.execution.physicalHistory.physicalSteps);
    expect(second.execution.physicalHistory.horizon).toEqual(first.execution.physicalHistory.horizon);
    expect(second.execution.physicalHistory.observations).toHaveLength(1);
    expect(second.execution.physicalHistory.observations[0]).not.toHaveProperty('physicalHistory');
    const end = second.execution.field.motion.world.moment.ball.tick;
    const move: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'motion-after-whole-observation', previousExecutionSourceId: secondSource.sourceId,
      action: { kind: 'motion', availableAtTick: end, throughTick: end + 1000, commands: x.fieldSource.commands } };
    x.sources.set(move.sourceId, move); const advanced = x.executions.accept(move.sourceId);
    expect(advanced.execution.field.motion.world.moment.elapsedSeconds).toBeGreaterThan(first.execution.physicalHistory.horizon.elapsedSeconds);
    x.f.db.prepare("UPDATE batted_world_field_executions SET source_json='invalid-future-payload' WHERE source_id=?").run(move.sourceId);
    expect(x.executions.read(firstSource.sourceId)).toEqual(first);
    expect(x.executions.read(secondSource.sourceId)).toEqual(second);
    x.f.db.prepare('UPDATE batted_world_field_execution_heads SET revision=revision+1').run();
    expect(() => x.executions.read(firstSource.sourceId)).toThrow(/head/);
  } finally { x.f.close(); }
});

it('rejects caller histories, timestamps, results and closure instead of treating them as whole-play evidence', () => {
  const x = battedWorldFieldExecutionFixture();
  try {
    for (const property of ['timeline', 'physicalHistory', 'events', 'horizon', 'playEnd', 'officialClosure', 'frontier', 'ruling']) {
      const source = { ...x.source, action: { kind: 'whole_play_history', [property]: {} } } as AcceptedBattedWorldFieldExecution;
      x.sources.set(source.sourceId, source);
      expect(() => x.executions.accept(source.sourceId)).toThrow();
    }
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_executions').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});

it('retains incoming rebound and persistent post-response states at one actual time without collapsing raw bag provenance', async () => {
  const { battedWorldFieldFixture } = await import('./BattedWorldFieldFixtures.test-support');
  const x = battedWorldFieldFixture(undefined, true, true, undefined,
    { material: { restitution: 0, tangentialDamping: 0.25, spinDamping: 0.2 } });
  try {
    const first = x.fields.accept(x.source.sourceId), at = first.field.motion.world.moment;
    const next = { ...x.source, sourceId: 'whole-persistent-field-2', previousFieldSourceId: first.source.sourceId,
      availableAtTick: at.ball.tick, throughTick: at.ball.tick + 100_000 };
    x.sources.set(next.sourceId, next); const second = x.fields.accept(next.sourceId);
    expect(second.field.motion.world).toMatchObject({ kind: 'boundary', pendingReason: 'persistent_contact' });
    const source: AcceptedBattedWorldFieldExecution = { sourceId: 'whole-persistent-view', sourceVersion: 'synthetic-v1',
      baseFieldSourceId: second.source.sourceId, previousExecutionSourceId: null, action: { kind: 'whole_play_history' } };
    const executions = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields,
      { readAcceptedExecution: (id) => id === source.sourceId ? source : null }));
    const observed = executions.accept(source.sourceId);
    if (observed.execution.kind !== 'whole_play_history') throw new Error('whole persistent history');
    const history = observed.execution.physicalHistory;
    expect(history.physicalSteps).toHaveLength(2);
    expect(history.physicalSteps[0].field).toEqual(first.field);
    expect(history.physicalSteps[1].field).toEqual(second.field);
    expect(history.physicalSteps[0].field.baseContacts[0].continuing).toBeUndefined();
    expect(history.physicalSteps[1].field.baseContacts[0].continuing).toBe(true);
    expect(history.physicalSteps[0].field.motion.world.moment.ball.velocity)
      .not.toEqual(history.physicalSteps[1].field.motion.world.moment.ball.velocity);
    expect(history.frames.find((frame) => frame.elapsedSeconds === at.elapsedSeconds)?.occurrences.map((occurrence) => occurrence.phase))
      .toEqual(['world_boundary', 'response_cursor', 'world_boundary']);
    expect(history.horizon).toEqual(second.field.motion.world.moment);
    expect(history.cursor).toBeNull();
    expect(history.end).toEqual({ kind: 'unestablished' });
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields));
    expect(reopened.read(source.sourceId)).toEqual(observed);
    expect(x.fields.read(first.source.sourceId)).toEqual(first);
  } finally { x.f.close(); }
});
