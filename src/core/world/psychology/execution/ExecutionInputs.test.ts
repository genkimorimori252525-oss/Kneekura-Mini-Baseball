import { describe,it } from 'vitest';
import assert from 'node:assert/strict';
import { prepareEmotionExecution } from './ExecutionPreparation';
import { evaluateAppraisedEmotion } from '../appraisal/AppraisalGate';
import { request,change,value } from './ExecutionFixtures.test-support';
import type { EmotionExecutionRequest } from './ExecutionTypes';
describe('single-gate numerical execution inputs',()=>{
 it('neutral preserves every baseline number and one real gate result',()=>{
  const r=request(),p=value(prepareEmotionExecution(r));
  assert.equal(p.inputs.swingDecision.tick,r.baseline.swingDecision.tick);
  assert.equal(p.inputs.throwIntent.tick,r.baseline.throwIntent.tick);
  assert.equal(p.inputs.defenseReplan.tick,r.baseline.defenseReplan.tick);
  assert.equal(p.inputs.swingAggression,r.baseline.swingAggression);
  assert.equal(p.inputs.throwAggression,r.baseline.throwAggression);
  assert.equal(p.inputs.minimumAdvanceSafetyMarginTicks,100);
  assert.deepEqual(p.appraisal,value(evaluateAppraisedEmotion(r.beforeEmotion,r.appraisal)));
 });
 for(const [field,key] of [['swingDecisionShiftTicks','swingDecision'],['throwIntentShiftTicks','throwIntent'],['defenseReplanShiftTicks','defenseReplan']] as const){
  it('consumes only selected '+field,()=>{const r=request('ANGER',{[field]:7}),p=value(prepareEmotionExecution(r));assert.equal(p.inputs[key].tick,r.baseline[key].tick+7);assert.equal(p.inputs[key].appliedShiftTicks,7);});
  it('earliest feasibility bounds '+field,()=>{const r=request('FEAR',{[field]:-100}),p=value(prepareEmotionExecution(r));assert.equal(p.inputs[key].tick,r.baseline[key].earliestTick);assert.equal(p.inputs[key].constrainedByEarliest,true);});
  it('does not disguise missed window '+field,()=>{const r=request('IMPATIENCE',{[field]:100}),p=value(prepareEmotionExecution(r));assert.equal(p.inputs[key].tick,r.baseline[key].tick+100);assert.equal(p.inputs[key].status,'MISSED_WINDOW');});
 }
 it('current time is also an earliest information boundary',()=>{const r=change(request('FEAR',{swingDecisionShiftTicks:-100}),d=>d.baseline.swingDecision.earliestTick=80);assert.equal(value(prepareEmotionExecution(r)).inputs.swingDecision.tick,100);});
 it('active aggression saturates at a disclosed unit bound',()=>{const p=value(prepareEmotionExecution(request('ANGER',{swingAggressionDelta:1,throwAggressionDelta:-1})));assert.equal(p.inputs.swingAggression,1);assert.equal(p.inputs.throwAggression,0);assert.deepEqual(p.inputs.realized,{swingAggressionDelta:0.5,throwAggressionDelta:-0.4,safetyMarginDeltaTicks:0});});
 it('positive running risk reduces safety margin, not speed',()=>assert.equal(value(prepareEmotionExecution(request('ANGER',{runningRiskDelta:0.4}))).inputs.minimumAdvanceSafetyMarginTicks,60));
 it('negative running risk increases safety margin',()=>assert.equal(value(prepareEmotionExecution(request('FEAR',{runningRiskDelta:-0.4}))).inputs.minimumAdvanceSafetyMarginTicks,140));
 it('rounds positive and negative half ticks symmetrically',()=>{for(const sign of [-1,1]){const r=change(request('ANGER',{runningRiskDelta:sign*0.5}),d=>d.model.runningRiskTicksPerUnit=1);assert.equal(value(prepareEmotionExecution(r)).inputs.minimumAdvanceSafetyMarginTicks,100-sign);}});
 it('risk bounds are nonnegative and explicit',()=>{for(const sign of [-1,1]){const r=change(request('ANGER',{runningRiskDelta:sign}),d=>d.model.runningRiskTicksPerUnit=1000);assert.equal(value(prepareEmotionExecution(r)).inputs.minimumAdvanceSafetyMarginTicks,sign===1?0:200);}});
 it('unselected offers never leak',()=>{const r=change(request(),d=>{const row=d.appraisal.model.rows.find((x:any)=>x.emotion==='ANGER');row.bias=0.1;row.effectsAtFullPressure.runningRiskDelta=1;});const p=value(prepareEmotionExecution(r));assert.equal(p.appraisal.influence.activeEmotion,null);assert.equal(p.inputs.minimumAdvanceSafetyMarginTicks,100);});
 it('preparation does not mutate or alias caller objects',()=>{const r=request('ANGER',{runningRiskDelta:0.5}),copy=structuredClone(r),p=value(prepareEmotionExecution(r));assert.deepEqual(r,copy);assert.notEqual(p.request,r);assert.notEqual(p.request.baseline,r.baseline);assert.ok(Object.isFrozen(p.inputs.swingDecision));});
 it('repeat preparation cannot accumulate effects',()=>{const r=request('ANGER',{runningRiskDelta:0.5});assert.deepEqual(prepareEmotionExecution(r),prepareEmotionExecution(r));});
 it('rejects an already-modified baseline basis',()=>{assert.equal(prepareEmotionExecution(change(request(),d=>d.baseline.basis='SINGLE_EMOTION_GATE_APPLIED')).ok,false);});
 it('a clearing gate returns to current baseline rather than undoing an old delta',()=>{
  let r=request('ANGER',{runningRiskDelta:0.5});const first=value(prepareEmotionExecution(r));
  for(let i=1;i<=4;i++){
   r=change(request(),d=>{d.beforeEmotion=i===1?first.appraisal.state:r.beforeEmotion;d.appraisal.expectedRevision=d.beforeEmotion.revision;
    d.appraisal.appraisalId='calm-'+i;d.appraisal.bundleId='bundle-calm-'+i;d.frame.time.tick=100+i;
    d.appraisal.importance.time.tick=100+i;d.appraisal.event.stamp.time.tick=100+i;d.appraisal.player.stamp.time.tick=100+i;
    d.baseline.frame=d.frame;d.appraisal.importance.competition.stamp.time.tick=100+i;d.baseline.minimumAdvanceSafetyMarginTicks=130;});
   const p=value(prepareEmotionExecution(r));r={...r,beforeEmotion:p.appraisal.state};
   if(p.appraisal.state.active===null){assert.equal(p.inputs.minimumAdvanceSafetyMarginTicks,130);return;}
  }
  assert.fail('gate should clear');
 });
 for(const [name,edit] of [
  ['world baseline mismatch',(d:any)=>d.baseline.frame={...d.baseline.frame,worldRevision:d.frame.worldRevision+1}],['wrong player',(d:any)=>d.frame.scope.playerId='other'],
  ['wrong context',(d:any)=>d.appraisal.importance.contextId='other'],['stale appraisal',(d:any)=>d.appraisal.importance.time.tick--],
  ['window reversed',(d:any)=>d.baseline.throwIntent.earliestTick=150],['unmodified tick before now',(d:any)=>d.baseline.swingDecision.tick=90],
  ['baseline above risk bound',(d:any)=>d.model.maximumAdvanceSafetyMarginTicks=90],['negative scale',(d:any)=>d.model.runningRiskTicksPerUnit=-1],
  ['wrong before revision',(d:any)=>d.appraisal.expectedRevision=2],['invalid baseline number',(d:any)=>d.baseline.swingAggression=NaN],
 ] as const)it('rejects '+name,()=>assert.equal(prepareEmotionExecution(change(request(),edit)).ok,false));
 it('rejects overflow instead of wrapping/clamping the sum',()=>{const r=change(request('ANGER',{throwIntentShiftTicks:20}),d=>{d.baseline.throwIntent={tick:Number.MAX_SAFE_INTEGER-10,earliestTick:100,latestTick:Number.MAX_SAFE_INTEGER};});assert.equal(prepareEmotionExecution(r).ok,false);});
 it('typed request stays public without accepting labels or bonuses',()=>{const r:EmotionExecutionRequest=request();assert.equal(prepareEmotionExecution({...r,traitBonus:0.5}).ok,false);});
});
