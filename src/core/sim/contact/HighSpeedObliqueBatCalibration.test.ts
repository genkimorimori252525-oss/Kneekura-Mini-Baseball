import { describe, expect, it } from 'vitest';
import {
  REALISTIC_BASEBALL_RIGID_BODY,
} from './RigidBatBallContact';
import {
  resolveBallSurfaceContact,
} from '../ball/BallSurfaceContact';
import {
  NATHAN_2012_HIGH_SPEED_OBLIQUE_WOOD_CONTACT,
  NATHAN_2012_OBLIQUE_WOOD_EVIDENCE,
} from './HighSpeedObliqueBatCalibration';

const impact = (
  angleDegrees: number,
  incomingSpinZ = 0,
) => {
  const speed = 50;
  const angle =
    angleDegrees * Math.PI / 180;

  return resolveBallSurfaceContact({
    tick: 0,
    ballCenter: {
      x: 0,
      y:
        REALISTIC_BASEBALL_RIGID_BODY
          .radiusM,
      z: 0,
    },
    ballVelocity: {
      x: speed * Math.sin(angle),
      y: -speed * Math.cos(angle),
      z: 0,
    },
    ballSpin: {
      x: 0,
      y: 0,
      z: incomingSpinZ,
    },
    ball:
      REALISTIC_BASEBALL_RIGID_BODY,
    surfaceNormal: {
      x: 0,
      y: 1,
      z: 0,
    },
    parameters:
      NATHAN_2012_HIGH_SPEED_OBLIQUE_WOOD_CONTACT,
  });
};

describe('Nathan 2012 high-speed oblique wood contact calibration', () => {
  it('records the fitted high-speed non-slip and gross-slip parameters', () => {
    expect(
      NATHAN_2012_OBLIQUE_WOOD_EVIDENCE,
    ).toMatchObject({
      maximumIncidentSpeedMph: 120,
      nonSlipNormalRestitution: 0.52,
      nonSlipTangentialRestitution: 0.30,
      grossSlipFrictionCoefficient: 0.15,
    });
  });

  it('meets the overspin tangential target at a moderate incident angle', () => {
    const result = impact(20);

    expect(result).not.toBeNull();
    expect(result!.tangentialTargetMet)
      .toBe(true);

    const before =
      result!.relativeSurfaceVelocityBefore.x;
    const after =
      result!.relativeSurfaceVelocityAfter.x;

    expect(after)
      .toBeCloseTo(
        -0.30 * before,
        8,
      );
  });

  it('naturally transitions to friction-limited gross slip for a steep oblique impact', () => {
    const result = impact(45);

    expect(result).not.toBeNull();
    expect(result!.tangentialTargetMet)
      .toBe(false);

    const tangentialImpulse =
      Math.hypot(
        result!.tangentialImpulseNs.x,
        result!.tangentialImpulseNs.y,
        result!.tangentialImpulseNs.z,
      );

    expect(
      tangentialImpulse
      / result!.normalImpulseNs,
    ).toBeCloseTo(0.15, 8);
  });

  it('keeps final contact response strongly governed by the fitted tangential COR rather than simply retaining incoming spin', () => {
    const noSpin = impact(20, 0);
    const incomingSpin = impact(
      20,
      -100,
    );

    expect(noSpin).not.toBeNull();
    expect(incomingSpin).not.toBeNull();

    const noSpinRatio =
      noSpin!
        .relativeSurfaceVelocityAfter.x
      / noSpin!
        .relativeSurfaceVelocityBefore.x;
    const spinRatio =
      incomingSpin!
        .relativeSurfaceVelocityAfter.x
      / incomingSpin!
        .relativeSurfaceVelocityBefore.x;

    expect(noSpinRatio)
      .toBeCloseTo(-0.30, 8);
    expect(spinRatio)
      .toBeCloseTo(-0.30, 8);
  });
});
