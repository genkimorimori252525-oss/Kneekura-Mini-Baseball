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
    thirdOut: boolean;
    runsScored: readonly RunnerBaseTouchFact[];
    runsSuppressed: readonly RunnerBaseTouchFact[];
    thirdOutScoring: ThirdOutScoringResult | null;
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
        runsScored: [...input.homeTouches],
        runsSuppressed: [],
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
        runsScored: [...input.homeTouches],
        runsSuppressed: [],
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
      outsAfter,
      thirdOut: true,
      runsScored: thirdOutScoring.scored,
      runsSuppressed: thirdOutScoring.suppressed,
      thirdOutScoring,
    },
  };
};
