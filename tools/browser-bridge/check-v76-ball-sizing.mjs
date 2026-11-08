import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const path=process.argv[2]??'tools/browser-bridge/live-ball-display-controls-v76.js',realm={};
vm.runInNewContext(await readFile(path,'utf8'),realm);
const api=realm.KneekuraBallDisplayControls,plain=v=>JSON.parse(JSON.stringify(v));
const size=(y,factor,projected=.2,groundProjected=.15,groundDisplay=1.25,legacy=1.25,camera='overhead')=>{
 api.configure({overheadHeightEmphasis:factor});
 return api.heightSizingFor(camera,projected,groundProjected,groundDisplay,legacy,y).diameterPx;
};
// This is the user regression; the old v67 helper must fail here.
let lowCases=0;
for(const y of [0,.0366,.0732,.1098,.3,.5366])for(const factor of [1,1.000001,1.1,1.5,2,4,8]){
 assert.equal(size(y,factor),1.25,`air factor ${factor} changes a low ball at y=${y}`);lowCases++;
}
assert.equal(api.version,4);
assert.deepEqual(plain(api.defaults),{perspective:1,overhead:1,overheadHeightEmphasis:2});
assert.deepEqual(plain(api.normalizeImportedSettings({overhead:3})),{perspective:1,overhead:3,overheadHeightEmphasis:1});
assert.deepEqual(plain(api.normalizeSettings()),plain(api.defaults));
assert(Object.isFrozen(api)&&Object.isFrozen(api.defaults)&&Object.isFrozen(api.heightModel));
let highCases=0;
for(const [p,g,d,l] of [[.2,.15,1.25,1.25],[4,3,3,4],[2,2,2,2]]){
 for(const y of [1.5366,2,10,50])for(const factor of [2,2.5,4,8]){
  assert.equal(size(y,factor,p,g,d,l),d*Math.max(1,p/g)*factor);highCases++;
 }
 for(const y of [.5366,.8,1.0366,1.5366,20]){
  const nearOne=size(y,1+1e-8,p,g,d,l);assert(Math.abs(nearOne-l)<1e-6,'continuous near factor=1');
  let previous=size(y,1,p,g,d,l);
  for(let i=1;i<=700;i++){const next=size(y,1+i/100,p,g,d,l);assert(next>=previous-1e-10);previous=next;}
 }
 for(const factor of [1.1,1.5,2,8])for(const boundary of [.5366,1.5366])
  assert(Math.abs(size(boundary-1e-7,factor,p,g,d,l)-size(boundary+1e-7,factor,p,g,d,l))<1e-5,'continuous height join');
}
for(const camera of ['batter','catcher','mound','fielder','runner'])for(const factor of [1,2,8])
 assert.equal(size(4,factor,.2,.15,1.25,1.25,camera),1.25);
api.configure({perspective:3,overhead:4});assert.equal(api.scaleFor('overhead'),4);assert.equal(api.scaleFor('batter'),3);
const old=api.inspect();api.configure({overhead:2});assert.equal(old.overhead,4);assert(Object.isFrozen(old));
let getterCalled=false;const getter={};Object.defineProperty(getter,'overhead',{enumerable:true,get(){getterCalled=true;return 2;}});
const bad=[null,[],new Date(),{unknown:1},{overhead:0},{perspective:8.1},{overheadHeightEmphasis:.9},
 {overheadHeightEmphasis:NaN},{overheadHeightEmphasis:Infinity},{overhead:'2'},getter,{perspective:2,overhead:99},
 Object.defineProperty({},'overhead',{value:2,enumerable:false}),{[Symbol('x')]:2}];
const before=plain(api.inspect());
for(const input of bad)for(const method of ['configure','normalizeSettings','normalizeImportedSettings']){
 assert.throws(()=>api[method](input));assert.deepEqual(plain(api.inspect()),before);
}
assert.equal(getterCalled,false);
assert.throws(()=>size(NaN,2));assert.throws(()=>size(3,2,0));
console.log(JSON.stringify({pass:true,lowCases,highCases,invalidCases:bad.length,continuousAtMultiplierOne:true,
 groundProtectedClearanceMeters:.5,airFullClearanceMeters:1.5,highAirAtTwoAndAboveExact:true,physicsChanged:false}));
