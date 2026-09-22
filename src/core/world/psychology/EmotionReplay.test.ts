import { test } from 'vitest';
import assert from 'node:assert/strict';
import { replayEmotionEvents } from './EmotionReplay';
import { evaluateEmotion } from './EmotionGate';
import { getEmotionInfluence, restoreEmotionState } from './EmotionState';
import { state, appraisal, candidate, zeroEffects } from './EmotionFixtures.test-support';
import type { EmotionEvaluationEvent, EmotionState } from './EmotionTypes';
function history(count=12) {
  let s=state();const states:EmotionState[]=[s],events:EmotionEvaluationEvent[]=[];
  for(let i=0;i<count;i++) {
    const p=[0.2,0.85,0.6,0.4,0.4,0.4][i%6];
    const r=evaluateEmotion(s,candidate(appraisal(s),'ANGER',p));assert.ok(r.ok);events.push(r.event);s=r.state;states.push(s);
  }
  return {states,events};
}
test('replay exactly reconstructs all activation, calm and clearance states',()=>{
  const {states,events}=history();const r=replayEmotionEvents(states[0],JSON.parse(JSON.stringify(events)));assert.ok(r.ok);
  assert.deepEqual(r.value,states.at(-1));
});
test('mid-match checkpoint plus tail matches full history without an external world lookup',()=>{
  const {states,events}=history(30);const checkpoint=JSON.parse(JSON.stringify(states[13]));
  const r=replayEmotionEvents(checkpoint,events.slice(13));assert.ok(r.ok);assert.deepEqual(r.value,states.at(-1));
});
test('empty replay validates, detaches and freezes checkpoint without changing it',()=>{
  const s=JSON.parse(JSON.stringify(state())),r=replayEmotionEvents(s,[]);assert.ok(r.ok);
  assert.deepEqual(r.value,s);assert.notEqual(r.value,s);assert.ok(Object.isFrozen(r.value));assert.equal(Object.isFrozen(s),false);
});
for(const field of ['beforeRevision','afterRevision','calmObservations'] as const) test('tampered receipt '+field+' fails comparison',()=>{
  const {states,events}=history(),bad=JSON.parse(JSON.stringify(events));bad[1][field]+=1;
  const before=JSON.stringify(states[0]),r=replayEmotionEvents(states[0],bad);assert.equal(r.ok,false);
  if(!r.ok)assert.equal(r.reason.code,'REPLAY_MISMATCH');assert.equal(JSON.stringify(states[0]),before);
});
test('tampered displayed active emotion cannot override actual recomputed gate',()=>{
  const {states,events}=history(),bad=JSON.parse(JSON.stringify(events));bad[1].active.emotion='FEAR';
  const r=replayEmotionEvents(states[0],bad);assert.equal(r.ok,false);if(!r.ok)assert.equal(r.reason.code,'REPLAY_MISMATCH');
});
test('tampered candidate pressure changing activation is rejected against receipt',()=>{
  const {states,events}=history(),bad=JSON.parse(JSON.stringify(events));
  bad[1].request.candidates.find((x:{emotion:string})=>x.emotion==='ANGER').pressure=0.1;
  assert.equal(replayEmotionEvents(states[0],bad).ok,false);
});
test('reordered and duplicated history is rejected without mutating checkpoint',()=>{
  const {states,events}=history();
  assert.equal(replayEmotionEvents(states[0],[events[1],events[0]]).ok,false);
  assert.equal(replayEmotionEvents(states[0],[events[0],events[0]]).ok,false);
});
test('reused appraisal identity across the replay window is rejected even with altered revision and stamp',()=>{
  const {states,events}=history(),bad=JSON.parse(JSON.stringify(events));bad[5].request.appraisalId=bad[1].request.appraisalId;
  const r=replayEmotionEvents(states[0],bad);assert.equal(r.ok,false);if(!r.ok)assert.equal(r.reason.code,'DUPLICATE_APPRAISAL');
});
test('foreign player history cannot be replayed into this player',()=>{
  const {states,events}=history(),bad=JSON.parse(JSON.stringify(events));bad[0].request.scope.playerId='different-player';
  assert.equal(replayEmotionEvents(states[0],bad).ok,false);
});
test('replay rejects extra receipt fields including hidden modifiers',()=>{
  const {states,events}=history();assert.equal(replayEmotionEvents(states[0],[{...events[0],hitBonus:0.2}]).ok,false);
});
test('replay reads no accessor in untrusted nested receipt data',()=>{
  const {states,events}=history();let accessed=false;
  const bad={...events[0],get active(){accessed=true;return null;}};
  assert.equal(replayEmotionEvents(states[0],[bad]).ok,false);assert.equal(accessed,false);
});
test('sparse replay input is rejected, not silently shortened',()=>{
  const {states,events}=history(),bad=[...events];delete bad[1];assert.equal(replayEmotionEvents(states[0],bad).ok,false);
});
test('500-event sequence and checkpoint restore remain deterministic',()=>{
  const {states,events}=history(500);const a=replayEmotionEvents(states[0],events),b=replayEmotionEvents(states[177],events.slice(177));
  assert.ok(a.ok);assert.ok(b.ok);assert.deepEqual(a.value,b.value);assert.deepEqual(a.value,states.at(-1));
});
test('inactive effect output is invariant to hidden subthreshold pressure and effect offers',()=>{
  const outputs=[];
  for(const pressure of [0.1,0.4,0.79]) {
    const s=state(),r=evaluateEmotion(s,candidate(appraisal(s),'ANGER',pressure,0.9,{...zeroEffects(),throwIntentShiftTicks:999}));
    assert.ok(r.ok);const v=getEmotionInfluence(r.state);assert.ok(v.ok);outputs.push([v.value.activeEmotion,v.value.effects,v.value.source]);
  }
  assert.deepEqual(outputs,[[null,null,null],[null,null,null],[null,null,null]]);
});
test('profile mismatch is not silently migrated by restore/replay',()=>{
  const {states,events}=history(),bad=JSON.parse(JSON.stringify(states[2]));bad.policy.version='different';
  assert.equal(restoreEmotionState(bad).ok,false);assert.equal(replayEmotionEvents(bad,events.slice(2)).ok,false);
});
