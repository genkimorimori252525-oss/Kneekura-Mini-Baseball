import { expect, it } from 'vitest';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battingPerceptionSourceInput } from './NativeBattingPerception';
import { battingExecutionInputSource } from './NativeBattingExecutionInput';
import { battingEmotionExecutionInput } from './NativeBattingEmotionExecution';
import { request } from '../../core/world/psychology/execution/ExecutionFixtures.test-support';
const ref = (owner: string, sourceId = owner) => ({ owner, sourceId, sourceHash: hash(['source', sourceId]), snapshotHash: hash(['result', sourceId]) });
const member = { playerId: 'fixture-batter', bindingHash: hash('binding'), personHash: hash('person'), baselineSourceId: 'baseline', reservedRevision: 0,
  reservedStateHash: hash('reserved'), projectedStateHash: hash('projected') };
const base = { sourceId: 'fixture-in-flight', sourceVersion: 'shape-only-v1', member, viewReference: ref('pa_lifecycle_v1_execution_views') };
const provenance = { assessmentSourceId: 'explicit-assessment', assessmentVersion: 'fixture-v1', calibrationSourceId: 'fixture-model', calibrationVersion: 'fixture-v1' };
it('IFB01 in-flight capture and delivery pin owned physical cuts without caller time advancement', () => {
  const capture = { ...base, capability: 'owned_in_flight_batting_observation_v1', postureReference: ref('batting_observation_v1_postures'),
    physicalPitchReference: ref('pa_physical_v1_launches'), physicalOperationReference: ref('pa_physical_v1_cuts'),
    calibrationReference: ref('pa_lifecycle_v1_execution_calibrations'), observedTick: 100, previousObservationReference: null };
  expect(battingPerceptionSourceInput('observation', capture)).toEqual(capture);
  const delivery = { ...base, capability: 'owned_in_flight_batting_observation_delivery_v1', observationReference: ref('batting_observation_v1_observations'),
    physicalPitchReference: ref('pa_physical_v1_launches'), physicalOperationReference: ref('pa_physical_v1_cuts', 'later-cut'),
    calibrationReference: ref('pa_lifecycle_v1_execution_calibrations') };
  expect(battingPerceptionSourceInput('delivery', delivery)).toEqual(delivery);
  for (const s of [{ ...capture, deliveryCutTick: 200 }, { ...capture, physicalOperationReference: ref('pa_physical_v1_resolutions') },
    { ...delivery, throughTick: 200 }, { ...delivery, completionReference: ref('pa_take_successor_v1_action_plans') },
    { ...delivery, viewReference: ref('pa_continuation_v1_execution_views') }]) expect(() => battingPerceptionSourceInput(s.capability === capture.capability ? 'observation' : 'delivery', s)).toThrow();
});
it('IFB02 in-flight scores are explicitly accepted primitives with exact prediction and observation owners', () => {
  const source = { ...base, capability: 'owned_in_flight_batting_score_assessment_v1', predictionReference: ref('batting_prediction_v1_predictions'),
    modelReference: ref('world_player_batting_models'), observationCutReference: ref('batting_observation_v1_observations'), score: 0.7, provenance };
  expect(battingPerceptionSourceInput('assessment', source)).toEqual(source);
  for (const s of [{ ...source, score: undefined }, { ...source, score: NaN }, { ...source, derivedScore: 0.7 },
    { ...source, observationCutReference: ref('pa_physical_v1_cuts') }]) expect(() => battingPerceptionSourceInput('assessment', s)).toThrow();
});
it('IFB03 in-flight prepared input has per-pitch intent and calibrations but no separate invocation or cached calculation', () => {
  const intent = { ...base, capability: 'owned_in_flight_same_pa_batting_intent_v1', postureReference: ref('batting_observation_v1_postures'), actorReference: ref('physical_plate_appearance_actors'), attempt: 'ordinary_swing' };
  expect(battingExecutionInputSource(intent)).toEqual(intent);
  const source = { ...base, capability: 'owned_in_flight_same_pa_batting_execution_input_v1', postureReference: intent.postureReference,
    physicalPitchReference: ref('pa_physical_v1_launches'), physicalOperationReference: ref('pa_physical_v1_cuts'),
    emotionReference: ref('batting_emotion_execution_v1_executions'), intentReference: ref('batting_execution_v1_intents'), assessmentReferences: [],
    calibrationReferences: ['batter_decision', 'batter_motor', 'batter_swing'].map(route => ({ route, calibrationReference: ref('pa_lifecycle_v1_execution_calibrations', route) })),
    directive: 'SWING', expectedWorld: { careerId: 'fixture-career', worldRevision: 2, controlRevision: 0, controlHash: hash('control') } };
  expect(battingExecutionInputSource(source)).toEqual(source);
  for (const s of [{ ...source, intentReference: null }, { ...source, calculation: {} }, { ...source, capability: 'owned_same_pa_batting_calculation_v1' },
    { ...source, calibrationReferences: source.calibrationReferences.slice(1) }, { ...source, physicalPitchReference: ref('pa_dispatch_v1_pitch_actions') }]) expect(() => battingExecutionInputSource(s)).toThrow();
});
it('IFB04 explicit in-flight appraisal preserves actual World CAS and delivered sensory references', () => {
  const r = request(), { frame: _frame, ...baseline } = r.baseline;
  const source = { ...base, capability: 'owned_in_flight_batting_emotion_execution_v1', executionId: 'explicit-execution',
    observationReference: ref('batting_observation_v1_observations'), deliveryReference: ref('batting_observation_v1_deliveries'),
    genesisReference: ref('batting_emotion_v1_geneses'), previousExecutionReference: null,
    physicalPitchReference: ref('pa_physical_v1_launches'), physicalOperationReference: ref('pa_physical_v1_cuts'),
    expectedWorld: { careerId: 'fixture-career', worldRevision: 1, controlRevision: 0, controlHash: hash('control') },
    appraisalAssessment: r.appraisal, baseline, executionModel: r.model, provenance };
  expect(battingEmotionExecutionInput(source)).toEqual(source);
  for (const s of [{ ...source, deliveryReference: null }, { ...source, appraisalAssessment: null }, { ...source, expectedWorld: {} },
    { ...source, acceptance: {} }, { ...source, physicalOperationReference: ref('pa_take_successor_v1_action_plans') }]) expect(() => battingEmotionExecutionInput(s)).toThrow();
});
it('IFB05 per-pitch posture is preparable before launch and keeps the exact original nine body bindings', () => {
  const source = { ...base, capability: 'owned_in_flight_batting_posture_v1', actionReference: ref('pa_physical_v1_action_plans'), modelReference: ref('world_player_batting_models'), provenance,
    geometry: { kind: 'stationary_pre_pitch_scene_v1', startedAtTick: 10, validUntilTick: 1000, ticksPerSecond: 1_000_000,
      handedness: 'R', centerOfMass: { x: -0.8, y: 1, z: 0 }, eyePosition: { x: -0.8, y: 1.5, z: 0 }, observerForward: { x: 0, y: 0, z: 1 },
      attention: { target: { kind: 'ball' }, focusedSinceTick: 10 }, bodyReadyTick: 10, latestMotorStartTick: 900, plateZ: 0,
      strikeZone: { centerX: 0, halfWidth: 0.2159, lowerY: 0.5, upperY: 1.1 } },
    sceneBodyReferences: Array.from({ length: 9 }, (_, i) => ({ playerId: 'defender-' + i, bodyReference: ref('world_player_body_materializations', 'body-' + i) })) };
  expect(battingPerceptionSourceInput('posture', source)).toEqual(source);
  expect(source).not.toHaveProperty('observationReference'); expect(source).not.toHaveProperty('physicalPitchReference');
  for (const changed of [{ ...source, actionReference: ref('pa_dispatch_v1_action_plans') }, { ...source, sceneBodyReferences: source.sceneBodyReferences.slice(1) },
    { ...source, physicalPitchReference: ref('pa_physical_v1_launches') }, { ...source, geometry: { ...source.geometry, startedAtTick: 11 } }]) expect(() => battingPerceptionSourceInput('posture', changed)).toThrow();
});
