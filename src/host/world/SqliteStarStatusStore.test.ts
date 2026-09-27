import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import type { StarSeasonEvidence,
  StarStatusPolicy } from '../../core/world/star/StarStatus';
import { openSqliteStarStatusStore } from './SqliteStarStatusStore';

const directories: string[] = [];
const stores: { close(): void }[] = [];
afterEach(() => {
  for (const store of stores.splice(0).reverse()) store.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-star-status-')) {
      throw new Error('test cleanup escaped temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
const policy: StarStatusPolicy = {
  policyId: 'star', version: 'v1', effectiveDay: 0,
  currentWindowDays: 900, maxCurrentEvidenceAgeDays: 370,
  minimumStarSeasons: 2, minimumStarSpanDays: 300,
  minimumProminence: 0.8, minimumRoleCentrality: 0.7,
  minimumOpponentAttention: 0.7, minimumLeagueAwareness: 0.7,
  minimumSuperstarSeasons: 2, minimumSuperstarSpanDays: 300,
  minimumEliteProminence: 0.85,
  minimumCrossAudienceRecognition: 0.85,
  minimumHistoricalDominance: 0.9,
  minimumIconicSalience: 0.9,
  minimumHighStageSuccesses: 2,
  minimumHighStageSpanDays: 100,
};
const measure = (value: number, sourceId: string) =>
  ({ value, sourceIds: [sourceId] });
const season = (seasonId: string,
  atDay: number): StarSeasonEvidence => ({
  seasonId, atDay, evidencePolicyVersion: 'career-v1',
  prominence: measure(0.9, `${seasonId}-production`),
  roleCentrality: measure(0.9, `${seasonId}-role`),
  opponentAttention: measure(0.9, `${seasonId}-opponents`),
  leagueAwareness: measure(0.9, `${seasonId}-league`),
  crossAudienceRecognition: measure(0.9, `${seasonId}-audience`),
  historicalDominance: measure(0.9, `${seasonId}-dominance`),
  iconicSalience: measure(0.9, `${seasonId}-iconic`),
});
const setup = () => {
  const directory = mkdtempSync(join(tmpdir(),
    'kneekura-star-status-'));
  directories.push(directory);
  const path = join(directory, 'world.sqlite');
  const star = openSqliteStarStatusStore(path, {
    readAcceptedPolicy: sourceId => sourceId === 'policy-1'
      ? { sourceId, careerId: 'career-a', policy } : null,
    readAcceptedSeason: sourceId => {
      if (sourceId === 'season-1') return { sourceId,
        careerId: 'career-a', playerId: 'player-a',
        evidence: season('one', 100) };
      if (sourceId === 'season-2') return { sourceId,
        careerId: 'career-a', playerId: 'player-a',
        evidence: season('two', 500) };
      return null;
    },
    readAcceptedHighStage: sourceId => {
      if (sourceId !== 'final-1' && sourceId !== 'final-2') return null;
      return { sourceId, careerId: 'career-a', playerId: 'player-a',
        evidence: { eventId: sourceId,
          atDay: sourceId === 'final-1' ? 520 : 700,
          seasonId: 'two', resultSourceId: `official-${sourceId}`,
          successful: true } };
    },
  });
  stores.push(star);
  return { path, star };
};

it('earns Star and Superstar only from accepted sustained Career evidence', () => {
  const { path, star } = setup();
  expect(() => star.acceptSeason('season-1')).toThrow('policy');
  star.pinPolicy('policy-1');
  expect(() => star.acceptSeason('unknown')).toThrow('accepted');
  star.acceptSeason('season-1');
  expect(star.project('career-a', 'player-a', 100).current)
    .toBe('NONE');
  star.acceptSeason('season-2');
  expect(star.project('career-a', 'player-a', 500).current)
    .toBe('STAR');
  star.acceptHighStage('final-1');
  expect(star.project('career-a', 'player-a', 520).current)
    .toBe('STAR');
  star.acceptHighStage('final-2');
  const earned = star.project('career-a', 'player-a', 700);
  expect(earned).toMatchObject({ current: 'SUPERSTAR',
    legacy: 'SUPERSTAR',
    provenance: { highStageEventIds: ['final-1', 'final-2'] } });
  expect(earned).not.toHaveProperty('ability');
  star.close(); stores.splice(stores.indexOf(star), 1);
  const reopened = openSqliteStarStatusStore(path);
  stores.push(reopened);
  expect(reopened.project('career-a', 'player-a', 700))
    .toEqual(earned);
  expect(reopened.acceptSeason('season-1').evidence.seasonId)
    .toBe('one');
  expect(reopened.acceptHighStage('final-2').evidence.eventId)
    .toBe('final-2');
  expect(() => reopened.acceptSeason('unknown')).toThrow('authority');
});
