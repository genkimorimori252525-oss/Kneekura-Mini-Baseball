import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { inspectNativeSpinTrialCohortV228 } from './native-spin-trial-cohort-v228';
import { readNativeSpinControlMasteryV123 } from '../../src/host/world/SqliteSpinControlMasteryV123';
import { samePaExecutionReference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { hashScopedSpinAimMembersV228, type SpinAimQualificationSourceV228 } from '../../src/host/world/SpinAimQualificationV228';
import { openSqliteSpinAimQualificationV230, spinAimQualificationReferenceV230 } from '../../src/host/world/SqliteSpinAimQualificationV230';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import type { readNativeSpinTrialMotorEvidenceV227 } from '../../src/host/world/NativeSpinTrialMotorEvidenceV227';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';
type Evidence=ReturnType<typeof readNativeSpinTrialMotorEvidenceV227>;
/** Only a private diagnostic Source: thresholds are explicit project choices,
 * not evidence of transfer, population calibration, or product defaults. */
export function acceptDiagnosticSpinAimV230(path:string,resolutionReference:SamePaReference<'pa_physical_v1_resolutions'>,retained:Evidence,previous:ReturnType<typeof inspectNativeSpinTrialCohortV228>,emit:(stage:string,value:unknown)=>void){
 const {DatabaseSync:Native,constants}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');let db:DatabaseSync|null=new Native(path,{readOnly:true});let source:SpinAimQualificationSourceV228;
 try{db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v230');db.setAuthorizer(code=>code===constants.SQLITE_ATTACH||code===constants.SQLITE_DETACH?constants.SQLITE_DENY:constants.SQLITE_OK);
  const stamps=()=>({transaction:db!.isTransaction,queryOnly:db!.prepare('PRAGMA query_only').get()!.query_only,changes:db!.prepare('SELECT total_changes() n').get()!.n,mainSchema:db!.prepare('PRAGMA main.schema_version').get()!.schema_version,tempSchema:db!.prepare('PRAGMA temp.schema_version').get()!.schema_version});
  const before=stamps();assert.equal(before.queryOnly,1);assert.throws(()=>db!.prepare("ATTACH DATABASE ':memory:' AS denied_v230"),/not authorized/);
  const data=inspectNativeSpinTrialCohortV228(db,resolutionReference,retained);assert.deepStrictEqual(data,previous);
  const mastery=readNativeSpinControlMasteryV123(db,data.evidence.masteryReference.sourceId);assert(mastery);assert.deepStrictEqual(samePaExecutionReference('world_spin_mastery_v123',mastery),data.evidence.masteryReference);
  const c=mastery.calibration;assert.equal(c.technique,data.subject.technique);assert.equal(c.sourceVersion,'synthetic-v127');assert.equal(c.minimumIntentionalContacts,3);assert.equal(c.minimumDirectionalSpinRadPerSecond,0.001);assert.equal(c.minimumSuccessFraction,0.5);
  const inventory=data.inventory;assert.equal(inventory.members.length,1);assert.equal(inventory.firstEligibleWorldRevision,inventory.members[0].worldRevision);assert.equal(inventory.currentWorldRevision,inventory.closedWorldRevision);
  const members=inventory.members.map(({outcome:_outcome,directionalSpin:_directionalSpin,...member})=>member);
  source={version:'spin_aim_qualification_source_v228',sourceId:'spin-aim-v230:diagnostic-top-single-trial',sourceVersion:'diagnostic-project-v230',subject:data.subject,
   masteryReference:data.evidence.masteryReference,bindingReference:data.evidence.bindingReference,domain:data.domain,
   criterion:{version:'spin_aim_project_criterion_v228',authority:'PROJECT_DECLARED_NOT_HUMAN_CALIBRATED',minimumIndependentTrials:3,minimumDirectionalSpinRadPerSecond:0.001,minimumSuccessFraction:0.5,miss:'COUNT_FAILURE',unresolved:'HOLD',unclassified:'HOLD'},
   cohort:{version:'closed_spin_trial_cohort_v228',start:{kind:'EARLIEST_AUTHENTIC_ELIGIBLE_AFTER_BINDING',worldRevision:inventory.firstEligibleWorldRevision!,commitmentReference:members[0].commitmentReference},
    end:{kind:'WORLD_REVISION_AT_CLOSURE',worldRevision:inventory.closedWorldRevision,worldEventHash:inventory.closedWorldEventHash,worldPrefixHash:inventory.closedWorldPrefixHash},members,scopedMemberHash:hashScopedSpinAimMembersV228(members)}};
  const provenance={calibration:c,masteryReference:data.evidence.masteryReference,calibrationReference:mastery.source.calibrationRef,
   decision:'Root explicitly selected diagnostic-project-v230 values; source calibration synthetic-v127 is numeric provenance only',
   semanticDifference:'old minimum counts contacts and success fraction uses contacts; new minimum counts independent pitches and fraction includes misses',
   domainCalibrationProven:false,humanCalibrationProven:false,productDefault:false};
  emit('normal-source-and-diagnostic-provenance',{source,provenance});assert.deepStrictEqual(stamps(),before);assert.throws(()=>db!.prepare("ATTACH DATABASE ':memory:' AS denied_v230"),/not authorized/);
  db.exec('ROLLBACK TO caller_v230; RELEASE caller_v230');assert(db.isTransaction);db.exec('ROLLBACK');db.setAuthorizer(null);db.close();db=null;
 }finally{if(db){if(db.isTransaction)db.exec('ROLLBACK');db.setAuthorizer(null);db.close()}}
 const owner=openSqliteSpinAimQualificationV230(path,{readAcceptedQualification:id=>id===source.sourceId?source:null});let accepted;
 try{accepted=owner.accept(source.sourceId);assert.equal(accepted.snapshot?.evaluation.status,'INELIGIBLE');assert.equal(accepted.snapshot?.evaluation.reason,'INSUFFICIENT_TRIALS');assert.equal(accepted.snapshot?.evaluation.total,1);assert.equal(accepted.applicable,false);assert.equal(accepted.snapshotReauthenticated,true);
  const ref=spinAimQualificationReferenceV230(accepted);assert.deepStrictEqual(Object.keys(ref).sort(),['owner','snapshotHash','sourceHash','sourceId']);assert.deepStrictEqual(owner.read(source.sourceId),accepted);emit('diagnostic-evaluation-accepted',{ref,accepted});
 }finally{owner.close()}
 const offline=openSqliteSpinAimQualificationV230(path);try{assert.deepStrictEqual(offline.read(source.sourceId),accepted)}finally{offline.close()}
 emit('providerless-reopen-complete',{sourceId:source.sourceId});return {source,accepted,summary:{status:'INELIGIBLE' as const,reason:'INSUFFICIENT_TRIALS' as const,trialCount:1,applicable:false,qualificationIssued:false,providerlessReread:true,criterionScope:'DIAGNOSTIC_PROJECT_NOT_HUMAN_CALIBRATED' as const,newPractice:0,newContact:0,newMasteryWrites:0}};
}
