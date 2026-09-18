import type {
  DefensiveContactClassification,
} from './SameContactAlignmentComparison';

export type ValidationOutcome = Readonly<{
  classification: DefensiveContactClassification;
  runsAllowed: number;
  extraBasesAllowed: number;
}>;

export type BatchValidationStatistics = Readonly<{
  samples: number;
  outs: number;
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  errors: number;
  fieldersChoices: number;
  totalBases: number;
  runsAllowed: number;
  extraBasesAllowed: number;
  fieldableBalls: number;
  hitsOnFieldableBalls: number;
  fieldableHitRate: number | null;
  outRate: number | null;
  runsAllowedPerSample: number | null;
}>;

const validateNonNegativeFinite = (
  name: string,
  value: number,
): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `${name} must be finite and non-negative`,
    );
  }
};

export const aggregateValidationOutcomes = (
  outcomes: readonly ValidationOutcome[],
): BatchValidationStatistics => {
  for (const outcome of outcomes) {
    validateNonNegativeFinite(
      'runsAllowed',
      outcome.runsAllowed,
    );
    validateNonNegativeFinite(
      'extraBasesAllowed',
      outcome.extraBasesAllowed,
    );
  }

  const count = (
    classification: DefensiveContactClassification,
  ): number => outcomes.filter(
    (outcome) => (
      outcome.classification === classification
    ),
  ).length;

  const outs = count('out');
  const singles = count('single');
  const doubles = count('double');
  const triples = count('triple');
  const homeRuns = count('home_run');
  const errors = count('error');
  const fieldersChoices = count('fielders_choice');
  const hits = (
    singles
    + doubles
    + triples
    + homeRuns
  );
  const samples = outcomes.length;
  const fieldableBalls = samples - homeRuns;
  const hitsOnFieldableBalls = (
    singles + doubles + triples
  );
  const runsAllowed = outcomes.reduce(
    (total, outcome) => (
      total + outcome.runsAllowed
    ),
    0,
  );
  const extraBasesAllowed = outcomes.reduce(
    (total, outcome) => (
      total + outcome.extraBasesAllowed
    ),
    0,
  );

  return {
    samples,
    outs,
    hits,
    singles,
    doubles,
    triples,
    homeRuns,
    errors,
    fieldersChoices,
    totalBases: (
      singles
      + 2 * doubles
      + 3 * triples
      + 4 * homeRuns
    ),
    runsAllowed,
    extraBasesAllowed,
    fieldableBalls,
    hitsOnFieldableBalls,
    fieldableHitRate: fieldableBalls === 0
      ? null
      : hitsOnFieldableBalls / fieldableBalls,
    outRate: samples === 0
      ? null
      : outs / samples,
    runsAllowedPerSample: samples === 0
      ? null
      : runsAllowed / samples,
  };
};
