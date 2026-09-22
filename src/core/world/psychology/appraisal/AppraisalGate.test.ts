import { describe,it } from 'vitest';
import assert from 'node:assert/strict';
import { evaluateAppraisedEmotion } from './AppraisalGate';
import { appraiseEmotion } from './SourceAppraisal';
import { appraisalInput,change,value } from './AppraisalFixtures.test-support';
import { createEmotionState,getEmotionInfluence } from '../EmotionState';
import { evaluateEmotion } from '../EmotionGate';
import { replayEmotionEvents } from '../EmotionReplay';
import type { EmotionEvaluationEvent } from '../EmotionTypes';
const initial=()=>{const x=appraisalInput();return value(createEmotionState({scope:x.importance.scope,policy:x.policy}));};
const forceFear=()=>change(appraisalInput(),d=>{for(const r of d.model.rows){r.bias=r.emotion==='FEAR'?1:0;for(const k in r.situationWeights)r.situationWeights[k]=0;for(const k in r.responseWeights)r.responseWeights[k]=0;}});
const step=(n:number)=>change(forceFear(),d=>{d.appraisalId='appraisal-'+n;d.bundleId='bundle-'+n;d.expectedRevision=n;d.importance.time.tick+=n;
 d.event.eventId='event-'+n;d.evidenceEventIds=[d.event.eventId];for(const s of [d.importance.competition,d.importance.personal,d.importance.rivalry,d.player,d.event]){s.stamp.time.tick=100+n;s.stamp.revision+=n;}});
describe('single existing emotion gate composition',()=>{
 it('returns a real unchanged gate event and influence',()=>{
  const x=forceFear(),s=initial(),r=evaluateAppraisedEmotion(s,x);assert.equal(r.ok,true);if(!r.ok)return;
  const direct=evaluateEmotion(s,value(appraiseEmotion(x)).appraisal);assert.equal(direct.ok,true);if(!direct.ok)return;
  assert.deepEqual(r.value.state,direct.state);assert.deepEqual(r.value.event,direct.event);
  assert.deepEqual(r.value.influence,value(getEmotionInfluence(direct.state)));assert.equal(r.value.influence.activeEmotion,'FEAR');
 });
 it('neutral proposals return no executable effect even with nonzero internal pressures',()=>{
  const r=value(evaluateAppraisedEmotion(initial(),appraisalInput()));assert.equal(r.influence.effects,null);assert.ok(r.computation.appraisal.candidates.some(c=>c.pressure>0));
 });
 it('does not mutate input sources or prior state',()=>{
  const x=forceFear(),s=initial(),before=structuredClone({s,x});const r=value(evaluateAppraisedEmotion(s,x));
  assert.deepEqual({s,x},before);assert.notEqual(r.state,s);assert.ok(Object.isFrozen(r.state.lastAppraisal!.candidates));
 });
 it('replay uses accepted gate receipts and does not re-roll appraisals',()=>{
  const base=initial();let s=base;const receipts:EmotionEvaluationEvent[]=[];
  for(let n=0;n<30;n++){const r=value(evaluateAppraisedEmotion(s,step(n)));s=r.state;receipts.push(r.event);}
  const replay=replayEmotionEvents(base,receipts);assert.equal(replay.ok,true);if(!replay.ok)return;assert.deepEqual(replay.value,s);
  assert.deepEqual(value(evaluateAppraisedEmotion(base,step(0))).event,receipts[0]);
 });
 it('preserves incumbent calm-event hysteresis instead of creating a second gate',()=>{
  let r=value(evaluateAppraisedEmotion(initial(),step(0)));
  for(let n=1;n<=3;n++){
   const x=change(step(n),d=>{d.model.rows.find((x:any)=>x.emotion==='FEAR').bias=0.1;d.model.version='calm-test';});
   r=value(evaluateAppraisedEmotion(r.state,x));assert.equal(r.influence.activeEmotion,n===3?null:'FEAR');
  }assert.equal(r.influence.effects,null);assert.equal(r.event.transition,'CLEARED');
 });
 it('selects actual largest effect and replaces rather than stacks emotions',()=>{
  const r=value(evaluateAppraisedEmotion(initial(),step(0)));
  const x=change(step(1),d=>{d.model.rows.find((r:any)=>r.emotion==='ANGER').bias=1;d.model.version='anger-test';});
  const next=value(evaluateAppraisedEmotion(r.state,x));assert.equal(next.influence.activeEmotion,'ANGER');
  assert.equal(next.influence.effects!.runningRiskDelta,0);assert.ok(next.influence.effects!.throwAggressionDelta>0);
 });
 it('rejects a modified threshold policy hiding behind an unchanged version',()=>{
  const x=change(forceFear(),d=>{d.policy.thresholds[0].activation=0.9;});assert.equal(evaluateAppraisedEmotion(initial(),x).ok,false);
 });
 it('rejects stale gate revision even when source computation alone succeeds',()=>{
  const s=value(evaluateAppraisedEmotion(initial(),step(0))).state;assert.equal(evaluateAppraisedEmotion(s,step(0)).ok,false);
 });
 it('rejects a source bundle ID reused for a new appraisal',()=>{
  const s=value(evaluateAppraisedEmotion(initial(),step(0))).state;
  assert.equal(evaluateAppraisedEmotion(s,change(step(1),d=>{d.bundleId='bundle-0';})).ok,false);
 });
 it('rejects a different match without changing its prior state',()=>{
  const s=initial(),before=structuredClone(s);const x=change(forceFear(),d=>{d.importance.scope.matchId='other';d.player.scope.matchId='other';d.event.scope.matchId='other';d.importance.personal.scope.matchId='other';d.importance.competition.matchId='other';});
  assert.equal(evaluateAppraisedEmotion(s,x).ok,false);assert.deepEqual(s,before);
 });
 it('rejects a backdated appraisal through the existing gate',()=>{
  const s=value(evaluateAppraisedEmotion(initial(),step(0))).state;
  assert.equal(evaluateAppraisedEmotion(s,change(step(0),d=>{d.expectedRevision=1;d.appraisalId='other';d.bundleId='other';})).ok,false);
 });
});
