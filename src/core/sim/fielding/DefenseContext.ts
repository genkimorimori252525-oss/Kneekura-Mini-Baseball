import type {
  CanonicalMatchState,
  HalfInning,
} from '../../model/CanonicalMatchState';

export type DefenseTeam = 'home' | 'away';

export type DefenseContext = Readonly<{
  inning: number;
  half: HalfInning;
  outs: number;
  defendingTeam: DefenseTeam;
  battingTeam: DefenseTeam;
  defendingRuns: number;
  battingRuns: number;
  runDifferentialForDefense: number;
  walkOffEligible: boolean;
}>;

export type DefenseContextParameters = Readonly<{
  regulationInnings: number;
}>;

export const createDefenseContext = (
  match: CanonicalMatchState,
  parameters: DefenseContextParameters,
): DefenseContext => {
  if (
    !Number.isSafeInteger(parameters.regulationInnings)
    || parameters.regulationInnings <= 0
  ) {
    throw new Error(
      'regulationInnings must be a positive safe integer',
    );
  }
  if (
    !Number.isSafeInteger(match.inning)
    || match.inning <= 0
  ) {
    throw new Error(
      'match inning must be a positive safe integer',
    );
  }
  if (
    !Number.isSafeInteger(match.outs)
    || match.outs < 0
  ) {
    throw new Error(
      'match outs must be a non-negative safe integer',
    );
  }

  const defendingTeam: DefenseTeam = (
    match.half === 'top'
      ? 'home'
      : 'away'
  );
  const battingTeam: DefenseTeam = (
    match.half === 'top'
      ? 'away'
      : 'home'
  );
  const defendingRuns = (
    defendingTeam === 'home'
      ? match.score.home
      : match.score.away
  );
  const battingRuns = (
    battingTeam === 'home'
      ? match.score.home
      : match.score.away
  );

  return {
    inning: match.inning,
    half: match.half,
    outs: match.outs,
    defendingTeam,
    battingTeam,
    defendingRuns,
    battingRuns,
    runDifferentialForDefense:
      defendingRuns - battingRuns,
    walkOffEligible: (
      match.half === 'bottom'
      && match.inning
        >= parameters.regulationInnings
    ),
  };
};
