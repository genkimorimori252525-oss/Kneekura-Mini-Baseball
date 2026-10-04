import { expect, it } from 'vitest';
import { createPlayerLocomotionCalibration } from './PlayerLocomotionCalibration';
import { playerLocomotionCalibrationFixture as fixture } from './PlayerLocomotionCalibrationFixtures.test-support';
import { deriveRatedDefenderMotionParameters, planRatedDefenderRoute } from './DefensiveRatingAdapters';
import { buildDefenderMotionTrajectory } from './DefenderMotion';
import { createDefensiveRatings } from '../../model/DefensiveRatings';

it('owns detached immutable explicit locomotion calibration with no clock, duplicated ability or ignored acceleration', () => {
  const raw = fixture(), value = createPlayerLocomotionCalibration(raw);
  expect(value).toEqual(raw); expect(value).not.toBe(raw);
  expect(value.accelerationRatingCalibration).not.toBe(raw.accelerationRatingCalibration);
  expect(value.routeCalibration).not.toBe(raw.routeCalibration);
  expect(Object.isFrozen(value)).toBe(true);
  expect(Object.isFrozen(value.accelerationRatingCalibration)).toBe(true);
  expect(Object.isFrozen(value.routeCalibration)).toBe(true);
  (raw.accelerationRatingCalibration as { highestAbilityAccelerationMps2: number }).highestAbilityAccelerationMps2 = 999;
  expect(value.accelerationRatingCalibration.highestAbilityAccelerationMps2).toBe(6);
  expect(Object.keys(value).sort()).toEqual(['accelerationRatingCalibration', 'arrivalRadiusMeters', 'brakingMps2',
    'maxIntegrationStepTicks', 'preferredSide', 'routeCalibration', 'topSpeedMps']);
});
it('feeds existing motion and route consumers while acceleration and route-efficiency remain independent', () => {
  const c = createPlayerLocomotionCalibration(fixture());
  const ratings = createDefensiveRatings({ positionSuitability: { P: 0.5, C: 0.5, '1B': 0.5, '2B': 0.5,
    '3B': 0.5, SS: 0.5, LF: 0.5, CF: 0.5, RF: 0.5 }, firstStep: 0.5, acceleration: 0.25, battedBallRead: 0.5,
    routeEfficiency: 0.75, catching: 0.5, transfer: 0.5, armStrength: 0.5, throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 });
  const parameters = deriveRatedDefenderMotionParameters({ ticksPerSecond: 1000,
    maxIntegrationStepTicks: c.maxIntegrationStepTicks, accelerationMps2: c.accelerationRatingCalibration.lowestAbilityAccelerationMps2,
    brakingMps2: c.brakingMps2, topSpeedMps: c.topSpeedMps, arrivalRadiusMeters: c.arrivalRadiusMeters }, ratings, c.accelerationRatingCalibration);
  expect(parameters.accelerationMps2).toBe(3);
  const route = planRatedDefenderRoute({ start: { x: 0, z: 0 }, target: { x: 10, z: 0 }, ratings,
    preferredSide: c.preferredSide, calibration: c.routeCalibration });
  expect(route.waypoints).toEqual([{ x: 5, z: 1 }, { x: 10, z: 0 }]);
  const [step] = buildDefenderMotionTrajectory({ tick: 100, position: route.start, velocity: { x: 0, z: 0 } }, route.waypoints[0], 10, parameters);
  expect(step.endTick).toBe(110); expect(Math.hypot(step.acceleration.x, step.acceleration.z)).toBeCloseTo(3);
  expect(planRatedDefenderRoute({ start: route.start, target: route.target, ratings: { ...ratings, acceleration: 1 },
    preferredSide: -1, calibration: c.routeCalibration }).waypoints[0]).toEqual({ x: 5, z: -1 });
  expect(deriveRatedDefenderMotionParameters(parameters, { ...ratings, routeEfficiency: 0 }, c.accelerationRatingCalibration)).toEqual(parameters);
});
const paths = [
  ['accelerationRatingCalibration', 'lowestAbilityAccelerationMps2'], ['accelerationRatingCalibration', 'highestAbilityAccelerationMps2'],
  ['brakingMps2'], ['topSpeedMps'], ['arrivalRadiusMeters'], ['maxIntegrationStepTicks'], ['routeCalibration', 'maximumLateralDetourMeters'], ['preferredSide'],
];
const edit = (path: string[], value: unknown, remove = false) => {
  const raw = fixture(); let parent = raw as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
  if (remove) delete parent[path.at(-1)!]; else parent[path.at(-1)!] = value;
  return raw;
};
it.each(paths)('requires every explicit finite numeric parameter: %j', (...path) => {
  expect(() => createPlayerLocomotionCalibration(edit(path, null, true))).toThrow();
  for (const value of [NaN, Infinity, -Infinity, '0', null, undefined]) expect(() => createPlayerLocomotionCalibration(edit(path, value))).toThrow();
});
it.each(paths.slice(0, -1))('rejects negative locomotion calibration %j', (...path) => {
  expect(() => createPlayerLocomotionCalibration(edit(path, -1))).toThrow();
});
it.each(paths.slice(0, 4))('requires positive acceleration, braking and speed %j', (...path) => {
  expect(() => createPlayerLocomotionCalibration(edit(path, 0))).toThrow();
});
it.each([0, 0.5, Number.MAX_SAFE_INTEGER + 1])('requires positive safe integration ticks %s', (value) => {
  expect(() => createPlayerLocomotionCalibration(edit(['maxIntegrationStepTicks'], value))).toThrow();
});
it.each([0, 2, -2, 0.5])('requires explicit route side -1 or 1: %s', (value) => {
  expect(() => createPlayerLocomotionCalibration(edit(['preferredSide'], value))).toThrow();
});
it('rejects inverted acceleration range', () => {
  expect(() => createPlayerLocomotionCalibration(edit(['accelerationRatingCalibration', 'lowestAbilityAccelerationMps2'], 7))).toThrow();
});
it('accepts legitimate domain boundaries without arbitrary magnitude caps or invented consumption clocks', () => {
  const raw = { ...fixture(), accelerationRatingCalibration: { lowestAbilityAccelerationMps2: Number.MIN_VALUE, highestAbilityAccelerationMps2: Number.MAX_VALUE },
    brakingMps2: Number.MAX_VALUE, topSpeedMps: Number.MIN_VALUE, arrivalRadiusMeters: 0, maxIntegrationStepTicks: Number.MAX_SAFE_INTEGER,
    routeCalibration: { maximumLateralDetourMeters: 0 }, preferredSide: -1 as const };
  expect(createPlayerLocomotionCalibration(raw)).toEqual(raw);
  expect(createPlayerLocomotionCalibration({ ...raw, accelerationRatingCalibration: { lowestAbilityAccelerationMps2: 2, highestAbilityAccelerationMps2: 2 } })
    .accelerationRatingCalibration).toEqual({ lowestAbilityAccelerationMps2: 2, highestAbilityAccelerationMps2: 2 });
});
it.each(['', 'accelerationRatingCalibration', 'routeCalibration'])('rejects inexact or executable calibration at %s without calling getters', (group) => {
  for (const kind of ['extra', 'missing', 'alias', 'array', 'getter', 'symbol', 'hidden', 'inherited', 'cycle']) {
    const raw = fixture(); let called = false;
    const target = (group ? (raw as unknown as Record<string, unknown>)[group] : raw) as Record<string, unknown>;
    const key = Object.keys(target)[0];
    if (kind === 'extra') target.ticksPerSecond = 1000;
    if (kind === 'missing') delete target[key];
    if (kind === 'alias') { const alias = Object.keys(target).sort().join('|') + '|unexpected'; Object.keys(target).forEach((k) => delete target[k]); target[alias] = 0; }
    if (kind === 'getter') Object.defineProperty(target, key, { enumerable: true, get() { called = true; return 1; } });
    if (kind === 'symbol') Object.assign(target, { [Symbol('hidden')]: 1 });
    if (kind === 'hidden') Object.defineProperty(target, 'hidden', { value: 1 });
    if (kind === 'cycle') target.cycle = raw;
    const value = kind === 'inherited' ? Object.assign(Object.create({ hidden: true }), target) : kind === 'array' ? [] : target;
    expect(() => createPlayerLocomotionCalibration((group ? { ...raw, [group]: value } : value) as never)).toThrow();
    expect(called).toBe(false);
  }
});
it.each(['accelerationMps2', 'ticksPerSecond', 'ratings', 'maximumReachMeters', 'minimumTargetErrorMeters', 'communicationTrust', 'routeProgress'])('does not accept unused or separately owned %s', (key) => {
  expect(() => createPlayerLocomotionCalibration({ ...fixture(), [key]: 1 })).toThrow();
});
it('consumes explicit braking, speed, arrival radius and integration limit through existing motion arithmetic', () => {
  const c = createPlayerLocomotionCalibration(fixture());
  const parameters = { ticksPerSecond: 1000, maxIntegrationStepTicks: c.maxIntegrationStepTicks,
    accelerationMps2: c.accelerationRatingCalibration.lowestAbilityAccelerationMps2,
    brakingMps2: c.brakingMps2, topSpeedMps: c.topSpeedMps, arrivalRadiusMeters: c.arrivalRadiusMeters };
  const moving = { tick: 100, position: { x: 0, z: 0 }, velocity: { x: 1, z: 0 } };
  const hold = buildDefenderMotionTrajectory(moving, null, 10, parameters);
  const arrived = buildDefenderMotionTrajectory(moving, { x: 0.1, z: 0 }, 10, parameters);
  expect(hold[0].acceleration.x).toBeCloseTo(-8); expect(arrived[0].acceleration).toEqual(hold[0].acceleration);
  expect(buildDefenderMotionTrajectory(moving, { x: 100, z: 0 }, 25, parameters).map((step) => step.endTick - step.startTick))
    .toEqual([10, 10, 5]);
  const atTopSpeed = { ...moving, velocity: { x: c.topSpeedMps, z: 0 } };
  expect(buildDefenderMotionTrajectory(atTopSpeed, { x: 100, z: 0 }, 10, parameters)[0].acceleration).toEqual({ x: 0, z: 0 });
});
