import type { DatabaseSync } from 'node:sqlite';
import type { OfficialStandingsSchedule } from '../../core/world/competition/OfficialStandings';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { assertNationalMatchBindings } from './NationalMatchOriginFromSqlite';

/** Original Match scope shared by post-play review and closure. No current call-up or adopted appearance is a fixture source. */
export const readActualLiveOriginalFixture = (db: Pick<DatabaseSync, 'prepare'>, gameId: string,
  bindings: readonly OfficialParticipantBinding[]) => {
  if (!bindings.length) throw new Error('actual live original fixture participants are missing');
  const first = bindings[0], national = assertNationalMatchBindings(db, bindings);
  if (national) {
    const f = national.fixture;
    if (f.careerId !== first.careerId || f.competitionEditionId !== first.competitionEditionId
      || f.fixtureEventId !== first.fixtureEventId || f.gameDay !== first.gameDay
      || national.source.gameId !== gameId) throw new Error('actual live original National fixture differs');
    return { careerId: f.careerId, seasonId: f.competitionEditionId,
      game: { gameId, homeClubId: f.homeClubId, awayClubId: f.awayClubId } };
  }
  const row = db.prepare('SELECT schedule_json FROM world_season_heads WHERE career_id=? AND season_id=?')
    .get(first.careerId, first.competitionEditionId);
  const schedule = row && JSON.parse(String(row.schedule_json)) as OfficialStandingsSchedule | undefined;
  const games = schedule?.games.filter(g => g.gameId === gameId);
  if (!schedule || schedule.seasonId !== first.competitionEditionId || !games || games.length !== 1) {
    throw new Error('actual live closure original season fixture missing');
  }
  // Preserve the complete legacy scheduled game object and its serialized bytes.
  return { careerId: first.careerId, seasonId: schedule.seasonId, game: games[0] };
};
