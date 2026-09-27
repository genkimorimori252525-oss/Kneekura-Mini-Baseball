import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { expect, it } from 'vitest';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import type { ClubWorldRegion } from
  '../../core/world/competition/ClubWorldBerths';
import type { WorldCompetitionCycleInput } from
  '../../core/world/competition/WorldCompetitionCycleCalendar';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { openSqliteDomesticScheduleStore } from
  './SqliteDomesticScheduleStore';
import { openSqliteWorldCompetitionCycleStore } from
  './SqliteWorldCompetitionCycleStore';
import { openSqliteWorldSettlementStore } from
  './SqliteWorldSettlementStore';
import { initializeWorldBoundDomesticSeason } from
  './WorldBoundDomesticSeasonRuntime';

const regions: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const date = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const window = (year: number, month: number,
  start: number, end: number) => ({
  startsOn: date(year, month, start),
  endsOn: date(year, month, end),
});
const cycleInput: WorldCompetitionCycleInput = {
  careerStartYear: 2031, cycleOrdinal: 0,
  calendarPolicyVersion: 'world-calendar-v1',
  fixedEvents: [
    ...regions.map((region) => ({ kind: 'REGIONAL_NATIONAL' as const,
      calendarYear: 2031, region, window: window(2031, 5, 1, 10) })),
    { kind: 'WBC', calendarYear: 2032,
      window: window(2032, 3, 1, 20) },
    { kind: 'CLUB_WORLD', calendarYear: 2033,
      window: window(2033, 12, 1, 20) },
    { kind: 'PREMIER_12', calendarYear: 2034,
      window: window(2034, 11, 10, 20) },
  ],
  continentalChoices: [2031, 2032, 2033, 2034].flatMap((calendarYear) =>
    regions.map((region) => ({ calendarYear, region,
      candidates: region === 'ASIA_PACIFIC' ? [
        window(calendarYear, 11, 15, 25),
        window(calendarYear, 10, 20, 30),
      ] : [window(calendarYear, {
        AMERICAS: 2, EUROPE: 10, AFRICA: 4,
        ASIA_PACIFIC: 11 }[region], 1, 10)] }))),
};

it('commits a domestic season only after replaying the frozen World cycle', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-world-bound-'));
  const worldPath = join(directory, 'world.sqlite');
  let cycle = openSqliteWorldCompetitionCycleStore(worldPath);
  const world = openSqliteWorldSettlementStore(worldPath);
  const archive = openSqliteDomesticScheduleStore(worldPath);
  const match = new SqliteOfficialStateStore(join(directory, 'match.sqlite'));
  try {
    cycle.initialize('career-a', cycleInput);
    cycle.close();
    cycle = openSqliteWorldCompetitionCycleStore(worldPath);
    const clubs = [state(), { ...state(),
      identity: { ...state().identity, clubId: 'club-b' },
      live: { ...state().live, references: {
        ...state().live.references,
        rivalryStateRefs: [{ fromClubId: 'club-b',
          toClubId: 'club-a', stateRef: 'rivalry-b-a' }],
      } },
    }];
    const input = {
      careerId: 'career-a', cycleOrdinal: 0,
      leagueRegion: 'ASIA_PACIFIC' as const,
      seasonDayOne: '2032-02-20', clubs,
      standingsPolicy: { version: 'standings-v1',
        tieCreditNumerator: 1, tieCreditDenominator: 2,
        runDifferentialCapPerGame: 10 },
      eventProfile: { version: 'events-v1', allStarEnabled: false,
        marketWindows: [], rosterExpansionEnabled: false,
        awardSelectionPolicyVersion: 'award-v1' },
      generatorInput: {
        seasonId: 'league-season-1', leagueId: 'league-a',
        calendarProfileVersion: 'calendar-v1',
        generatorVersion: 'generator-v1', scheduleSeed: 'seed-a',
        opponentMatrixVersion: 'matrix-v1',
        regularSeasonGamesPerClub: 4,
        memberClubIds: ['club-a', 'club-b'],
        opponentMatrix: [
          { homeClubId: 'club-a', awayClubId: 'club-b', gameCount: 2 },
          { homeClubId: 'club-b', awayClubId: 'club-a', gameCount: 2 },
        ],
        allowedDays: Array.from({ length: 27 }, (_, index) =>
          index + 10),
        reservedWindows: [], preferredSeriesLength: 2 as const,
        minimumDaysBetweenRounds: 0,
      },
    };
    const bound = initializeWorldBoundDomesticSeason({
      cycle, world, archive, match }, input);
    expect(bound.schedule.baseSchedule.worldWindowSnapshotId)
      .toBe(bound.worldWindowSnapshotId);
    expect(bound.schedule.baseSchedule.reservedWindows)
      .toContainEqual({ kind: 'WORLD', startsOnDay: 11,
        endsOnDay: 30 });
    expect(bound.schedule.baseSchedule.games).toHaveLength(4);
    expect(bound.schedule.baseSchedule.games.every((game) =>
      game.day > 30)).toBe(true);
    expect(archive.read('career-a', 'league-season-1')?.baseSchedule)
      .toEqual(bound.schedule.baseSchedule);
    expect(initializeWorldBoundDomesticSeason({ cycle, world, archive,
      match }, input)).toEqual(bound);
  } finally {
    cycle.close(); world.close(); archive.close(); match.close();
    const root = realpathSync(tmpdir());
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-world-bound-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
