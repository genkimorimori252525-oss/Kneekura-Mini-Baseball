import {
  createCanonicalEvidenceFingerprint,
} from './CanonicalEvidenceFingerprint';

export type ValidationPerformanceHarnessInput<
  TEvidence,
> = Readonly<{
  iterations: number;
  execute: (index: number) => TEvidence;
  readClockMilliseconds: () => number;
}>;

export type ValidationPerformanceMeasurement<
  TEvidence,
> = Readonly<{
  iterations: number;
  durationMilliseconds: number;
  averageMillisecondsPerIteration: number;
  evidence: readonly TEvidence[];
  evidenceFingerprint: string;
}>;

const readFiniteClock = (
  readClockMilliseconds: () => number,
): number => {
  const value = readClockMilliseconds();
  if (!Number.isFinite(value)) {
    throw new Error(
      'performance clock must return a finite millisecond value',
    );
  }
  return value;
};

export const measureValidationBatchPerformance = <
  TEvidence,
>(
  input: ValidationPerformanceHarnessInput<TEvidence>,
): ValidationPerformanceMeasurement<TEvidence> => {
  if (
    !Number.isSafeInteger(input.iterations)
    || input.iterations <= 0
  ) {
    throw new Error(
      'iterations must be a positive safe integer',
    );
  }

  const startMilliseconds = readFiniteClock(
    input.readClockMilliseconds,
  );

  const evidence: TEvidence[] = [];
  for (
    let index = 0;
    index < input.iterations;
    index += 1
  ) {
    evidence.push(input.execute(index));
  }

  const endMilliseconds = readFiniteClock(
    input.readClockMilliseconds,
  );
  if (endMilliseconds < startMilliseconds) {
    throw new Error(
      'performance clock must not move backwards',
    );
  }

  const durationMilliseconds = (
    endMilliseconds - startMilliseconds
  );

  return {
    iterations: input.iterations,
    durationMilliseconds,
    averageMillisecondsPerIteration: (
      durationMilliseconds / input.iterations
    ),
    evidence,
    evidenceFingerprint:
      createCanonicalEvidenceFingerprint(
        evidence,
      ),
  };
};
