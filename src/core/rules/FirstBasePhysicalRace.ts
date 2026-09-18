import type {
  CatchRetentionParameters,
  CatchRetentionResolution,
  CatchRetentionContact,
} from '../sim/fielding/CatchRetention';
import {
  resolveCatchRetention,
} from '../sim/fielding/CatchRetention';
import {
  createCatchRetentionContactFromAcceleratedReception,
  type AcceleratedThrowReceptionInput,
} from '../sim/fielding/DefenderThrowReceptionContact';
import type {
  DefenderPhysicalPrimitiveSegment,
} from '../sim/fielding/DefenderPhysicalPrimitive';
import type { BaseTouchRegion } from '../sim/running/BaseTouch';
import type {
  RunnerBodyContactParameters,
} from '../sim/running/RunnerBodyContact';
import type {
  BatterRunnerWorldTimeline,
} from '../sim/running/BatterRunnerWorldTimeline';
import {
  createBatterRunnerFirstBaseTouchFactFromTimeline,
} from './BatterRunnerFirstBasePhysicalAdapter';
import {
  createControlledBaseContactFactFromCatchOutcomePhysics,
} from './DefenderControlledBaseContactPhysicalAdapter';
import {
  resolveBatterRunnerFirstBase,
  type BatterRunnerFirstBaseResult,
} from './BatterRunnerFirstBaseRule';
import type {
  ControlledBaseContactFact,
  RunnerBaseTouchFact,
} from './PhysicalRuleFacts';
import {
  resolveGroundBallFirstBaseRule,
  type GroundBallFirstBaseRuleEngineResult,
} from './RuleEngine';

export type FirstBasePhysicalRaceDefenderInput = Readonly<{
  defenderId: string;
  baseSurfaceHeightMeters: number;
  controlThroughTick: number;
  contactPrimitives: readonly DefenderPhysicalPrimitiveSegment[];
  reception: AcceleratedThrowReceptionInput;
  retentionParameters: CatchRetentionParameters;
}>;

export type FirstBasePhysicalRaceInput = Readonly<{
  timeline: BatterRunnerWorldTimeline;
  firstBase: BaseTouchRegion;
  runnerBodyParameters: RunnerBodyContactParameters;
  defender: FirstBasePhysicalRaceDefenderInput;
}>;

export type FirstBasePhysicalRaceResult = Readonly<{
  receptionContact: CatchRetentionContact | null;
  catchRetention: CatchRetentionResolution | null;
  defenderControl: ControlledBaseContactFact | null;
  runnerTouch: RunnerBaseTouchFact | null;
  correctRuleResult: BatterRunnerFirstBaseResult;
}>;

export type GroundBallFirstBasePhysicalRaceInput =
  FirstBasePhysicalRaceInput
  & Readonly<{
    outsAtStart: number;
    homeTouches: readonly RunnerBaseTouchFact[];
  }>;

export type GroundBallFirstBasePhysicalRaceResult = Readonly<{
  race: FirstBasePhysicalRaceResult;
  ruleEngine: GroundBallFirstBaseRuleEngineResult;
}>;

export const resolveFirstBasePhysicalRace = (
  input: FirstBasePhysicalRaceInput,
): FirstBasePhysicalRaceResult => {
  const receptionContact =
    createCatchRetentionContactFromAcceleratedReception(
      input.defender.reception,
    );
  const catchRetention = receptionContact === null
    ? null
    : resolveCatchRetention(
        receptionContact,
        input.defender.retentionParameters,
      );

  const defenderControl = catchRetention === null
    ? null
    : createControlledBaseContactFactFromCatchOutcomePhysics({
        defenderId: input.defender.defenderId,
        base: 1,
        baseRegion: input.firstBase,
        baseSurfaceHeightMeters:
          input.defender.baseSurfaceHeightMeters,
        catchOutcome: catchRetention.outcome,
        controlThroughTick: input.defender.controlThroughTick,
        contactPrimitives: input.defender.contactPrimitives,
      });

  const runnerTouch =
    createBatterRunnerFirstBaseTouchFactFromTimeline({
      timeline: input.timeline,
      firstBase: input.firstBase,
      bodyParameters: input.runnerBodyParameters,
    });

  const correctRuleResult = resolveBatterRunnerFirstBase({
    batterRunnerId: input.timeline.playerId,
    defenderControl,
    runnerTouch,
  });

  return {
    receptionContact,
    catchRetention,
    defenderControl,
    runnerTouch,
    correctRuleResult,
  };
};

export const resolveGroundBallFirstBasePhysicalRace = (
  input: GroundBallFirstBasePhysicalRaceInput,
): GroundBallFirstBasePhysicalRaceResult => {
  const race = resolveFirstBasePhysicalRace(input);
  const ruleEngine = resolveGroundBallFirstBaseRule({
    outsAtStart: input.outsAtStart,
    batterRunnerId: input.timeline.playerId,
    defenderControl: race.defenderControl,
    batterRunnerTouch: race.runnerTouch,
    homeTouches: input.homeTouches,
  });

  return {
    race,
    ruleEngine,
  };
};
