import { describe,it } from 'vitest';
import assert from 'node:assert/strict';
import { getTraitFamilies,createTraitState,evaluateTrait,getTraitPortfolio,restoreTraitState } from './index';
import { value,code,creation,evaluation,assessment } from './TraitFixtures.test-support';

describe('canonical family registry',()=>{
  it('explicitly registers every graded family instead of special-casing Nobi',()=>{
    const families=getTraitFamilies(); assert.equal(families.filter(x=>x.lifecycleClass==='GRADED_DYNAMIC').length,13);
    assert.equal(families.length,27); assert.equal(new Set(families.map(x=>x.familyId)).size,27);
    assert.ok(Object.isFrozen(families)); assert.ok(Object.isFrozen(families[0]!.stateIds));
  });
  it('routes pressure descriptors to appraisal, not direct execution bonuses',()=>{
    for(const id of ['pitch_pressure','bat_pressure','setback_recovery']) assert.equal(getTraitFamilies().find(f=>f.familyId===id)?.sourceRoute,'PRESSURE_APPRAISAL');
  });
  it('uses lifecycle class, not tier name or UI color',()=>{
    assert.equal(getTraitFamilies().find(f=>f.familyId==='opposite_field_technique')?.lifecycleClass,'LEARNED_MASTERY_PERSISTENT');
    assert.equal(getTraitFamilies().find(f=>f.familyId==='fastball_quality')?.lifecycleClass,'GRADED_DYNAMIC');
  });
});
describe('trait state and dynamic projections',()=>{
  it('creates an empty detached immutable player state with no granted traits',()=>{ const input=creation(); const s=value(createTraitState(input));
    assert.equal(s.revision,0); assert.equal(s.time,null); assert.deepEqual(s.entries,[]); assert.notEqual(s.scope,input.scope);
    assert.ok(Object.isFrozen(s.policy.green)); assert.equal(Object.isFrozen(input),false); });
  for(const id of ['pitch_pressure','pitch_platoon_left','setback_recovery','fastball_quality','quick_delivery','bat_pressure',
    'bat_platoon_left','catcher_handling','stealing','baserunning','throw_accuracy','injury_resistance','recovery'])
    it(id+' downgrades its current top tier to B without stacking',()=>{ let s=value(createTraitState(creation()));
      const f=getTraitFamilies().find(x=>x.familyId===id)!; const top=f.stateIds[f.stateIds.length-1]!;
      s=value(evaluateTrait(s,evaluation(s,id,{kind:'CURRENT_SOURCE',stateId:top}))).state;
      s=value(evaluateTrait(s,evaluation(s,id,{kind:'CURRENT_SOURCE',stateId:'B'}))).state;
      assert.equal(s.entries.length,1);assert.equal(s.entries[0]!.effectiveStateId,'B');assert.equal(s.entries[0]!.masteryProof,null); });
  it('removes a dynamic descriptor when the current source no longer supports it',()=>{let s=value(createTraitState(creation()));
    s=value(evaluateTrait(s,evaluation(s))).state; const r=value(evaluateTrait(s,evaluation(s,'fastball_quality',{kind:'CURRENT_SOURCE',stateId:null})));
    assert.equal(r.receipt.transition,'REMOVED');assert.deepEqual(value(getTraitPortfolio(r.state)).families,[]);});
  it('recognition changes the projection without fabricating a source revision',()=>{let s=value(createTraitState(creation()));
    s=value(evaluateTrait(s,evaluation(s))).state;const before=s.entries[0]!.lastEvaluation.source; const e=evaluation(s,'fastball_quality',{kind:'CURRENT_SOURCE',stateId:'A'});
    const r=value(evaluateTrait(s,{...e,source:{...e.source,sourceRevision:before.sourceRevision,sourceSnapshotId:before.sourceSnapshotId,changeKind:'RECOGNITION'}}));
    assert.equal(r.state.entries[0]!.effectiveStateId,'A');assert.equal(r.receipt.evaluation.source.changeKind,'RECOGNITION'); });
  it('retains the entire original state on a refused evaluation',()=>{const s=value(createTraitState(creation()));const before=JSON.stringify(s);
    code(evaluateTrait(s,{...evaluation(s),expectedRevision:4}),'STALE_REVISION');assert.equal(JSON.stringify(s),before);});
  for(const [mutate,reason] of [
    [(e: ReturnType<typeof evaluation>)=>({...e,familyId:'ノビ'}),'UNKNOWN_FAMILY'],
    [(e: ReturnType<typeof evaluation>)=>({...e,scope:{...e.scope,playerId:'other'}}),'SCOPE_MISMATCH'],
    [(e: ReturnType<typeof evaluation>)=>({...e,scope:{...e.scope,careerId:'other'}}),'SCOPE_MISMATCH'],
    [(e: ReturnType<typeof evaluation>)=>({...e,policyRef:{...e.policyRef,version:'other'}}),'POLICY_MISMATCH'],
    [(e: ReturnType<typeof evaluation>)=>({...e,assessment:{kind:'CURRENT_SOURCE',stateId:'S'}}),'UNSUPPORTED_STATE'],
    [(e: ReturnType<typeof evaluation>)=>({...e,assessment:assessment()}),'INVALID_INPUT'],
  ] as const) it('rejects '+reason+' '+String(mutate),()=>{const s=value(createTraitState(creation()));code(evaluateTrait(s,mutate(evaluation(s))),reason);});
  it('rejects repeated evidence, backward time and inconsistent source history',()=>{let s=value(createTraitState(creation()));
    const first=evaluation(s);s=value(evaluateTrait(s,first)).state;const next=evaluation(s);
    code(evaluateTrait(s,{...next,time:first.time}),'BACKDATED_EVALUATION');
    code(evaluateTrait(s,{...next,source:{...next.source,evidenceRevision:1}}),'DUPLICATE_EVIDENCE');
    code(evaluateTrait(s,{...next,source:{...next.source,sourceRevision:1}}),'SOURCE_CONFLICT');
    code(evaluateTrait(s,{...next,source:{...next.source,sourceKey:'other'}}),'SOURCE_CONFLICT'); });
});
describe('consolidated learned mastery',()=>{
  for(const stage of ['CATALYST','HYPOTHESIS','REPETITION'] as const)
    it(stage+' alone never awards a technique',()=>{const s=value(createTraitState(creation()));const a=assessment();assert.equal(a.kind,'LEARNED_TECHNIQUE');
      const r=value(evaluateTrait(s,evaluation(s,'opposite_field_technique',{...a,stage})));assert.equal(r.state.entries[0]!.effectiveStateId,null);});
  for(const [field,n] of [['relevantRepetitions',9],['practiceDays',2],['distinctiveness',0.79]] as const)
    it('requires '+field+' as well as a consolidated flag',()=>{const s=value(createTraitState(creation()));const a=assessment();
      const r=value(evaluateTrait(s,evaluation(s,'opposite_field_technique',{...a,[field]:n})));assert.equal(r.state.entries[0]!.effectiveStateId,null);});
  it('acquires learned, upgrades mastery and never loses it to current decline',()=>{let s=value(createTraitState(creation()));
    s=value(evaluateTrait(s,evaluation(s,'opposite_field_technique',assessment()))).state;
    s=value(evaluateTrait(s,evaluation(s,'opposite_field_technique',assessment('MASTERED')))).state;
    const proof=s.entries[0]!.masteryProof;
    for(const stateId of ['LEARNED',null]){const r=value(evaluateTrait(s,evaluation(s,'opposite_field_technique',assessment(stateId))));s=r.state;
      assert.equal(s.entries[0]!.effectiveStateId,'MASTERED');assert.deepEqual(s.entries[0]!.masteryProof,proof);assert.equal(r.receipt.transition,'MASTERY_RETAINED');}
    const p=value(getTraitPortfolio(s));assert.equal(p.families.length,1);assert.equal(p.boundary,'TRAIT_LIFECYCLE_ONLY');
    assert.equal('abilityBonus' in p.families[0]!,false); });
  it('requires separate higher-tier consolidation criteria',()=>{const s=value(createTraitState(creation())); const a=assessment('MASTERED');
    const r=value(evaluateTrait(s,evaluation(s,'opposite_field_technique',{...a,practiceDays:4,relevantRepetitions:12})));
    assert.equal(r.state.entries[0]!.effectiveStateId,null); });
  it('does not silently provide unconfigured acquisition thresholds',()=>{const s=value(createTraitState(creation()));
    code(evaluateTrait(s,evaluation(s,'blocking',assessment())),'MISSING_FAMILY_POLICY');});
  it('checkpoint cannot downgrade or invent permanent mastery',()=>{let s=value(createTraitState(creation()));
    s=value(evaluateTrait(s,evaluation(s,'opposite_field_technique',assessment('MASTERED')))).state;
    const changed=structuredClone(s) as unknown as {entries:Array<{effectiveStateId:string;masteryProof:unknown}>};
    changed.entries[0]!.effectiveStateId='LEARNED';code(restoreTraitState(changed),'INCONSISTENT_STATE');
    changed.entries[0]!.effectiveStateId='MASTERED';changed.entries[0]!.masteryProof=null;code(restoreTraitState(changed),'INCONSISTENT_STATE'); });
  it('rejects duplicate family records in a checkpoint',()=>{let s=value(createTraitState(creation()));s=value(evaluateTrait(s,evaluation(s))).state;
    code(restoreTraitState({...s,entries:[...s.entries,...s.entries]}),'INCONSISTENT_STATE'); });
  it('round-trips JSON without consulting current catalogs or player physics',()=>{let s=value(createTraitState(creation()));
    s=value(evaluateTrait(s,evaluation(s,'opposite_field_technique',assessment()))).state;
    assert.deepEqual(value(restoreTraitState(JSON.parse(JSON.stringify(s)))),s);});
  it('has no fixed total-trait cap',()=>{const s=value(createTraitState(creation()));assert.equal('maximumTraits' in s.policy,false);});
});
