import type { OfficialGameVenueBinding } from
  '../../core/world/competition/OfficialGameCompletion';
import type { PremierTwelveEdition, PremierTwelveGame } from
  '../../core/world/competition/PremierTwelve';
import type { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import type { SqlitePremierTwelveGroupStore } from './SqlitePremierTwelveGroupStore';
import type { SqlitePremierTwelveFinalFourStore } from './SqlitePremierTwelveFinalFourStore';
import type { SqlitePremierTwelveScheduleStore } from './SqlitePremierTwelveScheduleStore';

export type PremierTwelveFixture = Readonly<{
  edition: PremierTwelveEdition;
  game: PremierTwelveGame;
  gameDay: number;
  binding: OfficialGameVenueBinding;
}>;

/** A fixture is eligible only after its entrants and preselected venue are official. */
export const registerPremierTwelveFixtureFromWorld = (
  stores: Readonly<{
    groups: Pick<SqlitePremierTwelveGroupStore, 'readEdition' | 'readPlan'>;
    finalFour: Pick<SqlitePremierTwelveFinalFourStore, 'readPlan' | 'medalGames'>;
    schedules: Pick<SqlitePremierTwelveScheduleStore, 'readSchedule'>;
    matches: Pick<SqliteOfficialStateStore, 'registerOfficialFixture'>;
  }>,
  input: Readonly<{ careerId: string; editionId: string; gameId: string; gameDay: number }>,
): PremierTwelveFixture => {
  const edition = stores.groups.readEdition(input.careerId, input.editionId);
  const plan = stores.groups.readPlan(input.careerId, input.editionId);
  if (!edition || !plan || edition.editionId !== input.editionId
    || plan.editionId !== input.editionId || edition.competitionId !== plan.competitionId
    || !Number.isSafeInteger(input.gameDay)
    || input.gameDay < edition.calendarWindow.startsOnDay
    || input.gameDay > edition.calendarWindow.endsOnDay) {
    throw new Error('Premier12 fixture differs from accepted Edition');
  }
  let game = plan.groups.flatMap((group) => group.games)
    .find((item) => item.gameId === input.gameId);
  if (!game) {
    const finalFour = stores.finalFour.readPlan(input.careerId, input.editionId);
    game = finalFour?.semifinalGames.find((item) => item.gameId === input.gameId);
    if (!game && finalFour) {
      const medals = stores.finalFour.medalGames(input.careerId, input.editionId);
      game = medals ? [medals.bronzeGame, medals.finalGame]
        .find((item) => item.gameId === input.gameId) : undefined;
    }
  }
  if (!game) throw new Error('Premier12 fixture game is not yet qualified');
  const schedule = stores.schedules.readSchedule(input.careerId, input.editionId);
  const slot = schedule?.games.find((item) => item.gameId === input.gameId);
  if (!schedule || schedule.editionId !== edition.editionId
    || schedule.competitionId !== edition.competitionId
    || !slot || slot.gameDay !== input.gameDay || slot.venueId !== game.venueId) {
    throw new Error('Premier12 fixture differs from accepted schedule');
  }
  const binding = stores.matches.registerOfficialFixture({ gameId: game.gameId,
    venueId: game.venueId, fixtureRevision: 1,
    fixtureEventId: JSON.stringify(['premier-12-fixture-v1', input.careerId,
      edition.competitionId, edition.editionId, edition.formatVersion,
      edition.ruleProfileVersion, edition.gamePolicyVersion,
      edition.qualificationCutoffSnapshotId, edition.rankingSnapshotId,
      edition.drawSnapshotId, edition.hostingPolicyVersion,
      game.gameId, input.gameDay, game.homeNationId, game.awayNationId, game.venueId,
      schedule.policy.version, schedule.policy.gamesPerVenuePerDay,
      schedule.policy.minimumOffDaysBetweenRounds, slot.stage, slot.roundIndex,
      slot.venueGameOrdinal]),
  });
  return Object.freeze({ edition, game, gameDay: input.gameDay, binding });
};
