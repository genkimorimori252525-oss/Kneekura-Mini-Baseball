import type { DatabaseSync } from 'node:sqlite';
import { actorJson as json,actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export const initialJointRightTable='pa_initial_joint_v1_rights';
export const initialJointExecutionTable='pa_initial_joint_v1_executions';
export const initialJointSchemas={
  [initialJointRightTable]:`CREATE TABLE ${initialJointRightTable}(source_id TEXT PRIMARY KEY,launch_source_id TEXT NOT NULL UNIQUE,enrollment_source_id TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL)`,
  [initialJointExecutionTable]:`CREATE TABLE ${initialJointExecutionTable}(source_id TEXT PRIMARY KEY,launch_source_id TEXT NOT NULL UNIQUE,enrollment_source_id TEXT NOT NULL,right_source_id TEXT NOT NULL UNIQUE,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL)`
};
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('initial joint physical metadata: '+message);}
/** No install/repair on read, no extra trigger/view/index or TEMP shadow. */
export function assertInitialJointPhysicalStorage(db:Pick<DatabaseSync,'prepare'>){
  const rows=(schema:string)=>db.prepare(`SELECT type,name,tbl_name,sql FROM ${schema}.sqlite_master WHERE lower(name) GLOB 'pa_initial_joint_v1_*' OR lower(tbl_name) GLOB 'pa_initial_joint_v1_*'`).all();
  assert(rows('temp').length===0,'temporary namespace shadow');const catalog=rows('main');if(!catalog.length)return false;
  const expected=new Set<string>();
  for(const [name,sql]of Object.entries(initialJointSchemas)){
    const table=catalog.filter(r=>r.name===name);assert(table.length===1&&table[0].type==='table'&&table[0].tbl_name===name&&table[0].sql===sql,'partial or malformed schema');expected.add(name);
    const columns=name===initialJointRightTable?['source_id','launch_source_id','enrollment_source_id','source_json','source_hash','snapshot_json','snapshot_hash']
      :['source_id','launch_source_id','enrollment_source_id','right_source_id','source_json','source_hash','snapshot_json','snapshot_hash'];
    const actual=db.prepare('PRAGMA main.table_xinfo('+name+')').all();
    assert(actual.length===columns.length&&actual.every((c,i)=>c.cid===i&&c.name===columns[i]&&c.type==='TEXT'&&c.notnull===(i===0?0:1)
      &&c.pk===(i===0?1:0)&&c.hidden===0&&c.dflt_value===null),'columns differ');
    const keys=name===initialJointRightTable?[['source_id'],['launch_source_id']]:[['source_id'],['launch_source_id'],['right_source_id']];
    const indexes=db.prepare('PRAGMA main.index_list('+name+')').all();assert(indexes.length===keys.length,'index count differs');
    keys.forEach((k,i)=>{
      const index='sqlite_autoindex_'+name+'_'+(i+1),r=catalog.find(v=>v.name===index),ix=indexes.find(v=>v.name===index);
      assert(r?.type==='index'&&r.tbl_name===name&&r.sql===null&&ix?.unique===1&&ix.partial===0&&ix.origin===(i===0?'pk':'u'),'index identity differs');
      const info=db.prepare('PRAGMA main.index_xinfo('+index+')').all();
      assert(json(info.filter(c=>c.key===1).map(c=>c.name))===json(k)&&info.length===2&&info.every(c=>c.desc===0&&c.coll==='BINARY')&&info.at(-1)?.cid===-1,'index columns differ');expected.add(index);
    });
  }
  assert(catalog.length===expected.size&&catalog.every(r=>expected.has(String(r.name))),'unexpected namespace object');return true;
}
/** Pending executed work must not be erased by the old parked-actor cut or
 * initial zero-TOTAL path. Historical reads are intentionally still allowed. */
export function assertNoUnsettledInitialJointExecution(db:Pick<DatabaseSync,'prepare'>,scope:{careerId:string;gameId:string;playId:number}){
  if(!assertInitialJointPhysicalStorage(db))return;
  for(const row of db.prepare('SELECT * FROM '+initialJointExecutionTable).all()){
    const source=JSON.parse(String(row.source_json)),value=JSON.parse(String(row.snapshot_json));
    assert(row.source_id===source.sourceId&&json(source)===json(value.source)&&hash(source)===row.source_hash&&hash(value)===row.snapshot_hash
      &&row.right_source_id===source.rightReference?.sourceId&&row.launch_source_id===value.launchReference?.sourceId
      &&row.enrollment_source_id===value.lineage?.enrollmentReference?.sourceId,'execution claim or mirror differs');
    const right=db.prepare('SELECT * FROM '+initialJointRightTable+' WHERE source_id=?').get(String(row.right_source_id));assert(right,'execution right missing');
    const r=JSON.parse(String(right.snapshot_json)),s=JSON.parse(String(right.source_json));
    assert(hash(s)===right.source_hash&&hash(r)===right.snapshot_hash&&json(s)===json(r.source)&&s.sourceId===right.source_id
      &&json(value.lineage)===json(r.lineage)&&json(value.launchReference)===json(r.launchReference)
      &&right.enrollment_source_id===row.enrollment_source_id&&right.launch_source_id===row.launch_source_id
      &&json(source.rightReference)===json({owner:initialJointRightTable,sourceId:right.source_id,sourceHash:right.source_hash,snapshotHash:right.snapshot_hash}),
      'execution/right scope or reference differs');
    const l=r.lineage;
    assert(!(l.careerId===scope.careerId&&l.gameId===scope.gameId&&l.playId===scope.playId),
      'executed joint physical work requires its successor and nonempty workload settlement');
  }
}
