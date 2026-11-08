import { expect, it } from 'vitest';
import * as practice from './SqliteStandalonePracticeStore';
it('V224-I00 exposes the separate Native motor-evidence reader',()=>{
 expect((practice as Record<string,unknown>).readNativeStandaloneBattingMotorEvidenceV224).toBeTypeOf('function');
});
import { createRequire } from 'node:module';
import { rawNativeSpinNeutralSqlDigestV193 } from '../../../tools/verification/NativeSpinNeutralV193-sql';
import { afterEach } from 'vitest';
import { contactFixture } from './StandalonePracticeContact.test-support';
import { planCourseAwareSwingKinematicsV1 } from '../../core/sim/pitching/CourseAwareSwingKinematicsV1';
import type { StandaloneBattingContactCommand } from './StandalonePracticeContact';
import type { AcceptedStandalonePractice } from './StandalonePracticeMotion';
import { openSqliteStandalonePracticeStore, type AcceptedStandalonePracticeAssessment } from './SqliteStandalonePracticeStore';
const cleanup:(()=>void)[]=[];afterEach(()=>{while(cleanup.length)cleanup.pop()!()});
const {constants}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

it('V224-N01 reads detached original plan and release on an unchanged Native snapshot',async()=>{
 const f=await contactFixture(cleanup),release=f.pitch.plannedDelivery.release,profile=f.batting.repertoire.values.profiles[0].profile;
 const plan={handedness:'R' as const,batterCenterOfMass:{x:release.position.x-.8,y:.95,z:0},
  targetBallCenterAtPlate:{x:release.position.x,y:release.position.y,z:0},strikeZone:{centerX:release.position.x,halfWidth:.22,lowerY:.5,upperY:1.8},
  contactTick:release.releaseAtUs+600000};
 const depth=planCourseAwareSwingKinematicsV1({...plan,ticksPerSecond:1_000_000,profile}).preferredContactDepthM;
 plan.contactTick=release.releaseAtUs+Math.round((release.position.z-depth)/-release.velocity.z*1_000_000);
 const trajectory=planCourseAwareSwingKinematicsV1({...plan,ticksPerSecond:1_000_000,profile}).trajectory;
 const command:StandaloneBattingContactCommand={kind:'BATTING_CONTACT',pitchAttemptId:f.pitch.attemptId,spinIntentV123:{technique:'BACKSPIN',decidedTick:0},
  calibrationRef:{sourceId:'explicit-actual-flight',sourceVersion:'v1'},issuedTick:0,bodyReadyTick:0,profileId:profile.profileId,profileVersion:profile.version,plan,
  parameters:{ticksPerSecond:1_000_000,integrationStepTicks:2000,gravityY:0,aerodynamics:{ballMassKg:.145,ballRadiusM:.0366,airDensityKgM3:0,windVelocityMps:{x:0,y:0,z:0},dragCoefficient:0}}};
 const source:AcceptedStandalonePractice={sourceId:'contact-drill-v224',sourceVersion:'test-v1',opportunityId:'contact-opportunity-v224',careerId:'career-a',playerId:'p1',personLinkSourceId:'intake-p1',atDay:13,
  startTick:trajectory.startTick,endTick:trajectory.endTick,ticksPerSecond:1_000_000,workloadRevision:0,episodeId:'episode',episodeRevision:2,domain:'TECHNICAL',
  bodySourceId:f.batting.bodyMaterialization.source.sourceId,modelSourceId:f.batting.source.sourceId,command};
 const assessments=new Map<string,AcceptedStandalonePracticeAssessment>();
 const owner=openSqliteStandalonePracticeStore(f.path,f.sources.episodes,{readAcceptedPractice:id=>id===source.sourceId?source:null,readAcceptedAssessment:id=>assessments.get(id)??null});cleanup.push(owner.close);
 owner.begin(source.sourceId);const pitch=f.owner.advance(f.pitch.attemptId,0,f.pitch.plannedDelivery.timeline.followThroughEndUs);f.assess(pitch);f.owner.settle(pitch.attemptId);
 const completed=owner.advance(source.sourceId,0,source.endTick);expect(completed.complete).toBe(true);
 const assessment:AcceptedStandalonePracticeAssessment={sourceId:'assessment-v224',sourceVersion:'test-v1',opportunitySourceId:source.sourceId,physicalProofHash:completed.physicalProofHash!,effortUnits:2,relevant:true,
  factors:{trainingStimulus:1,coachingFit:1,challengeFit:1,healthAvailability:.8,motivation:1,opportunity:1,novelty:1},
  provenance:{assessmentSourceId:'independent-contact-assessment',assessmentVersion:'v1',calibrationSourceId:'explicit-effort',calibrationVersion:'v1'}};
 assessments.set(assessment.sourceId,assessment);const assessed=owner.assess(assessment.sourceId);f.learningEvents.set(assessed.event!.sourceEventId,assessed.event!);
 const settled=owner.settle(source.sourceId);if(settled.kind!=='complete')throw Error('fixture not settled');const id=settled.activity.sourceEventId;
 expect(()=>practice.readNativeStandaloneBattingMotorEvidenceV224(f.db,id)).toThrow(/Native snapshot/);
 f.db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v224');f.db.setAuthorizer(code=>code===constants.SQLITE_ATTACH?constants.SQLITE_DENY:constants.SQLITE_OK);
 try{
  const stamp=()=>({changes:f.db.prepare('SELECT total_changes() n').get()!.n,main:f.db.prepare('PRAGMA main.schema_version').get()!.schema_version,temp:f.db.prepare('PRAGMA temp.schema_version').get()!.schema_version});
  const before=stamp(),digest=rawNativeSpinNeutralSqlDigestV193(f.db),old=practice.readNativeStandaloneBattingContactV123(f.db,id),result=practice.readNativeStandaloneBattingMotorEvidenceV224(f.db,id);
  expect(result.source).toEqual(source);expect(result.source.command).toEqual(command);expect(result.plannedDelivery).toEqual(f.pitch.plannedDelivery);
  expect(result.model).toEqual(f.batting);expect(result.contact).toEqual(old.contact);expect(result.ball).toEqual(old.ball);expect(result.acceptedEvidenceHash).toBe(old.proofHash);
  expect(result.physicalProofHash).toBe(completed.physicalProofHash);expect(result.consumedRelease.attemptId).toBe(f.pitch.attemptId);
  expect(result.implementationFamily).toBe('COURSE_AWARE_V1');expect(result.futurePitchTransferProven).toBe(false);expect(result.relativeRuleProven).toBe(false);
  expect(Object.isFrozen(result)).toBe(true);expect(Object.isFrozen(result.source.command.plan)).toBe(true);expect(result.source).not.toBe(source);
  expect(practice.readNativeStandaloneBattingContactV123(f.db,id)).toEqual(old);expect(()=>practice.readNativeStandaloneBattingMotorEvidenceV224(f.db,'missing')).toThrow();
  expect(rawNativeSpinNeutralSqlDigestV193(f.db)).toEqual(digest);expect(stamp()).toEqual(before);expect(f.db.isTransaction).toBe(true);expect(f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
  expect(()=>f.db.prepare("ATTACH DATABASE ':memory:' AS forbidden")).toThrow(/not authorized/);f.db.exec('ROLLBACK TO caller_v224; RELEASE caller_v224');expect(f.db.isTransaction).toBe(true);
 }finally{f.db.setAuthorizer(null);if(f.db.isTransaction)f.db.exec('ROLLBACK');f.db.exec('PRAGMA query_only=0')}
 for(const sql of [
  "UPDATE standalone_practice_commands SET source_json=json_set(source_json,'$.command.kind','DRY_SWING') WHERE source_id='contact-drill-v224'",
  "UPDATE standalone_practice_commands SET source_json=json_set(source_json,'$.command.profileId','foreign') WHERE source_id='contact-drill-v224'",
  "UPDATE standalone_practice_commands SET snapshot_hash='bad-proof' WHERE source_id='contact-drill-v224'"]){
  f.db.exec('SAVEPOINT tamper_v224');try{f.db.exec(sql);expect(()=>practice.readNativeStandaloneBattingMotorEvidenceV224(f.db,id)).toThrow()}
  finally{f.db.exec('ROLLBACK TO tamper_v224; RELEASE tamper_v224')}
 }
 f.db.exec('BEGIN');try{expect(practice.readNativeStandaloneBattingContactV123(f.db,id).proofHash).toBe(practice.readNativeStandaloneBattingMotorEvidenceV224(f.db,id).acceptedEvidenceHash)}finally{f.db.exec('ROLLBACK')}

},120000);
