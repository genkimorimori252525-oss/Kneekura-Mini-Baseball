import { expect, it } from 'vitest';
import { LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { advanceBaseballGroundMotion } from '../../core/sim/ball/BaseballGroundDynamics';
import { BASEBALL_SURFACES_V101 } from '../../core/sim/ball/BaseballSurfaceCalibrationV101';
import { createAeroGroundBallPhysicsProfile } from '../../core/sim/ball/VersionedBattedBallPhysics';
import { createLiveBaseballMatchV1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';

it('uses an explicit provisional grass baseline that stops a 5m/s pure roll within five seconds', () => {
  const p = LIVE_MATCH_PHYSICS_V1.ground, initial = { tick: 0, position: { x: 0, y: p.radiusM, z: 0 },
    velocity: { x: 5, y: 0, z: 0 }, spin: { x: 0, y: 0, z: -5 / p.radiusM } };
  const final = advanceBaseballGroundMotion(initial, 5e6, p);
  expect(final.phase).toBe('resting');
  expect(final.ball.position.x).toBeLessThan(15);
  const split = advanceBaseballGroundMotion(advanceBaseballGroundMotion(initial, 1e6, p).ball, 4e6, p);
  expect(split.ball.position.x).toBeCloseTo(final.ball.position.x, 10);
  expect(final.ball.velocity).toEqual({ x: 0, y: 0, z: 0 });
});

it('keeps explicit legacy/dirt material distinct and validates a park override without changing airborne physics', () => {
  const legacy = createAeroGroundBallPhysicsProfile({ ...LIVE_MATCH_PHYSICS_V1, ground: { ...LIVE_MATCH_PHYSICS_V1.ground, material: BASEBALL_SURFACES_V101.legacy } });
  expect(legacy.ground.material.rollingDecelerationMps2).toBe(.36);
  const input = liveMatchFixture(), host = createLiveBaseballMatchV1({ ...input, park: { fenceRadiusMeters: 110, fenceHeightMeters: 3, groundMaterialV101: BASEBALL_SURFACES_V101.dirt } });
  const record = host.issuePitch({ batting: 'take', pitchType: 'fastball', location: 'auto', managedTeam: 0 });
  const descriptor = (record.play.diagnostics as { sourceDescriptor: { profile: typeof legacy } }).sourceDescriptor;
  expect(descriptor.profile.ground.material).toEqual(BASEBALL_SURFACES_V101.dirt);
  expect(descriptor.profile.air.gravityY).toBe(LIVE_MATCH_PHYSICS_V1.air.gravityY);
  expect(() => createLiveBaseballMatchV1({ ...input, park: { fenceRadiusMeters: 110, fenceHeightMeters: 3,
    groundMaterialV101: { ...BASEBALL_SURFACES_V101.dirt, rollingDecelerationMps2: -1 } } })).toThrow();
});
