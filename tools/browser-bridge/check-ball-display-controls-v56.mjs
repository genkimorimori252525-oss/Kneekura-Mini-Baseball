import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const context={},path=process.argv[2]??'tools/browser-bridge/live-ball-display-controls-v56.js';
runInNewContext(await readFile(path,'utf8'),context);
const api=context.KneekuraBallDisplayControls,plain=value=>JSON.parse(JSON.stringify(value));
assert.equal(api.version,1);assert(Object.isFrozen(api));assert(Object.isFrozen(api.defaults));
assert.deepEqual(plain(api.defaults),{perspective:1,overhead:1});
assert.deepEqual(plain(api.normalizeSettings()),{perspective:1,overhead:1});
assert.deepEqual(plain(api.inspect()),{perspective:1,overhead:1});assert(Object.isFrozen(api.inspect()));
assert.deepEqual(plain(api.normalizeSettings({overhead:8})),{perspective:1,overhead:8});
assert.deepEqual(plain(api.inspect()),{perspective:1,overhead:1},'normalization is pure');
api.configure({perspective:.25});const saved=api.inspect();
api.configure({overhead:8});assert.deepEqual(plain(saved),{perspective:.25,overhead:1},'prior snapshots stay immutable');
assert.deepEqual(plain(api.inspect()),{perspective:.25,overhead:8});
for(const camera of ['batter','catcher','mound','fielder','runner','unknown',undefined,null])assert.equal(api.scaleFor(camera),.25);
assert.equal(api.scaleFor('overhead'),8);
// The caller is outside the VM's realm; no prototype identity with iframe
// Object.prototype is required. Null-prototype JSON data is also accepted.
assert.deepEqual(plain(api.configure({perspective:2.5})),{perspective:2.5,overhead:8});
const nullPrototype=Object.assign(Object.create(null),{overhead:.25});api.configure(nullPrototype);
assert.deepEqual(plain(api.inspect()),{perspective:2.5,overhead:.25});
let getterCalled=false;const getter={};Object.defineProperty(getter,'overhead',{enumerable:true,get(){getterCalled=true;return 2;}});
const symbolGetter={};Object.defineProperty(symbolGetter,Symbol.toStringTag,{get(){getterCalled=true;return 'Object';}});
const before=plain(api.inspect()),bad=[null,[],1,'1',true,new Date(),new Map(),()=>({}),{unknown:1},
 {perspective:0},{perspective:.249999},{overhead:8.00001},{overhead:NaN},{perspective:Infinity},{perspective:-Infinity},
 {overhead:'2'},{overhead:undefined},{perspective:2,overhead:99},getter,symbolGetter,{[Symbol('unknown')]:1},
 Object.defineProperty({},'overhead',{value:2,enumerable:false}),{perspective:new Number(2)}];
for(const value of bad){
 assert.throws(()=>api.normalizeSettings(value));assert.deepEqual(plain(api.inspect()),before,'invalid normalization does not write state');
 assert.throws(()=>api.configure(value));assert.deepEqual(plain(api.inspect()),before,'invalid patch is atomic');
}
assert.equal(getterCalled,false,'neither string nor symbol getters execute');
api.configure({perspective:3,overhead:4});api.configure({});assert.deepEqual(plain(api.inspect()),{perspective:3,overhead:4});
assert.deepEqual(plain(api.normalizeSettings({perspective:2})),{perspective:2,overhead:1},'normalize uses defaults rather than current state');
const source={position:{x:1,y:2,z:3},spin:{x:-200,y:1,z:3},radiusM:.0366},sourceBefore=JSON.stringify(source);
for(const camera of ['overhead','batter','catcher','mound','fielder','runner'])api.scaleFor(camera);
assert.equal(JSON.stringify(source),sourceBefore);assert.deepEqual(Object.keys(api).sort(),['version','defaults','normalizeSettings','configure','inspect','scaleFor'].sort());
console.log(JSON.stringify({pass:true,scope:'display diameter multipliers only; no ball physics or frame-rate controls',
 checks:['defaults/pure normalize','partial merge/immutable snapshots','cross-realm/null-prototype','all camera mappings',
  'strict primitive ranges/keys/descriptors/symbols','atomic rejection without getter execution','no Source inputs'],invalidCases:bad.length}));
