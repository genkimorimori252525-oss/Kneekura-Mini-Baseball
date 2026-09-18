import type {
  CanonicalPlateAppearanceEvent,
  CanonicalPlateAppearanceTimeline,
} from '../plateAppearance/CanonicalPlateAppearanceTimeline';
import {
  recordBatBallContact,
  recordCountedPitch,
} from '../plateAppearance/CanonicalPlateAppearanceTimeline';
import type {
  SwingingPitchPhysicalResult,
} from './SwingingPitchPhysicalResult';

export const recordSwingingPitchPhysicalResult = (
  timeline: CanonicalPlateAppearanceTimeline,
  result: SwingingPitchPhysicalResult,
): CanonicalPlateAppearanceTimeline => {
  if (result.kind === 'contact') {
    return recordBatBallContact(
      timeline,
      result.contact,
    );
  }

  if (
    !Number.isSafeInteger(result.adjudicationTick)
    || result.adjudicationTick < timeline.lastEventTick
  ) {
    throw new Error(
      'plate appearance event tick must not precede the previous event',
    );
  }

  const physicalEvent: CanonicalPlateAppearanceEvent = {
    tick: result.adjudicationTick,
    sequence: timeline.nextSequence,
    kind: 'SwingCompletedWithoutContact',
    payload: {
      result,
    },
  };

  const withPhysicalEvidence: CanonicalPlateAppearanceTimeline = {
    ...timeline,
    lastEventTick: result.adjudicationTick,
    nextSequence: timeline.nextSequence + 1,
    events: [
      ...timeline.events,
      physicalEvent,
    ],
  };

  return recordCountedPitch(
    withPhysicalEvidence,
    result.adjudicationTick,
    { kind: 'swinging_strike' },
  );
};
