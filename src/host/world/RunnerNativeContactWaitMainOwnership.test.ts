import { expect, it } from 'vitest';
import { openSqliteRunnerContactWaitStore, runnerContactWaitPolicyViewEvidenceFromSqlite } from './SqliteActualLocomotionStore';
import { runnerContactWaitProspectiveFixture } from './RunnerNativeContactWaitFixtures.test-support';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerObservationModelEvidenceFromSqlite } from './SqlitePlayerObservationModelStore';
import { readOriginalPrePitchRunnerRecipient } from './PrePitchRunnerEvidenceFromSqlite';

const quote = (value: string) => '"'+value.replaceAll('"','""')+'"';
type Fixture = ReturnType<typeof runnerContactWaitProspectiveFixture>;
const snapshot = (x: Fixture) => ({
  mainSchema: x.f.db.prepare('SELECT name,type,sql FROM main.sqlite_master ORDER BY name,type').all(),
  tempSchema: x.f.db.prepare('SELECT name,type,sql FROM temp.sqlite_master ORDER BY name,type').all(),
  mainRows: Object.fromEntries(x.f.db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' ORDER BY name").all()
    .map(row => String(row.name)).map(name => [name,x.f.db.prepare('SELECT * FROM main.'+quote(name)).all().map(hash).sort()])),
  changes: x.f.db.prepare('SELECT total_changes() AS n').get()!.n,
});
const shadow = (x: Fixture, table: string, kind: 'table' | 'view') => {
  const backing = kind === 'table' ? table : 'runner_temp_backing';
  x.f.db.exec('CREATE TEMP TABLE '+quote(backing)+' AS SELECT * FROM main.'+quote(table));
  if (kind === 'view') x.f.db.exec('CREATE TEMP VIEW '+quote(table)+' AS SELECT * FROM temp.'+quote(backing));
  return { backing, close() {
    x.f.db.exec('DROP '+(kind === 'table' ? 'TABLE' : 'VIEW')+' temp.'+quote(table));
    if (kind === 'view') x.f.db.exec('DROP TABLE temp.'+quote(backing));
  } };
};
const requireMainRejection = (x: Fixture, read: () => unknown, otherwise: unknown) => {
  x.f.db.exec('BEGIN'); x.f.db.exec('PRAGMA query_only=ON');
  try {
    const before = snapshot(x); let rejected = false, returned: unknown;
    try { returned = read(); } catch (error) { expect(error).toBeInstanceOf(Error); rejected = true; }
    if (!rejected) expect(returned).toEqual(otherwise); // Pre-repair discriminating ownership witness.
    expect(x.f.db.isTransaction).toBe(true); expect(x.f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
    expect(snapshot(x)).toEqual(before);
    expect(rejected).toBe(true);
  } finally { x.f.db.exec('ROLLBACK'); x.f.db.exec('PRAGMA query_only=OFF'); }
};

it.each(['table','view'] as const)
('rejects a canonical TEMP %s policy clone whose Source was never admitted in main', kind => {
  const x = runnerContactWaitProspectiveFixture();
  try {
    const store = x.f.track(openSqliteRunnerContactWaitStore(x.f.path,x.authority)), saved = store.acceptPolicy(x.policy.sourceId);
    const evidence = runnerContactWaitPolicyViewEvidenceFromSqlite(x.f.db);
    const fakeSource = { ...saved.source,sourceId:'runner-temp-unowned-policy' }, fake = { ...saved,source:fakeSource,sourceHash:hash(fakeSource) };
    const s = shadow(x,'actual_runner_contact_wait_policies',kind);
    try {
      x.f.db.prepare('UPDATE temp.'+quote(s.backing)+' SET source_id=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=? WHERE source_id=?')
        .run(fakeSource.sourceId,json(fakeSource),hash(fakeSource),json(fake),hash(fake),saved.source.sourceId);
      expect(x.f.db.prepare('SELECT count(*) AS n FROM main.actual_runner_contact_wait_policies WHERE source_id=?').get(fakeSource.sourceId)!.n).toBe(0);
      requireMainRejection(x,() => evidence.readPolicy(fakeSource.sourceId),fake);
    } finally { s.close(); }
    expect(runnerContactWaitPolicyViewEvidenceFromSqlite(x.f.db).readPolicy(saved.source.sourceId)).toEqual(saved);
  } finally { try { x.f.close(); } finally { x.cleanupFile(); } }
});

it.each(['table','view'] as const)
('rejects a late TEMP %s view clone through an existing reader after the dependent pitch', kind => {
  const x = runnerContactWaitProspectiveFixture();
  try {
    const store = x.f.track(openSqliteRunnerContactWaitStore(x.f.path,x.authority)); store.acceptPolicy(x.policy.sourceId);
    const saved = store.acceptView(x.view.sourceId), evidence = runnerContactWaitPolicyViewEvidenceFromSqlite(x.f.db);
    expect(evidence.readView(saved.source.sourceId)).toEqual(saved);
    const pitch = x.advancePitch(); expect(pitch.frame.batterActor?.source.sourceId).toBe(x.actor.source.sourceId);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM main.physical_pitch_progress_actions WHERE game_id=? AND play_id=?')
      .get(x.actor.source.gameId,x.actor.match.playId)!.n).toBe(1);
    const fakeSource = { ...saved.source,sourceId:'runner-temp-late-view' }, fake = { ...saved,source:fakeSource,sourceHash:hash(fakeSource) };
    const s = shadow(x,'actual_runner_event_views',kind);
    try {
      x.f.db.prepare('UPDATE temp.'+quote(s.backing)+' SET source_id=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=? WHERE source_id=?')
        .run(fakeSource.sourceId,json(fakeSource),hash(fakeSource),json(fake),hash(fake),saved.source.sourceId);
      expect(x.f.db.prepare('SELECT count(*) AS n FROM main.actual_runner_event_views WHERE source_id=?').get(fakeSource.sourceId)!.n).toBe(0);
      expect(x.f.db.prepare('SELECT count(*) AS n FROM main.actual_runner_event_views WHERE source_id=?').get(saved.source.sourceId)!.n).toBe(1);
      requireMainRejection(x,() => evidence.readView(fakeSource.sourceId),fake);
    } finally { s.close(); }
    expect(evidence.readView(saved.source.sourceId)).toEqual(saved);
  } finally { try { x.f.close(); } finally { x.cleanupFile(); } }
});

it.each([
  ['world_player_observation_models','table'],['world_player_observation_models','view'],
  ['world_player_fielding_models','table'],['world_player_fielding_models','view'],
] as const)
('rejects an otherwise matching TEMP %s %s dependency introduced after reader construction', (table,kind) => {
  const x = runnerContactWaitProspectiveFixture();
  try {
    const store = x.f.track(openSqliteRunnerContactWaitStore(x.f.path,x.authority)), saved = store.acceptPolicy(x.policy.sourceId);
    const evidence = runnerContactWaitPolicyViewEvidenceFromSqlite(x.f.db); expect(evidence.readPolicy(saved.source.sourceId)).toEqual(saved);
    const s = shadow(x,table,kind);
    const original = x.f.db.prepare('SELECT source_hash FROM main.'+quote(table)).get()!.source_hash;
    try {
      expect(x.f.db.prepare('UPDATE main.'+quote(table)+" SET source_hash='corrupt-main-dependency'").run().changes).toBe(1);
      // Its unchanged TEMP copy still passes the lower reader, so an old higher read really accepts it.
      expect(playerObservationModelEvidenceFromSqlite(x.f.db).read(x.model.source.sourceId)).toEqual(x.model);
      requireMainRejection(x,() => evidence.readPolicy(saved.source.sourceId),saved);
    } finally { s.close(); x.f.db.prepare('UPDATE main.'+quote(table)+' SET source_hash=?').run(original); }
    expect(evidence.readPolicy(saved.source.sourceId)).toEqual(saved);
  } finally { try { x.f.close(); } finally { x.cleanupFile(); } }
});

it('rejects a TEMP original-recipient binding that hides a changed main authority through an existing reader', () => {
  const x = runnerContactWaitProspectiveFixture();
  try {
    const store = x.f.track(openSqliteRunnerContactWaitStore(x.f.path,x.authority)); store.acceptPolicy(x.policy.sourceId);
    const saved = store.acceptView(x.view.sourceId), evidence = runnerContactWaitPolicyViewEvidenceFromSqlite(x.f.db);
    const original = x.f.db.prepare('SELECT binding_json FROM main.official_participant_bindings WHERE game_id=? AND player_id=?')
      .get(x.actor.source.gameId,x.runner.playerId)!.binding_json;
    const s = shadow(x,'official_participant_bindings','table');
    try {
      const changed = { ...JSON.parse(String(original)),personId:'wrong-main-recipient' };
      expect(x.f.db.prepare('UPDATE main.official_participant_bindings SET binding_json=? WHERE game_id=? AND player_id=?')
        .run(JSON.stringify(changed),x.actor.source.gameId,x.runner.playerId).changes).toBe(1);
      expect(hash(readOriginalPrePitchRunnerRecipient(x.f.db,x.actor,x.runner.playerId).binding)).toBe(saved.recipientBindingHash);
      requireMainRejection(x,() => evidence.readView(saved.source.sourceId),saved);
    } finally {
      s.close(); x.f.db.prepare('UPDATE main.official_participant_bindings SET binding_json=? WHERE game_id=? AND player_id=?')
        .run(original,x.actor.source.gameId,x.runner.playerId);
    }
    expect(evidence.readView(saved.source.sourceId)).toEqual(saved);
  } finally { try { x.f.close(); } finally { x.cleanupFile(); } }
});

it('rejects a missing main observation model replaced by attached storage through an existing reader', () => {
  const x = runnerContactWaitProspectiveFixture();
  try {
    const store = x.f.track(openSqliteRunnerContactWaitStore(x.f.path,x.authority)), saved = store.acceptPolicy(x.policy.sourceId);
    const evidence = runnerContactWaitPolicyViewEvidenceFromSqlite(x.f.db);
    const schema = String(x.f.db.prepare("SELECT sql FROM main.sqlite_master WHERE name='world_player_observation_models'").get()!.sql);
    x.f.db.exec("ATTACH DATABASE ':memory:' AS replacement"); let dropped = false;
    try {
      x.f.db.exec('CREATE TABLE replacement.world_player_observation_models AS SELECT * FROM main.world_player_observation_models');
      x.f.db.exec('DROP TABLE main.world_player_observation_models'); dropped = true;
      expect(x.f.db.prepare("SELECT name FROM main.sqlite_master WHERE name='world_player_observation_models'").get()).toBeUndefined();
      expect(playerObservationModelEvidenceFromSqlite(x.f.db).read(x.model.source.sourceId)).toEqual(x.model);
      requireMainRejection(x,() => evidence.readPolicy(saved.source.sourceId),saved);
    } finally {
      if (dropped) {
        x.f.db.exec(schema); x.f.db.exec('INSERT INTO main.world_player_observation_models SELECT * FROM replacement.world_player_observation_models');
      }
      x.f.db.exec('DROP TABLE replacement.world_player_observation_models'); x.f.db.exec('DETACH DATABASE replacement');
    }
    expect(evidence.readPolicy(saved.source.sourceId)).toEqual(saved);
  } finally { try { x.f.close(); } finally { x.cleanupFile(); } }
});
