import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import type {
  TimedMatchEvent,
} from '../../model/TimedMatchEvent';
import type {
  BatBallContactResult,
} from '../contact/BatBallContact';
import {
  resolvePitchCountRule,
  type PitchCountAdjudication,
  type PitchCountState,
} from '../../rules/PitchCountRule';

export type CountedPitchAdjudication = Exclude<
  PitchCountAdjudication,
  Readonly<{ kind: 'ball_in_play' }>
>;

export type CanonicalPlateAppearanceStatus =
  | Readonly<{
    kind: 'active';
    count: PitchCountState;
  }>
  | Readonly<{
    kind: 'walk';
    terminalCount: Readonly<{
      balls: 4;
      strikes: number;
    }>;
  }>
  | Readonly<{
    kind: 'strikeout';
    terminalCount: Readonly<{
      balls: number;
      strikes: 3;
    }>;
  }>
  | Readonly<{
    kind: 'live_ball';
    count: PitchCountState;
    contactTick: number;
  }>;

export type PitchAdjudicatedEventPayload = Readonly<{
  countBefore: PitchCountState;
  adjudication: CountedPitchAdjudication;
  result: ReturnType<typeof resolvePitchCountRule>;
}>;

export type CanonicalBatBallContactEventPayload = Readonly<{
  countBefore: PitchCountState;
  contact: BatBallContactResult;
}>;

export type CanonicalPlateAppearanceEvent =
  | TimedMatchEvent<
      'PitchAdjudicated',
      PitchAdjudicatedEventPayload
    >
  | TimedMatchEvent<
      'BatBallContact',
      CanonicalBatBallContactEventPayload
    >;

export type CanonicalPlateAppearanceTimeline = Readonly<{
  playId: number;
  startedAtTick: number;
  lastEventTick: number;
  nextSequence: number;
  status: CanonicalPlateAppearanceStatus;
  events: readonly CanonicalPlateAppearanceEvent[];
}>;

const validateTick = (
  name: string,
  tick: number,
): void => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error(
      `${name} must be a non-negative safe integer tick`,
    );
  }
};

const assertActive = (
  timeline: CanonicalPlateAppearanceTimeline,
): Extract<
  CanonicalPlateAppearanceStatus,
  { kind: 'active' }
> => {
  if (timeline.status.kind !== 'active') {
    throw new Error(
      'plate appearance timeline is terminal and cannot accept another pitch',
    );
  }
  return timeline.status;
};

const assertMonotonicTick = (
  timeline: CanonicalPlateAppearanceTimeline,
  tick: number,
): void => {
  validateTick('plate appearance event tick', tick);
  if (tick < timeline.lastEventTick) {
    throw new Error(
      'plate appearance event tick must not precede the previous event',
    );
  }
};

export const createCanonicalPlateAppearanceTimeline = (
  match: CanonicalMatchState,
  startedAtTick: number,
): CanonicalPlateAppearanceTimeline => {
  validateTick('startedAtTick', startedAtTick);

  const countResult = resolvePitchCountRule(
    {
      balls: match.balls,
      strikes: match.strikes,
    },
    { kind: 'ball_in_play' },
  );
  if (countResult.kind !== 'ball_in_play') {
    throw new Error(
      'canonical match count must be valid for an active plate appearance',
    );
  }

  return {
    playId: match.playId,
    startedAtTick,
    lastEventTick: startedAtTick,
    nextSequence: 0,
    status: {
      kind: 'active',
      count: countResult.count,
    },
    events: [],
  };
};

export const recordCountedPitch = (
  timeline: CanonicalPlateAppearanceTimeline,
  tick: number,
  adjudication: CountedPitchAdjudication,
): CanonicalPlateAppearanceTimeline => {
  const active = assertActive(timeline);
  assertMonotonicTick(timeline, tick);

  if (
    (adjudication as PitchCountAdjudication).kind
    === 'ball_in_play'
  ) {
    throw new Error(
      'counted pitch adjudication must not be ball_in_play',
    );
  }

  const result = resolvePitchCountRule(
    active.count,
    adjudication,
  );
  if (result.kind === 'ball_in_play') {
    throw new Error(
      'counted pitch adjudication unexpectedly produced ball_in_play',
    );
  }

  const event: CanonicalPlateAppearanceEvent = {
    tick,
    sequence: timeline.nextSequence,
    kind: 'PitchAdjudicated',
    payload: {
      countBefore: active.count,
      adjudication,
      result,
    },
  };

  const status: CanonicalPlateAppearanceStatus =
    result.kind === 'continue'
      ? {
          kind: 'active',
          count: result.count,
        }
      : result.kind === 'walk'
        ? {
            kind: 'walk',
            terminalCount: result.terminalCount,
          }
        : {
            kind: 'strikeout',
            terminalCount: result.terminalCount,
          };

  return {
    ...timeline,
    lastEventTick: tick,
    nextSequence: timeline.nextSequence + 1,
    status,
    events: [...timeline.events, event],
  };
};

export const recordBatBallContact = (
  timeline: CanonicalPlateAppearanceTimeline,
  contact: BatBallContactResult,
): CanonicalPlateAppearanceTimeline => {
  const active = assertActive(timeline);
  assertMonotonicTick(timeline, contact.tick);

  const result = resolvePitchCountRule(
    active.count,
    { kind: 'ball_in_play' },
  );
  if (result.kind !== 'ball_in_play') {
    throw new Error(
      'physical bat-ball contact must resolve to ball_in_play',
    );
  }

  const event: CanonicalPlateAppearanceEvent = {
    tick: contact.tick,
    sequence: timeline.nextSequence,
    kind: 'BatBallContact',
    payload: {
      countBefore: active.count,
      contact,
    },
  };

  return {
    ...timeline,
    lastEventTick: contact.tick,
    nextSequence: timeline.nextSequence + 1,
    status: {
      kind: 'live_ball',
      count: result.count,
      contactTick: contact.tick,
    },
    events: [...timeline.events, event],
  };
};
