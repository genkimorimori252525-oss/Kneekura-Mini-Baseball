import { expect,it,vi,afterEach } from 'vitest';
import * as pitchOwner from './LivePitchV1';
afterEach(()=>vi.restoreAllMocks());
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';
import { createLiveBaseballMatchWorkerV116,LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } from './LiveBaseballMatchV1';
import { createLiveBattingPracticeV150,resumeLiveBattingPracticeSpinV239 } from './LiveBattingPracticeV150';
import { AUTHORED_LIVE_BATTER_OBSERVATION_V151 } from './LiveBatterObservationV151';
import { resolveLiveBattingSetupV94 } from '../../core/sim/pitching/BattingSetupV94';
const input=()=>{const base=liveMatchFixture(2468),h=createLiveBaseballMatchWorkerV116(base),subjectId=h.inspect().batterPlayerId,p=base.players.find(p=>p.playerId===subjectId)!,clip=base.measuredClips.find(c=>c.side===p.bats)!,physical={...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,clipId:clip.id,swingDecision:{approach:'SWING' as const,threshold:0,aggressionWeight:1}};
 return {configuration:{...base,players:base.players.map(x=>x.playerId===subjectId?{...x,physical}:x),batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151},motor:{version:'live_spin_xy_motor_v239' as const,motorId:'fixture-motor',motorVersion:'v1',subjectId,technique:'TOPSPIN' as const,clip:{id:clip.id,sourceSha256:clip.source.sha256,bats:p.bats},domain:{plateZ:resolveLiveBattingSetupV94({...physical,heightMeters:p.heightMeters,bats:p.bats}).contactPlaneZ,coordinateSystem:'LIVE_WORLD_METERS_V1' as const},delta:{x:0,y:.01},provenance:{kind:'EXPLICIT_DIAGNOSTIC_UNCALIBRATED' as const,sourceId:'fixture',sourceVersion:'v1',humanCalibration:'NOT_MEASURED' as const},trainingOpportunities:[]}};};
it('V239 practice pairs one fixed opportunity without consuming preview and verifies resume',async()=>{
 const {configuration,motor}=input(),p=createLiveBattingPracticeV150(configuration);await p.startSpinMotorPractice({version:'live_spin_practice_plan_v239',scopeId:'scope',pitchOrdinals:[1],motor,criterion:null,normalRequest:{batting:'take'}});
 const before=p.capture(),one=await p.previewSpinMotorPractice(),two=await p.previewSpinMotorPractice();expect(p.capture()).toEqual(before);expect(one).toEqual(two);
 expect(()=>p.issuePitch({batting:'take'})).toThrow(/spin practice/);await p.acceptSpinMotorPractice(one);await expect(p.acceptSpinMotorPractice(two)).rejects.toThrow(/stale|candidate/);
 const saved=p.capture();expect(saved.spinMotorPracticeV239?.entries).toHaveLength(1);const restored=await resumeLiveBattingPracticeSpinV239(configuration,structuredClone(saved));expect(restored.capture()).toEqual(saved);
 const changed=structuredClone(saved) as any;changed.spinMotorPracticeV239.entries[0].trialRecord.pitcherPlayerId='foreign';await expect(resumeLiveBattingPracticeSpinV239(configuration,changed)).rejects.toThrow();
},60000);
it('V239 rejects foreign subject and leaves old non-opt-in capture unchanged',async()=>{
 const {configuration,motor}=input(),p=createLiveBattingPracticeV150(configuration),before=p.capture();await expect(p.startSpinMotorPractice({version:'live_spin_practice_plan_v239',scopeId:'scope',pitchOrdinals:[1],motor:{...motor,subjectId:'foreign'},criterion:null,normalRequest:{batting:'take'}})).rejects.toThrow();expect(p.capture()).toEqual(before);expect(before).not.toHaveProperty('spinMotorPracticeV239');
});
it('V239 freezes the original plan and rejects foreign, copied, stale and duplicate candidates',async()=>{
 const {configuration,motor}=input(),one=createLiveBattingPracticeV150(configuration),two=createLiveBattingPracticeV150(configuration),plan={version:'live_spin_practice_plan_v239' as const,scopeId:'scope',pitchOrdinals:[1],motor,criterion:null,normalRequest:{batting:'take' as const}};
 const old=one.preview({batting:'take'});await Promise.all([one.startSpinMotorPractice(plan),two.startSpinMotorPractice(plan)]);const a=await one.previewSpinMotorPractice(),b=await one.previewSpinMotorPractice(),foreign=await two.previewSpinMotorPractice();
 expect(()=>one.accept(old)).toThrow(/spin practice/);await expect(one.acceptSpinMotorPractice(foreign)).rejects.toThrow(/foreign|stale/);await expect(one.acceptSpinMotorPractice({...a})).rejects.toThrow(/foreign|stale/);
 await one.acceptSpinMotorPractice(a);await expect(one.acceptSpinMotorPractice(a)).rejects.toThrow(/foreign|stale/);await expect(one.acceptSpinMotorPractice(b)).rejects.toThrow(/foreign|stale/);expect(one.capture().spinMotorPracticeV239?.evaluation.status).toBe('HOLD');
},60000);
it('V239 start aborts when normal state changes during an outstanding hash',async()=>{
 const {configuration,motor}=input(),p=createLiveBattingPracticeV150(configuration),pending=p.startSpinMotorPractice({version:'live_spin_practice_plan_v239',scopeId:'scope',pitchOrdinals:[1],motor,criterion:null,normalRequest:{batting:'take'}});
 p.issuePitch({batting:'take'});await expect(pending).rejects.toThrow(/state changed/);expect(p.capture().revision).toBe(1);expect(p.capture()).not.toHaveProperty('spinMotorPracticeV239');
},60000);
it('V239 capture cannot be synchronously restored without validating its sidecar',async()=>{
 const {configuration,motor}=input(),p=createLiveBattingPracticeV150(configuration);await p.startSpinMotorPractice({version:'live_spin_practice_plan_v239',scopeId:'scope',pitchOrdinals:[1],motor,criterion:null,normalRequest:{batting:'take'}});const raw=p.capture();
 expect(()=>createLiveBattingPracticeV150(configuration,raw)).toThrow(/capture/);const restored=await resumeLiveBattingPracticeSpinV239(configuration,structuredClone(raw));expect(restored.capture()).toEqual(raw);
});
it('V239 practice records a planned trial and full paired evidence without qualifying it',async()=>{
 const {configuration,motor}=input(),p=createLiveBattingPracticeV150(configuration);await p.startSpinMotorPractice({version:'live_spin_practice_plan_v239',scopeId:'scope',pitchOrdinals:[1],motor,criterion:null,normalRequest:{batting:'balanced'}});
 const c=await p.previewSpinMotorPractice(),trial=c.entry.trialRecord!.play.diagnostics as {observedSpinComposeV238?:{status:string}};expect(trial.observedSpinComposeV238?.status).toBe('PLANNED');
 await p.acceptSpinMotorPractice(c);const side=p.capture().spinMotorPracticeV239!;expect(side.entries).toHaveLength(1);expect(side.evaluation).toMatchObject({status:'HOLD',reason:'CRITERION_MISSING',earnedQualification:false});
 expect(side.entries[0].normalRecord!.batterPlayerId).toBe(motor.subjectId);expect(side.entries[0].trialRecord!.batterPlayerId).toBe(motor.subjectId);expect((await resumeLiveBattingPracticeSpinV239(configuration,structuredClone(p.capture()))).capture()).toEqual(p.capture());
},60000);
it('V239 describes nonfinite fields in normal Host record without transforming them',()=>{
 const {configuration,motor}=input(),host=createLiveBaseballMatchWorkerV116(configuration),request={version:'live_observed_spin_compose_trial_v238' as const,subjectId:motor.subjectId,technique:motor.technique,clip:motor.clip,domain:motor.domain,delta:motor.delta},record=host.issuePitch({batting:'balanced',pitchType:'auto',location:'auto',managedTeam:0,observedSpinTrialV236:request}),paths:string[]=[];
 const walk=(x:unknown,path:string)=>{if(typeof x==='number'&&!Number.isFinite(x))paths.push(path+':'+String(x));else if(x&&typeof x==='object')for(const [k,v] of Object.entries(x))walk(v,path+'.'+k)};walk(record,'record');console.log('V239 nonfinite paths',JSON.stringify(paths));expect(paths.length).toBeGreaterThan(0);
},60000);
import { isLiveBaseballUnresolvedV239 } from './LiveBaseballMatchV1';
it('V239 recognizes only a Host-generated typed unresolved pitch (stub pitch boundary)',()=>{
 const source=liveMatchFixture(2468),host=createLiveBaseballMatchWorkerV116(source);
 vi.spyOn(pitchOwner,'simulateLivePitchV1').mockReturnValue({frames:[],contact:null,call:null,endedAtTick:1,diagnostics:{unsupportedReason:'catcher_retention_failed_live_ball_requires_successor'}} as never);
 let caught:unknown;try{host.issuePitch({batting:'take',pitchType:'fastball',location:'zone',managedTeam:1})}catch(error){caught=error}
 expect(isLiveBaseballUnresolvedV239(caught)).toBe(true);if(!isLiveBaseballUnresolvedV239(caught))throw Error('typed unresolved missing');expect(caught.unresolvedV239).toMatchObject({phase:'PITCH',code:'PITCH_NO_CALL'});
 expect(isLiveBaseballUnresolvedV239(new Error('live baseball match: pitch ended without physical contact or secured count call'))).toBe(false);
});
it('V239 authenticated HOLD keeps physics still, replays, and retry stays one opportunity (stub pitch boundary)',async()=>{
 const {configuration,motor}=input(),p=createLiveBattingPracticeV150(configuration),criterion={version:'live_spin_practice_criterion_v239' as const,authority:'EXPLICIT_UNCALIBRATED_PROJECT' as const,
  minimumIndependentTrials:1,minimumContactFraction:.5,minimumDirectionalSpin:1,minimumDirectionalImprovement:1,minimumSuccessFraction:.5,miss:'COUNT_FAILURE' as const,noTarget:'COUNT_FAILURE' as const,unresolved:'HOLD' as const};
 await p.startSpinMotorPractice({version:'live_spin_practice_plan_v239',scopeId:'scope',pitchOrdinals:[1],motor,criterion,normalRequest:{batting:'take'}});
 const initial=p.capture();vi.spyOn(pitchOwner,'simulateLivePitchV1').mockReturnValue({frames:[],contact:null,call:null,endedAtTick:1,diagnostics:{unsupportedReason:'fixture-unresolved'}} as never);
 const first=await p.previewSpinMotorPractice();expect(first.entry.kind).toBe('HOLD');expect(p.capture()).toEqual(initial);expect(await p.acceptSpinMotorPractice(first)).toBeNull();
 const held=p.capture();expect(held.revision).toBe(initial.revision);expect(held.continuation).toEqual(initial.continuation);expect(held.spinMotorPracticeV239?.sidecarRevision).toBe(1);expect(held.spinMotorPracticeV239?.evaluation).toMatchObject({status:'HOLD',reason:'UNRESOLVED'});
 expect((await resumeLiveBattingPracticeSpinV239(configuration,structuredClone(held))).capture()).toEqual(held);vi.restoreAllMocks();const retry=await p.previewSpinMotorPractice();expect(retry.entry.trial.opportunity).toEqual(first.entry.trial.opportunity);expect(retry.entry.kind).toBe('COMPLETE');await p.acceptSpinMotorPractice(retry);
 const final=p.capture().spinMotorPracticeV239!;expect(final.entries).toHaveLength(2);expect(final.cohort?.opportunities).toHaveLength(1);if(!('total' in final.evaluation))throw Error('expected closed cohort evaluation');expect(final.evaluation.total).toBe(1);
},60000);
it('V239 fixes future ordinals without inventing fingerprints and holds until all slots are bound',async()=>{
 const {configuration,motor}=input(),p=createLiveBattingPracticeV150(configuration);await p.startSpinMotorPractice({version:'live_spin_practice_plan_v239',scopeId:'scope',pitchOrdinals:[1,2],motor,criterion:null,normalRequest:{batting:'take'}});
 const start=p.capture().spinMotorPracticeV239!;expect(start.slots.map(s=>s.status)).toEqual(['PENDING','PENDING']);expect(start.slots.map(s=>s.opportunity)).toEqual([null,null]);expect(start.evaluation).toMatchObject({status:'HOLD',reason:'COHORT_PENDING'});
 await p.acceptSpinMotorPractice(await p.previewSpinMotorPractice());const one=p.capture().spinMotorPracticeV239!;expect(one.slots.map(s=>s.status)).toEqual(['BOUND','PENDING']);expect(one.slots[0].opportunity).not.toBeNull();expect(one.slots[1].opportunity).toBeNull();expect(one.evaluation).toMatchObject({status:'HOLD',reason:'COHORT_PENDING'});
 await p.acceptSpinMotorPractice(await p.previewSpinMotorPractice());const done=p.capture().spinMotorPracticeV239!;expect(done.cohort?.opportunities).toHaveLength(2);expect(done.evaluation).toMatchObject({status:'HOLD',reason:'CRITERION_MISSING'});
},60000);
it('V239 captures an actual normal Host unresolved pitch from constrained catcher fixture',()=>{
 const base=liveMatchFixture(2468),catcher=base.teams[1].defense.C,config={...base,players:base.players.map(p=>p.playerId===catcher?{...p,physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,gloveSpeedMps:.1,gloveReachMeters:.4,gloveRadiusMeters:.03,retentionCapacityJ:1}}:p)},host=createLiveBaseballMatchWorkerV116(config),before=host.captureContinuationV116();
 let error:unknown;try{host.issuePitch({batting:'take',pitchType:'fastball',location:'high',managedTeam:1})}catch(e){error=e}
 expect(isLiveBaseballUnresolvedV239(error)).toBe(true);if(!isLiveBaseballUnresolvedV239(error))throw Error('typed unresolved missing');expect(error.unresolvedV239).toMatchObject({phase:'PITCH',code:'PITCH_NO_CALL'});expect(host.captureContinuationV116()).toEqual(before);
},60000);
it('V239 real unresolved Host evidence records HOLD without advancing and retry stays the same opportunity',async()=>{
 const setup=input(),catcher=setup.configuration.teams[1].defense.C,configuration={...setup.configuration,players:setup.configuration.players.map(p=>p.playerId===catcher?{...p,physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,gloveSpeedMps:.1,gloveReachMeters:.4,gloveRadiusMeters:.03,retentionCapacityJ:1}}:p)},p=createLiveBattingPracticeV150(configuration);
 await p.startSpinMotorPractice({version:'live_spin_practice_plan_v239',scopeId:'scope',pitchOrdinals:[1],motor:setup.motor,criterion:null,normalRequest:{batting:'take'}});const before=p.capture(),first=await p.previewSpinMotorPractice();expect(first.entry).toMatchObject({kind:'HOLD',hold:{attempt:'NORMAL',unresolved:{phase:'PITCH',code:'PITCH_NO_CALL'}}});
 await p.acceptSpinMotorPractice(first);const held=p.capture();expect(held.continuation).toEqual(before.continuation);expect(held.revision).toBe(before.revision);expect(held.spinMotorPracticeV239?.sidecarRevision).toBe(1);
 expect((await resumeLiveBattingPracticeSpinV239(configuration,structuredClone(held))).capture()).toEqual(held);const again=await p.previewSpinMotorPractice();expect(again.entry.trial.opportunity).toEqual(first.entry.trial.opportunity);await p.acceptSpinMotorPractice(again);expect(p.capture().spinMotorPracticeV239?.cohort?.opportunities).toHaveLength(1);
},60000);
import { AUTHORED_OBSERVED_DIRECTION_MOTOR_V153 } from './LiveDirectionMotorV153';
import { spinNeutralGoldLiveInputsV193 } from './SpinNeutralGoldV193.test-support';
it('V239 explicit practice isolates old spin motion equally in normal and trial without changing roster',async()=>{
 const gold=spinNeutralGoldLiveInputsV193('INDEPENDENT'),pre={...gold.gold,batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151,batterDirectionMotorV153:AUTHORED_OBSERVED_DIRECTION_MOTOR_V153},subjectId=createLiveBaseballMatchWorkerV116(pre).inspect().batterPlayerId,configuration={...pre,players:pre.players.map(p=>p.playerId===subjectId?{...p,physical:{...p.physical!,spinControlV123:{...p.physical!.spinControlV123!,preferredIntent:'TOPSPIN' as const}}}:p)},
 player=configuration.players.find(p=>p.playerId===subjectId)!,clip=configuration.measuredClips.find(c=>c.id===player.physical!.clipId)!,physical=player.physical!,motor={version:'live_spin_xy_motor_v239' as const,motorId:'isolation',motorVersion:'v1',subjectId,technique:'TOPSPIN' as const,clip:{id:clip.id,sourceSha256:clip.source.sha256,bats:player.bats},domain:{plateZ:resolveLiveBattingSetupV94({...physical,heightMeters:player.heightMeters,bats:player.bats}).contactPlaneZ,coordinateSystem:'LIVE_WORLD_METERS_V1' as const},delta:{x:.01,y:0},provenance:{kind:'EXPLICIT_DIAGNOSTIC_UNCALIBRATED' as const,sourceId:'fixture',sourceVersion:'v1',humanCalibration:'NOT_MEASURED' as const},trainingOpportunities:[]},before=structuredClone(configuration),p=createLiveBattingPracticeV150(configuration);
 const legacy=createLiveBaseballMatchWorkerV116(configuration).issuePitch({batting:'balanced',pitchType:'auto',location:'auto',managedTeam:0,battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'isolation-direction',mode:'CENTER'}}),legacyDiagnostics=legacy.play.diagnostics as {spinIntentV123?:{reason:string};directionMotorV153?:{status:string}};expect(legacyDiagnostics.spinIntentV123?.reason).toBe('APPLIED');expect(legacyDiagnostics.directionMotorV153?.status).toBe('NOT_APPLIED');
 await p.startSpinMotorPractice({version:'live_spin_practice_plan_v239',scopeId:'isolation',pitchOrdinals:[1],motor,criterion:null,normalRequest:{batting:'balanced',battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'isolation-direction',mode:'CENTER'}}});const pair=await p.previewSpinMotorPractice();expect(pair.entry.kind).toBe('COMPLETE');
 const a=pair.entry.normalRecord!.play.diagnostics as {spinIntentV123?:unknown;directionMotorV153?:{status:string}},b=pair.entry.trialRecord!.play.diagnostics as {spinIntentV123?:unknown;directionMotorV153?:{status:string};observedSpinComposeV238?:unknown};expect(a.spinIntentV123).toBeUndefined();expect(b.spinIntentV123).toBeUndefined();expect(a.directionMotorV153?.status).toBe('PLANNED');expect(b.directionMotorV153?.status).toBe('PLANNED');expect(b.observedSpinComposeV238).toMatchObject({status:'PLANNED'});
 expect(configuration).toEqual(before);expect(p.capture().configuration).toEqual(before);
},60000);
it('V239 preserves a normal record when the trial Host reports typed unresolved (stub trial boundary)',async()=>{
 const {configuration,motor}=input(),p=createLiveBattingPracticeV150(configuration);await p.startSpinMotorPractice({version:'live_spin_practice_plan_v239',scopeId:'trial-hold',pitchOrdinals:[1],motor,criterion:null,normalRequest:{batting:'take'}});
 const original=pitchOwner.simulateLivePitchV1;let calls=0;vi.spyOn(pitchOwner,'simulateLivePitchV1').mockImplementation(raw=>++calls%2?original(raw):({frames:[],contact:null,call:null,endedAtTick:1,diagnostics:{unsupportedReason:'trial-unresolved'}} as never));
 const before=p.capture(),candidate=await p.previewSpinMotorPractice();expect(candidate.entry).toMatchObject({kind:'HOLD',hold:{attempt:'TRIAL',unresolved:{phase:'PITCH',code:'PITCH_NO_CALL'}}});expect(candidate.entry.normalRecord).not.toBeNull();
 await p.acceptSpinMotorPractice(candidate);const saved=p.capture();expect(saved.continuation).toEqual(before.continuation);expect((await resumeLiveBattingPracticeSpinV239(configuration,structuredClone(saved))).capture()).toEqual(saved);
},60000);
it('V239 propagates unknown exceptions and does not turn message lookalikes into HOLD',async()=>{
 const {configuration,motor}=input(),p=createLiveBattingPracticeV150(configuration);await p.startSpinMotorPractice({version:'live_spin_practice_plan_v239',scopeId:'unknown',pitchOrdinals:[1],motor,criterion:null,normalRequest:{batting:'take'}});const before=p.capture();
 vi.spyOn(pitchOwner,'simulateLivePitchV1').mockImplementation(()=>{throw Error('live baseball match: pitch ended without physical contact or secured count call')});
 await expect(p.previewSpinMotorPractice()).rejects.toThrow(/pitch ended/);expect(p.capture()).toEqual(before);
},60000);
it('V239 rejects foreign policy, changed clip, and mismatched domain without changing state',async()=>{
 const {configuration,motor}=input(),h=createLiveBaseballMatchWorkerV116(configuration),before=h.captureContinuationV116(),policy={version:'live_spin_motor_practice_policy_v239' as const,subjectId:motor.subjectId,motorId:motor.motorId,motorVersion:motor.motorVersion,clip:motor.clip};
 expect(()=>h.issuePitch({batting:'take',pitchType:'auto',location:'auto',managedTeam:0,spinMotorPracticePolicyV239:{...policy,subjectId:'foreign'}})).toThrow(/subject/);expect(h.captureContinuationV116()).toEqual(before);
 expect(()=>h.issuePitch({batting:'take',pitchType:'auto',location:'auto',managedTeam:0,spinMotorPracticePolicyV239:{...policy,clip:{...policy.clip,sourceSha256:'b'.repeat(64)}}})).toThrow(/clip/);expect(h.captureContinuationV116()).toEqual(before);
 const p=createLiveBattingPracticeV150(configuration),prior=p.capture();await expect(p.startSpinMotorPractice({version:'live_spin_practice_plan_v239',scopeId:'bad-domain',pitchOrdinals:[1],motor:{...motor,domain:{...motor.domain,plateZ:motor.domain.plateZ+.1}},criterion:null,normalRequest:{batting:'take'}})).rejects.toThrow(/domain/);expect(p.capture()).toEqual(prior);
});
import * as fieldOwner from '../../core/sim/fielding/LiveFieldPlayV1';
it('V239 Host preserves FIELD unresolved message, cause and inert diagnostic (stub field boundary)',()=>{
 const {configuration,motor}=input(),host=createLiveBaseballMatchWorkerV116(configuration),trial={version:'live_observed_spin_compose_trial_v238' as const,subjectId:motor.subjectId,technique:motor.technique,clip:motor.clip,domain:motor.domain,delta:motor.delta};
 vi.spyOn(fieldOwner,'simulateLiveFieldPlayV1').mockReturnValue({end:{complete:false,reason:'fixture-field'},diagnostics:{marker:'fixture'},facts:[]} as never);let error:unknown;
 try{host.issuePitch({batting:'balanced',pitchType:'auto',location:'auto',managedTeam:0,observedSpinTrialV236:trial})}catch(e){error=e}
 expect(isLiveBaseballUnresolvedV239(error)).toBe(true);if(!isLiveBaseballUnresolvedV239(error))throw Error('field unresolved missing');expect(error.message).toContain('physical field continuation unresolved: fixture-field');expect(error.unresolvedV239).toMatchObject({phase:'FIELD',code:'FIELD_INCOMPLETE',detail:{diagnostics:{marker:'fixture'}}});expect(error.cause).toMatchObject({diagnostics:{marker:'fixture'}});
},60000);
import * as rulesOwner from './PlayableMatchRulesV1';
it('V239 Host distinguishes RULE unresolved from pitch and field failures (stub rule boundary)',()=>{
 const {configuration}=input(),host=createLiveBaseballMatchWorkerV116(configuration);vi.spyOn(rulesOwner,'reducePlayableMatchV1').mockReturnValue({kind:'unresolved',reason:'fixture-rule'} as never);let error:unknown;
 try{host.issuePitch({batting:'take',pitchType:'auto',location:'auto',managedTeam:0})}catch(e){error=e}
 expect(isLiveBaseballUnresolvedV239(error)).toBe(true);if(!isLiveBaseballUnresolvedV239(error))throw Error('rule unresolved missing');expect(error.message).toContain('rule continuation unresolved: fixture-rule');expect(error.unresolvedV239).toMatchObject({phase:'RULE',code:'RULE_UNRESOLVED',detail:{result:{reason:'fixture-rule'}}});
});
it('V239 saved paired record survives the existing lossless transport codec and replay',async()=>{
 const {configuration,motor}=input(),p=createLiveBattingPracticeV150(configuration);await p.startSpinMotorPractice({version:'live_spin_practice_plan_v239',scopeId:'transport',pitchOrdinals:[1],motor,criterion:null,normalRequest:{batting:'balanced'}});
 await p.acceptSpinMotorPractice(await p.previewSpinMotorPractice());const saved=p.capture();
 // Existing transport codec is deliberately reused; hash encoding remains separate.
 // @ts-expect-error local ESM verification codec has no declaration file.
 const codec=await import('../../../tools/verification/live-debug-record.mjs');const decoded=codec.parseDebugRecord(codec.stringifyDebugRecord(saved));expect(decoded).toEqual(saved);expect((await resumeLiveBattingPracticeSpinV239(configuration,decoded)).capture()).toEqual(saved);
},60000);
it('V239 policy rejects mixed raw trial or altered clip without consuming Host state',()=>{
 const {configuration,motor}=input(),h=createLiveBaseballMatchWorkerV116(configuration),before=h.captureContinuationV116(),policy={version:'live_spin_motor_practice_policy_v239' as const,subjectId:motor.subjectId,motorId:motor.motorId,motorVersion:motor.motorVersion,clip:motor.clip},
  raw={version:'live_observed_spin_trial_v236' as const,subjectId:motor.subjectId,technique:motor.technique,clip:motor.clip,domain:{...motor.domain,contactDepthZ:motor.domain.plateZ+.05},delta:motor.delta};
 expect(()=>h.issuePitch({batting:'take',pitchType:'auto',location:'auto',managedTeam:0,spinMotorPracticePolicyV239:policy,observedSpinTrialV236:raw})).toThrow(/legacy raw/);expect(h.captureContinuationV116()).toEqual(before);
 const composed={...raw,version:'live_observed_spin_compose_trial_v238' as const,domain:motor.domain,clip:{...motor.clip,sourceSha256:'b'.repeat(64)}};
 expect(()=>h.issuePitch({batting:'take',pitchType:'auto',location:'auto',managedTeam:0,spinMotorPracticePolicyV239:policy,observedSpinTrialV236:composed})).toThrow(/trial clip/);expect(h.captureContinuationV116()).toEqual(before);
});
it('V239 resume refuses altered hashes, plan, bound opportunity and after continuation',async()=>{
 const {configuration,motor}=input(),p=createLiveBattingPracticeV150(configuration);await p.startSpinMotorPractice({version:'live_spin_practice_plan_v239',scopeId:'tamper',pitchOrdinals:[1],motor,criterion:null,normalRequest:{batting:'take'}});await p.acceptSpinMotorPractice(await p.previewSpinMotorPractice());const saved=p.capture();
 const changes=[(x:any)=>x.spinMotorPracticeV239.entries[0].hashes.trialRecord='0'.repeat(64),(x:any)=>x.spinMotorPracticeV239.plan.motor.delta.y=.09,
  (x:any)=>x.spinMotorPracticeV239.slots[0].opportunity.pitchFingerprint='0'.repeat(64),(x:any)=>x.continuation.nextTick+=1];
 for(const mutate of changes){const changed=structuredClone(saved);mutate(changed);await expect(resumeLiveBattingPracticeSpinV239(configuration,changed)).rejects.toThrow()}
},60000);
it('V239 closes a finished cohort, retains a normal tail and replays both portions',async()=>{
 const {configuration,motor}=input(),p=createLiveBattingPracticeV150(configuration);await p.startSpinMotorPractice({version:'live_spin_practice_plan_v239',scopeId:'close',pitchOrdinals:[1],motor,criterion:null,normalRequest:{batting:'take'}});
 await p.acceptSpinMotorPractice(await p.previewSpinMotorPractice());const beforeClose=p.capture(),closed=p.closeSpinMotorPractice();expect(closed.phase).toBe('CLOSED');expect(p.capture().continuation).toEqual(beforeClose.continuation);expect(closed.sidecarRevision).toBe(beforeClose.spinMotorPracticeV239!.sidecarRevision+1);
 const beforePreview=p.capture(),next=p.preview({batting:'take'});expect(p.capture()).toEqual(beforePreview);p.accept(next);const saved=p.capture();expect(saved.spinMotorPracticeV239?.normalTail).toHaveLength(1);expect(saved.spinMotorPracticeV239?.normalTailHashAuthority).toBe('NOT_HASHED');
 expect((await resumeLiveBattingPracticeSpinV239(configuration,structuredClone(saved))).capture()).toEqual(saved);
 const altered=structuredClone(saved) as any;altered.spinMotorPracticeV239.normalTail[0].record.pitcherPlayerId='foreign';await expect(resumeLiveBattingPracticeSpinV239(configuration,altered)).rejects.toThrow(/tail differs/);expect(()=>p.closeSpinMotorPractice()).toThrow(/already|active/);
},60000);
it('V239 interruption keeps pending cohort and invalidates both candidate kinds across close',async()=>{
 const {configuration,motor}=input(),p=createLiveBattingPracticeV150(configuration),old=p.preview({batting:'take'});await p.startSpinMotorPractice({version:'live_spin_practice_plan_v239',scopeId:'interrupt',pitchOrdinals:[1,2],motor,criterion:null,normalRequest:{batting:'take'}});
 const pair=await p.previewSpinMotorPractice(),before=p.capture(),closed=p.closeSpinMotorPractice();expect(closed.phase).toBe('INTERRUPTED');expect(closed.slots.map(s=>s.status)).toEqual(['PENDING','PENDING']);expect(closed.evaluation).toMatchObject({status:'HOLD',reason:'COHORT_PENDING'});
 expect(p.capture().continuation).toEqual(before.continuation);await expect(p.acceptSpinMotorPractice(pair)).rejects.toThrow(/stale|candidate/);expect(()=>p.accept(old)).toThrow(/stale|candidate/);
 const next=p.preview({batting:'take'});p.accept(next);const saved=p.capture();expect((await resumeLiveBattingPracticeSpinV239(configuration,structuredClone(saved))).capture()).toEqual(saved);
},60000);
it('V239 close invalidates a paired preview still awaiting fingerprint hashing',async()=>{
 const {configuration,motor}=input(),p=createLiveBattingPracticeV150(configuration);await p.startSpinMotorPractice({version:'live_spin_practice_plan_v239',scopeId:'race',pitchOrdinals:[1],motor,criterion:null,normalRequest:{batting:'take'}});
 const before=p.capture(),pending=p.previewSpinMotorPractice();p.closeSpinMotorPractice();await expect(pending).rejects.toThrow(/state changed/);expect(p.capture().continuation).toEqual(before.continuation);
},60000);
