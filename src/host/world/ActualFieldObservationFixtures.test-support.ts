import { battedWorldFieldThrowFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import { openSqlitePlayerObservationModelStore, type AcceptedPlayerObservationModel } from './SqlitePlayerObservationModelStore';
import { openSqlitePlayerFieldingModelStore, type DurablePlayerFieldingModel, type AcceptedPlayerFieldingModel } from './SqlitePlayerFieldingModelStore';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import { openSqliteActualFieldObservationStore } from './SqliteActualFieldObservationStore';
import type { AcceptedActualFieldObservation } from './ActualFieldObservation';

type FixtureBase = Readonly<{ f: Pick<ReturnType<typeof battedWorldFieldThrowFixture>['f'], 'path' | 'track'>; baseField: DurableBattedWorldFieldAction }>;
/** Explicit synthetic eye and calibration values only, not production defaults. */
export const installSyntheticObservation = (x: FixtureBase, playerId: string, executionSourceId: string | null,
  existingModel?: DurablePlayerFieldingModel, configure?: (source: AcceptedPlayerObservationModel) => AcceptedPlayerObservationModel,
  configureFielding?: (source: AcceptedPlayerFieldingModel) => AcceptedPlayerFieldingModel) => {
  const world = x.baseField.response.touch.worldContact;
  const actor = world.modelActorEvidence.find((value) => value.binding.playerId === playerId)!;
  const fieldingSource = { sourceId: `observation-fielding-${playerId}`, sourceVersion: 'synthetic-v1', careerId: actor.binding.careerId,
    playerId, personLinkSourceId: actor.binding.personLinkSourceId, acceptedAtDay: actor.binding.gameDay,
    ratings: { positionSuitability: { P: 0.5, C: 0.5, '1B': 0.5, '2B': 0.5, '3B': 0.5, SS: 0.5, LF: 0.5, CF: 0.5, RF: 0.5 },
      firstStep: 0.5, acceleration: 0.5, battedBallRead: 0.5, routeEfficiency: 0.5, catching: 0.5, transfer: 0.5,
      armStrength: 0.5, throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 },
    transferParameters: { minimumTransferDelayTicks: 100, maximumTransferDelayTicks: 300, fixedGripOffsetTicks: 10 },
    throwCalibration: { minimumReleaseSpeedMps: 10, maximumReleaseSpeedMps: 30, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 1 } };
  const fielding = existingModel ?? x.f.track(openSqlitePlayerFieldingModelStore(x.f.path, { readAcceptedModel: () => configureFielding?.(fieldingSource) ?? fieldingSource })).accept(fieldingSource.sourceId);
  const calibration = playerObservationCalibrationFixture();
  const defaultModel: AcceptedPlayerObservationModel = { sourceId: `actual-observation-model-${playerId}`, sourceVersion: 'synthetic-v1',
    careerId: actor.binding.careerId, playerId, personLinkSourceId: actor.binding.personLinkSourceId,
    fieldingModelSourceId: fielding.source.sourceId, acceptedAtDay: actor.binding.gameDay,
    calibration: { ...calibration, geometryParameters: { ...calibration.geometryParameters,
      fullQualityHalfAngleRadians: Math.PI - 0.01, maxVisibleHalfAngleRadians: Math.PI },
    memoryDecayParameters: { ...calibration.memoryDecayParameters,
      ticksPerSecond: world.flight.source.execution.ballFlightParameters.ticksPerSecond } } };
  const modelSource = configure?.(defaultModel) ?? defaultModel;
  const models = x.f.track(openSqlitePlayerObservationModelStore(x.f.path, { readAcceptedModel: (id) => id === modelSource.sourceId ? modelSource : null }));
  const observationModel = models.accept(modelSource.sourceId);
  const observationSource: AcceptedActualFieldObservation = { sourceId: `actual-observation-${playerId}-1`, sourceVersion: 'synthetic-v1',
    physicalPitchSourceId: world.flight.source.physicalPitchSourceId, playerId, baseFieldSourceId: x.baseField.source.sourceId,
    executionSourceId, observationModelSourceId: modelSource.sourceId, previousObservationSourceId: null,
    view: { poseVersion: 'synthetic-body-translation-world-axes-v1', bodyRelativeEyeOffset: { x: 0, y: 3, z: 0 },
      forward: { x: 0, y: 0, z: 1 }, attentionTarget: { kind: 'ball' } } };
  const observationSources = new Map([[observationSource.sourceId, observationSource]]);
  const observationAuthority = { readAcceptedObservation: (id: string) => observationSources.get(id) ?? null };
  const observations = x.f.track(openSqliteActualFieldObservationStore(x.f.path, observationAuthority));
  return { observationModel, observationSource, observationSources, observationAuthority, observations };
};
export const actualFieldObservationFixture = (path?: string) => {
  const x = battedWorldFieldThrowFixture(path, 1000);
  return { ...x, ...installSyntheticObservation(x, x.actor.binding.playerId, x.acquired.source.sourceId, x.model) };
};
