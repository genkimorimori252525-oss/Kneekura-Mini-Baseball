import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { inspectNativeMotorEvidenceV224 } from './motor-evidence-readonly-gate-v224';
import { openSqliteSpinMotionBindingV225, spinMotionBindingReferenceV225 } from '../../src/host/world/SqliteSpinMotionBindingV225';
import type { SpinMotionBindingSourceV225 } from '../../src/host/world/SpinMotionBindingV225';
import { samePaExecutionReference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import type { SpinMotionGateInputV223 } from './native-spin-motion-binding-gate-v223';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';
type Original=ReturnType<typeof inspectNativeMotorEvidenceV224>;
/** Data comes only from the normal V224 qualification and evidence DTOs. */
export function sourceDescriptionsV225(original:Original):readonly SpinMotionBindingSourceV225[] {
 const {qualifications,actor}=original.retained;assert.deepStrictEqual(qualifications.map(q=>q.source.technique),['BACKSPIN','TOPSPIN']);
 return qualifications.map(q=>{
  assert.equal(q.contacts.length,3);assert.equal(q.source.careerId,actor.binding.careerId);assert.equal(q.source.playerId,actor.binding.playerId);
  const refs=q.contacts.map(c=>{const matches=original.evidence.filter(e=>e.sourceEventId===c.eventId);assert.equal(matches.length,1);const e=matches[0];
   assert.equal(e.acceptedEvidenceHash,c.proofHash);assert.deepStrictEqual({sourceId:e.source.sourceId,sourceVersion:e.source.sourceVersion},c.sourceRef);
   return {sourceEventId:e.sourceEventId,sourceRef:c.sourceRef,acceptedEvidenceHash:e.acceptedEvidenceHash,physicalProofHash:e.physicalProofHash}});
  const pin=samePaExecutionReference('world_spin_mastery_v123',q);
  return {version:'spin_motion_binding_source_v225',sourceId:'spin-motion-binding-v225:'+q.source.technique.toLowerCase(),sourceVersion:'v1',
   careerId:q.source.careerId,playerId:q.source.playerId,personLinkSourceId:q.source.personLinkSourceId,acceptedAtDay:q.source.acceptedAtDay,
   technique:q.source.technique,masteryReference:pin,evidenceReferences:refs,ruleVersion:'ORIGINAL_DRILL_RELEASE_NEUTRAL_PLATE_V1'};
 });
}
/** Own only a freshly copied DB; caller checks all parent and copy pins. */
export function acceptOriginalSpinBindingsV225(path:string,pins:SpinMotionGateInputV223,emit:(stage:string,value:unknown)=>void) {
 const {DatabaseSync:Native,constants}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
 let db:DatabaseSync|null=new Native(path,{readOnly:true}),sources:readonly SpinMotionBindingSourceV225[];
 try{db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v225');db.setAuthorizer(code=>code===constants.SQLITE_ATTACH||code===constants.SQLITE_DETACH?constants.SQLITE_DENY:constants.SQLITE_OK);
  const stamps=()=>({transaction:db!.isTransaction,queryOnly:db!.prepare('PRAGMA query_only').get()!.query_only,changes:db!.prepare('SELECT total_changes() n').get()!.n,
   mainSchema:db!.prepare('PRAGMA main.schema_version').get()!.schema_version,tempSchema:db!.prepare('PRAGMA temp.schema_version').get()!.schema_version});
  const before=stamps();assert.equal(before.queryOnly,1);assert.throws(()=>db!.prepare("ATTACH DATABASE ':memory:' AS denied_v225"),/not authorized/);
  const original=inspectNativeMotorEvidenceV224(db,pins);sources=sourceDescriptionsV225(original);assert.deepStrictEqual(stamps(),before);
  assert.throws(()=>db!.prepare("ATTACH DATABASE ':memory:' AS denied_v225"),/not authorized/);db.exec('ROLLBACK TO caller_v225; RELEASE caller_v225');assert(db.isTransaction);
  emit('normal-originals-authenticated',{qualificationCount:original.retained.qualifications.length,evidenceCount:original.evidence.length,sourceIds:sources.map(s=>s.sourceId),callerPreserved:true});
  db.exec('ROLLBACK');db.setAuthorizer(null);db.close();db=null;
 }finally{if(db){if(db.isTransaction)db.exec('ROLLBACK');db.setAuthorizer(null);db.close()}}
 const accepted=new Map(sources.map(s=>[s.sourceId,s]));const owner=openSqliteSpinMotionBindingV225(path,{readAcceptedBinding:id=>accepted.get(id)??null});
 const registered=[];try{for(const source of sources){const value=owner.accept(source.sourceId),ref=spinMotionBindingReferenceV225(value);
  assert.deepStrictEqual(Object.keys(ref).sort(),['owner','snapshotHash','sourceHash','sourceId']);assert.equal(value.scope,'ORIGINAL_PRACTICE_DESCRIPTION_ONLY');assert.equal(value.futureTransferProven,false);
  assert.deepStrictEqual(owner.read(source.sourceId),value);registered.push({source,value,ref});emit('original-binding-accepted',{technique:source.technique,ref});}}
 finally{owner.close()}
 const offline=openSqliteSpinMotionBindingV225(path);try{for(const item of registered)assert.deepStrictEqual(offline.read(item.source.sourceId),item.value)}finally{offline.close()}
 emit('providerless-reopen-complete',{count:registered.length});return {registered,summary:{status:'ORIGINAL_PRACTICE_DESCRIPTIONS_REGISTERED' as const,
  bindingCount:registered.length,techniques:registered.map(x=>x.source.technique),originalPracticeContactsRecreated:0,newContact:0,newMasteryWrites:0,
  providerlessReread:true,fullrefFourFields:true,futureTransferProven:false as const,performancePass:false as const}};
}
