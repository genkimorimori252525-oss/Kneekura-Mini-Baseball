import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it, vi } from 'vitest';
import { assertNoActualRoleWorkloadCharge, assertNoLegacyPitchWorkloadCharge } from './ActualRoleWorkloadChargeGuard';
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqliteOfficialPitchWorkloadStore } from './SqliteOfficialPitchWorkloadStore';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const scope = { careerId: 'career-a', gameId: 'game-1', playId: 8, playerId: 'p2' };
const other = { careerId: 'other-career', gameId: 'other-game', playId: 90, playerId: 'other-player' };
type Scope = typeof scope;
const createActual = (db: import('node:sqlite').DatabaseSync) => db.exec(`CREATE TABLE actual_role_workload_assessments (
  source_id TEXT PRIMARY KEY, closure_source_id TEXT, career_id TEXT, game_id TEXT, play_id INTEGER, player_id TEXT,
  source_json TEXT, source_hash TEXT, snapshot_json TEXT, snapshot_hash TEXT)`);
const actualSource = (s: Scope) => ({ sourceId: 'alias-assessment', closureSourceId: 'alias-closure',
  participantReference: { playerId: s.playerId }, physicalEndReference: { sourceId: 'physical-end' } });
const insertActual = (db: import('node:sqlite').DatabaseSync, index = scope, snapshot = JSON.stringify({ ...index,
  source: actualSource(index), activity: { careerId: index.careerId, playerId: index.playerId } }), source = JSON.stringify(actualSource(index))) =>
  db.prepare('INSERT INTO actual_role_workload_assessments VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run('alias-assessment', 'alias-closure', index.careerId, index.gameId, index.playId, index.playerId, source, 'hash', snapshot, 'hash');
const createLegacy = (db: import('node:sqlite').DatabaseSync) => db.exec(`CREATE TABLE official_pitch_workload_sources (
  source_id TEXT PRIMARY KEY, career_id TEXT, player_id TEXT, game_id TEXT, played_play_id INTEGER,
  scoring_application_id TEXT, policy_source_id TEXT, request_json TEXT, source_json TEXT, proof_json TEXT)`);
const legacyProof = (s: Scope) => ({ pitcher: { binding: { careerId: s.careerId, gameId: s.gameId, playerId: s.playerId }, playedPlayId: s.playId } });
const insertLegacy = (db: import('node:sqlite').DatabaseSync, index = scope, proof = JSON.stringify(legacyProof(index)),
  source = JSON.stringify({ careerId: index.careerId, playerId: index.playerId })) =>
  db.prepare('INSERT INTO official_pitch_workload_sources VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run('alias-legacy', index.careerId, index.playerId, index.gameId, index.playId, 'alias-scoring', 'policy', '{}', source, proof);
const withDb = (run: (db: import('node:sqlite').DatabaseSync) => void) => {
  const db = new DatabaseSync(':memory:'); try { run(db); } finally { db.close(); }
};

it('keeps both guards read-only and permits databases without the other owner', () => withDb(db => {
  assertNoActualRoleWorkloadCharge(db, scope); assertNoLegacyPitchWorkloadCharge(db, scope);
  expect(db.prepare('SELECT name FROM sqlite_master').all()).toEqual([]);
}));

it.each(['actual', 'legacy'] as const)('rejects the indexed %s charge regardless of Source aliases or corrupt payload', kind => withDb(db => {
  if (kind === 'actual') { createActual(db); insertActual(db, scope, '{invalid', '{invalid'); }
  else { createLegacy(db); insertLegacy(db, scope, '{invalid', '{invalid'); }
  expect(() => (kind === 'actual' ? assertNoActualRoleWorkloadCharge : assertNoLegacyPitchWorkloadCharge)(db, scope)).toThrow(/workload.*charge/);
}));

it.each(['actual', 'legacy'] as const)('discovers an escaped duplicate scope hidden behind all different %s indexes', kind => withDb(db => {
  if (kind === 'actual') {
    createActual(db);
    insertActual(db, other, `{"careerId":"career-a","career\\u0049d":"other-career","gameId":"game-1","game\\u0049d":"other-game","playId":8,"play\\u0049d":90,"playerId":"p2","player\\u0049d":"other-player"}`);
  } else {
    createLegacy(db);
    insertLegacy(db, other, `{"pitcher":${JSON.stringify(legacyProof(scope).pitcher)},"pitch\\u0065r":${JSON.stringify(legacyProof(other).pitcher)}}`);
  }
  expect(() => (kind === 'actual' ? assertNoActualRoleWorkloadCharge : assertNoLegacyPitchWorkloadCharge)(db, scope)).toThrow(/workload.*charge/);
}));

it.each(['actual', 'legacy'] as const)('detects a %s charge with scope split across indexes and raw metadata', kind => withDb(db => {
  const index = { ...scope, playerId: other.playerId };
  if (kind === 'actual') { createActual(db); insertActual(db, index, '{}', JSON.stringify(actualSource(scope))); }
  else { createLegacy(db); insertLegacy(db, index, '{}', JSON.stringify({ careerId: scope.careerId, playerId: scope.playerId })); }
  expect(() => (kind === 'actual' ? assertNoActualRoleWorkloadCharge : assertNoLegacyPitchWorkloadCharge)(db, scope)).toThrow(/workload.*charge/);
}));

it.each(['careerId', 'gameId', 'playId', 'playerId'] as const)('leaves another %s scope and its unrelated payload opaque', field => withDb(db => {
  const index = { ...scope, [field]: other[field] };
  createActual(db); createLegacy(db); insertActual(db, index, '{invalid', '{invalid'); insertLegacy(db, index, '{invalid', '{invalid');
  const parse = vi.spyOn(JSON, 'parse').mockImplementation(() => { throw new Error('unrelated domain payload parsed'); });
  try { assertNoActualRoleWorkloadCharge(db, scope); assertNoLegacyPitchWorkloadCharge(db, scope); }
  finally { parse.mockRestore(); }
}));

it('discovers actor binding mirrors without parsing unrelated assessment payload', () => withDb(db => {
  createActual(db);
  insertActual(db, other, JSON.stringify({ playId: scope.playId, actor: { binding: scope }, payload: '{invalid' }));
  expect(() => assertNoActualRoleWorkloadCharge(db, scope)).toThrow(/workload.*charge/);
}));

it('accepts a typed structural scope without binding unrelated snapshot properties', () => withDb(db => {
  createActual(db); createLegacy(db);
  const snapshot = { ...scope, source: { sourceId: 'assessment' }, activity: {} };
  expect(() => assertNoActualRoleWorkloadCharge(db, snapshot)).not.toThrow();
  expect(() => assertNoLegacyPitchWorkloadCharge(db, snapshot)).not.toThrow();
}));

it('does not reinterpret string-encoded ownership containers', () => withDb(db => {
  createActual(db); createLegacy(db);
  insertActual(db, other, JSON.stringify(JSON.stringify(scope)), JSON.stringify({ participantReference: JSON.stringify({ playerId: scope.playerId }) }));
  insertLegacy(db, other, JSON.stringify({ pitcher: JSON.stringify(legacyProof(scope).pitcher) }));
  assertNoActualRoleWorkloadCharge(db, scope); assertNoLegacyPitchWorkloadCharge(db, scope);
}));

const policy = { sourceId: 'pitch-effort-policy', sourceVersion: 'fixture-v1', policyId: 'fixture-effort', version: 'v1',
  availableAtDay: 1, effortUnitsPerPhysicalPitch: 2 };
const request = { scoringApplicationId: 'scoring-2', activationApplicationId: 'application-1', policySourceId: policy.sourceId };
const producerFor = (f: ReturnType<typeof officialPitchWorkloadFixture>) => f.track(openSqliteOfficialPitchWorkloadStore(f.path,
  { scoring: f.scoring, participation: f.participation }, { readAcceptedPolicy: () => policy }));

it('blocks legacy acceptance before persisting its policy or Source once total-play ownership exists', () => {
  const f = officialPitchWorkloadFixture(); try {
    const producer = producerFor(f); createActual(f.db); insertActual(f.db);
    expect(() => producer.accept(request)).toThrow(/workload.*charge/);
    expect(f.db.prepare('SELECT count(*) AS n FROM official_pitch_workload_sources').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) AS n FROM official_pitch_workload_policies').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});

it('blocks legacy retry and offline read if a total-play owner later claims the same play/player', () => {
  const f = officialPitchWorkloadFixture(); try {
    const producer = producerFor(f), activity = producer.accept(request); createActual(f.db); insertActual(f.db);
    expect(() => producer.accept(request)).toThrow(/corrupt/);
    expect(() => producer.readAcceptedActivity(activity.sourceEventId)).toThrow(/corrupt/);
  } finally { f.close(); }
});

// Reconstructed regression: the former post-INSERT test body was unavailable.
it('rolls back a competing total-play claim inserted by the legacy writer transaction and retries once on reopened WAL disk', () => {
  const directory = mkdtempSync(join(tmpdir(), 'actual-role-competing-charge-')), path = join(directory, 'state.sqlite');
  const f = officialPitchWorkloadFixture(true, false, path);
  let sourceEventId = '';
  try {
    const producer = producerFor(f); createActual(f.db);
    expect(f.db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(path);
    expect(f.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    f.db.exec(`CREATE TRIGGER insert_competing_total_play_claim AFTER INSERT ON official_pitch_workload_sources BEGIN
      INSERT INTO actual_role_workload_assessments VALUES ('during-legacy-accept','closure',NEW.career_id,NEW.game_id,
        NEW.played_play_id,NEW.player_id,'{}','trigger-owned','{}','trigger-owned'); END;`);
    expect(() => producer.accept(request)).toThrow(/corrupt|workload.*charge/);
    for (const table of ['official_pitch_workload_sources', 'official_pitch_workload_policies', 'actual_role_workload_assessments']) {
      expect(f.db.prepare(`SELECT count(*) AS n FROM ${table}`).get()).toEqual({ n: 0 });
    }
    f.db.exec('DROP TRIGGER insert_competing_total_play_claim');
    const activity = producer.accept(request); sourceEventId = activity.sourceEventId;
    expect(producer.accept(request)).toEqual(activity);
    expect(producer.readAcceptedActivity(sourceEventId)).toEqual(activity);
    expect(f.db.prepare('SELECT count(*) AS n FROM official_pitch_workload_sources').get()).toEqual({ n: 1 });
  } finally { f.close(); }
  const reopened = new DatabaseSync(path);
  try {
    expect(reopened.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(path);
    expect(reopened.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    expect(reopened.prepare('SELECT source_id FROM official_pitch_workload_sources').all()).toEqual([{ source_id: sourceEventId }]);
    expect(reopened.prepare('SELECT count(*) AS n FROM actual_role_workload_assessments').get()).toEqual({ n: 0 });
  } finally { reopened.close(); rmSync(directory, { recursive: true, force: true }); }
});

it.each(['closure','physical-end'] as const)('finds total-play ownership through the accepted %s reference when copied scope mirrors are corrupted',reference=>withDb(db=>{
  createActual(db);
  db.exec('CREATE TABLE actual_live_play_closures(source_id,game_id,play_id,proposal_json)');
  db.prepare('INSERT INTO actual_live_play_closures VALUES(?,?,?,?)').run('original-closure',scope.gameId,scope.playId,
    JSON.stringify({gameId:scope.gameId,playId:scope.playId,actors:[{binding:{careerId:scope.careerId}}],physicalEndReference:{sourceId:'physical-end'}}));
  insertActual(db,other,JSON.stringify(other),JSON.stringify({...actualSource(scope),closureSourceId:reference==='closure'?'original-closure':'other',
    physicalEndReference:{sourceId:reference==='physical-end'?'physical-end':'other'}}));
  expect(()=>assertNoActualRoleWorkloadCharge(db,scope)).toThrow(/workload.*charge/);
}));
it('finds legacy charge through original accepted application evidence when copied game/play mirrors move',()=>withDb(db=>{
  createLegacy(db);db.exec('CREATE TABLE applications(application_id,match_id,result_json)');
  db.prepare('INSERT INTO applications VALUES(?,?,?)').run('original-app',scope.gameId,JSON.stringify({receipt:{applicationId:'original-app',previousPlayId:scope.playId}}));
  insertLegacy(db,other,JSON.stringify(legacyProof(other)),JSON.stringify({careerId:scope.careerId,playerId:scope.playerId,evidenceId:'original-app'}));
  expect(()=>assertNoLegacyPitchWorkloadCharge(db,scope)).toThrow(/workload.*charge/);
}));
it.each(['actual','legacy'] as const)('retains exclusion when the %s producer row is lost but its canonical global activity remains',kind=>withDb(db=>{
  db.exec('CREATE TABLE world_player_workload_activities(source_id,source_json)');
  const {createHash}=createRequire(import.meta.url)('node:crypto') as typeof import('node:crypto');
  const digest=createHash('sha256').update(JSON.stringify([scope.careerId,scope.gameId,scope.playId,scope.playerId])).digest('hex');
  const sourceId=`${kind==='actual'?'actual-total-play-workload':'official-physical-pitch-workload'}:${digest}`;
  db.prepare('INSERT INTO world_player_workload_activities VALUES(?,?)').run('moved-index',JSON.stringify({sourceEventId:sourceId}));
  expect(()=>(kind==='actual'?assertNoActualRoleWorkloadCharge:assertNoLegacyPitchWorkloadCharge)(db,scope)).toThrow(/workload.*charge/);
}));

it.each(['canonical-index','canonical-source','pitcher-official','scoring-official','scoring-index','scoring-request','scoring-proof','archived-official'] as const)(
  'retains legacy exclusion through the independent %s ownership path',path=>withDb(db=>{
    createLegacy(db);db.exec('CREATE TABLE applications(application_id,match_id,result_json); CREATE TABLE official_scoring_applications(scoring_application_id,match_id,official_application_id,request_json,result_json)');
    db.prepare('INSERT INTO applications VALUES(?,?,?)').run('original-app',scope.gameId,JSON.stringify({receipt:{applicationId:'original-app',previousPlayId:scope.playId}}));
    db.prepare('INSERT INTO official_scoring_applications VALUES(?,?,?,?,?)').run('original-score',scope.gameId,'original-app','{}','{}');
    const {createHash}=createRequire(import.meta.url)('node:crypto') as typeof import('node:crypto');
    const canonical=`official-physical-pitch-workload:${createHash('sha256').update(JSON.stringify([scope.careerId,scope.gameId,scope.playId,scope.playerId])).digest('hex')}`;
    const proof={...legacyProof({...other,careerId:scope.careerId,playerId:scope.playerId}),
      ...(path==='pitcher-official'?{pitcher:{...legacyProof({...other,careerId:scope.careerId,playerId:scope.playerId}).pitcher,closureApplicationId:'original-app'}}:{}),
      ...(path==='scoring-official'?{scoring:{officialApplicationId:'original-app'}}:{}),
      ...(path==='scoring-proof'?{scoring:{scoringApplicationId:'original-score'}}:{}),
      ...(path==='archived-official'?{officialEvidence:{closure:{application_id:'original-app'}}}:{}),};
    db.prepare('INSERT INTO official_pitch_workload_sources VALUES(?,?,?,?,?,?,?,?,?,?)').run(path==='canonical-index'?canonical:'moved-source',scope.careerId,scope.playerId,other.gameId,other.playId,
      path==='scoring-index'?'original-score':'moved-score','policy',JSON.stringify({scoringApplicationId:path==='scoring-request'?'original-score':'moved-score'}),
      JSON.stringify({careerId:scope.careerId,playerId:scope.playerId,evidenceId:'moved-app',sourceEventId:path==='canonical-source'?canonical:'moved-source'}),JSON.stringify(proof));
    expect(()=>assertNoLegacyPitchWorkloadCharge(db,scope)).toThrow(/workload.*charge/);
}));
it('finds new total-play canonical activity identity even if every copied scope and Source reference is moved',()=>withDb(db=>{
  createActual(db);const {createHash}=createRequire(import.meta.url)('node:crypto') as typeof import('node:crypto');
  const canonical=`actual-total-play-workload:${createHash('sha256').update(JSON.stringify([scope.careerId,scope.gameId,scope.playId,scope.playerId])).digest('hex')}`;
  insertActual(db,other,JSON.stringify({activity:{sourceEventId:canonical}}),JSON.stringify(actualSource(other)));
  expect(()=>assertNoActualRoleWorkloadCharge(db,scope)).toThrow(/workload.*charge/);
}));
it.each(['actual','legacy'] as const)('retains %s global-history exclusion through its original evidence when producer and canonical IDs are lost',kind=>withDb(db=>{
  db.exec('CREATE TABLE world_player_workload_activities(source_id,source_json)');
  if(kind==='legacy'){
    db.exec('CREATE TABLE applications(application_id,match_id,result_json)');
    db.prepare('INSERT INTO applications VALUES(?,?,?)').run('original-evidence',scope.gameId,JSON.stringify({receipt:{applicationId:'original-evidence',previousPlayId:scope.playId}}));
  }else{
    db.exec('CREATE TABLE actual_first_base_play_ends(source_id,game_id,play_id,source_json,snapshot_json)');
    db.prepare('INSERT INTO actual_first_base_play_ends VALUES(?,?,?,?,?)').run('original-evidence',scope.gameId,scope.playId,'{}','{}');
  }
  db.prepare('INSERT INTO world_player_workload_activities VALUES(?,?)').run('moved-id',JSON.stringify({sourceEventId:'moved-id',sourceVersion:kind==='legacy'?'official-physical-pitch-workload-v1':'actual-total-play-workload-v1',
    careerId:scope.careerId,playerId:scope.playerId,kind:'MATCH',evidenceId:'original-evidence'}));
  expect(()=>(kind==='actual'?assertNoActualRoleWorkloadCharge:assertNoLegacyPitchWorkloadCharge)(db,scope)).toThrow(/workload.*charge/);
}));
