import type {
  FairTerritoryWedge,
} from '../ball/FairTerritoryGeometry';
import type {
  CatchRetentionContact,
} from '../fielding/CatchRetention';
import {
  createBattedBallFirstFielderTouchTerritory,
  type BattedBallFirstFielderTouchTerritory,
} from '../fielding/BattedBallFirstFielderTouchTerritory';
import {
  recordBattedBallFirstFielderTouch,
  type CanonicalPlateAppearanceTimeline,
} from './CanonicalPlateAppearanceTimeline';

export type FielderTouchTimelinePhysicalAdapterInput = Readonly<{
  timeline: CanonicalPlateAppearanceTimeline;
  fielderId: string;
  contact: CatchRetentionContact;
  field: FairTerritoryWedge;
  isFirstFielderTouch: true;
}>;

export type FielderTouchTimelinePhysicalAdapterResult = Readonly<{
  timeline: CanonicalPlateAppearanceTimeline;
  evidence: BattedBallFirstFielderTouchTerritory;
}>;

export const deriveAndRecordFirstFielderTouchEvidence = (
  input: FielderTouchTimelinePhysicalAdapterInput,
): FielderTouchTimelinePhysicalAdapterResult => {
  if (input.timeline.status.kind !== 'batted_ball_pending') {
    throw new Error(
      'fielder-touch physical evidence requires a pending batted ball',
    );
  }

  const evidence = createBattedBallFirstFielderTouchTerritory({
    fielderId: input.fielderId,
    contact: input.contact,
    field: input.field,
    isFirstFielderTouch: input.isFirstFielderTouch,
  });

  return {
    evidence,
    timeline: recordBattedBallFirstFielderTouch(
      input.timeline,
      evidence,
    ),
  };
};
