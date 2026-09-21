import { describe, expect, it } from 'vitest';
import {
  REALISTIC_BASEBALL_RIGID_BODY,
  measureRigidBatBallContactKinematics,
  type RigidBatState,
} from './RigidBatBallContact';
import {
  WOOD_BAT_CONTACT_RESPONSE_CANDIDATE_VERSION,
  createEvidenceBackedWoodBatContactParameters,
  resolveEvidenceBackedWoodBatBallContact,
  resolveWoodBatNormalRestitution,
} from './WoodBatContactResponse';

const bat: RigidBatState = {
  pose: {
    grip: {
      x: -0.45,
      y: 1,
      z: 0,
    },
    tip: {
      x: 0.45,
      y: 1,
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
    massKg: 0.9,
    centerOfMassT: 0.6,
    transverseMomentOfInertiaKgM2: 0.06,
    axialMomentOfInertiaKgM2: 0.00055,
    radiusProfile: {
      knots: [
        {
          t: 0,
          radiusM: 0.033,
        },
        {
          t: 1,
          radiusM: 0.033,
        },
      ],
    },
  },
};

const pitchAtSpeed = (
  speedMps: number,
) => ({
  tick: 1_000_000,
  position: {
    x: 0.09,
    y: 1,
    z:
      0.033
      + REALISTIC_BASEBALL_RIGID_BODY
        .radiusM
      - 1e-6,
  },
  velocity: {
    x: 0,
    y: 0,
    z: -speedMps,
  },
  spin: {
    x: 0,
    y: 0,
    z: 0,
  },
});

describe('evidence-backed wood bat contact response', () => {
  it('preserves both measured normal-COR endpoints and clamps outside evidence', () => {
    expect(
      resolveWoodBatNormalRestitution(0),
    ).toBeCloseTo(0.63, 12);
    expect(
      resolveWoodBatNormalRestitution(4),
    ).toBeCloseTo(0.63, 12);
    expect(
      resolveWoodBatNormalRestitution(60.8),
    ).toBeCloseTo(0.452, 12);
    expect(
      resolveWoodBatNormalRestitution(100),
    ).toBeCloseTo(0.452, 12);
  });

  it('interpolates only inside the explicit evidence interval', () => {
    const midpoint =
      (4 + 60.8) / 2;

    expect(
      resolveWoodBatNormalRestitution(
        midpoint,
      ),
    ).toBeCloseTo(
      (0.63 + 0.452) / 2,
      12,
    );
  });

  it('combines the wood-bat tangential measurement with explicit friction rather than inventing friction', () => {
    const parameters =
      createEvidenceBackedWoodBatContactParameters({
        relativeImpactSpeedMps: 50,
        frictionCoefficient: 0.2,
      });

    expect(
      parameters.tangentialRestitution,
    ).toBeCloseTo(0.464, 12);
    expect(
      parameters.frictionCoefficient,
    ).toBeCloseTo(0.2, 12);
    expect(
      parameters.normalRestitution,
    ).toBeGreaterThan(0.452);
    expect(
      parameters.normalRestitution,
    ).toBeLessThan(0.63);
  });

  it('rejects friction below the game-speed experimental lower bound', () => {
    expect(() =>
      createEvidenceBackedWoodBatContactParameters({
        relativeImpactSpeedMps: 50,
        frictionCoefficient: 0.149,
      }),
    ).toThrow(
      'wood-bat frictionCoefficient must satisfy the game-speed experimental lower bound',
    );
  });

  it('uses the actual local normal approach speed to select collision elasticity', () => {
    const slowPitch =
      pitchAtSpeed(20);
    const fastPitch =
      pitchAtSpeed(60);

    const slowKinematics =
      measureRigidBatBallContactKinematics(
        slowPitch,
        bat,
        REALISTIC_BASEBALL_RIGID_BODY,
      );
    const fastKinematics =
      measureRigidBatBallContactKinematics(
        fastPitch,
        bat,
        REALISTIC_BASEBALL_RIGID_BODY,
      );

    expect(slowKinematics).not.toBeNull();
    expect(fastKinematics).not.toBeNull();
    expect(
      slowKinematics!
        .normalApproachSpeedMps,
    ).toBeCloseTo(20, 8);
    expect(
      fastKinematics!
        .normalApproachSpeedMps,
    ).toBeCloseTo(60, 8);

    const slow =
      resolveEvidenceBackedWoodBatBallContact(
        slowPitch,
        bat,
        REALISTIC_BASEBALL_RIGID_BODY,
        {
          frictionCoefficient: 0.2,
        },
      );
    const fast =
      resolveEvidenceBackedWoodBatBallContact(
        fastPitch,
        bat,
        REALISTIC_BASEBALL_RIGID_BODY,
        {
          frictionCoefficient: 0.2,
        },
      );

    expect(slow).not.toBeNull();
    expect(fast).not.toBeNull();

    const slowApparentCor =
      slow!.exitVelocity.z / 20;
    const fastApparentCor =
      fast!.exitVelocity.z / 60;

    expect(slowApparentCor)
      .toBeGreaterThan(
        fastApparentCor,
      );
  });

  it('is explicitly versioned as a provisional evidence synthesis', () => {
    expect(
      WOOD_BAT_CONTACT_RESPONSE_CANDIDATE_VERSION,
    ).toBe(
      'wood-bat-contact-evidence-synthesis-v1',
    );
  });
});
