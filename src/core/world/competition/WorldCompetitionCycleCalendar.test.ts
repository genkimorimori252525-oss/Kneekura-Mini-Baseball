import { expect, it } from 'vitest';
import type { ClubWorldRegion } from './ClubWorldBerths';
import { planWorldCompetitionCycle,
  type WorldCompetitionCycleInput }
  from './WorldCompetitionCycleCalendar';
import { generateWorldBoundLeagueSchedule }
  from './WorldLeagueSchedule';

const regions: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const date = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const window = (year: number, month: number,
  start: number, end: number) => ({
  startsOn: date(year, month, start),
  endsOn: date(year, month, end),
});
const input = (ordinal: number): WorldCompetitionCycleInput => {
  const firstYear = 2031 + ordinal * 4;
  const years = [firstYear, firstYear + 1,
    firstYear + 2, firstYear + 3];
  return { careerStartYear: 2031, cycleOrdinal: ordinal,
    calendarPolicyVersion: 'world-calendar-v1',
    fixedEvents: [
      ...regions.map((region) => ({
        kind: 'REGIONAL_NATIONAL' as const,
        calendarYear: years[0], region,
        window: window(years[0], 5, 1, 10) })),
      { kind: 'WBC', calendarYear: years[1],
        window: window(years[1], 3, 1, 20) },
      { kind: 'CLUB_WORLD', calendarYear: years[2],
        window: window(years[2], 12, 1, 20) },
      { kind: 'PREMIER_12', calendarYear: years[3],
        window: window(years[3], 11, 10, 20) },
    ],
    continentalChoices: years.flatMap((calendarYear) =>
      regions.map((region) => ({ calendarYear, region,
        candidates: region === 'ASIA_PACIFIC' ? [
          window(calendarYear, 11, 15, 25),
          window(calendarYear, 10, 20, 30),
        ] : [window(calendarYear, {
          AMERICAS: 2, EUROPE: 10, AFRICA: 4,
          ASIA_PACIFIC: 11 }[region], 1, 10)] }))),
  };
};

it('anchors the four-year cycle and shifts a conflicting continental window', () => {
  const cycle = planWorldCompetitionCycle(input(0));
  expect(cycle.calendarYears).toEqual([2031, 2032, 2033, 2034]);
  expect(cycle.reservations).toHaveLength(23);
  expect(cycle.reservations.find((item) =>
    item.kind === 'WBC')?.cycleYear).toBe(2);
  expect(cycle.reservations.find((item) =>
    item.kind === 'CLUB_WORLD')?.cycleYear).toBe(3);
  expect(cycle.reservations.find((item) =>
    item.kind === 'PREMIER_12')?.cycleYear).toBe(4);
  expect(cycle.reservations.find((item) =>
    item.kind === 'CONTINENTAL_CL'
    && item.calendarYear === 2034
    && item.region === 'ASIA_PACIFIC')?.candidateIndex).toBe(1);
  expect(cycle.reservations.find((item) =>
    item.kind === 'CONTINENTAL_CL'
    && item.calendarYear === 2031
    && item.region === 'ASIA_PACIFIC')?.candidateIndex).toBe(0);
  expect(planWorldCompetitionCycle(input(1)).calendarYears)
    .toEqual([2035, 2036, 2037, 2038]);
});

it('rejects missing Flex Window and misplaced fixed world event', () => {
  const full = input(0);
  const noFlex = { ...full,
    continentalChoices: full.continentalChoices.map((choice) =>
      choice.calendarYear === 2034
        && choice.region === 'ASIA_PACIFIC'
        ? { ...choice, candidates: choice.candidates.slice(0, 1) }
        : choice) };
  expect(() => planWorldCompetitionCycle(noFlex)).toThrow('Flex Window');
  const wrongWbc = { ...full,
    fixedEvents: full.fixedEvents.map((event) =>
      event.kind === 'WBC' ? { ...event,
        window: window(2032, 4, 1, 20) } : event) };
  expect(() => planWorldCompetitionCycle(wrongWbc)).toThrow('cycle');
  const regionalConflict = { ...full,
    fixedEvents: full.fixedEvents.map((event) =>
      event.kind === 'REGIONAL_NATIONAL'
        && event.region === 'ASIA_PACIFIC'
        ? { ...event, window: window(2031, 2, 1, 10) }
        : event) };
  expect(() => planWorldCompetitionCycle(regionalConflict))
    .toThrow('Flex Window');
});

it('binds world windows to a domestic season without reducing game count', () => {
  const cycle = planWorldCompetitionCycle(input(0));
  const scheduleInput = {
    seasonId: 'league-2032', leagueId: 'league-test',
    calendarProfileVersion: 'calendar-v1',
    generatorVersion: 'rounds-v1', scheduleSeed: 'seed-2032',
    opponentMatrixVersion: 'matrix-v1',
    regularSeasonGamesPerClub: 4,
    memberClubIds: ['a', 'b'],
    opponentMatrix: [
      { homeClubId: 'a', awayClubId: 'b', gameCount: 2 },
      { homeClubId: 'b', awayClubId: 'a', gameCount: 2 },
    ],
    allowedDays: Array.from({ length: 25 }, (_, index) =>
      index + 10),
    reservedWindows: [], preferredSeriesLength: 2 as const,
    minimumDaysBetweenRounds: 0,
  };
  const bound = generateWorldBoundLeagueSchedule(scheduleInput,
    cycle, 'ASIA_PACIFIC', '2032-02-20');
  expect(bound.schedule.games).toHaveLength(4);
  expect(bound.schedule.games.every((game) =>
    game.day > 30)).toBe(true);
  expect(bound.schedule.reservedWindows).toContainEqual({
    kind: 'WORLD', startsOnDay: 11, endsOnDay: 30 });
  expect(bound.worldWindowSnapshotId).toContain('world-league-calendar');
  expect(() => generateWorldBoundLeagueSchedule({ ...scheduleInput,
    allowedDays: scheduleInput.allowedDays.slice(0, -1) },
    cycle, 'ASIA_PACIFIC', '2032-02-20'))
    .toThrow('schedule validation failure');
  const asiaFlex = generateWorldBoundLeagueSchedule({ ...scheduleInput,
    allowedDays: Array.from({ length: 40 }, (_, index) =>
      index + 1) }, cycle, 'ASIA_PACIFIC', '2034-10-01');
  expect(asiaFlex.schedule.reservedWindows).toContainEqual({
    kind: 'CONTINENTAL', startsOnDay: 20,
    endsOnDay: 30 });
});
