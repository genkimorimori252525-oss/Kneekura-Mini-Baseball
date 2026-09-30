import { withCompetitionSourceReadScope } from './CompetitionSourceReadScope';
import { isDeepStrictEqual } from 'node:util';
import type { OfficialGameVenueBinding } from '../../core/world/competition/OfficialGameCompletion';
import type { WbcFinalsGroupEdition, WbcFinalsGroupGame } from '../../core/world/competition/WbcFinalsGroups';
import type { WbcKnockoutGame } from '../../core/world/competition/WbcFinalsKnockout';
import type { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import type { SqliteWbcFinalsGroupStore } from './SqliteWbcFinalsGroupStore';
import type { SqliteWbcFinalsKnockoutStore } from './SqliteWbcFinalsKnockoutStore';
import type { SqliteWbcFinalsScheduleStore } from './SqliteWbcFinalsScheduleStore';

export type WbcFinalsFixture = Readonly<{
  edition: WbcFinalsGroupEdition;
  game: WbcFinalsGroupGame | WbcKnockoutGame;
  gameDay: number;
  binding: OfficialGameVenueBinding;
}>;

/** Scheduled slots do not qualify entrants: preceding official results still own that decision. */
export const registerWbcFinalsFixtureFromWorld = (
  stores: Readonly<{
    groups: Pick<SqliteWbcFinalsGroupStore, 'readEdition' | 'readPlan'>;
    knockout: Pick<SqliteWbcFinalsKnockoutStore, 'readEdition' | 'readPlan' |
      'quarterfinalGames' | 'semifinalGames' | 'finalGame'>;
    schedules: Pick<SqliteWbcFinalsScheduleStore, 'readSchedule'>;
    matches: Pick<SqliteOfficialStateStore, 'registerOfficialFixture'>;
  }>,
  input: Readonly<{ careerId: string; editionId: string; gameId: string; gameDay: number }>,
): WbcFinalsFixture => withCompetitionSourceReadScope(() => {
  const edition = stores.groups.readEdition(input.careerId, input.editionId);
  const plan = stores.groups.readPlan(input.careerId, input.editionId);
  const schedule = stores.schedules.readSchedule(input.careerId, input.editionId);
  if (!edition || !plan || !schedule || edition.editionId !== input.editionId
    || plan.editionId !== edition.editionId || schedule.editionId !== edition.editionId
    || plan.competitionId !== edition.competitionId || schedule.competitionId !== edition.competitionId
    || !isDeepStrictEqual(schedule.source.groupEdition, edition)
    || !isDeepStrictEqual(schedule.source.groupPlan, plan)) {
    throw new Error('WBC fixture differs from accepted Edition or schedule');
  }
  const slot = schedule.games.find((item) => item.gameId === input.gameId);
  if (!slot || !Number.isSafeInteger(input.gameDay) || slot.gameDay !== input.gameDay) {
    throw new Error('WBC fixture differs from accepted schedule');
  }
  let game: WbcFinalsFixture['game'] | undefined = plan.groups.flatMap((group) => group.games)
    .find((item) => item.gameId === input.gameId);
  if (!game) {
    const knockoutEdition = stores.knockout.readEdition(input.careerId, input.editionId);
    const knockout = stores.knockout.readPlan(input.careerId, input.editionId);
    if (knockout && knockoutEdition) {
      if (!isDeepStrictEqual(schedule.source.knockoutEdition, knockoutEdition)) {
        throw new Error('WBC knockout differs from accepted schedule Edition');
      }
      if (slot.stage === 'ROUND_OF_16') {
        game = knockout.roundOf16Games.find((item) => item.gameId === input.gameId);
      } else if (slot.stage === 'QUARTERFINAL') {
        game = stores.knockout.quarterfinalGames(input.careerId, input.editionId)
          ?.find((item) => item.gameId === input.gameId);
      } else if (slot.stage === 'SEMIFINAL') {
        game = stores.knockout.semifinalGames(input.careerId, input.editionId)
          ?.find((item) => item.gameId === input.gameId);
      } else if (slot.stage === 'FINAL') {
        game = stores.knockout.finalGame(input.careerId, input.editionId) ?? undefined;
      }
    }
  }
  if (!game) throw new Error('WBC fixture game is not yet qualified');
  if (game.venueId !== slot.venueId) throw new Error('WBC fixture differs from accepted schedule venue');
  const binding = stores.matches.registerOfficialFixture({ gameId: game.gameId,
    venueId: game.venueId, fixtureRevision: 1,
    fixtureEventId: JSON.stringify(['wbc-finals-fixture-v1', input.careerId,
      edition.competitionId, edition.editionId, edition.formatVersion,
      edition.ruleProfileVersion, edition.gamePolicyVersion, edition.qualificationSnapshotId,
      edition.drawSnapshotId, edition.hostingPolicyVersion, schedule.source.knockoutEdition.knockoutPolicyVersion,
      game.gameId, input.gameDay, game.homeNationId, game.awayNationId, game.venueId,
      schedule.policy.version, schedule.policy.gamesPerVenuePerDay,
      schedule.policy.minimumOffDaysBetweenRounds, slot.stage, slot.roundIndex, slot.venueGameOrdinal]),
  });
  return Object.freeze({ edition, game, gameDay: input.gameDay, binding });
});
