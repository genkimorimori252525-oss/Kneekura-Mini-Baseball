import { applyScheduleRevisions, createBaseScheduleSnapshot,
  type BaseScheduleSnapshot, type ScheduleRevisionEvent } from './LeagueSchedule';
import type { OfficialStandingsSchedule } from './OfficialStandings';

/** Keep the frozen schedule as the source of fixture identity for standings. */
export const captureOfficialStandingsSchedule = (
  base: BaseScheduleSnapshot,
  revisions: readonly ScheduleRevisionEvent[],
): OfficialStandingsSchedule => {
  const reconstructed = createBaseScheduleSnapshot(base);
  if (JSON.stringify(reconstructed.games) !== JSON.stringify(base.games)
    || JSON.stringify(reconstructed.revisionEventIds)
      !== JSON.stringify(base.revisionEventIds)) {
    throw new Error('standings base schedule does not match its series');
  }
  const current = applyScheduleRevisions(reconstructed, revisions);
  return Object.freeze({ seasonId: current.seasonId,
    leagueId: current.leagueId,
    memberClubIds: Object.freeze([...current.memberClubIds]),
    regularSeasonGamesPerClub: current.regularSeasonGamesPerClub,
    games: Object.freeze(current.games.map((game) => Object.freeze({
      gameId: game.gameId, homeClubId: game.homeClubId,
      awayClubId: game.awayClubId }))),
    revisionEventIds: Object.freeze([...current.revisionEventIds]),
  });
};
