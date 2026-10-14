import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { originalFoulEndFixture, assertOriginalFoulEndPrerequisites, foulEndLogicalBytes,
  type OriginalFoulEndFixture } from './ActualFoulPlayEndFixtures.test-support';
import { actualSettledFoulStopProducerEvidenceFromSqlite } from './SqliteActualSettledFoulStopProducerStore';
import { actualFoulRuleConsumptionEvidenceFromSqlite } from './SqliteActualFoulRuleConsumptionStore';
import { battedWorldFieldExecutionEvidenceFromSqlite } from './SqliteBattedWorldFieldExecutionStore';
import { ownedScheduledMotionArchiveJson } from './OwnedScheduledMotionArchive';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
let directory: string, fixture: OriginalFoulEndFixture | undefined;
const current = () => { if (!fixture) throw new Error('genuine end-policy fixture is unavailable'); return fixture; };
beforeAll(() => { directory = mkdtempSync(join(tmpdir(), 'foul-end-prerequisites-'));
  fixture = originalFoulEndFixture(join(directory, 'original.sqlite')); }, 240_000);
afterAll(() => { fixture?.f.close(); if (directory) rmSync(directory, { recursive: true, force: true }); });

it('proves the fresh end-policy dead-ball cause and full retained endpoint applicability before any end owner is called', () => {
  const x = current(), proof = assertOriginalFoulEndPrerequisites(x);
  expect(proof.baseHistories).toHaveLength(40);
  expect(proof.physical.segments.at(-1)!.endElapsedSeconds).toBe(x.boundary.lastIncludedElapsedSeconds);
  expect(x.inputArchiveBytes()).toBe(x.beforePhysicalBytes);
  expect(JSON.stringify(x.f.official.getMatch('game-1'))).toBe(x.originalMatchBytes);
  expect(x.f.db.prepare("SELECT name FROM sqlite_master WHERE name IN ('actual_foul_play_ends','actual_live_play_fences')").all()).toEqual([]);
}, 240_000);

it('replays the original stop and count at their historical cut under the fresh end policy without new admissions', () => {
  const x = current(), before = foulEndLogicalBytes(x.f.db);
  expect(x.producer.read(x.production.source.sourceId)).toEqual(x.production);
  expect(x.producer.accept(x.production.source.sourceId)).toEqual(x.production);
  expect(x.counts.read(x.count.source.sourceId)).toEqual(x.count);
  expect(x.counts.accept(x.count.source.sourceId)).toEqual(x.count);
  expect(json(actualFoulRuleConsumptionEvidenceFromSqlite(x.f.db).census(x.query))).toBe(x.historicalCensus);
  expect(x.count.successor.status).toBe('pending'); expect(foulEndLogicalBytes(x.f.db)).toBe(before);
}, 180_000);

it('reopens the genuine new-policy endpoint and original count with every construction handle closed', () => {
  const x = current(), path = x.f.path, before = foulEndLogicalBytes(x.f.db), endpoint = ownedScheduledMotionArchiveJson(x.endpoint);
  x.f.close(); fixture = undefined; x.runtimeSources.clear(); x.executionSources.clear();
  expect(() => x.f.db.prepare('SELECT 1').get()).toThrow();
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    expect(ownedScheduledMotionArchiveJson(battedWorldFieldExecutionEvidenceFromSqlite(db).read(x.endpoint.source.sourceId)!)).toBe(endpoint);
    expect(actualSettledFoulStopProducerEvidenceFromSqlite(db).read(x.production.source.sourceId)).toEqual(x.production);
    expect(actualFoulRuleConsumptionEvidenceFromSqlite(db).read(x.count.source.sourceId)).toEqual(x.count);
    expect(json(actualFoulRuleConsumptionEvidenceFromSqlite(db).census(x.query))).toBe(x.historicalCensus);
    expect(foulEndLogicalBytes(db)).toBe(before);
  } finally { db.close(); }
}, 180_000);
