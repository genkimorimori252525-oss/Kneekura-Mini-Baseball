import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { expect, it } from 'vitest';
import { installReceivedOwnerSchema, receivedOwnerTables, type ReceivedOwnerTable } from './ActualReceivedUmpireDefenderSchema';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Db = InstanceType<typeof DatabaseSync>;
const scope = { gameId: 'game-a', playId: 1, physicalPitchSourceId: 'pitch-a' };
const load = async () => {
  expect(existsSync(new URL('./ActualReceivedUmpireDefenderClaims.ts', import.meta.url)), 'RECEIVED_LIVE_IMPLEMENTATION_MISSING').toBe(true);
  return import('./ActualReceivedUmpireDefenderClaims');
};
const fixture = () => {
  const db = new DatabaseSync(':memory:'); db.exec('BEGIN'); installReceivedOwnerSchema(db); db.exec('COMMIT');
  for (const owner of ['physical_pitch_progress_actions', 'actual_live_play_runtimes', 'batted_world_field_executions', 'actual_field_observations',
    'actual_defensive_decisions', 'actual_locomotion_receipts', 'actual_call_communications', 'actual_first_base_umpire_calls']) {
    db.exec(`CREATE TABLE ${owner}(source_id TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,source_json TEXT,snapshot_json TEXT)`);
    for (const suffix of ['a', 'b']) {
      const id = owner === 'physical_pitch_progress_actions' ? 'pitch-'+suffix : owner+'-'+suffix;
      db.prepare(`INSERT INTO ${owner} VALUES(?,?,?,?,?,?)`).run(id, 'game-'+suffix, 1, 'pitch-'+suffix,
        JSON.stringify({ sourceId: id, gameId: 'game-'+suffix, physicalPitchSourceId: 'pitch-'+suffix }),
        JSON.stringify({ source: { sourceId: id }, gameId: 'game-'+suffix, playId: 1, physicalPitchSourceId: 'pitch-'+suffix }));
    }
  }
  return db;
};
const insert = (db: Db, table: ReceivedOwnerTable, overrides: Record<string, unknown> = {}) => {
  const fields = db.prepare(`PRAGMA table_info(${table})`).all();
  const row: Record<string, unknown> = {};
  for (const field of fields) row[String(field.name)] = field.type === 'INTEGER' ? 1 : String(field.name)+'-b';
  Object.assign(row, { source_id: table+'-b', game_id: 'game-b', play_id: 1, physical_pitch_source_id: 'pitch-b', player_id: 'shared-player',
    runtime_source_id: 'actual_live_play_runtimes-b', enrollment_source_id: 'enrollment-b', owner: 'actual_received_umpire_defender_enrollments',
    source_json: '{}', snapshot_json: '{}', previous_receipt_hash: null }, overrides);
  if ('source_json' in row && table !== 'actual_received_umpire_defender_replan_heads' && table !== 'actual_received_umpire_defender_admissions') {
    const base={sourceId:String(row.source_id),sourceVersion:'synthetic-v1',physicalPitchSourceId:'pitch-b',playerId:'shared-player',observationSourceId:'actual_field_observations-b',currentExecutionSourceId:'batted_world_field_executions-b'};
    const predecessor={predecessorDecisionSourceId:'actual_defensive_decisions-b',predecessorMotorSourceId:'actual_locomotion_receipts-b',predecessorAdoptionSourceId:'batted_world_field_executions-b'};
    const original=table==='actual_received_umpire_defender_enrollments'?{...base,...predecessor,capability:'received_umpire_defender_enrollment_v1',runtimeSourceId:'actual_live_play_runtimes-b'}
      :table==='actual_received_umpire_defender_replans'?{...base,...predecessor,capability:'received_umpire_defender_replan_v2',enrollmentSourceId:String(row.enrollment_source_id),policySourceId:null,previousReplanSourceId:null}
      :{...base,capability:'received_umpire_defender_policy_availability_v1',provenance:'accepted_at_current_actual_observation_v1',enrollmentSourceId:String(row.enrollment_source_id),policyDataSourceId:'shared-policy'};
    try{row.source_json=JSON.stringify({...original,...JSON.parse(String(row.source_json))});}catch{/* Intentional malformed JSON stays raw. */}
  }
  const keys = fields.map(field => String(field.name));
  db.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`).run(...keys.map(key => row[key]) as never[]);
};
const count = (db: Db) => receivedOwnerTables.map(table => db.prepare(`SELECT * FROM ${table}`).all());

it('returns no claim for pristine and complete empty namespaces without requiring missing original owners', async () => {
  const m = await load(), db = new DatabaseSync(':memory:');
  try {
    expect(m.receivedDefenderClaims(db, scope)).toEqual([]);
    expect(db.prepare('SELECT * FROM sqlite_master').all()).toEqual([]);
    db.exec('BEGIN'); installReceivedOwnerSchema(db); db.exec('COMMIT');
    expect(m.receivedDefenderClaims(db, scope)).toEqual([]);
  } finally { db.close(); }
});

it('finds enrollment process and renewal claims through indexed scope without changing any rows', async () => {
  const m = await load();
  for (const table of ['actual_received_umpire_defender_enrollments', 'actual_received_umpire_defender_replans', 'actual_received_umpire_defender_replan_heads'] as const) {
    const db = fixture();
    try {
      insert(db, table, { physical_pitch_source_id: 'pitch-a' }); const before = count(db);
      expect(m.receivedDefenderClaims(db, scope).length).toBeGreaterThan(0);
      expect(() => m.assertNoReceivedDefenderClaims(db, scope)).toThrow(/received.*pending/i);
      expect(count(db)).toEqual(before);
    } finally { db.close(); }
  }
});

it('follows Source-only runtime pitch execution observation decision motor adoption communication and call references after cached scopes move', async () => {
  const m = await load();
  const refs = { runtimeSourceId: 'actual_live_play_runtimes-a', physicalPitchSourceId: 'pitch-a', currentExecutionSourceId: 'batted_world_field_executions-a',
    observationSourceId: 'actual_field_observations-a', predecessorDecisionSourceId: 'actual_defensive_decisions-a', predecessorMotorSourceId: 'actual_locomotion_receipts-a',
    predecessorAdoptionSourceId: 'batted_world_field_executions-a', communicationSourceId: 'actual_call_communications-a', callSourceId: 'actual_first_base_umpire_calls-a' };
  for (const [key, value] of Object.entries(refs)) {
    const db = fixture();
    try { insert(db, 'actual_received_umpire_defender_enrollments', key==='communicationSourceId'||key==='callSourceId'
      ? {snapshot_json:JSON.stringify({anchor:{[key==='communicationSourceId'?'communication':'call']:{sourceId:value}}})}
      : { source_json: JSON.stringify({ [key]: value }) });
      expect(m.receivedDefenderClaims(db, { gameId: 'game-a', playId: 1 }).length, key).toBeGreaterThan(0);
    } finally { db.close(); }
  }
});

it('resolves game-play-only ingress from raw original pitch metadata after its index scope moves', async () => {
  const m = await load(), db = fixture();
  try {
    db.prepare('UPDATE physical_pitch_progress_actions SET game_id=?,play_id=? WHERE source_id=?').run('moved', 99, 'pitch-a');
    insert(db, 'actual_received_umpire_defender_enrollments', { source_json: '{"physicalPitchSourceId":"pitch-a"}' });
    expect(() => m.assertNoReceivedDefenderClaims(db, { gameId: 'game-a', playId: 1 })).toThrow();
  } finally { db.close(); }
});

it('keeps head-only and journal-only claims visible after their enrollment row disappears', async () => {
  const m = await load();
  for (const table of ['actual_received_umpire_defender_replan_heads', 'actual_received_umpire_defender_admissions'] as const) {
    const db = fixture();
    try { insert(db, table, { physical_pitch_source_id: 'pitch-a' });
      expect(() => m.assertNoReceivedDefenderClaims(db, scope)).toThrow(/received.*pending/i);
    } finally { db.close(); }
  }
});

it('closes namespace-qualified links through enrollment previous origin policy head and journal references in both directions', async () => {
  const m = await load(), db = fixture();
  try {
    insert(db, 'actual_received_umpire_defender_replan_heads', { source_id: 'r2', enrollment_source_id: 'enroll', physical_pitch_source_id: 'pitch-a', origin_process_source_id: 'r1' });
    insert(db, 'actual_received_umpire_defender_replans', { source_id: 'r2', enrollment_source_id: 'enroll', origin_process_source_id: 'r1', previous_source_id: 'r1', policy_source_id: 'availability' });
    insert(db, 'actual_received_umpire_defender_replans', { source_id: 'r1', enrollment_source_id: 'enroll', origin_process_source_id: 'r1', revision: 2 });
    insert(db, 'actual_received_umpire_defender_policy_availabilities', { source_id: 'availability', enrollment_source_id: 'enroll' });
    insert(db, 'actual_received_umpire_defender_enrollments', { source_id: 'enroll' });
    insert(db, 'actual_received_umpire_defender_admissions', { source_id: 'availability', enrollment_source_id: 'enroll', owner: 'actual_received_umpire_defender_policy_availabilities' });
    const claims = m.receivedDefenderClaims(db, scope);
    expect(claims).toHaveLength(6); expect(new Set(claims.map(c => c.owner)).size).toBe(5);
  } finally { db.close(); }
});

it('enumerates escaped and duplicate nested anchor aliases before choosing a canonical scope', async () => {
  const m = await load();
  for (const snapshot of ['{"anchor":{"execution":{"sourceId":"batted_world_field_executions-a"}}}',
    '{"anchor":{"execution":{"sourceId":"batted_world_field_executions-a"}},"anchor":{}}',
    '{"source":{"physicalPitchSourceId":"pitch-a","physicalPitchSourceId":"pitch-b"}}',
    '{"source":{"physicalPitchSource\\u0049d":"pitch-a"}}']) {
    const db = fixture();
    try { insert(db, 'actual_received_umpire_defender_enrollments', { snapshot_json: snapshot });
      expect(() => m.assertNoReceivedDefenderClaims(db, scope)).toThrow(/received.*pending/i);
    } finally { db.close(); }
  }
});

it('does not connect another play solely through shared Player Person fielding model or inert policy identities', async () => {
  const m = await load(), db = fixture();
  try {
    insert(db, 'actual_received_umpire_defender_enrollments', { source_json: '{"physicalPitchSourceId":"pitch-b","playerId":"shared-player"}',
      snapshot_json: '{"receiver":{"playerId":"shared-player","personId":"shared-person","fieldingModelSourceId":"shared-model"}}' });
    insert(db, 'actual_received_umpire_defender_policy_availabilities', { policy_data_source_id: 'shared-policy',
      source_json: '{"physicalPitchSourceId":"pitch-b","policyDataSourceId":"shared-policy"}' });
    expect(m.receivedDefenderClaims(db, scope)).toEqual([]);
  } finally { db.close(); }
});

it('rejects malformed partial and unsupported owner state rather than falling back to legacy admission', async () => {
  const m = await load(), db = fixture();
  try {
    insert(db, 'actual_received_umpire_defender_enrollments', { source_json: '{broken' });
    expect(() => m.receivedDefenderClaims(db, scope)).toThrow(/metadata|JSON/i);
    db.exec('DROP TABLE actual_received_umpire_defender_replans');
    expect(() => m.receivedDefenderClaims(db, scope)).toThrow(/schema/i);
  } finally { db.close(); }
});

it('finds surviving Core input and origin evidence reference objects after all Source scope mirrors move', async () => {
  const m = await load();
  const paths = [
    ['input', 'observation', 'actual_field_observations-a'],
    ['input', 'communication', 'actual_call_communications-a'],
    ['input', 'predecessor', 'command', 'actual_defensive_decisions-a'],
    ['input', 'predecessor', 'motor', 'actual_locomotion_receipts-a'],
    ['replan', 'originEvidence', 'observation', 'actual_field_observations-a'],
    ['replan', 'originEvidence', 'communication', 'actual_call_communications-a'],
  ];
  for (const path of paths) {
    const db = fixture();
    try {
      let value: unknown = { sourceId: path.at(-1) };
      for (const key of path.slice(0, -1).reverse()) value = { [key]: value };
      insert(db, 'actual_received_umpire_defender_replans', { snapshot_json: JSON.stringify(value) });
      expect(m.receivedDefenderClaims(db, scope).length, 'SURVIVING_CORE_REFERENCE_HIDDEN').toBeGreaterThan(0);
    } finally { db.close(); }
  }
});

it('rejects an unsupported extension capability even when its cached scope has moved', async () => {
  const m = await load(), db = fixture();
  try {
    insert(db, 'actual_received_umpire_defender_enrollments', { source_json: '{"capability":"received_umpire_defender_enrollment_v99"}' });
    expect(() => m.receivedDefenderClaims(db, scope), 'UNSUPPORTED_EXTENSION_VERSION_IGNORED').toThrow(/capability|version/i);
  } finally { db.close(); }
});

it('fails closed when an incomplete Source leaves its original applicability unknown',async()=>{
  const m=await load(),db=fixture();
  try{insert(db,'actual_received_umpire_defender_enrollments');db.exec("UPDATE actual_received_umpire_defender_enrollments SET source_json='{}'");
    expect(()=>m.receivedDefenderClaims(db,scope),'INCOMPLETE_SOURCE_CLAIM_IGNORED').toThrow(/Source|metadata/);
  }finally{db.close();}
});
