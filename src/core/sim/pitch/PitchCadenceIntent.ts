import type { SeedRoot } from '../../rng/SeedRoot';
import type { PitchTimingIntent } from './PitchTimingModel';

export type DeliberateHoldInput = Readonly<{
  root: SeedRoot;
  outingId: string;
  playId: number;
  pitchIndex: number;
  timingIntent: PitchTimingIntent;
}>;

export const resolveDeliberateExtraHoldUs = (input: DeliberateHoldInput): number => {
  if (typeof input.outingId !== 'string' || input.outingId.length === 0) {
    throw new Error('outingId must not be empty');
  }
  if (
    !Number.isSafeInteger(input.playId) || input.playId < 0
    || !Number.isSafeInteger(input.pitchIndex) || input.pitchIndex < 0
  ) {
    throw new Error('playId and pitchIndex must be non-negative safe integers');
  }
  if (input.timingIntent.deliveryMode !== 'NORMAL' && input.timingIntent.deliveryMode !== 'QUICK') {
    throw new Error('unknown pitch delivery mode');
  }
  if (input.timingIntent.cadenceIntent === 'STANDARD') return 0;
  if (input.timingIntent.cadenceIntent !== 'DELIBERATE') {
    throw new Error('unknown pitch cadence intent');
  }
  const rng = input.root.streamRng(
    input.playId,
    'pitch_timing',
    `outing:${input.outingId}:pitch:${input.pitchIndex}:deliberate-hold`,
  );
  return 100_000 + rng.nextUint32() % 300_001;
};
