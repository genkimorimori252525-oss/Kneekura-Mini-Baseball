import type { DatabaseSync } from 'node:sqlite';
import { runnerObservationFixture, type OwnedRunnerObservation } from './OwnedRunnerFieldObservationContracts.test-support';
import { ownedRunnerFieldObservationEvidenceFromSqlite } from './SqliteActualFieldObservationStore';
import { deriveRunnerPieces, type RunnerPiecesSource } from './OwnedRunnerFieldPiecesContracts.test-support';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Test-only proposed contracts. No history or knowledge implementation is supplied. */
export type RunnerObservationHistorySource = Readonly<{
  kind: 'owned_runner_field_observation_history_v1'; sourceId: string; sourceVersion: string;
  physicalPitchSourceId: string; playerId: string; baseFieldSourceId: string; executionSourceId: null;
  prePitchRunnerSourceId: string; observationModelSourceId: string; previousObservationSourceId: string | null;
  view: OwnedRunnerObservation['source']['view'];
}>;
export type RunnerObservationHistory = Omit<OwnedRunnerObservation, 'version' | 'source'> & Readonly<{
  version: 'owned_runner_field_observation_history_v1'; source: RunnerObservationHistorySource;
  revision: number; history: readonly RunnerObservationHistorySource[];
}>;
export type RunnerObservationHistoryReader = Readonly<{
  derive(source: RunnerObservationHistorySource): RunnerObservationHistory;
  read(sourceId: string): RunnerObservationHistory | null;
}>;
export type RunnerObservationHistoryStore = Omit<RunnerObservationHistoryReader, 'derive'> & Readonly<{
  accept(sourceId: string): RunnerObservationHistory; close(): void;
}>;
type Module = Readonly<{
  ownedRunnerFieldObservationHistoryEvidenceFromSqlite(db: DatabaseSync): RunnerObservationHistoryReader;
  openSqliteOwnedRunnerFieldObservationStore(path: string, authority?: Readonly<{
    readAcceptedObservation(sourceId: string): RunnerObservationHistorySource | null;
  }>): RunnerObservationHistoryStore;
}>;
export const requireRunnerObservationHistory = (module: unknown, db: DatabaseSync) => {
  const factory = (module as Partial<Module>)?.ownedRunnerFieldObservationHistoryEvidenceFromSqlite;
  if (typeof factory !== 'function') throw new Error('owned runner observation history capability is not implemented');
  return factory(db);
};
export const requireRunnerObservationHistoryStore = (module: unknown): Module['openSqliteOwnedRunnerFieldObservationStore'] => {
  const open = (module as Partial<Module>)?.openSqliteOwnedRunnerFieldObservationStore;
  if (typeof open !== 'function') throw new Error('owned runner observation history writer capability is not implemented');
  return open;
};

/** Real field/model/projection prerequisites; only the original flight/response/base
 * readers are substituted by the source suites. Direct row insertion below is
 * fixture setup for own-reader contracts, never claimed Native writer proof. */
export const runnerObservationHistoryFixture = (state: Parameters<typeof runnerObservationFixture>[0],
  options: Parameters<typeof runnerObservationFixture>[1] = {}) => {
  const x = runnerObservationFixture(state, options);
  try {
    const projection = ownedRunnerFieldObservationEvidenceFromSqlite(x.db).derive(x.source);
    const source: RunnerObservationHistorySource = { kind: 'owned_runner_field_observation_history_v1',
      sourceId: 'runner-observation-history-1', sourceVersion: x.source.sourceVersion,
      physicalPitchSourceId: x.source.physicalPitchSourceId, playerId: x.source.playerId,
      baseFieldSourceId: x.source.fieldSourceId, executionSourceId: null, prePitchRunnerSourceId: x.source.prePitchRunnerSourceId,
      observationModelSourceId: x.source.observationModelSourceId, previousObservationSourceId: null, view: x.source.view };
    const archive = (value: RunnerObservationHistory) => {
      const s = value.source;
      x.db.prepare('INSERT INTO actual_field_observations VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(s.sourceId, s.physicalPitchSourceId,
        s.playerId, s.baseFieldSourceId, s.executionSourceId, s.observationModelSourceId, s.previousObservationSourceId,
        value.revision, json(s), hash(s), json(value), hash(value));
      x.db.prepare('DELETE FROM actual_field_observation_heads').run();
      x.db.prepare('INSERT INTO actual_field_observation_heads VALUES (?,?,?,?)').run(s.physicalPitchSourceId, s.playerId, s.sourceId, value.revision);
    };
    let field = x.field;
    const appendField = (throughTick: number) => {
      const next: RunnerPiecesSource = { ...field.source, sourceId: `runner-history-field-${field.revision + 1}`,
        previousFieldSourceId: field.source.sourceId, throughTick };
      field = deriveRunnerPieces(x.own, next); x.archive(field); return field;
    };
    const next = (previous: RunnerObservationHistory, patch: Partial<RunnerObservationHistorySource> = {}): RunnerObservationHistorySource => ({
      ...source, sourceId: `runner-observation-history-${previous.revision + 1}`, baseFieldSourceId: field.source.sourceId,
      previousObservationSourceId: previous.source.sourceId, ...patch,
    });
    return { ...x, projection, historySource: source, archiveObservation: archive, appendField, nextObservation: next };
  } catch (error) { x.close(); throw error; }
};
