import type {
  BaseballBase,
  ControlledRunnerTagFact,
  RunnerBaseTouchFact,
} from './PhysicalRuleFacts';

export type TagArrivalInput = Readonly<{
  runnerId: string;
  targetBase: BaseballBase;
  controlledTag: ControlledRunnerTagFact | null;
  runnerTouch: RunnerBaseTouchFact | null;
}>;

export type TagArrivalResult =
  | Readonly<{
    kind: 'out';
    runnerId: string;
    classification: 'time_play';
    outTick: number;
    targetBase: BaseballBase;
    tagTick: number;
    runnerTouchTick: number;
  }>
  | Readonly<{
    kind: 'safe';
    runnerId: string;
    targetBase: BaseballBase;
    touchTick: number;
    tagTick: number;
  }>
  | Readonly<{
    kind: 'simultaneous';
    runnerId: string;
    targetBase: BaseballBase;
    tick: number;
  }>
  | Readonly<{
    kind: 'unresolved';
    runnerId: string;
    targetBase: BaseballBase;
    reason: 'missing_controlled_tag' | 'missing_runner_touch';
  }>;

export const resolveTagArrival = (
  input: TagArrivalInput,
): TagArrivalResult => {
  if (input.controlledTag === null) {
    return {
      kind: 'unresolved',
      runnerId: input.runnerId,
      targetBase: input.targetBase,
      reason: 'missing_controlled_tag',
    };
  }

  if (input.runnerTouch === null) {
    return {
      kind: 'unresolved',
      runnerId: input.runnerId,
      targetBase: input.targetBase,
      reason: 'missing_runner_touch',
    };
  }

  if (input.controlledTag.runnerId !== input.runnerId) {
    throw new Error('controlled tag must belong to the evaluated runner');
  }
  if (input.runnerTouch.runnerId !== input.runnerId) {
    throw new Error('runner touch must belong to the evaluated runner');
  }
  if (input.runnerTouch.base !== input.targetBase) {
    throw new Error('runner touch must match the evaluated target base');
  }

  if (input.controlledTag.tick < input.runnerTouch.tick) {
    return {
      kind: 'out',
      runnerId: input.runnerId,
      classification: 'time_play',
      outTick: input.controlledTag.tick,
      targetBase: input.targetBase,
      tagTick: input.controlledTag.tick,
      runnerTouchTick: input.runnerTouch.tick,
    };
  }

  if (input.runnerTouch.tick < input.controlledTag.tick) {
    return {
      kind: 'safe',
      runnerId: input.runnerId,
      targetBase: input.targetBase,
      touchTick: input.runnerTouch.tick,
      tagTick: input.controlledTag.tick,
    };
  }

  return {
    kind: 'simultaneous',
    runnerId: input.runnerId,
    targetBase: input.targetBase,
    tick: input.runnerTouch.tick,
  };
};
