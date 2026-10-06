import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import * as knowledge from './SqliteActualFieldObservationStore';
import { requireOriginalRunnerPublicKnowledge, requireOriginalRunnerPublicKnowledgeStore } from './OriginalRunnerPublicKnowledgeContracts.test-support';
import { originalPublicProgressFixture, missingOriginalPublicIdentityGuard, missingOriginalPublicCurrentFrameGuard } from './OriginalRunnerPublicKnowledgeReview.test-support';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

let x: ReturnType<typeof originalPublicProgressFixture>;
const table = 'actual_runner_public_knowledge', handles: { close(): void }[] = [];
let matchBefore: ReturnType<typeof matchRow>;
const matchRow = () => x.f.db.prepare('SELECT durable_revision,state_json,activation_json FROM matches WHERE match_id=?').get(x.actor.source.gameId)!;
beforeAll(() => { x = originalPublicProgressFixture(); }, 120_000);
beforeEach(() => { matchBefore = matchRow(); });
afterEach(() => {
  if (!x) return;
  while (handles.length) handles.pop()!.close();
  x.f.db.exec('DROP TRIGGER IF EXISTS change_public_match; DROP TABLE IF EXISTS actual_live_play_admissions; DROP TABLE IF EXISTS actual_live_play_runtimes;');
  x.f.db.prepare('UPDATE matches SET durable_revision=?,state_json=?,activation_json=? WHERE match_id=?')
    .run(matchBefore.durable_revision, matchBefore.state_json, matchBefore.activation_json, x.actor.source.gameId);
  if (x.f.db.prepare('SELECT 1 FROM sqlite_master WHERE name=?').get(table)) x.f.db.exec(`DELETE FROM ${table}`);
});
afterAll(() => { x?.close(); });
const storeFor = (...sources: ReturnType<typeof x.source>[]) => {
  const accepted = new Map(sources.map(source => [source.sourceId, source]));
  const store = requireOriginalRunnerPublicKnowledgeStore(knowledge)(x.f.path, { readAcceptedKnowledge: id => accepted.get(id) ?? null });
  handles.push(store); return store;
};
const rejectIdentity = (attempt: () => unknown) => {
  let error: unknown; try { attempt(); } catch (caught) { error = caught; }
  if (error === undefined) missingOriginalPublicIdentityGuard();
  expect(String(error)).toMatch(/baseline|scope|owned|identity/);
};

it('owns one original-information identity across two genuine physical pitch-progress Sources', () => {
  const first = x.source('baseline-first'), later = x.source('baseline-later', x.second.source.sourceId), store = storeFor(first, later);
  const own = requireOriginalRunnerPublicKnowledge(knowledge, x.f.db), before = own.derive(first), after = own.derive(later);
  expect(before.recipient).toEqual(after.recipient); expect(before.known).toEqual(after.known);
  expect(before.original.actorHash).toBe(after.original.actorHash); expect(before.original.runnerHash).toBe(after.original.runnerHash);
  expect(before.original.physicalPitchHash).not.toBe(after.original.physicalPitchHash);
  const saved = store.accept(first.sourceId); rejectIdentity(() => store.accept(later.sourceId));
  expect(store.read(saved.source.sourceId)).toEqual(saved); expect(store.accept(first.sourceId)).toEqual(saved);
  expect(x.f.db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n).toBe(1);
}, 30_000);

it.each(['actor_runner_index', 'recipient_mirror'] as const)('discovers canonical original ownership hidden behind changed pitch IDs/hashes through %s', retained => {
  const first = x.source('baseline-first'), later = x.source('baseline-later', x.second.source.sourceId), store = storeFor(first, later), saved = store.accept(first.sourceId);
  const source = { ...saved.source, sourceId: 'moved', physicalPitchSourceId: 'foreign', physicalActorSourceId: 'foreign', prePitchRunnerSourceId: 'foreign', playerId: 'foreign' };
  const changed = { ...saved, source, original: { ...saved.original, physicalActorSourceId: 'foreign', prePitchRunnerSourceId: 'foreign',
    matchHash: 'foreign', actorHash: 'foreign', runnerHash: 'foreign', physicalPitchHash: 'foreign' },
    recipient: retained === 'recipient_mirror' ? saved.recipient : { ...saved.recipient, gameId: 'foreign', playId: 99, playerId: 'foreign' } };
  x.f.db.prepare(`UPDATE ${table} SET source_id=?,physical_pitch_source_id=?,game_id=?,play_id=?,player_id=?,physical_actor_source_id=?,pre_pitch_runner_source_id=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?`)
    .run('moved', 'foreign', 'foreign', 99, retained === 'actor_runner_index' ? saved.recipient.playerId : 'foreign',
      retained === 'actor_runner_index' ? saved.source.physicalActorSourceId : 'foreign', retained === 'actor_runner_index' ? saved.source.prePitchRunnerSourceId : 'foreign',
      json(source), hash(source), json(changed), hash(changed));
  rejectIdentity(() => store.accept(later.sourceId));
  expect(x.f.db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n).toBe(1);
}, 30_000);

const movedPublicRow = (saved: ReturnType<ReturnType<typeof requireOriginalRunnerPublicKnowledge>['derive']>) => {
  const source = { ...saved.source, sourceId: 'moved', physicalPitchSourceId: 'foreign', physicalActorSourceId: 'foreign', prePitchRunnerSourceId: 'foreign', playerId: 'foreign' };
  return { ...saved, source, original: { ...saved.original, physicalActorSourceId: 'foreign', prePitchRunnerSourceId: 'foreign',
    matchHash: 'foreign', actorHash: 'foreign', runnerHash: 'foreign', physicalPitchHash: 'foreign' },
    recipient: { ...saved.recipient, gameId: 'foreign', playId: 99, playerId: 'foreign' } };
};
const saveMovedPublicRow = (changed: ReturnType<typeof movedPublicRow>, snapshot: string) => {
  x.f.db.prepare(`UPDATE ${table} SET source_id=?,physical_pitch_source_id=?,game_id=?,play_id=?,player_id=?,physical_actor_source_id=?,pre_pitch_runner_source_id=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?`)
    .run('moved', 'foreign', 'foreign', 99, 'foreign', 'foreign', 'foreign', json(changed.source), hash(changed.source), snapshot, hash(JSON.parse(snapshot)));
};

it.each(['canonical', 'duplicate_escaped'] as const)('discovers only the retained original actor/runner mirror pair in %s JSON', encoding => {
  const first = x.source('baseline-first'), later = x.source('baseline-later', x.second.source.sourceId), store = storeFor(first, later), saved = store.accept(first.sourceId);
  const changed = movedPublicRow(saved);
  let snapshot: string;
  if (encoding === 'canonical') {
    changed.original.physicalActorSourceId = saved.original.physicalActorSourceId;
    changed.original.prePitchRunnerSourceId = saved.original.prePitchRunnerSourceId;
    snapshot = json(changed);
  } else {
    // A second decoded original container and escaped field names retain the
    // identity even though every ordinary index, Source, recipient and hash moved.
    snapshot = json(changed).slice(0, -1) + ',"orig\\u0069nal":{"physicalActorSource\\u0049d":'
      + JSON.stringify(saved.original.physicalActorSourceId) + ',"prePitchRunnerSource\\u0049d":'
      + JSON.stringify(saved.original.prePitchRunnerSourceId) + '}}';
    expect(JSON.parse(snapshot).original).toEqual({ physicalActorSourceId: saved.original.physicalActorSourceId,
      prePitchRunnerSourceId: saved.original.prePitchRunnerSourceId });
  }
  saveMovedPublicRow(changed, snapshot); rejectIdentity(() => store.accept(later.sourceId));
  expect(x.f.db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n).toBe(1);
}, 30_000);

it.each(['integer', 'decimal', 'exponent'] as const)('discovers the same numeric play identity from raw %s recipient metadata with duplicate escaped keys', encoding => {
  const first = x.source('baseline-first'), later = x.source('baseline-later', x.second.source.sourceId), store = storeFor(first, later), saved = store.accept(first.sourceId);
  const changed = movedPublicRow(saved), encodedPlay = String(saved.recipient.playId) + (encoding === 'decimal' ? '.0' : encoding === 'exponent' ? 'e0' : '');
  const snapshot = json(changed).slice(0, -1) + ',"recip\\u0069ent":{"gameId":' + JSON.stringify(saved.recipient.gameId)
    + ',"playId":99,"pl\\u0061yId":' + encodedPlay + ',"playerId":' + JSON.stringify(saved.recipient.playerId) + '}}';
  expect(JSON.parse(snapshot).recipient).toEqual({ gameId: saved.recipient.gameId, playId: saved.recipient.playId, playerId: saved.recipient.playerId });
  saveMovedPublicRow(changed, snapshot); rejectIdentity(() => store.accept(later.sourceId));
  expect(x.f.db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n).toBe(1);
}, 30_000);

it('requires the original Match frame for fresh admission while preserving historical derivation', () => {
  const source = x.source('baseline'), store = storeFor(source), own = requireOriginalRunnerPublicKnowledge(knowledge, x.f.db), original = own.derive(source);
  x.f.db.prepare('UPDATE matches SET durable_revision=durable_revision+1 WHERE match_id=?').run(x.actor.source.gameId);
  expect(own.derive(source)).toEqual(original);
  let error: unknown; try { store.accept(source.sourceId); } catch (caught) { error = caught; }
  if (error === undefined) missingOriginalPublicCurrentFrameGuard();
  expect(String(error)).toMatch(/current|frame|advanced|changed/);
  expect(x.f.db.prepare(`SELECT * FROM ${table}`).all()).toEqual([]);
}, 30_000);

it.each(['owner:state', 'owner:activation', 'owner:revision', 'admission:state', 'admission:activation', 'admission:revision'] as const)
('witnesses %s INSERT mutation of current Match and rolls the same attempt back', entry => {
  const [stage, mutation] = entry.split(':'), source = x.source('baseline'), store = storeFor(source);
  if (stage === 'admission') {
    // Synthetic registration metadata isolates the existing real journal INSERT.
    // It is not an authenticated eleven-player runtime or End. The historical
    // actor reader still requires valid game/play mirrors on this current row.
    const originalReader = requireOriginalRunnerPublicKnowledge(knowledge, x.f.db), original = originalReader.derive(source);
    x.f.db.exec(`CREATE TABLE actual_live_play_runtimes(source_id TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,source_json TEXT,snapshot_json TEXT);
      CREATE TABLE actual_live_play_admissions(runtime_source_id TEXT,sequence INTEGER,owner TEXT,source_id TEXT,source_hash TEXT,snapshot_hash TEXT,PRIMARY KEY(runtime_source_id,sequence));`);
    x.f.db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?,?,?,?,?)')
      .run('synthetic-runtime', x.actor.source.gameId, x.actor.match.playId, x.first.source.sourceId, '{}',
        json({ gameId: x.actor.source.gameId, playId: x.actor.match.playId }));
    expect(originalReader.derive(source)).toEqual(original);
  }
  const assignment = mutation === 'state' ? "state_json=json_set(state_json,'$.outs',2)" : mutation === 'activation' ? 'activation_json=NULL' : 'durable_revision=durable_revision+1';
  x.f.db.exec(`CREATE TRIGGER change_public_match AFTER INSERT ON ${stage === 'owner' ? table : 'actual_live_play_admissions'} BEGIN
    UPDATE matches SET ${assignment} WHERE match_id='game-1'; END;`);
  const sql = stage === 'owner' ? 'INSERT INTO actual_runner_public_knowledge VALUES (?,?,?,?,?,?,?,?,?,?,?,?)' : 'INSERT INTO actual_live_play_admissions VALUES (?,?,?,?,?,?)';
  const witness = witnessSqliteWrite(sql, db => db.prepare(`SELECT source_id FROM ${table} WHERE source_id=?`).get(source.sourceId)?.source_id === source.sourceId
    && json(db.prepare('SELECT durable_revision,state_json,activation_json FROM matches WHERE match_id=?').get(x.actor.source.gameId)) !== json(matchBefore));
  let error: unknown;
  try {
    try { store.accept(source.sourceId); } catch (caught) { error = caught; }
    if (!witness.wasReached() && error !== undefined) throw error;
    expect(witness.wasReached()).toBe(true);
  }
  finally { witness.close(); }
  if (error === undefined) missingOriginalPublicCurrentFrameGuard();
  expect(String(error)).toMatch(/current|frame|advanced|changed/);
  expect(matchRow()).toEqual(matchBefore); expect(x.f.db.prepare(`SELECT * FROM ${table}`).all()).toEqual([]);
  if (stage === 'admission') expect(x.f.db.prepare('SELECT * FROM actual_live_play_admissions').all()).toEqual([]);
}, 30_000);
