import {describe,it} from 'vitest';
import assert from 'node:assert/strict';
import {createTraitState,evaluateTrait,restoreTraitState,replayTraitEvents,getTraitFamilies} from './index';
import {value,code,creation,evaluation,assessment,green} from './TraitFixtures.test-support';
import type {TraitState,TraitReceipt} from './TraitTypes';
function history(n=36){const start=value(createTraitState(creation()));let state=start;const events:TraitReceipt[]=[];const checkpoints:TraitState[]=[start];
  for(let i=0;i<n;i++){const family=i%3===0?'fastball_quality':i%3===1?'opposite_field_technique':'swing_mode_preference';
    const a=i%3===0?{kind:'CURRENT_SOURCE' as const,stateId:i%2?'B':'A'}:i%3===1?assessment(i<15?'MASTERED':null):green(i<18?'POWER':'CONTACT');
    const e=evaluation(state,family,a,i*3+1);const r=value(evaluateTrait(state,{...e,time:{...e.time,season:1+Math.floor(i/30)}}));
    state=r.state;events.push(r.receipt);checkpoints.push(state);}
  return{start,state,events,checkpoints};}
describe('trait checkpoint and replay',()=>{
  it('recomputes every accepted mixed-family receipt from the empty checkpoint',()=>{const h=history();assert.deepEqual(value(replayTraitEvents(h.start,h.events)),h.state);});
  it('replays a compact checkpoint plus tail without initial catalogs or world histories',()=>{const h=history();assert.deepEqual(value(replayTraitEvents(h.checkpoints[17],h.events.slice(17))),h.state);});
  it('empty tail is a detached validated restoration',()=>{const h=history(6),r=value(replayTraitEvents(h.state,[]));assert.deepEqual(r,h.state);assert.notEqual(r,h.state);});
  it('keeps 600 accepted observations reproducible across seasons and checkpoint splits',()=>{const h=history(600);assert.deepEqual(value(replayTraitEvents(h.start,h.events)),h.state);
    assert.deepEqual(value(replayTraitEvents(h.checkpoints[301],h.events.slice(301))),h.state);});
  for(const field of ['beforeRevision','afterRevision'] as const)it('rejects a tampered '+field,()=>{const h=history(1);code(replayTraitEvents(h.start,[{...h.events[0]!,[field]:99}]),'REPLAY_MISMATCH');});
  it('rejects a forged transition without updating the checkpoint',()=>{const h=history(1),before=JSON.stringify(h.start);
    code(replayTraitEvents(h.start,[{...h.events[0]!,transition:'REMOVED'}]),'REPLAY_MISMATCH');assert.equal(JSON.stringify(h.start),before);});
  it('rejects changed after-state and diagnostic fields',()=>{const h=history(1);
    code(replayTraitEvents(h.start,[{...h.events[0]!,afterStateId:'G'}]),'REPLAY_MISMATCH');
    code(replayTraitEvents(h.start,[{...h.events[0]!,diagnostics:['GREEN_CHURN_CALIBRATION']}]),'REPLAY_MISMATCH');});
  it('rejects cross-player evidence',()=>{const h=history(1),event=h.events[0]!;
    code(replayTraitEvents(h.start,[{...event,evaluation:{...event.evaluation,scope:{...event.evaluation.scope,playerId:'someone-else'}}}]),'SCOPE_MISMATCH');});
  it('rejects backdated/reordered event tails',()=>{const h=history(3);code(replayTraitEvents(h.start,[h.events[1]!,h.events[0]!,h.events[2]!]),'STALE_REVISION');});
  it('rejects duplicate evaluation IDs beyond the single-entry checkpoint window',()=>{let state=value(createTraitState(creation()));const start=state,events:TraitReceipt[]=[];
    for(let i=0;i<3;i++){const e=evaluation(state);const r=value(evaluateTrait(state,i===2?{...e,evaluationId:'evaluation-0'}:e));state=r.state;events.push(r.receipt);}
    code(replayTraitEvents(start,events),'DUPLICATE_EVIDENCE');});
  it('rejects reuse of an older episode in the replay tail',()=>{let state=value(createTraitState(creation()));const start=state,events:TraitReceipt[]=[];
    for(let i=0;i<3;i++){const e=evaluation(state);const r=value(evaluateTrait(state,i===2?{...e,source:{...e.source,episodeId:'episode/fastball_quality/0'}}:e));state=r.state;events.push(r.receipt);}
    code(replayTraitEvents(start,events),'DUPLICATE_EVIDENCE');});
  it('retains source event IDs as evidence, not as automatically granted development',()=>{const h=history(8);const r=value(replayTraitEvents(h.start,h.events));
    assert.deepEqual(r.entries.map(x=>x.lastEvaluation.source.eventIds),h.state.entries.map(x=>x.lastEvaluation.source.eventIds));});
  it('rejects sparse/accessor receipt arrays without invoking accessors',()=>{const h=history(1);code(replayTraitEvents(h.start,new Array(1)),'INVALID_INPUT');
    let called=false;const input:unknown[]=[];Object.defineProperty(input,0,{get(){called=true;return h.events[0];},enumerable:true});
    code(replayTraitEvents(h.start,input),'INVALID_INPUT');assert.equal(called,false);});
  it('rejects forged Green pending counts and impossible already-complete pending history',()=>{let s=value(createTraitState(creation()));s=value(evaluateTrait(s,evaluation(s,'swing_mode_preference',green()))).state;
    for(const pending of [{stateId:'CONTACT',sinceDay:1,observations:1},{stateId:'POWER',sinceDay:0,observations:3}])
      code(restoreTraitState({...s,entries:[{...s.entries[0]!,pending}]}),'INCONSISTENT_STATE');});
  it('does not grant a Green transition from a manager-command proof',()=>{let s=value(createTraitState(creation()));for(const day of [1,4,8])s=value(evaluateTrait(s,evaluation(s,'swing_mode_preference',green(),day))).state;
    const x=s.entries[0]!,p=x.preferenceProof!;code(restoreTraitState({...s,entries:[{...x,preferenceProof:{...p,evaluation:{...p.evaluation,assessment:{...green(),behavior:'MANAGER_COMMAND'}}}}]}),'INCONSISTENT_STATE');});
  it('does not restore a Green proof with a false previous preference',()=>{let s=value(createTraitState(creation()));for(const day of [1,4,8])s=value(evaluateTrait(s,evaluation(s,'swing_mode_preference',green(),day))).state;
    const x=s.entries[0]!;code(restoreTraitState({...s,entries:[{...x,preferenceProof:{...x.preferenceProof!,fromStateId:'POWER'}}]}),'INCONSISTENT_STATE');});
});
describe('all explicit lifecycle families',()=>{
  const families=getTraitFamilies();
  for(const f of families.filter(x=>x.lifecycleClass==='LEARNED_MASTERY_PERSISTENT'))it(f.familyId+' retains its actual highest consolidated tier',()=>{
    const c=creation();const policy={...c.policy,learned:[{familyId:f.familyId,tiers:f.stateIds.map(stateId=>({stateId,minimumRepetitions:5,minimumPracticeDays:2,minimumDistinctiveness:0.8}))}]};
    let s=value(createTraitState({...c,policy}));const top=f.stateIds.at(-1)!;
    s=value(evaluateTrait(s,evaluation(s,f.familyId,assessment(top)))).state;
    s=value(evaluateTrait(s,evaluation(s,f.familyId,assessment(null)))).state;assert.equal(s.entries[0]!.effectiveStateId,top);
    assert.deepEqual(value(restoreTraitState(s)),s);});
  for(const f of families.filter(x=>x.lifecycleClass==='GREEN_SLOW_PREFERENCE'))it(f.familyId+' has exactly one persistent default choice',()=>{
    const c=creation();let s=value(createTraitState({...c,policy:{...c.policy,green:[{...c.policy.green[0]!,familyId:f.familyId}]}}));
    const target=f.stateIds.find(x=>x!==f.neutralStateId)!;const a={...green(),support:f.stateIds.map(stateId=>({stateId,value:stateId===target?0.9:0.1}))};
    for(const day of [1,4,8])s=value(evaluateTrait(s,evaluation(s,f.familyId,a,day))).state;
    assert.equal(s.entries.length,1);assert.equal(s.entries[0]!.effectiveStateId,target);assert.deepEqual(value(restoreTraitState(s)),s);});
  it('does not award two learned families from the same source skill',()=>{const c=creation(),p=c.policy.learned[0]!;
    let s=value(createTraitState({...c,policy:{...c.policy,learned:[p,{...p,familyId:'bunting'}]}}));
    const e=evaluation(s,'opposite_field_technique',assessment());s=value(evaluateTrait(s,e)).state;
    const next=evaluation(s,'bunting',assessment());code(evaluateTrait(s,{...next,source:{...next.source,sourceKey:e.source.sourceKey}}),'DUPLICATE_SOURCE_MASTERY');});
});
