import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { actualSettledFoulStopProducerFixture } from './ActualSettledFoulStopFixtures.test-support';
import { actualSettledFoulStopProducerEvidenceFromSqlite } from './SqliteActualSettledFoulStopProducerStore';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { DurableActualSettledFoulStopProduction } from './ActualSettledFoulStopProducer';

let directory: string, x: ReturnType<typeof actualSettledFoulStopProducerFixture> | undefined;
let production: DurableActualSettledFoulStopProduction;
const table = 'actual_settled_foul_stop_productions';
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'foul-producer-ownership-'));
  x = actualSettledFoulStopProducerFixture(join(directory, 'original.sqlite'));
  production = x.store.accept(x.production.sourceId);
}, 120_000);
afterAll(() => { x?.f.close(); if (directory) rmSync(directory, { recursive: true, force: true }); });

it('rejects an unsupported runtime identity mirror before projecting a future event', () => {
  const db = x!.f.db, reader = actualSettledFoulStopProducerEvidenceFromSqlite(db);
  const query = { ...x!.query, cut: { kind: 'original_pitch' as const } };
  expect(reader.census(query).producer.futureSourceIds).toEqual([production.source.sourceId]);
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE ' + table + ' SET snapshot_json=? WHERE source_id=?')
      .run(json({ ...production, runtimeSourceId: 'foreign-runtime' }), production.source.sourceId);
    expect(() => reader.census(query)).toThrow(/metadata keys/);
  } finally { db.exec('ROLLBACK'); }
});

it('discovers a foreign-looking producer through a policy whose pitch cache hides its original field anchor', () => {
  const db = x!.f.db, reader = actualSettledFoulStopProducerEvidenceFromSqlite(db);
  const source = { ...production.source, sourceId: 'foreign-production', physicalPitchSourceId: 'foreign-pitch',
    runtimeSourceId: 'foreign-runtime', baseFieldSourceId: 'foreign-field' };
  const ownershipKey = json(['actual_original_settled_foul_stop_producer_v1', source.physicalPitchSourceId]);
  const originalStopKey = json(['original_settled_foul_stop_v1', source.physicalPitchSourceId, 'a'.repeat(64)]);
  const snapshot = { ...production, source, history: [source], physicalPitchSourceId: source.physicalPitchSourceId,
    gameId: 'foreign-game', playId: 999, scopeId: 'foreign-scope', ownershipKey, originalStopKey,
    runtimeReference: { ...production.runtimeReference, sourceId: source.runtimeSourceId },
    basis: { ...production.basis, physicalPitchSourceId: source.physicalPitchSourceId, gameId: 'foreign-game', playId: 999,
      physicalCut: { ...production.basis.physicalCut, baseFieldSourceId: source.baseFieldSourceId } } };
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM main.actual_live_play_admissions WHERE owner=?').run(table);
    db.prepare('DELETE FROM main.' + table).run();
    db.prepare('INSERT INTO main.' + table + ' VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(source.sourceId, source.sourceVersion, source.capability,
      source.physicalPitchSourceId, source.runtimeSourceId, source.policySourceId, source.baseFieldSourceId, null,
      snapshot.gameId, snapshot.playId, ownershipKey, originalStopKey, json(source), hash(source), json(snapshot), hash(snapshot));
    const policy = JSON.parse(String(db.prepare('SELECT snapshot_json FROM main.batted_venue_legal_policies WHERE source_id=?').get(source.policySourceId)!.snapshot_json));
    policy.physicalPitchSourceId = 'foreign-pitch-cache';
    db.prepare('UPDATE main.batted_venue_legal_policies SET physical_pitch_source_id=?,snapshot_json=? WHERE source_id=?')
      .run('foreign-pitch-cache', json(policy), source.policySourceId);
    expect(() => reader.census({ ...x!.query, cut: { kind: 'original_pitch' } })).toThrow(/original ownership/);
  } finally { db.exec('ROLLBACK'); }
});
