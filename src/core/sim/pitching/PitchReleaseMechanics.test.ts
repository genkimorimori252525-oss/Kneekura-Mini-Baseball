import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BASEBALL_RIGID_BODY,
} from '../contact/RigidBatBallContact';
import {
  IDENTITY_QUATERNION,
  quaternionFromAxisAngle,
} from './BaseballOrientation';
import {
  createPitchFingerImpulseFromForcePulse,
  resolvePitchReleaseMechanics,
} from './PitchReleaseMechanics';

const base = () => ({
  tick: 1_000_000,
  position: { x: 0, y: 1.8, z: 16.5 },
  preReleaseVelocity: { x: 0, y: 0, z: -35 },
  preReleaseSpin: { x: 0, y: 0, z: 0 },
  orientation: IDENTITY_QUATERNION,
  ball: REFERENCE_BASEBALL_RIGID_BODY,
});

describe('pitch release mechanics', () => {
  it('converts measured force-duration pulses into physical impulse', () => {
    const impulse = createPitchFingerImpulseFromForcePulse({
      fingerId: 'middle',
      contactDirectionBody: {
        x: 0,
        y: 1,
        z: 0,
      },
      averageForceWorldN: {
        x: 0,
        y: 0,
        z: -100,
      },
      durationSeconds: 0.005,
    });

    expect(impulse.impulseWorldNs.z)
      .toBeCloseTo(-0.5, 12);
  });

  it('lets symmetric centered finger impulses add speed while cancelling torque', () => {
    const result = resolvePitchReleaseMechanics({
      ...base(),
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
            z: -0.35,
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
            z: -0.35,
          },
        },
      ],
    });

    expect(result.state.velocity.z)
      .toBeLessThan(-35);
    expect(result.state.spin.x)
      .toBeCloseTo(0, 12);
    expect(result.state.spin.y)
      .toBeCloseTo(0, 12);
    expect(result.state.spin.z)
      .toBeCloseTo(0, 12);
  });

  it('creates backspin from an off-center tangential fingertip impulse', () => {
    const result = resolvePitchReleaseMechanics({
      ...base(),
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
            z: -0.4,
          },
        },
      ],
    });

    expect(result.state.spin.x)
      .toBeGreaterThan(0);
  });

  it('makes grip/seam orientation change the torque arm for the same body-space finger placement', () => {
    const impulse = [{
      fingerId: 'index',
      contactDirectionBody: {
        x: 0,
        y: 1,
        z: 0,
      },
      impulseWorldNs: {
        x: 0,
        y: 0,
        z: -0.4,
      },
    }] as const;

    const identity = resolvePitchReleaseMechanics({
      ...base(),
      fingerImpulses: impulse,
    });
    const quarterTurn = resolvePitchReleaseMechanics({
      ...base(),
      orientation: quaternionFromAxisAngle(
        { x: 0, y: 0, z: 1 },
        Math.PI / 2,
      ),
      fingerImpulses: impulse,
    });

    expect(identity.state.spin.x)
      .not.toBeCloseTo(quarterTurn.state.spin.x, 8);
    expect(identity.state.spin.y)
      .not.toBeCloseTo(quarterTurn.state.spin.y, 8);
  });

  it('is deterministic', () => {
    const input = {
      ...base(),
      fingerImpulses: [
        {
          fingerId: 'index',
          contactDirectionBody: {
            x: -0.4,
            y: 0.9,
            z: 0,
          },
          impulseWorldNs: {
            x: 0.02,
            y: -0.01,
            z: -0.25,
          },
        },
        {
          fingerId: 'middle',
          contactDirectionBody: {
            x: 0.4,
            y: 0.9,
            z: 0,
          },
          impulseWorldNs: {
            x: -0.01,
            y: 0.02,
            z: -0.28,
          },
        },
      ],
    } as const;

    const a = resolvePitchReleaseMechanics(input);
    const b = resolvePitchReleaseMechanics(input);

    expect(a).toEqual(b);
  });
});
