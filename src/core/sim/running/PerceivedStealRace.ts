import type {
  RunnerPerceivedCue,
} from './RunnerDecision';

export type PerceivedStealRaceInput = Readonly<{
  observedAt: number;
  confidence: number;
  runnerArrivalTick: number;
  perceivedPitchCommitmentTick: number;
  pitcherToCatcherTicks: number;
  catcherTransferTicks: number;
  throwFlightTicks: number;
  fielderTagTicks: number;
}>;

const validateTick = (
  name: string,
  value: number,
): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `${name} must be a non-negative safe integer tick`,
    );
  }
};

const validateDuration = (
  name: string,
  value: number,
): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `${name} must be a non-negative safe integer tick duration`,
    );
  }
};

export const buildPerceivedStealRaceCue = (
  input: PerceivedStealRaceInput,
): Extract<
  RunnerPerceivedCue,
  { kind: 'next_base_race' }
> => {
  validateTick('observedAt', input.observedAt);
  validateTick(
    'runnerArrivalTick',
    input.runnerArrivalTick,
  );
  validateTick(
    'perceivedPitchCommitmentTick',
    input.perceivedPitchCommitmentTick,
  );

  if (
    !Number.isFinite(input.confidence)
    || input.confidence < 0
    || input.confidence > 1
  ) {
    throw new Error(
      'confidence must be finite and within [0, 1]',
    );
  }
  if (
    input.perceivedPitchCommitmentTick
    < input.observedAt
  ) {
    throw new Error(
      'perceivedPitchCommitmentTick must be at or after observedAt',
    );
  }

  validateDuration(
    'pitcherToCatcherTicks',
    input.pitcherToCatcherTicks,
  );
  validateDuration(
    'catcherTransferTicks',
    input.catcherTransferTicks,
  );
  validateDuration(
    'throwFlightTicks',
    input.throwFlightTicks,
  );
  validateDuration(
    'fielderTagTicks',
    input.fielderTagTicks,
  );

  const defenderControlTick = (
    input.perceivedPitchCommitmentTick
    + input.pitcherToCatcherTicks
    + input.catcherTransferTicks
    + input.throwFlightTicks
    + input.fielderTagTicks
  );

  if (!Number.isSafeInteger(defenderControlTick)) {
    throw new Error(
      'perceived defender tag tick must be a safe integer',
    );
  }

  return {
    kind: 'next_base_race',
    observedAt: input.observedAt,
    confidence: input.confidence,
    runnerArrivalTick: input.runnerArrivalTick,
    defenderControlTick,
  };
};
