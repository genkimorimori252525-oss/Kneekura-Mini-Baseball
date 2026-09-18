import type {
  ControlledBaseContactFact,
  RunnerBaseTouchFact,
} from './PhysicalRuleFacts';

export type BatterRunnerFirstBaseInput = Readonly<{
  batterRunnerId: string;
  defenderControl: ControlledBaseContactFact | null;
  runnerTouch: RunnerBaseTouchFact | null;
}>;

export type BatterRunnerFirstBaseResult =
  | Readonly<{
    kind: 'out';
    runnerId: string;
    reason: 'batter_runner_before_first';
    outTick: number;
    defenderControlTick: number;
    runnerTouchTick: number;
  }>
  | Readonly<{
    kind: 'safe';
    runnerId: string;
    base: 1;
    touchTick: number;
    defenderControlTick: number;
  }>
  | Readonly<{
    kind: 'simultaneous';
    runnerId: string;
    base: 1;
    tick: number;
  }>
  | Readonly<{
    kind: 'unresolved';
    runnerId: string;
    reason: 'missing_defender_control' | 'missing_runner_touch';
  }>;

export const resolveBatterRunnerFirstBase = (
  input: BatterRunnerFirstBaseInput,
): BatterRunnerFirstBaseResult => {
  if (input.defenderControl === null) {
    return {
      kind: 'unresolved',
      runnerId: input.batterRunnerId,
      reason: 'missing_defender_control',
    };
  }

  if (input.runnerTouch === null) {
    return {
      kind: 'unresolved',
      runnerId: input.batterRunnerId,
      reason: 'missing_runner_touch',
    };
  }

  if (input.defenderControl.base !== 1) {
    throw new Error('first-base rule requires defender control at base 1');
  }
  if (input.runnerTouch.base !== 1) {
    throw new Error('first-base rule requires runner touch at base 1');
  }
  if (input.runnerTouch.runnerId !== input.batterRunnerId) {
    throw new Error('runner touch must belong to the batter-runner');
  }

  if (input.defenderControl.tick < input.runnerTouch.tick) {
    return {
      kind: 'out',
      runnerId: input.batterRunnerId,
      reason: 'batter_runner_before_first',
      outTick: input.defenderControl.tick,
      defenderControlTick: input.defenderControl.tick,
      runnerTouchTick: input.runnerTouch.tick,
    };
  }

  if (input.runnerTouch.tick < input.defenderControl.tick) {
    return {
      kind: 'safe',
      runnerId: input.batterRunnerId,
      base: 1,
      touchTick: input.runnerTouch.tick,
      defenderControlTick: input.defenderControl.tick,
    };
  }

  return {
    kind: 'simultaneous',
    runnerId: input.batterRunnerId,
    base: 1,
    tick: input.runnerTouch.tick,
  };
};
