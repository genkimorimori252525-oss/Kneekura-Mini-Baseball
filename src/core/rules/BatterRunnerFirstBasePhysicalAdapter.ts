import type { BaseTouchRegion } from '../sim/running/BaseTouch';
import type {
  RunnerBodyContactParameters,
} from '../sim/running/RunnerBodyContact';
import {
  findBatterRunnerPostLaunchBaseTouchTick,
  type BatterRunnerWorldTimeline,
} from '../sim/running/BatterRunnerWorldTimeline';
import {
  resolveBatterRunnerFirstBase,
  type BatterRunnerFirstBaseResult,
} from './BatterRunnerFirstBaseRule';
import {
  createRunnerBaseTouchFact,
  type ControlledBaseContactFact,
  type RunnerBaseTouchFact,
} from './PhysicalRuleFacts';
import {
  resolveGroundBallFirstBaseRule,
  type GroundBallFirstBaseRuleEngineResult,
} from './RuleEngine';

export type BatterRunnerFirstBasePhysicalInput = Readonly<{
  timeline: BatterRunnerWorldTimeline;
  firstBase: BaseTouchRegion;
  bodyParameters: RunnerBodyContactParameters;
}>;

export type BatterRunnerFirstBaseFromTimelineInput =
  BatterRunnerFirstBasePhysicalInput
  & Readonly<{
    defenderControl: ControlledBaseContactFact | null;
  }>;

export type GroundBallFirstBaseRuleFromTimelineInput =
  BatterRunnerFirstBasePhysicalInput
  & Readonly<{
    outsAtStart: number;
    defenderControl: ControlledBaseContactFact | null;
    homeTouches: readonly RunnerBaseTouchFact[];
  }>;

export const createBatterRunnerFirstBaseTouchFactFromTimeline = (
  input: BatterRunnerFirstBasePhysicalInput,
): RunnerBaseTouchFact | null => {
  const touchTick = findBatterRunnerPostLaunchBaseTouchTick(
    input.timeline,
    input.firstBase,
    input.bodyParameters,
  );

  return touchTick === null
    ? null
    : createRunnerBaseTouchFact(
        input.timeline.playerId,
        1,
        touchTick,
      );
};

export const resolveBatterRunnerFirstBaseFromTimeline = (
  input: BatterRunnerFirstBaseFromTimelineInput,
): BatterRunnerFirstBaseResult => resolveBatterRunnerFirstBase({
  batterRunnerId: input.timeline.playerId,
  defenderControl: input.defenderControl,
  runnerTouch: createBatterRunnerFirstBaseTouchFactFromTimeline(
    input,
  ),
});

export const resolveGroundBallFirstBaseRuleFromTimeline = (
  input: GroundBallFirstBaseRuleFromTimelineInput,
): GroundBallFirstBaseRuleEngineResult => (
  resolveGroundBallFirstBaseRule({
    outsAtStart: input.outsAtStart,
    batterRunnerId: input.timeline.playerId,
    defenderControl: input.defenderControl,
    batterRunnerTouch:
      createBatterRunnerFirstBaseTouchFactFromTimeline(input),
    homeTouches: input.homeTouches,
  })
);
