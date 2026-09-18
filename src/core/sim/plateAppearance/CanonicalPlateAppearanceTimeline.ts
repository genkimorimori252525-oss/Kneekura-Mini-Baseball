import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import type {
  TimedMatchEvent,
} from '../../model/TimedMatchEvent';
import type {
  BatBallContactResult,
} from '../contact/BatBallContact';
import type {
  PlayEndFact,
} from '../../rules/PhysicalRuleFacts';
import {
  resolvePitchCountRule,
  type PitchCountAdjudication,
  type PitchCountState,
} from '../../rules/PitchCountRule';
import {
  resolveFoulBallRule,
} from '../../rules/FoulBallRule';
import type {
  FlyCatchRuleResult,
} from '../../rules/FlyCatchRule';

export type CountedPitchAdjudication =
  | Readonly<{ kind: 'ball' }>
  | Readonly<{ kind: 'called_strike' }>
  | Readonly<{ kind: 'swinging_strike' }>;

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
    kind: 'batted_ball_pending';
    count: PitchCountState;
    contactTick: number;
  }>
  | Readonly<{
    kind: 'live_ball';
    count: PitchCountState;
    contactTick: number;
    fairDeterminationTick: number;
  }>
  | Readonly<{
    kind: 'live_ball_complete';
    count: PitchCountState;
    contactTick: number;
    fairDeterminationTick: number;
    playEndTick: number;
  }>
  | Readonly<{
    kind: 'caught_foul_out';
    count: PitchCountState;
    contactTick: number;
    outTick: number;
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

export type CanonicalFairBattedBallEventPayload = Readonly<{
  contactTick: number;
}>;

export type CanonicalFoulBattedBallEventPayload = Readonly<{
  contactTick: number;
  resolution: ReturnType<typeof resolveFoulBallRule>;
}>;

export type CanonicalLiveBallPlayEndEventPayload = Readonly<{
  playEnd: PlayEndFact;
}>;

export type CanonicalPlateAppearanceEvent =
  | TimedMatchEvent<
      'PitchAdjudicated',
      PitchAdjudicatedEventPayload
    >
  | TimedMatchEvent<
      'BatBallContact',
      CanonicalBatBallContactEventPayload
    >
  | TimedMatchEvent<
      'BattedBallDeclaredFair',
      CanonicalFairBattedBallEventPayload
    >
  | TimedMatchEvent<
      'FoulBattedBallResolved',
      CanonicalFoulBattedBallEventPayload
    >
  | TimedMatchEvent<
      'LiveBallPlayEnded',
      CanonicalLiveBallPlayEndEventPayload
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
    ![
      'ball',
      'called_strike',
      'swinging_strike',
    ].includes((adjudication as PitchCountAdjudication).kind)
  ) {
    throw new Error(
      'counted pitch adjudication must be a non-contact pitch result',
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
      kind: 'batted_ball_pending',
      count: active.count,
      contactTick: contact.tick,
    },
    events: [...timeline.events, event],
  };
};


export const recordFairBattedBall = (
  timeline: CanonicalPlateAppearanceTimeline,
  determinationTick: number,
): CanonicalPlateAppearanceTimeline => {
  if (timeline.status.kind !== 'batted_ball_pending') {
    throw new Error(
      'fair-ball disposition requires a pending batted ball',
    );
  }
  assertMonotonicTick(timeline, determinationTick);

  const event: CanonicalPlateAppearanceEvent = {
    tick: determinationTick,
    sequence: timeline.nextSequence,
    kind: 'BattedBallDeclaredFair',
    payload: {
      contactTick: timeline.status.contactTick,
    },
  };

  return {
    ...timeline,
    lastEventTick: determinationTick,
    nextSequence: timeline.nextSequence + 1,
    status: {
      kind: 'live_ball',
      count: timeline.status.count,
      contactTick: timeline.status.contactTick,
      fairDeterminationTick: determinationTick,
    },
    events: [...timeline.events, event],
  };
};

export const recordFoulBattedBall = (
  timeline: CanonicalPlateAppearanceTimeline,
  resolutionTick: number,
  buntAttempt: boolean,
  flyCatch: FlyCatchRuleResult,
): CanonicalPlateAppearanceTimeline => {
  if (timeline.status.kind !== 'batted_ball_pending') {
    throw new Error(
      'foul-ball disposition requires a pending batted ball',
    );
  }
  assertMonotonicTick(timeline, resolutionTick);

  const resolution = resolveFoulBallRule({
    territory: 'foul',
    buntAttempt,
    count: timeline.status.count,
    flyCatch,
  });
  if (
    resolution.kind === 'not_foul'
    || resolution.kind === 'unresolved_foul_fly'
  ) {
    throw new Error(
      'foul ball must be resolved before timeline recording',
    );
  }

  const event: CanonicalPlateAppearanceEvent = {
    tick: resolutionTick,
    sequence: timeline.nextSequence,
    kind: 'FoulBattedBallResolved',
    payload: {
      contactTick: timeline.status.contactTick,
      resolution,
    },
  };

  if (resolution.kind === 'caught_foul_fly') {
    return {
      ...timeline,
      lastEventTick: resolutionTick,
      nextSequence: timeline.nextSequence + 1,
      status: {
        kind: 'caught_foul_out',
        count: timeline.status.count,
        contactTick: timeline.status.contactTick,
        outTick: resolution.outTick,
      },
      events: [...timeline.events, event],
    };
  }

  if (resolution.countResult.kind === 'continue') {
    return {
      ...timeline,
      lastEventTick: resolutionTick,
      nextSequence: timeline.nextSequence + 1,
      status: {
        kind: 'active',
        count: resolution.countResult.count,
      },
      events: [...timeline.events, event],
    };
  }

  if (resolution.countResult.kind === 'strikeout') {
    return {
      ...timeline,
      lastEventTick: resolutionTick,
      nextSequence: timeline.nextSequence + 1,
      status: {
        kind: 'strikeout',
        terminalCount: resolution.countResult.terminalCount,
      },
      events: [...timeline.events, event],
    };
  }

  throw new Error(
    'uncaught foul produced an invalid count result',
  );
};

export const recordLiveBallPlayEnd = (
  timeline: CanonicalPlateAppearanceTimeline,
  playEnd: PlayEndFact,
): CanonicalPlateAppearanceTimeline => {
  if (timeline.status.kind !== 'live_ball') {
    throw new Error(
      'live-ball play end requires an active live-ball timeline',
    );
  }
  assertMonotonicTick(timeline, playEnd.tick);
  if (playEnd.tick < timeline.status.contactTick) {
    throw new Error(
      'live-ball play end must not precede bat-ball contact',
    );
  }

  const event: CanonicalPlateAppearanceEvent = {
    tick: playEnd.tick,
    sequence: timeline.nextSequence,
    kind: 'LiveBallPlayEnded',
    payload: {
      playEnd,
    },
  };

  return {
    ...timeline,
    lastEventTick: playEnd.tick,
    nextSequence: timeline.nextSequence + 1,
    status: {
      kind: 'live_ball_complete',
      count: timeline.status.count,
      contactTick: timeline.status.contactTick,
      fairDeterminationTick:
        timeline.status.fairDeterminationTick,
      playEndTick: playEnd.tick,
    },
    events: [...timeline.events, event],
  };
};
