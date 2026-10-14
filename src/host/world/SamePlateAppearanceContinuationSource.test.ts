import { expect, it } from 'vitest';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaContinuationSourceInput } from './SamePlateAppearanceContinuation';
import { samePaContinuationCalibrationInput } from './SamePlateAppearanceContinuationCalibrationSource';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
const ref = (owner: string, sourceId: string) => ({ owner, sourceId, sourceHash: hash('source:' + sourceId), snapshotHash: hash('result:' + sourceId) });
const enrollmentReference = ref('same_pa_enrollments', 'enrollment');
const prefix = () => ({ sourceId: 'nonempty-prefix', sourceVersion: 'fixture-only-v1', capability: 'same_pa_completed_take_prefix_v1', enrollmentReference,
  originalViewReference: ref('reserved_pa_execution_views', 'empty-view'), pitchReference: ref('pa_dispatch_v1_pitch_actions', 'pitch'), operationReferences: [] });
const participantReference = { playerId: 'batter', bindingHash: hash('binding'), personHash: hash('person'), baselineSourceId: 'baseline', revision: 1, stateHash: hash('state') };
const provenance = { assessmentSourceId: 'explicit-assessment', assessmentVersion: 'fixture-only-v1', calibrationSourceId: 'explicit-calibration', calibrationVersion: 'fixture-only-v1' };
it('NV01 explicit completed TAKE prefix never accepts a supplied physical horizon timeline or replacement actor', () => {
  expect(samePaContinuationSourceInput(prefix())).toEqual(prefix());
  for (const extra of [{ throughTick: 100 }, { timeline: {} }, { actor: {} }, { beforeWorld: {} }]) expect(() => samePaContinuationSourceInput({ ...prefix(), ...extra })).toThrow();
  expect(() => samePaContinuationSourceInput({ ...prefix(), pitchReference: ref('physical_pitch_progress_actions', 'pitch') })).toThrow();
});
it('NV02 actual invocation ledger admits only distinct explicit versioned operation owners', () => {
  const observation = ref('batting_observation_v1_observations', 'observation');
  expect(samePaContinuationSourceInput({ ...prefix(), operationReferences: [observation] })).toBeDefined();
  expect(() => samePaContinuationSourceInput({ ...prefix(), operationReferences: [observation, observation] })).toThrow();
  for (const owner of ['batting_observation_v1_postures', 'batting_score_v1_assessments', 'batting_emotion_v1_geneses', 'batting_execution_v1_intents', 'batting_execution_v1_inputs', 'actual_locomotion_receipts']) {
    expect(() => samePaContinuationSourceInput({ ...prefix(), operationReferences: [ref(owner, 'input')] })).toThrow();
  }
});
it('NV03 nonempty TOTAL requires an explicit finite cumulative value and its original participant/provenance', () => {
  const source = { sourceId: 'total', sourceVersion: 'fixture-only-v1', capability: 'same_pa_nonempty_cumulative_total_v1', enrollmentReference,
    prefixReference: ref('pa_continuation_v1_work_prefixes', 'prefix'), participantReference, effortUnits: 2, provenance };
  expect(samePaContinuationSourceInput(source)).toEqual(source);
  for (const effortUnits of [undefined, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => samePaContinuationSourceInput({ ...source, effortUnits })).toThrow();
  expect(() => samePaContinuationSourceInput({ ...source, prefixReference: ref('reserved_pa_work_prefixes', 'empty') })).toThrow();
  expect(() => samePaContinuationSourceInput({ ...source, provenance: { ...provenance, assessmentSourceId: '' } })).toThrow();
});
it('NV04 nonempty view requires exactly ten distinct accepted TOTAL owner refs', () => {
  const refs = Array.from({ length: 10 }, (_, i) => ({ playerId: 'player-' + i, assessmentReference: ref('pa_continuation_v1_total_assessments', 'total-' + i) }));
  const source = { sourceId: 'view', sourceVersion: 'fixture-only-v1', capability: 'same_pa_nonempty_cumulative_view_v1', enrollmentReference,
    prefixReference: ref('pa_continuation_v1_work_prefixes', 'prefix'), participantTotalReferences: refs };
  expect(samePaContinuationSourceInput(source)).toEqual(source);
  expect(() => samePaContinuationSourceInput({ ...source, participantTotalReferences: refs.slice(1) })).toThrow();
  expect(() => samePaContinuationSourceInput({ ...source, participantTotalReferences: [...refs.slice(1), refs[1]] })).toThrow();
  expect(() => samePaContinuationSourceInput({ ...source, participantTotalReferences: refs.map(r => ({ ...r, assessmentReference: refs[0].assessmentReference })) })).toThrow();
});
it('NV05 new accepted response requires a new-view member and retains the exact nominal parameter owner', () => {
  const { revision, stateHash, ...identity } = participantReference;
  const source = { sourceId: 'calibration', sourceVersion: 'fixture-only-v1', capability: 'same_pa_nonempty_execution_calibration_v1', enrollmentReference,
    viewReference: ref('pa_continuation_v1_execution_views', 'view'), firstPhysicalPitchSourceId: 'pitch', member: { ...identity, reservedRevision: revision,
      reservedStateHash: stateHash, projectedStateHash: hash('projected') }, route: 'batter_observation', nominalReference: ref('world_player_batting_models', 'model'),
    nominalParameterReference: { parameterKey: 'observationCalibration', sourceId: 'observation-parameter', sourceVersion: 'fixture-only-v1', sourceHash: hash('parameter') },
    acceptedAtDay: 1, provenance, response: { kind: 'accepted_execution_values_v1', values: dispatchCalibrationValues().batter_observation } };
  expect(samePaContinuationCalibrationInput(source)).toEqual(source);
  expect(() => samePaContinuationCalibrationInput({ ...source, viewReference: ref('reserved_pa_execution_views', 'view') })).toThrow();
  expect(() => samePaContinuationCalibrationInput({ ...source, nominalParameterReference: null })).toThrow();
  expect(() => samePaContinuationCalibrationInput({ ...source, response: { ...source.response, values: {} } })).toThrow();
});
