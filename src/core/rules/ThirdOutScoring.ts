import type { RunnerBaseTouchFact } from './PhysicalRuleFacts';

export type CorrectOutClassification =
  | 'batter_runner_before_first'
  | 'force'
  | 'time_play';

export type CorrectOutCandidate = Readonly<{
  runnerId: string;
  outTick: number;
  classification: CorrectOutClassification;
}>;

export type ThirdOutScoringInput = Readonly<{
  outsAtStart: number;
  thirdOutCandidate: CorrectOutCandidate;
  homeTouches: readonly RunnerBaseTouchFact[];
}>;

export type ThirdOutScoringResult =
  | Readonly<{
    kind: 'not_third_out';
    createsThirdOut: false;
  }>
  | Readonly<{
    kind: 'resolved';
    createsThirdOut: true;
    thirdOutTick: number;
    classification: CorrectOutClassification;
    scored: readonly RunnerBaseTouchFact[];
    suppressed: readonly RunnerBaseTouchFact[];
    simultaneous: readonly RunnerBaseTouchFact[];
  }>
  | Readonly<{
    kind: 'simultaneous_unresolved';
    createsThirdOut: true;
    thirdOutTick: number;
    classification: 'time_play';
    scored: readonly RunnerBaseTouchFact[];
    suppressed: readonly RunnerBaseTouchFact[];
    simultaneous: readonly RunnerBaseTouchFact[];
  }>;

const validateTick = (tick: number): void => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error('third-out candidate tick must be a non-negative safe integer');
  }
};

export const resolveThirdOutScoring = (
  input: ThirdOutScoringInput,
): ThirdOutScoringResult => {
  if (
    !Number.isInteger(input.outsAtStart)
    || input.outsAtStart < 0
    || input.outsAtStart > 2
  ) {
    throw new Error('outsAtStart must be an integer from 0 through 2');
  }
  validateTick(input.thirdOutCandidate.outTick);

  for (const touch of input.homeTouches) {
    if (touch.base !== 4) {
      throw new Error('third-out scoring requires base-4 home touch facts');
    }
  }

  if (input.outsAtStart !== 2) {
    return {
      kind: 'not_third_out',
      createsThirdOut: false,
    };
  }

  if (
    input.thirdOutCandidate.classification === 'force'
    || input.thirdOutCandidate.classification === 'batter_runner_before_first'
  ) {
    return {
      kind: 'resolved',
      createsThirdOut: true,
      thirdOutTick: input.thirdOutCandidate.outTick,
      classification: input.thirdOutCandidate.classification,
      scored: [],
      suppressed: [...input.homeTouches],
      simultaneous: [],
    };
  }

  const scored: RunnerBaseTouchFact[] = [];
  const suppressed: RunnerBaseTouchFact[] = [];
  const simultaneous: RunnerBaseTouchFact[] = [];

  for (const touch of input.homeTouches) {
    if (touch.tick < input.thirdOutCandidate.outTick) {
      scored.push(touch);
    } else if (touch.tick > input.thirdOutCandidate.outTick) {
      suppressed.push(touch);
    } else {
      simultaneous.push(touch);
    }
  }

  if (simultaneous.length > 0) {
    return {
      kind: 'simultaneous_unresolved',
      createsThirdOut: true,
      thirdOutTick: input.thirdOutCandidate.outTick,
      classification: 'time_play',
      scored,
      suppressed,
      simultaneous,
    };
  }

  return {
    kind: 'resolved',
    createsThirdOut: true,
    thirdOutTick: input.thirdOutCandidate.outTick,
    classification: 'time_play',
    scored,
    suppressed,
    simultaneous,
  };
};
