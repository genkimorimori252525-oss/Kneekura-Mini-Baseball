import { describe, expect, it } from 'vitest';
import {
  CROSS_NATHAN_2006_LOW_SPEED_BAT_CONTACT_FIXTURE,
  calculateRigidBatDirectionalEffectiveMass,
  resolveRigidBatBallContact,
  type RigidBatState,
  type RigidBaseballProperties,
} from './RigidBatBallContact';

const BAT_LENGTH_M = 0.84;
const BARREL_RADIUS_M = 0.0667 / 2;
const IMPACT_FROM_BARREL_END_M = 0.15;
const COM_FROM_BARREL_END_M = 0.265;

const impactT =
  (
    BAT_LENGTH_M
    - IMPACT_FROM_BARREL_END_M
  ) / BAT_LENGTH_M;
const comT =
  (
    BAT_LENGTH_M
    - COM_FROM_BARREL_END_M
  ) / BAT_LENGTH_M;

const bat: RigidBatState = {
  pose: {
    grip: {
      x: 0,
      y: 0,
      z: 0,
    },
    tip: {
      x: BAT_LENGTH_M,
      y: 0,
      z: 0,
    },
  },
  centerOfMassVelocity: {
    x: 0,
    y: 0,
    z: 0,
  },
  angularVelocity: {
    x: 0,
    y: 0,
    z: 0,
  },
  physical: {
    massKg: 0.989,
    centerOfMassT: comT,
    transverseMomentOfInertiaKgM2:
      0.0460,
    axialMomentOfInertiaKgM2:
      4.39e-4,
    radiusProfile: {
      knots: [
        {
          t: 0,
          radiusM:
            BARREL_RADIUS_M,
        },
        {
          t: 1,
          radiusM:
            BARREL_RADIUS_M,
        },
      ],
    },
  },
};

const ball: RigidBaseballProperties = {
  massKg: 0.145,
  radiusM: 0.072 / 2,
  rotationalInertiaFactor: 0.4,
};

const axisX =
  impactT * BAT_LENGTH_M;

const batSurfacePoint = {
  x: axisX,
  y: BARREL_RADIUS_M,
  z: 0,
};

describe('Cross/Nathan 2006 low-speed bat fixture', () => {
  it('reproduces the reported normal bat recoil factor from measured bat mass and inertia', () => {
    const batEffectiveMass =
      calculateRigidBatDirectionalEffectiveMass(
        bat,
        batSurfacePoint,
        {
          x: 0,
          y: 1,
          z: 0,
        },
      );

    const recoilFactor =
      ball.massKg / batEffectiveMass;

    expect(batEffectiveMass)
      .toBeCloseTo(0.770, 2);
    expect(recoilFactor)
      .toBeCloseTo(0.188, 3);
  });

  it('reproduces the reported tangential bat effective-mass recoil factor geometry', () => {
    const batTangentialEffectiveMass =
      calculateRigidBatDirectionalEffectiveMass(
        bat,
        batSurfacePoint,
        {
          x: 0,
          y: 0,
          z: 1,
        },
      );

    const ballTangentialEffectiveMass =
      (
        ball.rotationalInertiaFactor
        / (
          1
          + ball.rotationalInertiaFactor
        )
      ) * ball.massKg;
    const recoilFactor =
      ballTangentialEffectiveMass
      / batTangentialEffectiveMass;

    expect(
      batTangentialEffectiveMass,
    ).toBeCloseTo(0.261, 2);
    expect(recoilFactor)
      .toBeCloseTo(0.159, 3);
  });

  it('turns actual normal COR about 0.63 into apparent normal COR about 0.37 through bat recoil', () => {
    const result =
      resolveRigidBatBallContact(
        {
          tick: 1_000_000,
          position: {
            x: axisX,
            y:
              BARREL_RADIUS_M
              + ball.radiusM
              - 1e-8,
            z: 0,
          },
          velocity: {
            x: 0,
            y: -4,
            z: 0,
          },
          spin: {
            x: 0,
            y: 0,
            z: 0,
          },
        },
        bat,
        ball,
        CROSS_NATHAN_2006_LOW_SPEED_BAT_CONTACT_FIXTURE,
      );

    expect(result).not.toBeNull();

    const apparentNormalCor =
      result!.exitVelocity.y / 4;

    expect(apparentNormalCor)
      .toBeCloseTo(0.375, 2);
  });

  it('makes the apparent tangential COR near zero for the measured low-speed ex and recoil factors', () => {
    const initialTangentialMps = 1;
    const result =
      resolveRigidBatBallContact(
        {
          tick: 1_000_000,
          position: {
            x: axisX,
            y:
              BARREL_RADIUS_M
              + ball.radiusM
              - 1e-8,
            z: 0,
          },
          velocity: {
            x: 0,
            y: -4,
            z: initialTangentialMps,
          },
          spin: {
            x: 0,
            y: 0,
            z: 0,
          },
        },
        bat,
        ball,
        CROSS_NATHAN_2006_LOW_SPEED_BAT_CONTACT_FIXTURE,
      );

    expect(result).not.toBeNull();

    const ballContactLeverArm = {
      x: 0,
      y: -ball.radiusM,
      z: 0,
    };
    const contactTangentialAfter =
      result!.exitVelocity.z
      + (
        result!.exitSpin.x
        * ballContactLeverArm.y
      );

    const apparentTangentialCor =
      -contactTangentialAfter
      / initialTangentialMps;

    expect(apparentTangentialCor)
      .toBeCloseTo(0, 1);
  });
});
