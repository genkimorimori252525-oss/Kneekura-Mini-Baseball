import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../model/geometry';
import {
  DEFAULT_CONTACT_PARAMETERS,
  findBatBallContactTick,
  resolveBatBallContact,
  type BatterSwingState,
  type PitchWorldState,
} from './BatBallContact';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

const pitch = (position: Vec3): PitchWorldState => ({
  tick: 1_463_000,
  position,
  velocity: v(0, -1.5, -35),
  spin: v(0, 0, 0),
});

const swing = (batSpeedZ: number): BatterSwingState => ({
  pose: {
    grip: v(-0.42, 1, 0),
    tip: v(0.42, 1, 0),
  },
  linearVelocity: v(0, 0, batSpeedZ),
  angularVelocity: v(0, 0, 0),
});

const speed = (value: Vec3): number => Math.hypot(value.x, value.y, value.z);

describe('resolveBatBallContact', () => {
  it('returns null when the ball is outside the bat capsule', () => {
    const result = resolveBatBallContact(
      pitch(v(0, 1, 0.25)),
      swing(20),
      DEFAULT_CONTACT_PARAMETERS,
    );

    expect(result).toBeNull();
  });

  it('is deterministic for identical inputs', () => {
    const inputPitch = pitch(v(0.08, 1, 0.06));
    const inputSwing = swing(20);

    const a = resolveBatBallContact(inputPitch, inputSwing, DEFAULT_CONTACT_PARAMETERS);
    const b = resolveBatBallContact(inputPitch, inputSwing, DEFAULT_CONTACT_PARAMETERS);

    expect(a).not.toBeNull();
    expect(a).toEqual(b);
  });

  it('uses the same collision equation for a fast swing and a low-speed bunt', () => {
    const inputPitch = pitch(v(0, 1, 0.06));
    const normalSwing = resolveBatBallContact(
      inputPitch,
      swing(22),
      DEFAULT_CONTACT_PARAMETERS,
    );
    const bunt = resolveBatBallContact(
      inputPitch,
      swing(2),
      DEFAULT_CONTACT_PARAMETERS,
    );

    expect(normalSwing).not.toBeNull();
    expect(bunt).not.toBeNull();
    expect(speed(normalSwing!.exitVelocity)).toBeGreaterThan(speed(bunt!.exitVelocity));
    expect(normalSwing!.tick).toBe(inputPitch.tick);
    expect(bunt!.tick).toBe(inputPitch.tick);
  });

  it('finds contact that begins and ends inside one coarse integration interval', () => {
    const inputPitch: PitchWorldState = {
      tick: 1_463_000,
      position: v(0, 1, 0.2),
      velocity: v(0, 0, -60),
      spin: v(0, 0, 0),
    };
    const inputSwing = swing(0);

    expect(
      resolveBatBallContact(
        {
          ...inputPitch,
          tick: inputPitch.tick + 5_000,
          position: v(0, 1, -0.1),
        },
        inputSwing,
        DEFAULT_CONTACT_PARAMETERS,
      ),
    ).toBeNull();

    expect(
      findBatBallContactTick(inputPitch, inputSwing, 5_000, DEFAULT_CONTACT_PARAMETERS),
    ).toBe(1_465_174);
  });

  it('uses bat translation when refining the authoritative contact tick', () => {
    const inputPitch: PitchWorldState = {
      tick: 1_463_000,
      position: v(0, 1, 0.2),
      velocity: v(0, 0, -35),
      spin: v(0, 0, 0),
    };

    expect(
      findBatBallContactTick(inputPitch, swing(20), 5_000, DEFAULT_CONTACT_PARAMETERS),
    ).toBe(1_465_371);
  });
});
