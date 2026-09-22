import assert from 'node:assert/strict';
import { it } from 'vitest';
import { buildRunnerMotionTrajectory } from '../running/RunnerMotion';
import type { RunnerRoute } from '../running/RunnerRoute';
import type { BaseTouchRegion } from '../running/BaseTouch';
import {
  adoptRunnerBaseTouchAtTick,
  forecastRunnerBaseTouch,
} from './PhysicalEventAdoption';

const route: RunnerRoute = {
  segments: [{ kind: 'line', start: { x: 0, z: 0 }, end: { x: 20, z: 0 } }],
};
const base: BaseTouchRegion = {
  center: { x: 5, z: 0 },
  halfSize: { x: 0.2, z: 0.2 },
  rotationRadians: 0,
};
const trajectory = buildRunnerMotionTrajectory(
  { tick: 0, routeDistanceMeters: 0, speedMps: 0, driveDirection: 0, bodyMode: 'upright' },
  { kind: 'advance', issuedTick: 0 },
  2_000_000,
  {
    ticksPerSecond: 1_000_000,
    reactionDelayTicks: 0,
    accelerationMps2: 4,
    brakingMps2: 4,
    slideDecelerationMps2: 5,
    topSpeedMps: 10,
  },
);

const runnerForecast = () => {
  const forecast = forecastRunnerBaseTouch({
    forecastId: 'runner-touch-integrity',
    actionKey: 'runner-action',
    runnerId: 'runner',
    base: 1,
    trajectory,
    route,
    baseRegion: base,
    bodyParameters: { uprightLeadMeters: 0, slideLeadMeters: 0 },
  });
  if (forecast === null) throw new Error('fixture must produce base touch');
  return forecast;
};

it('does not invoke a hostile currentBody getter during exact runner-event adoption', () => {
  const forecast = runnerForecast();
  let called = 0;
  const input: any = {
    forecast,
    currentTick: forecast.dueTick,
  };
  Object.defineProperty(input, 'currentBody', {
    enumerable: true,
    get() {
      called += 1;
      return forecast.expectedBody;
    },
  });

  assert.throws(() => adoptRunnerBaseTouchAtTick(input));
  assert.equal(called, 0);
});

it('does not invoke a hostile forecast getter during exact runner-event adoption', () => {
  const forecast = runnerForecast();
  let called = 0;
  const input: any = {
    currentTick: forecast.dueTick,
    currentBody: forecast.expectedBody,
  };
  Object.defineProperty(input, 'forecast', {
    enumerable: true,
    get() {
      called += 1;
      return forecast;
    },
  });

  assert.throws(() => adoptRunnerBaseTouchAtTick(input));
  assert.equal(called, 0);
});
