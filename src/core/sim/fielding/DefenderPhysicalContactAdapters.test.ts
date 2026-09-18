import { describe, expect, it } from 'vitest';
import {
  findAcceleratedSphereContactTick,
} from '../collision/AcceleratedSphereContact';
import {
  findAcceleratedGloveBallContactTick,
  type LiveBallState,
} from './GloveBallContact';
import { findAcceleratedTagContactTick } from './TagContact';
import {
  createGloveContactInputFromDefenderPrimitive,
  createTagContactPrimitiveFromDefenderPrimitive,
} from './DefenderPhysicalContactAdapters';
import type { DefenderPhysicalPrimitiveSegment } from './DefenderPhysicalPrimitive';

const primitive = (
  role: 'glove' | 'tag_hand' | 'body',
  overrides: Partial<DefenderPhysicalPrimitiveSegment> = {},
): DefenderPhysicalPrimitiveSegment => ({
  role,
  radius: 0.5,
  startTick: 1_000_000,
  endTick: 2_000_000,
  ticksPerSecond: 1_000_000,
  startCenter: { x: 0, y: 1, z: 0 },
  startVelocity: { x: 0, y: 0, z: 0 },
  acceleration: { x: 0, y: 0, z: 0 },
  ...overrides,
});

const ball = (
  overrides: Partial<LiveBallState> = {},
): LiveBallState => ({
  tick: 1_000_000,
  position: { x: 2, y: 1, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  spin: { x: 0, y: 0, z: 0 },
  ...overrides,
});

describe('DefenderPhysicalContactAdapters', () => {
  it('lets a reaching glove contact a ball while the defender body origin remains separated', () => {
    const bodyPrimitive = primitive('body', {
      radius: 0.2,
    });
    const glovePrimitive = primitive('glove', {
      acceleration: { x: 2, y: 0, z: 0 },
    });

    const bodyContact = findAcceleratedSphereContactTick(
      {
        tick: bodyPrimitive.startTick,
        center: bodyPrimitive.startCenter,
        velocity: bodyPrimitive.startVelocity,
        acceleration: bodyPrimitive.acceleration,
        radius: bodyPrimitive.radius,
      },
      {
        tick: ball().tick,
        center: ball().position,
        velocity: ball().velocity,
        acceleration: { x: 0, y: 0, z: 0 },
        radius: 0.5,
      },
      bodyPrimitive.endTick - bodyPrimitive.startTick,
      { ticksPerSecond: 1_000_000 },
    );

    const gloveInput = createGloveContactInputFromDefenderPrimitive(
      glovePrimitive,
    );
    const gloveContact = findAcceleratedGloveBallContactTick(
      ball(),
      { x: 0, y: 0, z: 0 },
      gloveInput.glove,
      gloveInput.acceleration,
      gloveInput.deltaTicks,
      {
        ticksPerSecond: 1_000_000,
        ballRadius: 0.5,
        gloveContactRadius: glovePrimitive.radius,
      },
    );

    expect(bodyContact).toBeNull();
    expect(gloveContact).toBe(2_000_000);
  });

  it('preserves composed body plus glove acceleration in the contact adapter', () => {
    const gloveInput = createGloveContactInputFromDefenderPrimitive(
      primitive('glove', {
        startVelocity: { x: 3.5, y: 0.2, z: -1.5 },
        acceleration: { x: 1, y: 6, z: 5 },
      }),
    );

    expect(gloveInput).toEqual({
      glove: {
        tick: 1_000_000,
        position: { x: 0, y: 1, z: 0 },
        velocity: { x: 3.5, y: 0.2, z: -1.5 },
      },
      acceleration: { x: 1, y: 6, z: 5 },
      deltaTicks: 1_000_000,
    });
  });

  it('lets a reaching tag hand contact a runner while the defender body remains separated', () => {
    const bodyPrimitive = createTagContactPrimitiveFromDefenderPrimitive(
      primitive('body', { radius: 0.2 }),
    );
    const tagHand = createTagContactPrimitiveFromDefenderPrimitive(
      primitive('tag_hand', {
        radius: 0.5,
        acceleration: { x: 2, y: 0, z: 0 },
      }),
    );
    const runner = {
      tick: 1_000_000,
      center: { x: 2, y: 1, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      radius: 0.5,
    } as const;

    expect(findAcceleratedTagContactTick(
      bodyPrimitive,
      runner,
      1_000_000,
      { ticksPerSecond: 1_000_000 },
    )).toBeNull();

    expect(findAcceleratedTagContactTick(
      tagHand,
      runner,
      1_000_000,
      { ticksPerSecond: 1_000_000 },
    )).toBe(2_000_000);
  });

  it('rejects using a body or tag-hand primitive as a glove', () => {
    expect(() => createGloveContactInputFromDefenderPrimitive(
      primitive('body'),
    )).toThrow("glove contact requires a 'glove' primitive");

    expect(() => createGloveContactInputFromDefenderPrimitive(
      primitive('tag_hand'),
    )).toThrow("glove contact requires a 'glove' primitive");
  });

  it('rejects using a glove as a tag primitive', () => {
    expect(() => createTagContactPrimitiveFromDefenderPrimitive(
      primitive('glove'),
    )).toThrow("tag contact requires a 'tag_hand' or 'body' primitive");
  });
});
