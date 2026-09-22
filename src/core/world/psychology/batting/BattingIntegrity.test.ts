import assert from 'node:assert/strict';
import { test } from 'vitest';
import { fixture, value, change } from './BattingFixtures.test-support';
import { physical } from './BattingPhysicalFixtures.test-support';
import { prepareBattingExecution } from './BattingCommitment';
import { resolveBattingExecution } from './BattingResolution';

test('between-knot overspeed cannot bypass the physical ceiling',()=>{
 const r=change(fixture(),d=>d.source.profiles[0].profile.followThroughSeconds=0.02);
 assert.equal(prepareBattingExecution(r).ok,false);
});
test('valid curved speed envelope does not fail merely because its first control hull is loose',()=>{
 const r=change(fixture(),d=>d.source.profiles[0].profile.followThroughSeconds=0.05);
 assert.equal(prepareBattingExecution(r).ok,true);
});
test('body and repertoire validity must still cover actual motor onset',()=>{
 const r=change(fixture(),d=>d.source.validUntilTick=d.currentFrame.time.tick+1);
 const p=physical(r);assert.equal(resolveBattingExecution(p).ok,false);
});
test('zero orientation quaternion cannot enter a trajectory',()=>{
 const r=change(fixture(),d=>d.source.predictions[0].trajectory.releaseOrientation={x:0,y:0,z:0,w:0});
 assert.equal(prepareBattingExecution(r).ok,false);
});
test('already-selected prediction expiry does not retroactively erase a commitment',()=>{
 const r=change(fixture(),d=>d.source.predictions[1].validUntilTick=d.currentFrame.time.tick);
 assert.equal(resolveBattingExecution(physical(r)).ok,true);
});
test('future observations cannot alter the frozen actor commitment',()=>{
 const r=fixture(),before=value(prepareBattingExecution(r));
 const after=change(r,d=>{const p=structuredClone(d.source.predictions[1]);p.predictionId='later';p.observedTick=180000;p.availableTick=190000;p.trajectory.start.position.x=3;d.source.predictions.push(p);});
 assert.deepEqual(value(prepareBattingExecution(after)).commitment,before.commitment);
});
for(const [name,mutate] of [
 ['unknown actor field',(d:any)=>d.source.actualTrajectory=d.source.predictions[0].trajectory],
 ['negative prediction time',(d:any)=>d.source.predictions[0].observedTick=-1],
 ['future state behind observation',(d:any)=>d.source.predictions[0].trajectory.start.tick=120000],
 ['different prediction clock',(d:any)=>d.source.predictions[0].trajectory.parameters.ticksPerSecond=1],
 ['different ball mass',(d:any)=>d.source.predictions[0].trajectory.parameters.aerodynamics.ballMassKg=1],
 ['invalid score',(d:any)=>d.source.predictions[0].swingScore=2],
 ['infinite position',(d:any)=>d.source.centerOfMass.x=Infinity],
 ['NaN calibration',(d:any)=>d.source.decisionModel.threshold=NaN],
 ['sparse predictions',(d:any)=>delete d.source.predictions[0]],
 ['duplicate prediction observation',(d:any)=>d.source.predictions[1].observedTick=d.source.predictions[0].observedTick],
 ['function input',(d:any)=>d.source.extra=()=>1],
 ['cyclic input',(d:any)=>d.source.extra=d.source],
 ['unknown strike-zone field',(d:any)=>d.source.strikeZone.buff=1],
 ['invalid strike-zone interval',(d:any)=>d.source.strikeZone.upperY=d.source.strikeZone.lowerY],
 ['unsafe motor latency',(d:any)=>d.source.motorLatencyTicks=Number.MAX_SAFE_INTEGER+1],
 ['unsafe source revision',(d:any)=>d.source.revision=Number.MAX_SAFE_INTEGER+1],
 ['empty repertoire',(d:any)=>d.source.profiles=[]],
 ['unordered repertoire',(d:any)=>d.source.profiles[1].minimumAggression=0],
 ['changing bat length',(d:any)=>d.source.profiles[1].profile.batLengthM=1.2],
 ['zero body speed ceiling',(d:any)=>d.source.maximumSweetSpotSpeedMps=0],
 ['zero integration step',(d:any)=>d.source.predictions[0].trajectory.parameters.integrationStepTicks=0],
 ['unbounded integration workload',(d:any)=>d.source.predictions[0].trajectory.endTick=Number.MAX_SAFE_INTEGER],
] as const)test(name+' rejects inertly',()=>{assert.equal(prepareBattingExecution(change(fixture(),mutate)).ok,false);});
test('getter input is rejected without executing it',()=>{
 const r=structuredClone(fixture());let called=false;Object.defineProperty(r.source,'sourceId',{get(){called=true;return 'x';},enumerable:true});
 assert.equal(prepareBattingExecution(r).ok,false);assert.equal(called,false);
});
test('physical forecast preserves source and input immutability',()=>{
 const r=physical(),snapshot=structuredClone(r),result=value(resolveBattingExecution(r));
 assert.deepEqual(r,snapshot);assert.ok(Object.isFrozen(result.request));assert.ok(Object.isFrozen(result.resolution));
});
