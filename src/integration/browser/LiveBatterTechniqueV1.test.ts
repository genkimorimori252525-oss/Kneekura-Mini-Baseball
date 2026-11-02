import {readFileSync} from 'node:fs';
import {afterEach,expect,it,vi} from 'vitest';
import * as techniqueOwner from '../../core/decision/batting/BatterContactTechniqueV1';
import * as contactFrameOwner from '../../core/decision/batting/ObservedContactFrameRegistrationV243';
import * as observerOwner from './LiveBatterObservationV151';
import * as directionOwner from './LiveDirectionMotorV153';
import * as envelopeOwner from './LiveSwingEnvelopeV133';
import {createEmptyBatterObservedMemoryV151} from '../../core/decision/batting/BatterObservedMemoryV151';
import {AUTHORED_MATCH_RANDOMNESS_V152,AUTHORED_PLAY_RANDOMNESS_V152} from '../../core/rng/LiveRandomStreamsV152';
import {resolveLiveBattingSetupV94} from '../../core/sim/pitching/BattingSetupV94';
import {createLiveBaseballMatchWorkerV116,LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,LIVE_MATCH_PHYSICS_V1,type LiveMatchInputV1} from './LiveBaseballMatchV1';
import {liveMatchFixture} from './LiveBaseballMatchV1.test-support';
import {AUTHORED_LIVE_BATTER_OBSERVATION_V151} from './LiveBatterObservationV151';
import {AUTHORED_OBSERVED_DIRECTION_MOTOR_V153} from './LiveDirectionMotorV153';
import {simulateLivePitchV1,type LiveMeasuredClipV1,type LivePitchInputV1} from './LivePitchV1';
import {selectLiveSpinIntentOrNoneV123} from './LiveSpinControlV123';
afterEach(()=>vi.restoreAllMocks());
const catalog=JSON.parse(readFileSync('docs/demos/measured-bat-motions.json','utf8')).clips as LiveMeasuredClipV1[];
const policy=(minimum=1)=>({version:'batter_technique_policy_v1' as const,sourceId:'test-technique',thresholds:{minimumComponent:minimum,minimumImprovement:minimum}});
function pitchFixture(bats:'R'|'L'='L'):LivePitchInputV1{
 const chosen=catalog.find(c=>c.side===bats)!,batter={...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,heightMeters:1.8,bats,clipId:chosen.id,maximumSweetSpotSpeedMps:50,targetSweetSpotSpeedMps:30,motorLatencySeconds:.04,timingStdSeconds:.004,aimStdMeters:.004,plateVision:85,zoneJudgmentStdMeters:.02,swingDecision:{approach:'SWING' as const,threshold:0,aggressionWeight:1}};
 return {originTick:1000000,seed:31,randomnessV152:AUTHORED_PLAY_RANDOMNESS_V152,batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151,batterDirectionMotorV153:AUTHORED_OBSERVED_DIRECTION_MOTOR_V153,battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'test-direction',mode:'AUTO'},
  batterObservedMemoryV151:{memory:createEmptyBatterObservedMemoryV151({observerPlayerId:'b',pitcherId:'p'}),observerPlayerId:'b',pitcherId:'p'},pitchSituationV111:{balls:1,strikes:1,outs:0,occupiedBases:{first:false,second:false,third:false}},
  batter,pitcher:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,commandStdMeters:0},measuredClips:catalog,batting:'balanced',pitchType:'fastball',location:'zone',physics:LIVE_MATCH_PHYSICS_V1};
}
const force=(technique:'SLICE'|'HOOK'|'BACKSPIN'|'TOPSPIN')=>vi.spyOn(techniqueOwner,'selectBatterContactTechniqueV1').mockReturnValue({version:'batter_technique_selection_v1',technique,reason:'INSIDE_PULL',willingness:1,draw:0});
/** Everything the swing and ball did, without the record of having chosen. */
function physical(run:ReturnType<typeof simulateLivePitchV1>){const {sampleBatAtTick:_s,diagnostics,...rest}=run,{batterTechniqueV1:_t,randomnessV152:_r,...kept}=diagnostics;return {...rest,diagnostics:kept};}
const technique=(run:ReturnType<typeof simulateLivePitchV1>)=>run.diagnostics.batterTechniqueV1!;

it('a selected technique that plans nothing leaves the whole pitch exact',()=>{
 force('SLICE');const pitch=pitchFixture(),normal=simulateLivePitchV1(pitch),tried=simulateLivePitchV1({...pitch,batterTechniqueV1:policy(1e9)});
 expect(technique(tried)).toMatchObject({technique:'SLICE',planStatus:'FELL_BACK',planReason:'NO_CANDIDATE_MEETS_DECLARED_THRESHOLDS'});expect(physical(tried)).toEqual(physical(normal));expect(tried.diagnostics).not.toHaveProperty('observedSpinContactFrameV244');
 expect(normal.diagnostics).not.toHaveProperty('batterTechniqueV1');expect(normal.diagnostics.randomnessV152!.streams.some(s=>s.key==='contact-technique-v1')).toBe(false);
},120000);
it('a planned technique only translates the bat reference and leaves clock and errors alone',()=>{
 force('SLICE');const pitch=pitchFixture(),normal=simulateLivePitchV1(pitch),tried=simulateLivePitchV1({...pitch,batterTechniqueV1:policy()}),d=technique(tried);
 expect(d).toMatchObject({technique:'SLICE',planStatus:'PLANNED',planReason:'EXPLICIT_UNCALIBRATED_PREDICTION',actualFutureUsed:false,postContactResultOverride:false});
 const a=tried.diagnostics.batPlaybackV88!.reference.transform.translation,n=normal.diagnostics.batPlaybackV88!.reference.transform.translation;for(const k of ['x','y','z'] as const)expect(a[k]-n[k]).toBeCloseTo(d.selectedDelta![k],12);
 expect(Math.hypot(d.selectedDelta!.x,d.selectedDelta!.y,d.selectedDelta!.z)).toBeGreaterThan(0);expect(d.plannedImprovement!).toBeGreaterThanOrEqual(1);
 for(const key of ['timingErrorSeconds','aimErrorMeters','referenceContactTick','sweetSpotT','measuredClipId'] as const)expect(tried.diagnostics[key]).toEqual(normal.diagnostics[key]);
 expect(tried.frames[0].ball).toEqual(normal.frames[0].ball);expect(tried.pitchType).toBe(normal.pitchType);
 if(tried.contact)expect(d.battedSpin).not.toBeNull();else expect(d.battedSpin).toBeNull();
},120000);
it('the real selector sees only perceived, pre-contact input and its stream shifts no other draw',()=>{
 const spy=vi.spyOn(techniqueOwner,'selectBatterContactTechniqueV1'),pitch=pitchFixture(),tried=simulateLivePitchV1({...pitch,batterTechniqueV1:policy(1e9)}),seen=spy.mock.calls[0][0];
 expect(spy).toHaveBeenCalledTimes(1);expect(seen.perceived).toEqual({x:tried.diagnostics.zoneJudgment.estimatedPosition.x,y:tried.diagnostics.zoneJudgment.estimatedPosition.y});expect(seen).not.toHaveProperty('contact');
 const streams=tried.diagnostics.randomnessV152!.streams,normal=simulateLivePitchV1(pitch).diagnostics.randomnessV152!.streams;expect(streams.filter(s=>s.key!=='contact-technique-v1')).toEqual(normal);expect(streams.find(s=>s.key==='contact-technique-v1')).toMatchObject({domain:'batterApproach'});
},120000);
it('no swing, no choice: a take or bunt never reaches the selector',()=>{
 const spy=vi.spyOn(techniqueOwner,'selectBatterContactTechniqueV1'),pitch=pitchFixture(),take=simulateLivePitchV1({...pitch,batting:'take',batterTechniqueV1:policy()});
 expect(spy).not.toHaveBeenCalled();expect(technique(take)).toMatchObject({technique:null,selectionReason:'NO_SWING',planStatus:'NOT_TRIED'});
},120000);
it('a thrown planner falls back to the normal swing here, and still throws for a managed trial',()=>{
 const pitch=pitchFixture(),normal=simulateLivePitchV1(pitch),clip=catalog.find(c=>c.side==='L')!;force('HOOK');vi.spyOn(contactFrameOwner,'planObservedContactFrameRegistrationV243').mockImplementation(()=>{throw Error('planner broke');});
 const tried=simulateLivePitchV1({...pitch,batterTechniqueV1:policy()});expect(technique(tried)).toMatchObject({technique:'HOOK',planStatus:'FELL_BACK',planReason:'PLANNER_FAILED'});expect(physical(tried)).toEqual(physical(normal));
 expect(()=>simulateLivePitchV1({...pitch,observedSpinTrialV236:{version:'live_observed_contact_frame_trial_v244',subjectId:'b',technique:'HOOK',clip:{id:clip.id,sourceSha256:clip.source.sha256,bats:'L'},domain:{plateZ:resolveLiveBattingSetupV94(pitch.batter).contactPlaneZ,coordinateSystem:'LIVE_WORLD_METERS_V1'},policy:'FIXED_25_UNCALIBRATED_V243',thresholds:{minimumComponent:1,minimumImprovement:1}}})).toThrow(/planner broke/);
},120000);
it('a broken frozen forecast falls back instead of stopping the match',()=>{
 const pitch=pitchFixture(),normal=simulateLivePitchV1(pitch),original=observerOwner.createLiveBatterPositionObserverV151;force('TOPSPIN');
 vi.spyOn(observerOwner,'createLiveBatterPositionObserverV151').mockImplementation((...args)=>{const observer=original(...args);return {...observer,...(observer.snapshotAt?{snapshotAt:(tick:number)=>{const s=observer.snapshotAt!(tick);return s&&{...s,cutoffTick:s.cutoffTick+1};}}:{})} as typeof observer;});
 const tried=simulateLivePitchV1({...pitch,batterTechniqueV1:policy()});expect(technique(tried)).toMatchObject({planStatus:'FELL_BACK',planReason:'PRECHECK_FAILED'});expect(physical(tried)).toEqual(physical(normal));
},120000);
it('a planned offset the motor rejects drops back to the normal swing of the same pitch',()=>{
 const pitch=pitchFixture(),normal=simulateLivePitchV1(pitch),original=directionOwner.limitDirectionExecutionV153;let calls=0;force('BACKSPIN');
 vi.spyOn(directionOwner,'limitDirectionExecutionV153').mockImplementation((...args)=>{if(++calls===1)throw Error('motor rejected');return original(...args);});
 const tried=simulateLivePitchV1({...pitch,batterTechniqueV1:policy()});expect(calls).toBeGreaterThan(1);expect(technique(tried)).toMatchObject({technique:'BACKSPIN',planStatus:'FELL_BACK',planReason:'EXECUTION_REJECTED'});expect(physical(tried)).toEqual(physical(normal));
},120000);
it('the partial motion fallback stays available to a technique swing and owns it',()=>{
 const pitch={...pitchFixture(),partialReferenceFallbackV1:'partial_reference_fallback_v1'} as LivePitchInputV1;force('SLICE');vi.spyOn(envelopeOwner,'selectLiveSwingEnvelopeRateV133').mockReturnValue(null);
 const tried=simulateLivePitchV1({...pitch,batterTechniqueV1:policy()});expect(tried.diagnostics.partialFallbackV1).toBeDefined();expect(technique(tried)).toMatchObject({planStatus:'FELL_BACK',planReason:'PARTIAL_REFERENCE_FALLBACK',selectedDelta:null});
},120000);
it('an undecidable spin intent is no intent in a match',()=>{expect(selectLiveSpinIntentOrNoneV123({} as Parameters<typeof selectLiveSpinIntentOrNoneV123>[0])).toBe(null);});

function matchFixture():LiveMatchInputV1{return {...liveMatchFixture(18739),batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151,batterDirectionMotorV153:AUTHORED_OBSERVED_DIRECTION_MOTOR_V153,randomnessV152:AUTHORED_MATCH_RANDOMNESS_V152,batterAutoDirectionPolicyV250:{version:'live_match_auto_direction_policy_v250',sourceId:'test-auto'}};}
const command={managedTeam:0 as const,batting:'auto' as const,pitchType:'auto',location:'auto'};
it('binds the policy through match config and continuation, and is absent without it',()=>{
 const base=matchFixture(),config={...base,batterTechniqueV1:policy()},old=createLiveBaseballMatchWorkerV116(base).captureContinuationV116(),saved=createLiveBaseballMatchWorkerV116(config).captureContinuationV116();
 expect(old).not.toHaveProperty('batterTechniqueBindingV1');expect(saved).toHaveProperty('batterTechniqueBindingV1');
 expect(()=>createLiveBaseballMatchWorkerV116(config,old)).toThrow(/technique/);expect(()=>createLiveBaseballMatchWorkerV116(base,saved)).toThrow(/technique/);expect(()=>createLiveBaseballMatchWorkerV116({...base,batterTechniqueV1:policy(2)},saved)).toThrow(/technique/);
 const {batterDirectionMotorV153:_motor,batterAutoDirectionPolicyV250:_auto,...noMotor}=config;expect(()=>createLiveBaseballMatchWorkerV116(noMotor)).toThrow(/technique/);expect(()=>createLiveBaseballMatchWorkerV116({...base,batterTechniqueV1:{...policy(),extra:1}} as LiveMatchInputV1)).toThrow(/invalid policy/);
},120000);
it('reaches an ordinary match pitch, reports it in play diagnostics and resumes to the same record',()=>{
 const config={...matchFixture(),batterTechniqueV1:policy()},host=createLiveBaseballMatchWorkerV116(config),saved=host.captureContinuationV116(),first=host.issuePitch(command),again=createLiveBaseballMatchWorkerV116(config,saved).issuePitch(command);
 const d=(first.play.diagnostics as {batterTechniqueV1:{version:string;policySourceId:string}}).batterTechniqueV1;expect(d).toMatchObject({version:'batter_technique_diagnostic_v1',policySourceId:'test-technique'});expect(JSON.stringify(again.play.diagnostics)).toBe(JSON.stringify(first.play.diagnostics));
},120000);
it('a managed trial owns its pitch: the match policy is not passed to it',()=>{
 const config={...matchFixture(),batterTechniqueV1:policy()},host=createLiveBaseballMatchWorkerV116(config),state=host.inspect(),player=config.players.find(p=>p.playerId===state.batterPlayerId)!,clip=config.measuredClips.find(c=>c.side===player.bats)!;
 const record=host.issuePitch({...command,observedSpinTrialV236:{version:'live_observed_contact_frame_trial_v244',subjectId:state.batterPlayerId,technique:'SLICE',clip:{id:clip.id,sourceSha256:clip.source.sha256,bats:player.bats},domain:{plateZ:.15,coordinateSystem:'LIVE_WORLD_METERS_V1'},policy:'FIXED_25_UNCALIBRATED_V243',thresholds:{minimumComponent:1,minimumImprovement:1}}});
 expect(record.play.diagnostics).not.toHaveProperty('batterTechniqueV1');
},120000);
