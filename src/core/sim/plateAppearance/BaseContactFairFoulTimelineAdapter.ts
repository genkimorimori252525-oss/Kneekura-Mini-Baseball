import {
  resolveFirstThirdBaseContactFairBall,
  type FirstThirdBaseContactFairBallResult,
} from '../../rules/FairFoulBaseContactRule';
import {
  findFirstRollingBattedBallFirstThirdBaseContact,
  type BattedBallBasePrism,
  type RollingBattedBallBaseContactEvidence,
} from '../ball/BattedBallBaseContact';
import type {
  BallFlightParameters,
} from '../ball/BallFlight';
import type {
  BattedBallFlightEvidence,
} from '../ball/BattedBallFlightEvidence';
import {
  classifyPointBeyondFirstThirdBaseGates,
  type FairFoulBaseGateGeometry,
} from '../ball/FairFoulBaseGateGeometry';
import {
  recordBattedBallFirstThirdBaseContact,
  recordFairBattedBall,
  type CanonicalPlateAppearanceTimeline,
} from './CanonicalPlateAppearanceTimeline';

export type BaseContactFairFoulTimelineInput = Readonly<{
  timeline: CanonicalPlateAppearanceTimeline;
  flight: BattedBallFlightEvidence;
  baseGates: FairFoulBaseGateGeometry;
  firstBasePrism: BattedBallBasePrism;
  thirdBasePrism: BattedBallBasePrism;
  searchDurationTicks: number;
  ballFlightParameters: BallFlightParameters;
  noPriorFielderTouch: true;
}>;

export type BaseContactFairFoulTimelineResult =
  | Readonly<{
      kind: 'fair_base_contact';
      timeline: CanonicalPlateAppearanceTimeline;
      contact: RollingBattedBallBaseContactEvidence;
      rule: FirstThirdBaseContactFairBallResult;
    }>
  | Readonly<{
      kind: 'no_base_contact';
      timeline: CanonicalPlateAppearanceTimeline;
    }>;

const POSITION_TOLERANCE = 1e-9;

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

const sameVec2Within = (
  first: Readonly<{ x: number; z: number }>,
  second: Readonly<{ x: number; z: number }>,
): boolean => (
  Math.abs(first.x - second.x) <= POSITION_TOLERANCE
  && Math.abs(first.z - second.z) <= POSITION_TOLERANCE
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
      'rolling base-contact fair/foul resolution requires first-ground contact evidence',
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

const validateBaseGeometryAgreement = (
  input: BaseContactFairFoulTimelineInput,
): void => {
  if (
    !sameVec2Within(
      input.firstBasePrism.region.center,
      input.baseGates.firstBase,
    )
    || !sameVec2Within(
      input.thirdBasePrism.region.center,
      input.baseGates.thirdBase,
    )
  ) {
    throw new Error(
      'base prisms must be centered on the first/third-base gate coordinates',
    );
  }
};

export const resolveAndRecordRollingFirstThirdBaseContact = (
  input: BaseContactFairFoulTimelineInput,
): BaseContactFairFoulTimelineResult => {
  if (input.timeline.status.kind !== 'batted_ball_pending') {
    throw new Error(
      'rolling base-contact fair/foul resolution requires a pending batted ball',
    );
  }
  if (input.noPriorFielderTouch !== true) {
    throw new Error(
      'rolling base-contact fair/foul resolution requires no prior fielder touch',
    );
  }
  if (
    input.timeline.events.some(
      (event) => event.kind === 'BattedBallFirstFielderTouch',
    )
  ) {
    throw new Error(
      'rolling base-contact fair/foul resolution requires no prior fielder-touch event',
    );
  }

  validateFlightMatchesTimeline(
    input.timeline,
    input.flight,
  );
  validateBaseGeometryAgreement(input);

  const firstGround = input.flight.firstGroundContact;
  if (firstGround === null) {
    throw new Error(
      'rolling base-contact fair/foul resolution requires first-ground contact evidence',
    );
  }

  const firstGroundBeyond =
    classifyPointBeyondFirstThirdBaseGates(
      input.baseGates,
      {
        x: firstGround.state.position.x,
        z: firstGround.state.position.z,
      },
    );
  if (
    firstGroundBeyond.firstBase
    || firstGroundBeyond.thirdBase
  ) {
    throw new Error(
      'rolling base-contact fair/foul resolution requires first ground contact before both base gates',
    );
  }

  const contact =
    findFirstRollingBattedBallFirstThirdBaseContact({
      flight: input.flight,
      firstBasePrism: input.firstBasePrism,
      thirdBasePrism: input.thirdBasePrism,
      searchDurationTicks: input.searchDurationTicks,
      parameters: input.ballFlightParameters,
    });

  if (contact === null) {
    return {
      kind: 'no_base_contact',
      timeline: input.timeline,
    };
  }

  const withContact =
    recordBattedBallFirstThirdBaseContact(
      input.timeline,
      contact,
    );
  const rule = resolveFirstThirdBaseContactFairBall(
    contact,
  );

  return {
    kind: 'fair_base_contact',
    contact,
    rule,
    timeline: recordFairBattedBall(
      withContact,
      rule.decisiveTick,
    ),
  };
};
