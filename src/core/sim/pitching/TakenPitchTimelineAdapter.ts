import type {
  CanonicalPlateAppearanceEvent,
  CanonicalPlateAppearanceTimeline,
} from '../plateAppearance/CanonicalPlateAppearanceTimeline';
import {
  recordCountedPitch,
} from '../plateAppearance/CanonicalPlateAppearanceTimeline';
import type {
  TakenPitchPhysicalResult,
} from './TakenPitchPhysicalResult';

export const recordTakenPitchPhysicalResult = (
  timeline: CanonicalPlateAppearanceTimeline,
  result: TakenPitchPhysicalResult,
): CanonicalPlateAppearanceTimeline => {
  if (
    !Number.isSafeInteger(result.crossing.tick)
    || result.crossing.tick < timeline.lastEventTick
  ) {
    throw new Error(
      'plate appearance event tick must not precede the previous event',
    );
  }

  const physicalEvent: CanonicalPlateAppearanceEvent = {
    tick: result.crossing.tick,
    sequence: timeline.nextSequence,
    kind: 'TakenPitchPlateCrossed',
    payload: {
      result,
    },
  };

  const withPhysicalEvidence: CanonicalPlateAppearanceTimeline = {
    ...timeline,
    lastEventTick: result.crossing.tick,
    nextSequence: timeline.nextSequence + 1,
    events: [
      ...timeline.events,
      physicalEvent,
    ],
  };

  return recordCountedPitch(
    withPhysicalEvidence,
    result.crossing.tick,
    {
      kind: result.kind,
    },
  );
};
