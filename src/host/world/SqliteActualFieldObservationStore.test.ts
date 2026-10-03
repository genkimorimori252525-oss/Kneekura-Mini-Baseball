import { expect, it } from 'vitest';
import { actualFieldObservationFixture as fixture, installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { openSqliteActualFieldObservationStore } from './SqliteActualFieldObservationStore';
import type { AcceptedActualFieldObservation } from './ActualFieldObservation';

it('samples only owned actual state, preserves original archives, and replays immutable perception', () => {
  const x = fixture();
  try {
    const before = x.f.db.prepare('SELECT source_hash,snapshot_hash FROM batted_world_field_executions ORDER BY revision').all();
    const result = x.observations.accept(x.observationSource.sourceId);
    expect(result.revision).toBe(1);
    expect(result.receipt.at).toEqual({ originTick: x.capture.moment.originTick, elapsedSeconds: x.capture.moment.elapsedSeconds, tick: x.capture.moment.ball.tick });
    expect(result.receipt.results.find((value) => value.target.kind === 'ball')?.status).toBe('detected');
    expect(result.receipt.perceived.ball).not.toBeNull();
    expect(result.receipt.perceived.ball?.estimate.position).not.toEqual(x.capture.moment.ball.position);
    expect(result.receipt.perceived).toMatchObject({ observerId: x.actor.binding.playerId, knownContext: null, communications: [] });
    expect(result.receipt).not.toHaveProperty('truth');
    expect(result).not.toHaveProperty('physicalHistory');
    expect(x.observations.accept(x.observationSource.sourceId)).toEqual(result);
    const reopened = x.f.track(openSqliteActualFieldObservationStore(x.f.path));
    expect(reopened.read(x.observationSource.sourceId)).toEqual(result);
    expect(reopened.accept(x.observationSource.sourceId)).toEqual(result);
    expect(x.f.db.prepare('SELECT source_hash,snapshot_hash FROM batted_world_field_executions ORDER BY revision').all()).toEqual(before);
    expect(x.fields.read(x.baseField.source.sourceId)).toEqual(x.baseField);
  } finally { x.f.close(); }
});

it('rejects injected truth, focus duration, outcomes, foreign scopes and missing models without a write', () => {
  const x = fixture();
  try {
    const rejects = [
      ...['at', 'truth', 'estimate', 'confidence', 'availableAtTick', 'outcome', 'complete', 'focusedSinceTick'].map((key) => ({ ...x.observationSource, [key]: 1 })),
      { ...x.observationSource, playerId: 'absent' },
      { ...x.observationSource, physicalPitchSourceId: 'foreign' },
      { ...x.observationSource, observationModelSourceId: 'absent' },
      { ...x.observationSource, executionSourceId: null },
      { ...x.observationSource, view: { ...x.observationSource.view, attentionTarget: { kind: 'base', base: 1 } } },
      { ...x.observationSource, view: { ...x.observationSource.view, forward: { x: 0, y: 0, z: 0 } } },
      { ...x.observationSource, view: { ...x.observationSource.view, focusedSinceTick: 0 } },
      { ...x.observationSource, view: { ...x.observationSource.view, bodyRelativeEyeOffset: { 'x|y': 0, z: 0 } } },
    ];
    for (const source of rejects) {
      x.observationSources.set(source.sourceId, source as AcceptedActualFieldObservation);
      expect(() => x.observations.accept(source.sourceId)).toThrow();
    }
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_field_observations').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});

it('retains old memory when refresh is not due and derives focus only from accepted history', () => {
  const x = fixture();
  try {
    const first = x.observations.accept(x.observationSource.sourceId);
    const next: AcceptedActualFieldObservation = { ...x.observationSource, sourceId: 'actual-observation-2', previousObservationSourceId: first.source.sourceId,
      view: { ...x.observationSource.view, attentionTarget: { kind: 'player', playerId: x.receiver.playerId } } };
    x.observationSources.set(next.sourceId, next); const second = x.observations.accept(next.sourceId);
    expect(second.receipt.samples).toEqual(first.receipt.samples);
    expect(second.receipt.results.every((result) => result.status === 'refresh_not_due')).toBe(true);
    expect(second.receipt.focusStartedAt).toEqual(second.receipt.at);
    expect(second.receipt.perceived.ball).toEqual(first.receipt.perceived.ball);
    expect(second.receipt.perceived.attention).toEqual({ target: next.view.attentionTarget, focusedSinceTick: second.receipt.at.tick });
    x.observationSources.set(next.sourceId, { ...next, view: x.observationSource.view });
    expect(() => x.observations.accept(next.sourceId)).toThrow(/frozen/);
  } finally { x.f.close(); }
});

it('bounds the null execution prefix across later descendant field ownership without consuming future payloads', async () => {
  const { battedWorldFieldExecutionFixture } = await import('./BattedWorldFieldExecutionFixtures.test-support');
  const { battedWorldFieldExecutionEvidenceFromSqlite } = await import('./SqliteBattedWorldFieldExecutionStore');
  const x = battedWorldFieldExecutionFixture();
  try {
    const observation = installSyntheticObservation(x, 'p2', null);
    const saved = observation.observations.accept(observation.observationSource.sourceId);
    x.f.db.exec('ALTER TABLE batted_world_field_executions RENAME TO absent_execution_payloads');
    expect(() => observation.observations.read(saved.source.sourceId)).toThrow(/tables/);
    x.f.db.exec('ALTER TABLE batted_world_field_execution_heads RENAME TO absent_execution_heads');
    expect(observation.observations.read(saved.source.sourceId)).toEqual(saved);
    x.f.db.exec('ALTER TABLE absent_execution_payloads RENAME TO batted_world_field_executions');
    expect(() => observation.observations.read(saved.source.sourceId)).toThrow(/tables/);
    x.f.db.exec('ALTER TABLE absent_execution_heads RENAME TO batted_world_field_execution_heads');
    const first = x.baseField, end = first.field.motion.world.moment.ball.tick;
    const next = { ...x.fieldSource, sourceId: 'later-field', previousFieldSourceId: first.source.sourceId,
      availableAtTick: end, throughTick: end + 1000 };
    x.fieldSources.set(next.sourceId, next); const second = x.fields.accept(next.sourceId);
    const execution = { ...x.source, sourceId: 'later-field-owner', baseFieldSourceId: second.source.sourceId,
      action: { kind: 'whole_play_history' as const } };
    x.sources.set(execution.sourceId, execution); x.executions.accept(execution.sourceId);
    const own = battedWorldFieldExecutionEvidenceFromSqlite(x.f.db);
    expect(own.scope(first, null)).toEqual([]);
    expect(observation.observations.read(saved.source.sourceId)).toEqual(saved);
    const stale = { ...saved.source, sourceId: 'stale-original-field', previousObservationSourceId: saved.source.sourceId };
    observation.observationSources.set(stale.sourceId, stale);
    expect(() => observation.observations.accept(stale.sourceId)).toThrow();
    x.f.db.prepare("UPDATE batted_world_field_actions SET source_json='invalid-future-payload' WHERE source_id=?").run(second.source.sourceId);
    x.f.db.prepare("UPDATE batted_world_field_executions SET source_json='invalid-future-payload' WHERE source_id=?").run(execution.sourceId);
    expect(own.scope(first, null)).toEqual([]);
    expect(observation.observations.read(saved.source.sourceId)).toEqual(saved);
    x.f.db.prepare('UPDATE batted_world_field_execution_heads SET revision=revision+1').run();
    expect(() => own.scope(first, null)).toThrow(/head/);
  } finally { x.f.close(); }
});

it('rejects future observation pointer metadata corruption while retaining bounded payload independence', () => {
  const x = fixture();
  try {
    const first = x.observations.accept(x.observationSource.sourceId);
    const secondSource = { ...first.source, sourceId: 'future-observation', previousObservationSourceId: first.source.sourceId };
    x.observationSources.set(secondSource.sourceId, secondSource); x.observations.accept(secondSource.sourceId);
    for (const [column, original] of [ ['observation_model_source_id', secondSource.observationModelSourceId],
      ['base_field_source_id', secondSource.baseFieldSourceId], ['execution_source_id', secondSource.executionSourceId] ] as const) {
      x.f.db.prepare(`UPDATE actual_field_observations SET ${column}='foreign-pointer' WHERE source_id=?`).run(secondSource.sourceId);
      expect(() => x.observations.read(first.source.sourceId), column).toThrow(/metadata|scope|prefix/);
      x.f.db.prepare(`UPDATE actual_field_observations SET ${column}=? WHERE source_id=?`).run(original, secondSource.sourceId);
    }
    x.f.db.prepare("UPDATE actual_field_observations SET source_json='unread-future-payload',snapshot_json='unread-future-payload' WHERE source_id=?").run(secondSource.sourceId);
    expect(x.observations.read(first.source.sourceId)).toEqual(first);
  } finally { x.f.close(); }
});
