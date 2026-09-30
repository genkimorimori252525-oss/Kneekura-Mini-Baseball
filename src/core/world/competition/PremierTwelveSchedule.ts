import { premierTwelveFinalFourGameIds, type PremierTwelveEdition,
  type PremierTwelveGroupPlan } from './PremierTwelve';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';

export type PremierTwelveSchedulePolicy = Readonly<{
  version: string;
  gamesPerVenuePerDay: number;
  minimumOffDaysBetweenRounds: number;
}>;
export type PremierTwelveScheduleSlot = Readonly<{
  gameId: string;
  gameDay: number;
  venueId: string;
  venueGameOrdinal: number;
  stage: 'GROUP' | 'SEMIFINAL' | 'BRONZE' | 'FINAL';
  roundIndex: number;
}>;
export type PremierTwelveSchedule = Readonly<{
  competitionId: string;
  editionId: string;
  policy: PremierTwelveSchedulePolicy;
  calendarWindow: PremierTwelveEdition['calendarWindow'];
  source: Readonly<{ edition: PremierTwelveEdition; groupPlan: PremierTwelveGroupPlan }>;
  games: readonly PremierTwelveScheduleSlot[];
}>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const pairKey = (left: string, right: string): string => JSON.stringify([left, right].sort());

/** Circle rounds preserve the accepted games; capacity and off days are explicit policy inputs. */
export const planPremierTwelveSchedule = (
  edition: PremierTwelveEdition,
  plan: PremierTwelveGroupPlan,
  policy: PremierTwelveSchedulePolicy,
): PremierTwelveSchedule => {
  if (!id(policy?.version) || !day(policy.gamesPerVenuePerDay)
    || policy.gamesPerVenuePerDay === 0 || !day(policy.minimumOffDaysBetweenRounds)) {
    throw new Error('invalid Premier12 schedule policy');
  }
  if (!day(edition?.calendarWindow?.startsOnDay) || !day(edition.calendarWindow.endsOnDay)
    || edition.calendarWindow.startsOnDay > edition.calendarWindow.endsOnDay) {
    throw new Error('invalid Premier12 schedule window');
  }
  if (edition.canonicalRole !== 'PREMIER_12' || !id(edition.competitionId)
    || !id(edition.editionId) || !id(edition.finalFourHost?.venueId)
    || plan?.competitionId !== edition.competitionId || plan.editionId !== edition.editionId
    || plan.drawSnapshotId !== edition.drawSnapshotId
    || plan.rankingSnapshotId !== edition.rankingSnapshotId
    || plan.hostingPolicyVersion !== edition.hostingPolicyVersion
    || !Array.isArray(plan.groups) || plan.groups.length !== 2
    || !Array.isArray(edition.groups) || edition.groups.length !== 2
    || !Array.isArray(edition.groupHosts) || edition.groupHosts.length !== 2) {
    throw new Error('Premier12 schedule requires matching group plan');
  }
  const nations = new Set<string>();
  const gameIds = new Set<string>();
  const rounds = plan.groups.map((group: PremierTwelveGroupPlan['groups'][number],
    groupIndex: number) => {
    const draw = edition.groups[groupIndex];
    const host = edition.groupHosts[groupIndex];
    if (group.groupIndex !== groupIndex || draw?.groupIndex !== groupIndex
      || host?.groupIndex !== groupIndex || !Array.isArray(group.nationIds)
      || group.nationIds.length !== 6 || new Set(group.nationIds).size !== 6
      || group.nationIds.some((nationId) => !id(nationId) || nations.has(nationId))
      || JSON.stringify(group.nationIds) !== JSON.stringify(draw.nationIds)
      || group.hostVenueId !== host.venueId || !id(host.venueId)
      || !Array.isArray(group.games) || group.games.length !== 15) {
      throw new Error('Premier12 schedule requires matching group plan');
    }
    group.nationIds.forEach((nationId) => nations.add(nationId));
    const pairs = new Map<string, typeof group.games[number]>();
    for (const game of group.games) {
      const key = pairKey(game.homeNationId, game.awayNationId);
      if (!id(game.gameId) || gameIds.has(game.gameId) || pairs.has(key)
        || game.homeNationId === game.awayNationId
        || !group.nationIds.includes(game.homeNationId)
        || !group.nationIds.includes(game.awayNationId) || game.venueId !== host.venueId) {
        throw new Error('Premier12 schedule requires matching group plan');
      }
      gameIds.add(game.gameId);
      pairs.set(key, game);
    }
    const rotation = [...group.nationIds];
    return Array.from({ length: 5 }, () => {
      const round = [0, 1, 2].map((index) => {
        const game = pairs.get(pairKey(rotation[index], rotation[5 - index]));
        if (!game) throw new Error('Premier12 schedule requires matching group plan');
        return game;
      });
      rotation.splice(1, 0, rotation.pop()!);
      return round;
    });
  });
  if (new Set(plan.groups.map((group) => group.hostVenueId)).size !== 2) {
    throw new Error('Premier12 schedule requires matching group plan');
  }
  const games: PremierTwelveScheduleSlot[] = [];
  let startsOnDay = edition.calendarWindow.startsOnDay;
  const allocate = (items: readonly Readonly<{ gameId: string; venueId: string;
    stage: PremierTwelveScheduleSlot['stage'] }>[], roundIndex: number): void => {
    const counts = new Map<string, number>();
    let endsOnDay = startsOnDay;
    for (const item of items) {
      const count = counts.get(item.venueId) ?? 0;
      const gameDay = startsOnDay + Math.floor(count / policy.gamesPerVenuePerDay);
      if (!day(gameDay) || gameDay > edition.calendarWindow.endsOnDay) {
        throw new Error('Premier12 window cannot contain the full schedule');
      }
      games.push(Object.freeze({ ...item, roundIndex, gameDay,
        venueGameOrdinal: count % policy.gamesPerVenuePerDay }));
      counts.set(item.venueId, count + 1);
      endsOnDay = Math.max(endsOnDay, gameDay);
    }
    startsOnDay = endsOnDay + policy.minimumOffDaysBetweenRounds + 1;
  };
  for (let roundIndex = 0; roundIndex < 5; roundIndex++) {
    allocate(rounds.flatMap((group) => group[roundIndex].map((game) => ({
      gameId: game.gameId, venueId: game.venueId, stage: 'GROUP' as const }))), roundIndex);
  }
  const knockoutIds = premierTwelveFinalFourGameIds(edition);
  allocate(knockoutIds.semifinalGameIds.map((gameId) => ({ gameId,
    venueId: edition.finalFourHost.venueId, stage: 'SEMIFINAL' })), 5);
  allocate([{ gameId: knockoutIds.bronzeGameId, venueId: edition.finalFourHost.venueId,
    stage: 'BRONZE' }, { gameId: knockoutIds.finalGameId,
    venueId: edition.finalFourHost.venueId, stage: 'FINAL' }], 6);
  games.sort((left, right) => left.gameDay - right.gameDay
    || (left.venueId < right.venueId ? -1 : left.venueId > right.venueId ? 1 : 0)
    || left.venueGameOrdinal - right.venueGameOrdinal);
  return Object.freeze({ competitionId: edition.competitionId, editionId: edition.editionId,
    policy: Object.freeze({ ...policy }),
    source: Object.freeze({ edition: cloneInert(edition), groupPlan: cloneInert(plan) }),
    calendarWindow: Object.freeze({ ...edition.calendarWindow }), games: Object.freeze(games) });
};
