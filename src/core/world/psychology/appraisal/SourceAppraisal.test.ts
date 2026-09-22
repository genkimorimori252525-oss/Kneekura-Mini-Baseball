import { describe,it } from 'vitest';
import assert from 'node:assert/strict';
import { appraiseEmotion } from './SourceAppraisal';
import { appraisalInput,change,value } from './AppraisalFixtures.test-support';
import { createEmotionState,getEmotionInfluence } from '../EmotionState';
import { evaluateEmotion } from '../EmotionGate';
const candidates=(x:unknown)=>value(appraiseEmotion(x)).appraisal.candidates;
const fear=(x:unknown)=>candidates(x).find(c=>c.emotion==='FEAR')!;
describe('source-backed numerical appraisal',()=>{
 it('computes the existing five-candidate contract from current inputs',()=>{
  const r=appraiseEmotion(appraisalInput());assert.equal(r.ok,true);if(!r.ok)return;
  assert.equal(r.value.appraisal.candidates.length,5);assert.equal(r.value.situation.negativeSurprise,0.8);
  assert.equal(r.value.situation.positiveSurprise,0);assert.ok(fear(appraisalInput()).pressure>0);
 });
 it('stronger stage can cross the gate without a separate importance buff',()=>{
  const ordinary=appraisalInput();const high=change(ordinary,d=>{Object.keys(d.importance.model.weights).forEach(k=>d.importance.model.weights[k]=k==='stage'?1:0);d.importance.competition.stage='FINAL';});
  const run=(x:typeof high)=>{const c=value(appraiseEmotion(x));const s=value(createEmotionState({scope:x.importance.scope,policy:x.policy}));
   const r=evaluateEmotion(s,c.appraisal);assert.equal(r.ok,true);if(!r.ok)throw new Error();return value(getEmotionInfluence(r.state));};
  assert.equal(run(ordinary).activeEmotion,null);assert.equal(run(ordinary).effects,null);assert.equal(run(high).activeEmotion,'FEAR');
 });
 it('the same failure can produce motivation in a confident competitive player',()=>{
  const x=change(appraisalInput(),d=>{d.player.response.confidence=1;d.player.response.competitiveness=1;d.player.response.experience=1;d.player.response.stability=0.8;});
  const c=candidates(x);assert.ok(c.find(c=>c.emotion==='MOTIVATION')!.pressure>c.find(c=>c.emotion==='FEAR')!.pressure);
 });
 it('realized stability reduces fear, without reading a pressure grade',()=>{
  assert.ok(fear(change(appraisalInput(),d=>{d.player.response.stability=1;})).pressure<fear(appraisalInput()).pressure);
 });
 it('different expectations change interpretation of an identical perceived outcome',()=>{
  assert.ok(fear(change(appraisalInput(),d=>{d.event.expectedOutcome=0.2;})).pressure<fear(appraisalInput()).pressure);
 });
 it('source IDs do not dictate emotions',()=>{
  const a=candidates(appraisalInput()),b=candidates(change(appraisalInput(),d=>{d.event.eventId='walk';d.evidenceEventIds=['walk'];}));assert.deepEqual(a,b);
 });
 it('keeps all pressures and effect deltas bounded and times integral',()=>{
  for(const c of candidates(appraisalInput())) {assert.ok(c.pressure>=0&&c.pressure<=1);assert.ok(c.behavioralImpact>=0&&c.behavioralImpact<=1);
   assert.ok(Number.isSafeInteger(c.effects.swingDecisionShiftTicks));assert.ok(Math.abs(c.effects.runningRiskDelta)<=1);}
 });
 it('computes impact from effect size, not from pressure priority',()=>{
  const x=change(appraisalInput(),d=>{for(const r of d.model.rows){r.bias=1;for(const k in r.situationWeights)r.situationWeights[k]=0;for(const k in r.responseWeights)r.responseWeights[k]=0;r.stabilityDamping=0;}
   d.model.rows.find((r:any)=>r.emotion==='FEAR').effectsAtFullPressure.runningRiskDelta=-0.1;
   d.model.rows.find((r:any)=>r.emotion==='ANGER').effectsAtFullPressure.throwAggressionDelta=0.7;});
  const c=candidates(x);assert.equal(c.find(c=>c.emotion==='FEAR')!.pressure,1);assert.equal(c.find(c=>c.emotion==='ANGER')!.behavioralImpact,0.7);
 });
 it('zero-effect rows cannot acquire nonzero impact',()=>{
  const x=change(appraisalInput(),d=>{for(const r of d.model.rows)for(const k in r.effectsAtFullPressure)r.effectsAtFullPressure[k]=0;});
  assert.ok(candidates(x).every(c=>c.behavioralImpact===0));
 });
 it('repeats exactly, detaches inputs, and normalizes row order',()=>{
  const x=appraisalInput(),before=structuredClone(x),a=value(appraiseEmotion(x));
  assert.deepEqual(x,before);assert.deepEqual(a,value(appraiseEmotion(x)));assert.notEqual(a.provenance,x);
  assert.deepEqual(a,value(appraiseEmotion(change(x,d=>d.model.rows.reverse()))));assert.ok(Object.isFrozen(a.provenance.player.response));
 });
 for(const [name,edit] of [
  ['STAR_CANDIDATE',(d:any)=>d.player.STAR_CANDIDATE=true],['named grade',(d:any)=>d.player.chanceGrade='A'],
  ['provided pressure',(d:any)=>d.pressure=1],['other player',(d:any)=>d.player.scope.playerId='other'],
  ['other context',(d:any)=>d.event.contextId='other'],['missing event reference',(d:any)=>d.evidenceEventIds=['different']],
  ['duplicate evidence',(d:any)=>d.evidenceEventIds=['event','event']],['missing emotion row',(d:any)=>d.model.rows.pop()],
  ['duplicate emotion',(d:any)=>d.model.rows[0].emotion=d.model.rows[1].emotion],['negative importance gain',(d:any)=>d.model.importanceGain=-1],
  ['zero tick normalization',(d:any)=>d.model.impactTickScale=0],['unbounded coefficients',(d:any)=>d.model.rows[0].bias=Infinity],
  ['source role collision',(d:any)=>d.player.stamp.sourceId=d.event.stamp.sourceId],['stale player',(d:any)=>d.player.stamp.time.tick=0],
  ['future event',(d:any)=>d.event.stamp.time.tick=101],['model identity collision',(d:any)=>{d.model.modelId=d.importance.model.modelId;d.model.version=d.importance.model.version;}],
 ] as const)it('rejects '+name,()=>assert.equal(appraiseEmotion(change(appraisalInput(),edit)).ok,false));
});
