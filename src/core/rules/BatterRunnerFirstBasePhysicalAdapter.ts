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
import {
  createControlledBaseContactFactFromDefenderPhysics,
  type DefenderControlledBaseContactPhysicalAdapterInput,
} from './DefenderControlledBaseContactPhysicalAdapter';
import {
  createControlledBaseContactFactFromCatchOutcomePhysics,
  type DefenderControlledBaseContactFromCatchOutcomeInput,
} from './DefenderControlledBaseContactPhysicalAdapter';

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


export type BatterRunnerFirstBasePhysicalRaceDefenderInput = Omit<
  DefenderControlledBaseContactPhysicalAdapterInput,
  'base' | 'baseRegion'
>;

export type BatterRunnerFirstBaseFromPhysicalRaceInput =
  BatterRunnerFirstBasePhysicalInput
  & Readonly<{
    defender: BatterRunnerFirstBasePhysicalRaceDefenderInput;
  }>;

export type GroundBallFirstBaseRuleFromPhysicalRaceInput =
  BatterRunnerFirstBasePhysicalInput
  & Readonly<{
    defender: BatterRunnerFirstBasePhysicalRaceDefenderInput;
    outsAtStart: number;
    homeTouches: readonly RunnerBaseTouchFact[];
  }>;


export type BatterRunnerFirstBasePhysicalCatchRaceDefenderInput = Omit<
  DefenderControlledBaseContactFromCatchOutcomeInput,
  'base' | 'baseRegion'
>;

export type BatterRunnerFirstBaseFromPhysicalCatchRaceInput =
  BatterRunnerFirstBasePhysicalInput
  & Readonly<{
    defender: BatterRunnerFirstBasePhysicalCatchRaceDefenderInput;
  }>;

export type GroundBallFirstBaseRuleFromPhysicalCatchRaceInput =
  BatterRunnerFirstBasePhysicalInput
  & Readonly<{
    defender: BatterRunnerFirstBasePhysicalCatchRaceDefenderInput;
    outsAtStart: number;
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


const createFirstBaseDefenderControlFactFromPhysicalRace = (
  input: BatterRunnerFirstBaseFromPhysicalRaceInput,
): ControlledBaseContactFact | null => (
  createControlledBaseContactFactFromDefenderPhysics({
    ...input.defender,
    base: 1,
    baseRegion: input.firstBase,
  })
);

export const resolveBatterRunnerFirstBaseFromPhysicalRace = (
  input: BatterRunnerFirstBaseFromPhysicalRaceInput,
): BatterRunnerFirstBaseResult => resolveBatterRunnerFirstBase({
  batterRunnerId: input.timeline.playerId,
  defenderControl:
    createFirstBaseDefenderControlFactFromPhysicalRace(input),
  runnerTouch: createBatterRunnerFirstBaseTouchFactFromTimeline(
    input,
  ),
});

export const resolveGroundBallFirstBaseRuleFromPhysicalRace = (
  input: GroundBallFirstBaseRuleFromPhysicalRaceInput,
): GroundBallFirstBaseRuleEngineResult => {
  const defenderControl =
    createControlledBaseContactFactFromDefenderPhysics({
      ...input.defender,
      base: 1,
      baseRegion: input.firstBase,
    });

  return resolveGroundBallFirstBaseRule({
    outsAtStart: input.outsAtStart,
    batterRunnerId: input.timeline.playerId,
    defenderControl,
    batterRunnerTouch:
      createBatterRunnerFirstBaseTouchFactFromTimeline(input),
    homeTouches: input.homeTouches,
  });
};


export const resolveBatterRunnerFirstBaseFromPhysicalCatchRace = (
  input: BatterRunnerFirstBaseFromPhysicalCatchRaceInput,
): BatterRunnerFirstBaseResult => resolveBatterRunnerFirstBase({
  batterRunnerId: input.timeline.playerId,
  defenderControl:
    createControlledBaseContactFactFromCatchOutcomePhysics({
      ...input.defender,
      base: 1,
      baseRegion: input.firstBase,
    }),
  runnerTouch: createBatterRunnerFirstBaseTouchFactFromTimeline(
    input,
  ),
});

export const resolveGroundBallFirstBaseRuleFromPhysicalCatchRace = (
  input: GroundBallFirstBaseRuleFromPhysicalCatchRaceInput,
): GroundBallFirstBaseRuleEngineResult => (
  resolveGroundBallFirstBaseRule({
    outsAtStart: input.outsAtStart,
    batterRunnerId: input.timeline.playerId,
    defenderControl:
      createControlledBaseContactFactFromCatchOutcomePhysics({
        ...input.defender,
        base: 1,
        baseRegion: input.firstBase,
      }),
    batterRunnerTouch:
      createBatterRunnerFirstBaseTouchFactFromTimeline(input),
    homeTouches: input.homeTouches,
  })
);
