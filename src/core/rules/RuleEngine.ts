import type {
  ControlledBaseContactFact,
  RunnerBaseTouchFact,
} from './PhysicalRuleFacts';
import {
  resolveBatterRunnerFirstBase,
  type BatterRunnerFirstBaseResult,
} from './BatterRunnerFirstBaseRule';
import {
  resolveThirdOutScoring,
  type ThirdOutScoringResult,
} from './ThirdOutScoring';
import type { ForceOutRuleResult } from './ForceOutRule';
import type { TagArrivalResult } from './TagArrivalRule';
import { finalizePendingRunsAtPlayEnd, type PlayRunFinalization } from './PlayRunFinalization';
import type { PlayEndFact } from './PhysicalRuleFacts';

export type GroundBallFirstBaseRuleInput = Readonly<{
  outsAtStart: number;
  batterRunnerId: string;
  defenderControl: ControlledBaseContactFact | null;
  batterRunnerTouch: RunnerBaseTouchFact | null;
  homeTouches: readonly RunnerBaseTouchFact[];
}>;

type ResolvedFirstBaseResult = Extract<
  BatterRunnerFirstBaseResult,
  { kind: 'out' | 'safe' }
>;

type UnresolvedFirstBaseResult = Exclude<
  BatterRunnerFirstBaseResult,
  ResolvedFirstBaseResult
>;

export type GroundBallFirstBaseCorrectRuleResult =
  | Readonly<{
    kind: 'resolved';
    batterRunnerFirstBase: ResolvedFirstBaseResult;
    outsAfter: number;
    thirdOut: false;
    pendingHomeTouches: readonly RunnerBaseTouchFact[];
    thirdOutScoring: null;
  }>
  | Readonly<{
    kind: 'resolved';
    batterRunnerFirstBase: Extract<BatterRunnerFirstBaseResult, { kind: 'out' }>;
    outsAfter: 3;
    thirdOut: true;
    runsScored: readonly RunnerBaseTouchFact[];
    runsSuppressed: readonly RunnerBaseTouchFact[];
    thirdOutScoring: Extract<ThirdOutScoringResult, { kind: 'resolved' }>;
  }>
  | Readonly<{
    kind: 'unresolved';
    batterRunnerFirstBase: UnresolvedFirstBaseResult;
    outsAfter: number;
    pendingHomeTouches: readonly RunnerBaseTouchFact[];
  }>;

export type GroundBallFirstBaseRuleEngineResult = Readonly<{
  physicalFacts: GroundBallFirstBaseRuleInput;
  correctRuleResult: GroundBallFirstBaseCorrectRuleResult;
}>;

const validateOuts = (outsAtStart: number): void => {
  if (
    !Number.isInteger(outsAtStart)
    || outsAtStart < 0
    || outsAtStart > 2
  ) {
    throw new Error('outsAtStart must be an integer from 0 through 2');
  }
};

const validateHomeTouches = (
  homeTouches: readonly RunnerBaseTouchFact[],
): void => {
  for (const touch of homeTouches) {
    if (touch.base !== 4) {
      throw new Error(
        'ground-ball first-base rule requires base-4 home touch facts',
      );
    }
  }
};

export const resolveGroundBallFirstBaseRule = (
  input: GroundBallFirstBaseRuleInput,
): GroundBallFirstBaseRuleEngineResult => {
  validateOuts(input.outsAtStart);
  validateHomeTouches(input.homeTouches);

  const firstBase = resolveBatterRunnerFirstBase({
    batterRunnerId: input.batterRunnerId,
    defenderControl: input.defenderControl,
    runnerTouch: input.batterRunnerTouch,
  });

  if (firstBase.kind === 'simultaneous' || firstBase.kind === 'unresolved') {
    return {
      physicalFacts: input,
      correctRuleResult: {
        kind: 'unresolved',
        batterRunnerFirstBase: firstBase,
        outsAfter: input.outsAtStart,
        pendingHomeTouches: [...input.homeTouches],
      },
    };
  }

  if (firstBase.kind === 'safe') {
    return {
      physicalFacts: input,
      correctRuleResult: {
        kind: 'resolved',
        batterRunnerFirstBase: firstBase,
        outsAfter: input.outsAtStart,
        thirdOut: false,
        pendingHomeTouches: [...input.homeTouches],
        thirdOutScoring: null,
      },
    };
  }

  const outsAfter = input.outsAtStart + 1;
  if (outsAfter < 3) {
    return {
      physicalFacts: input,
      correctRuleResult: {
        kind: 'resolved',
        batterRunnerFirstBase: firstBase,
        outsAfter,
        thirdOut: false,
        pendingHomeTouches: [...input.homeTouches],
        thirdOutScoring: null,
      },
    };
  }

  const thirdOutScoring = resolveThirdOutScoring({
    outsAtStart: input.outsAtStart,
    thirdOutCandidate: {
      runnerId: firstBase.runnerId,
      outTick: firstBase.outTick,
      classification: 'batter_runner_before_first',
    },
    homeTouches: input.homeTouches,
  });

  if (thirdOutScoring.kind !== 'resolved') {
    throw new Error(
      'batter-runner-before-first third-out scoring must resolve deterministically',
    );
  }

  return {
    physicalFacts: input,
    correctRuleResult: {
      kind: 'resolved',
      batterRunnerFirstBase: firstBase,
      outsAfter: 3,
      thirdOut: true,
      runsScored: thirdOutScoring.scored,
      runsSuppressed: thirdOutScoring.suppressed,
      thirdOutScoring,
    },
  };
};


export type ForceOutScoringRuleInput = Readonly<{
  outsAtStart: number;
  forceOut: Extract<ForceOutRuleResult, { kind: 'out' }>;
  homeTouches: readonly RunnerBaseTouchFact[];
}>;

export type ForceOutScoringRuleResult =
  | Readonly<{
    outsAfter: number;
    thirdOut: false;
    pendingHomeTouches: readonly RunnerBaseTouchFact[];
    thirdOutScoring: null;
  }>
  | Readonly<{
    outsAfter: 3;
    thirdOut: true;
    pendingHomeTouches: readonly [];
    thirdOutScoring: ThirdOutScoringResult;
  }>;

export const resolveForceOutScoringRule = (
  input: ForceOutScoringRuleInput,
): ForceOutScoringRuleResult => {
  validateOuts(input.outsAtStart);
  validateHomeTouches(input.homeTouches);

  const outsAfter = input.outsAtStart + 1;
  if (outsAfter < 3) {
    return {
      outsAfter,
      thirdOut: false,
      pendingHomeTouches: [...input.homeTouches],
      thirdOutScoring: null,
    };
  }

  const thirdOutScoring = resolveThirdOutScoring({
    outsAtStart: input.outsAtStart,
    thirdOutCandidate: {
      runnerId: input.forceOut.runnerId,
      outTick: input.forceOut.outTick,
      classification: 'force',
    },
    homeTouches: input.homeTouches,
  });

  return {
    outsAfter: 3,
    thirdOut: true,
    pendingHomeTouches: [],
    thirdOutScoring,
  };
};


export type TagOutScoringRuleInput = Readonly<{
  outsAtStart: number;
  tagOut: Extract<TagArrivalResult, { kind: 'out' }>;
  homeTouches: readonly RunnerBaseTouchFact[];
}>;

export type TagOutScoringRuleResult =
  | Readonly<{
    outsAfter: number;
    thirdOut: false;
    pendingHomeTouches: readonly RunnerBaseTouchFact[];
    thirdOutScoring: null;
  }>
  | Readonly<{
    outsAfter: 3;
    thirdOut: true;
    pendingHomeTouches: readonly [];
    thirdOutScoring: ThirdOutScoringResult;
  }>;

export const resolveTagOutScoringRule = (
  input: TagOutScoringRuleInput,
): TagOutScoringRuleResult => {
  validateOuts(input.outsAtStart);
  validateHomeTouches(input.homeTouches);

  const outsAfter = input.outsAtStart + 1;
  if (outsAfter < 3) {
    return {
      outsAfter,
      thirdOut: false,
      pendingHomeTouches: [...input.homeTouches],
      thirdOutScoring: null,
    };
  }

  const thirdOutScoring = resolveThirdOutScoring({
    outsAtStart: input.outsAtStart,
    thirdOutCandidate: {
      runnerId: input.tagOut.runnerId,
      outTick: input.tagOut.outTick,
      classification: 'time_play',
    },
    homeTouches: input.homeTouches,
  });

  return {
    outsAfter: 3,
    thirdOut: true,
    pendingHomeTouches: [],
    thirdOutScoring,
  };
};


export type PendingRunRuleResult =
  | Extract<GroundBallFirstBaseCorrectRuleResult, { kind: 'resolved'; thirdOut: false }>
  | Extract<ForceOutScoringRuleResult, { thirdOut: false }>
  | Extract<TagOutScoringRuleResult, { thirdOut: false }>;

export const finalizeRulePendingRuns = (
  result: PendingRunRuleResult,
  playEnd: PlayEndFact,
): PlayRunFinalization => finalizePendingRunsAtPlayEnd(
  result.pendingHomeTouches,
  playEnd,
);
