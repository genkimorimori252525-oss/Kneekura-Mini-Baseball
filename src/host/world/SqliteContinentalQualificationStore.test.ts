import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { expect, it } from 'vitest';
import type { DomesticCompetitionSeasonSnapshot } from
  '../../core/world/competition/DomesticCompetitionSeason';
import { openSqliteContinentalQualificationStore } from
  './SqliteContinentalQualificationStore';

const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');
const snapshot = (leagueId: string, seasonId: string,
  entrantClubId: string): DomesticCompetitionSeasonSnapshot => ({
  leagueId, seasonId,
  regularSeasonTitleSnapshot: { winnerClubId: entrantClubId },
  domesticChampionSnapshot: { championClubId: entrantClubId },
  continentalQualification: {
    competitionEditionId: 'continental-2027',
    qualificationSeasonId: seasonId,
    entrantClubIds: [entrantClubId],
  },
} as unknown as DomesticCompetitionSeasonSnapshot);
const input = { careerId: 'career-1',
  competitionEditionId: 'continental-2027',
  expectedLeagueIds: ['league-a', 'league-b'],
  sourceSeasonIds: ['season-a', 'season-b'] };

it('pins entrant provenance from completed league snapshots and replays it', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-cont-qual-'));
  const path = join(directory, 'world.sqlite');
  const domestic = new Map([
    ['season-a', snapshot('league-a', 'season-a', 'club-a')],
    ['season-b', snapshot('league-b', 'season-b', 'club-b')],
  ]);
  const source = { readSnapshot: (_careerId: string, seasonId: string) =>
    domestic.get(seasonId) ?? null };
  try {
    const first = openSqliteContinentalQualificationStore(path,
      source);
    const qualified = first.initialize(input);
    expect(qualified.participantIds).toEqual(['club-a', 'club-b']);
    expect(qualified.qualificationSnapshotId)
      .toMatch(/^continental-qualification-v1:[0-9a-f]{64}$/);
    expect(first.initialize(input)).toEqual(qualified);
    first.close();
    const reopened = openSqliteContinentalQualificationStore(path,
      source);
    expect(reopened.readSnapshot('career-1', 'continental-2027'))
      .toEqual(qualified);
    expect(() => reopened.initialize({ ...input,
      expectedLeagueIds: [...input.expectedLeagueIds].reverse(),
    })).toThrow('completed domestic source');
    domestic.set('season-b', snapshot('league-b', 'season-b',
      'club-a'));
    expect(() => reopened.readSnapshot('career-1', 'continental-2027'))
      .toThrow('corrupt continental qualification');
    domestic.set('season-b', snapshot('league-b', 'season-b',
      'club-b'));
    reopened.close();
    const database = new DatabaseSync(path);
    database.prepare(`UPDATE world_continental_qualifications
      SET snapshot_json='{}' WHERE career_id='career-1'
      AND edition_id='continental-2027'`).run();
    database.close();
    const corrupted = openSqliteContinentalQualificationStore(path,
      source);
    expect(() => corrupted.readSnapshot('career-1', 'continental-2027'))
      .toThrow('corrupt continental qualification');
    corrupted.close();
  } finally {
    const root = realpathSync(tmpdir());
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-cont-qual-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
