import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const source=await readFile(new URL('./preview-bridge.js',import.meta.url),'utf8');
function fixture(pose){let draw;const p={role:'P',playerId:'p',position:{x:0,y:.254,z:18.4404},...(pose?{bodyPoseV105:{eye:pose}}:{})},actors=[p,{role:'batter',playerId:'b',position:{x:1,y:0,z:0}},{role:'C',playerId:'c',position:{x:0,y:0,z:-1}}],root={
 document:{getElementById:id=>id==='match-data'?{textContent:JSON.stringify({players:{p:{height:1.9},b:{height:1.8},c:{height:1.8}}})}:{}},liveMatchPlayback:{stop(){},inspect:()=>({currentFrame:{tick:0,actors}})},matchPreview:{liveDrawWorld:(observed,settings)=>{draw={observed,settings};return{fieldGeometry:{}};}},KneekuraBallparkGeometryV1:{wallAt:()=>({distanceMeters:18.4})}};
 vm.runInNewContext(source,{globalThis:root,structuredClone});const renderer=root.KneekuraBallparkRendererV1.install();return{renderer,last:()=>draw,geometry:{kind:'editable',maximumHeightMeters:3,architecture:{style:'koshien'}}};}
test('Koshien landscape uses canonical pitcher eyes and hides only the batter and observer',()=>{
 const f=fixture({x:.12,y:1.98,z:18.2}),before=f.renderer.sourceWorld();f.renderer.draw(f.geometry,{camera:'mound'});const o=f.last().observed;
 assert.equal(o.ballparkCameraV1.eye.y,1.98);assert.equal(o.ballparkCameraV1.eye.x,.12);assert(o.ballparkCameraV1.f<500);assert.deepEqual(Array.from(o.actors,a=>a.id),['C']);assert.deepEqual(f.renderer.sourceWorld(),before);
});
test('missing pose uses the same height factor as existing player eyes and keeps world coordinates',()=>{
 const f=fixture();f.renderer.draw(f.geometry,{camera:'mound'});const c=f.last().observed.ballparkCameraV1;assert.equal(c.eye.y,.254+1.9*.92);assert.equal(c.eye.z,18.4404);assert(Math.abs(Math.abs(c.yaw)-Math.PI)<1e-8);
});
test('other Koshien cameras and other stadium pitcher views retain the batter',()=>{
 const f=fixture();f.renderer.draw(f.geometry,{camera:'catcher'});assert(f.last().observed.actors.some(a=>a.id==='BAT'));
 f.renderer.draw({...f.geometry,architecture:{style:'dodger_stadium'}},{camera:'mound'});assert.equal(f.last().observed.ballparkCameraV1,undefined);assert(f.last().observed.actors.some(a=>a.id==='BAT'));
 f.renderer.draw(f.geometry,{camera:'mound',people:false});assert.equal(f.last().observed.actors.length,0);
});
