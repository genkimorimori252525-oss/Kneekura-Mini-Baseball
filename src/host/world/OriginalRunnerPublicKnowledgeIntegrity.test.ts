import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import * as knowledge from './SqliteActualFieldObservationStore';
import { originalRunnerPublicKnowledgeFixture, requireOriginalRunnerPublicKnowledge,
  requireOriginalRunnerPublicKnowledgeStore } from './OriginalRunnerPublicKnowledgeContracts.test-support';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { assertActualLiveRegistrationBeforeWork } from './ActualLiveRuntimeRegistration';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

let x: ReturnType<typeof originalRunnerPublicKnowledgeFixture>;
const handles: { close(): void }[] = [];
const track = <T extends { close(): void }>(handle: T): T => { handles.push(handle); return handle; };
const table = 'actual_runner_public_knowledge';
beforeAll(() => { x = originalRunnerPublicKnowledgeFixture(); }, 120_000);
afterEach(() => {
  if (!x) return;
  if (x.f.db.isTransaction) x.f.db.exec('ROLLBACK');
  while (handles.length) handles.pop()!.close();
  x.f.db.exec('DROP TRIGGER IF EXISTS corrupt_public_baseline; DROP TABLE IF EXISTS actual_live_play_fences;');
  if (x.f.db.prepare("SELECT 1 FROM sqlite_master WHERE name=?").get(table)) x.f.db.exec(`DELETE FROM ${table}`);
});
afterAll(() => { x?.close(); });
const accepted = () => {
  const sources = new Map([[x.knowledgeSource.sourceId, x.knowledgeSource]]);
  const store = track(requireOriginalRunnerPublicKnowledgeStore(knowledge)(x.f.path, { readAcceptedKnowledge: id => sources.get(id) ?? null }));
  const value = store.accept(x.knowledgeSource.sourceId);
  return { store, value, sources };
};
const fence = () => {
  // The narrow admission contract blocks a matching claim. It is explicitly
  // not a fabricated completed PlayEnd or an eleven-player closure proof.
  x.f.db.exec(`CREATE TABLE actual_live_play_fences(game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL UNIQUE,
    closure_source_id TEXT NOT NULL UNIQUE,PRIMARY KEY(game_id,play_id));`);
  x.f.db.prepare('INSERT INTO actual_live_play_fences VALUES (?,?,?,?)')
    .run(x.actor.source.gameId, x.actor.match.playId, x.pitch.source.sourceId, 'synthetic-public-baseline-fence');
};

it('refuses a second Source for the same original runner baseline while preserving an identical retry', () => {
  const { store, value, sources } = accepted();
  const replacement = { ...x.knowledgeSource, sourceId: 'replacement-public-baseline' }; sources.set(replacement.sourceId, replacement);
  expect(() => store.accept(replacement.sourceId)).toThrow(/baseline|scope|owned/);
  expect(store.accept(value.source.sourceId)).toEqual(value);
  sources.set(value.source.sourceId, { ...x.knowledgeSource, sourceVersion: 'changed' });
  expect(() => store.accept(value.source.sourceId)).toThrow(/frozen|different/);
  expect(store.read(value.source.sourceId)).toEqual(value);
}, 30_000);

it.each(['known_outs', 'known_score', 'recipient', 'availability', 'actor_reference', 'pitch_hash'] as const)
('rejects rehashed %s corruption against the original owner chain', mutation => {
  const { store, value } = accepted(), changed: any = JSON.parse(json(value));
  if (mutation === 'known_outs') changed.known.outs = 2;
  if (mutation === 'known_score') changed.known.score.away = 3;
  if (mutation === 'recipient') changed.recipient.personId = 'other-person';
  if (mutation === 'availability') changed.availableAtTick += 1;
  if (mutation === 'actor_reference') changed.original.physicalActorSourceId = 'foreign-actor';
  if (mutation === 'pitch_hash') changed.original.physicalPitchHash = 'different';
  x.f.db.prepare(`UPDATE ${table} SET snapshot_json=?,snapshot_hash=?`).run(json(changed), hash(changed));
  expect(() => store.read(value.source.sourceId)).toThrow(); expect(() => store.accept(value.source.sourceId)).toThrow();
}, 30_000);

it.each(['source', 'snapshot'] as const)('discovers a Source ID moved behind its original %s mirror', mirror => {
  const { store, value } = accepted(), changed = JSON.parse(json(value)), source = { ...value.source, sourceId: 'moved' };
  changed.source.sourceId = 'moved';
  if (mirror === 'source') source.sourceId = value.source.sourceId; else changed.source.sourceId = value.source.sourceId;
  x.f.db.prepare(`UPDATE ${table} SET source_id=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?`)
    .run('moved', json(source), hash(source), json(changed), hash(changed));
  expect(() => store.read(value.source.sourceId)).toThrow(); expect(() => store.accept(value.source.sourceId)).toThrow();
}, 30_000);

it('detects a moved pitch scope through its unchanged original pitch hash instead of admitting a replacement baseline', () => {
  const { store, value, sources } = accepted(), source = { ...value.source, physicalPitchSourceId: 'foreign-pitch' }, changed = JSON.parse(json(value));
  changed.source = source;
  x.f.db.prepare(`UPDATE ${table} SET physical_pitch_source_id=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?`)
    .run('foreign-pitch', json(source), hash(source), json(changed), hash(changed));
  const replacement = { ...x.knowledgeSource, sourceId: 'replacement-public-baseline' }; sources.set(replacement.sourceId, replacement);
  expect(() => store.accept(replacement.sourceId)).toThrow();
  expect(x.f.db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n).toBe(1);
}, 30_000);

it('keeps a later mutable Match snapshot separate from the original public facts', () => {
  const { value } = accepted(), own = requireOriginalRunnerPublicKnowledge(knowledge, x.f.db);
  x.f.db.exec('BEGIN');
  const current = x.f.db.prepare('SELECT state_json FROM matches WHERE match_id=?').get(x.actor.source.gameId)!;
  const changed = JSON.parse(String(current.state_json)); changed.outs = 2; changed.score.away = 7;
  x.f.db.prepare('UPDATE matches SET state_json=? WHERE match_id=?').run(json(changed), x.actor.source.gameId);
  expect(own.read(value.source.sourceId)).toEqual(value);
  expect(own.derive(x.knowledgeSource).known).toEqual(value.known);
}, 30_000);

it('checks original intake roster support on the same connection, including uncommitted removal', () => {
  const { value } = accepted(), own = requireOriginalRunnerPublicKnowledge(knowledge, x.f.db);
  x.f.db.exec('BEGIN');
  x.f.db.prepare('DELETE FROM world_roster_heads WHERE career_id=?').run(x.originalRunner.binding.careerId);
  expect(() => own.read(value.source.sourceId)).toThrow(/roster/);
  expect(() => own.derive(x.knowledgeSource)).toThrow(/roster/);
}, 30_000);

it('rejects a fresh fenced baseline without treating the fence claim as a physical result', () => {
  const store = track(requireOriginalRunnerPublicKnowledgeStore(knowledge)(x.f.path, { readAcceptedKnowledge: () => x.knowledgeSource }));
  const own = requireOriginalRunnerPublicKnowledge(knowledge, x.f.db), before = own.derive(x.knowledgeSource);
  fence(); expect(own.derive(x.knowledgeSource)).toEqual(before);
  expect(() => store.accept(x.knowledgeSource.sourceId)).toThrow(/sealed/);
  expect(x.f.db.prepare(`SELECT * FROM ${table}`).all()).toEqual([]);
}, 30_000);

it('preserves archived reads and identical retry under the admission fence', () => {
  const { store, value } = accepted(), before = x.f.db.prepare(`SELECT * FROM ${table}`).all();
  fence(); expect(store.read(value.source.sourceId)).toEqual(value); expect(store.accept(value.source.sourceId)).toEqual(value);
  expect(x.f.db.prepare(`SELECT * FROM ${table}`).all()).toEqual(before);
}, 30_000);

it.each(['indexed', 'recipient_mirror'] as const)('prevents retroactive runtime registration over %s baseline ownership', mode => {
  const scope = { gameId: x.actor.source.gameId, playId: x.actor.match.playId, physicalPitchSourceId: x.pitch.source.sourceId };
  expect(() => assertActualLiveRegistrationBeforeWork(x.f.db, scope)).not.toThrow();
  const { value } = accepted();
  if (mode === 'recipient_mirror') {
    const source = { ...value.source, physicalPitchSourceId: 'foreign-pitch' }, changed = JSON.parse(json(value)); changed.source = source;
    x.f.db.prepare(`UPDATE ${table} SET physical_pitch_source_id=?,game_id=?,play_id=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?`)
      .run('foreign-pitch', 'foreign-game', 99, json(source), hash(source), json(changed), hash(changed));
  }
  expect(() => assertActualLiveRegistrationBeforeWork(x.f.db, scope)).toThrow(/registered before governed work/);
}, 30_000);

it('witnesses the same real INSERT before restoring original bindings and rolling the rejected baseline back', () => {
  const store = track(requireOriginalRunnerPublicKnowledgeStore(knowledge)(x.f.path, { readAcceptedKnowledge: () => x.knowledgeSource }));
  const before = x.f.db.prepare('SELECT * FROM official_participant_bindings ORDER BY game_id,player_id').all();
  x.f.db.exec(`CREATE TRIGGER corrupt_public_baseline AFTER INSERT ON ${table} BEGIN
    UPDATE official_participant_bindings SET binding_json='{}' WHERE game_id='game-1' AND player_id='away-1'; END;`);
  const witness = witnessSqliteWrite('INSERT INTO actual_runner_public_knowledge VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', writer =>
    writer.prepare(`SELECT source_id FROM ${table} WHERE source_id=?`).get(x.knowledgeSource.sourceId)?.source_id === x.knowledgeSource.sourceId
    && writer.prepare("SELECT binding_json FROM official_participant_bindings WHERE game_id='game-1' AND player_id='away-1'").get()?.binding_json === '{}');
  try { expect(() => store.accept(x.knowledgeSource.sourceId)).toThrow(); expect(witness.wasReached()).toBe(true); }
  finally { witness.close(); }
  expect(x.f.db.prepare(`SELECT * FROM ${table}`).all()).toEqual([]);
  expect(x.f.db.prepare('SELECT * FROM official_participant_bindings ORDER BY game_id,player_id').all()).toEqual(before);
  x.f.db.exec('DROP TRIGGER corrupt_public_baseline');
  expect(store.accept(x.knowledgeSource.sourceId).known).toMatchObject({ outs: 0, startingBase: 1 });
}, 30_000);
