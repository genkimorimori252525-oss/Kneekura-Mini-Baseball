import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { expect, it, vi } from 'vitest';
import { readCompletedDomesticSeason } from './DomesticSeasonRuntime';
import { openSqliteDomesticCompetitionSeasonStore,
  type DomesticCompetitionSourceRequest } from
  './SqliteDomesticCompetitionSeasonStore';

vi.mock('./DirectDomesticCompetitionFromWorld', () => ({
  projectDirectDomesticCompetitionFromWorld: (_stores: unknown,
    input: { seasonId: string }) => ({
    postseason: { status: 'COMPLETE' },
    snapshot: { seasonId: input.seasonId, leagueId: 'league-005',
      domesticChampionSnapshot: { championClubId: 'club-a' } },
  }),
}));
const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');
const sources = {} as Parameters<typeof readCompletedDomesticSeason>[0];
const request = { kind: 'DIRECT', input: {
  careerId: 'career-1', seasonId: 'season-1',
  postseasonPlans: [], qualificationPolicyVersion: 'qual-v1',
  competitionEditionId: 'edition-1', berthCount: 1,
  alreadyQualifiedClubIds: [],
  eligibilityByClubId: { 'club-a': { eligible: true } },
} } as const satisfies DomesticCompetitionSourceRequest;

it('pins a source-replayable title and rejects a changed or damaged snapshot', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-domestic-title-'));
  const path = join(directory, 'world.sqlite');
  try {
    const first = openSqliteDomesticCompetitionSeasonStore(path,
      sources);
    const snapshot = first.finalize(request);
    expect(snapshot.domesticChampionSnapshot.championClubId)
      .toBe('club-a');
    expect(first.finalize(request)).toEqual(snapshot);
    first.close();
    const reopened = openSqliteDomesticCompetitionSeasonStore(path,
      sources);
    expect(reopened.readSnapshot('career-1', 'season-1'))
      .toEqual(snapshot);
    expect(() => reopened.finalize({ ...request, input: {
      ...request.input, qualificationPolicyVersion: 'qual-v2',
    } })).toThrow('already frozen differently');
    reopened.close();
    const database = new DatabaseSync(path);
    database.prepare(`UPDATE world_domestic_competition_seasons
      SET snapshot_json='{}' WHERE career_id='career-1'
      AND season_id='season-1'`).run();
    database.close();
    const corrupted = openSqliteDomesticCompetitionSeasonStore(path,
      sources);
    expect(() => corrupted.readSnapshot('career-1', 'season-1'))
      .toThrow('corrupt domestic competition season');
    corrupted.close();
  } finally {
    const root = realpathSync(tmpdir());
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-domestic-title-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
