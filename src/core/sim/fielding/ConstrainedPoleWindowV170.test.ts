import { expect, it } from 'vitest';
import { createGroundWallRollingCurveV1 } from './GroundWallRollingCurveV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import type { AeroGroundBallPhysicsV1 } from '../ball/VersionedBattedBallPhysics';

const fixture = () => {
  const profile:AeroGroundBallPhysicsV1 = { kind:'aero_ground_v1', air:{ ticksPerSecond:1e6, integrationStepTicks:4000,
    gravityY:-9.81, aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground:{ ticksPerSecond:1e6,
    gravityMps2:9.81, radiusM:.0366, inertiaRatio:.378, restingVerticalSpeedMps:.15,
    material:{ restitution:.4, slidingFriction:.25, rollingDecelerationMps2:1, normalSpinDecayPerSecond:.5 } } };
  return { initial:{ originTick:100_000, elapsedSeconds:.125, ball:{ tick:225_000,
    position:{ x:0, y:profile.ground.radiusM, z:10 }, velocity:{ x:2, y:0, z:0 },
    spin:{ x:0, y:3, z:-2/profile.ground.radiusM } } }, throughElapsedSeconds:3.125, profile,
    fenceCenter:{ x:0, y:0, z:0 }, nominalContactRadiusMeters:10, maximumCompressionMeters:.002 };
};
const pole = (x:number,z:number) => ({ surfaceId:'authored-pole', center:{ x,z }, radiusM:.1 });

it('proves a positive sub-tick window from the actual arc and leaves all later samples unchanged', () => {
  const input=fixture(), curve=createGroundWallRollingCurveV1(input), before=curve.evaluateAt(.7654321),
    request={ fromElapsedSeconds:.1250002, throughElapsedSeconds:.1250003, poles:[pole(-10,0)] },
    saved=JSON.stringify(request), result=curve.queryNoPoleContactWindowV170(request);
  expect(result.kind).toBe('clear');
  if(result.kind!=='clear')throw Error('positive arc window not proved');
  expect(result.throughElapsedSeconds).toBeGreaterThan(result.fromElapsedSeconds);
  expect(result.minimumGapLowerMeters).toBeGreaterThan(0);
  expect(result.cellsChecked).toBe(1);expect(result.poleCount).toBe(1);
  expect(result.nativeAdmission).toBe(false);
  expect(curve.evaluateAt(.7654321)).toEqual(before);expect(JSON.stringify(request)).toBe(saved);
  expect(Object.isFrozen(request)).toBe(false);expect(Object.isFrozen(request.poles)).toBe(false);
});

it('checks every crossed cell and refuses a later possible collision instead of using a chord', () => {
  const curve=createGroundWallRollingCurveV1(fixture()), result=curve.queryNoPoleContactWindowV170({
    fromElapsedSeconds:.125, throughElapsedSeconds:.325, poles:[pole(.25,10)] });
  expect(result.kind).toBe('unresolved');
  if(result.kind!=='unresolved')throw Error('possible arc collision was omitted');
  expect(result.reason).toBe('separation_not_proved');
  expect(result.interval!.fromElapsedSeconds).toBeGreaterThan(.125);
});

it('refuses overlap, tangency and an interval whose movement bound consumes the separation', () => {
  const input=fixture(), curve=createGroundWallRollingCurveV1(input), fromElapsedSeconds=input.initial.elapsedSeconds;
  for(const x of [0,.1+input.profile.ground.radiusM,.14]) {
    expect(curve.queryNoPoleContactWindowV170({ fromElapsedSeconds,
      throughElapsedSeconds:fromElapsedSeconds+.004, poles:[pole(x,10)] }).kind).toBe('unresolved');
  }
});

it('uses geometry-aware rounding for an off-center large-radius arc rather than its small world coordinates', () => {
  const base=fixture(), radius=1e150, input={ ...base, initial:{ ...base.initial, ball:{ ...base.initial.ball,
    position:{ x:0,y:base.profile.ground.radiusM,z:0 }, velocity:{ x:0,y:0,z:2 },
    spin:{ x:2/base.profile.ground.radiusM,y:0,z:0 } } }, fenceCenter:{ x:radius,y:0,z:0 }, nominalContactRadiusMeters:radius },
    curve=createGroundWallRollingCurveV1(input), result=curve.queryNoPoleContactWindowV170({
      fromElapsedSeconds:.125, throughElapsedSeconds:.129, poles:[pole(1,0)] });
  expect(curve.cells[0].positionRoundingBoundMeters).toBeLessThan(1e-10);
  expect(result.kind).toBe('unresolved');
  expect(result.positionArithmeticBoundMeters).toBeGreaterThan(1e130);
});

it('keeps overflowing numeric budgets and out-of-source windows unresolved', () => {
  const base=fixture(), radius=1e308, huge=createGroundWallRollingCurveV1({ ...base,
    initial:{ ...base.initial, ball:{ ...base.initial.ball, position:{ x:0,y:base.profile.ground.radiusM,z:0 },
      velocity:{ x:0,y:0,z:2 },spin:{ x:2/base.profile.ground.radiusM,y:0,z:0 } } },
    fenceCenter:{ x:radius,y:0,z:0 },nominalContactRadiusMeters:radius });
  expect(huge.queryNoPoleContactWindowV170({ fromElapsedSeconds:.125,throughElapsedSeconds:.129,poles:[pole(1,0)] }).kind).toBe('unresolved');
  const curve=createGroundWallRollingCurveV1(base);
  for(const [fromElapsedSeconds,throughElapsedSeconds] of [[.124,.126],[.125,3.126],[NaN,.126],[.2,.1]])
    expect(curve.queryNoPoleContactWindowV170({ fromElapsedSeconds,throughElapsedSeconds,poles:[pole(-10,0)] }).kind).toBe('unresolved');
});

it('checks all poles, includes a same-time point, and does not claim contact for a failed proof', () => {
  const curve=createGroundWallRollingCurveV1(fixture());
  expect(curve.queryNoPoleContactWindowV170({fromElapsedSeconds:.125,throughElapsedSeconds:.125,poles:[pole(-10,0)]}).kind).toBe('clear');
  const result=curve.queryNoPoleContactWindowV170({fromElapsedSeconds:.125,throughElapsedSeconds:.129,poles:[pole(-10,0),pole(0,10)]});
  expect(result.kind).toBe('unresolved');expect(result).not.toHaveProperty('contacts');
});
