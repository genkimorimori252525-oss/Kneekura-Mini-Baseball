import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FIXED,referenceDesign,symmetricDesign,validateDesign,wallAt,outline,editableCopy,segmentMinimumDistance} from './model.mjs';
test('reference circle keeps the existing 110m/35m/3m field and fixed diamond',()=>{
  const v=validateDesign(referenceDesign());assert(v.ok);assert(v.warnings.length>0);
  assert.equal(wallAt(v.geometry,0).distanceMeters,110);assert.equal(wallAt(v.geometry,Math.PI).distanceMeters,35);
  assert.equal(FIXED.baseDistanceMeters,27.432);assert.equal(FIXED.pitcherPlateFrontMeters,18.4404);assert(Object.isFrozen(FIXED));
});
test('MLB new field requirements are separate from existing reference geometry',()=>{
  const d=referenceDesign();d.ruleset='mlb_new_2026';assert.equal(validateDesign(d).ok,false);
  assert(validateDesign(symmetricDesign()).ok);
});
test('polygon ray intersection reaches actual straight walls, not polar interpolation',()=>{
  const d=symmetricDesign();const g=validateDesign(d).geometry,a=g.fencePoints[0],b=g.fencePoints[1],theta=-33.75*Math.PI/180,
    q=wallAt(g,theta),cross=(p,r)=>p.x*r.z-p.z*r.x;
  assert(Math.abs(cross({x:q.position.x-a.x,z:q.position.z-a.z},{x:b.x-a.x,z:b.z-a.z}))<1e-8);
  assert(Math.abs(wallAt(g,-Math.PI/4).distanceMeters-100)<1e-10);
  assert(Math.abs(q.distanceMeters-108)>.1);
});
test('per-position height and asymmetric walls retain fixed base profile',()=>{
  const d=symmetricDesign();d.fencePoints[0].heightMeters=12;d.fencePoints[4].heightMeters=1;
  d.fencePoints[4].distanceMeters=104;const g=validateDesign(d).geometry;
  assert.equal(wallAt(g,-Math.PI/4).heightMeters,12);assert.equal(wallAt(g,Math.PI/4).heightMeters,1);
  assert.equal(g.fixedLayoutId,FIXED.id);assert(Object.isFrozen(g.vertices));
});
test('checks nearest point on segment as well as authored anchors',()=>{
  const d=editableCopy(referenceDesign());d.fencePoints.forEach(p=>p.distanceMeters=76.2);
  const v=validateDesign(d);assert(!v.ok);assert(v.errors.some(e=>e.message.includes('点と点の間')));
  assert.equal(segmentMinimumDistance({x:3,z:4},{x:3,z:-4}),3);
});
test('rejects attempts to move bases or rotate foul lines through JSON',()=>{
  for(const key of ['bases','fixed','foulAngleDegrees','mound']){
    const d=symmetricDesign();d[key]={x:3};const v=validateDesign(d);assert(!v.ok);assert(v.errors.some(e=>e.path===key));
  }
  const d=symmetricDesign();d.fencePoints[0].angleDegrees=-40;assert(!validateDesign(d).ok);
});
test('rejects invalid/nonfinite values, duplicate points, missing anchors and frozen-reference mutations',()=>{
  for(const n of [null,NaN,Infinity,-1,31]){const d=symmetricDesign();d.fencePoints[0].heightMeters=n;assert(!validateDesign(d).ok);}
  const duplicate=symmetricDesign();duplicate.fencePoints.push({...duplicate.fencePoints[1],id:'extra'});assert(!validateDesign(duplicate).ok);
  const missing=symmetricDesign();missing.fencePoints.pop();assert(!validateDesign(missing).ok);
  const r=referenceDesign();r.foul.backstopMeters=40;assert(!validateDesign(r).ok);
});
test('does not invoke getters and never mutates input',()=>{
  let read=0;const d=symmetricDesign();Object.defineProperty(d,'bases',{enumerable:true,get(){read++;return {};}});
  assert(!validateDesign(d).ok);assert.equal(read,0);
  const clean=symmetricDesign(),before=JSON.stringify(clean);validateDesign(clean);assert.equal(JSON.stringify(clean),before);
});
test('full boundary is closed and all radial queries are finite, including foul territory and wrap',()=>{
  for(const d of [referenceDesign(),symmetricDesign()]){const g=validateDesign(d).geometry,ring=outline(g);assert(Math.hypot(ring[0].x-ring.at(-1).x,ring[0].z-ring.at(-1).z)<1e-10);
    for(let i=-720;i<=720;i++){const w=wallAt(g,i*Math.PI/180);assert(Number.isFinite(w.distanceMeters)&&w.distanceMeters>0);assert(Number.isFinite(w.heightMeters));}
  }
});
