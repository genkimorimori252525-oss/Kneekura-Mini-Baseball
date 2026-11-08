import {expect,it,vi} from 'vitest';
import * as directionOwner from './LiveDirectionMotorV153';
import {observeBattedBallSpinV123} from '../../core/sim/contact/BattedBallSpinObservationV123';
import {registerMeasuredBatToFieldV1} from './MeasuredBatFieldRegistrationV1';
import {createReferenceBatKinematicsV1} from '../../core/sim/contact/ReferenceBatKinematicsV1';
import * as contactFrameOwner from '../../core/decision/batting/ObservedContactFrameRegistrationV243';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {simulateLivePitchV1,type LiveMeasuredClipV1,type LivePitchInputV1} from './LivePitchV1';
import type {LiveObservedSpinComposeRequestV238} from './LiveObservedSpinComposeV238';
import {AUTHORED_LIVE_BATTER_OBSERVATION_V151} from './LiveBatterObservationV151';
import {AUTHORED_OBSERVED_DIRECTION_MOTOR_V153} from './LiveDirectionMotorV153';
import {AUTHORED_PLAY_RANDOMNESS_V152} from '../../core/rng/LiveRandomStreamsV152';
import {LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,LIVE_MATCH_PHYSICS_V1} from './LiveBaseballMatchV1';
import {resolveLiveBattingSetupV94} from '../../core/sim/pitching/BattingSetupV94';
const catalog=JSON.parse(readFileSync('docs/demos/measured-bat-motions.json','utf8')).clips as LiveMeasuredClipV1[];
function composeFixture(bats:'R'|'L',mode:'PULL'|'CENTER'|'OPPOSITE'|'AUTO'){
 const chosen=catalog.find(c=>c.side===bats)!,physical={...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,heightMeters:1.8,bats,clipId:chosen.id,maximumSweetSpotSpeedMps:50,targetSweetSpotSpeedMps:30,
  motorLatencySeconds:.04,timingStdSeconds:.004,aimStdMeters:.004,plateVision:85,zoneJudgmentStdMeters:.02,swingDecision:{approach:'SWING' as const,threshold:0,aggressionWeight:1},
  batterApproachV122:{version:'batter_approach_v122' as const,sourceId:'v238-prior',priorReliance:.8,directionCommitment:1,twoStrikeCommitmentDelta:0,preferredWhenCommitted:{pull:1,center:0,opposite:0},targetPullAnglesDegrees:{pull:25,center:0,opposite:-25}}};
 const belief={version:'batter_belief_v122' as const,sourceId:'v238-belief',observerPlayerId:'b',pitcherId:'p',capturedAtTick:999999,observedThroughTick:900000,confidence:.7,evidenceRefs:['previous-ball'],candidates:[{familyId:'estimated-fast',regionId:'own-high',probability:1,prediction:{x:-.15,y:1.3,arrivalAfterReleaseSeconds:.4}}]};
 const pitch:LivePitchInputV1={originTick:1000000,seed:31,randomnessV152:AUTHORED_PLAY_RANDOMNESS_V152,batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151,
  batterDirectionMotorV153:AUTHORED_OBSERVED_DIRECTION_MOTOR_V153,battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'v238-direction',mode},
  batterBeliefV122:{belief,observerPlayerId:'b',pitcherId:'p'},batter:physical,pitcher:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,commandStdMeters:0},measuredClips:catalog,batting:'balanced',pitchType:'fastball',location:'zone',physics:LIVE_MATCH_PHYSICS_V1};
 const request:LiveObservedSpinComposeRequestV238={version:'live_observed_spin_compose_trial_v238',subjectId:'b',technique:'TOPSPIN',clip:{id:chosen.id,sourceSha256:chosen.source.sha256,bats},
  domain:{plateZ:resolveLiveBattingSetupV94(physical).contactPlaneZ,coordinateSystem:'LIVE_WORLD_METERS_V1'},delta:{x:0,y:0}};
 return {pitch,request};
}
const trial=(request:LiveObservedSpinComposeRequestV238,minimum=1)=>({version:'live_observed_contact_frame_trial_v244' as const,subjectId:request.subjectId,technique:request.technique,clip:request.clip,domain:request.domain,policy:'FIXED_25_UNCALIBRATED_V243' as const,thresholds:{minimumComponent:minimum,minimumImprovement:minimum}});
it('NO_TARGET preserves complete normal physics and sample path',()=>{
 const {pitch,request}=composeFixture('L','CENTER'),normal=simulateLivePitchV1(pitch),actual=simulateLivePitchV1({...pitch,observedSpinTrialV236:trial(request,1e9)});
 const {sampleBatAtTick:_a,...a}=normal,{sampleBatAtTick:_b,...b}=actual,{observedSpinContactFrameV244:d,...diagnostics}=b.diagnostics;expect(d).toMatchObject({status:'NO_TARGET',earnedQualification:false});expect(d).not.toHaveProperty('selectedPrediction');expect({...b,diagnostics}).toEqual(a);expect(actual.sampleBatAtTick(actual.diagnostics.referenceContactTick)).toEqual(normal.sampleBatAtTick(normal.diagnostics.referenceContactTick));
},120000);
it('rejects mismatched clip and unavailable delivery without changing normal motion',()=>{
 const {pitch,request}=composeFixture('L','CENTER'),bad={...trial(request),clip:{...request.clip,bats:'R' as const}},result=simulateLivePitchV1({...pitch,observedSpinTrialV236:bad});expect(result.diagnostics.observedSpinContactFrameV244).toMatchObject({status:'NO_TARGET',reason:'CLIP_MISMATCH'});
 const wrongDomain=simulateLivePitchV1({...pitch,observedSpinTrialV236:{...trial(request),domain:{...request.domain,plateZ:request.domain.plateZ+.1}}});expect(wrongDomain.diagnostics.observedSpinContactFrameV244).toMatchObject({status:'NO_TARGET',reason:'DOMAIN_MISMATCH'});
 expect(()=>simulateLivePitchV1({...pitch,observedSpinTrialV236:{...trial(request),subjectId:'foreign'}})).toThrow(/subject/);
 const {batterObservationV151:_observation,batterDirectionMotorV153:_direction,...withoutObservation}=pitch;const noObservation=simulateLivePitchV1({...withoutObservation,observedSpinTrialV236:trial(request)});expect(noObservation.diagnostics.observedSpinContactFrameV244).toMatchObject({status:'NO_TARGET',reason:'MISSING_DELIVERED_FORECAST'});
},120000);
it('fixed measured fixture plans a nonzero contact-frame movement without changing timing and aim error',()=>{
 const {pitch,request}=composeFixture('L','CENTER'),normal=simulateLivePitchV1(pitch),actual=simulateLivePitchV1({...pitch,observedSpinTrialV236:trial(request)}),d=actual.diagnostics.observedSpinContactFrameV244;
 expect(d).toMatchObject({status:'PLANNED',earnedQualification:false});expect(d!.nominalPlanningRate).toBe(d!.executedPlaybackRate);expect(Math.hypot(d!.selectedDelta!.x,d!.selectedDelta!.y,d!.selectedDelta!.z)).toBeGreaterThan(0);expect(actual.diagnostics.referenceContactTick).toBe(normal.diagnostics.referenceContactTick);expect(actual.diagnostics.aimErrorMeters).toEqual(normal.diagnostics.aimErrorMeters);expect(actual.diagnostics.timingErrorSeconds).toBe(normal.diagnostics.timingErrorSeconds);expect(actual.sampleBatAtTick(actual.diagnostics.referenceContactTick)).not.toEqual(normal.sampleBatAtTick(normal.diagnostics.referenceContactTick));const n=normal.diagnostics.batPlaybackV88!.reference,a=actual.diagnostics.batPlaybackV88!.reference;expect(a.startTick).toBe(n.startTick);expect(a.executionEnvelopeV133?.preparation).toEqual(n.executionEnvelopeV133?.preparation);expect(a.executionEnvelopeV133?.recovery).toEqual(n.executionEnvelopeV133?.recovery);
},120000);

it('stub rate saturation retains the first predicted delta without reselection or double application',()=>{
 const original=directionOwner.limitDirectionExecutionV153,planSpy=vi.spyOn(contactFrameOwner,'planObservedContactFrameRegistrationV243'),{pitch,request}=composeFixture('L','CENTER'),plain=simulateLivePitchV1({...pitch,observedSpinTrialV236:trial(request)}),expected=plain.diagnostics.observedSpinContactFrameV244!;
 expect(expected.status).toBe('PLANNED');planSpy.mockClear();const spy=vi.spyOn(directionOwner,'limitDirectionExecutionV153').mockImplementation((...args)=>{const value=original(...args);return {...value,temporalScale:.9,reference:{...value.reference,playbackRate:value.reference.playbackRate*.9}}});
 try{const normal=simulateLivePitchV1(pitch),actual=simulateLivePitchV1({...pitch,observedSpinTrialV236:trial(request)}),d=actual.diagnostics.observedSpinContactFrameV244!;expect(d.status).toBe('PLANNED');expect(d.selectedOrdinal).toBe(expected.selectedOrdinal);expect(d.selectedDelta).toEqual(expected.selectedDelta);expect(d.predictionExecutionScope).toBe('NOMINAL_RATE_DIFFERS_NOT_EXECUTION_PROOF');expect(planSpy).toHaveBeenCalledTimes(1);
 const a=actual.diagnostics.batPlaybackV88!.reference.transform.translation,n=normal.diagnostics.batPlaybackV88!.reference.transform.translation;for(const k of ['x','y','z'] as const)expect(a[k]-n[k]).toBeCloseTo(d.selectedDelta![k],12);
 }finally{spy.mockRestore();planSpy.mockRestore()}
},120000);

// Preserved genuine HOOK input is a private regression fixture, not a learned ability.
const savedHookPath='work/maker-practice-v239-v240-hook-01/cohort-start.json';
it.runIf(existsSync(savedHookPath))('fixed saved HOOK input reaches V244 actual contact (private fixture absent: skipped)',async()=>{
 const bytes=readFileSync(savedHookPath);expect(createHash('sha256').update(bytes).digest('hex')).toBe('bcf182bbd036b96987c0a0ea8d3ed65250ab6fd5931a8433e349faceef88654f');
 // @ts-expect-error Existing verification codec is JavaScript.
 const {parseDebugRecord}=await import('../../../tools/verification/live-debug-record.mjs');
 const saved=parseDebugRecord(bytes.toString('utf8')) as {initialCapture:{configuration:import('./LiveBaseballMatchV1').LiveMatchInputV1;continuation:import('./LiveBaseballMatchV1').LiveMatchContinuationV116};plan:{motor:import('./LiveSpinMotorPracticeV239').LiveSpinMotorV239;normalRequest:import('./LiveBattingPracticeV150').LiveBattingPracticeRequestV150}};
 const {createLiveBaseballMatchWorkerV116}=await import('./LiveBaseballMatchV1'),m=saved.plan.motor,policy={version:'live_spin_motor_practice_policy_v239' as const,subjectId:m.subjectId,motorId:m.motorId,motorVersion:m.motorVersion,clip:m.clip},request={version:'live_observed_contact_frame_trial_v244' as const,subjectId:m.subjectId,technique:m.technique,clip:m.clip,domain:m.domain,policy:'FIXED_25_UNCALIBRATED_V243' as const,thresholds:{minimumComponent:1,minimumImprovement:1}},managedTeam=saved.initialCapture.continuation.match.half==='top'?0 as const:1 as const;
 const host=createLiveBaseballMatchWorkerV116(saved.initialCapture.configuration,saved.initialCapture.continuation),record=host.issuePitch({...saved.plan.normalRequest,managedTeam,pitchType:'auto',location:'auto',spinMotorPracticePolicyV239:policy,observedSpinTrialV236:request});
 const diagnostic=(record.play.diagnostics as {observedSpinContactFrameV244?:{status:string;reason:string;selectedOrdinal:number;selectedDelta:unknown;nominalPlanningRate:number;executedPlaybackRate:number;predictionExecutionScope:string}}).observedSpinContactFrameV244;expect(diagnostic?.status,JSON.stringify(diagnostic)).toBe('PLANNED');expect(record.play.contact).not.toBeNull();
 const normalHost=createLiveBaseballMatchWorkerV116(saved.initialCapture.configuration,saved.initialCapture.continuation),normal=normalHost.issuePitch({...saved.plan.normalRequest,managedTeam,pitchType:'auto',location:'auto',spinMotorPracticePolicyV239:policy});
 const observe=(value:unknown)=>{if(!value)return null;const c=value as {exitVelocity:{x:number;y:number;z:number};exitSpin:{x:number;y:number;z:number}};return observeBattedBallSpinV123({velocityMps:c.exitVelocity,spinRadPerSecond:c.exitSpin,bats:m.clip.bats})};
 console.log('V244_SAVED_FIXED_HOOK_POST_CONTACT',JSON.stringify({nominalPlanningRate:diagnostic!.nominalPlanningRate,executedPlaybackRate:diagnostic!.executedPlaybackRate,predictionExecutionScope:diagnostic!.predictionExecutionScope,selectedOrdinal:diagnostic!.selectedOrdinal,selectedDelta:diagnostic!.selectedDelta,normal:observe(normal.play.contact),actual:observe(record.play.contact),counterfactualNotIndependent:true}));
 const {createLiveBattingPracticeV150,resumeLiveBattingPracticeEpisodesV242}=await import('./LiveBattingPracticeV150'),{declareSpinPracticeEpisodesV242}=await import('./LiveSpinPracticeEpisodesV242');
 const {delta:_oldDelta,...shared}=m,motor={...shared,version:'live_contact_frame_motor_v244' as const,policy:'FIXED_25_UNCALIBRATED_V243' as const,thresholds:request.thresholds},episodePlan=declareSpinPracticeEpisodesV242({scopeId:'saved-hook-diagnostic-replay',motor,criterion:null,episodeSeeds:[saved.initialCapture.configuration.seed]});
 const owner=createLiveBattingPracticeV150(saved.initialCapture.configuration);await owner.startEpisodePracticeV242(episodePlan,saved.plan.normalRequest);const candidate=await owner.previewEpisodeStepV242(),trace=candidate.step.trialRecord?.play.diagnostics as {observedSpinContactFrameV244?:{status:string;selectedPrediction?:unknown}};expect(trace.observedSpinContactFrameV244?.status).toBe('PLANNED');expect(trace.observedSpinContactFrameV244?.selectedPrediction).toBeDefined();await owner.acceptEpisodeStepV242(candidate);
 const capture=owner.capture(),resumed=await resumeLiveBattingPracticeEpisodesV242(saved.initialCapture.configuration,structuredClone(capture));expect(resumed.capture()).toEqual(capture);

},180000);

it('fixed delivered forecast chooses the same ordinal and delta despite different execution aim error',()=>{
 const {pitch,request}=composeFixture('L','CENTER'),a=simulateLivePitchV1({...pitch,batter:{...pitch.batter,aimStdMeters:0},observedSpinTrialV236:trial(request)}),b=simulateLivePitchV1({...pitch,observedSpinTrialV236:trial(request)}),x=a.diagnostics.observedSpinContactFrameV244!,y=b.diagnostics.observedSpinContactFrameV244!;
 expect(x.status).toBe('PLANNED');expect(y.status).toBe('PLANNED');expect(a.diagnostics.batterObservationV151?.rawForecast).toEqual(b.diagnostics.batterObservationV151?.rawForecast);expect(a.diagnostics.aimErrorMeters).not.toEqual(b.diagnostics.aimErrorMeters);expect(x.selectedOrdinal).toBe(y.selectedOrdinal);expect(x.selectedDelta).toEqual(y.selectedDelta);
},120000);
it('final V244 reference respects explicit speed and acceleration bounds',()=>{
 const {pitch,request}=composeFixture('L','CENTER'),limits={version:'swing_execution_v122' as const,sourceId:'fixed-existing-boundary-fixture',interpolation:'cubic-c1' as const,maximumGripAccelerationMps2:1e7,maximumAngularAccelerationRadPerSecond2:1e7,maximumSweetSpotAccelerationMps2:1e7,maximumCorrectionMeters:1};
 const result=simulateLivePitchV1({...pitch,batter:{...pitch.batter,swingExecutionV122:limits},observedSpinTrialV236:trial(request)}),d=result.diagnostics.batPlaybackV88!,clip=pitch.measuredClips.find(c=>c.id===d.reference.provenance.clipId&&c.side===d.battingSide)!;
 const frames=registerMeasuredBatToFieldV1(clip.frames).filter(f=>f.tick>=d.sourceFirstTick&&f.tick<=d.sourceLastTick).map(f=>({...f,grip:{x:f.grip.x*d.heightScale,y:f.grip.y*d.heightScale,z:f.grip.z*d.heightScale}})),motion=createReferenceBatKinematicsV1({...d.reference,frames});
 expect(motion.maximumSweetSpotSpeedMps).toBeLessThanOrEqual(pitch.batter.maximumSweetSpotSpeedMps!*(1+1e-10));expect(motion.maximumGripAccelerationMps2!).toBeLessThanOrEqual(limits.maximumGripAccelerationMps2);expect(motion.maximumAngularAccelerationRadPerSecond2!).toBeLessThanOrEqual(limits.maximumAngularAccelerationRadPerSecond2);expect(motion.maximumSweetSpotAccelerationMps2!).toBeLessThanOrEqual(limits.maximumSweetSpotAccelerationMps2);
},120000);

it('unachievable declared speed is not bypassed by contact-frame planning',()=>{
 const {pitch,request}=composeFixture('L','CENTER'),limited={...pitch,batter:{...pitch.batter,maximumSweetSpotSpeedMps:.000001}};
 expect(()=>simulateLivePitchV1(limited)).toThrow();expect(()=>simulateLivePitchV1({...limited,observedSpinTrialV236:trial(request)})).toThrow();
},120000);
it('records exactly the chosen planner contact prediction and preserves lossless transport',async()=>{
 const spy=vi.spyOn(contactFrameOwner,'planObservedContactFrameRegistrationV243');try{
  const {pitch,request}=composeFixture('L','CENTER'),actual=simulateLivePitchV1({...pitch,observedSpinTrialV236:trial(request)}),diagnostic=actual.diagnostics.observedSpinContactFrameV244!;
  expect(diagnostic.status).toBe('PLANNED');expect(spy).toHaveBeenCalledTimes(1);const result=spy.mock.results[0].value as ReturnType<typeof contactFrameOwner.planObservedContactFrameRegistrationV243>;expect(result.status).toBe('PLANNED');if(result.status!=='PLANNED')return;
  const selected=result.candidates.find(c=>c.ordinal===result.selectedOrdinal)!;expect(selected.prediction.status).toBe('FOUND');if(!('selectedPrediction' in diagnostic))throw Error('selected prediction missing');expect(diagnostic.selectedPrediction).toEqual(selected.prediction);
  if(selected.prediction.status==='FOUND'){expect(diagnostic.selectedPrediction).toMatchObject({atTick:selected.prediction.atTick,normal:selected.prediction.normal,response:{ballCenter:selected.prediction.response.ballCenter,normal:selected.prediction.response.normal,exitVelocity:selected.prediction.response.exitVelocity,exitSpin:selected.prediction.response.exitSpin,normalRelativeSpeedBeforeMps:selected.prediction.response.normalRelativeSpeedBeforeMps,tangentialRelativeSpeedBeforeMps:selected.prediction.response.tangentialRelativeSpeedBeforeMps,normalImpulseNs:selected.prediction.response.normalImpulseNs,tangentialImpulseNs:selected.prediction.response.tangentialImpulseNs,totalImpulseNs:selected.prediction.response.totalImpulseNs}});}
  // @ts-expect-error Existing verification codec is JavaScript.
  const {stringifyDebugRecord,parseDebugRecord}=await import('../../../tools/verification/live-debug-record.mjs');expect(parseDebugRecord(stringifyDebugRecord(diagnostic))).toEqual(diagnostic);
 }finally{spy.mockRestore()}
},120000);
