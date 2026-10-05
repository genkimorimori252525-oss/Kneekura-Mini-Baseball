import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actualFieldObservationInput, type AcceptedActualFieldObservation } from './ActualFieldObservation';
import type { OwnedRunnerFieldObservationProjection, OwnedRunnerFieldObservationSource } from './OwnedRunnerFieldObservation';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type AcceptedOwnedRunnerFieldObservationHistory = Readonly<{
  kind: 'owned_runner_field_observation_history_v1'; sourceId: string; sourceVersion: string;
  physicalPitchSourceId: string; playerId: string; baseFieldSourceId: string; executionSourceId: null;
  prePitchRunnerSourceId: string; observationModelSourceId: string; previousObservationSourceId: string | null;
  view: AcceptedActualFieldObservation['view'];
}>;
export type DurableOwnedRunnerFieldObservationHistory = Omit<OwnedRunnerFieldObservationProjection, 'version' | 'source'> & Readonly<{
  version: 'owned_runner_field_observation_history_v1'; source: AcceptedOwnedRunnerFieldObservationHistory;
  revision: number; history: readonly AcceptedOwnedRunnerFieldObservationHistory[];
}>;
/** Calculation DTO only; never presented to the legacy Source owner for admission. */
export const runnerObservationSensoryInput = (source: AcceptedOwnedRunnerFieldObservationHistory): AcceptedActualFieldObservation => {
  const { kind: _kind, prePitchRunnerSourceId: _runner, ...sensory } = source;
  return actualFieldObservationInput(sensory, source.sourceId);
};
export const ownedRunnerFieldObservationHistoryInput = (raw: AcceptedOwnedRunnerFieldObservationHistory,
  sourceId?: string): AcceptedOwnedRunnerFieldObservationHistory => {
  const source = cloneInert(raw);
  const keys = ['kind', 'sourceId', 'sourceVersion', 'physicalPitchSourceId', 'playerId', 'baseFieldSourceId', 'executionSourceId',
    'prePitchRunnerSourceId', 'observationModelSourceId', 'previousObservationSourceId', 'view'];
  if (!source || typeof source !== 'object' || Array.isArray(source) || Object.keys(source).sort().join('|') !== keys.sort().join('|')
    || source.kind !== 'owned_runner_field_observation_history_v1' || source.executionSourceId !== null
    || sourceId !== undefined && source.sourceId !== sourceId || typeof source.prePitchRunnerSourceId !== 'string'
    || !source.prePitchRunnerSourceId.length || source.prePitchRunnerSourceId.trim() !== source.prePitchRunnerSourceId) {
    throw new Error('invalid owned runner observation history Source');
  }
  runnerObservationSensoryInput(source); return freeze(source);
};
export const runnerObservationProjectionInput = (source: AcceptedOwnedRunnerFieldObservationHistory): OwnedRunnerFieldObservationSource => ({
  kind: 'owned_runner_field_observation_v1', sourceId: source.sourceId, sourceVersion: source.sourceVersion,
  physicalPitchSourceId: source.physicalPitchSourceId, playerId: source.playerId, fieldSourceId: source.baseFieldSourceId,
  prePitchRunnerSourceId: source.prePitchRunnerSourceId, observationModelSourceId: source.observationModelSourceId, view: source.view,
});
