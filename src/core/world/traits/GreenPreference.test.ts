import {describe,it} from 'vitest';
import assert from 'node:assert/strict';
import {createTraitState,evaluateTrait,restoreTraitState} from './index';
import {value,code,creation,evaluation,green} from './TraitFixtures.test-support';
import type {TraitState} from './TraitTypes';
const id='swing_mode_preference';
function observe(s:TraitState,target='POWER',day?:number){return value(evaluateTrait(s,evaluation(s,id,green(target),day)));}
function changed(target='POWER'):TraitState{let s=value(createTraitState(creation()));for(const day of [1,4,8])s=observe(s,target,day).state;return s;}
describe('Green slow preferences',()=>{
  it('requires repeated evidence and elapsed days, not one impressive event',()=>{let s=value(createTraitState(creation()));
    s=observe(s).state;assert.equal(s.entries[0]!.effectiveStateId,'BALANCED');assert.equal(s.entries[0]!.pending?.observations,1);
    s=observe(s,'POWER',2).state;s=observe(s,'POWER',3).state;assert.equal(s.entries[0]!.effectiveStateId,'BALANCED');
    s=observe(s,'POWER',8).state;assert.equal(s.entries[0]!.effectiveStateId,'POWER');assert.equal(s.entries[0]!.pending,null);});
  it('elapsed time alone cannot replace repeated relevant episodes',()=>{let s=value(createTraitState(creation()));s=observe(s).state;s=observe(s,'POWER',999).state;
    assert.equal(s.entries[0]!.effectiveStateId,'BALANCED');});
  for(const behavior of ['VOLUNTARY','ACCEPTED'] as const)it(behavior+' internalized behavior can consolidate',()=>{let s=value(createTraitState(creation()));
    for(const day of [1,4,8])s=value(evaluateTrait(s,evaluation(s,id,{...green(),behavior},day))).state;
    assert.equal(s.entries[0]!.effectiveStateId,'POWER');});
  it('one manager instruction cannot change Green or count as practice',()=>{let s=value(createTraitState(creation()));
    for(const day of [1,4,8,100])s=value(evaluateTrait(s,evaluation(s,id,{...green(),behavior:'MANAGER_COMMAND'},day))).state;
    assert.equal(s.entries[0]!.effectiveStateId,'BALANCED');assert.equal(s.entries[0]!.pending,null);});
  it('requires internalization as well as repeated accepted behavior',()=>{let s=value(createTraitState(creation()));
    for(const day of [1,4,8])s=value(evaluateTrait(s,evaluation(s,id,{...green(),internalized:false},day))).state;
    assert.equal(s.entries[0]!.effectiveStateId,'BALANCED');});
  it('separates enter from leave threshold so boundary noise does not flicker',()=>{let s=changed();
    for(let i=0;i<12;i++){const a=green('CONTACT',0.95);const support=a.support.map(x=>x.stateId==='POWER'?{...x,value:0.41}:x);
      s=value(evaluateTrait(s,evaluation(s,id,{...a,support}))).state;assert.equal(s.entries[0]!.effectiveStateId,'POWER');assert.equal(s.entries[0]!.pending,null);}
  });
  it('permits switching at exact enter/leave boundaries only after persistence',()=>{let s=changed();
    for(const day of [9,12,16]){const a=green('CONTACT',0.8);s=value(evaluateTrait(s,evaluation(s,id,{...a,support:a.support.map(x=>x.stateId==='POWER'?{...x,value:0.4}:x)},day))).state;}
    assert.equal(s.entries[0]!.effectiveStateId,'CONTACT');assert.equal(s.entries.length,1);});
  it('resets pending evidence when its candidate changes',()=>{let s=value(createTraitState(creation()));s=observe(s,'POWER',1).state;s=observe(s,'POWER',4).state;
    s=observe(s,'CONTACT',8).state;assert.equal(s.entries[0]!.pending?.observations,1);assert.equal(s.entries[0]!.pending?.sinceDay,8);});
  it('resets pending on non-internalized command episodes',()=>{let s=value(createTraitState(creation()));s=observe(s).state;
    s=value(evaluateTrait(s,evaluation(s,id,{...green(),behavior:'MANAGER_COMMAND'}))).state;assert.equal(s.entries[0]!.pending,null);});
  it('does not trigger below enter threshold',()=>{let s=value(createTraitState(creation()));for(const day of [1,10,20])s=value(evaluateTrait(s,evaluation(s,id,green('POWER',0.799),day))).state;
    assert.equal(s.entries[0]!.effectiveStateId,'BALANCED');assert.equal(s.entries[0]!.pending,null);});
  it('breaks exact candidate ties deterministically, not by input order',()=>{const s=value(createTraitState(creation())),a=green();
    const support=a.support.map(x=>x.stateId==='CONTACT'?{...x,value:0.9}:x);
    const e=evaluation(s,id,{...a,support});const r=value(evaluateTrait(s,e));
    assert.equal(r.state.entries[0]!.pending?.stateId,'CONTACT');
    assert.deepEqual(value(evaluateTrait(s,{...e,assessment:{...a,support:[...support].reverse()}})),r);});
  it('flags the fifth same-season transition but is not a hard cap',()=>{let s=value(createTraitState(creation()));let day=1;
    for(let change=1;change<=6;change++){const target=change%2?'POWER':'CONTACT';let receipt;
      for(const d of [day,day+3,day+7]){const r=observe(s,target,d);s=r.state;receipt=r.receipt;}
      assert.equal(s.entries[0]!.changesThisSeason,change);assert.equal(s.entries[0]!.effectiveStateId,target);
      assert.deepEqual(receipt!.diagnostics,change>=5?['GREEN_CHURN_CALIBRATION']:[]);day+=8;}
  });
  it('resets season diagnostics without resetting learned preferences',()=>{let s=changed();const e=evaluation(s,id,green('POWER'),20);
    s=value(evaluateTrait(s,{...e,time:{...e.time,season:2}})).state;assert.equal(s.entries[0]!.effectiveStateId,'POWER');assert.equal(s.entries[0]!.changesThisSeason,0);});
  it('keeps pending persistence through an actual season boundary',()=>{let s=value(createTraitState(creation()));s=observe(s,'POWER',359).state;s=observe(s,'POWER',362).state;
    const e=evaluation(s,id,green(),367);s=value(evaluateTrait(s,{...e,time:{...e.time,season:2}})).state;assert.equal(s.entries[0]!.effectiveStateId,'POWER');});
  it('rejects missing/duplicate variant evidence',()=>{const s=value(createTraitState(creation())),a=green();
    code(evaluateTrait(s,evaluation(s,id,{...a,support:a.support.slice(1)})),'INVALID_INPUT');
    code(evaluateTrait(s,evaluation(s,id,{...a,support:[a.support[0]!,a.support[0]!,a.support[1]!]})),'INCONSISTENT_STATE');});
  it('refuses to invent a Green calibration',()=>{const s=value(createTraitState(creation()));code(evaluateTrait(s,evaluation(s,'plate_aggression',
    {...green(),support:[{stateId:'AGGRESSIVE',value:0.9},{stateId:'BALANCED',value:0.1},{stateId:'CAUTIOUS',value:0.1}]})),'MISSING_FAMILY_POLICY');});
  it('restores pending and consolidated preference without rerolling',()=>{let s=value(createTraitState(creation()));s=observe(s).state;
    assert.deepEqual(value(restoreTraitState(JSON.parse(JSON.stringify(s)))),s);s=changed();assert.deepEqual(value(restoreTraitState(JSON.parse(JSON.stringify(s)))),s);});
});
