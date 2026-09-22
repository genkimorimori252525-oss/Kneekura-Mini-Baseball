import { describe,it } from 'vitest';
import assert from 'node:assert/strict';
import { prepareEmotionExecution } from './ExecutionPreparation';
import { acceptEmotionExecution } from './ExecutionAcceptance';
import { request,runnerSource,change,value } from './ExecutionFixtures.test-support';
import { replayEmotionEvents } from '../EmotionReplay';
import type { EmotionExecutionRequest } from './ExecutionTypes';
import type { EmotionEvaluationEvent } from '../EmotionTypes';
const r=()=>{const d=request('ANGER',{runningRiskDelta:0.4});return {...d,runner:runnerSource(d)};};
describe('coherent current-world execution acceptance',()=>{
 it('accepts one recomputed source/gate/decision/motion bundle',()=>{const x=r(),p=value(prepareEmotionExecution(x)),a=value(acceptEmotionExecution(x,p));assert.equal(a.kind,'EmotionExecutionAccepted');assert.equal(a.executionId,x.executionId);assert.equal(a.afterWorldRevision,11);assert.equal(a.beforeEmotionRevision,0);assert.equal(a.afterEmotionRevision,1);assert.deepEqual(a.expectedFrame,x.frame);assert.deepEqual(a.proposal,p);});
 it('accepts a storage roundtrip independent of key insertion order',()=>{const x=r(),p=value(prepareEmotionExecution(x));assert.equal(acceptEmotionExecution(structuredClone(x),JSON.parse(JSON.stringify(p))).ok,true);});
 it('repeat checking is pure, not repeated physical application',()=>{const x=r(),p=value(prepareEmotionExecution(x));assert.deepEqual(acceptEmotionExecution(x,p),acceptEmotionExecution(x,p));assert.equal(x.beforeEmotion.revision,0);assert.equal(x.runner.body.routeDistanceMeters,0);});
 it('all successful output is detached and frozen',()=>{const x=r(),p=value(prepareEmotionExecution(x)),a=value(acceptEmotionExecution(x,p));assert.notEqual(a.proposal,p);assert.ok(Object.isFrozen(a.proposal.runner!.trajectory.endState));assert.ok(Object.isFrozen(a.expectedFrame.scope));});
 it('failure does not expose a partially adopted gate or motion',()=>{const x=r(),p=value(prepareEmotionExecution(x)),bad=change(p,d=>d.inputs.minimumAdvanceSafetyMarginTicks=0),out=acceptEmotionExecution(x,bad);assert.equal(out.ok,false);assert.ok(!('value' in out));assert.equal(x.beforeEmotion.revision,0);});
 for(const [name,edit] of [
  ['effective risk',(d:any)=>d.inputs.minimumAdvanceSafetyMarginTicks--],['timing',(d:any)=>d.inputs.swingDecision.tick++],
  ['baseline',(d:any)=>d.request.baseline.throwAggression=0.7],['motion end',(d:any)=>d.runner.trajectory.endState.routeDistanceMeters++],
  ['motion decision',(d:any)=>d.runner.decision.motionIntent.kind='retreat'],['candidate',(d:any)=>d.appraisal.computation.appraisal.candidates[0].pressure=0.9],
  ['active influence',(d:any)=>d.appraisal.influence.effects.runningRiskDelta=0.8],['gate receipt',(d:any)=>d.appraisal.event.afterRevision++],
  ['gate state',(d:any)=>d.appraisal.state.revision++],['source snapshot',(d:any)=>d.request.frame.snapshotId='changed'],
  ['extra score',(d:any)=>d.score={runs:1}],['truncated runner',(d:any)=>d.runner=null],
  ['wrong algorithm',(d:any)=>d.algorithmVersion='something-else'],['full request',(d:any)=>d.request.executionId='different'],
 ] as const)it('rejects altered proposal '+name,()=>{const x=r(),p=value(prepareEmotionExecution(x));assert.equal(acceptEmotionExecution(x,change(p,edit)).ok,false);});
 for(const [name,edit] of [
  ['world revision',(d:any)=>{d.frame={...d.frame,worldRevision:11};d.baseline.frame=d.frame;d.runner.frame=d.frame;}],
  ['snapshot',(d:any)=>{d.frame={...d.frame,snapshotId:'new-world'};d.baseline.frame=d.frame;d.runner.frame=d.frame;}],
  ['baseline revision',(d:any)=>d.baseline.revision++],['baseline value under reused ID',(d:any)=>d.baseline.swingAggression=0.6],
  ['model version',(d:any)=>d.model.version='next'],['model contents under same version',(d:any)=>d.model.runningRiskTicksPerUnit=200],
  ['appraisal source',(d:any)=>d.appraisal.bundleId='new-bundle'],['appraisal row under same version',(d:any)=>d.appraisal.model.rows[0].bias=0.2],
  ['runner perception revision',(d:any)=>d.runner.revision++],['runner physics under same version',(d:any)=>d.runner.parameters.accelerationMps2=5],
  ['gate replaced',(d:any)=>{d.beforeEmotion.policy.thresholds[0].activation=0.9;d.appraisal.policy=d.beforeEmotion.policy;}],
 ] as const)it('rejects stale proposal after current '+name+' changes',()=>{const x=r(),p=value(prepareEmotionExecution(x)),current=change(x,edit);assert.equal(prepareEmotionExecution(current).ok,true);assert.equal(acceptEmotionExecution(current,p).ok,false);});
 it('rejects reuse after the host adopts the accepted revision',()=>{const x=r(),p=value(prepareEmotionExecution(x)),a=value(acceptEmotionExecution(x,p));const current=change(x,d=>{d.frame.worldRevision=a.afterWorldRevision;d.beforeEmotion=a.proposal.appraisal.state;});assert.equal(acceptEmotionExecution(current,p).ok,false);});
 it('world revision overflow never returns a receipt',()=>{const x=change(r(),d=>d.frame.worldRevision=Number.MAX_SAFE_INTEGER),p=value(prepareEmotionExecution(x));assert.equal(acceptEmotionExecution(x,p).ok,false);});
 it('a missed timing window stays explicit when accepting a running decision',()=>{const x=change(r(),d=>d.appraisal.model.rows.find((z:any)=>z.emotion==='ANGER').effectsAtFullPressure.swingDecisionShiftTicks=100);const p=value(prepareEmotionExecution(x)),a=value(acceptEmotionExecution(x,p));assert.equal(a.proposal.inputs.swingDecision.status,'MISSED_WINDOW');assert.equal(a.proposal.runner?.decision.motionIntent.kind,'advance');});
 it('replays a sequence from real accepted appraisal receipts without random draws',()=>{
  let previous:EmotionExecutionRequest=request(),state=previous.beforeEmotion;const initial=state,events:EmotionEvaluationEvent[]=[];
  for(let n=0;n<50;n++){
   const x=change(request(n%2===0?'ANGER':null,{runningRiskDelta:0.4}),d=>{
    const tick=100+n*10;d.frame={...d.frame,time:{tick,sequence:0},worldRevision:10+n,snapshotId:'world-'+n};d.baseline.frame=d.frame;
    for(const k of ['swingDecision','throwIntent','defenseReplan'])for(const f of ['tick','earliestTick','latestTick'])d.baseline[k][f]+=n*10;
    d.beforeEmotion=state;d.appraisal.expectedRevision=state.revision;d.executionId='execution-'+n;d.appraisal.appraisalId='appraisal-'+n;d.appraisal.bundleId='bundle-'+n;
    d.appraisal.importance.time=d.frame.time;for(const s of [d.appraisal.importance.competition,d.appraisal.importance.personal,d.appraisal.importance.rivalry,d.appraisal.player,d.appraisal.event])s.stamp.time=d.frame.time;
    d.appraisal.event.eventId='event-'+n;d.appraisal.evidenceEventIds=[d.appraisal.event.eventId];
   });
   const p=value(prepareEmotionExecution(x)),a=value(acceptEmotionExecution(x,p));state=a.proposal.appraisal.state;events.push(a.proposal.appraisal.event);previous=x;
  }
  const replay=value(replayEmotionEvents(initial,events));assert.deepEqual(replay,state);assert.equal(previous.frame.worldRevision,59);
 });
});
