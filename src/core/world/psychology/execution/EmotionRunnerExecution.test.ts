import { describe,it } from 'vitest';
import assert from 'node:assert/strict';
import { prepareEmotionExecution } from './ExecutionPreparation';
import { request,runnerSource,change,value } from './ExecutionFixtures.test-support';
import { decideRunnerMotionIntent } from '../../../sim/running/RunnerDecision';
import { buildRunnerMotionTrajectory,sampleRunnerMotionTrajectory } from '../../../sim/running/RunnerMotion';
const running=(active:boolean)=>{const r=request(active?'ANGER':null,{runningRiskDelta:0.4});return {...r,runner:runnerSource(r)};};
describe('real existing runner decision and motion consumer',()=>{
 it('neutral equals existing Core behavior exactly',()=>{const r=running(false),p=value(prepareEmotionExecution(r));const d=decideRunnerMotionIntent(r.runner.decision);assert.deepEqual(p.runner?.decision,d);assert.deepEqual(p.runner?.trajectory,buildRunnerMotionTrajectory(r.runner.body,d.motionIntent,r.runner.endTick-r.runner.body.tick,r.runner.parameters));});
 it('single risk input changes hold to advance and physically moves the runner',()=>{
  const normal=value(prepareEmotionExecution(running(false))),active=value(prepareEmotionExecution(running(true)));
  assert.equal(normal.runner?.decision.motionIntent.kind,'hold');assert.equal(active.runner?.decision.motionIntent.kind,'advance');
  assert.equal(normal.runner?.trajectory.endState.routeDistanceMeters,0);assert.ok(active.runner!.trajectory.endState.routeDistanceMeters>0);
  assert.deepEqual(normal.request.runner!.parameters,active.request.runner!.parameters);assert.deepEqual(normal.request.runner!.body,active.request.runner!.body);
 });
 it('active output equals original Core run with only margin changed',()=>{const r=running(true),p=value(prepareEmotionExecution(r)),d=decideRunnerMotionIntent({...r.runner.decision,minimumAdvanceSafetyMarginTicks:60});assert.deepEqual(p.runner?.decision,d);assert.deepEqual(p.runner?.trajectory,buildRunnerMotionTrajectory(r.runner.body,d.motionIntent,2000,r.runner.parameters));});
 it('physical reaction delay remains unchanged',()=>{const p=value(prepareEmotionExecution(running(true))),t=p.runner!.trajectory;assert.equal(sampleRunnerMotionTrajectory(t,114).routeDistanceMeters,0);assert.ok(sampleRunnerMotionTrajectory(t,200).routeDistanceMeters>0);assert.equal(p.runner!.decision.decisionTick,105);});
 it('fear can hold a previously safe advance without changing arrival estimates',()=>{const r=change(running(false),d=>d.runner.decision.perceivedCues[0].defenderControlTick=1920);const normal=value(prepareEmotionExecution(r));const afraid=change(r,d=>{const row=d.appraisal.model.rows.find((x:any)=>x.emotion==='FEAR');row.bias=1;row.effectsAtFullPressure.runningRiskDelta=-0.4;});const fear=value(prepareEmotionExecution(afraid));assert.equal(normal.runner!.decision.motionIntent.kind,'advance');assert.equal(fear.runner!.decision.motionIntent.kind,'hold');assert.equal(fear.runner!.decision.perceivedRaceMarginTicks,120);});
 it('non-running emotional effects cannot slow or speed the runner',()=>{const r=change(running(false),d=>{const row=d.appraisal.model.rows.find((x:any)=>x.emotion==='ANGER');row.bias=1;row.effectsAtFullPressure.swingDecisionShiftTicks=7;row.effectsAtFullPressure.throwIntentShiftTicks=8;row.effectsAtFullPressure.throwAggressionDelta=0.7;});assert.deepEqual(value(prepareEmotionExecution(r)).runner,value(prepareEmotionExecution(running(false))).runner);});
 for(const [name,context,kind] of [
  ['force',{forcedToAdvance:true},'advance'],['tag-up wait',{tagUp:{kind:'awaiting_first_touch'}},'hold'],
  ['retouch',{tagUp:{kind:'must_retouch',originBase:1}},'retreat'],
 ] as const)it('preserves '+name+' priority',()=>{const r=change(running(true),d=>Object.assign(d.runner.decision.perceivedWorld.knownContext,context));assert.equal(value(prepareEmotionExecution(r)).runner!.decision.motionIntent.kind,kind);});
 it('preserves recognized coach instruction over optional risk choice',()=>{const r=change(running(true),d=>d.runner.decision.perceivedWorld.communications=[{event:{sourceId:'coach',targetScope:{kind:'player',playerId:'player'},kind:'coach_signal',issuedAt:99,content:{kind:'runner_action',action:'hold'}},receivedAt:100,confidence:1}]);const p=value(prepareEmotionExecution(r));assert.equal(p.runner!.decision.reason,'coach_instruction');assert.equal(p.runner!.decision.motionIntent.kind,'hold');});
 it('preserves current-base threat priority',()=>{const r=change(running(true),d=>d.runner.decision.perceivedCues.push({kind:'current_base_threat',observedAt:100,confidence:1,runnerReturnTick:1800,defenderTagTick:1850}));assert.equal(value(prepareEmotionExecution(r)).runner!.decision.motionIntent.kind,'retreat');});
 it('computes a repeatable trajectory without consuming random state',()=>{const r=running(true);assert.deepEqual(prepareEmotionExecution(r),prepareEmotionExecution(structuredClone(r)));});
 it('short horizon preserves movement before an unreacted-to intent',()=>{const r=change(running(true),d=>d.runner.endTick=110);assert.equal(value(prepareEmotionExecution(r)).runner!.trajectory.endState.routeDistanceMeters,0);});
 it('motion output and request are detached and deeply immutable',()=>{const r=running(true),copy=structuredClone(r),p=value(prepareEmotionExecution(r));assert.deepEqual(r,copy);assert.notEqual(p.request.runner,r.runner);assert.ok(Object.isFrozen(p.runner!.trajectory.segments));assert.ok(Object.isFrozen(p.request.runner!.decision.perceivedWorld));});
 for(const [name,edit] of [
  ['wrong observer',(d:any)=>d.runner.decision.perceivedWorld.observerId='other'],['wrong actor',(d:any)=>d.runner.decision.runnerId='other'],
  ['stale body',(d:any)=>d.runner.body.tick--],['stale perception',(d:any)=>d.runner.decision.perceivedWorld.observationTime--],
  ['wrong world snapshot',(d:any)=>d.runner.frame={...d.frame,snapshotId:'other'}],['already-applied margin',(d:any)=>d.runner.decision.minimumAdvanceSafetyMarginTicks=60],
  ['past end',(d:any)=>d.runner.endTick=99],['future evidence',(d:any)=>d.runner.decision.perceivedCues[0].observedAt=101],
  ['unknown cue kind',(d:any)=>d.runner.decision.perceivedCues[0].kind='magic'],['bad base',(d:any)=>{d.runner.decision.perceivedWorld.knownContext.currentBase=5;d.runner.decision.perceivedWorld.knownContext.nextBase=6;}],
  ['bad tagup',(d:any)=>d.runner.decision.perceivedWorld.knownContext.tagUp={kind:'unknown'}],['backdated issued intent',(d:any)=>d.runner.decision.perceivedCues[0].observedAt=90],
  ['malformed physics',(d:any)=>d.runner.parameters.topSpeedMps=-1],['unrepresentable motion',(d:any)=>{d.runner.parameters.topSpeedMps=1e308;d.runner.parameters.accelerationMps2=1e308;d.runner.parameters.ticksPerSecond=1;d.runner.endTick=100000;}],
 ] as const)it('rejects '+name+' without partial adoption',()=>{const r=change(running(true),edit),result=prepareEmotionExecution(r);assert.equal(result.ok,false);assert.ok(!('state' in result));});
 it('future communications cannot be pulled into the current source frame',()=>{const r=change(running(true),d=>d.runner.decision.perceivedWorld.communications=[{event:{sourceId:'coach',targetScope:{kind:'team'},kind:'coach_signal',issuedAt:100,content:{kind:'runner_action',action:'advance'}},receivedAt:110,confidence:1}]);assert.equal(prepareEmotionExecution(r).ok,false);});
});
