import type {
  RunnerPerceivedCue,
} from './RunnerDecision';

export type PerceivedPickoffThreatInput = Readonly<{
  observedAt: number;
  confidence: number;
  runnerReturnTick: number;
  perceivedPickoffCommitmentTick: number;
  pitcherReleaseDelayTicks: number;
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

export const buildPerceivedPickoffThreatCue = (
  input: PerceivedPickoffThreatInput,
): Extract<
  RunnerPerceivedCue,
  { kind: 'current_base_threat' }
> => {
  validateTick('observedAt', input.observedAt);
  validateTick(
    'runnerReturnTick',
    input.runnerReturnTick,
  );
  validateTick(
    'perceivedPickoffCommitmentTick',
    input.perceivedPickoffCommitmentTick,
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
    input.perceivedPickoffCommitmentTick
    < input.observedAt
  ) {
    throw new Error(
      'perceivedPickoffCommitmentTick must be at or after observedAt',
    );
  }

  validateDuration(
    'pitcherReleaseDelayTicks',
    input.pitcherReleaseDelayTicks,
  );
  validateDuration(
    'throwFlightTicks',
    input.throwFlightTicks,
  );
  validateDuration(
    'fielderTagTicks',
    input.fielderTagTicks,
  );

  const defenderTagTick = (
    input.perceivedPickoffCommitmentTick
    + input.pitcherReleaseDelayTicks
    + input.throwFlightTicks
    + input.fielderTagTicks
  );

  if (!Number.isSafeInteger(defenderTagTick)) {
    throw new Error(
      'perceived pickoff defender tag tick must be a safe integer',
    );
  }

  return {
    kind: 'current_base_threat',
    observedAt: input.observedAt,
    confidence: input.confidence,
    runnerReturnTick: input.runnerReturnTick,
    defenderTagTick,
  };
};
