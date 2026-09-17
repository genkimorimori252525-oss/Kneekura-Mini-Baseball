import type { Vec3 } from '../../model/geometry';
import { findMovingSphereContactTick } from '../collision/MovingSphereContact';

export type LiveBallState = Readonly<{
  tick: number;
  position: Vec3;
  velocity: Vec3;
  spin: Vec3;
}>;

export type GloveWorldState = Readonly<{
  tick: number;
  position: Vec3;
  velocity: Vec3;
}>;

export type GloveBallContactParameters = Readonly<{
  ticksPerSecond: number;
  ballRadius: number;
  gloveContactRadius: number;
}>;

const validateParameters = (parameters: GloveBallContactParameters): void => {
  if (!Number.isInteger(parameters.ticksPerSecond) || parameters.ticksPerSecond <= 0) {
    throw new Error('ticksPerSecond must be a positive integer');
  }
  if (parameters.ballRadius <= 0 || parameters.gloveContactRadius <= 0) {
    throw new Error('ballRadius and gloveContactRadius must be positive');
  }
};

export const findGloveBallContactTick = (
  ball: LiveBallState,
  glove: GloveWorldState,
  deltaTicks: number,
  parameters: GloveBallContactParameters,
): number | null => {
  validateParameters(parameters);
  return findMovingSphereContactTick(
    {
      tick: ball.tick,
      center: ball.position,
      velocity: ball.velocity,
      radius: parameters.ballRadius,
    },
    {
      tick: glove.tick,
      center: glove.position,
      velocity: glove.velocity,
      radius: parameters.gloveContactRadius,
    },
    deltaTicks,
    { ticksPerSecond: parameters.ticksPerSecond },
  );
};
