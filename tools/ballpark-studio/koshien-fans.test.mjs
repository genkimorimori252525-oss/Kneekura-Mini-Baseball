import test from 'node:test';import assert from 'node:assert/strict';
import {koshienFanPalettes,koshienFanZone} from './koshien-fans.mjs';
import {koshienDesign,validateDesign,dodgerStadiumDesign} from './model.mjs';
import {stadiumMesh} from './stadium-mesh.mjs';
import {crowdAtlas} from './crowd-tiles.mjs';
test('old Koshien JSON receives yellow display defaults without rewriting its stored colors',()=>{
 const d=koshienDesign(),before=JSON.stringify(d),p=koshienFanPalettes(d.architecture);
 assert.deepEqual(p.home,['#ffd33c','#eab51a']);assert.deepEqual(p.visitor,['#5287d0','#dfe8ef']);assert.equal(JSON.stringify(d),before);
 d.architecture.crowd.homeColors=['#ffaa00','#dd9900'];d.architecture.crowd.visitorColors=['#dd2222','#eeeeee'];assert(validateDesign(d).ok);
 assert.deepEqual(koshienFanPalettes(d.architecture).home,d.architecture.crowd.homeColors);
 d.architecture.crowd.visitorColors=['red'];assert(!validateDesign(d).ok);
 const other=dodgerStadiumDesign();assert.deepEqual(koshienFanPalettes(other.architecture).home,[other.architecture.colors.red,other.architecture.colors.blue]);
});
test('visitor tiles occupy only a small upper left-field block and keep the original green seats',()=>{
 const m=stadiumMesh(validateDesign(koshienDesign()).geometry),tiles=m.surfaces.filter(s=>s.crowdTile),away=tiles.filter(s=>s.crowdTile.fanZone==='visitor');
 assert.equal(away.length,24);assert.equal(tiles.length,912);assert(away.length/tiles.length<.04);
 for(const s of away){assert.equal(s.crowdTile.tier,2);assert(s.points.every(p=>p.x<0&&p.z>90));assert.equal(s.color,'#597c68');}
 assert.equal(koshienFanZone(33,1),'home');assert.equal(koshienFanZone(50,2),'home');
 assert.equal(new Set(tiles.map(s=>s.crowdTile.id)).size,tiles.length);
});
test('both team atlases remain reusable when rendering the three shared scene frames',()=>{
 const c=koshienDesign().architecture.crowd,p=koshienFanPalettes(koshienDesign().architecture),h=crowdAtlas(p.home,c),v=crowdAtlas(p.visitor,c);
 assert.equal(crowdAtlas(p.home,c),h);assert.equal(crowdAtlas(p.visitor,c),v);assert.equal(h.frameCount,3);assert.equal(v.individualWorldObjects,0);
});
