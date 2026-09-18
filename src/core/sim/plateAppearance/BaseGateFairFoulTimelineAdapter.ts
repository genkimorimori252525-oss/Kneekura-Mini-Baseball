import {
  resolveUntouchedBaseGatePassageTerritory,
  type UntouchedBaseGatePassageTerritoryResult,
} from '../../rules/FairFoulBaseGatePassageRule';
import {
  findFirstBaseGatePassageAfterGroundContact,
  type BattedBallBaseGatePassage,
} from '../ball/BattedBallBaseGatePassage';
import type {
  BallFlightParameters,
} from '../ball/BallFlight';
import type {
  BattedBallFlightEvidence,
} from '../ball/BattedBallFlightEvidence';
import type {
  FairFoulBaseGateGeometry,
} from '../ball/FairFoulBaseGateGeometry';
import type {
  FairTerritoryWedge,
} from '../ball/FairTerritoryGeometry';
import {
  recordBattedBallBaseGatePassage,
  recordFairBattedBall,
  recordFoulBattedBall,
  type CanonicalPlateAppearanceTimeline,
} from './CanonicalPlateAppearanceTimeline';

export type BaseGateFairFoulTimelineInput = Readonly<{
  timeline: CanonicalPlateAppearanceTimeline;
  flight: BattedBallFlightEvidence;
  field: FairTerritoryWedge;
  bases: FairFoulBaseGateGeometry;
  searchDurationTicks: number;
  ballFlightParameters: BallFlightParameters;
  buntAttempt: boolean;
  noPriorFielderTouch: true;
  noPriorFirstOrThirdBaseTouch: true;
}>;

export type BaseGateFairFoulTimelineResult =
  | Readonly<{
      kind: 'fair';
      timeline: CanonicalPlateAppearanceTimeline;
      passage: BattedBallBaseGatePassage;
      rule: UntouchedBaseGatePassageTerritoryResult;
    }>
  | Readonly<{
      kind: 'foul';
      timeline: CanonicalPlateAppearanceTimeline;
      passage: BattedBallBaseGatePassage;
      rule: UntouchedBaseGatePassageTerritoryResult;
    }>
  | Readonly<{
      kind: 'no_passage';
      timeline: CanonicalPlateAppearanceTimeline;
    }>;

const sameNumber = (
  first: number,
  second: number,
): boolean => (
  Math.abs(first - second) <= 1e-12
);

const sameVec3 = (
  first: Readonly<{ x: number; y: number; z: number }>,
  second: Readonly<{ x: number; y: number; z: number }>,
): boolean => (
  sameNumber(first.x, second.x)
  && sameNumber(first.y, second.y)
  && sameNumber(first.z, second.z)
);

const validateFlightMatchesTimeline = (
  timeline: CanonicalPlateAppearanceTimeline,
  flight: BattedBallFlightEvidence,
): void => {
  const contactEvent = [...timeline.events]
    .reverse()
    .find((event) => event.kind === 'BatBallContact');

  if (
    contactEvent === undefined
    || contactEvent.kind !== 'BatBallContact'
    || contactEvent.payload.contact.tick
      !== flight.contact.tick
    || !sameVec3(
      contactEvent.payload.contact.ballCenter,
      flight.contact.ballCenter,
    )
    || !sameVec3(
      contactEvent.payload.contact.exitVelocity,
      flight.contact.exitVelocity,
    )
    || !sameVec3(
      contactEvent.payload.contact.exitSpin,
      flight.contact.exitSpin,
    )
  ) {
    throw new Error(
      'batted-ball flight evidence must match the timeline BatBallContact',
    );
  }

  if (flight.firstGroundContact === null) {
    throw new Error(
      'base-gate fair/foul resolution requires first-ground contact evidence',
    );
  }

  const groundEvent = [...timeline.events]
    .reverse()
    .find((event) => (
      event.kind === 'BattedBallFirstGroundContact'
    ));

  if (
    groundEvent === undefined
    || groundEvent.kind !== 'BattedBallFirstGroundContact'
    || groundEvent.payload.evidence.tick
      !== flight.firstGroundContact.tick
    || !sameNumber(
      groundEvent.payload.evidence.position.x,
      flight.firstGroundContact.state.position.x,
    )
    || !sameNumber(
      groundEvent.payload.evidence.position.z,
      flight.firstGroundContact.state.position.z,
    )
  ) {
    throw new Error(
      'batted-ball flight evidence must match the timeline first-ground contact',
    );
  }
};

export const resolveAndRecordPostBounceBaseGatePassage = (
  input: BaseGateFairFoulTimelineInput,
): BaseGateFairFoulTimelineResult => {
  if (input.timeline.status.kind !== 'batted_ball_pending') {
    throw new Error(
      'base-gate fair/foul resolution requires a pending batted ball',
    );
  }

  validateFlightMatchesTimeline(
    input.timeline,
    input.flight,
  );

  const passage =
    findFirstBaseGatePassageAfterGroundContact({
      flight: input.flight,
      field: input.field,
      bases: input.bases,
      searchDurationTicks: input.searchDurationTicks,
      parameters: input.ballFlightParameters,
    });

  if (passage === null) {
    return {
      kind: 'no_passage',
      timeline: input.timeline,
    };
  }

  const withPassage = recordBattedBallBaseGatePassage(
    input.timeline,
    passage,
  );
  const rule = resolveUntouchedBaseGatePassageTerritory({
    passage,
    field: input.field,
    ballRadiusMeters: input.flight.ballRadiusMeters,
    noPriorFielderTouch: input.noPriorFielderTouch,
    noPriorFirstOrThirdBaseTouch:
      input.noPriorFirstOrThirdBaseTouch,
  });

  if (rule.territory === 'fair') {
    return {
      kind: 'fair',
      passage,
      rule,
      timeline: recordFairBattedBall(
        withPassage,
        rule.decisiveTick,
      ),
    };
  }

  return {
    kind: 'foul',
    passage,
    rule,
    timeline: recordFoulBattedBall(
      withPassage,
      rule.decisiveTick,
      input.buntAttempt,
      null,
    ),
  };
};
