import {test} from 'node:test';
import assert from 'node:assert/strict';
import {referenceDesign,russianDomeDesign,validateDesign} from './model.mjs';
import {blendMaterial,materialAt,detailZone,densityWeight,renderDetailRegion} from './surface-layers.mjs';
const geometry=d=>{const v=validateDesign(d);assert(v.ok,JSON.stringify(v.errors));return v.geometry;};
test('ordinary ground is untouched when no detailed material is present',()=>{
 const base={color:'#204060',alpha:.7};assert.equal(detailZone(undefined),null);assert.equal(detailZone(geometry(referenceDesign())),null);
 assert.equal(materialAt(undefined,{x:0,z:0},base),base);assert.equal(blendMaterial(base,null),base);
});
test('zone includes the wolf and surrounding grass, with a smooth outer transition',()=>{
 const zone=detailZone(geometry(russianDomeDesign()));assert.equal(zone.factor,6);assert(zone.halfX>14);assert(zone.halfZ>12.5);
 assert.equal(densityWeight(zone,{x:0,z:82}),1);assert.equal(densityWeight(zone,{x:zone.halfX,z:82}),1);
 assert.equal(densityWeight(zone,{x:zone.halfX+zone.featherMeters,z:82}),0);
 assert(Math.abs(densityWeight(zone,{x:zone.halfX+zone.featherMeters/2,z:82})-.5)<1e-12);
 let previous=1;for(let i=0;i<=100;i++){const w=densityWeight(zone,{x:zone.halfX+zone.featherMeters*i/100,z:82});assert(w<=previous+1e-12);assert(previous-w<.02);previous=w;}
 assert.equal(densityWeight(zone,{x:zone.halfX+zone.featherMeters,z:82+zone.halfZ+zone.featherMeters}),0);
});
test('decal blends into turf color before points are emitted, preserving ground opacity',()=>{
 const base={color:'#204060',alpha:.7},result=blendMaterial(base,{r:160,g:128,b:64,a:.5});
 assert.equal(result.color,'#606050');assert.equal(result.alpha,.7);assert.equal(result.logoCoverage,.5);assert.deepEqual(base,{color:'#204060',alpha:.7});
});
test('the fine lattice emits grass circles around the material, with proportional radius supplied to the shared dot primitive',()=>{
 const g=geometry(russianDomeDesign()),points=[],report=renderDetailRegion({geometry:g,
  project:p=>({x:p.x*4+250,y:p.z*4,depth:100}),groundAt:(x,y)=>({x:(x-250)/4,z:y/4}),surfaceAt:()=>({color:'#4a853e',alpha:.8}),grid:{step:()=>4},
  paint:(x,y,color,alpha,factor)=>points.push({x,y,color,alpha,factor})});
 assert(points.length>300);assert(report.fineGrassPoints>300);assert(report.transitionPoints>0);assert.equal(report.raster,'shared_circle_dots');
 assert(points.every(p=>p.factor===6&&p.color==='#4a853e'&&p.alpha>0&&p.alpha<=.8));
 assert(points.some(p=>p.alpha===.8));assert(points.some(p=>p.alpha<.4));
 assert(points.every(p=>Math.abs(p.x/(4/6)-Math.round(p.x/(4/6)))<1e-9));
});
test('material alpha, not the rectangular footprint, selects the minimum detail area',()=>{
 const zone=detailZone(geometry(russianDomeDesign()));assert.equal(zone.shape,'material_alpha_distance');
 assert.equal(densityWeight(zone,{x:0,z:82},()=>100),0);assert.equal(densityWeight(zone,{x:0,z:82},()=>0),1);
 assert.equal(densityWeight(zone,{x:0,z:82},()=>zone.marginMeters+zone.featherMeters),0);
});
test('surface cache changes independently of physical boundary and rejects unbounded detail inputs',()=>{
 const d=russianDomeDesign(),g=geometry(d);d.architecture.surfaceDetail.factor=4;const changed=geometry(d);
 assert.equal(changed.boundaryKey,g.boundaryKey);assert.notEqual(changed.surfaceKey,g.surfaceKey);
 for(const [key,value]of [['factor',0],['factor',2.5],['marginMeters',-1],['featherMeters',0]]){const bad=russianDomeDesign();bad.architecture.surfaceDetail[key]=value;assert(!validateDesign(bad).ok);}
 const old=russianDomeDesign();delete old.architecture.surfaceDetail;assert.equal(detailZone(geometry(old)).factor,3);
});
test('brightness and glow act on the logo material and leave the turf opacity intact',()=>{
 const base={color:'#204060',alpha:.7},logo={r:220,g:180,b:70,a:.4},normal=blendMaterial(base,logo),lit=blendMaterial(base,logo,{brightness:2,glow:.5});
 assert.notEqual(lit.color,normal.color);assert(lit.logoCoverage>normal.logoCoverage);assert(lit.logoGlow>0);assert.equal(lit.alpha,base.alpha);assert.equal(normal.logoGlow,0);
 assert.equal(blendMaterial(base,null,{brightness:3,glow:1}),base);
});
