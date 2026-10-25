import test from 'node:test';import assert from 'node:assert/strict';
import {CROWD_TILE,crowdAtlas,sampleCrowdTile} from './crowd-tiles.mjs';import {DEFAULT_CROWD_APPEARANCE} from './crowd.mjs';
const colors=['#b72e3d','#254f9a'];
test('a shared three-frame block covers every texel and emits actual LED glow',()=>{
 const a=crowdAtlas(colors,DEFAULT_CROWD_APPEARANCE);assert.equal(crowdAtlas(colors,DEFAULT_CROWD_APPEARANCE),a);assert.equal(a.frames.length,3);assert.equal(a.occupancy,1);assert.equal(a.individualWorldObjects,0);
 for(const frame of a.frames){assert.equal(frame.length,CROWD_TILE.width*CROWD_TILE.height);assert(frame.every(p=>/^#[0-9a-f]{6}$/.test(p.color)));assert(frame.some(p=>p.kind==='head'));assert(frame.some(p=>p.kind==='led'&&p.glow>0));}
 assert.equal(new Set(a.frames.map(f=>JSON.stringify(f))).size,3);
});
test('LED density never creates holes in the packed crowd background',()=>{
 const dim=crowdAtlas(colors,{...DEFAULT_CROWD_APPEARANCE,density:.05}),full=crowdAtlas(colors,{...DEFAULT_CROWD_APPEARANCE,density:1});
 assert.equal(dim.frames[0].length,full.frames[0].length);assert.equal(dim.occupancy,full.occupancy);assert(dim.frames[0].filter(p=>p.kind==='led').length<full.frames[0].filter(p=>p.kind==='led').length);
 const dark=crowdAtlas(colors,{...DEFAULT_CROWD_APPEARANCE,glow:0});assert(dark.frames.flat().every(p=>p.glow===0));
});
test('tile sampling fills edges and scaled patterns without per-person world data',()=>{
 const a=crowdAtlas(colors,DEFAULT_CROWD_APPEARANCE);
 for(const size of [.5,1,1.8])for(const frames of [2,3])for(let frame=0;frame<frames;frame++)for(const u of [0,.2,.99,1])for(const v of [0,.5,1]){
  const p=sampleCrowdTile(a,u,v,42,frame,frames,size);assert(p);assert(/^#[0-9a-f]{6}$/.test(p.color));
 }
});
