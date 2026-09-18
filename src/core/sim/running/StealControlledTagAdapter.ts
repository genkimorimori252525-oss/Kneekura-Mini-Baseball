import {
  createControlledRunnerTagFact,
  type ControlledRunnerTagFact,
} from '../../rules/PhysicalRuleFacts';
import {
  findTagContactTick,
  type TagContactPrimitiveState,
} from '../fielding/TagContact';
import type {
  StealDefenseTimeline,
} from './StealDefenseTimeline';

export type StealControlledTagInput = Readonly<{
  timeline: StealDefenseTimeline;
  defenderId: string;
  runnerId: string;
  taggerPrimitive: TagContactPrimitiveState;
  runnerPrimitive: TagContactPrimitiveState;
  deltaTicks: number;
  ticksPerSecond: number;
}>;

export const createControlledTagFactFromStealDefense = (
  input: StealControlledTagInput,
): ControlledRunnerTagFact | null => {
  if (
    input.taggerPrimitive.tick
    !== input.runnerPrimitive.tick
  ) {
    throw new Error(
      'tagger and runner contact primitives must share the same start tick',
    );
  }
  if (
    input.taggerPrimitive.tick
    < input.timeline.tagActionStartTick
  ) {
    throw new Error(
      'tag contact search must start at or after tagActionStartTick',
    );
  }

  const contactTick = findTagContactTick(
    input.taggerPrimitive,
    input.runnerPrimitive,
    input.deltaTicks,
    {
      ticksPerSecond: input.ticksPerSecond,
    },
  );

  if (contactTick === null) {
    return null;
  }

  if (
    contactTick
    < input.timeline.receiverSecuredPossessionTick
  ) {
    throw new Error(
      'controlled tag contact cannot precede secured receiver possession',
    );
  }

  return createControlledRunnerTagFact(
    input.defenderId,
    input.runnerId,
    contactTick,
  );
};
