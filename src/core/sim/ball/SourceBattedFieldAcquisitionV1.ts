import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { BattedWorldFieldMotion, BattedWorldFieldMotionAdoptionInput } from './BattedWorldFieldMotion';
import { deriveSourceBattedFieldMotorMotionV1, type SourceBattedFieldMotorActionV1 } from './SourceBattedFieldMotorMotionV1';
import { prepareBattedWorldScheduledFieldAcquisition, advanceBattedWorldScheduledFieldAcquisition,
  type BattedWorldScheduledFieldAcquisitionAdvance } from './BattedWorldScheduledFieldAcquisition';

export type SourceBattedFieldAcquisitionInputV1 = Readonly<{
  initial: BattedWorldFieldMotionAdoptionInput;
  actions: readonly SourceBattedFieldMotorActionV1[];
  captureThroughElapsedSeconds: readonly number[];
}>;
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

/** Reconstruct the original free-ball/motor history before admitting any glove
 * constraint. No caller candidate, plan, cursor or completed possession is an
 * input. The existing energy and recorded-tick fence still own acquisition.
 * Held motion follows the actual glove curve; it is not an aerodynamic flight.
 * A failed retention, competing contact or expired body coverage cannot become
 * possession. Native must independently authenticate all commands and models. */
export const deriveSourceBattedFieldAcquisitionV1 = (raw: SourceBattedFieldAcquisitionInputV1) => {
  const input = cloneInert(raw);
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).sort().join('|') !== 'actions|captureThroughElapsedSeconds|initial'
    || !Array.isArray(input.captureThroughElapsedSeconds) || input.captureThroughElapsedSeconds.length > 256) {
    throw new Error('invalid Source field acquisition replay scope');
  }
  const freeTrace = deriveSourceBattedFieldMotorMotionV1({ initial: input.initial, actions: input.actions });
  const candidate = freeTrace.field;
  if (candidate.motion.response.kind !== 'capture_candidate' || candidate.motion.carrierPlayerId !== null || candidate.motion.cursor !== null) {
    throw new Error('Source field acquisition requires an original physical glove candidate');
  }
  const plan = prepareBattedWorldScheduledFieldAcquisition({ response: input.initial.response, geometry: input.initial.geometry, field: candidate });
  const steps: { throughElapsedSeconds: number; progress: BattedWorldScheduledFieldAcquisitionAdvance; field: BattedWorldFieldMotion }[] = [];
  let progress: BattedWorldScheduledFieldAcquisitionAdvance | null = null, field = candidate;
  for (const throughElapsedSeconds of input.captureThroughElapsedSeconds) {
    progress = advanceBattedWorldScheduledFieldAcquisition({ plan, previous: progress, throughElapsedSeconds });
    const secured = progress.kind === 'secured';
    field = { motion: { actors: candidate.motion.actors, carrierPlayerId: secured ? plan.acquirerPlayerId : null,
      world: progress.world, cursor: progress.cursor,
      response: progress.kind === 'secured' ? { kind: 'carried', cursor: progress.cursor }
        : { kind: progress.kind === 'interrupted' ? 'capture_interrupted' : 'capture_pending', cursor: null } }, baseContacts: progress.baseContacts };
    steps.push({ throughElapsedSeconds, progress, field });
  }
  return freeze({ authority: 'SOURCE_FIELD_ACQUISITION_REPLAY_V1' as const, nativeAdmission: false as const, official: null,
    freeTrace, plan, steps, field, progress });
};
