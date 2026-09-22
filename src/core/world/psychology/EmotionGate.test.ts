import { test } from 'vitest';
import assert from 'node:assert/strict';
import { evaluateEmotion } from './EmotionGate';
import { getEmotionInfluence, restoreEmotionState } from './EmotionState';
import { state, appraisal, candidate, zeroEffects } from './EmotionFixtures.test-support';
import type { EmotionAppraisal, EmotionState } from './EmotionTypes';
function run(s: EmotionState, a: EmotionAppraisal): EmotionState {
  const r = evaluateEmotion(s,a); assert.ok(r.ok, JSON.stringify(r)); return r.state;
}
function active(): EmotionState { const s = state(); return run(s,candidate(appraisal(s),'ANGER',0.9)); }
function influence(s: EmotionState) { const r = getEmotionInfluence(s); assert.ok(r.ok); return r.value; }

test('subthreshold pressures never leak candidate decision effects', () => {
  for (const p of [0,0.2,0.49,0.799999]) { const s = state(); const n = run(s,candidate(appraisal(s),'ANGER',p));
    assert.equal(n.active,null); assert.equal(influence(n).effects,null); }
});
test('activation boundary is inclusive and gate/source tick matches appraisal', () => {
  const s = state(), a = candidate(appraisal(s),'ANGER',0.8); const r = evaluateEmotion(s,a); assert.ok(r.ok);
  assert.equal(r.event.transition,'ACTIVATED'); assert.equal(r.state.active?.emotion,'ANGER');
  assert.deepEqual(r.state.active?.activatedAt,a.time); assert.deepEqual(influence(r.state).time,a.time);
  assert.equal(influence(r.state).source?.sourceSnapshotId,a.sourceSnapshotId);
});
test('highest actual impact wins, not highest raw pressure or a fixed anger priority', () => {
  const s = state(); let a = candidate(appraisal(s),'ANGER',1,0.2);
  a = candidate(a,'FEAR',0.81,0.7,{ ...zeroEffects(),runningRiskDelta:-0.3 });
  const n = run(s,a); assert.equal(n.active?.emotion,'FEAR'); assert.equal(influence(n).effects?.runningRiskDelta,-0.3);
  assert.equal(influence(n).effects?.swingAggressionDelta,0);
});
test('sustain boundary is inclusive and does not require repeated activation', () => {
  const s = active(), n = run(s,candidate(appraisal(s),'ANGER',0.5));
  assert.equal(n.active?.emotion,'ANGER'); assert.equal(n.calmObservations,0);
});
test('clears only after three consecutive canonical calm observations; then effects are empty', () => {
  let s = active(); const activatedAt = s.active?.activatedAt;
  for (let i=1;i<=3;i++) { const r = evaluateEmotion(s,candidate(appraisal(s),'ANGER',0.4)); assert.ok(r.ok); s=r.state;
    assert.equal(s.calmObservations,i===3?0:i);
    assert.equal(r.event.transition,i===3?'CLEARED':'MAINTAINED');
    if(i<3) assert.deepEqual(s.active?.activatedAt,activatedAt); }
  assert.equal(s.active,null); assert.equal(influence(s).effects,null); assert.equal(influence(s).source,null);
});
test('sustained observation resets an interrupted calm sequence', () => {
  let s=active();s=run(s,candidate(appraisal(s),'ANGER',0.3));
  s=run(s,candidate(appraisal(s),'ANGER',0.5));assert.equal(s.calmObservations,0);
  s=run(s,candidate(appraisal(s),'ANGER',0.3));assert.equal(s.calmObservations,1);
});
test('stronger newly activated emotion replaces the old bundle without stacking', () => {
  const s=active();let a=candidate(appraisal(s),'ANGER',0.7,0.4);a=candidate(a,'MOTIVATION',0.9,0.8,{...zeroEffects(),throwIntentShiftTicks:-7});
  const r=evaluateEmotion(s,a);assert.ok(r.ok);assert.equal(r.event.transition,'CHANGED');
  assert.equal(r.state.active?.emotion,'MOTIVATION');assert.deepEqual(r.state.active?.activatedAt,a.time);
  assert.equal(influence(r.state).effects?.throwIntentShiftTicks,-7);assert.equal(influence(r.state).effects?.swingAggressionDelta,0);
});
test('challenger below activation cannot borrow incumbent sustain eligibility', () => {
  const s=active();let a=candidate(appraisal(s),'ANGER',0.6,0.3);a=candidate(a,'FEAR',0.7,0.99);
  assert.equal(run(s,a).active?.emotion,'ANGER');
});
test('equal impact keeps eligible incumbent despite candidate ID order', () => {
  const s=active();let a=candidate(appraisal(s),'ANGER',0.6,0.4);a=candidate(a,'FEAR',1,0.4);
  a={...a,candidates:a.candidates.map(x=>({...x,candidateId:x.emotion==='FEAR'?'aaa':x.candidateId}))};
  assert.equal(run(s,a).active?.emotion,'ANGER');
});
test('initial equal impact tie is candidate-ID based and input-permutation invariant', () => {
  const s=state();let a=candidate(candidate(appraisal(s),'ANGER',0.9,0.4),'FEAR',0.9,0.4);
  a={...a,candidates:a.candidates.map(x=>({...x,candidateId:x.emotion==='FEAR'?'a':x.candidateId}))};
  const n=run(s,a);assert.equal(n.active?.emotion,'FEAR');
  assert.deepEqual(run(s,{...a,candidates:[...a.candidates].reverse()}),n);
});
test('maintained emotion uses current effects rather than stale activation effects', () => {
  const s=active();const n=run(s,candidate(appraisal(s),'ANGER',0.6,0.2,{...zeroEffects(),throwAggressionDelta:-0.1}));
  assert.equal(influence(n).effects?.swingAggressionDelta,0);assert.equal(influence(n).effects?.throwAggressionDelta,-0.1);
});
test('no applicable behavior change clears incumbent immediately rather than showing a cosmetic emotion', () => {
  const s=active(),r=evaluateEmotion(s,appraisal(s));assert.ok(r.ok);assert.equal(r.event.transition,'CLEARED');
  assert.equal(r.state.active,null);assert.equal(influence(r.state).effects,null);
});
test('pressure alone with no effects never activates', () => {
  const s=state(),a=candidate(appraisal(s),'ANGER',1,0,zeroEffects());assert.equal(run(s,a).active,null);
});
for (const field of ['careerId','matchId','playerId'] as const) test('rejects cross-scope '+field,()=>{
  const s=state(),a=appraisal(s),r=evaluateEmotion(s,{...a,scope:{...a.scope,[field]:'other'}});
  assert.equal(r.ok,false);if(!r.ok){assert.equal(r.reason.code,'SCOPE_MISMATCH');assert.equal(r.state,s);}
});
for(const field of ['policyId','version'] as const) test('rejects policy mismatch '+field,()=>{
  const s=state(),a=appraisal(s),r=evaluateEmotion(s,{...a,policyRef:{...a.policyRef,[field]:'other'}});
  assert.equal(r.ok,false);if(!r.ok)assert.equal(r.reason.code,'POLICY_MISMATCH');
});
test('stale revision returns original input unchanged',()=>{
  const s=active(),before=JSON.stringify(s),r=evaluateEmotion(s,{...appraisal(s),expectedRevision:0});
  assert.equal(r.ok,false);if(!r.ok){assert.equal(r.reason.code,'STALE_REVISION');assert.equal(r.state,s);}assert.equal(JSON.stringify(s),before);
});
test('duplicate appraisal ID cannot advance the calm counter',()=>{
  const s=active(),a=candidate(appraisal(s,s.lastAppraisal!.appraisalId),'ANGER',0.1),r=evaluateEmotion(s,a);
  assert.equal(r.ok,false);if(!r.ok){assert.equal(r.reason.code,'DUPLICATE_APPRAISAL');assert.equal(r.state,s);}
});
for(const time of [{tick:9,sequence:0},{tick:10,sequence:0}]) test('rejects non-increasing canonical stamp '+JSON.stringify(time),()=>{
  const s=active(),r=evaluateEmotion(s,{...appraisal(s),time});assert.equal(r.ok,false);if(!r.ok)assert.equal(r.reason.code,'BACKDATED_APPRAISAL');
});
test('legitimate same-tick subsequent evidence uses sequence, not invented physical time',()=>{
  const s=active(),a={...candidate(appraisal(s),'ANGER',0.4),time:{tick:10,sequence:1}},n=run(s,a);
  assert.equal(n.calmObservations,1);assert.deepEqual(n.lastAppraisal?.time,a.time);assert.equal(n.active?.activatedAt.tick,10);
});
test('revision overflow is rejected rather than rounded',()=>{
  const old=run(state(),appraisal(state()));const s={...old,revision:Number.MAX_SAFE_INTEGER,
    lastAppraisal:{...old.lastAppraisal!,expectedRevision:Number.MAX_SAFE_INTEGER-1}};
  const r=evaluateEmotion(s,appraisal(s));assert.equal(r.ok,false);if(!r.ok)assert.equal(r.reason.code,'REVISION_OVERFLOW');
});
test('receipt and state are detached immutable copies; caller request remains writable',()=>{
  const s=state(),a=JSON.parse(JSON.stringify(candidate(appraisal(s),'ANGER',0.9))),n=run(s,a);
  a.candidates.find((x:{emotion:string})=>x.emotion==='ANGER').effects.swingAggressionDelta=0.99;
  assert.equal(influence(n).effects?.swingAggressionDelta,0.2);assert.ok(Object.isFrozen(n.lastAppraisal?.candidates[0].effects));
  assert.equal(Object.isFrozen(a),false);
});
test('identical canonical appraisals produce identical receipts without drawing randomness',()=>{
  const s=state(),a=candidate(appraisal(s),'FEAR',0.9);assert.deepEqual(evaluateEmotion(s,a),evaluateEmotion(s,a));
});
test('different player appraisal can choose another emotion or no emotion for the same world event',()=>{
  const s=state(),a=candidate(appraisal(s),'FEAR',0.9),b=candidate(appraisal(s),'MOTIVATION',0.9);
  assert.equal(run(s,a).active?.emotion,'FEAR');assert.equal(run(s,b).active?.emotion,'MOTIVATION');assert.equal(run(s,appraisal(s)).active,null);
});
for(const change of [
  (a:EmotionAppraisal)=>({...a,candidates:a.candidates.slice(1)}),
  (a:EmotionAppraisal)=>({...a,candidates:[...a.candidates.slice(1),a.candidates[1]]}),
  (a:EmotionAppraisal)=>({...a,evidenceEventIds:[]}),
  (a:EmotionAppraisal)=>({...a,evidenceEventIds:['same','same']}),
  (a:EmotionAppraisal)=>({...a,abilityBonus:99}),
  (a:EmotionAppraisal)=>({...a,candidates:a.candidates.map(x=>({...x,candidateId:'duplicate'}))}),
]) test('rejects incomplete, duplicate or unsupported appraisal '+String(change),()=>{
  const s=state();assert.equal(evaluateEmotion(s,change(appraisal(s))).ok,false);
});
for(const v of [NaN,Infinity,-0.01,1.01]) test('rejects invalid pressure '+v,()=>{
  const s=state();assert.equal(evaluateEmotion(s,candidate(appraisal(s),'ANGER',v)).ok,false);
});
test('rejects claimed impact without effects and effects with zero impact',()=>{
  const s=state();assert.equal(evaluateEmotion(s,candidate(appraisal(s),'ANGER',0.9,0.8,zeroEffects())).ok,false);
  assert.equal(evaluateEmotion(s,candidate(appraisal(s),'ANGER',0.9,0)).ok,false);
});
test('restore rejects forged active state without current effect support',()=>{
  const s=active(),raw=JSON.parse(JSON.stringify(s));raw.lastAppraisal.candidates=appraisal(s).candidates;
  assert.equal(restoreEmotionState(raw).ok,false);
});
test('restore rejects active time in the future and initial subthreshold activation',()=>{
  const s=active();assert.equal(restoreEmotionState({...s,active:{...s.active,activatedAt:{tick:999,sequence:0}}}).ok,false);
  assert.equal(restoreEmotionState({...s,lastAppraisal:candidate(s.lastAppraisal!,'ANGER',0.6)}).ok,false);
});
test('restore rejects a hidden active emotion when last appraisal contains an activation-qualified candidate',()=>{
  const s=active();assert.equal(restoreEmotionState({...s,active:null}).ok,false);
});
test('restore rejects calm count impossible within the number of accepted events',()=>{
  let s=active();s=run(s,candidate(appraisal(s),'ANGER',0.4));
  assert.equal(s.revision,2);assert.equal(restoreEmotionState({...s,calmObservations:2}).ok,false);
});
test('restore rejects selecting weaker emotion over a strictly stronger activation-qualified candidate',()=>{
  const s=active();const last=candidate(s.lastAppraisal!,'FEAR',0.9,0.99);
  assert.equal(restoreEmotionState({...s,lastAppraisal:last}).ok,false);
});
