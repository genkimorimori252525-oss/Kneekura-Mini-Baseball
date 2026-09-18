import { describe, expect, it } from 'vitest';
import {
  createDefensiveRatings,
} from '../../model/DefensiveRatings';
import {
  createRunnerBaseTouchFact,
} from '../../rules/PhysicalRuleFacts';
import {
  resolveTagArrival,
} from '../../rules/TagArrivalRule';
import {
  buildStealDefenseTimeline,
} from './StealDefenseTimeline';
import {
  createControlledTagFactFromStealDefense,
} from './StealControlledTagAdapter';

const ratings = (
  transfer: number,
  tagSkill: number,
) => createDefensiveRatings({
  positionSuitability: {
    P: 0.5,
    C: 0.8,
    '1B': 0.5,
    '2B': 0.8,
    '3B': 0.5,
    SS: 0.8,
    LF: 0.5,
    CF: 0.5,
    RF: 0.5,
  },
  firstStep: 0.5,
  acceleration: 0.5,
  battedBallRead: 0.5,
  routeEfficiency: 0.5,
  catching: 0.5,
  transfer,
  armStrength: 0.5,
  throwingAccuracy: 0.5,
  situationalAwareness: 0.5,
  tagSkill,
});

const timeline = buildStealDefenseTimeline({
  pitchCommitmentTick: 1_000_000,
  catcherSecuredPossessionTick: 1_420_000,
  catcherRatings: ratings(0.5, 0.5),
  receiverSecuredPossessionTick: 2_160_000,
  receiverRatings: ratings(0.5, 1),
  transferParameters: {
    minimumTransferDelayTicks: 80_000,
    maximumTransferDelayTicks: 260_000,
    fixedGripOffsetTicks: 20_000,
  },
  tagParameters: {
    minimumTagActionDelayTicks: 30_000,
    maximumTagActionDelayTicks: 140_000,
    fixedPossessionOffsetTicks: 10_000,
  },
});

describe('StealControlledTagAdapter', () => {
  it('creates controlled tag evidence only from physical contact after tag action begins', () => {
    expect(timeline.tagActionStartTick)
      .toBe(2_200_000);

    const fact = createControlledTagFactFromStealDefense({
      timeline,
      defenderId: 'ss',
      runnerId: 'runner',
      taggerPrimitive: {
        tick: 2_200_000,
        center: { x: 0, y: 1, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        radius: 0.04,
      },
      runnerPrimitive: {
        tick: 2_200_000,
        center: { x: 0.2, y: 1, z: 0 },
        velocity: { x: -60, y: 0, z: 0 },
        radius: 0.03,
      },
      deltaTicks: 5_000,
      ticksPerSecond: 1_000_000,
    });

    expect(fact).toEqual({
      kind: 'controlled_runner_tag',
      defenderId: 'ss',
      runnerId: 'runner',
      tick: 2_202_167,
    });
  });

  it('returns null when the physical tag hand never contacts the runner', () => {
    const fact = createControlledTagFactFromStealDefense({
      timeline,
      defenderId: 'ss',
      runnerId: 'runner',
      taggerPrimitive: {
        tick: 2_200_000,
        center: { x: 0, y: 1, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        radius: 0.04,
      },
      runnerPrimitive: {
        tick: 2_200_000,
        center: { x: 0.2, y: 1.2, z: 0 },
        velocity: { x: -60, y: 0, z: 0 },
        radius: 0.03,
      },
      deltaTicks: 5_000,
      ticksPerSecond: 1_000_000,
    });

    expect(fact).toBeNull();
  });

  it('feeds physical tag timing and runner base touch into the existing tag-arrival rule', () => {
    const controlledTag =
      createControlledTagFactFromStealDefense({
        timeline,
        defenderId: 'ss',
        runnerId: 'runner',
        taggerPrimitive: {
          tick: 2_200_000,
          center: { x: 0, y: 1, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
          radius: 0.04,
        },
        runnerPrimitive: {
          tick: 2_200_000,
          center: { x: 0.2, y: 1, z: 0 },
          velocity: { x: -60, y: 0, z: 0 },
          radius: 0.03,
        },
        deltaTicks: 5_000,
        ticksPerSecond: 1_000_000,
      });

    const out = resolveTagArrival({
      runnerId: 'runner',
      targetBase: 2,
      controlledTag,
      runnerTouch: createRunnerBaseTouchFact(
        'runner',
        2,
        2_203_000,
      ),
    });
    expect(out.kind).toBe('out');

    const safe = resolveTagArrival({
      runnerId: 'runner',
      targetBase: 2,
      controlledTag,
      runnerTouch: createRunnerBaseTouchFact(
        'runner',
        2,
        2_201_000,
      ),
    });
    expect(safe.kind).toBe('safe');
  });

  it('rejects contact primitives that start before the tag action is physically available', () => {
    expect(() => createControlledTagFactFromStealDefense({
      timeline,
      defenderId: 'ss',
      runnerId: 'runner',
      taggerPrimitive: {
        tick: 2_199_999,
        center: { x: 0, y: 1, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        radius: 0.04,
      },
      runnerPrimitive: {
        tick: 2_199_999,
        center: { x: 0.2, y: 1, z: 0 },
        velocity: { x: -60, y: 0, z: 0 },
        radius: 0.03,
      },
      deltaTicks: 5_000,
      ticksPerSecond: 1_000_000,
    })).toThrow(
      'tag contact search must start at or after tagActionStartTick',
    );
  });
});
