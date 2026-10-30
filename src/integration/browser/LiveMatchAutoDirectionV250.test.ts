import {it,expect} from 'vitest';
import {createLiveBaseballMatchWorkerV116} from './LiveBaseballMatchV1';
import {LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1} from './LiveBaseballMatchV1';
import {liveMatchFixture} from './LiveBaseballMatchV1.test-support';
import {AUTHORED_LIVE_BATTER_OBSERVATION_V151} from './LiveBatterObservationV151';
import {AUTHORED_OBSERVED_DIRECTION_MOTOR_V153} from './LiveDirectionMotorV153';
import {AUTHORED_MATCH_RANDOMNESS_V152} from '../../core/rng/LiveRandomStreamsV152';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import type {simulateLivePitchV1} from './LivePitchV1';
const diagnostics=(record:{play:{diagnostics:unknown}})=>record.play.diagnostics as ReturnType<typeof simulateLivePitchV1>['diagnostics'];
const policy={version:'live_match_auto_direction_policy_v250' as const,sourceId:'explicit-match-auto-test'};
const base={...liveMatchFixture(2468),batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151,batterDirectionMotorV153:AUTHORED_OBSERVED_DIRECTION_MOTOR_V153,randomnessV152:AUTHORED_MATCH_RANDOMNESS_V152};
const config={...base,batterAutoDirectionPolicyV250:policy};
const command={managedTeam:0 as const,batting:'take' as const,pitchType:'auto',location:'auto'};
const direction=(mode:'AUTO'|'PULL',sourceId='manager')=>({version:'batting_direction_request_v149' as const,sourceId,mode});
it('binds explicit policy, rejects resume drift, and keeps old omission shape',()=>{
 const old=createLiveBaseballMatchWorkerV116(base),oldCapture=old.captureContinuationV116(),active=createLiveBaseballMatchWorkerV116(config),capture=active.captureContinuationV116();
 expect(oldCapture).not.toHaveProperty('batterAutoDirectionBindingV250');expect(capture).toHaveProperty('batterAutoDirectionBindingV250');expect(createLiveBaseballMatchWorkerV116(config,capture).captureContinuationV116()).toEqual(capture);
 expect(()=>createLiveBaseballMatchWorkerV116(config,oldCapture)).toThrow();expect(()=>createLiveBaseballMatchWorkerV116(base,capture)).toThrow();expect(()=>createLiveBaseballMatchWorkerV116({...config,batterAutoDirectionPolicyV250:{...policy,sourceId:'other'}},capture)).toThrow();
 expect(()=>createLiveBaseballMatchWorkerV116({...config,batterObservationV151:undefined})).toThrow();expect(()=>createLiveBaseballMatchWorkerV116({...config,batterDirectionMotorV153:undefined})).toThrow();
 expect(()=>createLiveBaseballMatchWorkerV116({...config,batterAutoDirectionPolicyV250:{...policy,sourceId:' '}})).toThrow();expect(()=>createLiveBaseballMatchWorkerV116({...config,batterAutoDirectionPolicyV250:{...policy,extra:true} as typeof policy})).toThrow();
});
it('uses effective AUTO without changing command and honors managed explicit source',()=>{
 const host=createLiveBaseballMatchWorkerV116(config),original=structuredClone(command),first=host.issuePitch(command),a=diagnostics(first).battingDirectionV149;
 expect(command).toEqual(original);expect(first.command).toEqual(original);expect(a).toMatchObject({mode:'AUTO',requestSourceId:policy.sourceId});expect(diagnostics(first).directionMotorV153?.status).not.toBe('PLANNED');
 expect(a?.owner).toBe('OBSERVATION_RESPONSE');expect(a?.direction.kind).toBe('REACTIVE');
 const before=host.captureContinuationV116(),resumed=createLiveBaseballMatchWorkerV116(config,before),explicit={...command,battingDirectionRequestV149:direction('PULL')},second=host.issuePitch(explicit),replayed=resumed.issuePitch(explicit);
 expect(second).toEqual(replayed);expect(host.captureContinuationV116()).toEqual(resumed.captureContinuationV116());expect(second.command).toEqual(explicit);expect(diagnostics(second).battingDirectionV149).toMatchObject({mode:'PULL',requestSourceId:'manager'});
},120000);
it('preserves authored personal direction ahead of AUTO fallback',()=>{
 const profile={version:'batter_approach_v122' as const,sourceId:'fixed-authored-fixture',priorReliance:0,directionCommitment:1,twoStrikeCommitmentDelta:0,preferredWhenCommitted:{pull:1,center:0,opposite:0},targetPullAnglesDegrees:{pull:20,center:0,opposite:-20}};
 const local={...config,players:config.players.map(p=>p.playerId==='0-b0'?{...p,physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,batterApproachV122:profile}}:p)},record=createLiveBaseballMatchWorkerV116(local).issuePitch(command);
 expect(diagnostics(record).battingDirectionV149).toMatchObject({mode:'AUTO',owner:'PERSONAL_APPROACH',direction:{kind:'AIMED',aim:'PULL'}});
},120000);
it('preserves the authored five-sector direction when no personal approach exists',()=>{
 const profile={version:'batter_course_profile_v79' as const,referenceAverages:Array(63).fill(.25),effectScale:1,directionWeights:[0,0,1,0,0]};
 const local={...config,players:config.players.map(p=>p.playerId==='0-b0'?{...p,physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,batterCourseProfileV79:profile}}:p)};
 const record=createLiveBaseballMatchWorkerV116(local).issuePitch({...command,batting:'balanced',practiceSwingDecisionV241:{version:'practice_swing_decision_v241',sourceId:'fixed-fixture',scope:'EXPLICIT_PRACTICE',mode:'SWING'}});
 expect(diagnostics(record).battingDirectionV149).toMatchObject({mode:'AUTO',owner:'LEGACY_DIRECTION_DISTRIBUTION',direction:{kind:'LEGACY_SECTOR'}});
},120000);
it('uses AUTO on each side while never transferring the opposing manager direction',()=>{
 const host=createLiveBaseballMatchWorkerV116(config);let first=host.issuePitch({...command,managedTeam:1,battingDirectionRequestV149:direction('PULL','opponent')});
 expect(diagnostics(first).battingDirectionV149).toMatchObject({mode:'AUTO',requestSourceId:policy.sourceId});
 for(let i=0;i<80&&host.inspect().match.half==='top';i++)host.issuePitch(command);
 expect(host.inspect().match.half).toBe('bottom');const saved=host.captureContinuationV116(),resumed=createLiveBaseballMatchWorkerV116(config,saved);
 const opponent={...command,managedTeam:0 as const,battingDirectionRequestV149:direction('PULL','opponent')},bottom=host.issuePitch(opponent),replayed=resumed.issuePitch(opponent);
 expect(diagnostics(bottom).battingDirectionV149).toMatchObject({mode:'AUTO',requestSourceId:policy.sourceId});expect(bottom.command).toEqual(opponent);expect(bottom).toEqual(replayed);expect(host.captureContinuationV116()).toEqual(resumed.captureContinuationV116());
 const explicit={...command,managedTeam:1 as const,battingDirectionRequestV149:direction('AUTO','bottom-manager')};first=host.issuePitch(explicit);expect(diagnostics(first).battingDirectionV149).toMatchObject({mode:'AUTO',requestSourceId:'bottom-manager'});expect(first.command).toEqual(explicit);
},180000);
it('keeps explicit bunt in the existing bunt path',()=>{
 const host=createLiveBaseballMatchWorkerV116(config),record=host.issuePitch({...command,batting:'bunt'});expect(diagnostics(record).directionMotorV153?.status).toBe('NOT_APPLIED');expect(['NO_SWING','BUNT_MOTOR']).toContain(diagnostics(record).directionMotorV153?.reason);
},120000);
it.runIf(existsSync('work/match-auto-direction-v250-source-baseline-01/source.start'))('keeps omission records and continuation losslessly identical to prior Host Source',async()=>{
 const original=readFileSync('work/match-auto-direction-v250-source-baseline-01/source.start','utf8');expect(createHash('sha256').update(original).digest('hex')).toBe('8a84cf9fb0934c0aaadcd251095d5db0e8c0ad5c30b135fb3f384aff33ffd681');
 const bundle=await build({entryPoints:['src/integration/browser/LiveBaseballMatchV1.ts'],absWorkingDir:process.cwd(),bundle:true,write:false,platform:'node',format:'cjs',target:'node20',plugins:[{name:'prior-host',setup(b){b.onLoad({filter:/LiveBaseballMatchV1\.ts$/},()=>({contents:original,loader:'ts'}));}}]});const module={exports:{} as any};new Function('module','exports','require',bundle.outputFiles[0].text)(module,module.exports,createRequire(import.meta.url));
 // @ts-expect-error Existing verification codec is JavaScript.
 const {stringifyDebugRecord}=await import('../../../tools/verification/live-debug-record.mjs');const old=module.exports.createLiveBaseballMatchWorkerV116(base),current=createLiveBaseballMatchWorkerV116(base);
 for(let i=0;i<2;i++){expect(stringifyDebugRecord(current.issuePitch(command))).toBe(stringifyDebugRecord(old.issuePitch(command)));expect(stringifyDebugRecord(current.captureContinuationV116())).toBe(stringifyDebugRecord(old.captureContinuationV116()));}
},120000);
it.runIf(existsSync('work/maker-effective-forecast-v246-hook-browser-01/episode-1-step-1.json'))('preserves an explicit spin trial when match AUTO replaces only an omitted direction request',async()=>{
 const bytes=readFileSync('work/maker-effective-forecast-v246-hook-browser-01/episode-1-step-1.json');expect(createHash('sha256').update(bytes).digest('hex')).toBe('fd32dfd3fd70e8536d212bdea5e8dd7fd6dcf6961f1651f1803234d6efff2da7');
 // @ts-expect-error Existing verification codec is JavaScript.
 const {parseDebugRecord,stringifyDebugRecord}=await import('../../../tools/verification/live-debug-record.mjs');const saved=parseDebugRecord(bytes.toString('utf8')),local={...saved.capture.configuration,batterAutoDirectionPolicyV250:policy};
 const {battingDirectionRequestV149:_original,...withoutDirection}=saved.step.trialRecord.command,explicit={...withoutDirection,battingDirectionRequestV149:direction('AUTO',policy.sourceId)},a=createLiveBaseballMatchWorkerV116(local),b=createLiveBaseballMatchWorkerV116(local),one=a.issuePitch(withoutDirection),two=b.issuePitch(explicit),{command:_a,...left}=one,{command:_b,...right}=two;
 expect(one.command).toEqual(withoutDirection);expect(diagnostics(one).observedSpinContactFrameV244?.status).toBe('PLANNED');expect(stringifyDebugRecord(left)).toBe(stringifyDebugRecord(right));expect(stringifyDebugRecord(a.captureContinuationV116())).toBe(stringifyDebugRecord(b.captureContinuationV116()));
},180000);
