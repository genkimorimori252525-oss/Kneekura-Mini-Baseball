import type { DatabaseSync } from 'node:sqlite';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as nodes,sqliteJsonMetadataProjection as projection,sqliteJsonMetadataMatches as matches } from './SqliteOwnershipMetadata';

/** Discover the original cut through typed raw scope/revision mirrors before
 * the existing owner replays domain payloads. Future payloads remain opaque;
 * an old claim or a duplicate original Source cannot become future by moving
 * only its indexed revision, player or career. This is verification only. */
export const assertHistoricalSamePaWorkloadCut=(db:Pick<DatabaseSync,'prepare'>,careerId:string,playerId:string,revision:number):void=>{
  const main=db.prepare("SELECT name,type FROM main.sqlite_master WHERE lower(name)='world_player_workload_activities'").all();
  if(main.length!==1||main[0].name!=='world_player_workload_activities'||main[0].type!=='table'
    ||db.prepare("SELECT 1 FROM temp.sqlite_master WHERE lower(name)='world_player_workload_activities'").get())throw new Error('historical same-PA workload cut storage differs');
  const docs=['source_json','before_json','after_json'];
  const scope=(field:string,index:string,param:string)=>`(${index}=${param} OR ${docs.map(d=>claim(d,[field],param)).join(' OR ')})`;
  const rawRevision=(doc:string,op:string)=>`EXISTS(SELECT 1 FROM (${nodes(doc,['revision'])}) cut_revision WHERE cut_revision.type IN ('integer','real') AND cut_revision.atom${op}$revision)`;
  const rows=db.prepare(`SELECT source_id,career_id,player_id,before_revision,after_revision,
    ${projection('source_json',['sourceEventId','careerId','playerId'])} AS source_metadata,
    ${projection('before_json',['careerId','playerId','revision'])} AS before_metadata,
    ${projection('after_json',['careerId','playerId','revision'])} AS after_metadata
    FROM main.world_player_workload_activities WHERE ${scope('careerId','career_id','$career')} AND ${scope('playerId','player_id','$player')}
    AND (after_revision<=$revision OR before_revision<$revision OR ${rawRevision('before_json','<')} OR ${rawRevision('after_json','<=')})`)
    .all({career:careerId,player:playerId,revision});
  for(const row of rows){
    const after=row.after_revision,before=row.before_revision,id=row.source_id;
    if(typeof id!=='string'||!id.trim()||typeof after!=='number'||!Number.isSafeInteger(after)||after<1||after>revision
      ||before!==after-1||row.career_id!==careerId||row.player_id!==playerId
      ||!matches(String(row.source_metadata),{sourceEventId:id,careerId,playerId})
      ||!matches(String(row.before_metadata),{careerId,playerId,revision:before as number})
      ||!matches(String(row.after_metadata),{careerId,playerId,revision:after}))throw new Error('historical same-PA workload cut ownership differs');
    const aliases=db.prepare(`SELECT source_id FROM main.world_player_workload_activities WHERE source_id=$id OR ${claim('source_json',['sourceEventId'],'$id')}`).all({id});
    if(aliases.length!==1||aliases[0].source_id!==id)throw new Error('historical same-PA workload Source alias differs');
  }
};
