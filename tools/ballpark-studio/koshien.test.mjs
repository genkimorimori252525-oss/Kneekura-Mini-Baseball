import {test} from 'node:test';import assert from 'node:assert/strict';
import {koshienDesign,validateDesign,FIXED,dodgerStadiumDesign,russianDomeDesign} from './model.mjs';
import {stadiumMesh} from './stadium-mesh.mjs';import {materialAt,detailZone} from './surface-layers.mjs';
import {koshienIvyCoverage,KOSHIEN_MOUND} from './koshien-materials.mjs';
test('Koshien has independent validated design and published anchor dimensions',()=>{
 const d=koshienDesign(),v=validateDesign(d);assert(v.ok,JSON.stringify(v.errors));assert.equal(d.architecture.style,'koshien');
 assert.deepEqual(d.fencePoints.filter(p=>['LF','CF','RF'].includes(p.id)).map(p=>p.distanceMeters),[95,118,95]);assert.equal(d.architecture.capacity,47400);assert.equal(v.geometry.fixedLayoutId,FIXED.id);
 assert.equal(validateDesign(JSON.parse(JSON.stringify(d))).geometry.boundaryKey,v.geometry.boundaryKey);assert(v.warnings.length>0);
 const bad=structuredClone(d);bad.architecture.roof.openingPercent=50;assert(!validateDesign(bad).ok);
});
test('Koshien roof, ivy exterior, packed seats and central scoreboard share world geometry',()=>{
 const m=stadiumMesh(validateDesign(koshienDesign()).geometry);assert(m.surfaces.some(s=>s.id.startsWith('koshien-roof')));assert(m.surfaces.some(s=>s.material?.startsWith('koshien:ivy:')));
 assert(m.spectatorTiles>100);assert(m.surfaces.some(s=>s.crowdTile?.seatTint));assert.equal(m.lightTowers,4);assert.equal(m.roof.type,'fixed_canopy');assert.equal(m.scoreboard.z,144);
 assert.equal(m.scoreboard.layout,'koshien_split_black');assert(m.scoreboard.width/m.scoreboard.bodyHeight>=2.8);assert.equal(m.scoreboard.clock.bso.balls,3);
 assert(m.surfaces.some(s=>s.material==='koshien:clock'));assert(m.surfaces.some(s=>s.id.startsWith('koshien-flag')));
 for(const s of m.surfaces)for(const p of s.points)for(const k of ['x','y','z'])assert(Number.isFinite(p[k]));
});
test('ivy has bare and dense areas along a continuous wrapping facade',()=>{
 const samples=Array.from({length:168},(_,i)=>koshienIvyCoverage(i/168,12));assert(Math.min(...samples)<.1);assert(Math.max(...samples)>.8);
 for(const h of [0,7,12,20,29])assert(Math.abs(koshienIvyCoverage(0,h)-koshienIvyCoverage(1,h))<1e-10);
 for(let i=0;i<84;i++)assert(Math.abs(koshienIvyCoverage(i/84-1e-6,12)-koshienIvyCoverage(i/84+1e-6,12))<.001);
});
test('the central backscreen is grounded and has no crowd beneath the scoreboard',()=>{
 const m=stadiumMesh(validateDesign(koshienDesign()).geometry),crowd=m.surfaces.filter(s=>s.crowdTile);
 assert(!crowd.some(s=>{const x=s.points.reduce((n,p)=>n+p.x,0)/s.points.length,z=s.points.reduce((n,p)=>n+p.z,0)/s.points.length;return Math.abs(x)<30&&z>118;}));
 const base=m.surfaces.filter(s=>s.id.startsWith('koshien-backscreen-plinth'));assert(base.length>=5);assert.equal(Math.min(...base.flatMap(s=>s.points.map(p=>p.y))),0);assert.equal(Math.max(...base.flatMap(s=>s.points.map(p=>p.y))),m.scoreboard.baseY);
 assert(m.surfaces.some(s=>s.material==='koshien:backscreen'));assert(m.surfaces.some(s=>s.id.startsWith('koshien-backscreen-stair')));
});
test('Koshien black soil is presentation only and never becomes a wolf/LA fine region',()=>{
 const g=validateDesign(koshienDesign()).geometry,base={color:'#39aa36',alpha:.7};assert.notEqual(materialAt(g,{x:0,z:22},base).color,base.color);assert.equal(detailZone(g).id,'koshien-mound-material');
 assert.equal(materialAt(g,null,null),null);assert.equal(materialAt(g,{x:0,z:140},null),null);
 assert.equal(validateDesign(dodgerStadiumDesign()).design.architecture.style,'dodger_stadium');assert.equal(validateDesign(russianDomeDesign()).design.architecture.style,'russian_dome');
});
test('mound wear and the small rear cover use local ground materials at real scale',()=>{
 const g=validateDesign(koshienDesign()).geometry,base={color:'#42352d',alpha:.94},m=KOSHIEN_MOUND,at=p=>materialAt(g,p,base);
 const top=at(m.center),cover=at(m.cover),outside=at({x:5,z:m.center.z});assert.notEqual(top.color,outside.color);assert.notEqual(cover.color,top.color);assert(m.cover.z>18.4404);assert(m.cover.radius<.3);
 const zone=detailZone(g);assert(zone.halfX<=.5&&zone.halfZ<=.5);assert.equal(zone.center,m.cover);assert.equal(g.fixedLayoutId,FIXED.id);
});

test('Sankyu signs share the grounded backscreen and the existing logo visibility setting',()=>{
 const d=koshienDesign(),m=stadiumMesh(validateDesign(d).geometry),sides=m.surfaces.filter(s=>s.material==='koshien:sankyu-side'),center=m.surfaces.filter(s=>s.material==='koshien:sankyu');
 assert.equal(sides.length,2);assert.equal(center.length,1);assert(sides[0].points.every(p=>p.x<0));assert(sides[1].points.every(p=>p.x>0));
 for(const s of [...sides,...center])assert(s.points.every(p=>p.y>=3.25&&p.y<=6.1&&p.z<120),'both characters and the central band must clear the 3m front fence');assert(m.surfaces.some(s=>s.material==='koshien:backscreen'));
 d.architecture.details.logos=false;const hidden=stadiumMesh(validateDesign(d).geometry);assert(!hidden.surfaces.some(s=>s.material?.startsWith('koshien:sankyu')));assert(hidden.surfaces.some(s=>s.material==='koshien:backscreen'));
});
