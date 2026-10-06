import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualLiveEventKey, actualLiveSuccessorKey } from './ActualLivePlayQueueEvidenceFromSqlite';
import { battedVenueLegalEvidenceFromSqlite } from './BattedVenueLegalEvidenceFromSqlite';
import { nativeSettledFoulInputArchiveBytes } from './NativeSettledFoulPhysicalFixtures.test-support';
import { actualSettledFoulStopProducerFixture } from './ActualSettledFoulStopFixtures.test-support';
import { actualSettledFoulStopProducerEvidenceFromSqlite } from './SqliteActualSettledFoulStopProducerStore';
const { DatabaseSync, constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Fixture = ReturnType<typeof actualSettledFoulStopProducerFixture>;
let directory: string, x: Fixture | undefined, legacy: Fixture | undefined, unproduced: Fixture | undefined;
const table = 'actual_settled_foul_stop_productions';
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'foul-producer-contract-'));
  x = actualSettledFoulStopProducerFixture(join(directory, 'original.sqlite'));
  legacy = actualSettledFoulStopProducerFixture(join(directory, 'legacy.sqlite'), true);
  unproduced = actualSettledFoulStopProducerFixture(join(directory, 'unproduced.sqlite'));
}, 120_000);
afterAll(() => { x?.f.close(); legacy?.f.close(); unproduced?.f.close(); if (directory) rmSync(directory, { recursive: true, force: true }); });
const read = () => actualSettledFoulStopProducerEvidenceFromSqlite(x!.f.db);
const produce = () => x!.store.accept(x!.production.sourceId);
const admissions = () => x!.f.db.prepare('SELECT * FROM actual_live_play_admissions ORDER BY sequence').all();
const basis = () => battedVenueLegalEvidenceFromSqlite(x!.f.db).read({ version: 'batted_venue_legal_observation_v1',
  policySourceId: x!.production.policySourceId, baseFieldSourceId: x!.last.source.sourceId, executionSourceId: null });

it('accounts for the declared stop producer before any production without claiming complete generation', () => {
  const census = read().census(x!.query);
  expect(census.producer).toEqual({ producerId: json(['actual_settled_foul_stop_producer_v1', x!.runtime.membership.scopeId]),
    domain: 'settled_foul_stop', status: 'pending', sourceId: null, futureSourceIds: [] });
  expect(census.events).toEqual(census.base.events); expect(census.successors).toEqual(census.base.successors);
  expect(census.coverage).toBe('original_foul_producer_claims_complete');
  expect(census.generation).toBe('event_generation_coverage_pending'); expect(census.playEnd).toBeNull();
});
it('produces one exact original stop event, same-cut availability and unconsumed rule successor', () => {
  const original = basis(), before = admissions(), bytes = x!.inputArchiveBytes(), result = produce();
  if (original.evidence.interpretation.kind !== 'dead_ball' || !original.contactOrigins) throw new Error('producer fixture lacks actual original foul proof');
  const stop = original.evidence.interpretation.moment;
  const originalStopKey = json(['original_settled_foul_stop_v1', x!.production.physicalPitchSourceId, hash(original.contactOrigins.decisiveStop)]);
  const eventId = json(['settled_foul_stop_v1', originalStopKey]), local = json(['settled_foul_rule_evidence_v1', originalStopKey]);
  const eventKey = actualLiveEventKey(table, x!.production.sourceId, eventId);
  expect(result.source).toEqual(x!.production); expect(result.revision).toBe(1); expect(result.history).toEqual([x!.production]);
  expect(result.basis).toEqual(original); expect(result.originalStopKey).toBe(originalStopKey);
  expect(result.ownershipKey).toBe(json(['actual_original_settled_foul_stop_producer_v1', x!.production.physicalPitchSourceId]));
  expect(result.runtimeReference).toEqual({ owner: 'actual_live_play_runtimes', sourceId: x!.runtime.source.sourceId, snapshotHash: hash(x!.runtime) });
  const at = { originTick: stop.originTick, elapsedSeconds: stop.elapsedSeconds, tick: stop.ball.tick };
  expect(result.event).toEqual({ kind: 'settled_foul_stop', eventId, eventKey, originalStopKey,
    occurredAt: at, availableAt: at, stopOrigins: original.contactOrigins.decisiveStop });
  expect(result.successor).toEqual({ kind: 'foul_rule_evidence', status: 'pending', pendingReason: 'foul_rule_consumer_unowned',
    localSourceId: local, successorKey: actualLiveSuccessorKey(table, x!.production.sourceId, local), basisEventKey: eventKey });
  const after = admissions(); expect(after.slice(0, -1)).toEqual(before);
  expect(after.at(-1)).toMatchObject({ owner: table, source_id: result.source.sourceId, source_hash: hash(result.source), snapshot_hash: hash(result) });
  expect(x!.inputArchiveBytes()).toBe(bytes); expect(original.evidence.countEffect).toEqual({ kind: 'unresolved', reason: 'bunt_intent_pending' });
  expect(x!.originalPhysicalPitch.source).not.toHaveProperty('battingIntent'); expect(x!.originalPhysicalPitch.result.pitch.resolution.timeline.status.kind).toBe('batted_ball_pending');
  for (const key of ['countResult', 'composedTimeline', 'playEnd', 'officialClosure', 'resumeReceipt', 'workloadCharge']) expect(result).not.toHaveProperty(key);
  const census = read().census(x!.query);
  expect(census.events).toHaveLength(census.base.events.length + 1);
  expect(census.events.at(-1)).toMatchObject({ eventKey, eventId, kind: 'settled_foul_stop', occurredAt: at, availableAt: at,
    owner: { owner: table, sourceId: result.source.sourceId, snapshotHash: hash(result) } });
  expect(census.successors.at(-1)).toMatchObject({ kind: 'foul_rule_evidence', status: 'pending', basisEventKey: eventKey });
  expect(census.generation).toBe('event_generation_coverage_pending'); expect(census.playEnd).toBeNull();
}, 60_000);
it('retries the same Source without a second row, event or admission', () => {
  const first = produce(), before = admissions(), changes = x!.f.db.prepare('SELECT total_changes() AS n').get()!.n;
  expect(produce()).toEqual(first); expect(read().read(first.source.sourceId)).toEqual(first);
  expect(admissions()).toEqual(before); expect(x!.f.db.prepare('SELECT total_changes() AS n').get()!.n).toBe(changes);
  expect(x!.f.db.prepare('SELECT count(*) AS n FROM ' + table).get()!.n).toBe(1);
});
it('rejects an alias Source for the same original stop without adding an admission', () => {
  produce(); const before = admissions(), alias = { ...x!.production, sourceId: 'alias' };
  x!.productions.set(alias.sourceId, alias);
  expect(() => x!.store.accept(alias.sourceId)).toThrow(); expect(admissions()).toEqual(before);
});
it('accounts for a future production at an earlier cut without replaying its future payload', () => {
  const result = produce(), row = x!.f.db.prepare('SELECT snapshot_json FROM ' + table + ' WHERE source_id=?').get(result.source.sourceId)!;
  const changed = JSON.parse(String(row.snapshot_json)); changed.basis.evidence.physicalContacts = 'future-payload-must-stay-opaque';
  x!.f.db.prepare('UPDATE ' + table + ' SET snapshot_json=? WHERE source_id=?').run(JSON.stringify(changed), result.source.sourceId);
  try {
    const early = read().census({ ...x!.query, cut: { kind: 'field_execution', baseFieldSourceId: x!.first.source.sourceId, executionSourceId: null } });
    expect(early.producer).toMatchObject({ status: 'pending', sourceId: null, futureSourceIds: [result.source.sourceId] });
    expect(early.events).toEqual(early.base.events); expect(early.successors).toEqual(early.base.successors);
    expect(() => read().census(x!.query)).toThrow(); expect(() => read().read(result.source.sourceId)).toThrow();
  } finally { x!.f.db.prepare('UPDATE ' + table + ' SET snapshot_json=? WHERE source_id=?').run(row.snapshot_json!, result.source.sourceId); }
});
it.each(['indexed_pitch', 'snapshot_source_pitch', 'history_pitch', 'embedded_basis_pitch'] as const)('discovers and rejects a hidden %s ownership claim even before the event cut', kind => {
  const result = produce(), row = x!.f.db.prepare('SELECT physical_pitch_source_id,snapshot_json FROM ' + table + ' WHERE source_id=?').get(result.source.sourceId)!;
  const changed = JSON.parse(String(row.snapshot_json));
  if (kind === 'snapshot_source_pitch') changed.source.physicalPitchSourceId = 'foreign';
  if (kind === 'history_pitch') changed.history[0].physicalPitchSourceId = 'foreign';
  if (kind === 'embedded_basis_pitch') changed.basis.physicalPitchSourceId = 'foreign';
  x!.f.db.prepare('UPDATE ' + table + ' SET physical_pitch_source_id=?,snapshot_json=? WHERE source_id=?')
    .run(kind === 'indexed_pitch' ? 'foreign' : row.physical_pitch_source_id!, JSON.stringify(changed), result.source.sourceId);
  try { expect(() => read().census({ ...x!.query, cut: { kind: 'original_pitch' } })).toThrow(); }
  finally { x!.f.db.prepare('UPDATE ' + table + ' SET physical_pitch_source_id=?,snapshot_json=? WHERE source_id=?')
    .run(row.physical_pitch_source_id!, row.snapshot_json!, result.source.sourceId); }
});
it('rejects an owner row whose original admission is missing', () => {
  const result = produce(), row = x!.f.db.prepare('SELECT * FROM actual_live_play_admissions WHERE owner=? AND source_id=?').get(table, result.source.sourceId)!;
  x!.f.db.prepare('DELETE FROM actual_live_play_admissions WHERE owner=? AND source_id=?').run(table, result.source.sourceId);
  try { expect(() => read().census(x!.query)).toThrow(); }
  finally { x!.f.db.prepare('INSERT INTO actual_live_play_admissions VALUES(?,?,?,?,?,?)').run(row.runtime_source_id!, row.sequence!, row.owner!, row.source_id!, row.source_hash!, row.snapshot_hash!); }
});
it.each(['dead', 'buntAttempt', 'countResult', 'occurredAt', 'producers'] as const)('rejects caller-supplied %s in the accepted production Source', field => {
  const sourceId = 'injected-' + field;
  unproduced!.productions.set(sourceId, { ...unproduced!.production, sourceId, [field]: true } as never);
  expect(() => unproduced!.store.accept(sourceId)).toThrow();
});
it('rejects the existing legacy runtime as authority for the new producer', () => {
  expect(() => legacy!.store.accept(legacy!.production.sourceId)).toThrow();
});
it('rejects the new census over an unchanged legacy runtime', () => {
  expect(() => actualSettledFoulStopProducerEvidenceFromSqlite(legacy!.f.db).census(legacy!.query)).toThrow();
});
it('rejects a field cut before the actual stop and a non-null execution cut', () => {
  const u = unproduced!;
  u.productions.set('early', { ...u.production, sourceId: 'early', baseFieldSourceId: u.first.source.sourceId });
  u.productions.set('execution', { ...u.production, sourceId: 'execution', executionSourceId: 'caller-execution' } as never);
  expect(() => u.store.accept('early')).toThrow(); expect(() => u.store.accept('execution')).toThrow();
});
it.each(['physicalPitchSourceId', 'policySourceId', 'runtimeSourceId'] as const)('rejects a foreign %s before any production in that original scope', field => {
  const u = unproduced!, sourceId = 'foreign-' + field;
  u.productions.set(sourceId, { ...u.production, sourceId, [field]: 'foreign' });
  expect(() => u.store.accept(sourceId)).toThrow();
});
it('preserves the caller read transaction, query-only state and authorizer', () => {
  produce(); const expected = read().census(x!.query), before = admissions();
  x!.f.db.setAuthorizer(code => code === constants.SQLITE_DELETE ? constants.SQLITE_DENY : constants.SQLITE_OK);
  x!.f.db.exec('BEGIN; PRAGMA query_only=ON');
  try {
    expect(read().census(x!.query)).toEqual(expected); expect(x!.f.db.isTransaction).toBe(true);
    expect(x!.f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
    expect(() => x!.f.db.prepare('DELETE FROM main.' + table)).toThrow(/authorized/i);
    expect(admissions()).toEqual(before);
  } finally { x!.f.db.exec('ROLLBACK; PRAGMA query_only=OFF'); x!.f.db.setAuthorizer(null); }
});
it('requires main-only authority without accepting a TEMP replacement', () => {
  x!.f.db.exec('CREATE TEMP TABLE actual_settled_foul_stop_productions(source_id TEXT)');
  try { expect(() => read().census(x!.query)).toThrow(); }
  finally { x!.f.db.exec('DROP TABLE temp.actual_settled_foul_stop_productions'); }
});
it('rolls back an unrelated current Match write fired by producer insertion', () => {
  const y = actualSettledFoulStopProducerFixture(join(directory, 'rollback.sqlite'));
  try {
    expect(y.store.read(y.production.sourceId)).toBeNull();
    const before = JSON.stringify(y.f.db.prepare("SELECT * FROM main.matches WHERE match_id='game-1'").get());
    y.f.db.exec('CREATE TRIGGER fail_foul_producer AFTER INSERT ON ' + table + " BEGIN UPDATE matches SET durable_revision=durable_revision+1 WHERE match_id='game-1'; END");
    try {
      expect(() => y.store.accept(y.production.sourceId)).toThrow();
      expect(JSON.stringify(y.f.db.prepare("SELECT * FROM main.matches WHERE match_id='game-1'").get())).toBe(before);
      expect(y.f.db.prepare('SELECT count(*) AS n FROM ' + table).get()!.n).toBe(0);
      expect(y.f.db.prepare('SELECT count(*) AS n FROM actual_live_play_admissions WHERE owner=?').get(table)!.n).toBe(0);
    } finally { y.f.db.exec('DROP TRIGGER fail_foul_producer'); }
  } finally { y.f.close(); }
}, 90_000);
it('rejects a WAL dependency mutation during Source capture without leaving a receipt or admission', () => {
  const y = actualSettledFoulStopProducerFixture(join(directory, 'concurrent.sqlite'));
  let writer: InstanceType<typeof DatabaseSync> | undefined;
  try {
    expect(y.store.read(y.production.sourceId)).toBeNull();
    writer = new DatabaseSync(y.f.path);
    const row = writer.prepare('SELECT snapshot_hash FROM batted_venue_legal_policies WHERE source_id=?').get(y.production.policySourceId)!;
    const originalGet = y.productions.get.bind(y.productions); let changed = false;
    y.productions.get = id => {
      if (!changed) { changed = true; writer!.prepare('UPDATE batted_venue_legal_policies SET snapshot_hash=? WHERE source_id=?')
        .run('concurrent-corruption', y.production.policySourceId); }
      return originalGet(id);
    };
    try {
      expect(() => y.store.accept(y.production.sourceId)).toThrow(); expect(changed).toBe(true);
      expect(y.f.db.prepare('SELECT count(*) AS n FROM ' + table).get()!.n).toBe(0);
      expect(y.f.db.prepare('SELECT count(*) AS n FROM actual_live_play_admissions WHERE owner=?').get(table)!.n).toBe(0);
    } finally { writer.prepare('UPDATE batted_venue_legal_policies SET snapshot_hash=? WHERE source_id=?').run(row.snapshot_hash!, y.production.policySourceId); }
  } finally { writer?.close(); y.f.close(); }
}, 90_000);
it('reopens identical original production and census after every original file handle closes', () => {
  const result = produce(), census = read().census(x!.query), bytes = x!.inputArchiveBytes(), query = x!.query;
  const original = x!, path = original.f.path; original.f.close(); x = undefined;
  expect(() => original.f.db.prepare('SELECT 1').get()).toThrow(); expect(() => original.store.read(result.source.sourceId)).toThrow();
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const reopened = actualSettledFoulStopProducerEvidenceFromSqlite(db);
    expect(reopened.read(result.source.sourceId)).toEqual(result); expect(reopened.census(query)).toEqual(census);
    expect(nativeSettledFoulInputArchiveBytes(db)).toBe(bytes);
  } finally { db.close(); }
}, 90_000);
