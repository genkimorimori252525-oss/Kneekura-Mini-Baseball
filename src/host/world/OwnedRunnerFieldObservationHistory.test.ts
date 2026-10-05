import { expect, it, vi } from 'vitest';
import * as observations from './SqliteActualFieldObservationStore';
import { requireRunnerObservationHistory, runnerObservationHistoryFixture } from './OwnedRunnerFieldObservationHistoryContracts.test-support';
import { predictSpatialObservationMemory } from '../../core/sim/perception/ObservationMemory';
const state = vi.hoisted(() => ({ flight: null as any, response: null as any, bases: null as any }));
vi.mock('./SqliteBattedBallFlightStore', () => ({ battedBallFlightEvidenceFromSqlite: () => ({ read: () => state.flight }) }));
vi.mock('./SqliteBattedContactResponseStore', () => ({ battedContactResponseEvidenceFromSqlite: () => ({ read: () => state.response }) }));
vi.mock('./SqliteBattedWorldBaseGeometryStore', () => ({ battedWorldBaseGeometryEvidenceFromSqlite: () => ({ read: () => state.bases }) }));

it.each([1, 2, 3] as const)('owns the first sensory receipt and original base %s provenance without completing live knowledge', startingBase => {
  const x = runnerObservationHistoryFixture(state, { startingBase });
  try {
    const own = requireRunnerObservationHistory(observations, x.db), value = own.derive(x.historySource);
    expect(value.version).toBe('owned_runner_field_observation_history_v1');
    expect(value.receipt).toEqual(x.projection.receipt); expect(value.revision).toBe(1); expect(value.history).toEqual([x.historySource]);
    expect(value.originalPublicContext).toEqual(x.projection.originalPublicContext); expect(value.knowledge).toEqual(x.projection.knowledge);
    expect(value.dependencyHashes).toEqual(x.projection.dependencyHashes); expect(value.motionRevision).toBe(x.runner.source.motionRevision);
    expect(value.receipt.results).toHaveLength(11); expect(value.receipt.perceived.knownContext).toBeNull();
    x.archiveObservation(value); expect(own.read(value.source.sourceId)).toEqual(value);
    for (const key of ['decision', 'motionIntent', 'consumption', 'activeCommand', 'playEnd']) expect(value).not.toHaveProperty(key);
  } finally { x.close(); }
});

it('retains samples at an equal exact cut instead of treating a new Source as a new capture', () => {
  const x = runnerObservationHistoryFixture(state);
  try {
    const own = requireRunnerObservationHistory(observations, x.db), first = own.derive(x.historySource); x.archiveObservation(first);
    const second = own.derive(x.nextObservation(first));
    expect(second.revision).toBe(2); expect(second.receipt.at).toEqual(first.receipt.at);
    expect(second.receipt.samples).toEqual(first.receipt.samples); expect(second.receipt.focusStartedAt).toEqual(first.receipt.focusStartedAt);
    expect(second.receipt.results.find(r => r.target.kind === 'ball')!.status).toBe('refresh_not_due');
    expect(second.history).toEqual([first.source, second.source]);
  } finally { x.close(); }
});

it('retains a real fractional rebound and advances to a distinct executed cut in the same rounded tick', () => {
  const x = runnerObservationHistoryFixture(state, { collision: true });
  try {
    const own = requireRunnerObservationHistory(observations, x.db), first = own.derive(x.historySource); x.archiveObservation(first);
    expect(x.field.field.motion.response.kind).toBe('rebound');
    expect(first.receipt.at.elapsedSeconds).toBeLessThan((first.receipt.at.tick - first.receipt.at.originTick) / 1_000_000);
    const physical = x.appendField(first.receipt.at.tick), second = own.derive(x.nextObservation(first));
    expect(second.receipt.at.tick).toBe(first.receipt.at.tick);
    expect(second.receipt.at.elapsedSeconds).toBeGreaterThan(first.receipt.at.elapsedSeconds);
    expect(second.receipt.at.elapsedSeconds).toBe(physical.field.motion.world.moment.elapsedSeconds);
    expect(second.receipt.samples).toEqual(first.receipt.samples);
    x.archiveObservation(second); expect(own.read(first.source.sourceId)).toEqual(first); expect(own.read(second.source.sourceId)).toEqual(second);
    // Both moments share a tick; the actual earlier cut must still be rejected
    // as a new continuation after the later owned observation.
    expect(() => own.derive(x.nextObservation(second, { baseFieldSourceId: first.source.baseFieldSourceId }))).toThrow();
  } finally { x.close(); }
});

it('retains a genuine zero-time unresolved boundary without inventing a ball or future coverage', () => {
  const x = runnerObservationHistoryFixture(state, { zeroBag: true });
  try {
    const own = requireRunnerObservationHistory(observations, x.db), first = own.derive(x.historySource); x.archiveObservation(first);
    const second = own.derive(x.nextObservation(first));
    expect(second.receipt.at.elapsedSeconds).toBe(0); expect(second.receipt.at).toEqual(first.receipt.at);
    expect(second.receipt.samples.ball).toBeNull(); expect(second.receipt.perceived.ball).toBeNull();
    expect(second.receipt.results[0].status).toBe('physical_state_unavailable'); expect(second.knowledge.consumedSignals).toEqual([]);
  } finally { x.close(); }
});

it('carries earlier memory through due but unseen evidence using the existing decay law', () => {
  const x = runnerObservationHistoryFixture(state);
  try {
    const own = requireRunnerObservationHistory(observations, x.db), first = own.derive(x.historySource); x.archiveObservation(first);
    expect(first.receipt.samples.ball).not.toBeNull();
    x.appendField(first.receipt.at.tick + x.observationModel.source.calibration.refreshPolicy.attendedIntervalTicks);
    const forward = first.source.view.forward, second = own.derive(x.nextObservation(first, { view: { ...first.source.view,
      forward: { x: -forward.x, y: -forward.y, z: -forward.z } } }));
    expect(second.receipt.results[0].status).toBe('not_detected'); expect(second.receipt.samples.ball).toEqual(first.receipt.samples.ball);
    expect(second.receipt.perceived.ball).toEqual(predictSpatialObservationMemory(first.receipt.samples.ball!.sample,
      second.receipt.at.tick, x.observationModel.source.calibration.memoryDecayParameters));
    expect(second.receipt.perceived.ball!.confidence).toBeLessThan(first.receipt.perceived.ball!.confidence);
    expect(second.knowledge).toEqual(first.knowledge);
  } finally { x.close(); }
});

it('changes only the existing attention focus baseline on an explicit view change', () => {
  const x = runnerObservationHistoryFixture(state);
  try {
    const own = requireRunnerObservationHistory(observations, x.db), first = own.derive(x.historySource); x.archiveObservation(first);
    x.appendField(first.receipt.at.tick + 1);
    const second = own.derive(x.nextObservation(first, { view: { ...first.source.view, attentionTarget: { kind: 'player', playerId: 'batter' } } }));
    expect(second.receipt.focusStartedAt).toEqual(second.receipt.at); expect(second.receipt.focusStartedAt).not.toEqual(first.receipt.focusStartedAt);
    expect(second.receipt.samples.ball).toEqual(first.receipt.samples.ball);
    expect(second.receipt.temporalPolicy).toBe('instantaneous_capture_tick_refresh_and_memory');
  } finally { x.close(); }
});

it('keeps historical receipt replay bounded while rejecting a stale new observation', () => {
  const x = runnerObservationHistoryFixture(state);
  try {
    const own = requireRunnerObservationHistory(observations, x.db), first = own.derive(x.historySource); x.archiveObservation(first);
    const nextField = x.appendField(first.receipt.at.tick + 1), second = own.derive(x.nextObservation(first)); x.archiveObservation(second);
    expect(() => own.derive(x.nextObservation(second, { baseFieldSourceId: first.source.baseFieldSourceId }))).toThrow();
    x.db.prepare("UPDATE actual_field_observations SET source_json='invalid-future-payload',snapshot_json='invalid-future-payload' WHERE source_id=?").run(second.source.sourceId);
    x.db.prepare("UPDATE batted_world_field_actions SET source_json='invalid-future-field-payload',snapshot_json='invalid-future-field-payload' WHERE source_id=?").run(nextField.source.sourceId);
    expect(own.read(first.source.sourceId)).toEqual(first);
    expect(() => own.read(second.source.sourceId)).toThrow();
  } finally { x.close(); }
});

it('preserves the dedicated runner reader and the legacy observation admission fence', () => {
  const x = runnerObservationHistoryFixture(state);
  try {
    const own = requireRunnerObservationHistory(observations, x.db), first = own.derive(x.historySource); x.archiveObservation(first);
    expect(own.read(first.source.sourceId)).toEqual(first);
    expect(() => observations.actualFieldObservationEvidenceFromSqlite(x.db).read(first.source.sourceId)).toThrow();
    expect(() => x.observations.accept(first.source.sourceId)).toThrow();
    expect(x.db.prepare('SELECT count(*) AS n FROM actual_field_observations').get()!.n).toBe(1);
  } finally { x.close(); }
});
