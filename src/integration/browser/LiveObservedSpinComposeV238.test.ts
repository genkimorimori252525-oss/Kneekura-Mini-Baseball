import { expect,it } from 'vitest';
import { forecastObservedPitchV151 } from '../../core/decision/batting/ObservedPitchForecastV151';
import { resolveLiveObservedSpinComposeV238,composeLiveObservedSpinAimV238,type LiveObservedSpinComposeRequestV238 } from './LiveObservedSpinComposeV238';
const clip={id:'obp-test',sourceSha256:'a'.repeat(64),bats:'R' as const};
const request={version:'live_observed_spin_compose_trial_v238',subjectId:'player',technique:'TOPSPIN',clip,domain:{plateZ:0,coordinateSystem:'LIVE_WORLD_METERS_V1'},delta:{x:0,y:-0}} as const;
const observations=[{observationId:'a',observedTick:0,availableTick:0,position:{x:0,y:1,z:2}},{observationId:'b',observedTick:100000,availableTick:100000,position:{x:0,y:1,z:1}}];
const input={originTick:0,ticksPerSecond:1000000,cutoffTick:100000,planeZ:0,maximumAfterReleaseSeconds:1,observations},snapshot={...input,forecast:forecastObservedPitchV151(input)};
const resolve=(r:LiveObservedSpinComposeRequestV238=request)=>resolveLiveObservedSpinComposeV238({request:r,snapshot,clip,decisionTick:100000,swingOffered:true,battingMode:'balanced'});
it('V238 zero leaves the pre-error plan object and signed zero untouched',()=>{
 const result=resolve();expect(result.status).toBe('APPLIED');const center={x:-0,y:0,z:-0},composed=composeLiveObservedSpinAimV238(center,result);
 expect(composed.center).toBe(center);expect(Object.is(composed.center.x,-0)).toBe(true);expect(Object.is(composed.center.z,-0)).toBe(true);expect(composed.normalPathRetained).toBe(true);
});
it('V238 applies explicit XY before errors, preserves Z and records represented differences',()=>{
 const result=resolve({...request,delta:{x:.01,y:-.02}}),center={x:.2,y:1,z:.15},composed=composeLiveObservedSpinAimV238(center,result);
 expect(composed.center).toEqual({x:center.x+.01,y:center.y-.02,z:center.z});expect(composed.normalPathRetained).toBe(false);expect(composed.preErrorDelta.x).toBe(composed.center.x-center.x);expect(composed.preErrorDelta.y).toBe(composed.center.y-center.y);
});
it('V238 rejects invalid requests and corrupt snapshots; missing or mismatched inputs give NO_TARGET',()=>{
 expect(()=>resolve({...request,delta:{x:NaN,y:0}})).toThrow();expect(()=>resolveLiveObservedSpinComposeV238({request,snapshot:{...snapshot,cutoffTick:99999},clip,decisionTick:100000,swingOffered:true,battingMode:'balanced'})).toThrow();
 expect(resolveLiveObservedSpinComposeV238({request,snapshot:null,clip,decisionTick:100000,swingOffered:true,battingMode:'balanced'})).toMatchObject({status:'NO_TARGET'});
 expect(resolveLiveObservedSpinComposeV238({request,snapshot,clip:{...clip,id:'other'},decisionTick:100000,swingOffered:true,battingMode:'balanced'})).toMatchObject({status:'NO_TARGET',reason:'CLIP_MISMATCH'});
});
it('V238 preserves zero axis exactly and applies execution error only after composition',()=>{
 const result=resolve({...request,delta:{x:0,y:.01}}),center={x:-0,y:1,z:-0},composed=composeLiveObservedSpinAimV238(center,result),error={x:.003,y:-.004};
 expect(Object.is(composed.center.x,-0)).toBe(true);expect(Object.is(composed.center.z,-0)).toBe(true);
 expect({x:composed.center.x+error.x,y:composed.center.y+error.y}).toEqual({x:center.x+error.x,y:(center.y+.01)+error.y});
});
it('V238 validates keys and rejects future data without inventing a target',()=>{
 expect(()=>resolve({...request,extra:1} as never)).toThrow();expect(()=>resolve({...request,domain:{...request.domain,contactDepthZ:.1}} as never)).toThrow();
 const future={...input,observations:[]},noDelivery={...future,forecast:forecastObservedPitchV151(future)};
 expect(resolveLiveObservedSpinComposeV238({request,snapshot:noDelivery,clip,decisionTick:100000,swingOffered:true,battingMode:'balanced'})).toMatchObject({status:'NO_TARGET',reason:'MISSING_DELIVERED_FORECAST'});
 expect(resolveLiveObservedSpinComposeV238({request,snapshot,clip,decisionTick:100000,swingOffered:false,battingMode:'take'})).toMatchObject({status:'NO_TARGET',reason:'NO_SWING'});
});
import { readFileSync } from 'node:fs';
import { simulateLivePitchV1,type LiveMeasuredClipV1,type LivePitchInputV1 } from './LivePitchV1';
import { AUTHORED_LIVE_BATTER_OBSERVATION_V151 } from './LiveBatterObservationV151';
import { AUTHORED_OBSERVED_DIRECTION_MOTOR_V153 } from './LiveDirectionMotorV153';
import { AUTHORED_PLAY_RANDOMNESS_V152 } from '../../core/rng/LiveRandomStreamsV152';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { resolveLiveBattingSetupV94 } from '../../core/sim/pitching/BattingSetupV94';
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
it('V238 zero composes the exact normal record, clock, RNG and late correction on both sides and all directions',()=>{
 for(const bats of ['R','L'] as const)for(const mode of ['PULL','CENTER','OPPOSITE','AUTO'] as const){const {pitch,request}=composeFixture(bats,mode),normal=simulateLivePitchV1(pitch),candidate=simulateLivePitchV1({...pitch,observedSpinTrialV236:request} as never);
  const {sampleBatAtTick:_a,...a}=normal,{sampleBatAtTick:_b,...raw}=candidate,{observedSpinComposeV238:diagnostic,...diagnostics}=raw.diagnostics;
  expect(diagnostic).toMatchObject({status:'PLANNED',earnedQualification:false});expect(normal.diagnostics.batterObservationV151!.effectivePriorWeight).toBeGreaterThan(0);expect(normal.diagnostics.lateEvidenceV121).toBeDefined();expect({...raw,diagnostics}).toEqual(a);
  expect(candidate.sampleBatAtTick(candidate.diagnostics.referenceContactTick)).toEqual(normal.sampleBatAtTick(normal.diagnostics.referenceContactTick));
 }
},120000);
it('V238 nonzero changes final XY while keeping planned clock, errors, Z and late-correction availability',()=>{
 const {pitch,request}=composeFixture('L','CENTER'),normal=simulateLivePitchV1(pitch),candidate=simulateLivePitchV1({...pitch,observedSpinTrialV236:{...request,delta:{x:.01,y:-.01}}} as never);
 expect(candidate.diagnostics.observedSpinComposeV238).toMatchObject({status:'PLANNED',earnedQualification:false});expect(candidate.diagnostics.desiredContactElapsedSeconds).toBe(normal.diagnostics.desiredContactElapsedSeconds);
 expect(candidate.diagnostics.aimErrorMeters).toEqual(normal.diagnostics.aimErrorMeters);expect(candidate.diagnostics.timingErrorSeconds).toBe(normal.diagnostics.timingErrorSeconds);
 expect(candidate.diagnostics.batPlaybackV88!.reference.transform.translation).not.toEqual(normal.diagnostics.batPlaybackV88!.reference.transform.translation);
 expect(candidate.diagnostics.referenceContactTick).toBe(normal.diagnostics.referenceContactTick);expect(normal.diagnostics.lateEvidenceV121?.applied).toBe(true);expect(candidate.diagnostics.lateEvidenceV121?.applied).toBe(true);
 const before=normal.sampleBatAtTick(normal.diagnostics.referenceContactTick)!,after=candidate.sampleBatAtTick(candidate.diagnostics.referenceContactTick)!;expect({x:after.grip.x,y:after.grip.y}).not.toEqual({x:before.grip.x,y:before.grip.y});expect(after.grip.z).toBe(before.grip.z);
 console.log('V238 nonzero comparison',JSON.stringify({before:before.grip,after:after.grip,normalContact:!!normal.contact,trialContact:!!candidate.contact,normalSpin:normal.contact?.exitSpin??null,trialSpin:candidate.contact?.exitSpin??null}));
},60000);
it('V238 four fixed explicit XY probes report final motion and real outcomes without changing clock',()=>{
 const {pitch,request}=composeFixture('R','CENTER'),normal=simulateLivePitchV1(pitch),normalPose=normal.sampleBatAtTick(normal.diagnostics.referenceContactTick)!;
 const probes=[['BACKSPIN',0,.01],['TOPSPIN',0,-.01],['SLICE',.01,0],['HOOK',-.01,0]] as const,records=[];
 for(const [technique,x,y] of probes){const r=simulateLivePitchV1({...pitch,observedSpinTrialV236:{...request,technique,delta:{x,y}}} as never),trace=r.diagnostics.observedSpinComposeV238;
  expect(trace).toMatchObject({status:'PLANNED',earnedQualification:false,registration:{actualExecutionDelta:null,actualExecutionDeltaReason:'MATCHED_NORMAL_RUN_REQUIRED'}});
  expect(r.diagnostics.referenceContactTick).toBe(normal.diagnostics.referenceContactTick);const p=r.sampleBatAtTick(r.diagnostics.referenceContactTick)!;
  expect({x:p.grip.x,y:p.grip.y}).not.toEqual({x:normalPose.grip.x,y:normalPose.grip.y});expect(p.grip.z).toBe(normalPose.grip.z);
  records.push({technique,requested:{x,y},represented:{x:p.grip.x-normalPose.grip.x,y:p.grip.y-normalPose.grip.y},contact:!!r.contact,exitSpin:r.contact?.exitSpin??null,unsupported:r.diagnostics.unsupportedReason});
 }
 console.log('V238 fixed probes',JSON.stringify(records));
},120000);
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';
import { createLiveBaseballMatchWorkerV116 } from './LiveBaseballMatchV1';
import { createLiveBattingPracticeV150 } from './LiveBattingPracticeV150';
import { build } from 'esbuild';
import { Worker } from 'node:worker_threads';
it('V238 per-pitch request reaches Host, preview, saved continuation and a worker thread',async()=>{
 const initial={...liveMatchFixture(2468),batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151},first=createLiveBaseballMatchWorkerV116(initial),subjectId=first.inspect().batterPlayerId,
 player=initial.players.find(p=>p.playerId===subjectId)!,chosen=initial.measuredClips.find(c=>c.side===player.bats)!,physical={...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,clipId:chosen.id,swingDecision:{approach:'SWING' as const,threshold:0,aggressionWeight:1}},
 input={...initial,players:initial.players.map(p=>p.playerId===subjectId?{...p,physical}:p)},host=createLiveBaseballMatchWorkerV116(input),practice=createLiveBattingPracticeV150(input),
 trial:LiveObservedSpinComposeRequestV238={version:'live_observed_spin_compose_trial_v238',subjectId,technique:'TOPSPIN',clip:{id:chosen.id,sourceSha256:chosen.source.sha256,bats:player.bats},domain:{plateZ:resolveLiveBattingSetupV94({...physical,heightMeters:player.heightMeters,bats:player.bats}).contactPlaneZ,coordinateSystem:'LIVE_WORLD_METERS_V1'},delta:{x:.01,y:0}},
 before=practice.capture(),candidate=practice.preview({batting:'balanced',observedSpinTrialV236:trial});
 expect(practice.capture()).toEqual(before);const official=host.issuePitch({batting:'balanced',pitchType:'auto',location:'auto',managedTeam:0,observedSpinTrialV236:trial});expect(practice.accept(candidate)).toEqual(official);
 expect((official.play.diagnostics as {observedSpinComposeV238?:unknown}).observedSpinComposeV238).toMatchObject({status:'PLANNED'});const capture=JSON.parse(JSON.stringify(practice.capture()));expect(createLiveBattingPracticeV150(input,capture).capture()).toEqual(practice.capture());
 const bundle=await build({entryPoints:['src/integration/browser/LiveBattingPracticeV150.ts'],bundle:true,write:false,platform:'node',format:'esm',target:'node22'}),url='data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'),
 worker=new Worker(`const {parentPort}=require('node:worker_threads');(async()=>{const api=await import(${JSON.stringify(url)});parentPort.on('message',v=>{try{const p=api.createLiveBattingPracticeV150(v.input);parentPort.postMessage({record:p.issuePitch(v.request),capture:p.capture()})}catch(e){parentPort.postMessage({error:String(e.stack||e)})}})})().catch(e=>parentPort.postMessage({error:String(e.stack||e)}));`,{eval:true});
 try{const answer=await new Promise<{record:unknown;capture:typeof capture;error?:string}>((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({input,request:{batting:'balanced',observedSpinTrialV236:trial}})});expect(answer.error).toBeUndefined();expect(answer.record).toEqual(official);expect(answer.capture.continuation).toEqual(practice.capture().continuation)}finally{await worker.terminate()}
},60000);
