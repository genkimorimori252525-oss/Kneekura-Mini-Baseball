import { describe, expect, it } from 'vitest';
import {
  adaptRigidBatBallContactToCanonicalContact,
} from './RigidBatContactCanonicalAdapter';
import type {
  RigidBatBallContactResult,
} from '../contact/RigidBatBallContact';

describe('rigid bat contact canonical adapter', () => {
  it('reconstructs the legacy bat-axis point from rigid surface geometry without changing physics', () => {
    const rigid: RigidBatBallContactResult = {
      tick: 123,
      ballCenter: {
        x: 1,
        y: 2,
        z: 3,
      },
      segmentT: 0.7,
      localBatRadiusM: 0.033,
      normal: {
        x: 0,
        y: 1,
        z: 0,
      },
      batSurfacePoint: {
        x: 0.4,
        y: 1.033,
        z: 0,
      },
      ballSurfacePoint: {
        x: 0.4,
        y: 1.033,
        z: 0,
      },
      normalRelativeSpeedBeforeMps: -50,
      tangentialRelativeSpeedBeforeMps: 4,
      normalImpulseNs: 1,
      tangentialImpulseNs: {
        x: 0.1,
        y: 0,
        z: 0,
      },
      totalImpulseNs: {
        x: 0.1,
        y: 1,
        z: 0,
      },
      effectiveNormalMassKg: 0.12,
      batNormalEffectiveMassKg: 0.8,
      normalEffectiveMassSource: 'rigid_body',
      batRecoilModel: 'rigid_body',
      exitVelocity: {
        x: 10,
        y: 15,
        z: 20,
      },
      exitSpin: {
        x: 100,
        y: 0,
        z: 0,
      },
      batExitCenterOfMassVelocity: {
        x: 0,
        y: 0,
        z: 0,
      },
      batExitAngularVelocity: {
        x: 0,
        y: 0,
        z: 0,
      },
    };

    const canonical =
      adaptRigidBatBallContactToCanonicalContact(
        rigid,
      );

    expect(canonical.tick).toBe(123);
    expect(canonical.ballCenter)
      .toEqual(rigid.ballCenter);
    expect(canonical.point)
      .toEqual(rigid.batSurfacePoint);
    expect(canonical.batPoint.x)
      .toBeCloseTo(0.4, 12);
    expect(canonical.batPoint.y)
      .toBeCloseTo(1, 12);
    expect(canonical.batPoint.z)
      .toBeCloseTo(0, 12);
    expect(canonical.exitVelocity)
      .toEqual(rigid.exitVelocity);
    expect(canonical.exitSpin)
      .toEqual(rigid.exitSpin);
  });
});
