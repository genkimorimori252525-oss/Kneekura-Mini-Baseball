import { describe, expect, it } from 'vitest';
import type { PlayerPerceivedWorldState } from '../perception/PlayerPerceivedWorldState';
import {
  findAcceleratedGloveBallContactTick,
  type LiveBallState,
} from './GloveBallContact';
import {
  createGloveContactInputFromDefenderPrimitive,
} from './DefenderPhysicalContactAdapters';
import type { DefenderBodyKinematicsSegment } from './DefenderBodyKinematics';
import {
  composeDefenderPhysicalPrimitiveSegment,
} from './DefenderPhysicalPrimitive';
import {
  planGloveReachPoseSegment,
  type GloveReachExecutionParameters,
  type GloveReachState,
} from './GloveReachExecution';
import {
  assessPerceivedGloveTarget,
  type PerceivedGloveTargetParameters,
} from './PerceivedGloveTarget';

const body: DefenderBodyKinematicsSegment = {
  startTick: 1_000_000,
  endTick: 1_500_000,
  ticksPerSecond: 1_000_000,
  startPosition: { x: 0, y: 1, z: 0 },
  startVelocity: { x: 0, y: 0, z: 0 },
  acceleration: { x: 0, y: 0, z: 0 },
};

const actualBall: LiveBallState = {
  tick: 1_000_000,
  position: { x: 1, y: 1, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  spin: { x: 0, y: 0, z: 0 },
};

const perceivedWorld = (
  perceivedZ: number,
): PlayerPerceivedWorldState<null> => ({
  observerId: 'shortstop',
  observationTime: 1_000_000,
  attention: {
    target: { kind: 'ball' },
    focusedSinceTick: 900_000,
  },
  ball: {
    estimate: {
      position: { x: 1, y: 1, z: perceivedZ },
      velocity: { x: 0, y: 0, z: 0 },
    },
    sourceObservedAt: 990_000,
    predictedAt: 1_000_000,
    confidence: 0.9,
  },
  players: [],
  communications: [],
  knownContext: null,
});

const targetParameters: PerceivedGloveTargetParameters = {
  minimumBallConfidence: 0.5,
  maximumReachMeters: 1.2,
};

const reachParameters: GloveReachExecutionParameters = {
  gloveRadiusMeters: 0.05,
  maxRelativeReachSpeedMps: 3,
  maxRelativeReachAccelerationMps2: 8,
};

const initialGlove: GloveReachState = {
  tick: 1_000_000,
  offset: { x: 0.5, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
};

const buildGlove = (
  world: PlayerPerceivedWorldState<null>,
) => {
  const assessment = assessPerceivedGloveTarget(
    world,
    body,
    1_500_000,
    targetParameters,
  );
  expect(assessment).not.toBeNull();

  const pose = planGloveReachPoseSegment(
    initialGlove,
    assessment!,
    reachParameters,
  );
  expect(pose).not.toBeNull();

  return composeDefenderPhysicalPrimitiveSegment(body, pose!);
};

describe('perception-driven glove reach physical vertical slice', () => {
  it('turns perception error into a physical miss without changing canonical ball truth', () => {
    const accurateGlove = buildGlove(perceivedWorld(0));
    const offsetGlove = buildGlove(perceivedWorld(0.4));

    expect(accurateGlove.acceleration).toEqual({ x: 4, y: 0, z: 0 });
    expect(offsetGlove.acceleration.x).toBeCloseTo(4, 12);
    expect(offsetGlove.acceleration.z).toBeCloseTo(3.2, 12);

    const contactFor = (
      glovePrimitive: typeof accurateGlove,
    ): number | null => {
      const input = createGloveContactInputFromDefenderPrimitive(
        glovePrimitive,
      );

      return findAcceleratedGloveBallContactTick(
        actualBall,
        { x: 0, y: 0, z: 0 },
        input.glove,
        input.acceleration,
        input.deltaTicks,
        {
          ticksPerSecond: 1_000_000,
          ballRadius: 0.05,
          gloveContactRadius: 0.05,
        },
      );
    };

    expect(contactFor(accurateGlove)).toBe(1_447_214);
    expect(contactFor(offsetGlove)).toBeNull();

    expect(actualBall).toEqual({
      tick: 1_000_000,
      position: { x: 1, y: 1, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      spin: { x: 0, y: 0, z: 0 },
    });
  });
});
