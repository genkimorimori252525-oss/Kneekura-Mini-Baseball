import { applyClubEconomyBatch,
  type ClubEconomyBatchResult } from '../club/ClubEconomyBatch';
import type { ClubWorldState } from '../club/ClubTypes';
import type { ClubWageScheduleLedger } from '../club/ClubWageScheduleLedger';
import type { MatchdayAttendanceFact, MatchdayClubHistory,
  MatchdayRevenuePolicy } from '../club/OfficialMatchdayRevenue';
import { resolveOfficialGameBoundary,
  type OfficialGameBoundaryInput,
  type OfficialGameResult } from './OfficialGameCompletion';
import { buildOfficialStandings,
  type OfficialStandingsSchedule,
  type OfficialStandingsSnapshot,
  type StandingsTiebreakPolicy } from './OfficialStandings';
import { projectProvisionalOfficialStandings,
  type ProvisionalOfficialStandings } from './ProvisionalOfficialStandings';

export type RegularSeasonGameInput = Readonly<{
  game: OfficialGameBoundaryInput;
  schedule: OfficialStandingsSchedule;
  priorResults: readonly OfficialGameResult[];
  standingsPolicy: StandingsTiebreakPolicy;
  homeClub: ClubWorldState;
  homeClubHistory: MatchdayClubHistory;
  wageSchedules: ClubWageScheduleLedger;
  attendance: MatchdayAttendanceFact;
  revenuePolicy: MatchdayRevenuePolicy;
  finalizedAtDay: number;
}>;
export type FinalRegularSeasonGameInput = RegularSeasonGameInput;
export type RegularSeasonGameSettlement = Readonly<{
  gameResult: OfficialGameResult;
  results: readonly OfficialGameResult[];
  standings: ProvisionalOfficialStandings | Readonly<{
    kind: 'OFFICIAL'; snapshot: OfficialStandingsSnapshot;
  }>;
  economy: ClubEconomyBatchResult;
}>;
export type FinalRegularSeasonGameSettlement = Readonly<{
  gameResult: OfficialGameResult;
  results: readonly OfficialGameResult[];
  standings: OfficialStandingsSnapshot;
  economy: ClubEconomyBatchResult;
}>;

/**
 * Applies any scheduled regular-season game from one durable Match result.
 * The host must persist results, standings, Club state and Club events atomically.
 */
export const settleRegularSeasonGame = (
  input: RegularSeasonGameInput,
): RegularSeasonGameSettlement => {
  const boundary = resolveOfficialGameBoundary(input.game);
  if (boundary.kind !== 'GAME_FINAL') {
    throw new Error('regular season settlement requires a final official game');
  }
  const results = Object.freeze([...input.priorResults, boundary.result]);
  const standings = results.length < input.schedule.games.length
    ? projectProvisionalOfficialStandings(input.schedule, results,
      input.standingsPolicy)
    : Object.freeze({ kind: 'OFFICIAL' as const,
      snapshot: buildOfficialStandings(input.schedule, results,
        input.standingsPolicy) });
  const economy = applyClubEconomyBatch(input.homeClub,
    input.homeClubHistory, input.wageSchedules, [{ kind: 'MATCHDAY',
      result: boundary.result, attendance: input.attendance,
      policy: input.revenuePolicy, finalizedAtDay: input.finalizedAtDay }]);
  return Object.freeze({ gameResult: boundary.result, results,
    standings, economy });
};

/** Compatibility entry point for consumers that require completed-season ranking. */
export const settleFinalRegularSeasonGame = (
  input: FinalRegularSeasonGameInput,
): FinalRegularSeasonGameSettlement => {
  const settlement = settleRegularSeasonGame(input);
  if (settlement.standings.kind !== 'OFFICIAL') {
    throw new Error('final regular season settlement requires all official results');
  }
  return Object.freeze({ ...settlement,
    standings: settlement.standings.snapshot });
};
