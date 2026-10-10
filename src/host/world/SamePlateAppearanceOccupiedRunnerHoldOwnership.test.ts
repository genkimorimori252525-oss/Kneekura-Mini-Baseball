import { createRequire } from 'node:module';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
import { expect, it } from 'vitest';
import { batterRunArchiveFromSqlite } from './BatterRunSourceArchive';

it.each(['source_json', 'snapshot_json'] as const)('OH03 a surviving posture %s hold reference prevents absent-owner repair', column => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE batting_observation_v1_postures(source_json TEXT,snapshot_json TEXT)');
    const reference = { owner: 'world_same_pa_occupied_runner_holds', sourceId: 'deleted-hold', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) };
    const source = { occupiedRunnerHoldReferences: [reference] };
    db.prepare('INSERT INTO batting_observation_v1_postures VALUES(?,?)').run(column === 'source_json' ? JSON.stringify(source) : '{}',
      column === 'snapshot_json' ? JSON.stringify({ source }) : '{}');
    const before = db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();
    db.exec('PRAGMA query_only=1; BEGIN');
    const owner = batterRunArchiveFromSqlite(db, 'world_same_pa_occupied_runner_holds' as any,
      { input: (x: any) => x, derive: (source: any) => ({ source }), key: s => s.sourceId, scope: () => ({ sql: '0', values: [] }) });
    expect(() => owner.read('deleted-hold')).toThrow('surviving typed');
    expect(db.prepare('SELECT * FROM sqlite_master ORDER BY name').all()).toEqual(before);
    db.exec('ROLLBACK');
  } finally { db.close(); }
});
it.each(['pa_lifecycle_v1_outcomes', 'pa_lifecycle_v1_resets'])('OH04 a surviving %s retirement keeps its original hold claimed', table => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE ${table}(source_json TEXT,snapshot_json TEXT)`);
    const sourceReference = { owner: 'world_same_pa_occupied_runner_holds', sourceId: 'deleted-hold', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) };
    const basis = { participants: [{ ownedCommands: [{ sourceReference }] }] };
    const snapshot = table === 'pa_lifecycle_v1_outcomes' ? { controllerRetirementBasis: basis } : { retirement: { basis } };
    db.prepare(`INSERT INTO ${table} VALUES(?,?)`).run('{}', JSON.stringify(snapshot));
    const before = db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();
    db.exec('PRAGMA query_only=1; BEGIN');
    const owner = batterRunArchiveFromSqlite(db, 'world_same_pa_occupied_runner_holds',
      { input: (x: any) => x, derive: (source: any) => ({ source }), key: s => s.sourceId, scope: () => ({ sql: '0', values: [] }) });
    expect(() => owner.read('deleted-hold')).toThrow('surviving typed');
    expect(db.prepare('SELECT * FROM sqlite_master ORDER BY name').all()).toEqual(before);
    db.exec('ROLLBACK');
  } finally { db.close(); }
});
it.each(['source', 'source_mirror', 'result'] as const)('OH05 surviving %s received-response hold reference prevents absent-owner repair', arm => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE pa_physical_v1_field_steps(source_json TEXT,snapshot_json TEXT)');
    const holdReference = {owner:'world_same_pa_occupied_runner_holds',sourceId:'deleted-hold',sourceHash:'a'.repeat(64),snapshotHash:'b'.repeat(64)};
    const source = {action:{kind:'occupied_runner_catch_response_v1',holdReference}};
    const snapshot = arm === 'source_mirror' ? {source} : arm === 'result' ? {actionResult:{kind:'occupied_runner_catch_response_v1',holdReference}} : {};
    db.prepare('INSERT INTO pa_physical_v1_field_steps VALUES(?,?)').run(arm === 'source' ? JSON.stringify(source) : '{}',JSON.stringify(snapshot));
    db.exec('PRAGMA query_only=1; BEGIN');
    const owner = batterRunArchiveFromSqlite(db,'world_same_pa_occupied_runner_holds',
      {input:(x:any)=>x,derive:(source:any)=>({source}),key:s=>s.sourceId,scope:()=>({sql:'0',values:[]})});
    expect(()=>owner.read('deleted-hold')).toThrow('surviving typed response');
    db.exec('ROLLBACK');
  } finally { db.close(); }
});
