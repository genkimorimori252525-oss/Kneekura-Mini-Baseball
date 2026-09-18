import type {
  FairFoulBaseGateGeometry,
  UntouchedGroundContactBeyondBasesResult,
} from '../../rules/FairFoulGroundRule';
import {
  resolveUntouchedGroundContactBeyondBases,
} from '../../rules/FairFoulGroundRule';
import type {
  FairTerritoryWedge,
} from '../ball/FairTerritoryGeometry';
import {
  recordFairBattedBall,
  recordFoulBattedBall,
  type CanonicalPlateAppearanceTimeline,
} from './CanonicalPlateAppearanceTimeline';

export type GroundContactFairFoulTimelineInput = Readonly<{
  timeline: CanonicalPlateAppearanceTimeline;
  field: FairTerritoryWedge;
  bases: FairFoulBaseGateGeometry;
  buntAttempt: boolean;
  noPriorFielderTouch: true;
}>;

export type GroundContactFairFoulTimelineResult =
  | Readonly<{
      kind: 'fair';
      rule: Extract<
        UntouchedGroundContactBeyondBasesResult,
        { kind: 'resolved'; territory: 'fair' }
      >;
      timeline: CanonicalPlateAppearanceTimeline;
    }>
  | Readonly<{
      kind: 'foul';
      rule: Extract<
        UntouchedGroundContactBeyondBasesResult,
        { kind: 'resolved'; territory: 'foul' }
      >;
      timeline: CanonicalPlateAppearanceTimeline;
    }>
  | Readonly<{
      kind: 'not_decisive';
      rule: Extract<
        UntouchedGroundContactBeyondBasesResult,
        { kind: 'not_decisive' }
      >;
      timeline: CanonicalPlateAppearanceTimeline;
    }>;

export const resolveAndRecordUntouchedGroundContactBeyondBases = (
  input: GroundContactFairFoulTimelineInput,
): GroundContactFairFoulTimelineResult => {
  if (input.timeline.status.kind !== 'batted_ball_pending') {
    throw new Error(
      'ground-contact fair/foul timeline resolution requires a pending batted ball',
    );
  }

  const groundEvent = [...input.timeline.events]
    .reverse()
    .find((event) => (
      event.kind === 'BattedBallFirstGroundContact'
    ));

  if (
    groundEvent === undefined
    || groundEvent.kind !== 'BattedBallFirstGroundContact'
  ) {
    throw new Error(
      'ground-contact fair/foul resolution requires first-ground contact evidence',
    );
  }

  const rule = resolveUntouchedGroundContactBeyondBases({
    firstGroundContact: groundEvent.payload.evidence,
    field: input.field,
    bases: input.bases,
    noPriorFielderTouch: input.noPriorFielderTouch,
  });

  if (rule.kind === 'not_decisive') {
    return {
      kind: 'not_decisive',
      rule,
      timeline: input.timeline,
    };
  }

  if (rule.territory === 'fair') {
    return {
      kind: 'fair',
      rule,
      timeline: recordFairBattedBall(
        input.timeline,
        rule.decisiveTick,
      ),
    };
  }

  return {
    kind: 'foul',
    rule,
    timeline: recordFoulBattedBall(
      input.timeline,
      rule.decisiveTick,
      input.buntAttempt,
      null,
    ),
  };
};
