import { describe, expect, it } from 'vitest';
import {
  REALISTIC_BASEBALL_RIGID_BODY,
  type RigidBatState,
} from './RigidBatBallContact';
import {
  WOOD_BAT_BBCOR_REFERENCE,
  WOOD_BAT_GAME_SPEED_MAX_MPS,
  WOOD_BAT_GAME_SPEED_MIN_MPS,
  createWoodBatGameSpeedContactCandidate,
  resolveWoodBatGameSpeedBallContact,
  resolveWoodBatGameSpeedNormalRestitution,
} from './WoodBatGameSpeedResponse';

describe('wood bat game-speed response', () => {
  it('preserves the measured 60.8 m/s wood-bat anchor', () => {
    expect(
      resolveWoodBatGameSpeedNormalRestitution(
        60.8,
      ),
    ).toBeCloseTo(
      WOOD_BAT_BBCOR_REFERENCE
        .normalRestitution,
      12,
    );
  });

  it('decreases restitution with impact speed inside the evidence-supported high-speed range', () => {
    const slow =
      resolveWoodBatGameSpeedNormalRestitution(
        33,
      );
    const fast =
      resolveWoodBatGameSpeedNormalRestitution(
        67,
      );

    expect(slow).toBeGreaterThan(fast);
    expect(slow).toBeCloseTo(
      0.5004607718441699,
      12,
    );
    expect(fast).toBeCloseTo(
      0.4447437949875647,
      12,
    );
  });

  it('clamps rather than extrapolates beyond the measured high-speed regime', () => {
    expect(
      resolveWoodBatGameSpeedNormalRestitution(
        1,
      ),
    ).toBeCloseTo(
      resolveWoodBatGameSpeedNormalRestitution(
        WOOD_BAT_GAME_SPEED_MIN_MPS,
      ),
      12,
    );
    expect(
      resolveWoodBatGameSpeedNormalRestitution(
        100,
      ),
    ).toBeCloseTo(
      resolveWoodBatGameSpeedNormalRestitution(
        WOOD_BAT_GAME_SPEED_MAX_MPS,
      ),
      12,
    );
  });

  it('uses actual local impact speed when resolving a physical wood-bat collision', () => {
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
    const ball =
      REALISTIC_BASEBALL_RIGID_BODY;

    const collision = (
      speed: number,
    ) =>
      resolveWoodBatGameSpeedBallContact(
        {
          tick: 0,
          position: {
            x: 0,
            y: 1,
            z:
              0.033
              + ball.radiusM
              - 1e-8,
          },
          velocity: {
            x: 0,
            y: 0,
            z: -speed,
          },
          spin: {
            x: 0,
            y: 0,
            z: 0,
          },
        },
        bat,
        ball,
      );

    const slow = collision(35);
    const fast = collision(65);

    expect(slow).not.toBeNull();
    expect(fast).not.toBeNull();

    const slowApparent =
      slow!.exitVelocity.z / 35;
    const fastApparent =
      fast!.exitVelocity.z / 65;

    expect(slowApparent)
      .toBeGreaterThan(
        fastApparent,
      );
  });

  it('combines high-speed normal response with swinging-wood tangential evidence and conservative friction', () => {
    const candidate =
      createWoodBatGameSpeedContactCandidate({
        relativeImpactSpeedMps: 50,
      });

    expect(
      candidate.normalRestitution,
    ).toBeCloseTo(
      0.466975429949152,
      12,
    );
    expect(
      candidate.tangentialRestitution,
    ).toBeCloseTo(0.464, 12);
    expect(
      candidate.frictionCoefficient,
    ).toBeCloseTo(0.15, 12);
  });
});
