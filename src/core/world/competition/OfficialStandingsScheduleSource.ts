import { applyScheduleRevisions, createBaseScheduleSnapshot,
  type BaseScheduleSnapshot, type ScheduleRevisionEvent } from './LeagueSchedule';
import type { OfficialStandingsSchedule } from './OfficialStandings';

/** Keep the frozen schedule as the source of fixture identity for standings. */
export const captureOfficialStandingsSchedule = (
  base: BaseScheduleSnapshot,
  revisions: readonly ScheduleRevisionEvent[],
): OfficialStandingsSchedule => {
  const reconstructed = createBaseScheduleSnapshot(base);
  if (reconstructed.games.length !== base.games.length
    || reconstructed.games.some((game, index) => {
      const stored = base.games[index];
      return !stored || Object.keys(stored).length !== 5
        || game.gameId !== stored.gameId
        || game.seriesId !== stored.seriesId
        || game.day !== stored.day
        || game.homeClubId !== stored.homeClubId
        || game.awayClubId !== stored.awayClubId;
    })
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
