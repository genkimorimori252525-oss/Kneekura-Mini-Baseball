import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const realm=vm.createContext({});vm.runInContext(await readFile('tools/browser-bridge/live-pitcher-body-head-view-v62.js','utf8'),realm);
const head=realm.KneekuraPitcherBodyHeadView,plain=x=>JSON.parse(JSON.stringify(x));
const args={record:{},frame:{phase:'pitch'},sceneMs:1540,preparationMs:1540,
 pitcherActor:{position:{x:0,y:0,z:18.44},player:{height:1.9,throws:'R'}}};
const r=head.observe(args),l=head.observe({...args,pitcherActor:{...args.pitcherActor,player:{height:1.9,throws:'L'}}});
assert.deepEqual(plain(r.baseEye),{x:0,y:.254+1.9*.92,z:18.44});
assert.equal(r.offset.x,-l.offset.x);assert.equal(r.offset.z,l.offset.z);assert.equal(r.offset.y,l.offset.y);
assert(r.eye.z<r.baseEye.z&&r.eye.y<r.baseEye.y);
for(const at of [1540*.45,1540*.72,1540,1720,2090,2590]){
 const before=head.observe({...args,sceneMs:at-.001}),after=head.observe({...args,sceneMs:at+.001});
 assert(Math.hypot(...['x','y','z'].map(k=>after.eye[k]-before.eye[k]))<1e-5,'continuous delivery/release/recovery joint');
}
assert.deepEqual(plain(head.observe({...args,sceneMs:3000}).offset),{x:0,y:0,z:0});
const future={...args,record:{get frames(){throw Error('future trajectory read');}}};assert.deepEqual(plain(head.observe(future)),plain(r));
head.configure({enabled:false});assert.deepEqual(plain(head.observe(args).eye),plain(r.baseEye));
head.configure({enabled:true,scale:0});assert.deepEqual(plain(head.observe(args).eye),plain(r.baseEye));
head.configure({scale:2});assert.equal(head.observe(args).offset.z,r.offset.z*2);
head.configure({scale:1});assert.deepEqual(plain(head.observe(args)),plain(r));
const away=head.observe({...args,record:null,pitcherActor:{...args.pitcherActor,position:{x:5,y:0,z:18.44}}});
assert.equal(away.eye.y,1.9*.92);assert.equal(away.eye.x,5);
for(const invalid of [{scale:2.01},{scale:NaN},{enabled:1},{other:1}])assert.throws(()=>head.configure(invalid));
console.log(JSON.stringify({pass:true,checks:['mound and body eye','mirrored throwing shoulder','continuous release and recovery','no future payload read','off and scale and deterministic rewind','actual moving actor root','validation']}));
