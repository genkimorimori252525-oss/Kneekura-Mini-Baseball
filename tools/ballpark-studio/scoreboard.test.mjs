import {test} from 'node:test';import assert from 'node:assert/strict';
import {defaultScoreboard,runs} from './scoreboard.mjs';import {russianDomeDesign,validateDesign} from './model.mjs';import {stadiumMesh} from './stadium-mesh.mjs';
test('scoreboard samples have nine innings with calculated totals and independent counts',()=>{
 const s=defaultScoreboard();assert.deepEqual(s.teams.map(runs),[4,2]);assert.equal(s.teams[0].innings.length,9);const t={innings:[null,0,2,null,null,null,null,null,null]};assert.equal(runs(t),2);
 const next=defaultScoreboard();next.teams[0].innings[0]=9;assert.equal(defaultScoreboard().teams[0].innings[0],0);
});
test('scoreboard validates optional old settings without mutation and rejects invalid editable data',()=>{
 const old=russianDomeDesign();delete old.architecture.scoreboard;const source=JSON.stringify(old);assert(validateDesign(old).ok);assert.equal(JSON.stringify(old),source);
 for(const edit of [s=>s.balls=4,s=>s.outs=3,s=>s.strikes=-1,s=>s.speedKmh=Infinity,s=>s.speedKmh=null,s=>s.teams[0].innings=[0],s=>s.teams[0].innings[0]=-.1,s=>s.teams[0].hits=1.5,s=>s.teams[0].name='<bad>',s=>s.html='bad',s=>s.teams.length=1]){
  const d=russianDomeDesign();edit(d.architecture.scoreboard);const v=validateDesign(d);assert(!v.ok,JSON.stringify(d.architecture.scoreboard));assert(v.errors.some(e=>e.path.startsWith('architecture.scoreboard')));
 }
});
test('world scoreboard has a deep housing and two material panels below its wolf; disabling retains wolves',()=>{
 const d=russianDomeDesign(),g=validateDesign(d).geometry,m=stadiumMesh(g),board=m.surfaces.find(s=>s.material==='scoreboard'),title=m.surfaces.find(s=>s.material==='scoreboard-title'),wolf=m.surfaces.find(s=>s.material==='wolf');
 assert(m.scoreboard.enabled);assert.equal(m.scoreboard.mode,'DESIGN_SAMPLE');assert.equal(m.scoreboard.teams[0].runs,4);assert(board&&title&&wolf);assert(Math.max(...wolf.points.map(p=>p.y))<m.roof.y,'central wolf clears the roof');assert(Math.max(...board.points.map(p=>p.y))<=Math.min(...title.points.map(p=>p.y)));assert(Math.max(...title.points.map(p=>p.y))<=Math.min(...wolf.points.map(p=>p.y)));
 assert(m.surfaces.some(s=>s.points.every(p=>p.z===m.scoreboard.z+3)),'housing back is an opaque world surface');
 d.architecture.scoreboard.enabled=false;const off=stadiumMesh(validateDesign(d).geometry);assert(!off.surfaces.some(s=>s.material?.startsWith('scoreboard')));assert.equal(off.surfaces.filter(s=>s.material==='wolf').length,2);
 assert.equal(g.boundaryKey,validateDesign(d).geometry.boundaryKey);assert(m.surfaces.length<5000);
});

test('score assembly scales into shorter stands without moving the fixed field',()=>{
 for(const [capacity,tiers]of [[1000,3],[120000,5],[250000,6]]){const d=russianDomeDesign();d.architecture.capacity=capacity;d.architecture.tiers=tiers;const v=validateDesign(d);assert(v.ok);const m=stadiumMesh(v.geometry),wolf=m.surfaces.find(s=>s.material==='wolf');assert(m.scoreboard.baseY>=5);assert(m.scoreboard.scale>0&&m.scoreboard.scale<=1);assert(Math.max(...wolf.points.map(p=>p.y))<m.roof.y);assert(wolf.points.every(p=>p.y>=0));}
});
