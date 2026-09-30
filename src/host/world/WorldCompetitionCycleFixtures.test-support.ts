import type { ClubWorldRegion } from
  '../../core/world/competition/ClubWorldBerths';
import type { WorldCompetitionCycleInput } from
  '../../core/world/competition/WorldCompetitionCycleCalendar';

const regions: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const date = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const window = (year: number, month: number,
  start: number, end: number) => ({
  startsOn: date(year, month, start),
  endsOn: date(year, month, end),
});
export const worldCycleInput = (ordinal: number): WorldCompetitionCycleInput => {
  const years = Array.from({ length: 4 }, (_, index) =>
    2031 + ordinal * 4 + index);
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
