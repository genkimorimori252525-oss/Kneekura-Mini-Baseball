import { expect, it } from 'vitest';
import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import { projectObservationClockV1 } from '../../core/sim/perception/ObservationClockProjectionV1';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaLifecycleCalibrationInput, SAME_PA_OBSERVATION_CLOCK_PROJECTION_VERSION as VERSION, type SamePaLifecycleCalibration } from './SamePlateAppearanceLifecycleCalibrationSource';
import { createSamePaObservationClockProjectionSourcesV212, type SamePaObservationClockProjectionContextV212 } from './SamePaObservationClockProjectionSourcesV212';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';

const pin = <O extends string>(owner: O, sourceId: string): SamePaReference<O> => ({ owner, sourceId, sourceHash: hash(sourceId), snapshotHash: hash('snapshot:' + sourceId) });
// Synthetic declarations exercise the pure producer, never a Native owner proof.
const fixture = () => {
  const enrollmentReference = pin('same_pa_enrollments', 'enrollment');
  const lineage = { enrollmentReference, actorReference: pin('physical_plate_appearance_actors', 'actor'), careerId: 'career', gameId: 'game',
    playId: 7, firstPhysicalPitchSourceId: 'first-pitch', participantReferences: [] };
  const originals: SamePaObservationClockProjectionContextV212['originals'][number][] = [];
  const sources = Array.from({ length: 9 }, (_, index) => {
    const playerId = 'defender-' + index, nominalReference = pin('world_player_observation_models', 'nominal-' + index);
    const nominalCalibration = playerObservationCalibrationFixture();
    const effective = { ...nominalCalibration, perceptionAbility: 0.7 };
    const source = samePaLifecycleCalibrationInput({ sourceId: 'old:' + playerId, sourceVersion: 'fixture-only-v1', capability: 'same_pa_lifecycle_execution_calibration_v1',
      enrollmentReference, viewReference: pin('pa_lifecycle_v1_execution_views', 'old-field-view'), firstPhysicalPitchSourceId: 'first-pitch',
      member: { playerId, bindingHash: hash('binding:' + playerId), personHash: hash('person:' + playerId), baselineSourceId: 'baseline:' + playerId,
        reservedRevision: 0, reservedStateHash: hash('reserved'), projectedStateHash: hash('projected') }, route: 'defender_observation', nominalReference,
      nominalParameterReference: null, acceptedAtDay: 40, provenance: { assessmentSourceId: 'assessment:' + playerId, assessmentVersion: 'fixture-v1', calibrationSourceId: 'original', calibrationVersion: 'fixture-v1' },
      response: { kind: 'accepted_execution_values_v1', values: effective } });
    const effectiveCalibration: SamePaLifecycleCalibration = { kind: 'same_pa_lifecycle_calibration', source, lineage, nominalInputHash: hash('nominal-input:' + index), effectiveResponseHash: hash(source.response) };
    originals.push({ nominalReference, nominalCalibration, effectiveCalibration });
    return { ...source, sourceId: 'new:' + playerId, viewReference: pin('pa_lifecycle_v1_execution_views', 'new-field-view'), member: { ...source.member, reservedRevision: 1 } };
  });
  const untouched = Array.from({ length: 23 }, (_, index) => ({ sourceId: 'untouched:' + index, route: 'batter_motor', marker: index }));
  const context = { fieldReference: pin('pa_physical_v1_field_steps', 'new-field-step'), targetTicksPerSecond: 1_000_000, originals };
  return { sources: [...sources, ...untouched], context, untouched };
};

it('OCS212-01 declares nine exact clock conversions, preserves other Sources and mutates no input', () => {
  const f = fixture(), before = JSON.stringify(f), result = createSamePaObservationClockProjectionSourcesV212(f.sources, f.context);
  expect(result).toHaveLength(32); expect(JSON.stringify(f)).toBe(before);
  for (let index = 0; index < 9; index++) {
    const source = samePaLifecycleCalibrationInput(result[index]), original = f.context.originals[index];
    if (source.route !== 'defender_observation' || original.effectiveCalibration.source.route !== 'defender_observation') throw Error('fixture observation route missing');
    expect(source.sourceVersion).toBe(VERSION);
    expect(source.response.values).toEqual(projectObservationClockV1(original.effectiveCalibration.source.response.values, 1_000_000));
    expect(source.response.values.perceptionAbility).toBe(0.7);
    expect(source.response.values.errorParameters).toEqual(original.effectiveCalibration.source.response.values.errorParameters);
    expect(source.response.values.geometryParameters).toEqual(original.effectiveCalibration.source.response.values.geometryParameters);
    expect(source.observationClockProjection).toEqual({ kind: 'observation_clock_projection_v1', originalNominalReference: original.nominalReference,
      originalEffectiveCalibrationReference: reference('pa_lifecycle_v1_execution_calibrations', original.effectiveCalibration), fieldReference: f.context.fieldReference });
    expect(source.provenance.calibrationSourceId).toBe(original.effectiveCalibration.source.sourceId); expect(source.provenance.calibrationVersion).toBe(VERSION);
  }
  f.untouched.forEach((source, index) => expect(result[index + 9]).toBe(source));
});

it('OCS212-02 rejects incomplete or duplicate defender membership and original Source identities', () => {
  const missing = fixture(); expect(() => createSamePaObservationClockProjectionSourcesV212(missing.sources.slice(1), missing.context)).toThrow();
  const originalMissing = fixture(); originalMissing.context.originals.pop(); expect(() => createSamePaObservationClockProjectionSourcesV212(originalMissing.sources, originalMissing.context)).toThrow();
  const duplicate = fixture(); duplicate.context.originals[1] = duplicate.context.originals[0]; expect(() => createSamePaObservationClockProjectionSourcesV212(duplicate.sources, duplicate.context)).toThrow();
  const duplicateNew = fixture(); duplicateNew.sources[1] = duplicateNew.sources[0]; expect(() => createSamePaObservationClockProjectionSourcesV212(duplicateNew.sources, duplicateNew.context)).toThrow();
});

it('OCS212-03 keeps exact integer rejection for mismatched clocks, fractional intervals and overflow', () => {
  for (const target of [0, 1.5, 999]) { const f = fixture(); f.context.targetTicksPerSecond = target; expect(() => createSamePaObservationClockProjectionSourcesV212(f.sources, f.context)).toThrow(); }
  const mismatch = fixture(), original = mismatch.context.originals[0];
  mismatch.context.originals[0] = { ...original, nominalCalibration: { ...original.nominalCalibration, memoryDecayParameters: { ...original.nominalCalibration.memoryDecayParameters, ticksPerSecond: 2000 } } };
  expect(() => createSamePaObservationClockProjectionSourcesV212(mismatch.sources, mismatch.context)).toThrow('clocks differ');
  const overflow = fixture(); overflow.context.targetTicksPerSecond = Number.MAX_SAFE_INTEGER;
  overflow.context.originals[0] = { ...overflow.context.originals[0], nominalCalibration: { ...overflow.context.originals[0].nominalCalibration,
    refreshPolicy: { attendedIntervalTicks: 2000, peripheralIntervalTicks: 4000 } } };
  expect(() => createSamePaObservationClockProjectionSourcesV212(overflow.sources, overflow.context)).toThrow('safe integer range');
});

it('OCS212-04 rejects different nominal references, player binding or declared ability values', () => {
  const nominal = fixture(); nominal.context.originals[0] = { ...nominal.context.originals[0], nominalReference: pin('world_player_observation_models', 'foreign') };
  expect(() => createSamePaObservationClockProjectionSourcesV212(nominal.sources, nominal.context)).toThrow();
  const binding = fixture(), raw = samePaLifecycleCalibrationInput(binding.sources[0]);
  binding.sources[0] = { ...raw, member: { ...raw.member, bindingHash: hash('foreign-binding') } };
  expect(() => createSamePaObservationClockProjectionSourcesV212(binding.sources, binding.context)).toThrow();
  const ability = fixture(), source = samePaLifecycleCalibrationInput(ability.sources[0]);
  if (source.route !== 'defender_observation') throw Error('fixture observation route missing');
  ability.sources[0] = { ...source, response: { kind: 'accepted_execution_values_v1', values: { ...source.response.values, perceptionAbility: 0.1 } } };
  expect(() => createSamePaObservationClockProjectionSourcesV212(ability.sources, ability.context)).toThrow();
});

it('OCS212-05 refuses chained projections and supports an explicit current field-root reference', () => {
  const f = fixture(), first = createSamePaObservationClockProjectionSourcesV212(f.sources, f.context);
  expect(() => createSamePaObservationClockProjectionSourcesV212(first, f.context)).toThrow();
  const original = f.context.originals[0];
  f.context.originals[0] = { ...original, effectiveCalibration: { ...original.effectiveCalibration, source: samePaLifecycleCalibrationInput(first[0]) } };
  expect(() => createSamePaObservationClockProjectionSourcesV212(f.sources, f.context)).toThrow('unprojected');
  const root = fixture(), fieldReference = pin('pa_physical_v1_field_roots', 'current-field-root');
  const result = createSamePaObservationClockProjectionSourcesV212(root.sources, { ...root.context, fieldReference });
  expect(samePaLifecycleCalibrationInput(result[0]).observationClockProjection?.fieldReference).toEqual(fieldReference);
});
