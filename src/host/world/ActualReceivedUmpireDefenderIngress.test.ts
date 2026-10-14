import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { actualLiveAdmissionOwners, beginActualLivePlayWrite, recordActualLivePlayAdmission, beginActualLivePlayRegistration,
  assertActualLivePlayRegistrationUnchanged } from './ActualLivePlayFence';
import { installReceivedOwnerSchema } from './ActualReceivedUmpireDefenderSchema';
import { openSqliteActualFirstBasePlayEndStore } from './SqliteActualFirstBasePlayEndStore';
import { openSqliteActualFoulPlayEndStore } from './SqliteActualFoulPlayEndStore';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Db = InstanceType<typeof DatabaseSync>;
const scope = { gameId: 'game-a', playId: 1, physicalPitchSourceId: 'pitch-a' };
const install = (db: Db) => {
  installReceivedOwnerSchema(db);
  db.prepare('INSERT INTO actual_received_umpire_defender_enrollments VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    'enroll-a', 'v1', 'game-a', 1, 'pitch-a', 'player-a', 'runtime-a', 'call-a', 'send-a', 24, 'prefix',
    '{"capability":"received_umpire_defender_enrollment_v1","currentExecutionSourceId":"execution-a"}', 'source-hash', '{}', 'snapshot-hash');
};
const snapshot = (db: Db) => db.prepare("SELECT * FROM main.sqlite_master ORDER BY name").all();

it('blocks every literal fresh legacy admission owner immediately after enrollment without a process', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('BEGIN'); install(db); const before = snapshot(db), changes = db.prepare('SELECT total_changes() AS n').get();
    for (const owner of actualLiveAdmissionOwners) {
      let error: unknown;
      try { beginActualLivePlayWrite(db, scope, { owner, sourceId: 'next-'+owner }); } catch (e) { error = e; }
      expect(String(error), 'LEGACY_RECEIVED_FENCE_MISSING').toMatch(/received.*pending/i);
    }
    expect(snapshot(db)).toEqual(before); expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(changes); db.exec('ROLLBACK');
  } finally { db.close(); }
});

it('blocks game-play-only fresh ingress and rechecks extension claims after a legacy producer write', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('BEGIN');
    const token = beginActualLivePlayWrite(db, scope, { owner: 'batted_world_field_executions', sourceId: 'next' });
    install(db);
    let error: unknown;
    try { recordActualLivePlayAdmission(db, token); } catch (e) { error = e; }
    expect(String(error), 'POST_WRITE_RECEIVED_FENCE_MISSING').toMatch(/received/i);
    error = undefined;
    try { beginActualLivePlayWrite(db, { gameId: 'game-a', playId: 1 }, { owner: 'physical_pitch_progress_actions', sourceId: 'next' }); } catch (e) { error = e; }
    expect(String(error), 'GAME_PLAY_RECEIVED_FENCE_MISSING').toMatch(/received/i); db.exec('ROLLBACK');
  } finally { db.close(); }
});

it('rejects registration and its post-write verification when prospective received claims appear', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('BEGIN'); const token = beginActualLivePlayRegistration(db, scope); install(db);
    let error: unknown;
    try { assertActualLivePlayRegistrationUnchanged(db, token); } catch (e) { error = e; }
    expect(String(error), 'REGISTRATION_RECEIVED_FENCE_MISSING').toMatch(/received/i);
    error = undefined; try { beginActualLivePlayRegistration(db, scope); } catch (e) { error = e; }
    expect(String(error), 'REGISTRATION_RECEIVED_FENCE_MISSING').toMatch(/received/i); db.exec('ROLLBACK');
  } finally { db.close(); }
});

it('rejects both fresh terminal writers through surviving execution references before attempting terminal proof', () => {
  const directory = mkdtempSync(join(tmpdir(), 'received-terminal-ingress-')), path = join(directory, 'state.sqlite');
  const firstSource = { sourceId: 'end-a', sourceVersion: 'v1', runtimeSourceId: 'runtime-a', baseFieldSourceId: 'field-a',
    executionSourceId: 'execution-a', ruleConsumptionSourceId: 'rule-a', umpireCallSourceId: 'call-a', communicationSourceId: 'receive-a' };
  const foulSource = { sourceId: 'foul-a', sourceVersion: 'v1', capability: 'actual_original_settled_foul_play_end_v1' as const,
    baseFieldSourceId: 'field-a', executionSourceId: 'execution-a', ruleConsumptionSourceId: 'rule-a' };
  const first = openSqliteActualFirstBasePlayEndStore(path, { readAcceptedEnd: () => firstSource });
  const foul = openSqliteActualFoulPlayEndStore(path, { readAcceptedEnd: () => foulSource });
  const db = new DatabaseSync(path);
  try {
    db.exec('BEGIN'); install(db); db.exec('COMMIT'); const before = snapshot(db);
    for (const [store, source] of [[first, firstSource], [foul, foulSource]] as const) {
      let error: unknown; try { store.accept(source.sourceId); } catch (e) { error = e; }
      expect(String(error), 'TERMINAL_RECEIVED_FENCE_MISSING').toMatch(/received.*pending/i);
    }
    expect(snapshot(db)).toEqual(before);
    for (const table of ['actual_first_base_play_ends', 'actual_foul_play_ends', 'actual_live_play_fences']) {
      expect(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n).toBe(0);
    }
  } finally { db.close(); first.close(); foul.close(); rmSync(directory, { recursive: true }); }
});
