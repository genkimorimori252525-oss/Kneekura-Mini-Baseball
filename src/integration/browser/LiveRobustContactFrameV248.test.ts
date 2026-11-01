import {expect,it} from 'vitest';





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
const trial=(request:LiveObservedSpinComposeRequestV238,minimum=1,budget=259)=>({version:'live_observed_robust_contact_frame_trial_v248' as const,subjectId:request.subjectId,technique:request.technique,clip:request.clip,domain:request.domain,policy:'finite_sigma_v247' as const,thresholds:{minimumComponent:minimum,minimumImprovement:minimum},maximumEvaluations:budget,maximumSearchSamples:budget*4096});
it('reports a budget hold and preserves the normal motion and random trace',()=>{
 const {pitch,request}=composeFixture('L','CENTER'),plain=simulateLivePitchV1(pitch),actual=simulateLivePitchV1({...pitch,observedSpinTrialV236:trial(request,1,1)});
 const {sampleBatAtTick:_a,...a}=plain,{sampleBatAtTick:_b,...b}=actual,{observedSpinRobustContactFrameV248:d,...diagnostics}=b.diagnostics;
 expect(d).toMatchObject({status:'UNRESOLVED',reason:'EVALUATION_BUDGET_INSUFFICIENT',selectedDelta:null,actualFutureUsed:false});expect({...b,diagnostics}).toEqual(a);
},120000);
it.runIf(existsSync('work/maker-effective-forecast-v246-hook-browser-01/episode-1-step-1.json'))('uses the preserved HOOK opportunity through real Host contact and saturation',async()=>{
 const path='work/maker-effective-forecast-v246-hook-browser-01/episode-1-step-1.json',bytes=readFileSync(path);expect(createHash('sha256').update(bytes).digest('hex')).toBe('fd32dfd3fd70e8536d212bdea5e8dd7fd6dcf6961f1651f1803234d6efff2da7');
 // @ts-expect-error Existing lossless verification codec is JavaScript.
 const {parseDebugRecord}=await import('../../../tools/verification/live-debug-record.mjs');const saved=parseDebugRecord(bytes.toString('utf8')),{createLiveBaseballMatchWorkerV116}=await import('./LiveBaseballMatchV1');
 const previous=saved.step.trialRecord.command.observedSpinTrialV236,{policy:_old,...rest}=previous,request={...rest,version:'live_observed_robust_contact_frame_trial_v248' as const,policy:'finite_sigma_v247' as const,maximumEvaluations:259,maximumSearchSamples:259*4096};
 const host=createLiveBaseballMatchWorkerV116(saved.capture.configuration,saved.step.before),record=host.issuePitch({...saved.step.trialRecord.command,observedSpinTrialV236:request}),d=(record.play.diagnostics as any).observedSpinRobustContactFrameV248;
 console.log('V248_SAVED_HOOK',{status:d.status,reason:d.reason,selectedDelta:d.selectedDelta,contact:!!record.play.contact,saturation:(record.play.diagnostics as any).directionMotorV153.executionSaturation});
 expect(d.status).toBe('PLANNED');expect(Math.hypot(d.selectedDelta.x,d.selectedDelta.y,d.selectedDelta.z)).toBeGreaterThan(0);expect(record.play.contact).not.toBeNull();expect((record.play.diagnostics as any).directionMotorV153.executionSaturation.temporalScale).toBeLessThan(1);
},180000);
it('retains NO_TARGET normal execution and rejects hidden request fields',()=>{
 const {pitch,request}=composeFixture('L','CENTER'),plain=simulateLivePitchV1(pitch),actual=simulateLivePitchV1({...pitch,observedSpinTrialV236:trial(request,1e9)}),{sampleBatAtTick:_a,...a}=plain,{sampleBatAtTick:_b,...b}=actual,{observedSpinRobustContactFrameV248:d,...diagnostics}=b.diagnostics;
 expect(d).toMatchObject({status:'NO_TARGET',selectedDelta:null});expect({...b,diagnostics}).toEqual(a);expect(()=>simulateLivePitchV1({...pitch,observedSpinTrialV236:{...trial(request),actualFuture:1} as ReturnType<typeof trial>})).toThrow();
},120000);
it('freezes a finite-scenario plan against isolated execution draw changes',()=>{
 const {pitch,request}=composeFixture('L','CENTER'),first=simulateLivePitchV1({...pitch,randomnessV152:{...AUTHORED_PLAY_RANDOMNESS_V152,overrides:{batterExecution:101}},observedSpinTrialV236:trial(request)}),second=simulateLivePitchV1({...pitch,randomnessV152:{...AUTHORED_PLAY_RANDOMNESS_V152,overrides:{batterExecution:202}},observedSpinTrialV236:trial(request)}),a=first.diagnostics.observedSpinRobustContactFrameV248!,b=second.diagnostics.observedSpinRobustContactFrameV248!;
 expect(first.diagnostics.aimErrorMeters).not.toEqual(second.diagnostics.aimErrorMeters);expect(first.diagnostics.timingErrorSeconds).not.toBe(second.diagnostics.timingErrorSeconds);expect(first.diagnostics.sweetSpotT).not.toBe(second.diagnostics.sweetSpotT);
 expect(first.diagnostics.batterObservationV151?.rawForecast).toEqual(second.diagnostics.batterObservationV151?.rawForecast);expect(a.sigma).toEqual(b.sigma);expect(a.status).toBe('PLANNED');expect(a.status).toBe(b.status);expect(a.selectedOrdinal).toBe(b.selectedOrdinal);expect(a.selectedDelta).toEqual(b.selectedDelta);expect(a.candidates).toEqual(b.candidates);expect(a.actualFutureUsed).toBe(false);expect(b.actualFutureUsed).toBe(false);
},120000);
