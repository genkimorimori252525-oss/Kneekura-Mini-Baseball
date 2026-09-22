import {describe,it} from 'vitest';
import assert from 'node:assert/strict';
import {resolvePreferenceIntent} from './index';
import {value,code,intent} from './TraitFixtures.test-support';
describe('numeric preferences and manager directives',()=>{
  it('uses the player default when no instruction exists',()=>{const r=value(resolvePreferenceIntent(intent()));
    assert.equal(r.mode,'PLAYER_DEFAULT');assert.equal(r.hardActionId,null);assert.deepEqual(r.weights,[{actionId:'contact',weight:0.1},{actionId:'power',weight:0.9}]);});
  it('blends a soft directive rather than deleting the player preference',()=>{const input=intent('SOFT'),before=structuredClone(input),r=value(resolvePreferenceIntent(input));
    assert.equal(r.mode,'SOFT_BLEND');assert.ok(Math.abs(r.weights[0]!.weight-0.7)<1e-12);assert.deepEqual(input,before);});
  it('takes a legal accepted understood hard sign exactly',()=>{const r=value(resolvePreferenceIntent(intent('HARD')));
    assert.equal(r.mode,'HARD_COMMAND');assert.equal(r.hardActionId,'contact');assert.deepEqual(r.weights,[{actionId:'contact',weight:1},{actionId:'power',weight:0}]);});
  it('a command leaves no residual change once there is no instruction',()=>{const input=intent(),a=value(resolvePreferenceIntent(input));
    value(resolvePreferenceIntent({...input,directive:intent('HARD').directive}));assert.deepEqual(value(resolvePreferenceIntent(input)),a);});
  for(const kind of ['SOFT','HARD'] as const)for(const flag of ['accepted','understood'] as const)
    it(kind+' with '+flag+' false requires a decision, not silent obedience/fallback',()=>{const i=intent(kind);code(resolvePreferenceIntent({...i,directive:{...i.directive,[flag]:false}}),'COMMAND_NOT_ACCEPTED');});
  it('rejects an illegal hard sign instead of selecting a substitute',()=>{const i=intent('HARD');code(resolvePreferenceIntent({...i,directive:{kind:'HARD',accepted:true,understood:true,actionId:'illegal'}}),'ILLEGAL_ACTION');});
  it('keeps the same legal action space for player and manager',()=>{const i=intent('SOFT');code(resolvePreferenceIntent({...i,directive:{kind:'SOFT',accepted:true,understood:true,managerInfluence:0.5,
    weights:[{actionId:'illegal',weight:1}]}}),'ILLEGAL_ACTION');});
  it('rejects duplicated and missing player weights',()=>{const i=intent();code(resolvePreferenceIntent({...i,playerWeights:[i.playerWeights[0]!,i.playerWeights[0]!]}),'INVALID_INPUT');
    code(resolvePreferenceIntent({...i,playerWeights:[i.playerWeights[0]!]}),'ILLEGAL_ACTION');});
  for(const weight of [NaN,Infinity,-0.1,1.1])it('rejects invalid numeric weight '+weight,()=>{const i=intent();code(resolvePreferenceIntent({...i,playerWeights:[{actionId:'power',weight},{actionId:'contact',weight:1}]}),'INVALID_INPUT');});
  it('rejects an all-zero distribution',()=>{const i=intent();code(resolvePreferenceIntent({...i,playerWeights:i.playerWeights.map(x=>({...x,weight:0}))}),'INVALID_INPUT');});
  for(const n of [0,1])it('preserves soft influence endpoint '+n,()=>{const i=intent('SOFT');assert.equal(i.directive.kind,'SOFT');
    if(i.directive.kind!=='SOFT')return;const r=value(resolvePreferenceIntent({...i,directive:{...i.directive,managerInfluence:n}}));
    assert.equal(r.weights[0]!.weight,n===0?0.1:0.9);});
  it('canonicalizes order and detaches all output data',()=>{const i=intent('SOFT'),a=value(resolvePreferenceIntent(i));
    const b=value(resolvePreferenceIntent({...i,legalActionIds:[...i.legalActionIds].reverse(),playerWeights:[...i.playerWeights].reverse()}));
    assert.deepEqual(a,b);assert.notEqual(a.scope,i.scope);assert.ok(Object.isFrozen(a.weights));});
  it('does not use non-Green trait labels as an action preference',()=>{const i=intent();code(resolvePreferenceIntent({...i,familyId:'fastball_quality'}),'INVALID_INPUT');});
  it('echoes source, career/player and exact decision/context provenance',()=>{const i=intent(),r=value(resolvePreferenceIntent(i));
    for(const key of ['scope','decisionId','contextId','sourceSnapshotId'] as const)assert.deepEqual(r[key],i[key]);
    assert.equal(r.boundary,'PREFERENCE_INTENT_ONLY');assert.equal('outcome' in r,false);});
});
