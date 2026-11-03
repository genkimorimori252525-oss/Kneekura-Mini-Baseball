import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const context={};runInNewContext(await readFile('tools/browser-bridge/live-batter-gaze.js','utf8'),context);
const observe=context.KneekuraLiveBatterGaze.observe,plain=value=>JSON.parse(JSON.stringify(value));
const record={beforeMatch:{half:'top'},command:{managedTeam:0,batting:'balance'},frames:[{tick:1000000}],
 play:{diagnostics:{swingOffered:true,sourceClockTicksPerSecond:1000000,referenceStartTick:1100000,referenceThroughTick:1600000,
  zoneJudgment:{observedForecastPosition:{x:.1,y:1,z:0},estimatedPosition:{x:9,y:9,z:9}},aimErrorMeters:{x:.01,y:-.02,z:.03}},
  contactMoment:{ball:{tick:1400000,position:{x:5,y:5,z:5}}}}};
const original=JSON.stringify(record),call=(ms,frame={tick:1000000,phase:'pitch'},r=record)=>observe({record:r,frame,sceneMs:1540+ms,preparationMs:1540});
assert.equal(call(-1),null);assert.equal(call(99.999),null);
for(const ms of [100,400,599.999]){
 const g=plain(call(ms));assert.deepEqual(g.target,{x:.11,y:.98,z:.03});assert.equal(g.releaseAtMs,2140);
}
assert.equal(call(600),null);assert.equal(call(10000),null);
const fractional=structuredClone(record);fractional.frames[0].tick=6686177;
Object.assign(fractional.play.diagnostics,{referenceStartTick:6991503,referenceThroughTick:7226101.652717371});
const exactEnd=1540+(fractional.play.diagnostics.referenceThroughTick-fractional.frames[0].tick)/1e6*1000;
assert.equal(observe({record:fractional,frame:{tick:7000000,phase:'pitch'},sceneMs:exactEnd,preparationMs:1540}),null,'fractional exact endpoint cannot round back into gaze');
assert.equal(call(200,{tick:1600000,phase:'pitch'}),null,'advanced physical tick cannot prolong gaze');
assert.equal(call(200,{tick:1200000,phase:'bench'}),null,'third out still ends play immediately');
assert.deepEqual(plain(call(200)),plain(call(200)),'rewind is deterministic');
assert.equal(call(200,{tick:1200000,phase:'pitch'},{...record,command:{managedTeam:0,batting:'bunt'}}),null);
assert(call(200,{tick:1200000,phase:'pitch'},{...record,command:{managedTeam:1,batting:'bunt'}}),'other team instruction does not suppress this swing');
for(const patch of [{swingOffered:false},{referenceThroughTick:NaN},{aimErrorMeters:null}]){
 const r=structuredClone(record);Object.assign(r.play.diagnostics,patch);assert.equal(call(200,undefined,r),null);
}
const differentClock=structuredClone(record);
differentClock.frames[0].tick=1000;Object.assign(differentClock.play.diagnostics,{sourceClockTicksPerSecond:1000,referenceStartTick:1100,referenceThroughTick:1600});
assert.deepEqual(plain(call(200,{tick:1000,phase:'pitch'},differentClock)),{...plain(call(200)),startTick:1100,throughTick:1600});
assert.equal(call(200,undefined,null),null);assert.equal(JSON.stringify(record),original,'Source is read-only');
console.log('PASS: planned target, finite clock boundaries, ended/frozen frames, take/bunt, rewind, source-clock scaling and no mutation');
