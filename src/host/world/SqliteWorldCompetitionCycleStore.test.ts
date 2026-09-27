import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { ClubWorldRegion } from
  '../../core/world/competition/ClubWorldBerths';
import type { WorldCompetitionCycleInput } from
  '../../core/world/competition/WorldCompetitionCycleCalendar';
import { openSqliteWorldCompetitionCycleStore } from
  './SqliteWorldCompetitionCycleStore';
const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');

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

it('pins a replayable world cycle across restart and rejects a changed plan', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-cycle-'));
  const path = join(directory, 'world.sqlite');
  try {
    const first = openSqliteWorldCompetitionCycleStore(path);
    const cycle = first.initialize('career-1', input(0));
    expect(cycle.reservations).toHaveLength(23);
    expect(first.initialize('career-1', input(0))).toEqual(cycle);
    first.close();
    const reopened = openSqliteWorldCompetitionCycleStore(path);
    expect(reopened.readCycle('career-1', 0)).toEqual(cycle);
    const changed = input(0);
    expect(() => reopened.initialize('career-1', {
      ...changed, calendarPolicyVersion: 'changed-v2' }))
      .toThrow('already frozen differently');
    expect(reopened.initialize('career-1', input(1)).calendarYears)
      .toEqual([2035, 2036, 2037, 2038]);
    reopened.close();
    const database = new DatabaseSync(path);
    database.prepare(`UPDATE world_competition_cycles SET plan_json='{}'
      WHERE career_id='career-1' AND cycle_ordinal=0`).run();
    database.close();
    const corrupted = openSqliteWorldCompetitionCycleStore(path);
    expect(() => corrupted.readCycle('career-1', 0))
      .toThrow('corrupt world competition cycle');
    corrupted.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
