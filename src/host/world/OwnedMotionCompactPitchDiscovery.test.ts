import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { battedWorldFieldExecutionEvidenceFromSqlite } from './SqliteBattedWorldFieldExecutionStore';
import { actorJson, actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { fieldNormalizationFixture } from './BattedWorldFieldNormalizationFixtures.test-support';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

it.each(['ordinary', 'escaped', 'duplicate_container', 'duplicate_key'] as const)
('discovers off-namespace compact pitch claims through %s metadata before bounded replay', form => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE batted_world_field_actions (source_id TEXT,physical_pitch_source_id TEXT,response_source_id TEXT,geometry_source_id TEXT,previous_source_id TEXT,revision INTEGER,game_id TEXT,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT);
      CREATE TABLE batted_world_field_heads (physical_pitch_source_id TEXT,response_source_id TEXT,geometry_source_id TEXT,source_id TEXT,revision INTEGER);
      CREATE TABLE batted_world_field_executions (source_id TEXT,physical_pitch_source_id TEXT,base_field_source_id TEXT,
        previous_source_id TEXT,revision INTEGER,game_id TEXT,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT);
      CREATE TABLE batted_world_field_execution_heads (physical_pitch_source_id TEXT,base_field_source_id TEXT,source_id TEXT,revision INTEGER);`);
    const { baseField } = fieldNormalizationFixture();
    db.prepare('INSERT INTO batted_world_field_actions VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('field','pitch','response','geometry',null,1,'game',actorJson(baseField.source),actorHash(baseField.source),actorJson(baseField),actorHash(baseField));
    db.prepare('INSERT INTO batted_world_field_heads VALUES (?,?,?,?,?)').run('pitch','response','geometry','field',1);
    const originalSource = { sourceId: 'owned-execution', sourceVersion: 'v1', baseFieldSourceId: 'field', previousExecutionSourceId: null, action: { kind: 'motion' } };
    const original = {source:originalSource,revision:1,history:[originalSource],baseField,execution:{opaque:true}};
    db.prepare('INSERT INTO batted_world_field_executions VALUES (?,?,?,?,?,?,?,?,?,?)').run('owned-execution','pitch','field',null,1,'game',JSON.stringify(originalSource),'opaque',JSON.stringify(original),'opaque');
    db.prepare('INSERT INTO batted_world_field_execution_heads VALUES (?,?,?,?)').run('pitch','field','owned-execution',1);
    const source = { sourceId: 'foreign-execution', sourceVersion: 'v1', baseFieldSourceId: 'foreign-field', previousExecutionSourceId: null, action: {kind: 'owned_motion_v2'} };
    const common = {source,revision:1,history:[{...source,action:undefined,sourceHash:'opaque'}],execution:{opaque:true}};
    const legacy = {...common, baseField: { source: {sourceId:'foreign-field',sourceVersion:'v1'},
      response:{model:{gameId:'foreign-game'},touch:{worldContact:{flight:{source:{physicalPitchSourceId:'pitch'}}}}}}};
    const compact = {...common,snapshotFormat:'owned_scheduled_field_execution_manifest_v1',baseField:{
      source:{sourceId:'foreign-field',sourceVersion:'v1'},physicalPitchSourceId:'pitch',gameId:'foreign-game',sourceHash:'opaque',snapshotHash:'opaque'}};
    db.prepare('INSERT INTO batted_world_field_executions VALUES (?,?,?,?,?,?,?,?,?,?)').run(
      'foreign-execution','foreign-pitch','foreign-field',null,1,'foreign-game',JSON.stringify(source),'opaque',JSON.stringify(legacy),'opaque');
    db.prepare('INSERT INTO batted_world_field_execution_heads VALUES (?,?,?,?)').run('foreign-pitch','foreign-field','foreign-execution',1);
    const reader = battedWorldFieldExecutionEvidenceFromSqlite(db);
    expect(() => reader.scope(baseField, null)).toThrow(/prefix|metadata/);
    let raw = JSON.stringify(compact);
    if (form === 'escaped') raw = raw.replace('"baseField":', '"base\\u0046ield":')
      .replace('"physicalPitchSourceId":', '"physical\\u0050itchSourceId":');
    if (form === 'duplicate_container') raw = raw.replace('"baseField":',
      '"baseField":{"physicalPitchSourceId":"unrelated"},"baseField":');
    if (form === 'duplicate_key') raw = raw.replace('"physicalPitchSourceId":"pitch"',
      '"physicalPitchSourceId":"unrelated","physicalPitchSourceId":"pitch"');
    db.prepare("UPDATE batted_world_field_executions SET snapshot_json=? WHERE source_id='foreign-execution'").run(raw);
    expect(() => reader.scope(baseField, null)).toThrow(/prefix|metadata/);
  } finally { db.close(); }
});
