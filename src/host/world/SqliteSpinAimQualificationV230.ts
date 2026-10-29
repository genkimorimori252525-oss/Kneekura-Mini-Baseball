import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { bodyCompositionTableInstalled, withBodyCompositionTransaction } from './BodyMaterializationSqliteOwnership';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { samePaText, samePaFields, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { readNativeSpinTrialCohortInventoryV228 } from './NativeSpinTrialCohortInventoryV228';
import { evaluateSpinAimQualificationV228, hashSpinAimDomainValueV228, validateSpinAimQualificationSourceV228, type SpinAimQualificationSourceV228 } from './SpinAimQualificationV228';

export type SpinAimQualificationAuthorityV230=Readonly<{readAcceptedQualification(sourceId:string):SpinAimQualificationSourceV228|null}>;
type Evaluation=ReturnType<typeof evaluateSpinAimQualificationV228>;
type Snapshot=Readonly<{version:'spin_aim_qualification_snapshot_v230';source:SpinAimQualificationSourceV228;groupHash:string;closedInventory:Readonly<{firstEligibleWorldRevision:number|null;closedWorldRevision:number;closedWorldEventHash:string;closedWorldPrefixHash:string;scopeComplete:boolean;members:ReturnType<typeof readNativeSpinTrialCohortInventoryV228>['members']}>;evaluation:Evaluation}>;
export type DurableSpinAimQualificationV230=Readonly<{snapshot:Snapshot|null;currentEvaluation:Evaluation;applicable:boolean;snapshotReauthenticated:boolean}>;
type Row={source_id:string;group_hash:string;source_json:string;source_hash:string;snapshot_json:string;snapshot_hash:string};
// JSON's -0 token round-trips through JSON.parse but JSON.stringify emits 0.
// Keep the sign in the immutable Source and snapshot, including group inputs.
const json=(input:unknown):string=>{
 const encode=(v:unknown):string=>{if(v===null||typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);
  if(typeof v==='number')return Object.is(v,-0)?'-0':JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(encode).join(',')+']';
  return '{'+Object.keys(v as Record<string,unknown>).sort().map(k=>JSON.stringify(k)+':'+encode((v as Record<string,unknown>)[k])).join(',')+'}';};
 return encode(cloneInert(input));
};
const hash=(v:unknown)=>createHash('sha256').update(json(v)).digest('hex');
const table='world_spin_aim_qualifications_v230';
const ddl='CREATE TABLE world_spin_aim_qualifications_v230(source_id TEXT PRIMARY KEY,group_hash TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL)';
const schema=(db:DatabaseSync)=>{if(!bodyCompositionTableInstalled(db,table))return false;const rows=db.prepare("SELECT sql FROM main.sqlite_master WHERE type='table' AND name=?").all(table);if(rows.length!==1||rows[0].sql!==ddl)throw Error('spin aim qualification v230: schema differs');return true};
const groupHash=(s:SpinAimQualificationSourceV228)=>hashSpinAimDomainValueV228({subject:s.subject,masteryReference:s.masteryReference,bindingReference:s.bindingReference,domain:s.domain});
const derive=(db:DatabaseSync,s:SpinAimQualificationSourceV228,requireClosedNow:boolean):Snapshot=>{
 const inventory=readNativeSpinTrialCohortInventoryV228(db,s);
 if(requireClosedNow&&inventory.currentWorldRevision!==s.cohort.end.worldRevision)throw Error('spin aim qualification v230: closure is not current');
 const {currentWorldRevision:_current,...closedInventory}=inventory;
 return freeze({version:'spin_aim_qualification_snapshot_v230' as const,source:s,groupHash:groupHash(s),closedInventory,evaluation:evaluateSpinAimQualificationV228(s,inventory)});
};
const rowsFor=(db:DatabaseSync,id:string)=>db.prepare(`SELECT * FROM main.world_spin_aim_qualifications_v230 WHERE source_id=$id OR ${claim('source_json',['sourceId'],'$id')} OR ${claim('snapshot_json',['source','sourceId'],'$id')}`).all({id}) as Row[];
const result=(saved:Snapshot,current:Snapshot):DurableSpinAimQualificationV230=>{
 if(isDeepStrictEqual(saved,current))return freeze({snapshot:saved,currentEvaluation:current.evaluation,applicable:current.evaluation.status==='CRITERION_MET_ONLY',snapshotReauthenticated:true});
 const closureReasons=['INVENTORY_UNAVAILABLE','START_BOUNDARY_DIFFERS','MEMBER_SET_DIFFERS','UNRESOLVED','UNCLASSIFIED','DUPLICATE_OWNER_REFERENCE','DUPLICATE_PHYSICAL_PITCH','PITCH_IDENTITY_CONFLICT'];
 if(current.evaluation.status!=='HOLD'||!closureReasons.includes(current.evaluation.reason))throw Error('spin aim qualification v230: original snapshot rederivation differs');
 return freeze({snapshot:null,currentEvaluation:current.evaluation,applicable:false,snapshotReauthenticated:false});
};
const read=(db:DatabaseSync,id:string):DurableSpinAimQualificationV230|null=>{
 if(!samePaText(id))throw Error('spin aim qualification v230: invalid identity');if(!schema(db))return null;
 const rows=rowsFor(db,id);if(rows.length>1||rows.length===1&&rows[0].source_id!==id)throw Error('spin aim qualification v230: identity alias differs');const row=rows[0];if(!row)return null;
 const source=validateSpinAimQualificationSourceV228(JSON.parse(row.source_json));if(source.sourceId!==id||row.source_json!==json(source)||row.source_hash!==hash(source)||row.group_hash!==groupHash(source))throw Error('spin aim qualification v230: original Source differs');
 const saved=JSON.parse(row.snapshot_json) as Snapshot;
 if(row.snapshot_json!==json(saved)||row.snapshot_hash!==hash(saved)||saved.version!=='spin_aim_qualification_snapshot_v230'||!isDeepStrictEqual(saved.source,source)||saved.groupHash!==row.group_hash)throw Error('spin aim qualification v230: original snapshot differs');
 if(!samePaFields(saved.closedInventory,['firstEligibleWorldRevision','closedWorldRevision','closedWorldEventHash','closedWorldPrefixHash','scopeComplete','members']))throw Error('spin aim qualification v230: snapshot fields differ');
 const evaluation=evaluateSpinAimQualificationV228(source,{...saved.closedInventory,currentWorldRevision:source.cohort.end.worldRevision});
 const expected={version:'spin_aim_qualification_snapshot_v230',source,groupHash:groupHash(source),closedInventory:saved.closedInventory,evaluation};
 if(!isDeepStrictEqual(saved,expected))throw Error('spin aim qualification v230: snapshot mirror differs');
 return result(saved,derive(db,source,false));
};
/** This reference identifies the saved evaluation, even when later scope checks HOLD. */
export const spinAimQualificationReferenceV230=(value:DurableSpinAimQualificationV230):SamePaReference<'world_spin_aim_qualifications_v230'>=>{if(!value.snapshotReauthenticated||!value.snapshot)throw Error('spin aim qualification v230: snapshot unavailable');return {owner:table,sourceId:value.snapshot.source.sourceId,sourceHash:hash(value.snapshot.source),snapshotHash:hash(value.snapshot)}};
export function readNativeSpinAimQualificationV230(db:DatabaseSync,id:string):DurableSpinAimQualificationV230|null{
 const {DatabaseSync:Native}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
 if(!(db instanceof Native)||!db.isTransaction||db.prepare('PRAGMA query_only').get()!.query_only!==1)throw Error('spin aim qualification v230: active query_only original snapshot required');
 return withBodyCompositionTransaction(db,false,()=>read(db,id));
}
export function openSqliteSpinAimQualificationV230(path:string,authority?:SpinAimQualificationAuthorityV230){
 if(!samePaText(path)||authority!==undefined&&typeof authority.readAcceptedQualification!=='function')throw Error('spin aim qualification v230: invalid authority');
 const {DatabaseSync:Native}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new Native(path);
 try{db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000');if(!schema(db))db.exec(ddl);schema(db);let closed=false;
  const tx=<T>(write:boolean,body:()=>T)=>{if(closed)throw Error('spin aim qualification v230: owner closed');return withBodyCompositionTransaction(db,write,body)};
  const ro=<T>(body:()=>T):T=>{db.exec('PRAGMA query_only=1');try{return body()}finally{db.exec('PRAGMA query_only=0')}};
  return Object.freeze({accept(id:string){return tx(true,()=>{
   const prior=ro(()=>read(db,id)),raw=authority?.readAcceptedQualification(id)??null;if(prior&&!authority)return prior;
   if(!raw)throw Error('spin aim qualification v230: accepted Source missing');const source=validateSpinAimQualificationSourceV228(raw);if(source.sourceId!==id)throw Error('spin aim qualification v230: Source identity differs');
   if(prior){if(!prior.snapshot)throw Error('spin aim qualification v230: prior snapshot unavailable');if(json(prior.snapshot.source)!==json(source))throw Error('spin aim qualification v230: Source frozen');return prior}
   const value=ro(()=>derive(db,source,true));db.prepare('INSERT INTO main.world_spin_aim_qualifications_v230 VALUES(?,?,?,?,?,?)').run(id,value.groupHash,json(source),hash(source),json(value),hash(value));
   const saved=ro(()=>read(db,id));if(!saved||!saved.snapshotReauthenticated||!isDeepStrictEqual(saved.snapshot,value))throw Error('spin aim qualification v230: original owners changed during INSERT');return saved;
  })},read(id:string){return tx(false,()=>ro(()=>read(db,id)))},close(){if(!closed){closed=true;db.close()}}});
 }catch(error){db.close();throw error}
}
