import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
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
