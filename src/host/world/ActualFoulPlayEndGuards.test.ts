import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import * as foulOwners from './SqliteActualFoulRuleConsumptionStore';
import { actualFoulRuleConsumptionEvidenceFromSqlite } from './SqliteActualFoulRuleConsumptionStore';
import { actualSettledFoulStopProducerEvidenceFromSqlite } from './SqliteActualSettledFoulStopProducerStore';
import { actualLiveRuntimeEvidenceFromSqlite } from './SqliteActualLivePlayRuntimeStore';
import { beginActualLivePlayWrite, assertActualLivePlayWriteUnchanged } from './ActualLivePlayFence';
import { openSqliteActualFieldObservationStore } from './SqliteActualFieldObservationStore';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, openSqliteBattedWorldFieldExecutionStore,
  type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { ownedMotionKnownWorkFromSqlite } from './OwnedMotionKnownWorkFromSqlite';
import { ownedScheduledMotionArchiveJson } from './OwnedScheduledMotionArchive';
import { originalFoulEndFixture, assertOriginalFoulEndPrerequisites, foulEndLogicalBytes, foulEndJournal,
  type OriginalFoulEndFixture } from './ActualFoulPlayEndFixtures.test-support';
import { requireFoulEndOpener, type FoulEndSource } from './ActualFoulPlayEndContracts.test-support';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Db = InstanceType<typeof DatabaseSync>;
let directory: string, baseline: string, baselineHash: string, fixture: OriginalFoulEndFixture;
let path: string, db: Db, stores: { close(): void }[] = [], index = 0;
const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const track = <T extends { close(): void }>(value: T): T => { stores.push(value); return value; };
const source = (): FoulEndSource => ({ sourceId: 'guard-foul-end', sourceVersion: 'contract-v1',
  capability: 'actual_original_settled_foul_play_end_v1', ruleConsumptionSourceId: fixture.count.source.sourceId,
  baseFieldSourceId: fixture.foul.last.source.sourceId, executionSourceId: fixture.endpoint.source.sourceId });
const open = (capture: (id: string) => FoulEndSource | null = id => id === source().sourceId ? source() : null) =>
  track(requireFoulEndOpener(foulOwners)(path, { readAcceptedEnd: capture }));
const bytes = () => foulEndLogicalBytes(db);
const noEnd = () => { expect(db.prepare('SELECT source_id FROM actual_foul_play_ends WHERE source_id=?').all(source().sourceId)).toEqual([]);
  expect(db.prepare('SELECT * FROM actual_live_play_fences').all()).toEqual([]); };

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'foul-end-guards-')); baseline = join(directory, 'genuine.sqlite');
  fixture = originalFoulEndFixture(baseline);
  try { assertOriginalFoulEndPrerequisites(fixture); } finally { fixture.f.close(); }
  expect(() => fixture.f.db.prepare('SELECT 1').get()).toThrow();
  expect(!existsSync(baseline + '-wal') || statSync(baseline + '-wal').size === 0).toBe(true);
  baselineHash = digest(readFileSync(baseline));
}, 300_000);
beforeEach(() => { expect(digest(readFileSync(baseline))).toBe(baselineHash);
  path = join(directory, 'guard-' + ++index + '.sqlite'); copyFileSync(baseline, path); db = new DatabaseSync(path); stores = []; });
afterEach(() => { for (const store of stores.reverse()) store.close(); if (db?.isOpen) db.close(); });
afterAll(() => { if (baselineHash) expect(digest(readFileSync(baseline))).toBe(baselineHash);
  if (directory) rmSync(directory, { recursive: true, force: true }); });

const foreignSource = { sourceId: 'foreign-terminal', sourceVersion: 'contract-v1', capability: 'actual_original_settled_foul_play_end_v1',
  ruleConsumptionSourceId: 'foreign-count', baseFieldSourceId: 'foreign-field', executionSourceId: 'foreign-execution' };
it.each(['plain', 'duplicate_escaped'] as const)('discovers a foreign-indexed terminal through its %s original count claim', kind => {
  const ends = open(), original = ends.evaluate(source().sourceId); expect(original.kind).toBe('ended');
  const beforeForeign = bytes(), raw = json(foreignSource), snapshot = json({ source: foreignSource, history: [foreignSource],
    gameId: 'foreign-game', playId: 99, physicalPitchSourceId: 'foreign-pitch' });
  db.prepare('INSERT INTO actual_foul_play_ends VALUES(?,?,?,?,?,?,?,?)')
    .run(foreignSource.sourceId, 'foreign-game', 99, 'foreign-pitch', raw, digest(raw), snapshot, digest(snapshot));
  expect(ends.evaluate(source().sourceId)).toEqual(original); // Fully foreign payload remains outside this proof.
  const claimed = kind === 'plain' ? json({ ...foreignSource, ruleConsumptionSourceId: fixture.count.source.sourceId })
    : raw.slice(0, -1) + ',"ruleConsumptionSource\\u0049d":' + json(fixture.count.source.sourceId) + ',"ruleConsumptionSourceId":' + json(foreignSource.ruleConsumptionSourceId) + '}';
  db.prepare('UPDATE actual_foul_play_ends SET source_json=?,source_hash=? WHERE source_id=?')
    .run(claimed, digest(claimed), foreignSource.sourceId);
  const corrupted = bytes();
  expect(() => ends.evaluate(source().sourceId)).toThrow(/ownership|claim|terminal|closure/);
  expect(() => ends.accept(source().sourceId)).toThrow(/ownership|claim|terminal|closure/);
  expect(bytes()).toBe(corrupted); noEnd();
  db.prepare('DELETE FROM actual_foul_play_ends WHERE source_id=?').run(foreignSource.sourceId);
  expect(bytes()).toBe(beforeForeign); expect(ends.accept(source().sourceId).kind).toBe('ended');
}, 300_000);

it.each(['plain', 'duplicate_escaped'] as const)('discovers an unjournaled foreign-indexed observation through its %s original pitch claim', kind => {
  track(openSqliteActualFieldObservationStore(path)); const ends = open(), original = ends.evaluate(source().sourceId);
  expect(original.kind).toBe('ended'); const beforeForeign = bytes();
  const s = { sourceId: 'foreign-observation', sourceVersion: 'contract-v1', physicalPitchSourceId: 'foreign-pitch', playerId: 'foreign-player',
    baseFieldSourceId: 'foreign-field', executionSourceId: null, observationModelSourceId: 'foreign-model', previousObservationSourceId: null };
  const raw = json(s), snapshot = json({ source: s, history: [s], revision: 1, opaqueForeignPayload: true });
  db.prepare('INSERT INTO actual_field_observations VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(s.sourceId, s.physicalPitchSourceId,
    s.playerId, s.baseFieldSourceId, null, s.observationModelSourceId, null, 1, raw, digest(raw), snapshot, digest(snapshot));
  db.prepare('INSERT INTO actual_field_observation_heads VALUES(?,?,?,?)').run(s.physicalPitchSourceId, s.playerId, s.sourceId, 1);
  expect(ends.evaluate(source().sourceId)).toEqual(original);
  const claimed = kind === 'plain' ? json({ ...s, physicalPitchSourceId: fixture.physical.source.sourceId })
    : raw.slice(0, -1) + ',"physicalPitchSource\\u0049d":' + json(fixture.physical.source.sourceId) + ',"physicalPitchSourceId":' + json(s.physicalPitchSourceId) + '}';
  db.prepare('UPDATE actual_field_observations SET source_json=?,source_hash=? WHERE source_id=?').run(claimed, digest(claimed), s.sourceId);
  const corrupted = bytes();
  expect(() => ends.evaluate(source().sourceId)).toThrow(/ownership|claim|scope|admission|metadata/);
  expect(() => ends.accept(source().sourceId)).toThrow(/ownership|claim|scope|admission|metadata/);
  expect(bytes()).toBe(corrupted); noEnd();
  db.prepare('DELETE FROM actual_field_observation_heads WHERE source_id=?').run(s.sourceId);
  db.prepare('DELETE FROM actual_field_observations WHERE source_id=?').run(s.sourceId);
  expect(bytes()).toBe(beforeForeign); expect(ends.accept(source().sourceId).kind).toBe('ended');
}, 300_000);

it('rejects an authentic endpoint whose actual runtime admission has disappeared without rewriting any owner', () => {
  const ends = open(); expect(ends.evaluate(source().sourceId).kind).toBe('ended');
  const original = bytes(), row = db.prepare('SELECT * FROM actual_live_play_admissions WHERE owner=? AND source_id=?')
    .get('batted_world_field_executions', fixture.endpoint.source.sourceId)!;
  expect(row.sequence).toBe(foulEndJournal(db).length);
  db.prepare('DELETE FROM actual_live_play_admissions WHERE runtime_source_id=? AND sequence=?').run(row.runtime_source_id, row.sequence);
  // Both existing readers still authenticate their own represented data. The
  // missing inverse owner-to-journal link must be caught by the terminal proof.
  expect(ownedScheduledMotionArchiveJson(battedWorldFieldExecutionEvidenceFromSqlite(db).read(fixture.endpoint.source.sourceId)!))
    .toBe(ownedScheduledMotionArchiveJson(fixture.endpoint));
  expect(actualLiveRuntimeEvidenceFromSqlite(db).admissions(fixture.runtime)).toHaveLength(Number(row.sequence) - 1);
  const missing = bytes(); expect(() => ends.accept(source().sourceId)).toThrow(/admission|journal|bypass/);
  expect(bytes()).toBe(missing); noEnd();
  db.prepare('INSERT INTO actual_live_play_admissions VALUES(?,?,?,?,?,?)')
    .run(row.runtime_source_id, row.sequence, row.owner, row.source_id, row.source_hash, row.snapshot_hash);
  expect(bytes()).toBe(original); expect(ends.accept(source().sourceId).kind).toBe('ended');
}, 300_000);

const motion = (file: string, connection: Db, retain: typeof track) => {
  const current = fixture.prefix(connection, fixture.endpoint.source.sourceId);
  const s: AcceptedBattedWorldFieldExecution = { sourceId: 'genuine-later-foul-motion', sourceVersion: 'contract-v1',
    baseFieldSourceId: fixture.foul.last.source.sourceId, previousExecutionSourceId: fixture.endpoint.source.sourceId,
    action: { kind: 'owned_motion_v2', checkpoint: { kind: 'retained_quantizer_bucket_v1', throughTick: fixture.moment.ball.tick + 1 },
      knownWork: ownedMotionKnownWorkFromSqlite(connection, fixture.physical.source.sourceId, fixture.ids),
      contributions: actualPlayersKinematicsFromPrefix(fixture.ids, current).map(self => ({ kind: 'retained', playerId: self.playerId, command: self.activeCommand })) } };
  const store = retain(openSqliteBattedWorldFieldExecutionStore(file, battedWorldFieldEvidenceFromSqlite(connection), {
    readAcceptedExecution: id => id === s.sourceId ? s : null,
  }));
  return { source: s, accept: () => store.accept(s.sourceId) };
};

it('rejects first end acceptance after genuinely admitted later motion while preserving historical stop and count', () => {
  const ends = open(); expect(ends.evaluate(source().sourceId).kind).toBe('ended');
  const later = motion(path, db, track), value = later.accept();
  expect(value.execution.kind).toBe('owned_motion_v2');
  expect(value.execution.field.motion.world.moment.ball.tick).toBeGreaterThan(fixture.moment.ball.tick);
  expect(value.execution.field.motion.world.moment.elapsedSeconds).toBeGreaterThan(fixture.boundary.lastIncludedElapsedSeconds);
  expect(db.prepare('SELECT source_id,revision FROM batted_world_field_execution_heads WHERE physical_pitch_source_id=?')
    .get(fixture.physical.source.sourceId)).toEqual({ source_id: value.source.sourceId, revision: value.revision });
  battedWorldFieldExecutionEvidenceFromSqlite(db).current(value);
  expect(foulEndJournal(db).at(-1)).toMatchObject({ owner: 'batted_world_field_executions', source_id: later.source.sourceId });
  const advanced = bytes(); expect(() => ends.accept(source().sourceId)).toThrow(/head|current|stale|cut/);
  expect(actualSettledFoulStopProducerEvidenceFromSqlite(db).read(fixture.production.source.sourceId)).toEqual(fixture.production);
  expect(actualFoulRuleConsumptionEvidenceFromSqlite(db).read(fixture.count.source.sourceId)).toEqual(fixture.count);
  expect(bytes()).toBe(advanced); noEnd();
}, 300_000);

it('rejects a peer-WAL count mutation during first Source capture and preserves exactly the peer committed change', () => {
  const peer = track(new DatabaseSync(path)); expect(peer.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
  expect(peer.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(path);
  let mutate = false, captured = false, committed = '';
  const ends = open(id => { if (mutate) { mutate = false; captured = true;
    peer.prepare('UPDATE actual_foul_rule_consumptions SET snapshot_hash=? WHERE source_id=?').run('peer-count-change', fixture.count.source.sourceId);
    committed = foulEndLogicalBytes(peer); } return id === source().sourceId ? source() : null; });
  expect(ends.evaluate(source().sourceId).kind).toBe('ended');
  const original = bytes(), saved = peer.prepare('SELECT snapshot_hash FROM actual_foul_rule_consumptions WHERE source_id=?').get(fixture.count.source.sourceId)!;
  mutate = true; expect(() => ends.accept(source().sourceId)).toThrow(/count|consumption|archive|changed|metadata|proof/);
  expect(captured).toBe(true); expect(bytes()).toBe(committed); noEnd();
  peer.prepare('UPDATE actual_foul_rule_consumptions SET snapshot_hash=? WHERE source_id=?').run(saved.snapshot_hash, fixture.count.source.sourceId);
  expect(bytes()).toBe(original); expect(ends.accept(source().sourceId).kind).toBe('ended');
}, 300_000);

it('revalidates historical retry after its Source callback deletes the actual seal on a peer WAL connection', () => {
  const peer = track(new DatabaseSync(path)); expect(peer.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
  expect(peer.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(path);
  let remove = false, captured = false, committed = '';
  const ends = open(id => { if (remove) { remove = false; captured = true;
    peer.prepare('DELETE FROM actual_live_play_fences WHERE closure_source_id=?').run(source().sourceId); committed = foulEndLogicalBytes(peer); }
    return id === source().sourceId ? source() : null; });
  const end = ends.accept(source().sourceId), original = bytes(), seal = peer.prepare('SELECT * FROM actual_live_play_fences').get()!;
  remove = true; expect(() => ends.accept(source().sourceId)).toThrow(/fence|seal|archive|changed/);
  expect(captured).toBe(true); expect(bytes()).toBe(committed); expect(foulEndJournal(db)).toEqual(foulEndJournal(peer));
  peer.prepare('INSERT INTO actual_live_play_fences VALUES(?,?,?,?)')
    .run(seal.game_id, seal.play_id, seal.physical_pitch_source_id, seal.closure_source_id);
  expect(bytes()).toBe(original); expect(ends.accept(source().sourceId)).toEqual(end); expect(bytes()).toBe(original);
}, 300_000);

const ingress = (kind: 'field_execution' | 'field_observation', file: string, connection: Db, retain: typeof track) => {
  if (kind === 'field_execution') return motion(file, connection, retain);
  const observed = installSyntheticObservation({ f: { path: file, track: retain }, baseField: fixture.foul.last },
    fixture.runtime.membership.participants.find(p => p.role === 'defender')!.playerId, fixture.endpoint.source.sourceId);
  return { source: observed.observationSource, accept: () => observed.observations.accept(observed.observationSource.sourceId) };
};
it.each(['field_execution', 'field_observation'] as const)('blocks real %s ingress through raw foul ownership after seal deletion without sealing an unrelated scope', kind => {
  const controlPath = join(directory, 'control-' + index + '.sqlite'); copyFileSync(baseline, controlPath);
  const control = new DatabaseSync(controlPath), handles: { close(): void }[] = [];
  const hold = <T extends { close(): void }>(value: T): T => { handles.push(value); return value; };
  const target = ingress(kind, path, db, track);
  try {
    const allowed = ingress(kind, controlPath, control, hold); expect(allowed.source).toEqual(target.source);
    expect(allowed.accept()).toMatchObject({ source: allowed.source });
    expect(foulEndJournal(control).at(-1)).toMatchObject({ owner: kind === 'field_execution' ? 'batted_world_field_executions' : 'actual_field_observations',
      source_id: allowed.source.sourceId });
  } finally { for (const handle of handles.reverse()) handle.close(); control.close(); }
  const ends = open(), end = ends.accept(source().sourceId);
  db.prepare('DELETE FROM actual_live_play_fences WHERE closure_source_id=?').run(end.source.sourceId); const sealed = bytes();
  let caught: unknown; try { target.accept(); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(Error); expect(String(caught)).toMatch(/terminal|sealed|closure/);
  expect((caught as Error).stack).toContain('ActualLivePlayFence.ts:');
  expect((caught as Error).stack).toContain(kind === 'field_execution' ? 'SqliteBattedWorldFieldExecutionStore.ts:' : 'SqliteActualFieldObservationStore.ts:');
  expect(bytes()).toBe(sealed);
  // This is an unrelated-scope guard control, not a claim that a new physical
  // play was created. The terminal must not become a database-wide blockade.
  db.exec('BEGIN IMMEDIATE');
  try { const token = beginActualLivePlayWrite(db, { gameId: end.gameId, playId: end.playId + 1,
    physicalPitchSourceId: 'unrelated-guard-pitch' }, { owner: 'batted_world_field_executions', sourceId: 'unrelated-guard-work' });
    assertActualLivePlayWriteUnchanged(db, token); }
  finally { db.exec('ROLLBACK'); }
  expect(bytes()).toBe(sealed);
}, 360_000);

it('discovers an unjournaled foreign observation through its sole embedded original physical frame claim', () => {
  track(openSqliteActualFieldObservationStore(path)); const ends = open(), original = ends.evaluate(source().sourceId);
  expect(original.kind).toBe('ended'); const beforeForeign = bytes();
  const s = { sourceId: 'foreign-frame-observation', sourceVersion: 'contract-v1', physicalPitchSourceId: 'foreign-pitch', playerId: 'foreign-player',
    baseFieldSourceId: 'foreign-field', executionSourceId: null, observationModelSourceId: 'foreign-model', previousObservationSourceId: null };
  const raw = json(s), snapshot = (gameId: string, playId: number) => json({ source: s, history: [s], revision: 1,
    baseMotion: { response: { touch: { worldContact: { flight: { physicalPitch: { frame: { gameId, match: { playId } } } } } } } } });
  const foreign = snapshot('foreign-game', 99);
  db.prepare('INSERT INTO actual_field_observations VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(s.sourceId, s.physicalPitchSourceId,
    s.playerId, s.baseFieldSourceId, null, s.observationModelSourceId, null, 1, raw, digest(raw), foreign, digest(foreign));
  db.prepare('INSERT INTO actual_field_observation_heads VALUES(?,?,?,?)').run(s.physicalPitchSourceId, s.playerId, s.sourceId, 1);
  expect(ends.evaluate(source().sourceId)).toEqual(original);
  // This is an existing declared registration ownership path. Every cached
  // scope, direct Source identity and dependency reference remains foreign.
  const claimed = snapshot(fixture.runtime.gameId, fixture.runtime.playId);
  db.prepare('UPDATE actual_field_observations SET snapshot_json=?,snapshot_hash=? WHERE source_id=?').run(claimed, digest(claimed), s.sourceId);
  const corrupted = bytes();
  expect(() => ends.evaluate(source().sourceId)).toThrow(/ownership|claim|scope|admission|metadata/);
  expect(() => ends.accept(source().sourceId)).toThrow(/ownership|claim|scope|admission|metadata/);
  expect(bytes()).toBe(corrupted); noEnd();
  db.prepare('DELETE FROM actual_field_observation_heads WHERE source_id=?').run(s.sourceId);
  db.prepare('DELETE FROM actual_field_observations WHERE source_id=?').run(s.sourceId);
  expect(bytes()).toBe(beforeForeign); expect(ends.accept(source().sourceId).kind).toBe('ended');
}, 360_000);

it.each(['physical_obligation', 'acknowledgement_obligation', 'original_successor'] as const)
  ('discovers a foreign terminal through its sole %s child ownership claim', claim => {
    const ends = open(), original = ends.evaluate(source().sourceId); expect(original.kind).toBe('ended');
    const beforeForeign = bytes(), raw = json(foreignSource);
    const parent = fixture.count.successor.successorKey;
    const physicalKey = json(['actual_foul_disposition_obligation_v1', parent, 'physical_end']);
    const snapshot = (target: boolean) => json({ source: foreignSource, history: [foreignSource], gameId: 'foreign-game',
      playId: 99, physicalPitchSourceId: 'foreign-pitch',
      dispositionObligations: { physical: { obligationKey: target && claim === 'physical_obligation' ? physicalKey : 'foreign-child',
        originalSuccessorKey: 'foreign-parent' } },
      physicalAcknowledgement: { obligationKey: target && claim === 'acknowledgement_obligation' ? physicalKey : 'foreign-child',
        originalSuccessorKey: target && claim === 'original_successor' ? parent : 'foreign-parent' } });
    const foreign = snapshot(false);
    db.prepare('INSERT INTO actual_foul_play_ends VALUES(?,?,?,?,?,?,?,?)').run(foreignSource.sourceId, 'foreign-game', 99, 'foreign-pitch',
      raw, digest(raw), foreign, digest(foreign));
    expect(ends.evaluate(source().sourceId)).toEqual(original);
    // No target game, pitch, Source, runtime or count-owner reference is added.
    // Only the independently derived physical-child identity or parent mirror claims the original obligation.
    const claimed = snapshot(true);
    db.prepare('UPDATE actual_foul_play_ends SET snapshot_json=?,snapshot_hash=? WHERE source_id=?')
      .run(claimed, digest(claimed), foreignSource.sourceId);
    const corrupted = bytes();
    expect(() => ends.evaluate(source().sourceId)).toThrow(/ownership|claim|terminal|closure/);
    expect(() => ends.accept(source().sourceId)).toThrow(/ownership|claim|terminal|closure/);
    expect(bytes()).toBe(corrupted); noEnd();
    db.prepare('DELETE FROM actual_foul_play_ends WHERE source_id=?').run(foreignSource.sourceId);
    expect(bytes()).toBe(beforeForeign); expect(ends.accept(source().sourceId).kind).toBe('ended');
  }, 360_000);

it('discovers a foreign physical-pitch head through its sole original last-source identity claim', () => {
  const ends = open(), original = ends.evaluate(source().sourceId); expect(original.kind).toBe('ended');
  const beforeForeign = bytes();
  db.prepare('INSERT INTO physical_pitch_progress_heads(game_id,play_id,revision,last_source_id) VALUES(?,?,?,?)')
    .run('foreign-head-game', 99, 1, 'foreign-head-pitch');
  expect(ends.evaluate(source().sourceId)).toEqual(original);
  db.prepare('UPDATE physical_pitch_progress_heads SET last_source_id=? WHERE game_id=? AND play_id=?')
    .run(fixture.physical.source.sourceId, 'foreign-head-game', 99);
  const corrupted = bytes();
  expect(() => ends.evaluate(source().sourceId)).toThrow(/ownership|claim|scope|metadata/);
  expect(() => ends.accept(source().sourceId)).toThrow(/ownership|claim|scope|metadata/);
  expect(bytes()).toBe(corrupted); noEnd();
  db.prepare('DELETE FROM physical_pitch_progress_heads WHERE game_id=? AND play_id=?').run('foreign-head-game', 99);
  expect(bytes()).toBe(beforeForeign); expect(ends.accept(source().sourceId).kind).toBe('ended');
}, 360_000);

it('preserves historical foul closure after genuine empty owner installation while still rejecting a new original-scope claim', () => {
  const ends = open();
  expect(db.prepare("SELECT name FROM main.sqlite_master WHERE name IN ('actual_field_observations','actual_field_observation_heads')").all()).toEqual([]);
  const end = ends.accept(source().sourceId), journal = foulEndJournal(db);
  expect(ends.read(end.source.sourceId)).toEqual(end);
  const originalOwners = foulEndLogicalBytes(db, ['actual_field_observations', 'actual_field_observation_heads']);
  // Install only through the genuine storage owner after the physical cut was
  // closed. No observation, head, admission, Source or target evidence is added.
  track(openSqliteActualFieldObservationStore(path));
  expect(db.prepare('SELECT * FROM actual_field_observations').all()).toEqual([]);
  expect(db.prepare('SELECT * FROM actual_field_observation_heads').all()).toEqual([]);
  expect(foulEndJournal(db)).toEqual(journal);
  expect(foulEndLogicalBytes(db, ['actual_field_observations', 'actual_field_observation_heads'])).toBe(originalOwners);
  const installed = bytes();
  expect(ends.read(end.source.sourceId)).toEqual(end);
  expect(ends.accept(end.source.sourceId)).toEqual(end); expect(bytes()).toBe(installed);
  const s = { sourceId: 'topology-foreign-observation', sourceVersion: 'contract-v1', physicalPitchSourceId: 'foreign-pitch', playerId: 'foreign-player',
    baseFieldSourceId: 'foreign-field', executionSourceId: null, observationModelSourceId: 'foreign-model', previousObservationSourceId: null };
  const raw = json(s), snapshot = json({ source: s, history: [s], revision: 1, opaqueForeignPayload: true });
  db.prepare('INSERT INTO actual_field_observations VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(s.sourceId, s.physicalPitchSourceId,
    s.playerId, s.baseFieldSourceId, null, s.observationModelSourceId, null, 1, raw, digest(raw), snapshot, digest(snapshot));
  db.prepare('INSERT INTO actual_field_observation_heads VALUES(?,?,?,?)').run(s.physicalPitchSourceId, s.playerId, s.sourceId, 1);
  const foreign = bytes(); expect(ends.read(end.source.sourceId)).toEqual(end);
  expect(ends.accept(end.source.sourceId)).toEqual(end); expect(bytes()).toBe(foreign);
  // Historical topology accommodation must still inspect every fresh original
  // scope claim. Only the raw pitch identity is changed to the actual original.
  const claimed = json({ ...s, physicalPitchSourceId: fixture.physical.source.sourceId });
  db.prepare('UPDATE actual_field_observations SET source_json=?,source_hash=? WHERE source_id=?').run(claimed, digest(claimed), s.sourceId);
  const corrupted = bytes();
  expect(() => ends.read(end.source.sourceId)).toThrow(/ownership|claim|scope|admission|metadata/);
  expect(() => ends.accept(end.source.sourceId)).toThrow(/ownership|claim|scope|admission|metadata/);
  expect(bytes()).toBe(corrupted); expect(foulEndJournal(db)).toEqual(journal);
  db.prepare('DELETE FROM actual_field_observation_heads WHERE source_id=?').run(s.sourceId);
  db.prepare('DELETE FROM actual_field_observations WHERE source_id=?').run(s.sourceId);
  expect(bytes()).toBe(installed); expect(ends.read(end.source.sourceId)).toEqual(end);
  expect(ends.accept(end.source.sourceId)).toEqual(end); expect(bytes()).toBe(installed);
}, 420_000);
