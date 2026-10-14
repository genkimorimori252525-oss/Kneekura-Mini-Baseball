import { expect, it } from 'vitest';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battingPerceptionSourceInput } from './NativeBattingPerception';
import { battingExecutionInputSource } from './NativeBattingExecutionInput';
import { currentBattingScoreAssessmentInput } from './NativeBattingCurrentScoreAssessment';
const ref = (owner: string, sourceId = owner) => ({ owner, sourceId, sourceHash: hash(['source', sourceId]), snapshotHash: hash(['result', sourceId]) });
const member = { playerId: 'fixture-batter', bindingHash: hash('binding'), personHash: hash('person'), baselineSourceId: 'baseline', reservedRevision: 0,
  reservedStateHash: hash('reserved'), projectedStateHash: hash('projected') };
const base = { sourceId: 'fixture', sourceVersion: 'shape-only-v1', member, viewReference: ref('pa_continuation_v1_execution_views') };
// These shape-only references confer no Native ownership or model qualification.
it('BS01 capture and delayed delivery remain separate exact Source arms, with no returned-value input', () => {
  const capture = { ...base, capability: 'owned_batting_observation_v1', postureReference: ref('batting_observation_v1_postures'), physicalPitchReference: ref('pa_dispatch_v1_pitch_actions'),
    calibrationReference: ref('pa_continuation_v1_execution_calibrations'), observedTick: 100, deliveryCutTick: 100, previousObservationReference: null };
  expect(battingPerceptionSourceInput('observation', capture)).toEqual(capture);
  const delivery = { ...base, capability: 'owned_batting_observation_delivery_v1', observationReference: ref('batting_observation_v1_observations'),
    completionReference: ref('pa_take_successor_v1_action_plans'), postureReference: ref('batting_observation_v1_postures'), calibrationReference: ref('pa_continuation_v1_execution_calibrations') };
  expect(battingPerceptionSourceInput('delivery', delivery)).toEqual(delivery);
  for (const changed of [{ ...delivery, result: {} }, { ...delivery, postureReference: null }, { ...delivery, completionReference: ref('world_control_heads') }]) expect(() => battingPerceptionSourceInput('delivery', changed)).toThrow();
});
it('BS02 explicit current assessment rejects old empty-view labels and unavailable primitive scores', () => {
  const source = { ...base, capability: 'owned_batting_current_score_assessment_v1', predictionReference: ref('batting_prediction_v1_predictions'), modelReference: ref('world_player_batting_models'),
    observationCutReference: ref('batting_observation_v1_observations'), score: 0.5, provenance: { assessmentSourceId: 'explicit-assessment', assessmentVersion: 'fixture-v1', calibrationSourceId: 'fixture-model', calibrationVersion: 'fixture-v1' } };
  expect(currentBattingScoreAssessmentInput(source)).toEqual(source);
  for (const changed of [{ ...source, score: undefined }, { ...source, score: 1.1 }, { ...source, viewReference: ref('reserved_pa_execution_views') }, { ...source, derivedPrediction: {} }]) expect(() => currentBattingScoreAssessmentInput(changed)).toThrow();
});
it('BS03 original execution input requires all three distinct ordered calibrations and non-TAKE intent', () => {
  const source = { ...base, capability: 'owned_same_pa_batting_execution_input_v1', postureReference: ref('batting_observation_v1_postures'), emotionReference: ref('batting_emotion_execution_v1_executions'),
    intentReference: null, assessmentReferences: [], calibrationReferences: ['batter_decision', 'batter_motor', 'batter_swing'].map(route => ({ route, calibrationReference: ref('pa_continuation_v1_execution_calibrations', route) })),
    directive: 'TAKE', expectedWorld: { careerId: 'fixture-career', worldRevision: 1, controlRevision: 0, controlHash: hash('control') } };
  expect(battingExecutionInputSource(source)).toEqual(source);
  for (const changed of [{ ...source, directive: 'SWING' }, { ...source, calibrationReferences: source.calibrationReferences.slice(0, 2) },
    { ...source, calibrationReferences: [...source.calibrationReferences].reverse() }, { ...source, nominalRequest: {} }]) expect(() => battingExecutionInputSource(changed)).toThrow();
});
