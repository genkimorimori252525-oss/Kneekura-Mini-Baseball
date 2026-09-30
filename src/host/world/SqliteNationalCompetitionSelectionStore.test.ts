import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openSqliteWorldCompetitionCycleStore } from
  './SqliteWorldCompetitionCycleStore';
import { worldCycleInput } from './WorldCompetitionCycleFixtures.test-support';
import { openSqliteNationalCompetitionSelectionStore } from
  './SqliteNationalCompetitionSelectionStore';

const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');

it('pins WBC and Premier12 cutoffs and career days to the accepted World cycle', () => {
  const directory = mkdtempSync(join(tmpdir(), 'national-selection-'));
  const path = join(directory, 'world.sqlite');
  const cycle = openSqliteWorldCompetitionCycleStore(path);
  let store = openSqliteNationalCompetitionSelectionStore(path, { cycle });
  const request = { careerId: 'career-1', editionId: 'wbc-2032',
    cycleOrdinal: 0, kind: 'WBC' as const, careerDayOne: '2031-01-01', cutoffDay: 400 };
  try {
    expect(() => store.initialize(request)).toThrow('accepted World cycle');
    expect(store.readSelection('career-1', request.editionId)).toBeNull();
    cycle.initialize('career-1', worldCycleInput(0));
    const wbc = store.initialize(request);
    expect(wbc.calendarYear).toBe(2032);
    expect(wbc.calendarWindow).toEqual({ startsOnDay: 426, endsOnDay: 445 });
    expect(wbc.qualificationCutoff.day).toBe(400);
    expect(store.initialize(request)).toEqual(wbc);
    expect(store.authority('career-1').editionCutoff(request.editionId))
      .toEqual(wbc.qualificationCutoff);
    expect(() => store.initialize({ ...request, cutoffDay: 426 }))
      .toThrow('before');
    expect(() => store.initialize({ ...request, cutoffDay: 399 }))
      .toThrow('frozen differently');
    expect(() => store.initialize({ ...request, editionId: 'second-wbc' }))
      .toThrow('World reservation is already assigned');
    expect(() => store.initialize({ ...request, editionId: 'invalid-date',
      careerDayOne: '2031-02-29' })).toThrow('calendar');
    expect(() => store.initialize({ ...request, editionId: 'other-origin',
      kind: 'PREMIER_12', careerDayOne: '2031-01-02' })).toThrow('origin');
    const premier = store.initialize({ ...request, kind: 'PREMIER_12',
      editionId: 'premier-2034', cutoffDay: 1300 });
    expect(premier.calendarWindow).toEqual({ startsOnDay: 1410, endsOnDay: 1420 });
    expect(premier.calendarYear).toBe(2034);
    store.close();
    store = openSqliteNationalCompetitionSelectionStore(path, { cycle });
    expect(store.readSelection('career-1', 'premier-2034')).toEqual(premier);
    expect(store.readSelection('other-career', request.editionId)).toBeNull();
    cycle.initialize('career-1', worldCycleInput(1));
    const next = store.initialize({ ...request, cycleOrdinal: 1,
      editionId: 'wbc-2036', cutoffDay: 1850 });
    expect(next.calendarYear).toBe(2036);
    expect(next.calendarWindow.startsOnDay).toBe(1887);
    const db = new DatabaseSync(path);
    db.prepare("UPDATE world_national_selections SET selection_json='{}' WHERE edition_id='premier-2034'").run();
    db.close();
    expect(() => store.readSelection('career-1', 'premier-2034')).toThrow('corrupt');
    const sourceDb = new DatabaseSync(path);
    sourceDb.prepare("UPDATE world_competition_cycles SET plan_json='{}' WHERE cycle_ordinal=0").run();
    sourceDb.close();
    expect(() => store.readSelection('career-1', request.editionId)).toThrow('corrupt');
  } finally {
    store.close();
    cycle.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
