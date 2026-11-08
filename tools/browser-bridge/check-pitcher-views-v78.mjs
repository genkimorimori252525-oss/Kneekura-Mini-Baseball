import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const context=vm.createContext({});
vm.runInContext(await readFile('docs/demos/baseball-maker-pitcher-views-v78.js','utf8'),context);
const api=context.KneekuraPitcherTrajectoryViewsV78;
const front={eye:{x:0,y:1,z:-1},target:{x:0,y:1,z:18.44}};
const back={eye:{x:0,y:1,z:20.44},target:{x:0,y:1,z:0}};
assert(api.project({x:.3,y:1,z:10},front).x>300);
assert(api.project({x:.3,y:1,z:10},back).x<300);
assert.equal(api.project({x:0,y:1,z:-1.01},front),null);
assert.equal(api.project({x:0,y:1,z:-.9},front),null);
assert.equal(api.projectPath([{x:0,y:1,z:0},{x:0,y:1,z:-2},{x:0,y:1,z:1}],front).length,2);
assert.throws(()=>api.project({x:NaN,y:1,z:1},front));

const initial=Object.freeze({x:.5,y:2,z:17.2});
const actual=t=>({position:Object.freeze({x:.5-t*.4,y:2-t*2,z:17.2-t*40})});
const baseline=t=>({position:Object.freeze({x:.5-t*.2,y:2-t*2.5,z:17.2-t*39})});
const trial=Object.freeze({input:{batter:{heightMeters:1.8}},fixedInitial:{position:initial},
  metrics:{flightSeconds:(17.2-.15)/40,measurementPlaneZ:.15,strikeZone:{centerX:0,halfWidth:.216,lowerY:.5,upperY:1.1}},
  pitch:{diagnostics:{sourceDescriptor:{throughElapsedSeconds:.7}}},sampleAtPitchElapsedSeconds:actual,sampleBaselineAtPitchElapsedSeconds:baseline});
const before=JSON.stringify(trial),model=api.observe(trial);
assert.equal(JSON.stringify(trial),before);
assert.equal(model.views.length,4);
assert.equal(model.views[0].id,'behind');
assert.equal(model.views[1].id,'catcher');
assert.equal(model.views[2].camera.eye.x,-.4);
assert.equal(model.views[3].camera.eye.x,.4);
assert(Math.abs(model.actual.at(-1).z-.15)<1e-8);
assert(Math.abs(model.baseline.at(-1).z-.15)<1e-8);
assert.notEqual(model.actual.length,0);
assert.notDeepEqual(model.views[2].actual,model.views[3].actual);
assert.equal(model.actual[0].x,initial.x);
assert.equal(model.baseline[0].x,initial.x);
for(const view of model.views){
 assert(view.actual.flat().length>10);
 assert(view.baseline.flat().length>10);
 assert.equal(view.zone.length,4);
 for(const p of [...view.actual.flat(),...view.baseline.flat(),...view.zone])assert(Number.isFinite(p.x)&&Number.isFinite(p.y));
}
const repeat=api.observe(trial);
assert.equal(JSON.stringify(model),JSON.stringify(repeat));
console.log(JSON.stringify({pass:true,views:4,sameSource:true,oppositeCameraHandedness:true,nearPlanePathBreak:true,baselineUsesOwnPlateTime:true,deterministic:true}));
