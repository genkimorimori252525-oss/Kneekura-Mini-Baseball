import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import {
  resolveHalfInningTransition,
} from '../../rules/HalfInningTransitionRule';
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
