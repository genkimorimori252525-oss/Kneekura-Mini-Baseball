import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const path=process.argv[2]??'tools/browser-bridge/live-pitcher-body-head-view-v77.js',realm={};
vm.runInNewContext(await readFile(path,'utf8'),realm);
const api=realm.KneekuraPitcherBodyHeadView,base={frame:{phase:'pitch'},sceneMs:800,preparationMs:800,
 pitcherActor:{position:{x:0,y:0,z:18.44},player:{height:1.8,throws:'R'}}};
const original=api.observe({...base,record:{}});
const still=api.observe({...base,record:{play:{diagnostics:{pitchingMotion:{preparationMs:800,headMotionScale:0}}}}});
assert.deepEqual(JSON.parse(JSON.stringify(still.offset)),{x:0,y:0,z:0},'authored zero head movement must be used by the ordinary renderer');
const normal=api.observe({...base,record:{play:{diagnostics:{pitchingMotion:{preparationMs:800,headMotionScale:1}}}}});
assert.deepEqual(JSON.parse(JSON.stringify(normal)),JSON.parse(JSON.stringify(original)),'omitted and explicit scale1 have the same view');
const strong=api.observe({...base,record:{play:{diagnostics:{pitchingMotion:{preparationMs:800,headMotionScale:2}}}}});
for(const axis of['x','y','z'])assert.equal(strong.offset[axis],original.offset[axis]*2);
assert.deepEqual(api.inspectSettings(),api.defaults,'per-player settings never overwrite global debug settings');
console.log(JSON.stringify({pass:true,authoredMotionScales:[0,1,2],omittedLegacyExact:true,globalSettingsUnchanged:true}));
