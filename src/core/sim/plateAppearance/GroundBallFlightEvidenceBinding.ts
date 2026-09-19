import type {
  BatBallContactResult,
  BattedBallInitialState,
} from '../contact/BatBallContact';
import {
  advanceBallState,
  findGroundContactTick,
  type BallFlightParameters,
} from '../ball/BallFlight';
import type {
  BattedBallFlightEvidence,
} from '../ball/BattedBallFlightEvidence';
import type {
  Vec3,
} from '../../model/geometry';
import type {
  CanonicalPlateAppearanceTimeline,
} from './CanonicalPlateAppearanceTimeline';

const sameVec3 = (
  first: Vec3,
  second: Vec3,
): boolean => (
  first.x === second.x
  && first.y === second.y
  && first.z === second.z
);

const sameContact = (
  first: BatBallContactResult,
  second: BatBallContactResult,
): boolean => (
  first.tick === second.tick
  && sameVec3(first.ballCenter, second.ballCenter)
  && sameVec3(first.point, second.point)
  && sameVec3(first.batPoint, second.batPoint)
  && sameVec3(first.normal, second.normal)
  && first.segmentT === second.segmentT
  && sameVec3(first.exitVelocity, second.exitVelocity)
  && sameVec3(first.exitSpin, second.exitSpin)
);

const sameBallState = (
  first: BattedBallInitialState,
  second: BattedBallInitialState,
): boolean => (
  first.tick === second.tick
  && sameVec3(first.position, second.position)
  && sameVec3(first.velocity, second.velocity)
  && sameVec3(first.spin, second.spin)
);

const initialStateFromContact = (
  contact: BatBallContactResult,
): BattedBallInitialState => ({
  tick: contact.tick,
  position: contact.ballCenter,
  velocity: contact.exitVelocity,
  spin: contact.exitSpin,
});

/**
 * Binds externally carried flight evidence back to the authoritative plate-appearance
 * contact event. The production coordinator may transport previously-computed physical
 * evidence, but callers may not swap in a different contact, initial ball state, or a
 * fabricated first-ground-contact boundary.
 */
export const assertBattedBallFlightEvidenceMatchesTimeline = (
  timeline: CanonicalPlateAppearanceTimeline,
  flight: BattedBallFlightEvidence,
  parameters: BallFlightParameters,
): void => {
  const contactEvent = [...timeline.events]
    .reverse()
    .find((event) => (
      event.kind === 'BatBallContact'
      && event.tick === flight.contact.tick
    ));

  if (
    contactEvent === undefined
    || contactEvent.kind !== 'BatBallContact'
    || !sameContact(
      contactEvent.payload.contact,
      flight.contact,
    )
  ) {
    throw new Error(
      'batted-ball flight evidence must match the authoritative timeline contact',
    );
  }

  const expectedInitial = initialStateFromContact(
    contactEvent.payload.contact,
  );
  if (!sameBallState(expectedInitial, flight.initialBall)) {
    throw new Error(
      'batted-ball flight initial state must derive from the authoritative timeline contact',
    );
  }

  if (flight.firstGroundContact === null) {
    return;
  }

  const deltaTicks = (
    flight.firstGroundContact.tick
    - flight.initialBall.tick
  );
  if (!Number.isSafeInteger(deltaTicks) || deltaTicks < 0) {
    throw new Error(
      'batted-ball first-ground-contact tick must not precede the authoritative contact',
    );
  }

  const expectedGroundTick = findGroundContactTick(
    flight.initialBall,
    deltaTicks,
    parameters,
  );
  if (expectedGroundTick !== flight.firstGroundContact.tick) {
    throw new Error(
      'batted-ball first-ground-contact tick must be the first physical ground contact',
    );
  }

  const expectedState = advanceBallState(
    flight.initialBall,
    deltaTicks,
    parameters,
  );
  if (!sameBallState(
    expectedState,
    flight.firstGroundContact.state,
  )) {
    throw new Error(
      'batted-ball first-ground-contact state must match canonical ball physics',
    );
  }
};