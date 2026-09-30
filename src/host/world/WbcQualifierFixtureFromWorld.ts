import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { OfficialGameVenueBinding } from '../../core/world/competition/OfficialGameCompletion';
import type { WbcGlobalQualifierEdition, WbcQualifierGame } from
  '../../core/world/competition/WbcGlobalQualifierPods';
import type { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import type { SqliteWbcGlobalQualifierPodStore } from './SqliteWbcGlobalQualifierPodStore';
import type { SqliteWbcQualifierScheduleStore } from './SqliteWbcQualifierScheduleStore';

export type WbcQualifierFixture = Readonly<{
  edition: WbcGlobalQualifierEdition;
  game: WbcQualifierGame;
  gameDay: number;
  binding: OfficialGameVenueBinding;
}>;
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** A reserved final slot becomes playable only after the official semifinals. */
export const registerWbcQualifierFixtureFromWorld = (
  stores: Readonly<{
    pods: Pick<SqliteWbcGlobalQualifierPodStore, 'readEdition' | 'readPlan' | 'finalGames'>;
    schedules: Pick<SqliteWbcQualifierScheduleStore, 'readSchedule'>;
    matches: Pick<SqliteOfficialStateStore, 'registerOfficialFixture'>;
  }>,
  input: Readonly<{ careerId: string; editionId: string; gameId: string; gameDay: number }>,
): WbcQualifierFixture => {
  const edition = stores.pods.readEdition(input.careerId, input.editionId);
  const plan = stores.pods.readPlan(input.careerId, input.editionId);
  const schedule = stores.schedules.readSchedule(input.careerId, input.editionId);
  if (!edition || !plan || !schedule || edition.editionId !== input.editionId
    || plan.editionId !== input.editionId || schedule.editionId !== input.editionId
    || !isDeepStrictEqual(schedule.source.edition, edition)
    || !isDeepStrictEqual(schedule.source.plan, plan)) {
    throw new Error('WBC qualifier fixture differs from accepted Edition or schedule');
  }
  const slot = schedule.games.find((game) => game.gameId === input.gameId);
  if (!slot || !Number.isSafeInteger(input.gameDay) || slot.gameDay !== input.gameDay) {
    throw new Error('WBC qualifier fixture differs from accepted schedule');
  }
  const game = slot.stage === 'SEMIFINAL'
    ? plan.pods.flatMap((pod) => pod.semifinals).find((item) => item.gameId === input.gameId)
    : stores.pods.finalGames(input.careerId, input.editionId)?.find((item) => item.gameId === input.gameId);
  if (!game) throw new Error('WBC qualifier fixture game is not yet qualified');
  if (game.venueId !== slot.venueId || game.podIndex !== slot.podIndex) {
    throw new Error('WBC qualifier fixture differs from accepted schedule venue');
  }
  const scheduleDigest = createHash('sha256').update(canonicalJson(schedule)).digest('hex');
  const binding = stores.matches.registerOfficialFixture({ gameId: game.gameId,
    venueId: game.venueId, fixtureRevision: 1,
    fixtureEventId: JSON.stringify(['wbc-qualifier-fixture-v1', input.careerId,
      scheduleDigest, input.gameDay, game.gameId, game.homeNationId, game.awayNationId]),
  });
  return Object.freeze({ edition, game, gameDay: input.gameDay, binding });
};
