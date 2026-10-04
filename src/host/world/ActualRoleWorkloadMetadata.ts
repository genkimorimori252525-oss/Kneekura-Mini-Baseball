import type { DatabaseSync } from 'node:sqlite';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
type Db = Pick<DatabaseSync,'prepare'>;
/** Identity-only discovery keeps irrelevant historical domain payload opaque. */
export const actualRoleWorkloadIdentityRow = (db: Db, table: 'actual_role_workload_assessments'|'actual_role_workload_settlements', identity: string) => {
  const assessment = table === 'actual_role_workload_assessments', key = assessment ? 'source_id' : 'closure_source_id';
  const column = assessment ? 'snapshot_json' : 'plan_json', path = assessment ? ['source','sourceId'] : ['closureSourceId'];
  const rows = db.prepare(`SELECT * FROM ${table} WHERE ${key}=$id OR ${claim(column,path,'$id')}
    ${assessment ? `OR ${claim('source_json',['sourceId'],'$id')}` : ''}`).all({id:identity});
  if(rows.length>1 || rows.length===1 && rows[0][key]!==identity) throw new Error('actual role workload identity ownership differs');
  const row=rows[0]; if(!row) return null;
  for(const [document,metadataPath] of [[String(row[column]),path],...(assessment?[[String(row.source_json),['sourceId']]]:[])] as [string,string[]][]) {
    const m=db.prepare(`SELECT count(*) AS n,sum(m.type='text' AND m.atom=$id) AS matched FROM (${nodes('$document',metadataPath)}) m`).get({document,id:identity});
    if(m?.n!==1 || m.matched!==1) throw new Error('actual role workload identity mirror differs');
  }
  return row;
};
export const actualRoleWorkloadScopeRows=(db:Db,table:'actual_role_workload_assessments'|'actual_role_workload_settlements',scope:Readonly<{
  closureSourceId:string;careerId:string;gameId:string;playId:number;physicalEndSourceId:string
}>)=>{
  const assessment=table==='actual_role_workload_assessments', document=assessment?'r.snapshot_json':'r.plan_json';
  const root=(key:string)=>claim(document,[key],`$${key}`);
  const mirrored=(column:string,key:'careerId'|'gameId')=>`(r.${column}=$${key} OR ${root(key)}${assessment?` OR ${claim(document,['actor','binding',key],`$${key}`)}`:''})`;
  const numeric=`EXISTS(SELECT 1 FROM (${nodes(document,['playId'])}) m WHERE m.type IN ('integer','real') AND m.atom=$playId)`;
  const closureClaim=assessment?`${claim('r.source_json',['closureSourceId'],'$closureSourceId')} OR ${claim(document,['source','closureSourceId'],'$closureSourceId')}`:root('closureSourceId');
  const endClaim=assessment?`${claim('r.source_json',['physicalEndReference','sourceId'],'$physicalEndSourceId')} OR ${claim(document,['source','physicalEndReference','sourceId'],'$physicalEndSourceId')}`:claim(document,['physicalEndReference','sourceId'],'$physicalEndSourceId');
  return db.prepare(`SELECT r.* FROM ${table} r WHERE r.closure_source_id=$closureSourceId OR ${closureClaim} OR ${endClaim}
    OR (${mirrored('career_id','careerId')} AND ${mirrored('game_id','gameId')} AND (r.play_id=$playId OR ${numeric}))`).all(scope);
};
