import { expect, it } from 'vitest';
import { practiceFixture } from './PitchPracticeAttempt.test-support';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqlitePlayerBodyCapabilityMaterializationStore } from './SqlitePlayerBodyCapabilityMaterializationStore';
import { openSqlitePlayerBattingModelStore } from './SqlitePlayerBattingModelStore';
import { openSqliteDevelopmentPracticeExposureStore, type AcceptedDevelopmentPracticeExposure } from './SqliteDevelopmentPracticeExposureStore';
import type { SqlitePitchPracticeAttemptStore } from './SqlitePitchPracticeAttemptStore';
import type { AcceptedBodySource, AcceptedPoseSource, AcceptedReachSource, BodyMaterializationRequest, BodySourceRef } from './PlayerBodyCapabilityMaterialization';
import type { AcceptedPlayerBattingModelV1, BattingModelParameters } from './PlayerBattingModel';
import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { REALISTIC_BASEBALL_RIGID_BODY } from '../../core/sim/contact/RigidBatBallContact';

const ref = (source: BodySourceRef): BodySourceRef => ({ sourceId: source.sourceId, sourceVersion: source.sourceVersion });

it('accepts a dated batting capability from genuine owned pitch exposure, preserving original bytes through rollback and offline retry', async () => {
  const cleanup: (() => void)[] = [];
  try {
    const f = await practiceFixture(cleanup);
    const person = f.sources.personLinks.readLink('intake-p1')!;
    const scope = { careerId: person.careerId, playerId: person.playerId, personId: person.personId, personLinkSourceId: person.sourceId };
    const common = { ...scope, acceptedAtDay: 12, sourceVersion: 'explicit-test-v1' };
    // Independently accepted test measurements for this practice Player. No
    // body/model receipt or saved database row is copied from another fixture.
    const body: AcceptedBodySource = { ...common, sourceId: 'practice-batter-body', physicalProfile: { heightMeters: 1.8 } };
    const pose: AcceptedPoseSource = { ...common, sourceId: 'practice-batter-pose', bodyRef: ref(body), primitives: [
      { role: 'body', radius: 0.2, offset: { x: 0, y: 0, z: 0 } },
      { role: 'glove', radius: 0.08, offset: { x: 0.3, y: 0.15, z: 0.1 } },
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
    const pitchIds: string[] = []; let previous = f.complete();
    for (let index = 0; index < 3; index++) {
      if (index) previous = f.complete(f.nextOpportunity(previous).sourceId);
      f.assess(previous);
      const settled = f.owner.settle(previous.attemptId);
      expect(settled.kind).toBe('complete');
      if (settled.kind !== 'complete') throw new Error('genuine practice pitch was not consumed');
      pitchIds.push(settled.activity.sourceEventId);
    }
    for (const [sourceId, kind, atDay] of [['feedback', 'FEEDBACK_RECORDED', 15], ['consolidation', 'CONSOLIDATION_RECORDED', 16]] as const) {
      f.learningEvents.set(sourceId, { eventId: sourceId, sourceEventId: sourceId, kind, atDay, domain: 'TECHNICAL' });
      f.sources.episodes.advance('episode', sourceId, f.sources.episodes.read('episode')!.episode.revision);
    }
    const accepted: AcceptedDevelopmentPracticeExposure = { sourceId: 'practice-batting-exposure', sourceVersion: 'explicit-test-v1',
      episodeId: 'episode', episodeRevision: f.sources.episodes.read('episode')!.episode.revision,
      policy: { policyId: 'explicit-exposure', version: 'v1', availableAtDay: 10, selfDirectedShare: 0.5,
        minimumEffectiveExposure: 0.1, minimumDistinctPracticeDays: 1 },
      prior: { careerId: scope.careerId, playerId: scope.playerId, atDay: 11, domain: 'TECHNICAL', receptivity: 1,
        profileVersion: 'v1', policyId: 'explicit-prior', policyVersion: 'v1' },
      pitchFactors: pitchIds.map(sourceEventId => ({ sourceEventId, trainingStimulus: 1, coachingFit: 1,
        challengeFit: 1, motivation: 1, opportunity: 1, novelty: 1 })),
      provenance: { assessmentSourceId: 'explicit-exposure-assessment', assessmentVersion: 'v1',
        calibrationSourceId: 'explicit-exposure-calibration', calibrationVersion: 'v1' } };
    const exposures = openSqliteDevelopmentPracticeExposureStore(f.path, { development: f.sources.episodes,
      pitchPractice: f.owner as unknown as SqlitePitchPracticeAttemptStore }, { readAcceptedExposure: id => id === accepted.sourceId ? accepted : null });
    cleanup.push(exposures.close);
    const exposure = exposures.accept(accepted.sourceId);
    expect(exposure.assessment.eligible).toBe(true);
    expect(exposure.bundle.repetitions.map(value => value.sourceEventId)).toEqual(pitchIds);
    const capability = { ...parameters.capability, sourceId: 'explicit-practice-batting-reassessment', acceptedAtDay: 16,
      values: { ...parameters.capability.values, technicalTimingOffsetTicks: 3_000 } };
    const developed: AcceptedPlayerBattingModelV1 = { ...originalSource, sourceId: 'practice-batting-developed', acceptedAtDay: 16,
      capabilityRef: ref(capability), developmentProvenance: { kind: 'accepted_batting_capability_development_v1',
        originalModelRef: ref(original.source), originalModelSourceHash: hash(original.source), originalModelSnapshotHash: hash(original),
        exposureRef: ref(exposure.source), exposureSourceHash: hash(exposure.source), exposureSnapshotHash: hash(exposure),
        assessmentRef: { sourceId: 'explicit-batting-reassessment', sourceVersion: 'v1' },
        calibrationRef: { sourceId: 'explicit-batting-calibration', sourceVersion: 'v1' }, replacementCapabilityHash: hash(capability) } };
    sources.set(developed.sourceId, developed); capabilities.set(capability.sourceId, capability);
    const evidenceTables = ['world_player_person_links', 'world_roster_heads', 'world_player_body_materializations',
      'pitch_practice_attempts', 'world_player_workload_activities', 'world_development_initiations',
      'world_development_learning_events', 'development_practice_exposures'];
    const evidenceBytes = () => evidenceTables.map(table => f.snapshot(table));
    const before = evidenceBytes(), modelBytes = f.snapshot('world_player_batting_models');
    f.db.exec(`CREATE TRIGGER corrupt_batting_development_proof AFTER INSERT ON world_player_batting_models
      WHEN NEW.source_id='practice-batting-developed'
      BEGIN UPDATE pitch_practice_attempts SET immutable_hash='corrupt-original-proof' WHERE sequence=1; END`);
    expect(() => models.accept(developed.sourceId)).toThrow();
    expect(f.snapshot('world_player_batting_models')).toBe(modelBytes);
    expect(evidenceBytes()).toEqual(before);
    f.db.exec('DROP TRIGGER corrupt_batting_development_proof');
    const saved = models.accept(developed.sourceId);
    expect(saved.capability).toEqual(capability);
    expect(saved.bodyMaterialization).toEqual(materialization.value);
    expect(saved.person).toEqual(person);
    expect(models.accept(developed.sourceId)).toEqual(saved);
    expect(models.read(original.source.sourceId)).toEqual(original);
    expect(models.selectAtDay(scope.careerId, scope.playerId, 12)).toEqual(original);
    expect(models.selectAtDay(scope.careerId, scope.playerId, 16)).toEqual(saved);
    expect(evidenceBytes()).toEqual(before);
    const acceptedBytes = f.snapshot('world_player_batting_models');
    models.close(); bodies.close(); exposures.close(); f.reopen();
    const reopened = openSqlitePlayerBattingModelStore(f.path); cleanup.push(reopened.close);
    expect(reopened.read(developed.sourceId)).toEqual(saved);
    expect(reopened.accept(developed.sourceId)).toEqual(saved);
    expect(reopened.read(original.source.sourceId)).toEqual(original);
    expect(f.snapshot('world_player_batting_models')).toBe(acceptedBytes);
    expect(evidenceBytes()).toEqual(before);
    expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name IN ('matches','official_fixtures')").all()).toEqual([]);
    expect(json(saved.source.developmentProvenance)).toBe(json(developed.developmentProvenance));
  } finally { while (cleanup.length) cleanup.pop()!(); }
});
