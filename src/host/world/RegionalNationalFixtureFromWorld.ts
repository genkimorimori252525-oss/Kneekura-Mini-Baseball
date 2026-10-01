import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { OfficialGameVenueBinding } from '../../core/world/competition/OfficialGameCompletion';
import type { RegionalNationalEdition, RegionalNationalGroupGame } from
  '../../core/world/competition/RegionalNationalGroups';
import type { RegionalNationalKnockoutGame } from '../../core/world/competition/RegionalNationalKnockout';
import type { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import type { SqliteRegionalNationalGroupStore } from './SqliteRegionalNationalGroupStore';
import type { SqliteRegionalNationalKnockoutStore } from './SqliteRegionalNationalKnockoutStore';
import type { SqliteRegionalNationalScheduleStore } from './SqliteRegionalNationalScheduleStore';
import { withCompetitionSourceReadScope, withCompetitionSourceReadPhase } from './CompetitionSourceReadScope';

export type RegionalNationalFixture = Readonly<{
  edition: RegionalNationalEdition;
  game: RegionalNationalGroupGame | RegionalNationalKnockoutGame;
  gameDay: number;
  binding: OfficialGameVenueBinding;
}>;
const canonicalJson = (value: unknown): string => JSON.stringify(cloneInert(value),
  (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);

type RegionalFixtureStores = Readonly<{
    groups: Pick<SqliteRegionalNationalGroupStore, 'readEdition' | 'readPlan'>;
    knockout: Pick<SqliteRegionalNationalKnockoutStore, 'readEdition' | 'readPlan' |
      'readSemifinalGames' | 'readFinalGame'>;
    schedules: Pick<SqliteRegionalNationalScheduleStore, 'readSchedule'>;
    matches: Pick<SqliteOfficialStateStore, 'registerOfficialFixture'>;
  }>;
type RegionalFixtureInput = Readonly<{ careerId: string; editionId: string; gameId: string; gameDay: number }>;

/** Shared projection; the supplied Match boundary either adopts or verifies the exact fixture. */
const resolveFixture = (stores: RegionalFixtureStores, input: RegionalFixtureInput): RegionalNationalFixture => {
  const edition = stores.groups.readEdition(input.careerId, input.editionId);
  const plan = stores.groups.readPlan(input.careerId, input.editionId);
  const schedule = stores.schedules.readSchedule(input.careerId, input.editionId);
  if (!edition || !plan || !schedule || edition.editionId !== input.editionId
    || plan.editionId !== input.editionId || schedule.editionId !== input.editionId
    || !isDeepStrictEqual(schedule.source.edition, edition) || !isDeepStrictEqual(schedule.source.plan, plan)) {
    throw new Error('regional national fixture differs from accepted Edition or schedule');
  }
  const slot = schedule.games.find((game) => game.gameId === input.gameId);
  if (!slot || !Number.isSafeInteger(input.gameDay) || slot.gameDay !== input.gameDay) {
    throw new Error('regional national fixture differs from accepted schedule');
  }
  let game: RegionalNationalFixture['game'] | undefined = plan.groups.flatMap((group) => group.games)
    .find((item) => item.gameId === input.gameId);
  if (!game) {
    const knockoutEdition = stores.knockout.readEdition(input.careerId, input.editionId);
    const knockout = stores.knockout.readPlan(input.careerId, input.editionId);
    if (knockoutEdition && knockout) {
      if (!isDeepStrictEqual(knockoutEdition, schedule.source.knockoutEdition)) {
        throw new Error('regional national knockout differs from accepted schedule Edition');
      }
      game = knockout.openingGames.find((item) => item.gameId === input.gameId);
      if (!game && slot.stage === 'SEMIFINAL') {
        game = stores.knockout.readSemifinalGames(input.careerId, input.editionId)
          ?.find((item) => item.gameId === input.gameId);
      } else if (!game && slot.stage === 'FINAL') {
        game = stores.knockout.readFinalGame(input.careerId, input.editionId) ?? undefined;
      }
    }
  }
  if (!game) throw new Error('regional national fixture game is not yet qualified');
  if (game.venueId !== slot.venueId) throw new Error('regional national fixture differs from accepted schedule venue');
  const scheduleDigest = createHash('sha256').update(canonicalJson(schedule)).digest('hex');
  const binding = stores.matches.registerOfficialFixture({ gameId: game.gameId,
    venueId: game.venueId, fixtureRevision: 1,
    fixtureEventId: JSON.stringify(['regional-national-fixture-v1', input.careerId, scheduleDigest,
      input.gameDay, game.gameId, game.homeNationId, game.awayNationId]),
  });
  return Object.freeze({ edition, game, gameDay: input.gameDay, binding });
};

/** A scheduled slot cannot manufacture group winners or later knockout entrants. */
export const registerRegionalNationalFixtureFromWorld = (stores: RegionalFixtureStores, input: RegionalFixtureInput): RegionalNationalFixture =>
  withCompetitionSourceReadPhase(() => resolveFixture(stores, input));

/** Existing fixture proof traversal performs no writes and preserves the enclosing read scope. */
export const readRegionalNationalFixtureFromWorld = (stores: Omit<RegionalFixtureStores, 'matches'> & Readonly<{
  matches: Pick<SqliteOfficialStateStore, 'getOfficialFixture'>;
}>, input: RegionalFixtureInput): RegionalNationalFixture => withCompetitionSourceReadScope(() => {
  const accepted = stores.matches.getOfficialFixture(input.gameId);
  if (!accepted) throw new Error('regional national fixture is not accepted by Match');
  return resolveFixture({ ...stores, matches: { registerOfficialFixture(expected) {
    if (!isDeepStrictEqual(expected, accepted)) throw new Error('National participation fixture differs from accepted Match fixture');
    return accepted;
  } } }, input);
});
