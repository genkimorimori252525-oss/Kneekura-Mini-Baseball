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
test('low-density lights move between multiple pockets in each shared crowd block',()=>{
 const a=crowdAtlas(colors,{...DEFAULT_CROWD_APPEARANCE,density:.1});assert.equal(a.variants.length,8);
 for(const frames of a.variants){const pockets=new Set(frames.flat().filter(p=>p.kind==='led').map(p=>p.cluster));assert(pockets.size>=3);assert(!pockets.has(undefined));
  const first=new Set(frames[0].filter(p=>p.kind==='led').map(p=>p.cluster)),last=new Set(frames[2].filter(p=>p.kind==='led').map(p=>p.cluster));assert([...last].some(p=>!first.has(p)));
 }
 assert.equal(a.variants.flat(2).length,8*3*16*12);assert.equal(a.individualWorldObjects,0);
});
test('neighboring and repeated blocks use varied deterministic layouts without additional scene frames',()=>{
 const a=crowdAtlas(colors,{...DEFAULT_CROWD_APPEARANCE,density:.1}),patterns=new Set();
 for(let tile=0;tile<64;tile++){const row=[];for(let y=0;y<12;y++)for(let x=0;x<16;x++)row.push(sampleCrowdTile(a,(x+.5)/16,(y+.5)/12,tile,0,3).color);patterns.add(row.join(''));}
 assert(patterns.size>=8);assert.equal(a.frames.length,3);assert.equal(a.frameCount,3);
 const at=()=>sampleCrowdTile(a,.31,.73,57,2,3,.5);assert.deepEqual(at(),at());
});

test('packed Niikura blocks keep all twelve pockets populated and lit in all three frames',()=>{const a=crowdAtlas(colors,{...DEFAULT_CROWD_APPEARANCE,density:1},true);for(const frames of a.variants)for(const frame of frames){for(let row=0;row<3;row++)for(let col=0;col<4;col++){const cells=[];for(let y=row*4;y<(row+1)*4;y++)for(let x=col*4;x<(col+1)*4;x++)cells.push(frame[y*16+x]);assert(cells.some(p=>p.kind==='head'));assert(cells.some(p=>p.kind==='led'&&p.glow>0));assert(cells.every(p=>/^#[0-9a-f]{6}$/.test(p.color)));}}assert.equal(a.individualWorldObjects,0);});
test('packed bodies stay present when the lights move or their density is zero',()=>{const a=crowdAtlas(colors,{...DEFAULT_CROWD_APPEARANCE,density:1},true),dark=crowdAtlas(colors,{...DEFAULT_CROWD_APPEARANCE,density:0},true);for(let variant=0;variant<8;variant++){const frames=a.variants[variant];for(let i=0;i<192;i++){if(frames.every(f=>f[i].kind!=='led'))assert(frames.every(f=>f[i].color===frames[0][i].color));}for(const frame of dark.variants[variant]){assert(!frame.some(p=>p.kind==='led'));assert(frame.filter(p=>p.kind==='head').length>=24);}assert(new Set(frames.map(f=>JSON.stringify(f))).size===3);}});
test('packed profile increases crowd motifs and lights without increasing atlas or scene-frame size',()=>{const appearance={...DEFAULT_CROWD_APPEARANCE,density:1},a=crowdAtlas(colors,appearance,true),old=crowdAtlas(colors,appearance);assert.equal(a.width,old.width);assert.equal(a.height,old.height);assert.equal(a.variants.length,old.variants.length);assert.equal(a.frames.length,3);assert(a.frames[0].filter(p=>p.kind==='head').length>old.frames[0].filter(p=>p.kind==='head').length);assert(a.frames[0].filter(p=>p.kind==='led').length>old.frames[0].filter(p=>p.kind==='led').length);assert.equal(crowdAtlas(colors,appearance,true),a);});
