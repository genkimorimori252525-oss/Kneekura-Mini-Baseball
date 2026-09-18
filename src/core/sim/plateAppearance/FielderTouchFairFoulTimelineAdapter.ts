import type {
  FairTerritoryWedge,
} from '../ball/FairTerritoryGeometry';
import {
  resolveFirstFielderTouchTerritory,
} from '../../rules/FairFoulFielderTouchRule';
import {
  recordFairBattedBall,
  type CanonicalPlateAppearanceTimeline,
} from './CanonicalPlateAppearanceTimeline';

export type FielderTouchFairFoulTimelineInput = Readonly<{
  timeline: CanonicalPlateAppearanceTimeline;
  field: FairTerritoryWedge;
}>;

export type FielderTouchFairFoulTimelineResult =
  | Readonly<{
      kind: 'fair';
      timeline: CanonicalPlateAppearanceTimeline;
      decisiveTick: number;
    }>
  | Readonly<{
      kind: 'foul_pending_catch';
      timeline: CanonicalPlateAppearanceTimeline;
      decisiveTick: number;
    }>;

export const resolveAndRecordFirstFielderTouchTerritory = (
  input: FielderTouchFairFoulTimelineInput,
): FielderTouchFairFoulTimelineResult => {
  if (input.timeline.status.kind !== 'batted_ball_pending') {
    throw new Error(
      'first-fielder-touch fair/foul resolution requires a pending batted ball',
    );
  }

  const event = [...input.timeline.events]
    .reverse()
    .find((item) => item.kind === 'BattedBallFirstFielderTouch');

  if (
    event === undefined
    || event.kind !== 'BattedBallFirstFielderTouch'
  ) {
    throw new Error(
      'first-fielder-touch fair/foul resolution requires first-fielder-touch evidence',
    );
  }

  const resolved = resolveFirstFielderTouchTerritory({
    evidence: event.payload.evidence,
    field: input.field,
  });

  if (resolved.territory === 'fair') {
    return {
      kind: 'fair',
      decisiveTick: resolved.decisiveTick,
      timeline: recordFairBattedBall(
        input.timeline,
        resolved.decisiveTick,
      ),
    };
  }

  return {
    kind: 'foul_pending_catch',
    decisiveTick: resolved.decisiveTick,
    timeline: input.timeline,
  };
};
