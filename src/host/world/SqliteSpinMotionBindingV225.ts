import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { bodyCompositionTableInstalled, withBodyCompositionTransaction } from './BodyMaterializationSqliteOwnership';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { samePaText, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { readNativeSpinControlMasteryV123 } from './SqliteSpinControlMasteryV123';
import { readNativeStandaloneBattingMotorEvidenceV224 } from './SqliteStandalonePracticeStore';
import { deriveSpinMotionBindingV225, validateSpinMotionBindingSourceV225, type DurableSpinMotionBindingV225, type SpinMotionBindingSourceV225 } from './SpinMotionBindingV225';

export type SpinMotionBindingAuthorityV225 = Readonly<{readAcceptedBinding(sourceId:string):SpinMotionBindingSourceV225|null}>;
type Row = {source_id:string;mastery_source_id:string;source_json:string;source_hash:string;snapshot_json:string;snapshot_hash:string};
const table='world_spin_motion_bindings_v225';
const ddl=`CREATE TABLE world_spin_motion_bindings_v225(source_id TEXT PRIMARY KEY,mastery_source_id TEXT NOT NULL UNIQUE,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL)`;
const schema=(db:DatabaseSync) => {
 if(!bodyCompositionTableInstalled(db,table))return false;
 const rows=db.prepare('SELECT sql FROM main.sqlite_master WHERE type=\'table\' AND name=?').all(table);
 if(rows.length!==1||rows[0].sql!==ddl)throw Error('spin motion binding v225: original table schema differs');return true;
};
const derive=(db:DatabaseSync,s:SpinMotionBindingSourceV225):DurableSpinMotionBindingV225=>{
 const mastery=readNativeSpinControlMasteryV123(db,s.masteryReference.sourceId);if(!mastery)throw Error('spin motion binding v225: original mastery missing');
 const evidence=s.evidenceReferences.map(ref=>readNativeStandaloneBattingMotorEvidenceV224(db,ref.sourceEventId));
 return deriveSpinMotionBindingV225(s,mastery,evidence);
};
const rowsFor=(db:DatabaseSync,id:string)=>db.prepare(`SELECT * FROM main.world_spin_motion_bindings_v225 WHERE source_id=$id
 OR ${claim('source_json',['sourceId'],'$id')} OR ${claim('snapshot_json',['source','sourceId'],'$id')}`).all({id}) as Row[];
const masteryRows=(db:DatabaseSync,id:string)=>db.prepare(`SELECT source_id FROM main.world_spin_motion_bindings_v225 WHERE mastery_source_id=$id
 OR ${claim('source_json',['masteryReference','sourceId'],'$id')} OR ${claim('snapshot_json',['source','masteryReference','sourceId'],'$id')}`).all({id});
const read=(db:DatabaseSync,id:string):DurableSpinMotionBindingV225|null=>{
 if(!samePaText(id))throw Error('spin motion binding v225: invalid identity');if(!schema(db))return null;
 const rows=rowsFor(db,id);if(rows.length>1||rows.length===1&&rows[0].source_id!==id)throw Error('spin motion binding v225: identity alias differs');
 const row=rows[0];if(!row)return null;const source=validateSpinMotionBindingSourceV225(JSON.parse(row.source_json),id);
 if(row.mastery_source_id!==source.masteryReference.sourceId||row.source_json!==json(source)||row.source_hash!==hash(source))throw Error('spin motion binding v225: original Source differs');
 const peers=masteryRows(db,source.masteryReference.sourceId);if(peers.length!==1||peers[0].source_id!==id)throw Error('spin motion binding v225: mastery alias differs');
 const value=derive(db,source);if(row.snapshot_json!==json(value)||row.snapshot_hash!==hash(value))throw Error('spin motion binding v225: original snapshot differs');return value;
};
/** Fullref is identity+both authenticated hashes, not a transferable motor. */
export const spinMotionBindingReferenceV225=(value:DurableSpinMotionBindingV225):SamePaReference<'world_spin_motion_bindings_v225'>=>({owner:table,
 sourceId:value.source.sourceId,sourceHash:hash(value.source),snapshotHash:hash(value)});
export function readNativeSpinMotionBindingV225(db:DatabaseSync,id:string):DurableSpinMotionBindingV225|null {
 const {DatabaseSync:Native}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
 if(!(db instanceof Native)||!db.isTransaction)throw Error('spin motion binding v225: active original snapshot required');
 return withBodyCompositionTransaction(db,false,()=>read(db,id));
}
export function openSqliteSpinMotionBindingV225(path:string,authority?:SpinMotionBindingAuthorityV225) {
 if(!samePaText(path)||authority!==undefined&&typeof authority.readAcceptedBinding!=='function')throw Error('spin motion binding v225: invalid authority');
 const {DatabaseSync:Native}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new Native(path);
 try{
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000');if(!schema(db))db.exec(ddl);schema(db);
  let closed=false;const transaction=<T>(write:boolean,body:()=>T):T=>{if(closed)throw Error('spin motion binding v225: owner closed');return withBodyCompositionTransaction(db,write,body)};
  return Object.freeze({
   accept(id:string){return transaction(true,()=>{
    const prior=read(db,id),raw=authority?.readAcceptedBinding(id)??null;if(prior&&!authority)return prior;
    if(!raw)throw Error('spin motion binding v225: accepted Source missing');const source=validateSpinMotionBindingSourceV225(raw,id);
    if(prior){if(json(prior.source)!==json(source))throw Error('spin motion binding v225: Source frozen');return prior}
    const collisions=masteryRows(db,source.masteryReference.sourceId);
    if(collisions.length)throw Error('spin motion binding v225: mastery alias differs');const value=derive(db,source);
    db.prepare('INSERT INTO main.world_spin_motion_bindings_v225 VALUES(?,?,?,?,?,?)').run(source.sourceId,source.masteryReference.sourceId,json(source),hash(source),json(value),hash(value));
    const saved=read(db,id);if(json(saved)!==json(value))throw Error('spin motion binding v225: original owners changed during INSERT');return saved!;
   })},
   read(id:string){return transaction(false,()=>read(db,id))},
   close(){if(!closed){closed=true;db.close()}}
  });
 }catch(error){db.close();throw error}
}
