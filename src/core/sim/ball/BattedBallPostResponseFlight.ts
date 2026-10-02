import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { BattedBallInitialState } from '../contact/BatBallContact';
import type { BattedBallContactResponse } from './BattedBallContactResponse';
import {
  advanceBallState,
  findGroundContactTick,
  type BallFlightParameters,
} from './BallFlight';

export type BattedBallPostResponseFlightInput = Readonly<{
  response: BattedBallContactResponse;
  parameters: BallFlightParameters;
  searchDurationTicks: number;
}>;

export type BattedBallPostResponseMotion =
  | 'airborne'
  | 'rolling'
  | 'settled';

export type BattedBallPostResponseFlightResult =
  | Readonly<{
      kind: 'flight_projection';
      responseKind: 'ground' | 'rebound';
      startBall: BattedBallInitialState;
      throughTick: number;
      ball: BattedBallInitialState;
      projectedFirstGroundContact: Readonly<{
        tick: number;
        state: BattedBallInitialState;
      }> | null;
      motion: BattedBallPostResponseMotion;
    }>
  | Readonly<{
      kind: 'requires_world_extension';
      throughTick: number;
    }>
  | Readonly<{
      kind: 'requires_acquisition';
      contactTick: number;
      candidateSecureTick: number;
    }>
  | Readonly<{
      kind: 'unresolved';
      reason: 'simultaneous' | 'degenerate_normal';
      tick: number;
    }>;

const EPSILON = 1e-12;

const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

const safeDuration = (value: unknown): value is number =>
  typeof value === 'number'
  && Number.isSafeInteger(value)
  && value >= 0;

const motionAt = (
  ball: BattedBallInitialState,
  parameters: BallFlightParameters,
): BattedBallPostResponseMotion => {
  const grounded = (
    ball.position.y <= parameters.ballRadius + EPSILON
    && Math.abs(ball.velocity.y) <= EPSILON
  );
  if (!grounded) {
    return 'airborne';
  }
  return Math.hypot(ball.velocity.x, ball.velocity.z) <= EPSILON
    ? 'settled'
    : 'rolling';
};

/**
 * Continues only the ball-flight physics owned by an already proven contact response.
 *
 * This is deliberately a projection boundary, not proof that no later actor or venue
 * contact occurred. A later World-geometry owner must clip/confirm this projection before
 * it can establish possession, a pickup, fair/foul finality, OUT/SAFE, PlayEnd or scoring.
 */
export const deriveBattedBallPostResponseFlight = (
  raw: BattedBallPostResponseFlightInput,
): BattedBallPostResponseFlightResult => {
  const input = cloneInert(raw);
  if (!input?.response || !input.parameters || !safeDuration(input.searchDurationTicks)) {
    throw new Error('invalid batted post-response flight input');
  }

  const response = input.response;
  if (response.kind === 'unresolved') {
    const world = response.world;
    return freeze({
      kind: 'unresolved',
      reason: response.reason,
      tick: world.kind === 'contact'
        ? world.tick
        : world.throughTick,
    });
  }

  if (response.kind === 'capture_candidate') {
    if (response.retention.outcome.kind !== 'secured') {
      throw new Error('capture candidate requires secured retention evidence');
    }
    return freeze({
      kind: 'requires_acquisition',
      contactTick: response.retention.outcome.gloveContactTick,
      candidateSecureTick: response.retention.outcome.secureTick,
    });
  }

  if (response.kind === 'airborne') {
    return freeze({
      kind: 'requires_world_extension',
      throughTick: response.world.throughTick,
    });
  }

  const startBall = response.ball;
  if (
    !Number.isSafeInteger(startBall.tick)
    || startBall.tick < 0
    || !Number.isSafeInteger(startBall.tick + input.searchDurationTicks)
  ) {
    throw new Error('batted post-response flight horizon must be a safe integer tick');
  }

  const ball = advanceBallState(
    startBall,
    input.searchDurationTicks,
    input.parameters,
  );
  const groundTick = findGroundContactTick(
    startBall,
    input.searchDurationTicks,
    input.parameters,
  );
  const projectedFirstGroundContact = groundTick === null
    ? null
    : freeze({
        tick: groundTick,
        state: advanceBallState(
          startBall,
          groundTick - startBall.tick,
          input.parameters,
        ),
      });

  return freeze({
    kind: 'flight_projection',
    responseKind: response.kind,
    startBall,
    throughTick: startBall.tick + input.searchDurationTicks,
    ball,
    projectedFirstGroundContact,
    motion: motionAt(ball, input.parameters),
  });
};
