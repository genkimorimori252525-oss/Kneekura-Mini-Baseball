import type {
  BaseOccupancy,
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import type {
  CanonicalPlateAppearanceTimeline,
} from './CanonicalPlateAppearanceTimeline';
import {
  applyResolvedLiveBallPlateAppearanceToMatchState,
} from './PlateAppearanceMatchState';

export type CaughtFoulRunnerFinalization = Readonly<{
  basesAfter: BaseOccupancy;
  scoredRunnerIds: readonly string[];
}>;

const findTimelinePlayEnd = (
  timeline: CanonicalPlateAppearanceTimeline,
) => {
  const event = [...timeline.events]
    .reverse()
    .find((item) => item.kind === 'LiveBallPlayEnded');

  if (
    event === undefined
    || event.kind !== 'LiveBallPlayEnded'
  ) {
    throw new Error(
      'completed caught-foul timeline must contain a play-end event',
    );
  }

  return event.payload.playEnd;
};

export const applyCaughtFoulPlateAppearanceToMatchState = (
  match: CanonicalMatchState,
  timeline: CanonicalPlateAppearanceTimeline,
  finalized: CaughtFoulRunnerFinalization,
): CanonicalMatchState => {
  if (
    timeline.status.kind !== 'live_ball_complete'
    || timeline.status.disposition.kind !== 'caught_foul'
  ) {
    throw new Error(
      'caught-foul match-state application requires a completed caught-foul timeline',
    );
  }

  const outsAfter = match.outs + 1;
  if (outsAfter > 3) {
    throw new Error(
      'caught-foul match-state application requires outs from 0 through 2 before the catch',
    );
  }

  if (
    outsAfter === 3
    && finalized.scoredRunnerIds.length > 0
  ) {
    throw new Error(
      'caught-foul third out cannot score runs',
    );
  }

  return applyResolvedLiveBallPlateAppearanceToMatchState(
    match,
    timeline,
    {
      playEnd: findTimelinePlayEnd(timeline),
      outsAfter,
      basesAfter: finalized.basesAfter,
      scoredRunnerIds: finalized.scoredRunnerIds,
    },
  );
};
