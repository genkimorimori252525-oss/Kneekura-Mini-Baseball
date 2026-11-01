import test from 'node:test';import assert from 'node:assert/strict';
import {koshienDesign,russianDomeDesign,validateDesign,wallAt,FIXED} from './model.mjs';
import {koshienSeatPoint} from './koshien-mesh.mjs';import {koshienGround} from './koshien-materials.mjs';import {stadiumMesh,renderStadium} from './stadium-mesh.mjs';
test('only Koshien rounds its rear boundary and preserves the three authored distances',()=>{
 const d=koshienDesign(),g=validateDesign(d).geometry;
 for(const [deg,dist]of [[180,18.4],[-90,28],[90,28]])assert(Math.abs(wallAt(g,deg*Math.PI/180).distanceMeters-dist)<1e-9);
 assert(wallAt(g,135*Math.PI/180).distanceMeters>21);assert.equal(g.fixedLayoutId,FIXED.id);
 const other=russianDomeDesign();other.ruleset=d.ruleset;other.foul=structuredClone(d.foul);other.fencePoints=structuredClone(d.fencePoints);const old=validateDesign(other).geometry;
 assert(wallAt(old,135*Math.PI/180).distanceMeters<20);assert.notEqual(old.boundaryKey,g.boundaryKey);
 d.foul.backstopMeters=30;const wider=validateDesign(d).geometry;assert.equal(wallAt(wider,Math.PI).distanceMeters,30);assert(koshienSeatPoint(0,0,0,wider).z<koshienSeatPoint(0,0,0,g).z);
});
test('black infield soil continues into foul ground and behind home without moving the diamond',()=>{
 const base={color:'#39712b',alpha:1};for(const p of [{x:0,z:-8},{x:10,z:0},{x:24,z:12}])assert.notEqual(koshienGround(p,base).color,base.color);
 const behind=koshienGround({x:0,z:-18},base);assert.notEqual(behind.color,koshienGround({x:0,z:-8},base).color);assert.equal(FIXED.baseDistanceMeters,27.432);
});
test('rear seat edge follows the authored rounded wall and net has no opaque panels',()=>{
 const g=validateDesign(koshienDesign()).geometry,m=stadiumMesh(g);for(let i=-12;i<=12;i++){const p=koshienSeatPoint(i/168,0,0,g),edge=wallAt(g,Math.atan2(p.x,p.z));assert(Math.hypot(p.x,p.z)>edge.distanceMeters+.4);}
 assert.equal(m.net.panels.length,12);assert.equal(m.net.meshSpacingMeters,.08);assert(!m.surfaces.some(s=>s.id.includes('net-')));assert(m.segments.some(s=>s.id==='koshien-net-support'&&s.alpha<1));
 for(const panel of m.net.panels){assert(panel.topP.z<panel.p.z);assert(panel.topQ.z<panel.q.z);assert(panel.topP.y<=m.roof.y);}
});
test('net mesh uses near-view world projection and never writes opaque cells',()=>{
 const g=validateDesign(koshienDesign()).geometry,render=eye=>{const cam={eye,yaw:0,pitch:Math.atan2(eye.y-1.2,28-eye.z),f:430,cx:300,cy:235},sp=Math.sin(cam.pitch),cp=Math.cos(cam.pitch),step=10/3,
 project=p=>{const dy=p.y-eye.y,dz=p.z-eye.z,depth=-sp*dy+cp*dz;return depth<.12?null:{x:300+430*p.x/depth,y:235-430*(cp*dy+sp*dz)/depth,depth};},cells=[],grid={step:()=>step,floor:n=>Math.floor(n/step)*step,ceil:n=>Math.ceil(n/step)*step};
 const r=renderStadium({geometry:g,cam,project,grid,crowd:{visible:false},paint:(x,y,d,color,alpha,owner,glow,density,id)=>{if(id?.startsWith('koshien-net-'))cells.push({alpha,id});}});return{r,cells};};
 const near=render({x:0,y:8.5,z:-koshienDesign().foul.backstopMeters-13}),far=render({x:0,y:95,z:-150});assert(near.r.net.meshLines>0);assert.equal(far.r.net.meshLines,0);assert(far.r.net.averagePanels>0);assert(near.cells.length>0);assert(near.cells.every(c=>c.alpha>0&&c.alpha<1));assert(near.cells.filter(c=>c.id==='koshien-net-mesh').every(c=>c.alpha<=.1));
});
