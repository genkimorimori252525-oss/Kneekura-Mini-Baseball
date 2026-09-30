import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { planRegionalNationalGroups, type RegionalNationalEdition,
  type RegionalNationalGroupPlan } from './RegionalNationalGroups';
import { assertRegionalNationalKnockoutEdition, regionalNationalKnockoutGameId,
  type RegionalNationalKnockoutEdition } from './RegionalNationalKnockout';

export type RegionalNationalSchedulePolicy = Readonly<{
  version: string;
  gamesPerVenuePerDay: number;
  minimumOffDaysBetweenRounds: number;
}>;
export type RegionalNationalScheduleSlot = Readonly<{
  gameId: string;
  gameDay: number;
  venueId: string;
  venueGameOrdinal: number;
  stage: 'GROUP' | 'QUARTERFINAL' | 'SEMIFINAL' | 'FINAL';
  roundIndex: number;
}>;
export type RegionalNationalSchedule = Readonly<{
  competitionId: string;
  editionId: string;
  calendarWindow: RegionalNationalEdition['calendarWindow'];
  policy: RegionalNationalSchedulePolicy;
  source: Readonly<{ edition: RegionalNationalEdition; plan: RegionalNationalGroupPlan;
    knockoutEdition: RegionalNationalKnockoutEdition }>;
  games: readonly RegionalNationalScheduleSlot[];
}>;
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const freezeSnapshot = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freezeSnapshot); Object.freeze(value);
  }
  return value;
};
const canonicalJson = (value: unknown): string => JSON.stringify(cloneInert(value),
  (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const pairs = [[[0, 3], [1, 2]], [[0, 2], [1, 3]], [[0, 1], [2, 3]]] as const;

/** Accepted region eligibility belongs to the upstream Edition; slots do not decide qualifiers. */
export const planRegionalNationalSchedule = (
  edition: RegionalNationalEdition,
  plan: RegionalNationalGroupPlan,
  knockoutEdition: RegionalNationalKnockoutEdition,
  policy: RegionalNationalSchedulePolicy,
): RegionalNationalSchedule => {
  if (typeof policy?.version !== 'string' || !policy.version.length
    || policy.version !== policy.version.trim() || !day(policy.gamesPerVenuePerDay)
    || policy.gamesPerVenuePerDay === 0 || !day(policy.minimumOffDaysBetweenRounds)) {
    throw new Error('invalid regional national schedule policy');
  }
  const expected = planRegionalNationalGroups(edition, { nationCompetitionRegion: (nationId) =>
    edition.groups.some((group) => group.nationIds.includes(nationId)) ? edition.region : null });
  if (canonicalJson(expected) !== canonicalJson(plan)) {
    throw new Error('regional national schedule requires matching group plan');
  }
  const qualifierCount = edition.groups.length === 2 ? 4 : 8;
  assertRegionalNationalKnockoutEdition(edition, qualifierCount, knockoutEdition);
  const games: RegionalNationalScheduleSlot[] = [];
  let startsOnDay = edition.calendarWindow.startsOnDay;
  const allocate = (items: readonly Readonly<{ gameId: string; venueId: string }>[],
    stage: RegionalNationalScheduleSlot['stage'], roundIndex: number): void => {
    const counts = new Map<string, number>();
    let endsOnDay = startsOnDay;
    for (const item of items) {
      const count = counts.get(item.venueId) ?? 0;
      const gameDay = startsOnDay + Math.floor(count / policy.gamesPerVenuePerDay);
      if (!day(gameDay) || gameDay > edition.calendarWindow.endsOnDay) {
        throw new Error('regional national window cannot contain the full schedule');
      }
      games.push(Object.freeze({ ...item, stage, roundIndex, gameDay,
        venueGameOrdinal: count % policy.gamesPerVenuePerDay }));
      counts.set(item.venueId, count + 1); endsOnDay = Math.max(endsOnDay, gameDay);
    }
    startsOnDay = endsOnDay + policy.minimumOffDaysBetweenRounds + 1;
  };
  pairs.forEach((round, roundIndex) => allocate(expected.groups.flatMap((group) =>
    round.map(([a, b]) => group.games.find((game) => [game.homeNationId, game.awayNationId]
      .includes(group.nationIds[a]) && [game.homeNationId, game.awayNationId].includes(group.nationIds[b]))!)),
  'GROUP', roundIndex));
  const openingStage = qualifierCount === 8 ? 'QUARTERFINAL' : 'SEMIFINAL';
  allocate(knockoutEdition.openingVenueIds.map((venueId, index) => ({ venueId,
    gameId: regionalNationalKnockoutGameId(knockoutEdition, openingStage, index) })), openingStage, 3);
  if (qualifierCount === 8) {
    allocate(knockoutEdition.semifinalVenueIds.map((venueId, index) => ({ venueId,
      gameId: regionalNationalKnockoutGameId(knockoutEdition, 'SEMIFINAL', index) })), 'SEMIFINAL', 4);
  }
  allocate([{ venueId: knockoutEdition.finalVenueId,
    gameId: regionalNationalKnockoutGameId(knockoutEdition, 'FINAL', 0) }], 'FINAL', qualifierCount === 8 ? 5 : 4);
  games.sort((left, right) => left.gameDay - right.gameDay
    || (left.venueId < right.venueId ? -1 : left.venueId > right.venueId ? 1 : 0)
    || left.venueGameOrdinal - right.venueGameOrdinal);
  return Object.freeze({ competitionId: edition.competitionId, editionId: edition.editionId,
    calendarWindow: Object.freeze({ ...edition.calendarWindow }), policy: Object.freeze({ ...policy }),
    source: freezeSnapshot({ edition: cloneInert(edition), plan: cloneInert(plan),
      knockoutEdition: cloneInert(knockoutEdition) }), games: Object.freeze(games) });
};
