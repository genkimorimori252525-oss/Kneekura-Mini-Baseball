import { expect,it } from 'vitest';
import { forecastObservedPitchV151 } from '../../core/decision/batting/ObservedPitchForecastV151';
import { resolveLiveObservedSpinTrialV236 } from './LiveObservedSpinTrialV236';
const clip={id:'obp-test',sourceSha256:'a'.repeat(64),bats:'R' as const};
const request={version:'live_observed_spin_trial_v236',subjectId:'player-1',technique:'TOPSPIN',clip,domain:{plateZ:0,contactDepthZ:.1,coordinateSystem:'LIVE_WORLD_METERS_V1'},delta:{x:.01,y:.02}} as const;
const observations=[{observationId:'a',observedTick:0,availableTick:0,position:{x:0,y:1,z:2}},{observationId:'b',observedTick:100000,availableTick:100000,position:{x:0,y:1,z:1}}];
const base={originTick:0,ticksPerSecond:1000000,cutoffTick:100000,planeZ:0,maximumAfterReleaseSeconds:1,observations};
const snapshot={...base,forecast:forecastObservedPitchV151(base)};
it('V236 resolves a declared trial from the same delivered samples and preserves identity',()=>{
 const r=resolveLiveObservedSpinTrialV236({request,snapshot,clip,swingOffered:true,battingMode:'balanced'});expect(r.status).toBe('APPLIED');if(r.status!=='APPLIED')throw Error('missing trial');
 expect(r.earnedQualification).toBe(false);expect(r.observationIds).toEqual(['a','b']);expect(r.aimedContact.x).toBe(.01);expect(r.aimedContact.y).toBe(1.02);expect(r.contactTick).toBeLessThan(r.plateTick);
});
it('V236 missing delivery is NO_TARGET, invalid source or altered forecast is rejected',()=>{
 expect(resolveLiveObservedSpinTrialV236({request,snapshot:null,clip,swingOffered:true,battingMode:'balanced'}).status).toBe('NO_TARGET');
 expect(()=>resolveLiveObservedSpinTrialV236({request:{...request,delta:{x:NaN,y:0}},snapshot,clip,swingOffered:true,battingMode:'balanced'})).toThrow();
 expect(()=>resolveLiveObservedSpinTrialV236({request,snapshot:{...snapshot,forecast:{...snapshot.forecast,cutoffTick:1}},clip,swingOffered:true,battingMode:'balanced'})).toThrow();
});
import { existsSync,readFileSync } from 'node:fs';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { AUTHORED_LIVE_BATTER_OBSERVATION_V151 } from './LiveBatterObservationV151';
import { AUTHORED_OBSERVED_DIRECTION_MOTOR_V153 } from './LiveDirectionMotorV153';
import { AUTHORED_PLAY_RANDOMNESS_V152 } from '../../core/rng/LiveRandomStreamsV152';
import { simulateLivePitchV1,type LiveMeasuredClipV1,type LivePitchInputV1 } from './LivePitchV1';
const clips=JSON.parse(readFileSync('docs/demos/measured-bat-motions.json','utf8')).clips as LiveMeasuredClipV1[];
const chosen=clips.find(c=>c.side==='R')!;
const live:LivePitchInputV1={originTick:1000000,seed:31,randomnessV152:AUTHORED_PLAY_RANDOMNESS_V152,batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151,
 batterDirectionMotorV153:AUTHORED_OBSERVED_DIRECTION_MOTOR_V153,battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'v236-test',mode:'CENTER'},
 batter:{heightMeters:1.8,bats:'R',batLengthM:.84,batMassKg:.88,swingRate:1,timingStdSeconds:.004,aimStdMeters:.004,chaseMarginMeters:.2,clipId:chosen.id,
  maximumSweetSpotSpeedMps:50,motorLatencySeconds:.04,swingDecision:{approach:'SWING',threshold:0,aggressionWeight:1}},
 pitcher:{releaseSpeedMps:42,spinRadPerSecond:{x:230,y:0,z:0},commandStdMeters:0},measuredClips:clips,batting:'balanced',pitchType:'fastball',location:'zone',physics:{kind:'aero_ground_v1',
 air:{ticksPerSecond:1e6,integrationStepTicks:5000,gravityY:-9.81,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},
 ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.2,material:{restitution:.48,slidingFriction:.24,rollingDecelerationMps2:.36,normalSpinDecayPerSecond:.18}}}};
it('V236 four explicit measured-clip trials reach final registration under V153; omission retains legacy fields',()=>{
 const before=structuredClone(live),normal=simulateLivePitchV1(live);expect(live).toEqual(before);expect(normal.diagnostics.observedSpinTrialV236).toBeUndefined();expect(normal.diagnostics.directionMotorV153?.status).toBe('PLANNED');
 const options=[['BACKSPIN',0,.01],['TOPSPIN',0,-.01],['SLICE',.01,0],['HOOK',-.01,0]] as const;
 const results=options.map(([technique,x,y])=>simulateLivePitchV1({...live,observedSpinTrialV236:{version:'live_observed_spin_trial_v236',subjectId:'declared-player',technique,
  clip:{id:chosen.id,sourceSha256:chosen.source.sha256,bats:'R'},domain:{plateZ:normal.diagnostics.battingSetupV94.contactPlaneZ,contactDepthZ:normal.diagnostics.battingSetupV94.contactPlaneZ+.05,coordinateSystem:'LIVE_WORLD_METERS_V1'},delta:{x,y}}}));
 const trials=results.map(r=>r.diagnostics.observedSpinTrialV236!);expect(trials.map(t=>t.status)).toEqual(['APPLIED','APPLIED','APPLIED','APPLIED']);
 for(const [i,t] of trials.entries()){if(t.status!=='APPLIED')throw Error('trial not applied');expect(t.earnedQualification).toBe(false);expect(t.registration?.clipId).toBe(chosen.id);
  expect(t.registration?.sourceSha256).toBe(chosen.source.sha256);expect(t.registration?.lateReaimed).toBe(false);expect(t.registration?.motorDelaySeconds).toBeGreaterThanOrEqual(0);
  expect(results[i].diagnostics.aimErrorMeters).toEqual(normal.diagnostics.aimErrorMeters);}
 expect(new Set(trials.map(t=>t.status==='APPLIED'?JSON.stringify(t.registration?.executedSweetSpot):'none')).size).toBe(4);
 console.log('V236 empirical outcomes',JSON.stringify(results.map((r,i)=>({technique:options[i][0],contact:!!r.contact,exitSpin:r.contact?.exitSpin??null,unsupported:r.diagnostics.unsupportedReason}))));
 expect(trials.every(t=>t.status==='APPLIED'&&t.registration?.executedSweetSpot)).toBe(true);
 for(const r of results)expect(r.diagnostics.batPlaybackV88?.reference.transform.translation).not.toEqual(normal.diagnostics.batPlaybackV88?.reference.transform.translation);
},60000);
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
const preservedBaselineV236='work/v236-live-pitch-baseline-01/worktree.ts';
it.skipIf(!existsSync(preservedBaselineV236))('V236 omitted request preserves baseline full record and sampled bat motion exactly',async()=>{
 const source=readFileSync(preservedBaselineV236,'utf8');
 const bundle=await build({stdin:{contents:source,sourcefile:'v236-old-live-pitch.ts',resolveDir:resolve('src/integration/browser'),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',target:'node22'});
 const old=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64')) as typeof import('./LivePitchV1');
 const a=old.simulateLivePitchV1(live),b=simulateLivePitchV1(live),{sampleBatAtTick:oldSample,...oldRecord}=a,{sampleBatAtTick:newSample,...newRecord}=b;
 expect(newRecord).toEqual(oldRecord);for(const tick of [live.originTick,b.diagnostics.referenceContactTick])expect(newSample(tick)).toEqual(oldSample(tick));
},60000);
it('V236 explicit contact supplies unchanged exit state to existing aerodynamic kernel',()=>{
 const normal=simulateLivePitchV1(live),trial=simulateLivePitchV1({...live,observedSpinTrialV236:{version:'live_observed_spin_trial_v236',subjectId:'declared-player',technique:'TOPSPIN',
 clip:{id:chosen.id,sourceSha256:chosen.source.sha256,bats:'R'},domain:{plateZ:normal.diagnostics.battingSetupV94.contactPlaneZ,contactDepthZ:normal.diagnostics.battingSetupV94.contactPlaneZ+.05,coordinateSystem:'LIVE_WORLD_METERS_V1'},delta:{x:0,y:-.01}}});
 expect(trial.contact).not.toBeNull();if(!trial.contact||!trial.contactMoment)throw Error('no finite trial contact');
 const outgoing={...trial.contactMoment,ball:{...trial.contactMoment.ball,velocity:trial.contact.exitVelocity,spin:trial.contact.exitSpin}},
  kernel=createSourceFreeBallKernel({...trial.diagnostics.sourceDescriptor,initial:outgoing}),start=kernel.evaluateAt(outgoing.elapsedSeconds).moment;
 expect(start.ball.velocity).toEqual(trial.contact.exitVelocity);expect(start.ball.spin).toEqual(trial.contact.exitSpin);expect(kernel.evaluateAt(outgoing.elapsedSeconds+.01).moment.ball.tick).toBeGreaterThan(start.ball.tick);
},60000);
it('V236 refuses unavailable, undelivered, mismatched clip or non-swing without inventing a target',()=>{
 expect(resolveLiveObservedSpinTrialV236({request,snapshot,clip:{...clip,id:'other'},swingOffered:true,battingMode:'balanced'})).toMatchObject({status:'NO_TARGET',reason:'CLIP_MISMATCH'});
 expect(resolveLiveObservedSpinTrialV236({request,snapshot,clip,swingOffered:false,battingMode:'take'})).toMatchObject({status:'NO_TARGET',reason:'NO_SWING'});
 const notArrived={...base,observations:observations.map(o=>({...o,availableTick:200000}))},unavailable={...notArrived,observations:[],forecast:forecastObservedPitchV151(notArrived)};
 expect(resolveLiveObservedSpinTrialV236({request,snapshot:unavailable,clip,swingOffered:true,battingMode:'balanced'})).toMatchObject({status:'NO_TARGET'});
});
it('V236 declared contact-depth changes the final registered depth and contact clock',()=>{
 const normal=simulateLivePitchV1(live),plane=normal.diagnostics.battingSetupV94.contactPlaneZ;
 const run=(depth:number)=>simulateLivePitchV1({...live,observedSpinTrialV236:{version:'live_observed_spin_trial_v236',subjectId:'declared-player',technique:'TOPSPIN',
  clip:{id:chosen.id,sourceSha256:chosen.source.sha256,bats:'R'},domain:{plateZ:plane,contactDepthZ:depth,coordinateSystem:'LIVE_WORLD_METERS_V1'},delta:{x:0,y:-.01}}});
 const first=run(plane+.05).diagnostics.observedSpinTrialV236!,second=run(plane+.08).diagnostics.observedSpinTrialV236!;if(first.status!=='APPLIED'||second.status!=='APPLIED')throw Error('no trial');
 expect(first.contactTick).not.toBe(second.contactTick);expect(first.registration?.executedContactTick).not.toBe(second.registration?.executedContactTick);
 expect(first.registration?.executedSweetSpot.z).not.toBe(second.registration?.executedSweetSpot.z);
},60000);
