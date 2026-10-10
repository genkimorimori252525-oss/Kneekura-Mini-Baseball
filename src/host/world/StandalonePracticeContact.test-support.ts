import { expect } from 'vitest';
import { practiceFixture } from './PitchPracticeAttempt.test-support';
import { openSqlitePlayerBodyCapabilityMaterializationStore } from './SqlitePlayerBodyCapabilityMaterializationStore';
import { openSqlitePlayerBattingModelStore } from './SqlitePlayerBattingModelStore';
import type { AcceptedBodySource, AcceptedPoseSource, AcceptedReachSource, BodyMaterializationRequest, BodySourceRef } from './PlayerBodyCapabilityMaterialization';
import type { AcceptedPlayerBattingModelV1, BattingModelParameters } from './PlayerBattingModel';
import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { REALISTIC_BASEBALL_RIGID_BODY } from '../../core/sim/contact/RigidBatBallContact';

import { openSqlitePlayerFieldingModelStore } from './SqlitePlayerFieldingModelStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqlitePlayerPitchTimingStore } from './SqlitePlayerPitchTimingStore';
import { openSqlitePlayerReleaseGeometryStore } from './SqlitePlayerReleaseGeometryStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';

const ref = (source: BodySourceRef): BodySourceRef => ({ sourceId: source.sourceId, sourceVersion: source.sourceVersion });
export const contactFixture = async (cleanup: (() => void)[]) => {
  const f = await practiceFixture(cleanup, { additionalPlayerIds: ['feeder'] });
  const person = f.sources.personLinks.readLink('intake-p1')!;
  const scope = { careerId: person.careerId, playerId: person.playerId, personId: person.personId, personLinkSourceId: person.sourceId };
  const common = { ...scope, acceptedAtDay: 12, sourceVersion: 'explicit-test-v1' };
  // Independently accepted test measurements for this practice Player. No
  // body/model receipt or saved database row is copied from another fixture.
  const body: AcceptedBodySource = { ...common, sourceId: 'practice-batter-body', physicalProfile: { heightMeters: 1.8 } };
  const pose: AcceptedPoseSource = { ...common, sourceId: 'practice-batter-pose', bodyRef: ref(body), primitives: [
    { role: 'body', radius: 0.2, offset: { x: 0, y: 0, z: 0 } },
    { role: 'glove', radius: 0.08, offset: { x: 0, y: 0.15, z: 1 } },
    { role: 'tag_hand', radius: 0.06, offset: { x: -0.3, y: 0.1, z: 0 } },
    { role: 'left_foot', radius: 0.07, offset: { x: -0.1, y: -0.88, z: 0 } },
    { role: 'right_foot', radius: 0.07, offset: { x: 0.1, y: -0.88, z: 0 } },
  ] };
  const reach: AcceptedReachSource = { sourceId: 'practice-batter-reach', sourceVersion: common.sourceVersion, acceptedAtDay: 12,
    baseline: { bodyOriginHeightMeters: 0.95, maximumLegReachMeters: 1.5, maximumGloveReachMeters: 1.3, maximumTagReachMeters: 1.1 } };
  const request: BodyMaterializationRequest = { ...scope, sourceId: 'practice-batter-materialization', sourceVersion: common.sourceVersion,
    atDay: 12, role: 'batter', bodyRef: ref(body), poseRef: ref(pose), reachCalibrationRef: ref(reach), fieldingModelRef: null, releaseGeometryRef: null };
  const bodies = openSqlitePlayerBodyCapabilityMaterializationStore(f.path, {
    readAcceptedMaterialization: id => id === request.sourceId ? request : null,
    readAcceptedBody: id => id === body.sourceId ? body : null,
    readAcceptedPose: id => id === pose.sourceId ? pose : null,
    readAcceptedReachCalibration: id => id === reach.sourceId ? reach : null,
  }); cleanup.push(bodies.close);
  const materialization = bodies.accept(request.sourceId);
  expect(materialization.kind).toBe('materialized');
  if (materialization.kind !== 'materialized') throw new Error('practice Player own batter body is unavailable');
  expect(materialization.value.person).toEqual(person);
  const calibration = playerObservationCalibrationFixture();
  // Same explicit test calibration values as the existing batting model
  // fixture; there is no formula relating pitch repetitions to these values.
  const parameters: BattingModelParameters = {
    capability: { ...common, sourceId: 'practice-batting-capability', values: {
    motorLatencyTicks: 20_000, technicalTimingOffsetTicks: 0, maximumSweetSpotSpeedMps: 50 } },
    repertoire: { ...common, sourceId: 'practice-batting-repertoire', values: {
    repertoireId: 'explicit-test-repertoire', repertoireVersion: 'v1', profiles: [{ minimumAggression: 0, profile: {
      profileId: 'explicit-test-course', version: 'v1', batLengthM: 0.84, sweetSpotT: 0.72,
      centerContactDepthM: 20.1 * 0.0254, contactDepthPopulationStdDevM: 7.2 * 0.0254,
      insideOutsideDepthGainM: 0.075, heightDepthGainM: 0.035, baseContactSweetSpotSpeedMps: 31,
      contactDepthSpeedGainMpsPerM: 4, basePreContactSeconds: 0.165, insideOutsideTimingGainSeconds: 0.01,
      heightTimingGainSeconds: 0.004, followThroughSeconds: 0.135, highAttackAngleDeg: 7,
      middleAttackAngleDeg: 9, lowAttackAngleDeg: 16, courseAttackDirectionGainDeg: 6, nominalContactSurfaceDistanceM: 0.0696,
    } }] } },
    decisionModel: { ...common, sourceId: 'practice-batting-decision', values: {
    modelId: 'explicit-test-decision', version: 'v1', threshold: 0.5, aggressionWeight: 0.5 } },
    equipment: { ...common, sourceId: 'practice-batting-equipment', values: { batPhysical: {
    massKg: 0.9, centerOfMassT: 0.58, transverseMomentOfInertiaKgM2: 0.055, axialMomentOfInertiaKgM2: 0.0005,
    radiusProfile: { knots: [{ t: 0, radiusM: 0.025 }, { t: 0.55, radiusM: 0.031 }, { t: 1, radiusM: 0.033 }] },
    }, ball: REALISTIC_BASEBALL_RIGID_BODY } },
    observationCalibration: { ...common, sourceId: 'practice-batting-observation', values: { calibration: {
    ...calibration, memoryDecayParameters: { ...calibration.memoryDecayParameters, ticksPerSecond: 1_000_000 },
    }, deliveryLatencyTicks: 10_000 } },
    predictionCalibration: { ...common, sourceId: 'practice-batting-prediction', values: {
    algorithm: 'observed_motion_with_pinned_aerodynamic_priors_v1', horizonTicks: 800_000,
    observerKnownSpinPrior: { x: 0, y: 0, z: 0 }, parameters: { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000,
      gravityY: -9.81, aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS } } },
  };
  const originalSource: AcceptedPlayerBattingModelV1 = { ...common, sourceId: 'practice-batting-original',
    bodyMaterializationRef: ref(materialization.value.source), bodyRef: ref(body), poseRef: ref(pose),
    capabilityRef: ref(parameters.capability), repertoireRef: ref(parameters.repertoire), decisionModelRef: ref(parameters.decisionModel),
    equipmentRef: ref(parameters.equipment), observationCalibrationRef: ref(parameters.observationCalibration),
    predictionCalibrationRef: ref(parameters.predictionCalibration) };
  const sources = new Map([[originalSource.sourceId, originalSource]]);
  const capabilities = new Map([[parameters.capability.sourceId, parameters.capability]]);
  const models = openSqlitePlayerBattingModelStore(f.path, {
    readAcceptedModel: id => sources.get(id) ?? null, readAcceptedCapability: id => capabilities.get(id) ?? null,
    readAcceptedRepertoire: id => id === parameters.repertoire.sourceId ? parameters.repertoire : null,
    readAcceptedDecisionModel: id => id === parameters.decisionModel.sourceId ? parameters.decisionModel : null,
    readAcceptedEquipment: id => id === parameters.equipment.sourceId ? parameters.equipment : null,
    readAcceptedObservationCalibration: id => id === parameters.observationCalibration.sourceId ? parameters.observationCalibration : null,
    readAcceptedPredictionCalibration: id => id === parameters.predictionCalibration.sourceId ? parameters.predictionCalibration : null,
  }); cleanup.push(models.close);
  const original = models.accept(originalSource.sourceId);

  const fielding = openSqlitePlayerFieldingModelStore(f.path, { readAcceptedModel: sourceId => sourceId === 'receiver-fielding' ? {
    careerId: common.careerId, playerId: common.playerId, personLinkSourceId: common.personLinkSourceId,
    acceptedAtDay: common.acceptedAtDay, sourceVersion: common.sourceVersion, sourceId, ratings: { positionSuitability: { P: 0.5, C: 0.5, '1B': 0.5, '2B': 0.5, '3B': 0.5, SS: 0.5, LF: 0.5, CF: 0.5, RF: 0.5 },
      firstStep: 0.5, acceleration: 0.5, battedBallRead: 0.5, routeEfficiency: 0.5, catching: 0.5, transfer: 0.5, armStrength: 0.5,
      throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 },
    transferParameters: { minimumTransferDelayTicks: 10000, maximumTransferDelayTicks: 20000, fixedGripOffsetTicks: 0 },
    throwCalibration: { minimumReleaseSpeedMps: 20, maximumReleaseSpeedMps: 35, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 1 },
  } : null }); cleanup.push(fielding.close);
  const fieldingModel = fielding.accept('receiver-fielding');
  const defenderRequest: BodyMaterializationRequest = { ...request, sourceId: 'receiver-body', role: 'defender', fieldingModelRef: ref(fieldingModel.source) };
  const defenders = openSqlitePlayerBodyCapabilityMaterializationStore(f.path, {
    readAcceptedMaterialization: sourceId => sourceId === defenderRequest.sourceId ? defenderRequest : null,
    readAcceptedBody: sourceId => sourceId === body.sourceId ? body : null,
    readAcceptedPose: sourceId => sourceId === pose.sourceId ? pose : null,
    readAcceptedReachCalibration: sourceId => sourceId === reach.sourceId ? reach : null,
  }); cleanup.push(defenders.close); expect(defenders.accept(defenderRequest.sourceId).kind).toBe('materialized');
  const intake = { sourceId: 'intake-feeder', sourceVersion: 'test-v1', careerId: 'career-a', playerId: 'feeder', personId: 'person-feeder',
    sourceRecordId: 'independent-feeder-intake', acceptedRevision: 0, acceptedAtDay: 11, rosterRevision: 1 };
  const links = openSqlitePlayerPersonLinkStore(f.path, { readAcceptedPlayerIntake: sourceId => sourceId === intake.sourceId ? intake : null });
  cleanup.push(links.close); links.accept(intake.sourceId); f.sources.person.materialize(intake.sourceId);
  const feederScope = { playerId: intake.playerId, personLinkSourceId: intake.sourceId };
  const timing = openSqlitePlayerPitchTimingStore(f.path, links, { readAcceptedBaseline: sourceId => sourceId === 'feeder-timing'
    ? { ...f.timingInput, ...feederScope, sourceId, acceptedAtDay: 12 } : null, readAcceptedLearning: () => null }); cleanup.push(timing.close); timing.initialize('feeder-timing');
  const release = openSqlitePlayerReleaseGeometryStore(f.path, links, { readAcceptedBaseline: sourceId => sourceId === 'feeder-release'
    ? { ...f.releaseInput, ...feederScope, sourceId, acceptedAtDay: 12 } : null, readAcceptedChange: () => null }); cleanup.push(release.close); release.initialize('feeder-release');
  const workload = openSqlitePlayerWorkloadRecoveryStore(f.path, links, { readAcceptedBaseline: sourceId => sourceId === 'feeder-workload' ? {
    ...feederScope, sourceId, sourceVersion: 'test-v1', careerId: 'career-a', createdAtDay: 12, fatigue: 0.2, recoveryCapacity: 0.5,
    policy: { policyId: 'explicit-feeder-workload', version: 'v1', availableAtDay: 10, workloadFatiguePerUnit: 0.1, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 },
  } : null, readAcceptedActivity: () => null }); cleanup.push(workload.close); workload.initialize('feeder-workload');
  f.opportunities.set('feeder-pitch', { ...f.opportunity, ...feederScope, sourceId: 'feeder-pitch', opportunityId: 'feeder-session', episode: null });
  const pitch = f.owner.begin('feeder-pitch');
  return { ...f, pitch, batting: original, defenderRequest, fieldingModel };
};
