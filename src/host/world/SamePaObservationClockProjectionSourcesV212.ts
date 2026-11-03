import { projectObservationClockV1 } from '../../core/sim/perception/ObservationClockProjectionV1';
import type { PlayerObservationCalibration } from '../../core/sim/perception/PlayerObservationCalibration';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaLifecycleCalibrationInput, SAME_PA_OBSERVATION_CLOCK_PROJECTION_VERSION,
  type AcceptedSamePaLifecycleCalibration, type SamePaLifecycleCalibration, type SamePaObservationClockProjectionV1 } from './SamePlateAppearanceLifecycleCalibrationSource';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';

export type SamePaObservationClockProjectionContextV212 = Readonly<{
  fieldReference: SamePaObservationClockProjectionV1['fieldReference'];
  targetTicksPerSecond: number;
  originals: readonly Readonly<{
    nominalReference: SamePaReference<'world_player_observation_models'>;
    nominalCalibration: PlayerObservationCalibration;
    effectiveCalibration: SamePaLifecycleCalibration;
  }>[];
}>;
type ProjectedSource = Extract<AcceptedSamePaLifecycleCalibration, { route: 'defender_observation' }>;
const fail = (detail: string): never => { throw Error('observation clock Source declaration ' + detail); };
const same = (left: unknown, right: unknown) => { if (json(left) !== json(right)) fail('original references, scope or player binding differ'); };

/** Pure prospective declarations only. Inputs come from the caller's normal
 * reads; normal lifecycle acceptance reauthenticates every reference and clock.
 * This function does not confer authority on a calibration or field. */
export const createSamePaObservationClockProjectionSourcesV212 = <S extends Readonly<{ sourceId: string; route: string }>>(
  sources: readonly S[], context: SamePaObservationClockProjectionContextV212): (S | ProjectedSource)[] => {
  const observations = sources.filter(source => source.route === 'defender_observation');
  if (observations.length !== 9 || new Set(observations.map(source => source.sourceId)).size !== 9 || context.originals.length !== 9)
    return fail('requires exactly nine original defender observations');
  const originals = new Map(context.originals.map(original => [original.effectiveCalibration.source.member.playerId, original]));
  if (originals.size !== 9 || new Set(context.originals.map(original => original.effectiveCalibration.source.sourceId)).size !== 9)
    return fail('original defender set is ambiguous');
  const players = new Set<string>();
  return sources.map(raw => {
    if (raw.route !== 'defender_observation') return raw;
    const source = samePaLifecycleCalibrationInput(raw);
    if (source.route !== 'defender_observation' || Object.hasOwn(source, 'observationClockProjection')) return fail('requires a new unprojected declaration');
    const playerId = source.member.playerId, original = originals.get(playerId);
    if (!original || players.has(playerId)) return fail('original defender membership differs');
    players.add(playerId);
    const prior = original.effectiveCalibration, oldSource = samePaLifecycleCalibrationInput(prior.source);
    if (oldSource.route !== 'defender_observation' || Object.hasOwn(oldSource, 'observationClockProjection') || Object.hasOwn(prior, 'observationClockProjection'))
      return fail('requires an original unprojected effective calibration');
    same(source.nominalReference, original.nominalReference); same(oldSource.nominalReference, original.nominalReference);
    same(source.enrollmentReference, oldSource.enrollmentReference); same(source.firstPhysicalPitchSourceId, oldSource.firstPhysicalPitchSourceId);
    for (const key of ['playerId', 'bindingHash', 'personHash', 'baselineSourceId'] as const) same(source.member[key], oldSource.member[key]);
    same(source.response, oldSource.response);
    if (original.nominalCalibration.memoryDecayParameters.ticksPerSecond !== oldSource.response.values.memoryDecayParameters.ticksPerSecond)
      return fail('original nominal and effective clocks differ');
    projectObservationClockV1(original.nominalCalibration, context.targetTicksPerSecond);
    const values = projectObservationClockV1(oldSource.response.values, context.targetTicksPerSecond);
    const projected = samePaLifecycleCalibrationInput({ ...source, sourceVersion: SAME_PA_OBSERVATION_CLOCK_PROJECTION_VERSION,
      provenance: { ...source.provenance, calibrationSourceId: oldSource.sourceId, calibrationVersion: SAME_PA_OBSERVATION_CLOCK_PROJECTION_VERSION },
      response: { kind: 'accepted_execution_values_v1', values }, observationClockProjection: {
        kind: 'observation_clock_projection_v1', originalNominalReference: original.nominalReference,
        originalEffectiveCalibrationReference: reference('pa_lifecycle_v1_execution_calibrations', prior), fieldReference: context.fieldReference,
      } });
    if (projected.route !== 'defender_observation') return fail('projected route differs');
    return projected;
  });
};
