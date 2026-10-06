import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { DatabaseSync } from 'node:sqlite';
import * as observations from './SqliteActualFieldObservationStore';
import { openSqliteOwnedRunnerFieldObservationStore } from './SqliteOwnedRunnerFieldObservationStore';
import type { AcceptedOwnedRunnerFieldObservationHistory } from './OwnedRunnerFieldObservationHistory';
import { openSqlitePlayerRunnerDecisionMotionModelStore } from './SqlitePlayerRunnerDecisionMotionModelStore';
import type { AcceptedPlayerRunnerDecisionMotionModel } from './PlayerRunnerDecisionMotionModel';
import { actualPlayerKinematicsEvidenceFromSqlite } from './SqliteActualPlayerKinematicsReader';
import { ownedRunnerFieldNativeFixture } from './OwnedRunnerFieldNativeFixtures.test-support';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Proposed read-only seam. This is NOT a saved decision, motor, or live-context owner. */
export type RunnerDecisionInputSource = Readonly<{
  kind: 'owned_runner_decision_input_v1'; sourceId: string; sourceVersion: string;
  physicalPitchSourceId: string; playerId: string; fieldSourceId: string;
  observationSourceId: string; publicKnowledgeSourceId: string; decisionMotionModelSourceId: string;
}>;
export type RunnerDecisionInputEvidence = Readonly<{
  version: 'owned_runner_decision_input_v1'; source: RunnerDecisionInputSource;
  playerId: string; personId: string; motionRevision: number;
  at: Readonly<{ originTick: number; elapsedSeconds: number; tick: number }>;
  dependencyHashes: Readonly<{ publicKnowledge: string; observation: string; model: string; self: string }>;
  status: 'pending'; pendingReasons: readonly ['runner_live_context_unavailable'];
  decisionInput: null; decision: null; motor: null;
}>;
export type RunnerDecisionInputReader = Readonly<{
  derive(source: RunnerDecisionInputSource, current?: boolean): RunnerDecisionInputEvidence;
}>;
export type RunnerDecisionInputModule = Readonly<{
  actualRunnerDecisionInputEvidenceFromSqlite(db: DatabaseSync): RunnerDecisionInputReader;
}>;
export const runnerInputFactory = (module: unknown): RunnerDecisionInputModule['actualRunnerDecisionInputEvidenceFromSqlite'] | undefined =>
  (module as Partial<RunnerDecisionInputModule>)?.actualRunnerDecisionInputEvidenceFromSqlite;

// The independently repaired public-baseline prerequisite is not in the current
// integrated source. Keep this shape local so the capability RED has no missing import.
type PublicSource = Readonly<{ kind: 'original_runner_public_knowledge_v1'; sourceId: string; sourceVersion: string;
  physicalPitchSourceId: string; playerId: string; physicalActorSourceId: string; prePitchRunnerSourceId: string }>;
type PublicValue = Readonly<{ source: PublicSource; recipient: Readonly<{ playerId: string; personId: string }>;
  known: Readonly<{ startingBase: 1 | 2 | 3; normalNextBase: 2 | 3 | 4; outs: number }>;
  liveContext: Readonly<{ status: 'pending'; knownContext: null; force: 'unavailable'; tagUp: 'unavailable'; consumedSignals: readonly never[] }> }>;
type PublicModule = Readonly<{ openSqliteOriginalRunnerPublicKnowledgeStore(path: string, authority?: Readonly<{
  readAcceptedKnowledge(sourceId: string): PublicSource | null;
}>): Readonly<{ accept(sourceId: string): PublicValue; read(sourceId: string): PublicValue | null; close(): void }> }>;

/** Run only after the repaired public-baseline prerequisite has passed its own gates.
 * One real registered-profile file; all source values are explicitly synthetic.
 * No archive INSERT, mocked owner, saved Match mutation, or completed PlayEnd fixture.
 */
export const runnerDecisionInputNativeFixture = (options: Readonly<{ modelVariant?: 'future_day' | 'foreign_clock' }> = {}) => {
  const openPublic = (observations as unknown as Partial<PublicModule>).openSqliteOriginalRunnerPublicKnowledgeStore;
  if (typeof openPublic !== 'function') throw new Error('runner input prerequisite: repaired public-baseline owner must be integrated first');
  const directory = mkdtempSync(join(tmpdir(), 'runner-decision-input-')), path = join(directory, 'state.sqlite');
  let x: ReturnType<typeof ownedRunnerFieldNativeFixture> | undefined, closed = false;
  const closeHandles = () => { if (x && !closed) { closed = true; x.f.close(); } };
  const close = () => { try { closeHandles(); } finally { rmSync(directory, { recursive: true, force: true }); } };
  try {
    x = ownedRunnerFieldNativeFixture({ retainedSpeedBoundary: true, databasePath: path });
    const { f } = x;
    const publicSource: PublicSource = { kind: 'original_runner_public_knowledge_v1', sourceId: 'runner-input-public',
      sourceVersion: 'synthetic-v1', physicalPitchSourceId: x.action.sourceId, playerId: x.runner.playerId,
      physicalActorSourceId: x.actor.source.sourceId, prePitchRunnerSourceId: x.runner.sourceId };
    const publicStore = f.track(openPublic(path, { readAcceptedKnowledge: id => id === publicSource.sourceId ? publicSource : null }));
    const publicKnowledge = publicStore.accept(publicSource.sourceId);
    x.touches.accept(x.touchSource.sourceId); x.responses.accept(x.responseSource.sourceId);
    x.bases.accept(x.baseSource.sourceId); x.fields.acceptGeometry(x.geometrySource.sourceId);
    const initial = x.fields.accept(x.source.sourceId);
    // Exact positive cut before the fixture's controller phase at +125,000 and
    // physical impact at +200,000. The original authority already covers it.
    const pieceSource = { ...x.source, kind: 'owned_runner_field_pieces_v1' as const, sourceId: 'runner-input-field',
      previousFieldSourceId: initial.source.sourceId, throughTick: x.at + 100_000 };
    x.sources.set(pieceSource.sourceId, pieceSource); const field = x.fields.accept(pieceSource.sourceId);
    const sensory = installSyntheticObservation({ f, baseField: field }, x.runner.playerId, null);
    const observationSource: AcceptedOwnedRunnerFieldObservationHistory = { kind: 'owned_runner_field_observation_history_v1',
      sourceId: 'runner-input-observation-1', sourceVersion: 'synthetic-v1', physicalPitchSourceId: x.action.sourceId,
      playerId: x.runner.playerId, baseFieldSourceId: field.source.sourceId, executionSourceId: null,
      prePitchRunnerSourceId: x.runner.sourceId, observationModelSourceId: sensory.observationModel.source.sourceId,
      previousObservationSourceId: null, view: sensory.observationSource.view };
    const observationSources = new Map([[observationSource.sourceId, observationSource]]);
    const history = f.track(openSqliteOwnedRunnerFieldObservationStore(path, { readAcceptedObservation: id => observationSources.get(id) ?? null }));
    const observation = history.accept(observationSource.sourceId);
    const cut = { kind: 'owned_runner_field_pieces_v1' as const, physicalPitchSourceId: x.action.sourceId,
      playerId: x.runner.playerId, fieldSourceId: field.source.sourceId };
    const self = actualPlayerKinematicsEvidenceFromSqlite(f.db).readOwnedRunnerFieldPieces(cut);
    const modelSource: AcceptedPlayerRunnerDecisionMotionModel = { sourceId: 'runner-input-model', sourceVersion: 'synthetic-v1',
      capability: 'runner_decision_motion_v1', careerId: x.physical.frame.prePitchRunner!.binding.careerId, playerId: self.playerId,
      personLinkSourceId: self.personLinkSourceId, acceptedAtDay: self.gameDay + (options.modelVariant === 'future_day' ? 1 : 0),
      // Same explicit synthetic values as PlayerRunnerDecisionMotionModelContracts.
      // They are accepted test inputs, never fallback production coefficients.
      decision: { minimumCueConfidence: 0.5, coachTrust: 1, minimumAdvanceSafetyMarginTicks: 50_000, decisionAbility: 0.8,
        timingParameters: { minimumDecisionDelayTicks: 30_000, maximumDecisionDelayTicks: 180_000, fixedRecognitionOffsetTicks: 10_000 } },
      motion: options.modelVariant === 'foreign_clock' ? { ...x.runner.parameters, ticksPerSecond: x.runner.parameters.ticksPerSecond * 2 }
        : x.runner.parameters };
    // Each optional variant is prospectively accepted in its own fixture file.
    // Never replace a previously accepted Player baseline to create a mismatch.
    const modelSources = new Map([[modelSource.sourceId, modelSource]]);
    const models = f.track(openSqlitePlayerRunnerDecisionMotionModelStore(path, { readAcceptedModel: id => modelSources.get(id) ?? null }));
    const model = models.accept(modelSource.sourceId);
    const source: RunnerDecisionInputSource = { kind: 'owned_runner_decision_input_v1', sourceId: 'runner-input', sourceVersion: 'synthetic-v1',
      physicalPitchSourceId: x.action.sourceId, playerId: x.runner.playerId, fieldSourceId: field.source.sourceId,
      publicKnowledgeSourceId: publicSource.sourceId, observationSourceId: observationSource.sourceId,
      decisionMotionModelSourceId: modelSource.sourceId };
    return { ...x, path, field, publicKnowledge, model, models, modelSources,
      observation, observationSource, observationSources, history, self, source,
      dependencyHashes: { publicKnowledge: hash(publicKnowledge), observation: hash(observation), model: hash(model), self: hash(self) },
      closeHandles, close };
  } catch (error) { close(); throw error; }
};

export const readOnlyRunnerInputSnapshot = (db: DatabaseSync) => ({
  schema: db.prepare('SELECT name,type,sql FROM sqlite_master ORDER BY name').all(),
  fields: db.prepare('SELECT * FROM batted_world_field_actions ORDER BY revision').all(),
  fieldHeads: db.prepare('SELECT * FROM batted_world_field_heads').all(),
  observations: db.prepare('SELECT * FROM actual_field_observations ORDER BY revision').all(),
  observationHeads: db.prepare('SELECT * FROM actual_field_observation_heads').all(),
  models: db.prepare('SELECT * FROM world_player_runner_decision_motion_models ORDER BY source_id').all(),
  publicKnowledge: db.prepare('SELECT * FROM actual_runner_public_knowledge ORDER BY source_id').all(),
  people: db.prepare('SELECT * FROM world_player_person_links ORDER BY source_id').all(),
  matches: db.prepare('SELECT * FROM matches ORDER BY match_id').all(),
});
export const openRunnerInputReadConnection = (path: string) => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  return new DatabaseSync(path, { readOnly: true });
};
