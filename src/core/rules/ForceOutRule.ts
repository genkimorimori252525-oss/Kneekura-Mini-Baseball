import type { ForceObligation } from './ForceObligation';
import type {
  ControlledBaseContactFact,
  RunnerBaseTouchFact,
} from './PhysicalRuleFacts';

export type ForceOutRuleInput = Readonly<{
  obligation: ForceObligation;
  defenderControl: ControlledBaseContactFact | null;
  runnerTouch: RunnerBaseTouchFact | null;
}>;

export type ForceOutRuleResult =
  | Readonly<{
    kind: 'out';
    runnerId: string;
    classification: 'force';
    outTick: number;
    targetBase: ForceObligation['targetBase'];
    defenderControlTick: number;
    runnerTouchTick: number;
  }>
  | Readonly<{
    kind: 'safe';
    runnerId: string;
    targetBase: ForceObligation['targetBase'];
    touchTick: number;
    defenderControlTick: number;
  }>
  | Readonly<{
    kind: 'simultaneous';
    runnerId: string;
    targetBase: ForceObligation['targetBase'];
    tick: number;
  }>
  | Readonly<{
    kind: 'unresolved';
    runnerId: string;
    targetBase: ForceObligation['targetBase'];
    reason: 'missing_defender_control' | 'missing_runner_touch';
  }>;

export const resolveForceOutAtTarget = (
  input: ForceOutRuleInput,
): ForceOutRuleResult => {
  if (input.obligation.classification !== 'force') {
    throw new Error('force-out rule requires a current force obligation');
  }

  if (input.defenderControl === null) {
    return {
      kind: 'unresolved',
      runnerId: input.obligation.runnerId,
      targetBase: input.obligation.targetBase,
      reason: 'missing_defender_control',
    };
  }

  if (input.runnerTouch === null) {
    return {
      kind: 'unresolved',
      runnerId: input.obligation.runnerId,
      targetBase: input.obligation.targetBase,
      reason: 'missing_runner_touch',
    };
  }

  if (input.defenderControl.base !== input.obligation.targetBase) {
    throw new Error('defender control must match the force target base');
  }
  if (input.runnerTouch.base !== input.obligation.targetBase) {
    throw new Error('runner touch must match the force target base');
  }
  if (input.runnerTouch.runnerId !== input.obligation.runnerId) {
    throw new Error('runner touch must belong to the forced runner');
  }

  if (input.defenderControl.tick < input.runnerTouch.tick) {
    return {
      kind: 'out',
      runnerId: input.obligation.runnerId,
      classification: 'force',
      outTick: input.defenderControl.tick,
      targetBase: input.obligation.targetBase,
      defenderControlTick: input.defenderControl.tick,
      runnerTouchTick: input.runnerTouch.tick,
    };
  }

  if (input.runnerTouch.tick < input.defenderControl.tick) {
    return {
      kind: 'safe',
      runnerId: input.obligation.runnerId,
      targetBase: input.obligation.targetBase,
      touchTick: input.runnerTouch.tick,
      defenderControlTick: input.defenderControl.tick,
    };
  }

  return {
    kind: 'simultaneous',
    runnerId: input.obligation.runnerId,
    targetBase: input.obligation.targetBase,
    tick: input.runnerTouch.tick,
  };
};
