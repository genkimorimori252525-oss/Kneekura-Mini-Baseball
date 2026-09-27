import type { ClubWorldRegion } from './ClubWorldBerths';
import type { BaseScheduleSnapshot,
  ReservedCalendarWindow } from './LeagueSchedule';
import { generateLeagueSchedule,
  type LeagueScheduleGeneratorInput }
  from './LeagueScheduleGenerator';
import type { WorldCompetitionCyclePlan,
  WorldCompetitionWindow } from './WorldCompetitionCycleCalendar';

const REGIONS: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const leap = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const isoDay = (value: unknown): number | null => {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const months = [31, leap(year) ? 29 : 28, 31, 30,
    31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || year > 9999 || month < 1 || month > 12
    || day < 1 || day > months[month - 1]) return null;
  const previousYear = year - 1;
  const beforeYear = previousYear * 365
    + Math.floor(previousYear / 4)
    - Math.floor(previousYear / 100)
    + Math.floor(previousYear / 400);
  const beforeMonth = months.slice(0, month - 1)
    .reduce((total, days) => total + days, 0);
  return beforeYear + beforeMonth + day - 1;
};
const windowDays = (window: WorldCompetitionWindow):
Readonly<{ start: number; end: number }> | null => {
  const start = isoDay(window?.startsOn);
  const end = isoDay(window?.endsOn);
  return start !== null && end !== null && start <= end
    ? { start, end } : null;
};

export type WorldBoundLeagueSchedule = Readonly<{
  schedule: BaseScheduleSnapshot;
  worldWindowSnapshotId: string;
}>;

/** Reserves official world windows before domestic series generation. */
export const generateWorldBoundLeagueSchedule = (
  input: LeagueScheduleGeneratorInput,
  world: WorldCompetitionCyclePlan,
  leagueRegion: ClubWorldRegion,
  seasonDayOne: string,
): WorldBoundLeagueSchedule => {
  const origin = isoDay(seasonDayOne);
  if (origin === null || !REGIONS.includes(leagueRegion)
    || !id(world?.calendarPolicyVersion)
    || !Array.isArray(world.calendarYears)
    || world.calendarYears.length !== 4
    || !Array.isArray(world.reservations)
    || world.reservations.length !== 23
    || !Array.isArray(input?.allowedDays)
    || input.allowedDays.length === 0
    || input.allowedDays.some((day) =>
      !Number.isSafeInteger(day) || day < 0)) {
    throw new Error('invalid world-bound league calendar');
  }
  const minDay = Math.min(...input.allowedDays);
  const maxDay = Math.max(...input.allowedDays);
  const selected = world.reservations.filter((item) =>
    item.kind !== 'CONTINENTAL_CL'
      || item.region === leagueRegion);
  const windows: ReservedCalendarWindow[] = [];
  for (const event of selected) {
    const bounds = windowDays(event.window);
    if (!bounds || !world.calendarYears.includes(event.calendarYear)) {
      throw new Error('invalid world competition reservation');
    }
    const startsOnDay = bounds.start - origin + 1;
    const endsOnDay = bounds.end - origin + 1;
    if (endsOnDay < minDay || startsOnDay > maxDay) continue;
    windows.push(Object.freeze({
      kind: event.kind === 'CONTINENTAL_CL'
        ? 'CONTINENTAL' : 'WORLD',
      startsOnDay: Math.max(minDay, startsOnDay),
      endsOnDay: Math.min(maxDay, endsOnDay),
    }));
  }
  const worldWindowSnapshotId = JSON.stringify([
    'world-league-calendar', world.careerStartYear,
    world.cycleOrdinal, world.calendarPolicyVersion,
    input.leagueId, leagueRegion, seasonDayOne,
    ...selected.map((event) => {
      const span = event.window;
      return [event.kind, event.region,
        event.calendarYear, event.candidateIndex,
        span.startsOn, span.endsOn];
    }),
  ]);
  const schedule = generateLeagueSchedule({ ...input,
    worldWindowSnapshotId,
    reservedWindows: [...input.reservedWindows, ...windows] });
  return Object.freeze({ schedule, worldWindowSnapshotId });
};
