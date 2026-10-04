import { expect, it } from 'vitest';
import { ownedBattedWorldMotionFixture } from './OwnedBattedWorldMotionFixtures.test-support';
import { openSqliteActualLivePlayStore } from './SqliteActualLivePlayStore';
import { openSqliteActualFieldObservationStore } from './SqliteActualFieldObservationStore';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import type { AcceptedActualLivePlayScope } from './ActualLivePlayScope';

it('registers immutable cut views of one complete scope and never turns absent producers into an ended result', () => {
  const x = ownedBattedWorldMotionFixture();
  try {
    const pitch = x.baseField.response.touch.worldContact.flight.physicalPitch;
    const root: AcceptedActualLivePlayScope = { sourceId: 'root-view', sourceVersion: 'v1', capability: 'actual_live_play_scope_v1',
      physicalPitchSourceId: pitch.source.sourceId, cut: { kind: 'original_pitch' } };
    const source: AcceptedActualLivePlayScope = { ...root, sourceId: 'field-view', cut: { kind: 'field_execution',
      baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: x.first.source.sourceId } };
    const sources = new Map([[root.sourceId, root], [source.sourceId, source]]);
    const store = x.f.track(openSqliteActualLivePlayStore(x.f.path, { readAcceptedScope: id => sources.get(id) ?? null }));
    const oldRows = x.f.db.prepare('SELECT * FROM batted_world_field_executions').all();
    const rootSaved = store.accept(root.sourceId), saved = store.accept(source.sourceId);
    expect(rootSaved.scope.scopeId).toBe(saved.scope.scopeId);
    expect(rootSaved.scope.participation).toBe('physical_model_pending');
    expect(rootSaved.scope.participants.every(p => p.bodyModel === null)).toBe(true);
    const result = store.evaluate(source.sourceId);
    expect(result.kind).toBe('pending'); expect(result.playEnd).toBe(null);
    expect(result.coverage).toBe('uncertified'); expect(result.registry.resolution.kind).toBe('continues');
    expect(result.registry.frontier.actors).toHaveLength(10);
    expect(result.registry.watermark.settledThroughTick).toBe(-1);
    expect(result.registry.registry.sources.every(s => s.queue !== null || s.completion !== undefined)).toBe(true);
    expect(result.producers.find(p => p.domain === 'observation_samples')?.evidenceState).toBe('owner_not_installed');
    expect(result.registry.frontier.information).toEqual([]);
    expect(result.registry.frontier.decisions).toEqual([]);
    x.f.track(openSqliteActualFieldObservationStore(x.f.path));
    const empty = store.evaluate(source.sourceId);
    expect(empty.producers.find(p => p.domain === 'observation_samples')?.evidenceState).toBe('no_owned_output');
    expect(empty.kind).toBe('pending'); expect(store.read(source.sourceId)).toEqual(saved);
    expect(store.accept(source.sourceId)).toEqual(saved);
    const reopened = x.f.track(openSqliteActualLivePlayStore(x.f.path));
    expect(reopened.read(source.sourceId)).toEqual(saved); expect(reopened.accept(source.sourceId)).toEqual(saved);
    const oldHash = JSON.stringify(saved);
    const next = x.retain(x.first.source.sourceId, x.at + 200); x.sources.set(next.sourceId, next); x.executions.accept(next.sourceId);
    expect(JSON.stringify(store.read(source.sourceId))).toBe(oldHash);
    sources.set('stale-view', { ...source, sourceId: 'stale-view' });
    expect(() => store.accept('stale-view')).toThrow(/stale|current|prefix changed/);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_executions WHERE source_id=?').get(x.first.source.sourceId)).toEqual(oldRows[0]);
  } finally { x.f.close(); }
});

it('discovers actual observations but does not fabricate causal observation/communication work', () => {
  const x = ownedBattedWorldMotionFixture();
  try {
    const source: AcceptedActualLivePlayScope = { sourceId: 'observed-scope', sourceVersion: 'v1', capability: 'actual_live_play_scope_v1',
      physicalPitchSourceId: x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId,
      cut: { kind: 'field_execution', baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: x.first.source.sourceId } };
    const obs = installSyntheticObservation(x, 'p2', x.first.source.sourceId), observation = obs.observations.accept(obs.observationSource.sourceId);
    const store = x.f.track(openSqliteActualLivePlayStore(x.f.path, { readAcceptedScope: () => source }));
    store.accept(source.sourceId); const result = store.evaluate(source.sourceId);
    expect(result.evidence).toEqual(expect.arrayContaining([expect.objectContaining({ owner: 'actual_field_observations', sourceId: observation.source.sourceId, playerId: 'p2' })]));
    expect(result.producers.find(p => p.domain === 'observation_samples' && p.playerId === 'p2')?.evidenceState).toBe('owned_output');
    expect(result.producers.find(p => p.domain === 'observation_scheduling' && p.playerId === 'p2')?.ownership).toBe('missing_generator');
    expect(result.registry.frontier.information).toEqual([]); expect(result.kind).toBe('pending');
    const next = x.retain(x.first.source.sourceId, x.at + 200); x.sources.set(next.sourceId, next); x.executions.accept(next.sourceId);
    const future = { ...obs.observationSource, sourceId: 'future-observation', previousObservationSourceId: observation.source.sourceId, executionSourceId: next.sourceId };
    obs.observationSources.set(future.sourceId, future); obs.observations.accept(future.sourceId);
    x.f.db.prepare("UPDATE actual_field_observations SET source_json=json_set(source_json,'$.view',json('{}')), snapshot_json=json_set(snapshot_json,'$.receipt',json('{}')) WHERE source_id=?").run(future.sourceId);
    expect(store.evaluate(source.sourceId).evidence).toEqual(result.evidence);
    x.f.db.prepare('UPDATE actual_field_observation_heads SET revision=revision+0.5').run();
    expect(() => store.evaluate(source.sourceId)).toThrow(/metadata|head|scope/);
  } finally { x.f.close(); }
});

it('retains real Native decision and motor owners even when all other actors have no output rows', async () => {
  const { actualLocomotionFixture } = await import('./ActualLocomotionFixtures.test-support');
  const x = actualLocomotionFixture();
  try {
    const motor = x.locomotion.accept(x.locomotionSource.sourceId);
    const source: AcceptedActualLivePlayScope = { sourceId: 'motor-scope', sourceVersion: 'v1', capability: 'actual_live_play_scope_v1',
      physicalPitchSourceId: motor.source.physicalPitchSourceId, cut: { kind: 'field_execution',
        baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: x.executed.source.sourceId } };
    const store = x.f.track(openSqliteActualLivePlayStore(x.f.path, { readAcceptedScope: () => source }));
    store.accept(source.sourceId); const result = store.evaluate(source.sourceId);
    expect(result.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ owner: 'actual_defensive_decisions', sourceId: x.decision.source.sourceId, playerId: 'p2' }),
      expect.objectContaining({ owner: 'actual_locomotion_receipts', sourceId: motor.source.sourceId, playerId: 'p2' }),
    ]));
    expect(result.registry.registry.sources.some(s => s.intents.some(i => i.actorId === 'p2'))).toBe(true);
    expect(result.kind).toBe('pending'); expect(result.playEnd).toBe(null);
    expect(result.producers.filter(p => p.domain === 'actor_decision')).toHaveLength(10);
  } finally { x.f.close(); }
});
