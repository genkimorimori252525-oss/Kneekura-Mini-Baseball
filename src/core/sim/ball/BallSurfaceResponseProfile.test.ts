import { describe, expect, it } from 'vitest';
import {
  resolveBallSurfaceResponse,
  validateBallSurfaceResponseProfile,
  type BallSurfaceResponseProfile,
} from './BallSurfaceResponseProfile';

const profile: BallSurfaceResponseProfile = {
  profileId: 'fixture-surface',
  version: 'v1',
  knots: [
    {
      incidentSpeedMps: 20,
      contact: {
        normalRestitution: 0.5,
        tangentialRestitution: 0.2,
        frictionCoefficient: 0.3,
      },
    },
    {
      incidentSpeedMps: 40,
      contact: {
        normalRestitution: 0.3,
        tangentialRestitution: 0.1,
        frictionCoefficient: 0.5,
      },
    },
  ],
};

describe('ball surface response profile', () => {
  it('interpolates speed-dependent reduced-order contact parameters deterministically', () => {
    expect(
      resolveBallSurfaceResponse(
        profile,
        30,
      ),
    ).toEqual({
      normalRestitution: 0.4,
      tangentialRestitution:
        0.15000000000000002,
      frictionCoefficient: 0.4,
    });
  });

  it('clamps outside the calibrated speed range rather than extrapolating silently', () => {
    expect(
      resolveBallSurfaceResponse(
        profile,
        5,
      ),
    ).toEqual(
      profile.knots[0]!.contact,
    );
    expect(
      resolveBallSurfaceResponse(
        profile,
        80,
      ),
    ).toEqual(
      profile.knots[1]!.contact,
    );
  });

  it('requires strictly increasing speed knots', () => {
    expect(() =>
      validateBallSurfaceResponseProfile({
        ...profile,
        knots: [
          profile.knots[1]!,
          profile.knots[0]!,
        ],
      }),
    ).toThrow(
      'surface response speed knots must be finite, positive, and strictly increasing',
    );
  });
});
