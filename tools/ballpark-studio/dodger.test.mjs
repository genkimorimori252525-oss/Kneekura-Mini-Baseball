import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dodgerStadiumDesign,russianDomeDesign,validateDesign,FIXED,wallAt} from './model.mjs';
import {stadiumMesh} from './stadium-mesh.mjs';
import {sampleDodgerGround,distanceToLaWorld} from './dodger-materials.mjs';
import {materialAt,detailZone,densityWeight} from './surface-layers.mjs';
import {dodgerSeatPoint} from './dodger-stands.mjs';
test('Dodger preset uses official listed dimensions and keeps the shared diamond',()=>{
 const d=dodgerStadiumDesign(),v=validateDesign(d);assert(v.ok,JSON.stringify(v.errors));
 for(const [angle,feet]of [[-45,330],[-22.5,385],[0,395],[22.5,385],[45,330]])assert(Math.abs(wallAt(v.geometry,angle*Math.PI/180).distanceMeters-feet*.3048)<1e-8);
 assert.equal(d.architecture.style,'dodger_stadium');assert.equal(d.architecture.capacity,56000);assert.equal(d.architecture.roof.type,'open');assert.equal(d.architecture.logo.enabled,false);assert.equal(FIXED.baseDistanceMeters,27.432);
 assert.deepEqual(validateDesign(JSON.parse(JSON.stringify(d))).design,d);
});
test('Dodger architecture has separate pavilions, twins boards and a clear center eye',()=>{
 const g=validateDesign(dodgerStadiumDesign()).geometry,m=stadiumMesh(g);
 assert.equal(m.scoreboard.boards.length,2);assert.equal(m.lightTowers,6);assert.equal(m.roof.type,'open');
 assert.equal(m.seating.decks,5);assert(m.seating.aisles>100);assert(m.surfaces.some(s=>s.id.startsWith('dodger-walkway')));
 assert(m.surfaces.some(s=>s.id.startsWith('dodger-eye')));
 assert(m.surfaces.filter(s=>s.crowdTile).length>100);
 assert(m.surfaces.every(s=>s.points.every(p=>Number.isFinite(p.x+p.y+p.z))));
 assert(!m.surfaces.some(s=>s.material==='wolf'));
 assert(!m.surfaces.some(s=>s.crowdTile&&s.points.every(p=>Math.abs(p.x)<9&&p.z>120)));
});
test('architectural horseshoe follows the smooth foul edge without changing anchor distances',()=>{
 for(let i=0;i<=100;i++){const u=i/100,p=dodgerSeatPoint(u,0,2),q=dodgerSeatPoint(1-u,0,2);assert(Math.abs(p.x+q.x)<1e-8);assert(Math.abs(p.z-q.z)<1e-8);assert(Number.isFinite(dodgerSeatPoint(u,60,40).x));if(i<100){const n=dodgerSeatPoint(u+.01,0,2);assert(Math.hypot(n.x-p.x,n.z-p.z)<5);}}
 const home=dodgerSeatPoint(.5,0,2),back=dodgerSeatPoint(.5,60,40);assert.equal(home.z,-23.3);assert.equal(back.z,-83.3);
});
test('Tambov preset and full roof remain unchanged by the new style',()=>{
 const d=russianDomeDesign(),v=validateDesign(d);assert(v.ok);const m=stadiumMesh(v.geometry);
 assert.equal(d.architecture.style,'russian_dome');assert.equal(d.architecture.logo.brightness,.8);assert.equal(d.architecture.capacity,120000);assert.equal(wallAt(v.geometry,0).distanceMeters,128);assert(m.surfaces.some(s=>s.material==='wolf'));
 const bad=dodgerStadiumDesign();bad.architecture.roof.type='retractable';assert(!validateDesign(bad).ok);
});
test('LA paint shares the grass material and refines the glyph rather than its whole rectangle',()=>{
 const g=validateDesign(dodgerStadiumDesign()).geometry,p={x:-1.62,z:-7.8},zone=detailZone(g);
 assert(sampleDodgerGround(g,p));assert.equal(distanceToLaWorld(p),0);assert.equal(densityWeight(zone,p),1);
 assert.equal(sampleDodgerGround(g,{x:0,z:0}),null);assert.equal(densityWeight(zone,{x:-3,z:-6}),0);
 const dirt={color:'#885522',alpha:1};assert.deepEqual(materialAt(g,{x:15,z:30},dirt),dirt);
 const off=dodgerStadiumDesign();off.architecture.details.logos=false;const hidden=validateDesign(off).geometry;assert.equal(g.boundaryKey,hidden.boundaryKey);assert.notEqual(g.surfaceKey,hidden.surfaceKey);
});
