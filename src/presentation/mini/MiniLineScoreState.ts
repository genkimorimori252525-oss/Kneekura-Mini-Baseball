import type {
  CanonicalLineScoreSnapshot,
  CanonicalTeamLineScoreTotals,
} from '../../core/model/CanonicalLineScoreSnapshot';

export type MiniLineScoreInning = Readonly<{
  inning: number;
  awayRuns: number | null;
  homeRuns: number | null;
}>;

export type MiniLineScoreState = Readonly<{
  innings: readonly MiniLineScoreInning[];
  totals: Readonly<{
    away: CanonicalTeamLineScoreTotals;
    home: CanonicalTeamLineScoreTotals;
  }>;
}>;

export type MiniLineScoreDisplayOptions = Readonly<{
  currentInning: number;
  minimumInningColumns: number;
}>;

const validatePositiveInteger = (
  name: string,
  value: number,
): void => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(
      `${name} must be a positive safe integer`,
    );
  }
};

export const buildMiniLineScoreState = (
  snapshot: CanonicalLineScoreSnapshot,
  options: MiniLineScoreDisplayOptions,
): MiniLineScoreState => {
  validatePositiveInteger(
    'currentInning',
    options.currentInning,
  );
  validatePositiveInteger(
    'minimumInningColumns',
    options.minimumInningColumns,
  );

  const latestRecordedInning = (
    snapshot.innings.at(-1)?.inning ?? 0
  );

  if (
    options.currentInning
    < latestRecordedInning
  ) {
    throw new Error(
      'currentInning must not precede the latest recorded line-score inning',
    );
  }

  const displayColumns = Math.max(
    options.minimumInningColumns,
    options.currentInning,
    latestRecordedInning,
  );

  const byInning = new Map(
    snapshot.innings.map((inning) => [
      inning.inning,
      inning,
    ]),
  );

  const innings = Array.from(
    { length: displayColumns },
    (_, index) => {
      const inningNumber = index + 1;
      const canonical = byInning.get(
        inningNumber,
      );

      return canonical === undefined
        ? {
            inning: inningNumber,
            awayRuns: null,
            homeRuns: null,
          }
        : {
            inning: canonical.inning,
            awayRuns: canonical.awayRuns,
            homeRuns: canonical.homeRuns,
          };
    },
  );

  return {
    innings,
    totals: {
      away: { ...snapshot.totals.away },
      home: { ...snapshot.totals.home },
    },
  };
};
