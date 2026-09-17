import type { Vec2 } from '../../model/geometry';
import { quantizeEventTick } from '../ExactEventTime';

export type RunnerTouchPointState = Readonly<{
  /**
   * A physical contact point supplied by the runner/body model (foot, hand, etc.).
   * This is intentionally not the runner's center position.
   */
  tick: number;
  position: Vec2;
  velocity: Vec2;
}>;

export type BaseTouchRegion = Readonly<{
  center: Vec2;
  halfSize: Vec2;
  rotationRadians: number;
}>;

export type BaseTouchParameters = Readonly<{
  ticksPerSecond: number;
}>;

const EPSILON = 1e-12;

const validateParameters = (parameters: BaseTouchParameters): void => {
  if (!Number.isInteger(parameters.ticksPerSecond) || parameters.ticksPerSecond <= 0) {
    throw new Error('ticksPerSecond must be a positive integer');
  }
};

const validateBase = (base: BaseTouchRegion): void => {
  if (base.halfSize.x <= 0 || base.halfSize.z <= 0) {
    throw new Error('base halfSize components must be positive');
  }
  if (!Number.isFinite(base.rotationRadians)) {
    throw new Error('base rotationRadians must be finite');
  }
};

const toBaseLocal = (
  value: Vec2,
  rotationRadians: number,
): Vec2 => {
  const cosine = Math.cos(rotationRadians);
  const sine = Math.sin(rotationRadians);
  return {
    x: value.x * cosine + value.z * sine,
    z: -value.x * sine + value.z * cosine,
  };
};

const relativeToBaseCenter = (point: Vec2, base: BaseTouchRegion): Vec2 => ({
  x: point.x - base.center.x,
  z: point.z - base.center.z,
});

const refineSlabInterval = (
  position: number,
  velocity: number,
  halfSize: number,
  entrySeconds: number,
  exitSeconds: number,
): Readonly<{ entrySeconds: number; exitSeconds: number }> | null => {
  if (Math.abs(velocity) <= EPSILON) {
    if (position < -halfSize || position > halfSize) {
      return null;
    }
    return { entrySeconds, exitSeconds };
  }

  const first = (-halfSize - position) / velocity;
  const second = (halfSize - position) / velocity;
  const near = Math.min(first, second);
  const far = Math.max(first, second);
  const refinedEntry = Math.max(entrySeconds, near);
  const refinedExit = Math.min(exitSeconds, far);

  if (refinedEntry - refinedExit > EPSILON) {
    return null;
  }

  return {
    entrySeconds: refinedEntry,
    exitSeconds: refinedExit,
  };
};

export const findBaseTouchTick = (
  runnerPoint: RunnerTouchPointState,
  base: BaseTouchRegion,
  deltaTicks: number,
  parameters: BaseTouchParameters,
): number | null => {
  validateParameters(parameters);
  validateBase(base);
  if (!Number.isSafeInteger(runnerPoint.tick) || runnerPoint.tick < 0) {
    throw new Error('runnerPoint.tick must be a non-negative safe integer tick');
  }
  if (!Number.isInteger(deltaTicks) || deltaTicks < 0) {
    throw new Error('deltaTicks must be a non-negative integer');
  }
  if (!Number.isSafeInteger(runnerPoint.tick + deltaTicks)) {
    throw new Error('base-touch search end tick must be a safe integer');
  }

  const localPosition = toBaseLocal(
    relativeToBaseCenter(runnerPoint.position, base),
    base.rotationRadians,
  );
  const localVelocity = toBaseLocal(
    runnerPoint.velocity,
    base.rotationRadians,
  );
  const durationSeconds = deltaTicks / parameters.ticksPerSecond;

  let interval: Readonly<{ entrySeconds: number; exitSeconds: number }> = {
    entrySeconds: 0,
    exitSeconds: durationSeconds,
  };

  const xInterval = refineSlabInterval(
    localPosition.x,
    localVelocity.x,
    base.halfSize.x,
    interval.entrySeconds,
    interval.exitSeconds,
  );
  if (xInterval === null) {
    return null;
  }
  interval = xInterval;

  const zInterval = refineSlabInterval(
    localPosition.z,
    localVelocity.z,
    base.halfSize.z,
    interval.entrySeconds,
    interval.exitSeconds,
  );
  if (zInterval === null || zInterval.exitSeconds < 0 || zInterval.entrySeconds > durationSeconds) {
    return null;
  }

  const touchSeconds = Math.max(0, zInterval.entrySeconds);
  const touchTick = quantizeEventTick(
    runnerPoint.tick,
    touchSeconds,
    parameters.ticksPerSecond,
  );

  return touchTick - runnerPoint.tick <= deltaTicks ? touchTick : null;
};
