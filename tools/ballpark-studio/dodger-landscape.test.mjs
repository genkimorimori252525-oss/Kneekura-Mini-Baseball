import {test} from 'node:test';import assert from 'node:assert/strict';
import {dodgerStadiumDesign,validateDesign,russianDomeDesign} from './model.mjs';
import {stadiumMesh} from './stadium-mesh.mjs';
import {landscapeMaterial} from './dodger-landscape.mjs';
test('surroundings are terrain, parking and broad canopy masses outside the stadium footprint',()=>{
 const d=dodgerStadiumDesign(),g=validateDesign(d).geometry,m=stadiumMesh(g),land=m.surfaces.filter(s=>s.material?.startsWith('dodger:landscape:'));
 assert(land.length>200);assert(m.landscape.groves>=12);assert(m.landscape.parkingPatches>0);assert.equal(m.landscape.individualTrees,0);
 assert(land.every(s=>s.points.every(p=>Math.hypot(p.x/m.landscape.rx,(p.z-45)/m.landscape.rz)>=m.landscape.innerRadius-.001)));
 const groves=land.filter(s=>s.id.startsWith('dodger-canopy'));assert(groves.length>100);assert(groves.some(s=>Math.abs(s.points[0].z-s.points[2].z)>1));assert(groves.some(s=>Math.abs(s.points[0].y-s.points[2].y)>1));
 assert(!m.segments.some(s=>['#427756','#8a8970'].includes(s.color)));
});
test('day/night and strength are optional and validate without rewriting old JSON',()=>{
 const old=dodgerStadiumDesign();assert.equal(old.architecture.atmosphere,undefined);assert.deepEqual(validateDesign(old).design,old);
 const night=validateDesign(old).geometry,day=structuredClone(old);day.architecture.atmosphere={period:'day',strength:.35};const v=validateDesign(day);assert(v.ok);assert.equal(v.geometry.boundaryKey,night.boundaryKey);assert.equal(v.geometry.surfaceKey,night.surfaceKey);
 const material=stadiumMesh(night).surfaces.find(s=>s.material?.startsWith('dodger:landscape:')).material;
 assert.notEqual(landscapeMaterial(material,.5,.5,v.geometry).color,landscapeMaterial(material,.5,.5,night).color);
 for(const atmosphere of [{period:'bad',strength:.35},{period:'night',strength:-1},{period:'day',strength:2},{period:'night',strength:NaN}]){const d=structuredClone(old);d.architecture.atmosphere=atmosphere;assert(!validateDesign(d).ok);}
 const off=structuredClone(old);off.architecture.atmosphere={period:'night',strength:0};assert(!stadiumMesh(validateDesign(off).geometry).surfaces.some(s=>s.material?.startsWith('dodger:landscape:')));
 assert(!stadiumMesh(validateDesign(russianDomeDesign()).geometry).surfaces.some(s=>s.material?.startsWith('dodger:landscape:')));
});
