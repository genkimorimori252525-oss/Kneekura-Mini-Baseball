import {test} from 'node:test';
import assert from 'node:assert/strict';
import {russianDomeDesign,validateDesign,referenceDesign,LEGACY_SCHEMA,FIXED,wallAt} from './model.mjs';
import {stadiumMesh,renderStadium} from './stadium-mesh.mjs';
test('dome preset has authored 105/128 dimensions, low fences and fixed diamond',()=>{
 const d=russianDomeDesign(),v=validateDesign(d);assert(v.ok,JSON.stringify(v.errors));
 assert(Math.abs(wallAt(v.geometry,Math.PI/4).distanceMeters-105)<1e-9);assert.equal(wallAt(v.geometry,0).distanceMeters,128);
 assert.equal(v.geometry.maximumHeightMeters,3);assert.equal(wallAt(v.geometry,0).heightMeters,1.3);
 assert.equal(v.geometry.architecture.capacity,120000);assert.equal(FIXED.baseDistanceMeters,27.432);assert(Object.isFrozen(v.geometry.architecture.roof));
});
test('old v1 geometry remains readable without injecting a dome',()=>{
 const d=referenceDesign();d.schema=LEGACY_SCHEMA;const v=validateDesign(d);assert(v.ok);assert.equal(v.geometry.architecture,null);assert.deepEqual(v.design,d);
});
test('architectural edits cannot smuggle fixed geometry, invalid colors or unbounded roof settings',()=>{
 for(const edit of [a=>a.bases=[],a=>a.roof.openingPercent=101,a=>a.roof.openingPercent=null,a=>a.capacity=Infinity,a=>a.capacity=120000.5,a=>a.tiers=7,a=>a.colors.gold='<img>',a=>a.roof.type='fake']){
  const d=russianDomeDesign();edit(d.architecture);assert(!validateDesign(d).ok);
 }
 const d=russianDomeDesign();d.schema=LEGACY_SCHEMA;assert(!validateDesign(d).ok);
});
test('leaves translate to a real central opening; capacity does not spawn spectator actors',()=>{
 const d=russianDomeDesign(),g=validateDesign(d).geometry,m=stadiumMesh(g);assert.equal(stadiumMesh(g),m);
 assert.equal(m.capacity,120000);assert.equal(m.tiers,5);assert.equal(m.spectatorLights,0);assert.equal(m.lights.length,0);assert(m.surfaces.length<5000);
 assert(m.roof.leftInnerEdge<0&&m.roof.rightInnerEdge>0);assert.equal(m.roof.rightInnerEdge-m.roof.leftInnerEdge,m.roof.halfX*2);assert(m.roof.halfX*2<=m.envelope.rx,'fully open leaves fit the shell');
 for(const p of [...m.surfaces.flatMap(s=>s.points),...m.lights.map(l=>l.p),...m.segments.flatMap(s=>[s.p,s.q])])for(const k of ['x','y','z'])assert(Number.isFinite(p[k]));
 for(const l of m.lights)assert(Math.hypot(l.p.x,l.p.z)>=wallAt(g,Math.atan2(l.p.x,l.p.z)).distanceMeters+2-1e-8);
 const blocks=m.surfaces.filter(s=>s.crowdTile);assert.equal(blocks.length,5*4*96);assert.equal(new Set(blocks.map(s=>s.crowdTile.id)).size,blocks.length);
 assert(blocks.some(s=>s.points.some(p=>Math.abs(p.z)<.01&&Math.abs(p.x)<21&&p.y<4)),'infield front row is close to the foul-side boundary');
 for(let tier=0;tier<5;tier++)for(let band=0;band<4;band++)assert.equal(blocks.filter(s=>s.crowdTile.tier===tier&&s.crowdTile.band===band).length,96);
 d.architecture.roof.openingPercent=0;const closed=stadiumMesh(validateDesign(d).geometry);assert.equal(closed.roof.leftInnerEdge,0);assert.equal(closed.roof.rightInnerEdge,0);
});
test('boundary cache changes for physical edits but is reusable for color and roof-only edits',()=>{
 const d=russianDomeDesign(),key=validateDesign(d).geometry.boundaryKey;
 d.architecture.roof.openingPercent=0;d.architecture.colors.red='#cc0011';assert.equal(validateDesign(d).geometry.boundaryKey,key);
 d.fencePoints.find(p=>p.id==='RF').distanceMeters=106;assert.notEqual(validateDesign(d).geometry.boundaryKey,key);
});
test('closed roof has no missing triangle-edge row on the fractional V84 lattice',()=>{
 const d=russianDomeDesign();d.architecture.roof.openingPercent=0;const g=validateDesign(d).geometry,
  cam={eye:{x:0,y:260,z:-230},yaw:0,pitch:Math.atan2(260,280),f:435,cx:300,cy:216},size=10/3,
  grid={step:()=>size,floor:n=>Math.floor(n/size)*size,ceil:n=>Math.ceil(n/size)*size,
   *range(a,b){for(let i=Math.round(a/size);i<=Math.round(b/size);i++)yield i*size;}},cells=new Map(),
  project=p=>{const dy=p.y-cam.eye.y,dz=p.z-cam.eye.z,up=Math.cos(cam.pitch)*dy+Math.sin(cam.pitch)*dz,depth=-Math.sin(cam.pitch)*dy+Math.cos(cam.pitch)*dz;
   return depth<.12?null:{x:300+435*p.x/depth,y:216-435*up/depth,depth};},
  paint=(x,y,depth,color)=>{const key=Math.round(x/size)+','+Math.round(y/size),old=cells.get(key);if(!old||depth<old.depth)cells.set(key,{depth,color});};
 renderStadium({geometry:g,project,paint,grid,cam,cutaway:false});
 const roof=stadiumMesh(g).roof,q=project({x:0,y:roof.y+4,z:(roof.z0+roof.z1)/2}),key=Math.round(q.x/size)+','+Math.round(q.y/size),target=cells.get(key);
 assert(target);assert(Math.abs(target.depth-q.depth)<8,'central closed leaf must cover its projected location');
 assert(target.depth<project({x:0,y:0,z:(roof.z0+roof.z1)/2}).depth-50);
});
test('logo settings validate a separate read-only grass feature',()=>{
 const d=russianDomeDesign();assert.equal(d.architecture.logo.detail,'fine');assert.equal(d.architecture.logo.centerZ,82);
 for(const edit of [l=>l.widthMeters=100,l=>l.centerZ=null,l=>l.detail='unbounded',l=>l.src='https://example.com/other.png']){const p=structuredClone(d);edit(p.architecture.logo);assert(!validateDesign(p).ok);}
 const old=structuredClone(d);delete old.architecture.logo;assert(validateDesign(old).ok);
});
test('fine detail supports five through eight; appearance is optional and invalid values are rejected',()=>{
 for(const factor of [5,6,7,8]){const d=russianDomeDesign();d.architecture.surfaceDetail.factor=factor;assert(validateDesign(d).ok);}
 const old=russianDomeDesign();delete old.architecture.crowd;delete old.architecture.logo.brightness;delete old.architecture.logo.glow;
 const before=JSON.stringify(old);assert(validateDesign(old).ok);assert.equal(JSON.stringify(old),before);
 for(const edit of [a=>a.surfaceDetail.factor=9,a=>a.logo.glow=2,a=>a.logo.brightness=10,a=>a.crowd.density=0,a=>a.crowd.size=5,a=>a.crowd.brightness=-1,a=>a.crowd.glow=2,a=>a.crowd.detail='tiny_actors']){
  const d=russianDomeDesign();edit(d.architecture);assert(!validateDesign(d).ok);
 }
});
test('attendance is optional in older JSON, while invalid modes are rejected',()=>{
 const d=russianDomeDesign();for(const mode of ['full','empty']){d.architecture.crowd.attendance=mode;assert(validateDesign(d).ok);}
 d.architecture.crowd.attendance='partial';assert(!validateDesign(d).ok);delete d.architecture.crowd.attendance;const before=JSON.stringify(d);assert(validateDesign(d).ok);assert.equal(JSON.stringify(d),before);
});

test('world architecture closes its shell, joins seating levels and uses image materials on both wolf boards',()=>{
 const d=russianDomeDesign(),m=stadiumMesh(validateDesign(d).geometry);
 assert.equal(m.surfaces.filter(s=>s.material==='wolf').length,2);
 assert.equal(m.surfaces.filter(s=>s.material?.startsWith('facade:')&&s.points[0].y===16).length,96);
 assert(m.envelope.eaveY>m.envelope.bowlTop);assert(m.envelope.topY>m.envelope.eaveY);
 for(const opening of [0,25,50,75,100]){d.architecture.roof.openingPercent=opening;const x=stadiumMesh(validateDesign(d).geometry);for(const z of [x.roof.z0,x.roof.z1]){const e=x.envelope,span=e.rx*(1-Math.abs((z-e.centerZ)/e.rz)**e.exponent)**(1/e.exponent);assert(x.roof.halfX*(1+opening/100)<=span,'leaf corners stay within the rounded shell');}}
 const old=russianDomeDesign();delete old.architecture.details;const before=JSON.stringify(old);assert(validateDesign(old).ok);assert.equal(JSON.stringify(old),before);
 for(const edit of [a=>a.details.factor=9,a=>a.details.logos=1,a=>a.details.ornaments=null]){const x=russianDomeDesign();edit(x.architecture);assert(!validateDesign(x).ok);}
 d.architecture.details.logos=false;d.architecture.details.ornaments=false;d.architecture.scoreboard.enabled=false;const hidden=stadiumMesh(validateDesign(d).geometry);assert(!hidden.surfaces.some(s=>s.material));
});
