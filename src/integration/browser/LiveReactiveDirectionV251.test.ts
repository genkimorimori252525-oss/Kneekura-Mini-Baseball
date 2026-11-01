import {it,expect,vi} from 'vitest';
import * as directionCore from '../../core/sim/contact/ObservedDirectionRegistrationV153';
import * as envelope from './LiveSwingEnvelopeV133';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {createLiveBaseballMatchWorkerV116,LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1} from './LiveBaseballMatchV1';
import {liveMatchFixture} from './LiveBaseballMatchV1.test-support';
import {AUTHORED_LIVE_BATTER_OBSERVATION_V151} from './LiveBatterObservationV151';
import {AUTHORED_OBSERVED_DIRECTION_MOTOR_V153} from './LiveDirectionMotorV153';
import {AUTHORED_MATCH_RANDOMNESS_V152} from '../../core/rng/LiveRandomStreamsV152';
import type {simulateLivePitchV1} from './LivePitchV1';
const diagnostic=(record:{play:{diagnostics:unknown}})=>record.play.diagnostics as ReturnType<typeof simulateLivePitchV1>['diagnostics'];
const policy={version:'observed_reactive_direction_group_policy_v251' as const,sourceId:'TEST_ONLY_NOT_CALIBRATED',weights:{pull:.5,opposite:.5},emptyGroup:'FALLBACK_TO_V161' as const};
const base={...liveMatchFixture(2468),batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151,batterDirectionMotorV153:AUTHORED_OBSERVED_DIRECTION_MOTOR_V153,randomnessV152:AUTHORED_MATCH_RANDOMNESS_V152,batterAutoDirectionPolicyV250:{version:'live_match_auto_direction_policy_v250' as const,sourceId:'test-auto'}};
const config={...base,batterReactiveDirectionPolicyV251:policy};
const command={managedTeam:0 as const,batting:'balanced' as const,pitchType:'auto',location:'auto'};
const swing={version:'practice_swing_decision_v241' as const,sourceId:'TEST_ONLY',scope:'EXPLICIT_PRACTICE' as const,mode:'SWING' as const};
const stream=(d:ReturnType<typeof simulateLivePitchV1>['diagnostics'])=>d.randomnessV152?.streams.find(s=>s.domain==='batterDirection'&&s.key==='reactive-group-v251');
it('binds policy to continuation, checks prerequisites and rejects mixed V248',()=>{
 const host=createLiveBaseballMatchWorkerV116(config),capture=host.captureContinuationV116(),legacy=createLiveBaseballMatchWorkerV116(base).captureContinuationV116();expect(capture.batterReactiveDirectionBindingV251).toBeDefined();expect(createLiveBaseballMatchWorkerV116(config,capture).captureContinuationV116()).toEqual(capture);
 expect(()=>createLiveBaseballMatchWorkerV116(config,legacy)).toThrow();expect(()=>createLiveBaseballMatchWorkerV116(base,capture)).toThrow();expect(()=>createLiveBaseballMatchWorkerV116({...config,batterReactiveDirectionPolicyV251:{...policy,weights:{pull:.4,opposite:.6}}},capture)).toThrow();expect(()=>createLiveBaseballMatchWorkerV116({...config,randomnessV152:undefined})).toThrow();expect(()=>createLiveBaseballMatchWorkerV116({...config,batterObservationV151:undefined})).toThrow();expect(()=>createLiveBaseballMatchWorkerV116({...config,batterDirectionMotorV153:undefined})).toThrow();
 const clip=config.measuredClips.find(c=>c.side==='L')!;expect(()=>host.issuePitch({...command,observedSpinTrialV236:{version:'live_observed_robust_contact_frame_trial_v248',subjectId:'0-b0',technique:'HOOK',clip:{id:clip.id,sourceSha256:clip.source.sha256,bats:'L'},domain:{plateZ:.15,coordinateSystem:'LIVE_WORLD_METERS_V1'},policy:'finite_sigma_v247',thresholds:{minimumComponent:1,minimumImprovement:1},maximumEvaluations:259,maximumSearchSamples:259*4096}})).toThrow(/cannot be combined/);
});
it('does not draw for TAKE or a managed explicit direction',()=>{
 const host=createLiveBaseballMatchWorkerV116(config),take=host.issuePitch({...command,batting:'take'});expect(stream(diagnostic(take))).toBeUndefined();
 const explicit=host.issuePitch({...command,batting:'take',battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'manager',mode:'PULL'}});expect(stream(diagnostic(explicit))).toBeUndefined();
},120000);
it('does not draw for BUNT, explicit PULL with SWING, or insufficient delivered observations',()=>{
 const bunt=createLiveBaseballMatchWorkerV116(config).issuePitch({...command,batting:'bunt'});expect(stream(diagnostic(bunt))).toBeUndefined();
 const aimed=createLiveBaseballMatchWorkerV116(config).issuePitch({...command,practiceSwingDecisionV241:swing,battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'manager',mode:'PULL'}});expect(diagnostic(aimed).battingDirectionV149?.owner).toBe('TEMPORARY_REQUEST');expect(stream(diagnostic(aimed))).toBeUndefined();
 const insufficient={...config,batterObservationV151:{...AUTHORED_LIVE_BATTER_OBSERVATION_V151,decisionAfterReleaseTicks:1}},record=createLiveBaseballMatchWorkerV116(insufficient).issuePitch({...command,practiceSwingDecisionV241:swing});expect(stream(diagnostic(record))).toBeUndefined();
},120000);
it('draws once for eligible reactive planning and resumes the same fixed result',()=>{
 const original=envelope.selectLiveSwingEnvelopeRateV133,rateProbe=vi.spyOn(envelope,'selectLiveSwingEnvelopeRateV133').mockImplementation((rate,feasible)=>{feasible(rate*.95);return original(rate,feasible)}),spy=vi.spyOn(directionCore,'planObservedReactiveDirectionLotteryV251');try{const host=createLiveBaseballMatchWorkerV116(config),saved=host.captureContinuationV116(),resumed=createLiveBaseballMatchWorkerV116(config,saved),a=host.issuePitch({...command,practiceSwingDecisionV241:swing}),firstDraws=spy.mock.calls.map(args=>args[0].draw),b=resumed.issuePitch({...command,practiceSwingDecisionV241:swing}),d=diagnostic(a);
 expect(firstDraws.length).toBeGreaterThan(1);expect(new Set(firstDraws).size).toBe(1);expect(stream(d)?.drawCount).toBe(1);expect(d.directionMotorV153?.nominalPlan).toMatchObject({version:'observed_reactive_direction_group_result_v251'});expect(a).toEqual(b);expect(host.captureContinuationV116()).toEqual(resumed.captureContinuationV116());}finally{spy.mockRestore();rateProbe.mockRestore();}
},120000);
it('does not draw for authored personal direction',()=>{
 const approach={version:'batter_approach_v122' as const,sourceId:'TEST_ONLY',priorReliance:0,directionCommitment:1,twoStrikeCommitmentDelta:0,preferredWhenCommitted:{pull:1,center:0,opposite:0},targetPullAnglesDegrees:{pull:20,center:0,opposite:-20}},local={...config,players:config.players.map(p=>p.playerId==='0-b0'?{...p,physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,batterApproachV122:approach}}:p)},record=createLiveBaseballMatchWorkerV116(local).issuePitch({...command,practiceSwingDecisionV241:swing});expect(diagnostic(record).battingDirectionV149?.owner).toBe('PERSONAL_APPROACH');expect(stream(diagnostic(record))).toBeUndefined();
},120000);
it('does not draw when the existing authored spin motor owns registration',()=>{
 const clip=config.measuredClips.find(c=>c.side==='L')!,profile={version:'live_spin_control_v123' as const,boundary:'LOCAL_AUTHORING_ONLY' as const,sourceId:'TEST_ONLY',sourceVersion:'v1',preferredIntent:'BACKSPIN' as const,techniques:[{technique:'BACKSPIN' as const,sourceId:'TEST_ONLY',sourceEffectIdentity:'TEST_ONLY',learnedStatus:'CONSOLIDATED' as const,calibration:{sourceId:'TEST_ONLY',sourceVersion:'v1',status:'MODEL_VERIFIED' as const},clip:{id:clip.id,sourceSha256:clip.source.sha256,bats:'L' as const},motion:{attackAngleDegrees:0,pullAngleDeltaDegrees:0,contactOffsetMeters:{pull:0,up:0,depth:0}},conditions:{minimumInsideNormalized:-3,maximumInsideNormalized:3,minimumHeightNormalized:-3,maximumHeightNormalized:3,minimumAvailableSeconds:0}}]};
 const local={...config,players:config.players.map(p=>p.playerId==='0-b0'?{...p,physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,clipId:clip.id,spinControlV123:profile}}:p)},record=createLiveBaseballMatchWorkerV116(local).issuePitch({...command,practiceSwingDecisionV241:swing}),d=diagnostic(record);
 expect(d.spinIntentV123?.selectedIntent).toBe('BACKSPIN');expect(d.directionMotorV153).toMatchObject({status:'NOT_APPLIED',reason:'QUALIFIED_SPIN_MOTOR_OWNS_REGISTRATION'});expect(stream(d)).toBeUndefined();
},120000);
it('honors authored sector and reaches independent reactive selection on the other team',()=>{
 const profile={version:'batter_course_profile_v79' as const,referenceAverages:Array(63).fill(.25),effectScale:1,directionWeights:[0,0,1,0,0]},local={...config,players:config.players.map(p=>p.playerId==='0-b0'?{...p,physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,batterCourseProfileV79:profile}}:p)},sector=createLiveBaseballMatchWorkerV116(local).issuePitch({...command,practiceSwingDecisionV241:swing});expect(diagnostic(sector).battingDirectionV149?.owner).toBe('LEGACY_DIRECTION_DISTRIBUTION');expect(stream(diagnostic(sector))).toBeUndefined();
 const host=createLiveBaseballMatchWorkerV116(config);for(let i=0;i<80&&host.inspect().match.half==='top';i++)host.issuePitch({...command,batting:'take'});expect(host.inspect().match.half).toBe('bottom');const saved=host.captureContinuationV116(),resumed=createLiveBaseballMatchWorkerV116(config,saved),operation={...command,managedTeam:1 as const,practiceSwingDecisionV241:swing},a=host.issuePitch(operation),b=resumed.issuePitch(operation);expect(stream(diagnostic(a))?.drawCount).toBe(1);expect(a).toEqual(b);expect(host.captureContinuationV116()).toEqual(resumed.captureContinuationV116());
},180000);
it('keeps other domain stream identities and draws unchanged for a fixed first pitch',()=>{
 const normal=createLiveBaseballMatchWorkerV116(base).issuePitch({...command,practiceSwingDecisionV241:swing}),experimental=createLiveBaseballMatchWorkerV116(config).issuePitch({...command,practiceSwingDecisionV241:swing}),a=diagnostic(normal).randomnessV152!,b=diagnostic(experimental).randomnessV152!;
 expect(b.streams.filter(s=>s.key!=='reactive-group-v251')).toEqual(a.streams);expect(stream(diagnostic(normal))).toBeUndefined();expect(stream(diagnostic(experimental))?.drawCount).toBe(1);
},120000);
it.runIf(existsSync('work/reactive-direction-v251-live-baseline-01/Host.start'))('keeps omitted policy full record and continuation exact against all three prior Sources',async()=>{
 const files=[['src/integration/browser/LivePitchV1.ts','LivePitch','e19c34951a0752b0cbb0599dd532dbadbab8d6236d43fa17da04cc1ebd9892a7'],['src/integration/browser/LiveBaseballMatchV1.ts','Host','066e26250b27955ab56e48b2caf843e36197145e6f621fd0a634d0203353178c'],['src/core/sim/contact/ObservedDirectionRegistrationV153.ts','Core','9c6cc6eb1f89b5fae93d72c48416b21cafc20c4670ec94a8420b67c99ede62a3']] as const,replacements=new Map<string,string>();
 for(const [path,name,hash]of files){const bytes=readFileSync('work/reactive-direction-v251-live-baseline-01/'+name+'.start');expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash);replacements.set(resolve(path),bytes.toString('utf8'));}
 const built=await build({entryPoints:['src/integration/browser/LiveBaseballMatchV1.ts'],absWorkingDir:process.cwd(),bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'old-pinned-sources',setup(b){b.onLoad({filter:/\.ts$/},args=>{const source=replacements.get(args.path);return source===undefined?null:{contents:source,loader:'ts'}})}}]});const module={exports:{} as {createLiveBaseballMatchWorkerV116:typeof createLiveBaseballMatchWorkerV116}};new Function('module','exports','require',built.outputFiles[0].text)(module,module.exports,createRequire(import.meta.url));
 // @ts-expect-error Existing verification codec is JavaScript.
 const {stringifyDebugRecord}=await import('../../../tools/verification/live-debug-record.mjs');const old=module.exports.createLiveBaseballMatchWorkerV116(base),next=createLiveBaseballMatchWorkerV116(base),operation={...command,practiceSwingDecisionV241:swing};expect(stringifyDebugRecord(old.issuePitch(operation))).toBe(stringifyDebugRecord(next.issuePitch(operation)));expect(stringifyDebugRecord(old.captureContinuationV116())).toBe(stringifyDebugRecord(next.captureContinuationV116()));
},120000);
