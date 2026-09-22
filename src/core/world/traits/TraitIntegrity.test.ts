import {describe,it} from 'vitest';
import assert from 'node:assert/strict';
import {createTraitState,evaluateTrait,restoreTraitState,getTraitFamilies,getTraitPortfolio,resolvePreferenceIntent} from './index';
import {value,code,creation,evaluation,assessment,green,intent} from './TraitFixtures.test-support';
import type {TraitState,TraitEvaluation} from './TraitTypes';
function learned(){let s=value(createTraitState(creation()));s=value(evaluateTrait(s,evaluation(s,'opposite_field_technique',assessment('MASTERED')))).state;
  const next=evaluation(s,'opposite_field_technique',assessment(null)),source=s.entries[0]!.lastEvaluation.source;
  s=value(evaluateTrait(s,{...next,source:{...next.source,sourceRevision:source.sourceRevision,sourceSnapshotId:source.sourceSnapshotId,changeKind:'RECOGNITION'}})).state;return s;}
function preference(){let s=value(createTraitState(creation()));for(const day of [1,4,8])s=value(evaluateTrait(s,evaluation(s,'swing_mode_preference',green(),day))).state;return s;}
function editProof(s:TraitState,mutate:(e:TraitEvaluation)=>TraitEvaluation){const x=s.entries[0]!;return{...s,entries:[{...x,masteryProof:mutate(x.masteryProof!)}]};}
describe('adversarial checkpoint integrity',()=>{
  it('rejects one source revision claiming two different snapshots in retained mastery',()=>{const s=learned();code(restoreTraitState(editProof(s,e=>({...e,source:{...e.source,sourceSnapshotId:'other-same-revision'}}))),'INCONSISTENT_STATE');});
  it('rejects two different evaluations claiming the same global revision',()=>{const s=learned(),last=s.entries[0]!.lastEvaluation;
    code(restoreTraitState(editProof(s,e=>({...e,expectedRevision:last.expectedRevision,time:last.time,source:{...e.source,evidenceRevision:last.source.evidenceRevision}}))),'INCONSISTENT_STATE');});
  it('rejects a retained proof and a later evaluation claiming the same evidence revision',()=>{const s=learned();code(restoreTraitState(editProof(s,e=>({...e,source:{...e.source,evidenceRevision:2}}))),'INCONSISTENT_STATE');});
  it('rejects a fabricated Green churn counter without a transition proof',()=>{let s=value(createTraitState(creation()));s=value(evaluateTrait(s,evaluation(s,'swing_mode_preference',green()))).state;
    code(restoreTraitState({...s,entries:[{...s.entries[0]!,changesThisSeason:1}]}),'INCONSISTENT_STATE');});
  it('rejects erasing this-season churn count while retaining this-season proof',()=>{const s=preference();code(restoreTraitState({...s,entries:[{...s.entries[0]!,changesThisSeason:0}]}),'INCONSISTENT_STATE');});
  it('does not accumulate a new pending preference from before the last transition',()=>{let s=preference();s=value(evaluateTrait(s,evaluation(s,'swing_mode_preference',green('CONTACT'),9))).state;
    const x=s.entries[0]!;code(restoreTraitState({...s,entries:[{...x,pending:{...x.pending!,sinceDay:0}}]}),'INCONSISTENT_STATE');});
  it('rejects reused evaluation ID still visible in the persistent proof',()=>{const s=learned(),e=evaluation(s,'opposite_field_technique',assessment(null));
    code(evaluateTrait(s,{...e,evaluationId:s.entries[0]!.masteryProof!.evaluationId}),'DUPLICATE_EVIDENCE');});
  it('rejects a proof episode ID reused with a higher revision',()=>{const s=learned(),e=evaluation(s,'opposite_field_technique',assessment(null));
    code(evaluateTrait(s,{...e,source:{...e.source,episodeId:s.entries[0]!.masteryProof!.source.episodeId}}),'DUPLICATE_EVIDENCE');});
  it('rejects duplicate last-evaluation identities across different family entries',()=>{let s=value(createTraitState(creation()));s=value(evaluateTrait(s,evaluation(s))).state;
    s=value(evaluateTrait(s,evaluation(s,'quick_delivery'))).state;
    const [a,b]=s.entries;code(restoreTraitState({...s,entries:[a,{...b!,lastEvaluation:{...b!.lastEvaluation,evaluationId:a!.lastEvaluation.evaluationId}}]}),'INCONSISTENT_STATE');});
  it('rejects chronological ordering inconsistent with revision ordering',()=>{let s=value(createTraitState(creation()));
    for(const f of ['fastball_quality','quick_delivery','recovery'])s=value(evaluateTrait(s,evaluation(s,f))).state;
    const es=s.entries.map(x=>({...x,lastEvaluation:{...x.lastEvaluation,time:{...x.lastEvaluation.time}}}));
    const a=es.find(x=>x.familyId==='fastball_quality')!,b=es.find(x=>x.familyId==='quick_delivery')!;
    [a.lastEvaluation.time,b.lastEvaluation.time]=[b.lastEvaluation.time,a.lastEvaluation.time];
    code(restoreTraitState({...s,entries:es}),'INCONSISTENT_STATE');});
  it('rejects impossible Green counter carried from an earlier season',()=>{let s=preference();const e=evaluation(s,'fastball_quality',undefined,400);
    s=value(evaluateTrait(s,{...e,time:{...e.time,season:2}})).state;
    code(restoreTraitState({...s,entries:s.entries.map(x=>x.familyId==='swing_mode_preference'?{...x,changesThisSeason:1}:x)}),'INCONSISTENT_STATE');});
});
describe('inert data and finite-number boundary',()=>{
  for(const v of [undefined,null,[],1,'hello',true])it('rejects malformed top-level input '+String(v),()=>code(createTraitState(v),'INVALID_INPUT'));
  it('rejects accessors before reading them',()=>{let invoked=false;const c=creation();Object.defineProperty(c,'scope',{get(){invoked=true;throw Error('must not execute');},enumerable:true});
    code(createTraitState(c),'INVALID_INPUT');assert.equal(invoked,false);});
  it('rejects custom prototypes and symbol-bearing input',()=>{code(createTraitState(Object.assign(Object.create({}),creation())),'INVALID_INPUT');
    const c=creation();Object.defineProperty(c,Symbol('x'),{value:1});code(createTraitState(c),'INVALID_INPUT');});
  for(const n of [NaN,Infinity,-1,1.5,Number.MAX_SAFE_INTEGER+1])it('rejects invalid safe integer '+n,()=>{const s=value(createTraitState(creation()));code(evaluateTrait(s,{...evaluation(s),expectedRevision:n}),'INVALID_INPUT');});
  it('refuses revision overflow instead of accepting an indistinguishable next revision',()=>{let s=value(createTraitState(creation()));s=value(evaluateTrait(s,evaluation(s))).state;
    const x=s.entries[0]!,high={...s,revision:Number.MAX_SAFE_INTEGER,entries:[{...x,lastEvaluation:{...x.lastEvaluation,expectedRevision:Number.MAX_SAFE_INTEGER-1}}]};
    code(evaluateTrait(high,{...evaluation(s),expectedRevision:Number.MAX_SAFE_INTEGER}),'OVERFLOW');});
  it('allows same-day increasing sequence without allowing a date rewind',()=>{let s=value(createTraitState(creation()));s=value(evaluateTrait(s,evaluation(s))).state;
    const e=evaluation(s);assert.equal(value(evaluateTrait(s,{...e,time:{season:1,day:1,sequence:1}})).state.revision,2);
    code(evaluateTrait(s,{...e,time:{season:2,day:0,sequence:999}}),'BACKDATED_EVALUATION');});
  it('supports opaque delimiter-containing action IDs without collisions',()=>{const input={...intent(),legalActionIds:['a:b','a\0b'],playerWeights:[{actionId:'a:b',weight:0.5},{actionId:'a\0b',weight:0.5}]};
    assert.equal(value(resolvePreferenceIntent(input)).weights.length,2);});
  it('rejects non-hysteretic and single-episode Green policy',()=>{const c=creation(),p=c.policy.green[0]!;
    for(const invalid of [{...p,enterThreshold:0.4},{...p,minimumObservations:1},{...p,minimumDays:0}])code(createTraitState({...c,policy:{...c.policy,green:[invalid]}}),'INVALID_INPUT');});
  it('can hold all 27 supported families without an arbitrary total-trait cap',()=>{const c=creation(),families=getTraitFamilies();
    const policy={...c.policy,learned:families.filter(x=>x.lifecycleClass==='LEARNED_MASTERY_PERSISTENT').map(f=>({familyId:f.familyId,
      tiers:f.stateIds.map(stateId=>({stateId,minimumRepetitions:5,minimumPracticeDays:2,minimumDistinctiveness:0.8}))})),
      green:families.filter(x=>x.lifecycleClass==='GREEN_SLOW_PREFERENCE').map(f=>({...c.policy.green[0]!,familyId:f.familyId}))};
    let s=value(createTraitState({...c,policy}));for(const f of families){
      const a=f.lifecycleClass==='GRADED_DYNAMIC'?{kind:'CURRENT_SOURCE' as const,stateId:'B'}:f.lifecycleClass==='LEARNED_MASTERY_PERSISTENT'?assessment('LEARNED')
        :{...green(),support:f.stateIds.map(stateId=>({stateId,value:stateId===f.stateIds[0]?0.9:0.1}))};
      s=value(evaluateTrait(s,evaluation(s,f.familyId,a))).state;}
    assert.equal(s.entries.length,27);assert.equal(value(getTraitPortfolio(s)).families.length,27);});
});
