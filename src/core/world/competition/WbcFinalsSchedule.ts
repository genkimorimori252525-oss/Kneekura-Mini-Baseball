import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { WbcFinalsGroupEdition, WbcFinalsGroupPlan } from './WbcFinalsGroups';
import { assertWbcKnockoutEdition, wbcKnockoutGameId, type WbcKnockoutEdition,
  type WbcKnockoutGame } from './WbcFinalsKnockout';

export type WbcFinalsSchedulePolicy = Readonly<{
  version: string;
  gamesPerVenuePerDay: number;
  minimumOffDaysBetweenRounds: number;
}>;
export type WbcFinalsScheduleSlot = Readonly<{
  gameId: string;
  gameDay: number;
  venueId: string;
  venueGameOrdinal: number;
  stage: 'GROUP' | WbcKnockoutGame['stage'];
  roundIndex: number;
}>;
export type WbcFinalsSchedule = Readonly<{
  competitionId: string;
  editionId: string;
  policy: WbcFinalsSchedulePolicy;
  source: Readonly<{ groupEdition: WbcFinalsGroupEdition;
    groupPlan: WbcFinalsGroupPlan; knockoutEdition: WbcKnockoutEdition }>;
  games: readonly WbcFinalsScheduleSlot[];
}>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const pairKey = (left: string, right: string): string => JSON.stringify([left, right].sort());

/** Three group rounds and four US knockout rounds share one frozen calendar. */
export const planWbcFinalsSchedule = (
  edition: WbcFinalsGroupEdition,
  plan: WbcFinalsGroupPlan,
  knockoutEdition: WbcKnockoutEdition,
  policy: WbcFinalsSchedulePolicy,
): WbcFinalsSchedule => {
  if (!id(policy?.version) || !day(policy.gamesPerVenuePerDay)
    || policy.gamesPerVenuePerDay === 0 || !day(policy.minimumOffDaysBetweenRounds)) {
    throw new Error('invalid WBC finals schedule policy');
  }
  if (!day(edition?.calendarWindow?.startsOnDay) || !day(edition.calendarWindow.endsOnDay)
    || edition.calendarWindow.startsOnDay > edition.calendarWindow.endsOnDay) {
    throw new Error('invalid WBC finals schedule window');
  }
  assertWbcKnockoutEdition(knockoutEdition, edition);
  if (edition.canonicalRole !== 'NATIONAL_WORLD_CHAMPIONSHIP' || edition.hostNationId !== 'US'
    || plan?.competitionId !== edition.competitionId || plan.editionId !== edition.editionId
    || plan.qualificationSnapshotId !== edition.qualificationSnapshotId
    || plan.drawSnapshotId !== edition.drawSnapshotId
    || plan.hostingPolicyVersion !== edition.hostingPolicyVersion
    || !Array.isArray(plan.groups) || plan.groups.length !== 6
    || !Array.isArray(edition.groups) || edition.groups.length !== 6) {
    throw new Error('WBC schedule requires matching group plan');
  }
  const nations = new Set<string>();
  const gameIds = new Set<string>();
  const rounds = plan.groups.map((group: WbcFinalsGroupPlan['groups'][number], groupIndex: number) => {
    const draw = edition.groups[groupIndex];
    if (group.groupIndex !== groupIndex || draw?.groupIndex !== groupIndex
      || !Array.isArray(group.nationIds) || group.nationIds.length !== 4
      || new Set(group.nationIds).size !== 4
      || group.nationIds.some((nationId) => !id(nationId) || nations.has(nationId))
      || JSON.stringify(group.nationIds) !== JSON.stringify(draw.nationIds)
      || group.hostVenueId !== draw.hostVenueId || !id(draw.hostVenueId)
      || group.hostCityId !== draw.hostCityId
      || !Array.isArray(group.games) || group.games.length !== 6) {
      throw new Error('WBC schedule requires matching group plan');
    }
    group.nationIds.forEach((nationId) => nations.add(nationId));
    const pairs = new Map<string, typeof group.games[number]>();
    for (const game of group.games) {
      const key = pairKey(game.homeNationId, game.awayNationId);
      if (!id(game.gameId) || gameIds.has(game.gameId) || pairs.has(key)
        || game.homeNationId === game.awayNationId
        || !group.nationIds.includes(game.homeNationId)
        || !group.nationIds.includes(game.awayNationId) || game.venueId !== draw.hostVenueId) {
        throw new Error('WBC schedule requires matching group plan');
      }
      gameIds.add(game.gameId);
      pairs.set(key, game);
    }
    const rotation = [...group.nationIds];
    return Array.from({ length: 3 }, () => {
      const round = [0, 1].map((index) => {
        const game = pairs.get(pairKey(rotation[index], rotation[3 - index]));
        if (!game) throw new Error('WBC schedule requires matching group plan');
        return game;
      });
      rotation.splice(1, 0, rotation.pop()!);
      return round;
    });
  });
  if (new Set(plan.groups.map((group) => group.hostVenueId)).size !== 6) {
    throw new Error('WBC schedule requires six group venues');
  }
  const games: WbcFinalsScheduleSlot[] = [];
  let startsOnDay = edition.calendarWindow.startsOnDay;
  const allocate = (items: readonly Readonly<{ gameId: string; venueId: string;
    stage: WbcFinalsScheduleSlot['stage'] }>[], roundIndex: number): void => {
    const counts = new Map<string, number>();
    let endsOnDay = startsOnDay;
    for (const item of items) {
      const count = counts.get(item.venueId) ?? 0;
      const gameDay = startsOnDay + Math.floor(count / policy.gamesPerVenuePerDay);
      if (!day(gameDay) || gameDay > edition.calendarWindow.endsOnDay) {
        throw new Error('WBC window cannot contain the full schedule');
      }
      games.push(Object.freeze({ ...item, roundIndex, gameDay,
        venueGameOrdinal: count % policy.gamesPerVenuePerDay }));
      counts.set(item.venueId, count + 1);
      endsOnDay = Math.max(endsOnDay, gameDay);
    }
    startsOnDay = endsOnDay + policy.minimumOffDaysBetweenRounds + 1;
  };
  for (let roundIndex = 0; roundIndex < 3; roundIndex++) {
    allocate(rounds.flatMap((group) => group[roundIndex].map((game) => ({
      gameId: game.gameId, venueId: game.venueId, stage: 'GROUP' as const }))), roundIndex);
  }
  const stage = (name: WbcKnockoutGame['stage'], venueIds: readonly string[], roundIndex: number): void =>
    allocate(venueIds.map((venueId, stageIndex) => ({ venueId, stage: name,
      gameId: wbcKnockoutGameId(knockoutEdition, name, stageIndex) })), roundIndex);
  stage('ROUND_OF_16', knockoutEdition.roundOf16HubIndices.map((index) =>
    knockoutEdition.knockoutHubs[index].venueId), 3);
  stage('QUARTERFINAL', knockoutEdition.quarterfinalHubIndices.map((index) =>
    knockoutEdition.knockoutHubs[index].venueId), 4);
  stage('SEMIFINAL', [knockoutEdition.finalFourHost.venueId, knockoutEdition.finalFourHost.venueId], 5);
  stage('FINAL', [knockoutEdition.finalFourHost.venueId], 6);
  games.sort((left, right) => left.gameDay - right.gameDay
    || (left.venueId < right.venueId ? -1 : left.venueId > right.venueId ? 1 : 0)
    || left.venueGameOrdinal - right.venueGameOrdinal);
  return Object.freeze({ competitionId: edition.competitionId, editionId: edition.editionId,
    policy: Object.freeze({ ...policy }), source: Object.freeze({ groupEdition: cloneInert(edition),
      groupPlan: cloneInert(plan), knockoutEdition: cloneInert(knockoutEdition) }),
    games: Object.freeze(games) });
};
