import { createRequire } from 'node:module';
import { afterEach, expect, it } from 'vitest';
import { actualLivePlayInventoryFromSqlite } from './ActualLivePlayInventoryFromSqlite';
import type { ActualLivePlayScope } from './ActualLivePlayScope';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const databases: InstanceType<typeof DatabaseSync>[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
// Metadata-only adversaries; these intentionally opaque rows are never Native physical evidence.
const scope = { physicalPitchSourceId: 'pitch', gameId: 'game', participants: [{ playerId: 'p' }], cut: { kind: 'original_pitch' } } as unknown as ActualLivePlayScope;
const fixture = () => {
  const db = new DatabaseSync(':memory:'); databases.push(db);
  db.exec(`CREATE TABLE actual_field_observations (source_id TEXT,physical_pitch_source_id TEXT,player_id TEXT,base_field_source_id TEXT,
    execution_source_id TEXT,observation_model_source_id TEXT,previous_source_id TEXT,revision INTEGER,source_json TEXT,snapshot_json TEXT);
    CREATE TABLE actual_field_observation_heads (physical_pitch_source_id TEXT,player_id TEXT,source_id TEXT,revision INTEGER);
    CREATE TABLE batted_world_field_actions (source_id TEXT,physical_pitch_source_id TEXT,revision INTEGER,game_id TEXT);
    INSERT INTO batted_world_field_actions VALUES ('field','pitch',1,'game');`);
  const source = { sourceId: 'observation', sourceVersion: 'future-v2', physicalPitchSourceId: 'pitch', playerId: 'p',
    baseFieldSourceId: 'field', executionSourceId: null, observationModelSourceId: 'model', previousObservationSourceId: null,
    view: 'opaque future observation payload' };
  const snapshot = { source, revision: 1, history: [source], receipt: 'opaque future receipt' };
  db.prepare('INSERT INTO actual_field_observations VALUES (?,?,?,?,?,?,?,?,?,?)').run('observation', 'pitch', 'p', 'field', null, 'model', null, 1,
    JSON.stringify(source), JSON.stringify(snapshot));
  db.exec("INSERT INTO actual_field_observation_heads VALUES ('pitch','p','observation',1)");
  return { db, source, snapshot };
};
it('retains an installed future owner while excluding all opaque domain payloads from an original-pitch cut', () => {
  const { db } = fixture(), result = actualLivePlayInventoryFromSqlite(db, scope);
  expect(result.installed.actual_field_observations).toBe(true); expect(result.observations).toEqual([]);
  expect(typeof result.metadataHash).toBe('string');
  db.exec("UPDATE actual_field_observations SET snapshot_json=json_set(snapshot_json,'$.receipt','changed opaque payload')");
  expect(actualLivePlayInventoryFromSqlite(db, scope).metadataHash).toBe(result.metadataHash);
});
it.each(['fractional head', 'hidden Source alias', 'foreign pitch', 'duplicate version', 'missing version', 'foreign future field'])(
  'rejects invalid future ownership metadata without reading its payload: %s', mutation => {
    const { db, source } = fixture();
    if (mutation === 'fractional head') db.exec('UPDATE actual_field_observation_heads SET revision=1.5');
    if (mutation === 'foreign pitch') db.exec("UPDATE actual_field_observations SET physical_pitch_source_id='foreign'");
    if (mutation === 'hidden Source alias') db.prepare('UPDATE actual_field_observations SET source_json=?')
      .run(JSON.stringify(source).slice(0, -1) + ',"sourceId":"alias"}');
    if (mutation === 'duplicate version') db.prepare('UPDATE actual_field_observations SET source_json=?')
      .run(JSON.stringify(source).slice(0, -1) + ',"sourceVersion":"future-v2"}');
    if (mutation === 'missing version') db.exec("UPDATE actual_field_observations SET source_json=json_remove(source_json,'$.sourceVersion')");
    if (mutation === 'foreign future field') db.exec("UPDATE batted_world_field_actions SET physical_pitch_source_id='foreign'");
    expect(() => actualLivePlayInventoryFromSqlite(db, scope)).toThrow();
  });
it('does not mistake an absent owner or an empty installed owner for a generation certificate', () => {
  const db = new DatabaseSync(':memory:'); databases.push(db);
  expect(actualLivePlayInventoryFromSqlite(db, scope).installed.actual_field_observations).toBe(false);
  db.exec('CREATE TABLE actual_field_observation_heads (physical_pitch_source_id TEXT,player_id TEXT,source_id TEXT,revision INTEGER)');
  expect(() => actualLivePlayInventoryFromSqlite(db, scope)).toThrow(/tables/);
});

it('rejects a future observation model switch even when no domain payload is in the selected cut', () => {
  const { db, source } = fixture();
  const second = { ...source, sourceId: 'future', observationModelSourceId: 'other-model', previousObservationSourceId: source.sourceId };
  db.prepare('INSERT INTO actual_field_observations VALUES (?,?,?,?,?,?,?,?,?,?)').run(second.sourceId, 'pitch', 'p', 'field', null, 'other-model', source.sourceId, 2,
    JSON.stringify(second), JSON.stringify({ source: second, revision: 2, history: [source, second], receipt: 'opaque' }));
  db.exec("UPDATE actual_field_observation_heads SET source_id='future',revision=2");
  expect(() => actualLivePlayInventoryFromSqlite(db, scope)).toThrow();
});
it('validates the physical cut of an undisplayed future motor without materializing its domain payload', () => {
  const { db } = fixture();
  db.exec(`CREATE TABLE actual_defensive_decisions (source_id TEXT,source_version TEXT,physical_pitch_source_id TEXT,player_id TEXT,
    observation_source_id TEXT,decision_model_source_id TEXT,plan_source_id TEXT,previous_source_id TEXT,revision INTEGER,source_json TEXT,snapshot_json TEXT);
    CREATE TABLE actual_defensive_decision_heads (physical_pitch_source_id TEXT,player_id TEXT,source_id TEXT,revision INTEGER);
    CREATE TABLE actual_locomotion_receipts (source_id TEXT,source_version TEXT,capability TEXT,physical_pitch_source_id TEXT,player_id TEXT,
    decision_source_id TEXT,locomotion_model_source_id TEXT,base_field_source_id TEXT,execution_source_id TEXT,source_json TEXT,snapshot_json TEXT);
    CREATE TABLE actual_locomotion_heads (physical_pitch_source_id TEXT,player_id TEXT,source_id TEXT,revision INTEGER);`);
  const d = { sourceId: 'decision', sourceVersion: 'v1', physicalPitchSourceId: 'pitch', playerId: 'p', observationSourceId: 'observation',
    decisionModelSourceId: 'decision-model', planSourceId: 'plan', previousDecisionSourceId: null };
  db.prepare('INSERT INTO actual_defensive_decisions VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('decision', 'v1', 'pitch', 'p', 'observation', 'decision-model', 'plan', null, 1,
    JSON.stringify(d), JSON.stringify({ source: d, history: [d], revision: 1,
      receipt: { self: { playerId: 'p' }, originDecisionSourceId: 'decision', originObservationSourceId: 'observation' } }));
  db.exec("INSERT INTO actual_defensive_decision_heads VALUES ('pitch','p','decision',1)");
  const m = { sourceId: 'motor', sourceVersion: 'v1', capability: 'initial_defender_step_v1', physicalPitchSourceId: 'pitch', playerId: 'p',
    decisionSourceId: 'decision', locomotionModelSourceId: 'motor-model', baseFieldSourceId: 'foreign-field', executionSourceId: null };
  db.prepare('INSERT INTO actual_locomotion_receipts VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('motor', 'v1', 'initial_defender_step_v1', 'pitch', 'p', 'decision', 'motor-model', 'foreign-field', null,
    JSON.stringify(m), JSON.stringify({ source: m, history: [m], revision: 1, receipt: { self: { physicalPitchSourceId: 'pitch', playerId: 'p',
      cut: { physicalPitchSourceId: 'pitch', playerId: 'p', baseFieldSourceId: 'foreign-field', executionSourceId: null, mode: 'original' } }, command: { playerId: 'p' } } }));
  db.exec("INSERT INTO actual_locomotion_heads VALUES ('pitch','p','motor',1)");
  expect(() => actualLivePlayInventoryFromSqlite(db, scope)).toThrow();
});
