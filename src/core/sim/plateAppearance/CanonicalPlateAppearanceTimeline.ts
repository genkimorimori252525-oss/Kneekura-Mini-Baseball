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
import type {
  TakenPitchPhysicalResult,
} from '../pitching/TakenPitchPhysicalResult';
import type {
  FirstGroundContactTerritory,
} from '../ball/FirstGroundContactTerritory';
import type {
  BattedBallFirstFielderTouchTerritory,
} from '../fielding/BattedBallFirstFielderTouchTerritory';
import type {
  SwingingPitchPhysicalResult,
} from '../pitching/SwingingPitchPhysicalResult';

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
    kind: 'caught_foul_live';
    count: PitchCountState;
    contactTick: number;
    outTick: number;
  }>
  | Readonly<{
    kind: 'live_ball_complete';
    count: PitchCountState;
    contactTick: number;
    playEndTick: number;
    disposition:
      | Readonly<{
          kind: 'fair';
          fairDeterminationTick: number;
        }>
      | Readonly<{
          kind: 'caught_foul';
          outTick: number;
        }>;
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

export type CanonicalTakenPitchPhysicalEventPayload = Readonly<{
  result: TakenPitchPhysicalResult;
}>;

export type CanonicalSwingingMissPhysicalEventPayload = Readonly<{
  result: Extract<
    SwingingPitchPhysicalResult,
    { kind: 'swinging_miss' }
  >;
}>;

export type CanonicalLiveBallPlayEndEventPayload = Readonly<{
  playEnd: PlayEndFact;
}>;

export type CanonicalPlateAppearanceEvent =
  | TimedMatchEvent<
      'TakenPitchPlateCrossed',
      CanonicalTakenPitchPhysicalEventPayload
    >
  | TimedMatchEvent<
      'SwingCompletedWithoutContact',
      CanonicalSwingingMissPhysicalEventPayload
    >
  | TimedMatchEvent<
      'PitchAdjudicated',
      PitchAdjudicatedEventPayload
    >
  | TimedMatchEvent<
      'BatBallContact',
      CanonicalBatBallContactEventPayload
    >
  | TimedMatchEvent<
      'BattedBallFirstGroundContact',
      CanonicalFirstGroundContactEventPayload
    >
  | TimedMatchEvent<
      'BattedBallFirstFielderTouch',
      CanonicalFirstFielderTouchEventPayload
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


export const recordBattedBallFirstFielderTouch = (
  timeline: CanonicalPlateAppearanceTimeline,
  evidence: BattedBallFirstFielderTouchTerritory,
): CanonicalPlateAppearanceTimeline => {
  if (timeline.status.kind !== 'batted_ball_pending') {
    throw new Error(
      'first-fielder-touch evidence requires a pending batted ball',
    );
  }
  if (evidence.tick < timeline.status.contactTick) {
    throw new Error(
      'first-fielder touch must not precede bat-ball contact',
    );
  }
  assertMonotonicTick(timeline, evidence.tick);

  const event: CanonicalPlateAppearanceEvent = {
    tick: evidence.tick,
    sequence: timeline.nextSequence,
    kind: 'BattedBallFirstFielderTouch',
    payload: {
      evidence,
    },
  };

  return {
    ...timeline,
    lastEventTick: evidence.tick,
    nextSequence: timeline.nextSequence + 1,
    events: [...timeline.events, event],
  };
};

export const recordBattedBallFirstGroundContact = (
  timeline: CanonicalPlateAppearanceTimeline,
  evidence: FirstGroundContactTerritory,
): CanonicalPlateAppearanceTimeline => {
  if (timeline.status.kind !== 'batted_ball_pending') {
    throw new Error(
      'first-ground contact evidence requires a pending batted ball',
    );
  }
  if (evidence.tick < timeline.status.contactTick) {
    throw new Error(
      'first-ground contact must not precede bat-ball contact',
    );
  }
  assertMonotonicTick(timeline, evidence.tick);

  const event: CanonicalPlateAppearanceEvent = {
    tick: evidence.tick,
    sequence: timeline.nextSequence,
    kind: 'BattedBallFirstGroundContact',
    payload: {
      evidence,
    },
  };

  return {
    ...timeline,
    lastEventTick: evidence.tick,
    nextSequence: timeline.nextSequence + 1,
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
  flyCatch: FlyCatchRuleResult | null,
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
    if (resolutionTick < resolution.outTick) {
      throw new Error(
        'caught foul resolution tick must not precede the catch out tick',
      );
    }
    return {
      ...timeline,
      lastEventTick: resolutionTick,
      nextSequence: timeline.nextSequence + 1,
      status: {
        kind: 'caught_foul_live',
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
  if (
    timeline.status.kind !== 'live_ball'
    && timeline.status.kind !== 'caught_foul_live'
  ) {
    throw new Error(
      'live-ball play end requires an active live-ball timeline',
    );
  }
  if (playEnd.tick < timeline.status.contactTick) {
    throw new Error(
      'live-ball play end must not precede bat-ball contact',
    );
  }
  assertMonotonicTick(timeline, playEnd.tick);

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
      playEndTick: playEnd.tick,
      disposition: timeline.status.kind === 'live_ball'
        ? {
            kind: 'fair',
            fairDeterminationTick:
              timeline.status.fairDeterminationTick,
          }
        : {
            kind: 'caught_foul',
            outTick: timeline.status.outTick,
          },
    },
    events: [...timeline.events, event],
  };
};
