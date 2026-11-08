import { expect, it } from 'vitest';
import { samePaQualifiedSpinAimInputV233 } from './SamePaQualifiedSpinAimV233';
const hash='a'.repeat(64),ref=(owner:string)=>({owner,sourceId:'fixture',sourceHash:hash,snapshotHash:hash});
const qualified={qualificationReference:ref('world_spin_aim_qualifications_v230'),originalEvidenceEventId:'event',assessmentReference:ref('batting_score_v1_assessments'),transform:'PLATE_XY_TRANSLATION_V1',coordinateSystem:'NATIVE_RBOX_METERS_V1'};
it('V233 validates a qualified source without fabricated trial authority',()=>{expect(samePaQualifiedSpinAimInputV233(qualified)).toEqual(qualified)});
it('V233 rejects unknown transform, extra authority, and invalid qualification fullref',()=>{
 for(const invalid of [{...qualified,transform:'unknown'},{...qualified,authority:'EXPLICIT_UNCALIBRATED_CONTROL'}, {...qualified,qualificationReference:{...qualified.qualificationReference,sourceHash:'bad'}}])expect(()=>samePaQualifiedSpinAimInputV233(invalid)).toThrow();
});
import { afterEach, vi } from 'vitest';
import * as owner from './SqliteSpinAimQualificationV230';
import * as domainOwner from './SpinAimObservedDomainConditionsV231';
import * as joinOwner from './SamePaObservedSpinAimTrialV226';
import { deriveSamePaQualifiedSpinAimV233 } from './SamePaQualifiedSpinAimV233';
afterEach(()=>vi.restoreAllMocks());
it('V233 checks causal rank before reentering qualification and rejects insufficient evidence (stub Owners)',()=>{
 const header=vi.spyOn(owner,'readNativeSpinAimQualificationHeaderV233').mockReturnValue({boundary:'METADATA_ONLY_NOT_AUTHORITY',endWorldRevision:9});
 const qualification=vi.spyOn(owner,'readNativeSpinAimQualificationV230').mockReturnValue(null),basis={actor:{binding:{careerId:'c',playerId:'p',personId:'person'}}} as never;
 expect(()=>deriveSamePaQualifiedSpinAimV233({} as never,qualified as never,basis,8)).toThrow(/membership differs/);expect(qualification).not.toHaveBeenCalled();
 header.mockReturnValue({boundary:'METADATA_ONLY_NOT_AUTHORITY',endWorldRevision:8});expect(()=>deriveSamePaQualifiedSpinAimV233({} as never,qualified as never,basis,8)).toThrow(/not applicable/);expect(qualification).toHaveBeenCalledTimes(1);
});
it('V233 uses current authenticated domain and rejects foreign or mismatched conditions (stub Owners)',()=>{
 const basis={actor:{binding:{careerId:'c',playerId:'p',personId:'person'}}} as never,mastery=ref('world_spin_mastery_v123'),binding=ref('world_spin_motion_bindings_v225'),source={subject:{careerId:'c',playerId:'p',personId:'person',technique:'TOPSPIN'},masteryReference:mastery,bindingReference:binding,domain:{id:'same'}};
 vi.spyOn(owner,'readNativeSpinAimQualificationHeaderV233').mockReturnValue({boundary:'METADATA_ONLY_NOT_AUTHORITY',endWorldRevision:7});
 vi.spyOn(owner,'readNativeSpinAimQualificationV230').mockReturnValue({snapshotReauthenticated:true,applicable:true,snapshot:{source}} as never);
 vi.spyOn(owner,'spinAimQualificationReferenceV230').mockReturnValue(qualified.qualificationReference as never);
 vi.spyOn(joinOwner,'deriveSamePaObservedSpinAimComponentsV233').mockReturnValue({trialContext:{id:'motor'},evidence:{masteryReference:mastery}} as never);
 const current=vi.spyOn(domainOwner,'readObservedSpinAimDomainComponentsV233').mockReturnValue({domain:source.domain,provenance:{}} as never);
 expect(deriveSamePaQualifiedSpinAimV233({} as never,qualified as never,basis,8).qualifiedEvidenceV233.domain).toEqual(source.domain);
 current.mockReturnValue({domain:{id:'different'},provenance:{}} as never);expect(()=>deriveSamePaQualifiedSpinAimV233({} as never,qualified as never,basis,8)).toThrow(/domain or mastery/);
});
import { createRequire } from 'node:module';
it('V233 header rejects borrowed q0, retains caller transaction/query-only and authorizer',()=>{
 const {DatabaseSync,constants}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new DatabaseSync(':memory:');
 try{db.exec('BEGIN; SAVEPOINT caller_v233');expect(()=>owner.readNativeSpinAimQualificationHeaderV233(db,qualified.qualificationReference as never)).toThrow(/query_only/);
  expect(db.isTransaction).toBe(true);expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);db.exec('PRAGMA query_only=1');db.setAuthorizer(code=>code===constants.SQLITE_ATTACH?constants.SQLITE_DENY:constants.SQLITE_OK);
  expect(()=>owner.readNativeSpinAimQualificationHeaderV233(db,qualified.qualificationReference as never)).toThrow(/fullref differs/);expect(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v233")).toThrow(/not authorized/);
  expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);db.exec('ROLLBACK TO caller_v233; RELEASE caller_v233');expect(db.isTransaction).toBe(true);
 }finally{db.setAuthorizer(null);if(db.isTransaction)db.exec('ROLLBACK');db.close()}
});
import { selectQualifiedSpinAimCandidateV233 } from './SamePaQualifiedSpinAimV233';
it('V233 candidate selection explicitly falls back on absent, unavailable, foreign, or different domain (stub values)',()=>{
 const subject={careerId:'c',playerId:'p',personId:'person'},domain={id:'current'},source={subject,domain},q={snapshotReauthenticated:true,applicable:true,snapshot:{source}} as never;
 vi.spyOn(owner,'spinAimQualificationReferenceV230').mockReturnValue(qualified.qualificationReference as never);
 expect(selectQualifiedSpinAimCandidateV233(null,q,subject,domain)).toMatchObject({kind:'NORMAL_FALLBACK',reason:'NO_CANDIDATE'});
 expect(selectQualifiedSpinAimCandidateV233(qualified as never,null,subject,domain)).toMatchObject({reason:'NOT_APPLICABLE'});
 expect(selectQualifiedSpinAimCandidateV233(qualified as never,q,{...subject,personId:'other'},domain)).toMatchObject({reason:'FOREIGN'});
 expect(selectQualifiedSpinAimCandidateV233(qualified as never,q,subject,null)).toMatchObject({reason:'OBSERVATION_UNAVAILABLE'});
 expect(selectQualifiedSpinAimCandidateV233(qualified as never,q,subject,{id:'different'})).toMatchObject({reason:'DOMAIN_MISMATCH'});
 expect(selectQualifiedSpinAimCandidateV233(qualified as never,q,subject,domain)).toMatchObject({kind:'QUALIFIED'});
});
import { samePaPhysicalEpisodeSourceInput } from './SamePlateAppearancePhysicalEpisode';
it('V233 new capability uses strict physical source with no fabricated trial source',()=>{
 const source={sourceId:'qualified-source',sourceVersion:'v1',capability:'same_pa_physical_qualified_spin_aim_v233',viewReference:ref('pa_lifecycle_v1_execution_views'),launchReference:ref('pa_physical_v1_launches'),previousOperationReference:ref('pa_physical_v1_cuts'),inputReference:ref('batting_execution_v1_inputs'),intentReference:ref('batting_execution_v1_intents'),qualifiedAim:qualified};
 expect(samePaPhysicalEpisodeSourceInput(source)).toEqual(source);expect(()=>samePaPhysicalEpisodeSourceInput({...source,trial:qualified})).toThrow();
});
import { battingInvocationTransaction } from './BattingInvocationTransaction';
it('V233 owned proof brackets q1 and rolls back a poisoned post-insert proof',()=>{
 const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new DatabaseSync(':memory:');db.exec('CREATE TABLE owned_fixture(id INTEGER)');
 const tx=battingInvocationTransaction(db,()=>true);
 try{expect(()=>tx.run(true,(proof,step)=>{proof(()=>{expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1)});step(()=>{db.exec('INSERT INTO owned_fixture VALUES(1)')},1);
  return proof(()=>{expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);throw Error('poisoned qualified proof')});},()=>{})).toThrow(/poisoned qualified proof/);
  expect(db.prepare('SELECT count(*) n FROM owned_fixture').get()!.n).toBe(0);expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);expect(db.isTransaction).toBe(false);
 }finally{tx.close()}
});
it('V233 atomic staged commitment and World event roll back together on failed final proof (transaction simulation)',()=>{
 const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new DatabaseSync(':memory:');db.exec('CREATE TABLE commit_fixture(id INTEGER); CREATE TABLE world_event_fixture(id INTEGER)');const tx=battingInvocationTransaction(db,()=>true);
 try{expect(()=>tx.run(true,(proof,step)=>{step(()=>db.exec('INSERT INTO commit_fixture VALUES(1)'),1);proof(()=>expect(db.prepare('SELECT count(*) n FROM commit_fixture').get()!.n).toBe(1));
  step(()=>db.exec('INSERT INTO world_event_fixture VALUES(1)'),1);return proof(()=>{expect(db.prepare('SELECT count(*) n FROM world_event_fixture').get()!.n).toBe(1);throw Error('final qualified proof failed')})},()=>{})).toThrow(/final qualified proof failed/);
  expect(db.prepare('SELECT count(*) n FROM commit_fixture').get()!.n).toBe(0);expect(db.prepare('SELECT count(*) n FROM world_event_fixture').get()!.n).toBe(0);expect(db.isTransaction).toBe(false);
 }finally{tx.close()}
});

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashScopedSpinAimMembersV228 } from './SpinAimQualificationV228';
import * as inventoryOwner from './NativeSpinTrialCohortInventoryV228';
it('V233 header checks complete qualification fullref without reentering census',()=>{
const h='a'.repeat(64),ref=<T extends string>(owner:T,id:string)=>({owner,sourceId:id,sourceHash:h,snapshotHash:h});
const domain={version:'spin_aim_domain_v228',bindingReference:ref('world_spin_motion_bindings_v225','binding'),modelReference:ref('world_player_batting_models','model'),
 profile:{profileId:'course',version:'v1'},coordinateSystem:'NATIVE_RBOX_METERS_V1',transform:'PLATE_XY_TRANSLATION_V1',handedness:'R',plateZ:0,ticksPerSecond:1000000,
 geometry:{centerOfMass:{x:0,y:1,z:0},strikeZone:{centerX:0,halfWidth:.2,lowerY:.5,upperY:1.8}},targetPair:{anchor:{x:0,y:1,z:0},target:{x:0,y:1.02,z:0}},
 equipmentHash:h,forecastParametersHash:h,actualFlightParametersHash:h,observationMethod:'OWNED_IN_FLIGHT_BATTING_CAPTURE_DELIVERY_V1',nominalObservationValuesHash:h,captureEffectiveValuesHash:h,deliveryEffectiveValuesHash:h,predictionParameterValuesHash:h,deliveryLatencyTicks:10000};
const criterion={version:'spin_aim_project_criterion_v228',authority:'PROJECT_DECLARED_NOT_HUMAN_CALIBRATED',minimumIndependentTrials:2,minimumDirectionalSpinRadPerSecond:10,minimumSuccessFraction:.5,miss:'COUNT_FAILURE',unresolved:'HOLD',unclassified:'HOLD'};
const key=(id:string)=>({policy:'ONE_PER_PHYSICAL_PITCH' as const,careerId:'c',playerId:'p',personId:'person',physicalPitchOwner:'pa_physical_v1_launches' as const,physicalPitchSourceId:id});
const member=(id:string,rev:number,outcome:'CONTACT'|'MISS'|'UNRESOLVED')=>({commitmentReference:ref('pa_physical_v1_commitments','c'+id),resolutionReference:outcome==='UNRESOLVED'?null:ref('pa_physical_v1_resolutions','r'+id),worldRevision:rev,
 identity:key(id),physicalPitchReference:ref('pa_physical_v1_launches',id),inputReference:ref('batting_execution_v1_inputs','i'+id),observationProvenance:{captureReference:ref('batting_observation_v1_observations','o'+id),deliveryReference:ref('batting_observation_v1_deliveries','d'+id),predictionReference:ref('batting_prediction_v1_predictions','p'+id),captureCalibrationReference:ref('pa_lifecycle_v1_execution_calibrations','cc'+id),deliveryCalibrationReference:ref('pa_lifecycle_v1_execution_calibrations','dc'+id)},outcome,directionalSpin:outcome==='CONTACT'?20:null});
const a=member('one',5,'CONTACT'),b=member('two',7,'MISS');
const sourceMember=(m:typeof a)=>{const {outcome:_outcome,directionalSpin:_spin,...r}=m;return r};
const source={version:'spin_aim_qualification_source_v228',sourceId:'qual',sourceVersion:'v1',subject:{careerId:'c',playerId:'p',personId:'person',technique:'TOPSPIN'},
 masteryReference:ref('world_spin_mastery_v123','mastery'),bindingReference:domain.bindingReference,domain,criterion,
 cohort:{version:'closed_spin_trial_cohort_v228',start:{kind:'EARLIEST_AUTHENTIC_ELIGIBLE_AFTER_BINDING',worldRevision:5,commitmentReference:a.commitmentReference},
  end:{kind:'WORLD_REVISION_AT_CLOSURE',worldRevision:7,worldEventHash:h,worldPrefixHash:h},members:[sourceMember(a),sourceMember(b)],scopedMemberHash:hashScopedSpinAimMembersV228([sourceMember(a),sourceMember(b)])}};


 const dir=mkdtempSync(join(tmpdir(),'v233-header-')),path=join(dir,'test.sqlite'),{DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
 const inv=vi.spyOn(inventoryOwner,'readNativeSpinTrialCohortInventoryV228').mockReturnValue({firstEligibleWorldRevision:5,closedWorldRevision:7,closedWorldEventHash:h,closedWorldPrefixHash:h,currentWorldRevision:7,members:[a,b],scopeComplete:true});
 const store=owner.openSqliteSpinAimQualificationV230(path,{readAcceptedQualification:()=>source as never});const accepted=store.accept('qual'),reference=owner.spinAimQualificationReferenceV230(accepted);store.close();inv.mockClear();
 const db=new DatabaseSync(path,{readOnly:true});try{db.exec('PRAGMA query_only=1; BEGIN');expect(owner.readNativeSpinAimQualificationHeaderV233(db,reference)).toEqual({boundary:'METADATA_ONLY_NOT_AUTHORITY',endWorldRevision:7});expect(inv).not.toHaveBeenCalled();
  expect(()=>owner.readNativeSpinAimQualificationHeaderV233(db,{...reference,snapshotHash:'b'.repeat(64)})).toThrow(/fullref differs/);db.exec('ROLLBACK');}
 finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();rmSync(dir,{recursive:true,force:true})}
});
