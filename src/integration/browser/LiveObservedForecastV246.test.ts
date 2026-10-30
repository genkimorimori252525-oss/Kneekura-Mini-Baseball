import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {simulateLivePitchV1,type LiveMeasuredClipV1,type LivePitchInputV1} from './LivePitchV1';
import type {LiveObservedSpinComposeRequestV238} from './LiveObservedSpinComposeV238';
import {AUTHORED_OBSERVED_DIRECTION_MOTOR_V153} from './LiveDirectionMotorV153';
import {AUTHORED_PLAY_RANDOMNESS_V152,AUTHORED_MATCH_RANDOMNESS_V152} from '../../core/rng/LiveRandomStreamsV152';
import {LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,LIVE_MATCH_PHYSICS_V1} from './LiveBaseballMatchV1';
import {resolveLiveBattingSetupV94} from '../../core/sim/pitching/BattingSetupV94';
import {AUTHORED_BATTER_OBSERVED_REGION_EXPERIENCE_V222} from '../../core/decision/batting/BatterObservedRegionExperienceV222';
import {expect,it} from 'vitest';
import {liveMatchFixture} from './LiveBaseballMatchV1.test-support';
import {createLiveBaseballMatchWorkerV116} from './LiveBaseballMatchV1';
import {AUTHORED_LIVE_BATTER_OBSERVATION_V151} from './LiveBatterObservationV151';
import {forecastObservedPitchV246,type ObservedPitchForecastPolicyV246} from '../../core/decision/batting/ObservedPitchForecastV246';
const policy:ObservedPitchForecastPolicyV246={version:'observed_pitch_forecast_policy_v246',maximumExtrapolationRatio:10,minimumQrDiagonalRatio:1e-10,minimumForwardSpeedMps:1e-6,maximumRootBracketTicks:.01,maximumPlaneResidualMeters:1e-7};
const command={managedTeam:0 as const,pitchType:'auto',location:'auto',batting:'take' as const};
it('delivers explicit V246 while retaining V151 evidence and replay binding',()=>{
 const config={...liveMatchFixture(2468),batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151,batterForecastPolicyV246:policy},host=createLiveBaseballMatchWorkerV116(config),record=host.issuePitch(command),diagnostics=record.play.diagnostics as any;
 expect(diagnostics.batterObservationV151.rawForecast.version).toBe('observed_pitch_forecast_v151');const snapshot=diagnostics.batterObservedForecastV246.snapshot;expect(snapshot.observations).toHaveLength(7);expect(snapshot.result.diagnostics.effectiveModel).toBe('CUBIC_QR_V246');
 expect(snapshot.result).toEqual(forecastObservedPitchV246({originTick:snapshot.originTick,ticksPerSecond:snapshot.ticksPerSecond,cutoffTick:snapshot.cutoffTick,planeZ:snapshot.planeZ,maximumAfterReleaseSeconds:snapshot.maximumAfterReleaseSeconds,observations:snapshot.observations},snapshot.policy));
 const saved=host.captureContinuationV116();expect(saved.batterForecastBindingV246).toBeDefined();expect(createLiveBaseballMatchWorkerV116(config,saved).captureContinuationV116()).toEqual(saved);expect(()=>createLiveBaseballMatchWorkerV116({...config,batterForecastPolicyV246:{...policy,maximumExtrapolationRatio:9}},saved)).toThrow();
},120000);
it('rejects a policy without an observation source or with invalid explicit values',()=>{
 const base=liveMatchFixture(2468);expect(()=>createLiveBaseballMatchWorkerV116({...base,batterForecastPolicyV246:policy})).toThrow();expect(()=>createLiveBaseballMatchWorkerV116({...base,batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151,batterForecastPolicyV246:{...policy,maximumExtrapolationRatio:0}})).toThrow();
});

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

it('keeps normal/trial delivered forecasts identical and preserves the V151 region snapshot',()=>{
 const {pitch,request}=composeFixture('L','CENTER'),base={...pitch,batterForecastPolicyV246:policy,batterObservedRegionExperienceV222:AUTHORED_BATTER_OBSERVED_REGION_EXPERIENCE_V222,practiceSwingDecisionV241:{version:'practice_swing_decision_v241' as const,sourceId:'v246-test',scope:'EXPLICIT_PRACTICE' as const,mode:'SWING' as const}},v244={version:'live_observed_contact_frame_trial_v244' as const,subjectId:request.subjectId,technique:request.technique,clip:request.clip,domain:request.domain,policy:'FIXED_25_UNCALIBRATED_V243' as const,thresholds:{minimumComponent:1e9,minimumImprovement:1e9}};
 const normal=simulateLivePitchV1(base),trial=simulateLivePitchV1({...base,observedSpinTrialV236:v244}),n=normal.diagnostics,t=trial.diagnostics;
 expect(t.observedSpinContactFrameV244).toMatchObject({status:'NO_TARGET'});expect(t.batterObservedForecastV246).toEqual(n.batterObservedForecastV246);expect(t.batterObservedForecastV246!.snapshot.observations).toHaveLength(7);expect(t.batterObservedForecastV246!.snapshot.result.diagnostics.effectiveModel).toBe('CUBIC_QR_V246');expect(t.batterObservationV151!.rawForecast).toEqual(n.batterObservationV151!.rawForecast);expect(t.batterObservedRegionExperienceV222!.snapshot.forecast.version).toBe('observed_pitch_forecast_v151');expect(t.batterObservedRegionExperienceV222!.snapshot.observations).toHaveLength(3);
 const snap=t.batterObservedForecastV246!.snapshot;expect(snap.result).toEqual(forecastObservedPitchV246({originTick:snap.originTick,ticksPerSecond:snap.ticksPerSecond,cutoffTick:snap.cutoffTick,planeZ:snap.planeZ,maximumAfterReleaseSeconds:snap.maximumAfterReleaseSeconds,observations:snap.observations},snap.policy));
 const future={observationId:'future-test',observedTick:snap.cutoffTick+1,availableTick:snap.cutoffTick+1,position:{x:999,y:-999,z:999}};expect(forecastObservedPitchV246({originTick:snap.originTick,ticksPerSecond:snap.ticksPerSecond,cutoffTick:snap.cutoffTick,planeZ:snap.planeZ,maximumAfterReleaseSeconds:snap.maximumAfterReleaseSeconds,observations:[...snap.observations,future]},snap.policy)).toEqual(snap.result);
 expect(t.lateEvidenceV121).toBeDefined();expect(t.lateEvidenceV121!.effectiveForecastV246).toBeDefined();expect(t.lateEvidenceV121!.effectiveForecastV246!.diagnostics.cutoffTick).toBeLessThanOrEqual(t.lateEvidenceV121!.correctionFromTick);expect(t.lateEvidenceV121!.futureSourceUsed).toBe(false);
 const late=t.lateEvidenceV121!.effectiveSnapshotV246!;expect(late.observations.every(o=>o.observedTick<=late.cutoffTick&&o.availableTick<=late.cutoffTick)).toBe(true);expect(late.result).toEqual(forecastObservedPitchV246({originTick:late.originTick,ticksPerSecond:late.ticksPerSecond,cutoffTick:late.cutoffTick,planeZ:late.planeZ,maximumAfterReleaseSeconds:late.maximumAfterReleaseSeconds,observations:late.observations},late.policy));
},120000);
it('retains exact V151 effective forecast when explicit V246 falls back',()=>{
 const {pitch}=composeFixture('L','CENTER'),result=simulateLivePitchV1({...pitch,batterForecastPolicyV246:{...policy,maximumExtrapolationRatio:.01}}),snapshot=result.diagnostics.batterObservedForecastV246!.snapshot;
 expect(snapshot.result.diagnostics.effectiveModel).toBe('V151');expect(snapshot.result.forecast).toEqual(result.diagnostics.batterObservationV151!.rawForecast);
},120000);

it('preserves legacy V151 and V222 memory evidence when V246 is opted in',()=>{
 const base={...liveMatchFixture(2468),batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151,batterObservedRegionExperienceV222:AUTHORED_BATTER_OBSERVED_REGION_EXPERIENCE_V222},legacy=createLiveBaseballMatchWorkerV116(base),experimental=createLiveBaseballMatchWorkerV116({...base,batterForecastPolicyV246:policy});
 const old=legacy.issuePitch(command),next=experimental.issuePitch(command),a=legacy.captureContinuationV116(),b=experimental.captureContinuationV116();expect((old.play.diagnostics as any).batterObservationV151.rawForecast).toEqual((next.play.diagnostics as any).batterObservationV151.rawForecast);expect(a.batterObservedMemoryV151).toEqual(b.batterObservedMemoryV151);expect(a.batterObservedRegionExperienceV222).toEqual(b.batterObservedRegionExperienceV222);expect(a).not.toHaveProperty('batterForecastBindingV246');
},120000);
it('keeps both V244 no-target episodes in the denominator under the same V246 policy',async()=>{
 const {createLiveBattingPracticeV150,resumeLiveBattingPracticeEpisodesV242}=await import('./LiveBattingPracticeV150'),{declareSpinPracticeEpisodesV242}=await import('./LiveSpinPracticeEpisodesV242');
 const base=liveMatchFixture(2468),subjectId=createLiveBaseballMatchWorkerV116(base).inspect().batterPlayerId,player=base.players.find(p=>p.playerId===subjectId)!,clip=base.measuredClips.find(c=>c.side===player.bats)!,physical={...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,clipId:clip.id};
 const configuration={...base,players:base.players.map(p=>p.playerId===subjectId?{...p,physical}:p),batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151,batterForecastPolicyV246:policy},motor={version:'live_contact_frame_motor_v244' as const,motorId:'fixture',motorVersion:'v1',subjectId,technique:'TOPSPIN' as const,clip:{id:clip.id,sourceSha256:clip.source.sha256,bats:player.bats},domain:{plateZ:resolveLiveBattingSetupV94({...physical,heightMeters:player.heightMeters,bats:player.bats}).contactPlaneZ,coordinateSystem:'LIVE_WORLD_METERS_V1' as const},policy:'FIXED_25_UNCALIBRATED_V243' as const,thresholds:{minimumComponent:1,minimumImprovement:1},provenance:{kind:'EXPLICIT_DIAGNOSTIC_UNCALIBRATED' as const,sourceId:'v246-test',sourceVersion:'v1',humanCalibration:'NOT_MEASURED' as const},trainingOpportunities:[]};
 const criterion={version:'live_spin_practice_criterion_v239' as const,authority:'EXPLICIT_UNCALIBRATED_PROJECT' as const,minimumIndependentTrials:2,minimumContactFraction:1,minimumDirectionalSpin:1,minimumDirectionalImprovement:1,minimumSuccessFraction:1,miss:'COUNT_FAILURE' as const,noTarget:'COUNT_FAILURE' as const,unresolved:'HOLD' as const},plan=declareSpinPracticeEpisodesV242({scopeId:'v246-no-target',motor,criterion,episodeSeeds:[2468,2469]}),owner=createLiveBattingPracticeV150(configuration);
 await owner.startEpisodePracticeV242(plan,{batting:'take',practiceSwingDecisionV241:{version:'practice_swing_decision_v241',sourceId:'v246-test',scope:'EXPLICIT_PRACTICE',mode:'TAKE'}});
 for(let episode=0;episode<2;episode++){
  const first=await owner.previewEpisodeStepV242();expect(first.step.kind).toBe('TARGET');const n=first.step.normalRecord!.play.diagnostics as any,t=first.step.trialRecord!.play.diagnostics as any;expect(t.observedSpinContactFrameV244).toMatchObject({status:'NO_TARGET',reason:'NO_SWING'});expect(t.batterObservedForecastV246).toEqual(n.batterObservedForecastV246);await owner.acceptEpisodeStepV242(first);
  for(let i=0;i<20&&owner.inspectEpisodePracticeV242().phase!=='ENDED';i++)await owner.acceptEpisodeStepV242(await owner.previewEpisodeStepV242());expect(owner.inspectEpisodePracticeV242().phase).toBe('ENDED');if(episode===0)owner.advanceEpisodeV242();
 }
 const done=owner.closeEpisodePracticeV242();expect(done.slots).toHaveLength(2);expect(done.evaluation).toMatchObject({status:'UNAVAILABLE',total:2,contacts:0,earnedQualification:false});const capture=owner.capture();expect((await resumeLiveBattingPracticeEpisodesV242(configuration,structuredClone(capture))).capture()).toEqual(capture);
},120000);
const legacyBaselines=[['work/live-forecast-v246-delivery-baseline/LivePitchV1.ts.start','45e87fc71bb23d2ace4e06f63a773a42958e4de01854a26f05648080e9833647'],['work/live-forecast-v246-delivery-baseline/LiveBaseballMatchV1.ts.start','b830a76c807fd270f7d8db284b3393bb99cab48e62be0061dc4daef55321f903'],['work/live-forecast-v246-delivery-baseline/PracticeSwingDecisionV241.ts.start','4be84518daa8d7df6af3b3eeeba06e591835820ba2e029462425e951e048571f'],['work/live-observer-v246-baseline/LiveBatterObservationV151.ts.start','9118220265fdf36a66ac8c9d01a13813a82da75feb14ddc9ca8d845da408e9bf']] as const;
it.runIf(legacyBaselines.every(([path])=>existsSync(path)))('keeps the no-policy record exact against saved pre-change Source (missing private baselines: skipped)',async()=>{
 const {build}=await import('esbuild'),{createRequire}=await import('node:module'),{resolve}=await import('node:path');for(const [path,expected] of legacyBaselines)expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(expected);
 const replacements=new Map([['src/integration/browser/LivePitchV1.ts','work/live-forecast-v246-delivery-baseline/LivePitchV1.ts.start'],['src/integration/browser/LiveBaseballMatchV1.ts','work/live-forecast-v246-delivery-baseline/LiveBaseballMatchV1.ts.start'],['src/integration/browser/PracticeSwingDecisionV241.ts','work/live-forecast-v246-delivery-baseline/PracticeSwingDecisionV241.ts.start'],['src/integration/browser/LiveBatterObservationV151.ts','work/live-observer-v246-baseline/LiveBatterObservationV151.ts.start']].map(([a,b])=>[resolve(a),resolve(b)]));
 for(const path of replacements.values())if(!existsSync(path))throw Error('pre-change Source baseline is required for this local verification');
 const built=await build({absWorkingDir:process.cwd(),entryPoints:['src/integration/browser/LiveBaseballMatchV1.ts'],bundle:true,write:false,platform:'node',format:'cjs',target:'node20',plugins:[{name:'pinned-pre-change-source',setup(builder){builder.onLoad({filter:/\.ts$/},args=>{const baseline=replacements.get(args.path);return baseline?{contents:readFileSync(baseline,'utf8'),loader:'ts'}:null})}}]});
 const module={exports:{} as any};new Function('module','exports','require',built.outputFiles[0].text)(module,module.exports,createRequire(import.meta.url));
 const config={...liveMatchFixture(2468),batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151,batterObservedRegionExperienceV222:AUTHORED_BATTER_OBSERVED_REGION_EXPERIENCE_V222,randomnessV152:AUTHORED_MATCH_RANDOMNESS_V152},old=module.exports.createLiveBaseballMatchWorkerV116(config),current=createLiveBaseballMatchWorkerV116(config),before=old.issuePitch(command),after=current.issuePitch(command);
 // @ts-expect-error Existing verification codec is JavaScript.
 const {stringifyDebugRecord}=await import('../../../tools/verification/live-debug-record.mjs');expect(stringifyDebugRecord(after)).toBe(stringifyDebugRecord(before));expect(stringifyDebugRecord(current.captureContinuationV116())).toBe(stringifyDebugRecord(old.captureContinuationV116()));
},120000);
