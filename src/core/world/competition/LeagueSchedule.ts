export type DomesticSeries = Readonly<{
  seriesId: string;
  homeClubId: string;
  awayClubId: string;
  startsOnDay: number;
  gameCount: 2 | 3 | 4;
}>;
export type ScheduleGame = Readonly<{
  gameId: string;
  seriesId: string;
  day: number;
  homeClubId: string;
  awayClubId: string;
}>;
export type OpponentMatrixEntry = Readonly<{
  homeClubId: string;
  awayClubId: string;
  gameCount: number;
}>;
export type ReservedCalendarWindow = Readonly<{
  kind: 'WORLD' | 'CONTINENTAL' | 'POSTSEASON';
  startsOnDay: number;
  endsOnDay: number;
}>;
export type LeagueScheduleInput = Readonly<{
  seasonId: string;
  leagueId: string;
  calendarProfileVersion: string;
  generatorVersion: string;
  scheduleSeed: string;
  opponentMatrixVersion: string;
  regularSeasonGamesPerClub: number;
  memberClubIds: readonly string[];
  opponentMatrix: readonly OpponentMatrixEntry[];
  allowedDays: readonly number[];
  reservedWindows: readonly ReservedCalendarWindow[];
  series: readonly DomesticSeries[];
}>;
export type BaseScheduleSnapshot = Readonly<LeagueScheduleInput & {
  games: readonly ScheduleGame[];
  revisionEventIds: readonly string[];
}>;
export type ScheduleRevisionEvent = Readonly<{
  eventId: string;
  gameId: string;
  newDay: number;
  reason: 'RAINOUT' | 'VENUE' | 'WORLD_CALENDAR' | 'OTHER';
}>;
export type CurrentLeagueSchedule = Readonly<BaseScheduleSnapshot>;

const validId = (value: string): boolean => typeof value === 'string' && value.length > 0;
const validDay = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;
const pairKey = (homeClubId: string, awayClubId: string): string =>
  JSON.stringify([homeClubId, awayClubId]);

const validateGames = (
  input: LeagueScheduleInput,
  games: readonly ScheduleGame[],
): void => {
  const memberIds = new Set(input.memberClubIds);
  const allowedDays = new Set(input.allowedDays);
  const gamesByClub = new Map(input.memberClubIds.map((id) => [id, 0]));
  const actualMatrix = new Map<string, number>();
  const occupied = new Set<string>();
  for (const game of games) {
    if (!allowedDays.has(game.day)) throw new Error('schedule game falls outside allowed regular-season days');
    if (input.reservedWindows.some((reserved) =>
      game.day >= reserved.startsOnDay && game.day <= reserved.endsOnDay)) {
      throw new Error('schedule game overlaps a reserved competition or postseason window');
    }
    if (!memberIds.has(game.homeClubId) || !memberIds.has(game.awayClubId)
      || game.homeClubId === game.awayClubId) {
      throw new Error('schedule game has invalid league membership');
    }
    for (const clubId of [game.homeClubId, game.awayClubId]) {
      const key = JSON.stringify([clubId, game.day]);
      if (occupied.has(key)) throw new Error('simultaneous games for one club are forbidden');
      occupied.add(key);
      gamesByClub.set(clubId, gamesByClub.get(clubId)! + 1);
    }
    const pair = pairKey(game.homeClubId, game.awayClubId);
    actualMatrix.set(pair, (actualMatrix.get(pair) ?? 0) + 1);
  }
  if ([...gamesByClub.values()].some((count) => count !== input.regularSeasonGamesPerClub)) {
    throw new Error('official regular-season game count must not be reduced');
  }
  const expectedMatrix = new Map(input.opponentMatrix.map((entry) => [
    pairKey(entry.homeClubId, entry.awayClubId), entry.gameCount,
  ]));
  if (
    actualMatrix.size !== expectedMatrix.size
    || [...actualMatrix].some(([pair, count]) => expectedMatrix.get(pair) !== count)
  ) throw new Error('schedule does not match the frozen opponent matrix');
};

export const createBaseScheduleSnapshot = (
  input: LeagueScheduleInput,
): BaseScheduleSnapshot => {
  for (const value of [
    input.seasonId, input.leagueId, input.calendarProfileVersion,
    input.generatorVersion, input.scheduleSeed, input.opponentMatrixVersion,
  ]) if (!validId(value)) throw new Error('schedule provenance identifiers are required');
  if (
    !Number.isSafeInteger(input.regularSeasonGamesPerClub)
    || input.regularSeasonGamesPerClub <= 0
    || input.memberClubIds.length < 2
    || input.memberClubIds.some((id) => !validId(id))
    || new Set(input.memberClubIds).size !== input.memberClubIds.length
    || input.allowedDays.length === 0
    || input.allowedDays.some((day) => !validDay(day))
    || new Set(input.allowedDays).size !== input.allowedDays.length
  ) throw new Error('invalid league schedule profile or membership');
  const memberIds = new Set(input.memberClubIds);
  const matrixKeys = new Set<string>();
  for (const entry of input.opponentMatrix) {
    const key = pairKey(entry.homeClubId, entry.awayClubId);
    if (
      !memberIds.has(entry.homeClubId) || !memberIds.has(entry.awayClubId)
      || entry.homeClubId === entry.awayClubId || matrixKeys.has(key)
      || !Number.isSafeInteger(entry.gameCount) || entry.gameCount <= 0
    ) throw new Error('invalid opponent matrix');
    matrixKeys.add(key);
  }
  for (const reserved of input.reservedWindows) {
    if (!['WORLD', 'CONTINENTAL', 'POSTSEASON'].includes(reserved.kind)
      || !validDay(reserved.startsOnDay) || !validDay(reserved.endsOnDay)
      || reserved.endsOnDay < reserved.startsOnDay) {
      throw new Error('invalid reserved competition window');
    }
  }
  const seriesIds = new Set<string>();
  const games: ScheduleGame[] = [];
  for (const series of input.series) {
    if (
      !validId(series.seriesId) || seriesIds.has(series.seriesId)
      || !memberIds.has(series.homeClubId) || !memberIds.has(series.awayClubId)
      || series.homeClubId === series.awayClubId
      || !validDay(series.startsOnDay)
      || ![2, 3, 4].includes(series.gameCount)
    ) throw new Error('invalid domestic series block');
    seriesIds.add(series.seriesId);
    for (let index = 0; index < series.gameCount; index += 1) {
      const day = series.startsOnDay + index;
      if (!validDay(day)) throw new Error('series date overflows safe integer range');
      games.push(Object.freeze({
        gameId: `${series.seriesId}:${index + 1}`,
        seriesId: series.seriesId,
        day,
        homeClubId: series.homeClubId,
        awayClubId: series.awayClubId,
      }));
    }
  }
  validateGames(input, games);
  return Object.freeze({
    ...input,
    memberClubIds: Object.freeze([...input.memberClubIds]),
    opponentMatrix: Object.freeze(input.opponentMatrix.map((entry) => Object.freeze({ ...entry }))),
    allowedDays: Object.freeze([...input.allowedDays]),
    reservedWindows: Object.freeze(input.reservedWindows.map((reserved) => Object.freeze({ ...reserved }))),
    series: Object.freeze(input.series.map((series) => Object.freeze({ ...series }))),
    games: Object.freeze(games),
    revisionEventIds: Object.freeze([]),
  });
};

export const applyScheduleRevisions = (
  base: BaseScheduleSnapshot,
  revisions: readonly ScheduleRevisionEvent[],
): CurrentLeagueSchedule => {
  const games = base.games.map((game) => ({ ...game }));
  const revisionEventIds = [...base.revisionEventIds];
  const seen = new Set(revisionEventIds);
  for (const revision of revisions) {
    if (!validId(revision.eventId) || seen.has(revision.eventId)
      || !validDay(revision.newDay)
      || !['RAINOUT', 'VENUE', 'WORLD_CALENDAR', 'OTHER'].includes(revision.reason)) {
      throw new Error('invalid or duplicate schedule revision event');
    }
    const gameIndex = games.findIndex((game) => game.gameId === revision.gameId);
    if (gameIndex < 0) throw new Error('schedule revision references unknown game');
    games[gameIndex] = { ...games[gameIndex], day: revision.newDay };
    validateGames(base, games);
    seen.add(revision.eventId);
    revisionEventIds.push(revision.eventId);
  }
  return Object.freeze({
    ...base,
    games: Object.freeze(games.map((game) => Object.freeze(game))),
    revisionEventIds: Object.freeze(revisionEventIds),
  });
};
