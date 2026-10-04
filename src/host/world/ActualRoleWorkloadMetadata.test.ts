import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { actualRoleWorkloadIdentityRow,actualRoleWorkloadScopeRows } from './ActualRoleWorkloadMetadata';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const scope={closureSourceId:'close',careerId:'career',gameId:'game',playId:3,physicalEndSourceId:'end'};
it('discovers source aliases through closure/end and independently mixed indexed/raw scope mirrors without parsing unrelated payload',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE actual_role_workload_assessments(source_id,closure_source_id,career_id,game_id,play_id,player_id,source_json,snapshot_json)');
 const insert=db.prepare('INSERT INTO actual_role_workload_assessments VALUES(?,?,?,?,?,?,?,?)');
 try {
  insert.run('one','other','other','other',4,'p',JSON.stringify({sourceId:'one',physicalEndReference:{sourceId:'end'}}),'{}');
  insert.run('two','other','career','other',3,'p','{}',JSON.stringify({actor:{binding:{gameId:'game'}}}));
  insert.run('unrelated','other','other','other',4,'p','malformed','malformed');
  expect(actualRoleWorkloadScopeRows(db,'actual_role_workload_assessments',scope).map(r=>r.source_id).sort()).toEqual(['one','two']);
 }finally{db.close();}
});
it('rejects escaped duplicate source IDs and snapshot identity aliases without hydrating future payload',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE actual_role_workload_assessments(source_id,source_json,snapshot_json)');
 try {
  db.prepare('INSERT INTO actual_role_workload_assessments VALUES(?,?,?)').run('id','{"sourceId":"id","source\\u0049d":"id"}','{"source":{"sourceId":"id"}}');
  expect(()=>actualRoleWorkloadIdentityRow(db,'actual_role_workload_assessments','id')).toThrow(/mirror/);
  db.exec('DELETE FROM actual_role_workload_assessments');
  db.prepare('INSERT INTO actual_role_workload_assessments VALUES(?,?,?)').run('alias','{}','{"source":{"sourceId":"id"},"opaque":"malformed"}');
  expect(()=>actualRoleWorkloadIdentityRow(db,'actual_role_workload_assessments','id')).toThrow(/ownership/);
 }finally{db.close();}
});
