import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { planWbcGlobalQualifier, type WbcGlobalQualifierEdition,
  type WbcGlobalQualifierPlan } from './WbcGlobalQualifierPods';

export type WbcQualifierSchedulePolicy = Readonly<{
  version: string;
  gamesPerVenuePerDay: number;
  minimumOffDaysBetweenRounds: number;
}>;
export type WbcQualifierScheduleSlot = Readonly<{
  gameId: string;
  podIndex: number;
  venueId: string;
  gameDay: number;
  venueGameOrdinal: number;
  stage: 'SEMIFINAL' | 'FINAL';
  roundIndex: number;
}>;
export type WbcQualifierSchedule = Readonly<{
  competitionId: string;
  editionId: string;
  calendarWindow: WbcGlobalQualifierEdition['calendarWindow'];
  policy: WbcQualifierSchedulePolicy;
  source: Readonly<{ edition: WbcGlobalQualifierEdition; plan: WbcGlobalQualifierPlan }>;
  games: readonly WbcQualifierScheduleSlot[];
}>;
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const freezeSnapshot = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freezeSnapshot);
    Object.freeze(value);
  }
  return value;
};

/** Final slots reserve capacity without deciding the nations that qualify. */
export const planWbcQualifierSchedule = (
  edition: WbcGlobalQualifierEdition,
  plan: WbcGlobalQualifierPlan,
  policy: WbcQualifierSchedulePolicy,
): WbcQualifierSchedule => {
  if (typeof policy?.version !== 'string' || !policy.version.length
    || policy.version !== policy.version.trim() || !day(policy.gamesPerVenuePerDay)
    || policy.gamesPerVenuePerDay === 0 || !day(policy.minimumOffDaysBetweenRounds)) {
    throw new Error('invalid WBC qualifier schedule policy');
  }
  const expected = planWbcGlobalQualifier(edition);
  if (JSON.stringify(plan) !== JSON.stringify(expected)) {
    throw new Error('WBC qualifier schedule requires matching pod plan');
  }
  const games: WbcQualifierScheduleSlot[] = [];
  let roundStartsOnDay = edition.calendarWindow.startsOnDay;
  const allocate = (items: readonly Readonly<{ gameId: string; podIndex: number;
    venueId: string }>[], stage: WbcQualifierScheduleSlot['stage'], roundIndex: number): void => {
    const counts = new Map<string, number>();
    let roundEndsOnDay = roundStartsOnDay;
    for (const item of items) {
      const count = counts.get(item.venueId) ?? 0;
      const gameDay = roundStartsOnDay + Math.floor(count / policy.gamesPerVenuePerDay);
      if (!day(gameDay) || gameDay > edition.calendarWindow.endsOnDay) {
        throw new Error('WBC qualifier window cannot contain the full schedule');
      }
      games.push(Object.freeze({ ...item, stage, roundIndex, gameDay,
        venueGameOrdinal: count % policy.gamesPerVenuePerDay }));
      counts.set(item.venueId, count + 1);
      roundEndsOnDay = Math.max(roundEndsOnDay, gameDay);
    }
    roundStartsOnDay = roundEndsOnDay + policy.minimumOffDaysBetweenRounds + 1;
  };
  allocate(expected.pods.flatMap((pod) => pod.semifinals.map((game) => ({
    gameId: game.gameId, podIndex: pod.podIndex, venueId: game.venueId }))), 'SEMIFINAL', 0);
  allocate(expected.pods.map((pod) => ({ gameId: pod.finalGameId,
    podIndex: pod.podIndex, venueId: pod.hostVenueId })), 'FINAL', 1);
  games.sort((left, right) => left.gameDay - right.gameDay
    || (left.venueId < right.venueId ? -1 : left.venueId > right.venueId ? 1 : 0)
    || left.venueGameOrdinal - right.venueGameOrdinal);
  return Object.freeze({ competitionId: edition.competitionId, editionId: edition.editionId,
    calendarWindow: Object.freeze({ ...edition.calendarWindow }), policy: Object.freeze({ ...policy }),
    source: freezeSnapshot({ edition: cloneInert(edition), plan: cloneInert(plan) }),
    games: Object.freeze(games) });
};
