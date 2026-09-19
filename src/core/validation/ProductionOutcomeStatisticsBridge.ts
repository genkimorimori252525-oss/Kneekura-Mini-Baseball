import type {
  CanonicalGroundBallFirstBaseOutcome,
} from '../sim/plateAppearance/GroundBallProductionOutcomeCoordinator';
import {
  aggregateValidationOutcomes,
  type BatchValidationStatistics,
  type ValidationOutcome,
} from './BatchValidationStatistics';

export type ProductionOutcomeValidationObservation =
  | Readonly<{
      kind: 'supported';
      outcome: ValidationOutcome;
    }>
  | Readonly<{
      kind: 'unsupported';
      reason:
        | 'play_not_terminal'
        | 'official_scoring_not_implemented';
    }>;

export type ProductionOutcomeValidationStatistics = Readonly<{
  observedSamples: number;
  supportedSamples: number;
  unsupportedSamples: number;
  unsupportedReasons: Readonly<Record<string, number>>;
  statistics: BatchValidationStatistics;
}>;

/**
 * Validation may observe completed production truth.
 * Production code must never import this adapter or receive these statistics as input.
 */
export const observeGroundBallProductionOutcomeForValidation = (
  result: CanonicalGroundBallFirstBaseOutcome,
): ProductionOutcomeValidationObservation => {
  if (result.kind !== 'completed') {
    return {
      kind: 'unsupported',
      reason: 'play_not_terminal',
    };
  }

  const official = result.canonicalResult.officialOutcome;
  if (official.kind !== 'supported') {
    return {
      kind: 'unsupported',
      reason: official.reason,
    };
  }

  switch (official.classification) {
    case 'batter_runner_out_before_first':
      return {
        kind: 'supported',
        outcome: {
          classification: 'out',
          runsAllowed:
            result.canonicalResult.scoredRunnerIds.length,
          extraBasesAllowed: 0,
        },
      };
  }
};

export const aggregateProductionOutcomeObservations = (
  observations: readonly ProductionOutcomeValidationObservation[],
): ProductionOutcomeValidationStatistics => {
  const supported = observations.filter(
    (
      observation,
    ): observation is Extract<
      ProductionOutcomeValidationObservation,
      { kind: 'supported' }
    > => observation.kind === 'supported',
  );
  const unsupported = observations.filter(
    (
      observation,
    ): observation is Extract<
      ProductionOutcomeValidationObservation,
      { kind: 'unsupported' }
    > => observation.kind === 'unsupported',
  );
  const unsupportedReasons: Record<string, number> = {};
  for (const observation of unsupported) {
    unsupportedReasons[observation.reason] =
      (unsupportedReasons[observation.reason] ?? 0) + 1;
  }

  return {
    observedSamples: observations.length,
    supportedSamples: supported.length,
    unsupportedSamples: unsupported.length,
    unsupportedReasons,
    statistics: aggregateValidationOutcomes(
      supported.map((observation) => observation.outcome),
    ),
  };
};