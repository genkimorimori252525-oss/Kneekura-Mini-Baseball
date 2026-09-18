import type {
  BallFlightParameters,
} from '../ball/BallFlight';
import {
  createBattedBallFlightEvidence,
  type BattedBallFlightEvidence,
} from '../ball/BattedBallFlightEvidence';
import {
  classifyFirstGroundContactTerritory,
  type FirstGroundContactTerritory,
} from '../ball/FirstGroundContactTerritory';
import type {
  FairTerritoryWedge,
} from '../ball/FairTerritoryGeometry';
import {
  recordBattedBallFirstGroundContact,
  type CanonicalPlateAppearanceTimeline,
} from './CanonicalPlateAppearanceTimeline';

export type BattedBallTimelinePhysicalAdapterInput = Readonly<{
  timeline: CanonicalPlateAppearanceTimeline;
  field: FairTerritoryWedge;
  searchDurationTicks: number;
  ballFlightParameters: BallFlightParameters;
}>;

export type BattedBallTimelinePhysicalAdapterResult =
  | Readonly<{
      kind: 'recorded';
      timeline: CanonicalPlateAppearanceTimeline;
      flight: BattedBallFlightEvidence;
      territory: FirstGroundContactTerritory;
    }>
  | Readonly<{
      kind: 'no_ground_contact';
      timeline: CanonicalPlateAppearanceTimeline;
      flight: BattedBallFlightEvidence;
    }>;

export const deriveAndRecordFirstGroundContactEvidence = (
  input: BattedBallTimelinePhysicalAdapterInput,
): BattedBallTimelinePhysicalAdapterResult => {
  if (input.timeline.status.kind !== 'batted_ball_pending') {
    throw new Error(
      'batted-ball physical evidence requires a pending batted ball',
    );
  }

  const contactTick =
    input.timeline.status.contactTick;
  const contactEvent = [...input.timeline.events]
    .reverse()
    .find((event) => (
      event.kind === 'BatBallContact'
      && event.tick === contactTick
    ));

  if (
    contactEvent === undefined
    || contactEvent.kind !== 'BatBallContact'
  ) {
    throw new Error(
      'pending batted-ball timeline must contain its BatBallContact event',
    );
  }

  const flight = createBattedBallFlightEvidence({
    contact: contactEvent.payload.contact,
    searchDurationTicks: input.searchDurationTicks,
    parameters: input.ballFlightParameters,
  });
  const territory = classifyFirstGroundContactTerritory(
    flight,
    input.field,
  );

  if (territory === null) {
    return {
      kind: 'no_ground_contact',
      timeline: input.timeline,
      flight,
    };
  }

  return {
    kind: 'recorded',
    timeline: recordBattedBallFirstGroundContact(
      input.timeline,
      territory,
    ),
    flight,
    territory,
  };
};