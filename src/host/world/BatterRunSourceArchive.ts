import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { bodyCompositionSourceClaim as claim, bodyCompositionTableInstalled as installed, assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { sqliteJsonMetadataNodes, type SqliteJsonMetadataPath } from './SqliteOwnershipMetadata';
import { samePaText as id } from './SamePlateAppearanceWorkPrefix';

type Table = 'world_player_batter_run_transition_models' | 'world_batter_swing_exit_states' | 'world_batter_run_plans';
type Source = Readonly<{ sourceId: string }>;
type Row = { source_id: string; ownership_key: string; source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
export type BatterRunArchiveOwner<S extends Source,V extends Readonly<{source:S}>> = Readonly<{
  input(raw:unknown,sourceId?:string):S; derive(source:S):V; key(source:S):string; assertCurrent?(value:V,inserted:boolean):void;
  /** Exact scoped claims in Source and snapshot.Source, supplied only by the concrete owner. */
  scope(source:S):Readonly<{sql:string;values:readonly (string|number)[]}>;
}>;
const schema=(table:Table)=>`CREATE TABLE ${table}(source_id TEXT PRIMARY KEY,ownership_key TEXT NOT NULL UNIQUE,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL)`;
export const assertBatterRunArchiveStorage=(db:Pick<DatabaseSync,'prepare'>,table:Table):boolean=>{
  assertBodyCompositionNativeConnection(db);
  if(!installed(db,table))return false;
  if(db.prepare('SELECT sql FROM main.sqlite_master WHERE name=?').get(table)?.sql!==schema(table))throw new Error('batter-run original table schema differs');
  const indexes=db.prepare(`PRAGMA main.index_list(${table})`).all();
  if(indexes.length!==2)throw new Error('batter-run original indexes differ');
  for(const [i,column] of ['source_id','ownership_key'].entries()){
    const name=`sqlite_autoindex_${table}_${i+1}`,index=indexes.find(r=>r.name===name),info=db.prepare(`PRAGMA main.index_xinfo(${name})`).all();
    if(!index||index.unique!==1||index.partial!==0||index.origin!==(i===0?'pk':'u')||info.length!==2||info[0].name!==column
      ||info[0].key!==1||info[1].cid!==-1||info.some(r=>r.coll!=='BINARY'||r.desc!==0))throw new Error('batter-run original index shape differs');
  }
  return true;
};
const assertNoMissingOriginalClaim=(db:Pick<DatabaseSync,'prepare'>,table:Table,sourceId?:string)=>{
  const dependent=table==='world_player_batter_run_transition_models'?{table:'world_batter_swing_exit_states',path:['transitionModelReference','sourceId']}
    :table==='world_batter_swing_exit_states'?{table:'world_batter_run_plans',path:['exitStateReference','sourceId']}
    :{table:'pa_physical_v1_field_steps',path:['action','planReference','sourceId']};
  const nodes=(document:string,path:string[])=>`EXISTS(SELECT 1 FROM (${sqliteJsonMetadataNodes(document,path)}) claim WHERE claim.type='text'${sourceId===undefined?'':' AND claim.atom=?'})`;
  if(installed(db,dependent.table)&&db.prepare(`SELECT 1 FROM main.${dependent.table} WHERE ${nodes('source_json',dependent.path)} OR ${nodes('snapshot_json',['source',...dependent.path])} LIMIT 1`)
    .get(...(sourceId===undefined?[]:[sourceId,sourceId])))throw new Error('batter-run missing original has a surviving typed dependent claim');
  if(table==='world_batter_run_plans'&&installed(db,'pa_lifecycle_v1_work_prefixes')){
    // A registered plan owns lifecycle work before any physical step consumes it.
    // Preserve duplicate containers and bind owner/id within the same reference.
    const typed=(document:string,path:SqliteJsonMetadataPath)=>`EXISTS(SELECT 1 FROM (${sqliteJsonMetadataNodes(document,path)}) event,
      json_each(CASE WHEN event.type='object' THEN event.value ELSE '{}' END) owner,
      json_each(CASE WHEN event.type='object' THEN event.value ELSE '{}' END) identity
      WHERE owner.key='owner' AND owner.type='text' AND owner.atom='world_batter_run_plans'
        AND identity.key='sourceId' AND identity.type='text'${sourceId===undefined?'':' AND identity.atom=?'})`;
    if(db.prepare(`SELECT 1 FROM main.pa_lifecycle_v1_work_prefixes WHERE
      ${typed('source_json',['eventReferences',{array:'all'}])} OR ${typed('snapshot_json',['source','eventReferences',{array:'all'}])} LIMIT 1`)
      .get(...(sourceId===undefined?[]:[sourceId,sourceId])))throw new Error('batter-run missing original has a surviving typed lifecycle claim');
  }
};
/** Mechanism for these three immutable input owners only. No execution or physical head. */
export const batterRunArchiveFromSqlite = <S extends Source,V extends Readonly<{source:S}>>(db:DatabaseSync,table:Table,own:BatterRunArchiveOwner<S,V>) => {
  const rowsFor = (sourceId:string):Row[] => {
    assertBodyCompositionNativeConnection(db);
    if(!id(sourceId))throw new Error('invalid batter-run Source identity');
    if(!assertBatterRunArchiveStorage(db,table)){assertNoMissingOriginalClaim(db,table,sourceId);return [];}
    return db.prepare(`SELECT * FROM main.${table} WHERE source_id=? OR ${claim('source_json',['sourceId'])}
      OR ${claim('snapshot_json',['source','sourceId'])}`).all(sourceId,sourceId,sourceId) as Row[];
  };
  const assertScope = (s:S,count:number) => {
    const scoped=own.scope(s),key=own.key(s);
    const rows=db.prepare(`SELECT source_id,ownership_key FROM main.${table} WHERE ownership_key=? OR (${scoped.sql})`).all(key,...scoped.values);
    if(rows.length!==count||rows.some(r=>r.source_id!==s.sourceId||r.ownership_key!==key))throw new Error('batter-run original scope is already owned or hidden');
  };
  const read = (sourceId:string):V|null => {
    const rows=rowsFor(sourceId);if(!rows.length){assertNoMissingOriginalClaim(db,table,sourceId);return null;}
    if(rows.length!==1||rows[0].source_id!==sourceId)throw new Error('batter-run Source ownership identity differs');
    const row=rows[0],source=own.input(JSON.parse(row.source_json),sourceId);
    if(row.source_json!==json(source)||row.source_hash!==hash(source)||row.ownership_key!==own.key(source))throw new Error('batter-run Source archive differs');
    const value=own.derive(source);
    if(row.snapshot_json!==json(value)||row.snapshot_hash!==hash(value))throw new Error('batter-run snapshot or original dependency differs');
    assertScope(source,1);return value;
  };
  return {read:(sourceId:string)=>withSamePaLifecycleReadPhase(db,()=>read(sourceId)),assertScope};
};
export const openBatterRunSourceArchive = <S extends Source,V extends Readonly<{source:S}>>(path:string,table:Table,
  make:(db:DatabaseSync)=>BatterRunArchiveOwner<S,V>,accepted?:((id:string)=>S|null)) => {
  if(!id(path)||accepted!==undefined&&typeof accepted!=='function')throw new Error('invalid batter-run accepted Source authority');
  const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new DatabaseSync(path);
  try {
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
    if(!assertBatterRunArchiveStorage(db,table)){assertNoMissingOriginalClaim(db,table);db.exec(schema(table));}
    assertBatterRunArchiveStorage(db,table);
    const tx=battingInvocationTransaction(db,()=>assertBatterRunArchiveStorage(db,table)),own=make(db),evidence=batterRunArchiveFromSqlite(db,table,own);
    const read=(sourceId:string)=>tx.run(false,proof=>proof(()=>evidence.read(sourceId)),()=>{});
    return Object.freeze({
      read,
      accept(sourceId:string):V {
        const prior=read(sourceId),raw=accepted?.(sourceId)??null,source=raw===null?null:own.input(raw,sourceId);
        if(prior){
          if(source&&json(source)!==json(prior.source))throw new Error('batter-run accepted Source is frozen differently');
          const current=read(sourceId);if(!current||json(current)!==json(prior))throw new Error('batter-run retry dependency changed');return current;
        }
        if(!source)throw new Error('accepted batter-run Source missing');
        return tx.run(true,(proof,step)=>{
          const value=proof(()=>{
            if(evidence.read(sourceId))throw new Error('batter-run Source appeared during write');
            evidence.assertScope(source,0);const value=own.derive(source);own.assertCurrent?.(value,false);return value;
          });
          step(()=>{const result=db.prepare(`INSERT INTO main.${table}(source_id,ownership_key,source_json,source_hash,snapshot_json,snapshot_hash) VALUES (?,?,?,?,?,?)`)
            .run(sourceId,own.key(source),json(source),hash(source),json(value),hash(value));
            if(Number(result.changes)!==1)throw new Error('batter-run original insertion extent differs');},1);
          return proof(()=>{const saved=evidence.read(sourceId);if(!saved||json(saved)!==json(value))throw new Error('batter-run dependency changed during write');own.assertCurrent?.(saved,true);return saved;});
        },value=>{const saved=evidence.read(sourceId);if(!saved||json(saved)!==json(value))throw new Error('batter-run committed original differs');own.assertCurrent?.(saved,true);});
      },
      close(){tx.close();},
    });
  }catch(error){db.close();throw error;}
};
