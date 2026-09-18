import type {
  BaseOccupancy,
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import type {
  PlayEndFact,
} from '../../rules/PhysicalRuleFacts';
import {
  resolveHalfInningTransition,
} from '../../rules/HalfInningTransitionRule';
import {
  resolveWalkForcedAdvancement,
} from '../../rules/WalkAdvancementRule';
import type {
  CanonicalPlateAppearanceTimeline,
} from './CanonicalPlateAppearanceTimeline';

const nextPlayId = (
  playId: number,
): number => {
  if (!Number.isSafeInteger(playId) || playId < 0) {
    throw new Error(
      'CanonicalMatchState.playId must be a non-negative safe integer',
    );
  }
  if (!Number.isSafeInteger(playId + 1)) {
    throw new Error('next playId must be a safe integer');
  }
  return playId + 1;
};

export const applyStrikeoutPlateAppearanceToMatchState = (
  match: CanonicalMatchState,
  timeline: CanonicalPlateAppearanceTimeline,
): CanonicalMatchState => {
  if (timeline.playId !== match.playId) {
    throw new Error(
      'plate appearance timeline playId must match CanonicalMatchState.playId',
    );
  }
  if (timeline.status.kind !== 'strikeout') {
    throw new Error(
      'strikeout match-state application requires a strikeout timeline',
    );
  }

  const outsAfterPlay = match.outs + 1;
  const transition = resolveHalfInningTransition({
    inning: match.inning,
    half: match.half,
    outsAfterPlay,
  });
  const playId = nextPlayId(match.playId);

  if (transition.kind === 'half_inning_continues') {
    return {
      ...match,
      outs: transition.outs,
      balls: 0,
      strikes: 0,
      playId,
    };
  }

  return {
    ruleProfileId: match.ruleProfileId,
    inning: transition.nextInning,
    half: transition.nextHalf,
    outs: transition.reset.outs,
    balls: transition.reset.balls,
    strikes: transition.reset.strikes,
    bases: transition.reset.bases,
    score: match.score,
    playId,
  };
};


export const applyWalkPlateAppearanceToMatchState = (
  match: CanonicalMatchState,
  timeline: CanonicalPlateAppearanceTimeline,
  batterRunnerId: string,
): CanonicalMatchState => {
  if (timeline.playId !== match.playId) {
    throw new Error(
      'plate appearance timeline playId must match CanonicalMatchState.playId',
    );
  }
  if (timeline.status.kind !== 'walk') {
    throw new Error(
      'walk match-state application requires a walk timeline',
    );
  }
  if (
    !Number.isInteger(match.outs)
    || match.outs < 0
    || match.outs > 2
  ) {
    throw new Error(
      'walk match-state application requires outs from 0 through 2',
    );
  }

  const advancement = resolveWalkForcedAdvancement({
    batterRunnerId,
    bases: match.bases,
  });
  const runs = advancement.scoredRunnerIds.length;

  return {
    ...match,
    balls: 0,
    strikes: 0,
    bases: advancement.bases,
    score: match.half === 'top'
      ? {
          away: match.score.away + runs,
          home: match.score.home,
        }
      : {
          away: match.score.away,
          home: match.score.home + runs,
        },
    playId: nextPlayId(match.playId),
  };
};


export type ResolvedLiveBallPlateAppearance = Readonly<{
  playEnd: PlayEndFact;
  outsAfter: number;
  basesAfter: BaseOccupancy;
  scoredRunnerIds: readonly string[];
}>;

const validateUniqueFinalBases = (
  bases: BaseOccupancy,
): readonly string[] => {
  const occupied = [
    bases.first,
    bases.second,
    bases.third,
  ].filter((runnerId): runnerId is string => runnerId !== null);

  if (occupied.some((runnerId) => runnerId.length === 0)) {
    throw new Error(
      'live-ball final bases must contain non-empty runner ids',
    );
  }
  if (new Set(occupied).size !== occupied.length) {
    throw new Error(
      'live-ball final bases must contain unique runner ids',
    );
  }

  return occupied;
};

const validateScoredRunnerIds = (
  scoredRunnerIds: readonly string[],
  occupied: readonly string[],
): void => {
  if (
    scoredRunnerIds.some((runnerId) => runnerId.length === 0)
    || new Set(scoredRunnerIds).size !== scoredRunnerIds.length
  ) {
    throw new Error(
      'live-ball scoredRunnerIds must contain unique non-empty runner ids',
    );
  }
  if (
    scoredRunnerIds.some((runnerId) => occupied.includes(runnerId))
  ) {
    throw new Error(
      'a scored runner cannot remain on a final base',
    );
  }
};

export const applyResolvedLiveBallPlateAppearanceToMatchState = (
  match: CanonicalMatchState,
  timeline: CanonicalPlateAppearanceTimeline,
  resolution: ResolvedLiveBallPlateAppearance,
): CanonicalMatchState => {
  if (timeline.playId !== match.playId) {
    throw new Error(
      'plate appearance timeline playId must match CanonicalMatchState.playId',
    );
  }
  if (timeline.status.kind !== 'live_ball') {
    throw new Error(
      'live-ball match-state application requires a live-ball timeline',
    );
  }
  if (resolution.playEnd.tick < timeline.status.contactTick) {
    throw new Error(
      'live-ball play end must not precede bat-ball contact',
    );
  }
  if (
    !Number.isInteger(resolution.outsAfter)
    || resolution.outsAfter < match.outs
    || resolution.outsAfter > 3
  ) {
    throw new Error(
      'live-ball outsAfter must be between current outs and 3',
    );
  }

  const occupied = validateUniqueFinalBases(
    resolution.basesAfter,
  );
  validateScoredRunnerIds(
    resolution.scoredRunnerIds,
    occupied,
  );

  const runs = resolution.scoredRunnerIds.length;
  const score = match.half === 'top'
    ? {
        away: match.score.away + runs,
        home: match.score.home,
      }
    : {
        away: match.score.away,
        home: match.score.home + runs,
      };

  const transition = resolveHalfInningTransition({
    inning: match.inning,
    half: match.half,
    outsAfterPlay: resolution.outsAfter,
  });
  const playId = nextPlayId(match.playId);

  if (transition.kind === 'half_inning_continues') {
    return {
      ...match,
      outs: transition.outs,
      balls: 0,
      strikes: 0,
      bases: resolution.basesAfter,
      score,
      playId,
    };
  }

  return {
    ruleProfileId: match.ruleProfileId,
    inning: transition.nextInning,
    half: transition.nextHalf,
    outs: transition.reset.outs,
    balls: transition.reset.balls,
    strikes: transition.reset.strikes,
    bases: transition.reset.bases,
    score,
    playId,
  };
};
