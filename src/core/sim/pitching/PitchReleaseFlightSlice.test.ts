import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
} from '../ball/BaseballAerodynamics';
import {
  REFERENCE_BASEBALL_RIGID_BODY,
} from '../contact/RigidBatBallContact';
import {
  IDENTITY_QUATERNION,
} from './BaseballOrientation';
import {
  simulatePitchReleaseFlightSlice,
} from './PitchReleaseFlightSlice';

const trajectoryParameters = {
  ticksPerSecond: 1_000_000,
  integrationStepTicks: 1_000,
  gravityY: -9.81,
  aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS,
} as const;

const baseRelease = () => ({
  tick: 1_000_000,
  position: {
    x: 0,
    y: 1.8,
    z: 16.5,
  },
  preReleaseVelocity: {
    x: 0,
    y: 0,
    z: -38,
  },
  preReleaseSpin: {
    x: 0,
    y: 0,
    z: 0,
  },
  orientation: IDENTITY_QUATERNION,
  ball: REFERENCE_BASEBALL_RIGID_BODY,
});

describe('pitch release -> aerodynamic flight slice', () => {
  it('feeds finger-generated release state directly into pitch flight', () => {
    const result = simulatePitchReleaseFlightSlice({
      release: {
        ...baseRelease(),
        fingerImpulses: [
          {
            fingerId: 'middle',
            contactDirectionBody: {
              x: 0,
              y: -1,
              z: 0,
            },
            impulseWorldNs: {
              x: 0,
              y: 0,
              z: -0.35,
            },
          },
        ],
      },
      trajectoryParameters,
      endTick: 1_600_000,
      plateZ: 0,
    });

    expect(result.release.state.spin.x)
      .toBeGreaterThan(0);
    expect(result.trajectory.start)
      .toEqual(result.release.state);
    expect(result.trajectory.releaseOrientation)
      .toEqual(result.release.orientation);
    expect(result.plateCrossing)
      .not.toBeNull();
    expect(result.plateCrossing!.orientation)
      .toBeDefined();
  });

  it('lets finger-generated backspin resist drop relative to a torque-cancelled release', () => {
    const noSpin = simulatePitchReleaseFlightSlice({
      release: {
        ...baseRelease(),
        fingerImpulses: [
          {
            fingerId: 'index',
            contactDirectionBody: {
              x: -1,
              y: 0,
              z: 0,
            },
            impulseWorldNs: {
              x: 0,
              y: 0,
              z: -0.2,
            },
          },
          {
            fingerId: 'middle',
            contactDirectionBody: {
              x: 1,
              y: 0,
              z: 0,
            },
            impulseWorldNs: {
              x: 0,
              y: 0,
              z: -0.2,
            },
          },
        ],
      },
      trajectoryParameters,
      endTick: 1_600_000,
      plateZ: 0,
    });

    const backspin = simulatePitchReleaseFlightSlice({
      release: {
        ...baseRelease(),
        fingerImpulses: [
          {
            fingerId: 'index',
            contactDirectionBody: {
              x: 0,
              y: -1,
              z: 0,
            },
            impulseWorldNs: {
              x: 0,
              y: 0,
              z: -0.2,
            },
          },
          {
            fingerId: 'middle',
            contactDirectionBody: {
              x: 0,
              y: -1,
              z: 0,
            },
            impulseWorldNs: {
              x: 0,
              y: 0,
              z: -0.2,
            },
          },
        ],
      },
      trajectoryParameters,
      endTick: 1_600_000,
      plateZ: 0,
    });

    expect(noSpin.release.state.velocity.z)
      .toBeCloseTo(backspin.release.state.velocity.z, 12);
    expect(noSpin.release.state.spin.x)
      .toBeCloseTo(0, 12);
    expect(backspin.release.state.spin.x)
      .toBeGreaterThan(0);
    expect(backspin.plateCrossing!.position.y)
      .toBeGreaterThan(noSpin.plateCrossing!.position.y);
  });

  it('rejects inconsistent ball properties across release and flight', () => {
    expect(() => simulatePitchReleaseFlightSlice({
      release: {
        ...baseRelease(),
        fingerImpulses: [],
      },
      trajectoryParameters: {
        ...trajectoryParameters,
        aerodynamics: {
          ...REFERENCE_BASEBALL_AERODYNAMICS,
          ballMassKg: 0.2,
        },
      },
      endTick: 1_600_000,
      plateZ: 0,
    })).toThrow(
      'pitch release ball mass must match aerodynamic ball mass',
    );
  });

  it('is deterministic end to end', () => {
    const input = {
      release: {
        ...baseRelease(),
        fingerImpulses: [
          {
            fingerId: 'index',
            contactDirectionBody: {
              x: -0.4,
              y: -0.9,
              z: 0,
            },
            impulseWorldNs: {
              x: 0.02,
              y: 0,
              z: -0.21,
            },
          },
          {
            fingerId: 'middle',
            contactDirectionBody: {
              x: 0.4,
              y: -0.9,
              z: 0,
            },
            impulseWorldNs: {
              x: -0.01,
              y: 0,
              z: -0.23,
            },
          },
        ],
      },
      trajectoryParameters,
      endTick: 1_600_000,
      plateZ: 0,
    } as const;

    const a = simulatePitchReleaseFlightSlice(input);
    const b = simulatePitchReleaseFlightSlice(input);

    expect(a).toEqual(b);
  });
});
