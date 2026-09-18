export type CanonicalInningLineScore = Readonly<{
  inning: number;
  awayRuns: number | null;
  homeRuns: number | null;
}>;

export type CanonicalTeamLineScoreTotals = Readonly<{
  runs: number;
  hits: number;
  errors: number;
}>;

export type CanonicalLineScoreSnapshot = Readonly<{
  innings: readonly CanonicalInningLineScore[];
  totals: Readonly<{
    away: CanonicalTeamLineScoreTotals;
    home: CanonicalTeamLineScoreTotals;
  }>;
}>;

const validateCount = (
  name: string,
  value: number,
): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `${name} must be a non-negative safe integer`,
    );
  }
};

const validateRuns = (
  name: string,
  value: number | null,
): void => {
  if (value === null) {
    return;
  }
  validateCount(name, value);
};

const validateTotals = (
  name: string,
  totals: CanonicalTeamLineScoreTotals,
): void => {
  validateCount(`${name}.runs`, totals.runs);
  validateCount(`${name}.hits`, totals.hits);
  validateCount(`${name}.errors`, totals.errors);
};

export const createCanonicalLineScoreSnapshot = (
  input: CanonicalLineScoreSnapshot,
): CanonicalLineScoreSnapshot => {
  input.innings.forEach((inning, index) => {
    const expected = index + 1;
    if (inning.inning !== expected) {
      throw new Error(
        'line-score innings must be sequential starting at 1',
      );
    }
    validateRuns(
      `innings[${index}].awayRuns`,
      inning.awayRuns,
    );
    validateRuns(
      `innings[${index}].homeRuns`,
      inning.homeRuns,
    );
  });

  validateTotals('totals.away', input.totals.away);
  validateTotals('totals.home', input.totals.home);

  const awayRuns = input.innings.reduce(
    (total, inning) => (
      total + (inning.awayRuns ?? 0)
    ),
    0,
  );
  const homeRuns = input.innings.reduce(
    (total, inning) => (
      total + (inning.homeRuns ?? 0)
    ),
    0,
  );

  if (
    awayRuns !== input.totals.away.runs
    || homeRuns !== input.totals.home.runs
  ) {
    throw new Error(
      'line-score total runs must equal the sum of recorded inning runs',
    );
  }

  return {
    innings: input.innings.map((inning) => ({
      inning: inning.inning,
      awayRuns: inning.awayRuns,
      homeRuns: inning.homeRuns,
    })),
    totals: {
      away: { ...input.totals.away },
      home: { ...input.totals.home },
    },
  };
};
