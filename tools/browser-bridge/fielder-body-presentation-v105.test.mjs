import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
const scope=vm.createContext({});vm.runInContext(readFileSync('tools/browser-bridge/fielder-body-presentation-v105.js','utf8'),scope);
const create=scope.KneekuraFielderBodyPresentationV105.rowMap;
const input={baseline:96.25,referenceHeight:94.25,heightMeters:1.8,crouchMeters:.648};
test('standing and legacy actors take the original PNG raster path exactly',()=>{
 assert.equal(create({...input,crouchMeters:0}),null);assert.equal(create({...input,crouchMeters:undefined}),null);
 assert.equal(create({...input,heightMeters:NaN}),null);
});
test('keeps feet fixed and translates the head and torso without scaling their pixels',()=>{
 const map=create(input);assert.equal(map.map(input.baseline),input.baseline);
 const head=12,shoulder=30;assert(Math.abs((map.map(shoulder)-map.map(head))-(shoulder-head))<1e-12);
 assert(Math.abs(map.delta*.90*input.heightMeters/input.referenceHeight-input.crouchMeters)<1e-12);
 assert(Math.abs(map.map(map.hip)-map.split)<1e-12);
 assert(Math.abs(map.map(map.hip+1)-map.split)<1,'lower body folds rather than translating the foot');
});
test('remains monotone, invertible and continuous through the hip at the maximum allowed crouch',()=>{
 for(const heightMeters of [1.1,1.8,2.5]){const map=create({...input,heightMeters,crouchMeters:heightMeters*.45});
  let previous=-Infinity;for(let y=0;y<=120;y+=.125){const out=map.map(y);assert(out>previous);assert(Math.abs(map.unmap(out)-y)<1e-9);previous=out;}
  assert(Math.abs(map.map(map.hip-1e-8)-map.map(map.hip+1e-8))<3e-8);
 }
});
