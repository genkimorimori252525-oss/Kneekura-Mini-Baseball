import {existsSync} from 'node:fs';
import {expect,it} from 'vitest';
const moduleId='./TerminalContinuationFixtureInputs.test-support';
const api=async()=>{const m=existsSync(new URL('./TerminalContinuationFixtureInputs.test-support.ts',import.meta.url))?await import(/* @vite-ignore */moduleId):{};
 expect(typeof m.materializeContinuationTake,'CONTINUATION_INPUT_API_MISSING').toBe('function');return m as any;};
// Pure structural inputs only. No successful Native reader or original artifact.
const fixture=()=>({recipe:{sourceId:'pitch-0',sourceVersion:'fixture-v1',gameId:'game-1',initialWorldSourceId:'initial-world',
 effortPolicy:{sourceId:'effort',sourceVersion:'fixture-v1',policyId:'effort',version:'v1',availableAtDay:1,effortUnitsPerPhysicalPitch:2},
 request:{workloadRevision:0,policySourceId:'response',delivery:{careerId:'career-a',playerId:'p2',gameDay:10,matchSeed:19,moundReference:{x:0,y:0,z:18},outingId:'outing-1',readyAtUs:0,
 timingIntent:{deliveryMode:'NORMAL',cadenceIntent:'STANDARD'},physics:{velocity:{x:0,y:0,z:-30},spin:{x:0,y:100,z:0}}},flight:{durationUs:1500000,acceleration:{x:0,y:0,z:0}},
 batter:{action:{kind:'take'},plateZ:0,strikeZone:{centerX:0,halfWidth:.2,lowerY:1.4,upperY:1.8},ballRadiusMeters:.0366}}},
 actor:{source:{sourceId:'fixture-next-terminal-batter',sourceVersion:'fixture-v1',gameId:'game-1',playerId:'away-2',activationApplicationId:'terminal-match-application'},
 match:{playId:8,ruleProfileId:'npb-2026',inning:1,half:'top',outs:1,balls:0,strikes:0,bases:{first:null,second:null,third:null},score:{away:0,home:0}},
 world:{tick:36354083,defenders:[{playerId:'p2',registeredPosition:'P'}]},officialRevision:1,binding:{careerId:'career-a',playerId:'away-2',gameDay:10}},
 workload:{careerId:'career-a',playerId:'p2',revision:1},prefix:[]as any[]});
const previous=(f:ReturnType<typeof fixture>,source:any,index=0)=>({source,progressRevision:index+1,frame:{gameId:'game-1',match:f.actor.match,batterActor:f.actor,workload:f.workload,activationApplicationId:f.actor.source.activationApplicationId,initialWorld:null},
 result:{pitch:{resolution:{timeline:{playId:8,lastEventTick:40000000+index,status:{kind:'active',count:{balls:0,strikes:index+1}}}}}}});
it('TC-S01 materializes exactly three activation-backed TAKE Sources with unchanged recipe values',async()=>{
 const m=await api(),f=fixture();for(let i=0;i<3;i++){const source=m.materializeContinuationTake(f.recipe,f.actor,f.workload,f.prefix);
 expect(source.sourceId).toBe(m.terminalContinuationFixtureIds.takeIds[i]);expect(source).not.toHaveProperty('initialWorldSourceId');expect(source.activationApplicationId).toBe('terminal-match-application');
 const {sourceId,activationApplicationId,...unchanged}=source;const {sourceId:_id,initialWorldSourceId:_initial,...original}=f.recipe;
 expect({...unchanged,request:{...unchanged.request,workloadRevision:0,delivery:{...unchanged.request.delivery,readyAtUs:0}}}).toEqual(original);
 expect(source.request.delivery.readyAtUs).toBe(i?f.prefix[i-1].result.pitch.resolution.timeline.lastEventTick:f.actor.world.tick);expect(source.request.workloadRevision).toBe(1);expect(Object.isFrozen(source.request.delivery)).toBe(true);
 f.prefix.push(previous(f,source,i));}
 expect(()=>m.materializeContinuationTake(f.recipe,f.actor,f.workload,f.prefix)).toThrow();
});
it('TC-S02 rejects changed physics policy actor P and a stale or foreign physical predecessor',async()=>{
 const m=await api();for(const change of [(f:any)=>f.recipe.request.delivery.physics.velocity.x=3,(f:any)=>f.recipe.request.policySourceId='other',
 (f:any)=>f.actor.source.playerId='away-3',(f:any)=>f.actor.source.gameId='foreign',(f:any)=>f.actor.world.defenders[0].playerId='p-away',
 (f:any)=>f.workload.playerId='p-away',(f:any)=>f.actor.match.outs=2,(f:any)=>f.actor.source.initialWorldSourceId='initial-world']){
 const f=fixture();change(f);expect(()=>m.materializeContinuationTake(f.recipe,f.actor,f.workload,[])).toThrow();}
 const f=fixture(),source=m.materializeContinuationTake(f.recipe,f.actor,f.workload,[]);f.prefix.push(previous(f,source));f.prefix[0].frame.workload={...f.workload,revision:0};expect(()=>m.materializeContinuationTake(f.recipe,f.actor,f.workload,f.prefix)).toThrow();
});
it('TC-S03 never invokes a Source accessor or accepts caller count and Match overrides',async()=>{
 const m=await api(),f=fixture();let calls=0;Object.defineProperty(f.recipe,'request',{enumerable:true,get(){calls++;return {};}});
 expect(()=>m.materializeContinuationTake(f.recipe,f.actor,f.workload,[])).toThrow();expect(calls).toBe(0);
 for(const key of ['timeline','match','desiredResult','outs']){const g=fixture();(g.recipe as any)[key]={};expect(()=>m.materializeContinuationTake(g.recipe,g.actor,g.workload,[])).toThrow();}
});
it('TC-S04 closure Source requires the actual strikeout and unchanged nine-inning policy',async()=>{
 const m=await api(),f=fixture(),source=m.materializeContinuationTake(f.recipe,f.actor,f.workload,[]),pitch=previous(f,source,2)as any;
 pitch.source={...source,sourceId:m.terminalContinuationFixtureIds.takeIds[2]};pitch.result.pitch.resolution.timeline.status={kind:'strikeout'};
 const setup={baseCenters:{first:{x:27,z:0},second:{x:27,z:27},third:{x:0,z:27}},defenders:[],activePreviousPlayControllerIds:[]};
 const game={seasonId:'league-season-1',homeClubId:'club-a',awayClubId:'club-b',policy:{version:'fixture-v1',minimumInnings:9,maximumInnings:9,tiesAllowed:true}};
 const close=m.materializeContinuationClosure(pitch,setup,game);expect(close.physicalPitchSourceId).toBe(pitch.source.sourceId);expect(close.game).toEqual(game);expect(close.ruleTick).toBe(40000003);expect(close.closureTick).toBe(40000004);expect(close.nextStartedAtTick).toBe(40000005);expect(close.batterRunnerId).toBeNull();
 pitch.result.pitch.resolution.timeline.status={kind:'walk'};expect(()=>m.materializeContinuationClosure(pitch,setup,game)).toThrow(/strikeout/);
 pitch.result.pitch.resolution.timeline.status={kind:'strikeout'};expect(()=>m.materializeContinuationClosure(pitch,setup,{...game,policy:{...game.policy,minimumInnings:1}})).toThrow(/policy/);
});
it('TC-S05 next actor explicitly selects away-3 only from the completed ordinary K result',async()=>{
 const m=await api(),f=fixture(),ids=m.terminalContinuationFixtureIds,match={...f.actor.match,playId:9,outs:2};
 const done={sourceId:ids.closureSourceId,gameId:'game-1',playId:8,official:{receipt:{applicationId:ids.applicationId,previousPlayId:8,durableRevision:2,appliedMatchState:match},activation:{applicationId:ids.applicationId,nextMatchState:match},nextWorld:{tick:10}}};
 expect(m.materializeContinuationNextActor(done)).toEqual({sourceId:ids.nextActorSourceId,sourceVersion:'fixture-v1',gameId:'game-1',playerId:'away-3',activationApplicationId:ids.applicationId});
 expect(()=>m.materializeContinuationNextActor({...done,official:{...done.official,result:{}}})).toThrow();expect(()=>m.materializeContinuationNextActor({...done,sourceId:'other'})).toThrow();
});
it('TC-S06 closed stage receipts reject reordered incomplete and foreign predecessors',async()=>{
 const m=await api(),receipt={version:'terminal_continuation_stage_v1',stage:'admission',sourceTree:'a'.repeat(40),input:{path:'/private/input.sqlite',sha256:'a'.repeat(64)},output:{path:'/private/output.sqlite',sha256:'b'.repeat(64)},recipeHash:'c'.repeat(64),predecessorReceiptHash:null,
 allHandlesClosed:true,reopened:true,originalRowsPreserved:true,ownerReceipts:{},twoPriorCompletionLineage:false};
 expect(m.validateContinuationPredecessor('physical_k',receipt)).toEqual(receipt);for(const change of [{stage:'closure_completed'},{allHandlesClosed:false},{reopened:false},{version:'other'},{output:{path:'/private/output.sqlite',sha256:'bad'}}])expect(()=>m.validateContinuationPredecessor('physical_k',{...receipt,...change})).toThrow();
 expect(()=>m.validateContinuationPredecessor('next_actor',receipt)).toThrow();
});
it('TC-S07 row preservation permits only each stage scoped changes and rejects unrelated writes',async()=>{
 const m=await api();expect(typeof m.assertContinuationRows,'CONTINUATION_ROW_GUARD_API_MISSING').toBe('function');
 const before:any[]=[{table:'matches',rows:[{__ack_rowid:1,match_id:'game-1',durable_revision:1,state_json:'old'}]},{table:'physical_pitch_progress_actions',rows:[]},{table:'world_player_workload_heads',rows:[{__ack_rowid:1,career_id:'career-a',player_id:'p2',revision:1}]}];
 const after=structuredClone(before);after[1].rows.push({__ack_rowid:1,source_id:m.terminalContinuationFixtureIds.takeIds[0],game_id:'game-1',play_id:8}as never);
 expect(()=>m.assertContinuationRows(before,after,'physical_k')).not.toThrow();after[0].rows[0].state_json='changed';expect(()=>m.assertContinuationRows(before,after,'physical_k')).toThrow();
 after[0].rows[0].state_json='old';after[1].rows[0].source_id='foreign';expect(()=>m.assertContinuationRows(before,after,'physical_k')).toThrow();
 const changed=structuredClone(before);changed[2].rows[0].revision=2;expect(()=>m.assertContinuationRows(before,changed,'closure_completed')).not.toThrow();expect(()=>m.assertContinuationRows(before,changed,'closure_queued')).toThrow();
});

it('TC-B01 derives the two new-PA TAKEs only from explicit away-3 and the preceding actual result',async()=>{
 const {materializeContinuationBuntPrefixTake:take,terminalContinuationBuntPrefixIds:ids}=await import('./TerminalContinuationBatchInputs.test-support');const f=fixture()as any;
 f.actor.source={sourceId:'terminal-continuation-bunt-actor',sourceVersion:'fixture-v1',gameId:'game-1',playerId:'away-3',activationApplicationId:'terminal-continuation-k-application'};f.actor.officialRevision=2;f.actor.match.playId=9;f.actor.match.outs=2;f.workload.revision=2;
 for(let i=0;i<2;i++){const value=take(f.recipe,f.actor,f.workload,f.prefix);expect(value.sourceId).toBe(ids[i]);expect(value).not.toHaveProperty('initialWorldSourceId');expect('activationApplicationId'in value&&value.activationApplicationId).toBe('terminal-continuation-k-application');expect(value.request.workloadRevision).toBe(2);const p=previous(f,value,i);p.result.pitch.resolution.timeline.playId=9;f.prefix.push(p);}
 expect(()=>take(f.recipe,f.actor,f.workload,f.prefix)).toThrow('both preceding TAKEs');
});
it('TC-B02 rejects changed actor workload recipe and non-strike new-PA predecessors',async()=>{
 const {materializeContinuationBuntPrefixTake:take}=await import('./TerminalContinuationBatchInputs.test-support');const f=fixture()as any;
 f.actor.source={sourceId:'terminal-continuation-bunt-actor',sourceVersion:'fixture-v1',gameId:'game-1',playerId:'away-3',activationApplicationId:'terminal-continuation-k-application'};f.actor.officialRevision=2;f.actor.match.playId=9;f.actor.match.outs=2;f.workload.revision=2;
 for(const change of [(x:any)=>x.actor.source.playerId='away-4',(x:any)=>x.workload.revision=1,(x:any)=>x.recipe.request.delivery.physics.velocity.x=3]){const x=structuredClone(f);change(x);expect(()=>take(x.recipe,x.actor,x.workload,[])).toThrow();}
 const p=previous(f,take(f.recipe,f.actor,f.workload,[]));p.result.pitch.resolution.timeline.playId=9;p.result.pitch.resolution.timeline.status.count.balls=1;expect(()=>take(f.recipe,f.actor,f.workload,[p]as any)).toThrow('actual chronological');
});

// These two orchestration checks use mocked return values only; no genuine pitch is qualified.
it('TC-B03 accepts both Sources in one batch using the first returned tick for the second request',async()=>{
 const {acceptContinuationTwoStrikePrefix}=await import('./TerminalContinuationPhysicalAttachment.test-support');const f=fixture()as any;
 f.actor.source={sourceId:'terminal-continuation-bunt-actor',sourceVersion:'fixture-v1',gameId:'game-1',playerId:'away-3',activationApplicationId:'terminal-continuation-k-application'};f.actor.officialRevision=2;f.actor.match.playId=9;f.actor.match.outs=2;f.workload.revision=2;
 const accepted=new Map(),calls:any[]=[];const owner={accept:(sourceId:string,revision:number)=>{calls.push([sourceId,revision]);const p=previous(f,accepted.get(sourceId),revision);p.result.pitch.resolution.timeline.playId=9;return p;}};
 const values=acceptContinuationTwoStrikePrefix(owner as any,accepted,f.recipe,f.actor,f.workload);expect(calls).toEqual([['terminal-continuation-bunt-take-0',0],['terminal-continuation-bunt-take-1',1]]);expect(values[1].source.request.delivery.readyAtUs).toBe(values[0].result.pitch.resolution.timeline.lastEventTick);
});
it('TC-B04 preserves a differing actual outcome and stops before another pitch',async()=>{
 const {acceptContinuationTwoStrikePrefix}=await import('./TerminalContinuationPhysicalAttachment.test-support');const f=fixture()as any;
 f.actor.source={sourceId:'terminal-continuation-bunt-actor',sourceVersion:'fixture-v1',gameId:'game-1',playerId:'away-3',activationApplicationId:'terminal-continuation-k-application'};f.actor.officialRevision=2;f.actor.match.playId=9;f.actor.match.outs=2;f.workload.revision=2;
 const accepted=new Map();let calls=0,observed:any;const owner={accept:(sourceId:string,revision:number)=>{calls++;const p=previous(f,accepted.get(sourceId),revision);p.result.pitch.resolution.timeline.playId=9;p.result.pitch.resolution.timeline.status.count={balls:1,strikes:0};return p;}};
 expect(()=>acceptContinuationTwoStrikePrefix(owner as any,accepted,f.recipe,f.actor,f.workload,value=>{observed=value;})).toThrow('required strike');expect(calls).toBe(1);expect(observed.result.pitch.resolution.timeline.status.count).toEqual({balls:1,strikes:0});
});
