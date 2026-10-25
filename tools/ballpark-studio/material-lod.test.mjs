import {test} from 'node:test';import assert from 'node:assert/strict';
import {projectedMaterialDetail} from './material-lod.mjs';import {mipPyramid,sampleMip} from './texture-filter.mjs';
const quad=(distance,yaw=0)=>{const f=400,points=[[-19,-17],[19,-17],[19,17],[-19,17]];return points.map(([x,y])=>{const depth=distance+x*Math.sin(yaw);return {x:300+f*x*Math.cos(yaw)/depth,y:216-f*y/depth,depth};});};
test('projected width shrinks with depth; distant and edge-on logos use fewer samples without fading',()=>{
 const near=projectedMaterialDetail(quad(120)),far=projectedMaterialDetail(quad(400)),edge=projectedMaterialDetail(quad(120,1.3));
 assert(Math.abs(near.widthPixels/far.widthPixels-400/120)<1e-10);assert(far.density<near.density);assert.equal(far.brightness,near.brightness);assert.equal(far.glow,near.glow);assert.equal(far.contrast,1);assert(far.footprintU>near.footprintU);assert(edge.density<near.density);
 for(let d=80;d<800;d+=5){const a=projectedMaterialDetail(quad(d)),b=projectedMaterialDetail(quad(d+5));assert(b.density<=a.density);assert(Math.abs(a.density-b.density)<.3);}
});
test('detail setting remains a ceiling and scales projected samples without changing geometry',()=>{
 const points=quad(250),before=JSON.stringify(points),low=projectedMaterialDetail(points,2),high=projectedMaterialDetail(points,8);
 assert(high.density>low.density);assert(high.density<=8);assert(low.density<=2);assert.equal(JSON.stringify(points),before);
});
test('mips average coverage with premultiplied gold, avoiding transparent black fringes',()=>{
 const levels=mipPyramid({width:2,height:2,data:Uint8ClampedArray.from([240,180,60,255,0,0,0,0,0,0,0,0,0,0,0,0])});
 assert.equal(levels.length,2);assert.equal(levels[1].width,1);const s=sampleMip(levels,.5,.5,1,1);assert(Math.abs(s.a-.25)<.003);assert.equal(s.r,240);assert.equal(s.g,180);assert.equal(s.b,60);
});
test('minification suppresses a fine checker pattern and trilinear levels change continuously',()=>{
 const data=new Uint8ClampedArray(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const i=(y*16+x)*4;data[i]=data[i+1]=data[i+2]=(x+y)%2?255:0;data[i+3]=255;}
 const levels=mipPyramid({width:16,height:16,data}),a=sampleMip(levels,.03125,.03125,1/16,1/16),b=sampleMip(levels,.03125,.03125,.25,.25);
 assert.equal(a.r,0);assert(Math.abs(b.r-128)<1);assert.equal(b.a,1);
 const c=sampleMip(levels,.03125,.03125,.1249,.1249),d=sampleMip(levels,.03125,.03125,.1251,.1251);assert(Math.abs(c.r-d.r)<1);
 assert.equal(sampleMip(levels,-.1,.5,.1,.1),null);assert.equal(levels.at(-1).width,1);
});

test('distance adds only mild filtering while preserving contrast and light',()=>{
 const near=quad(100),far=near.map(p=>({...p,depth:p.depth+300})),a=projectedMaterialDetail(near),b=projectedMaterialDetail(far);
 assert.equal(a.widthPixels,b.widthPixels);assert.equal(b.contrast,a.contrast);assert.equal(b.brightness,a.brightness);assert.equal(b.glow,a.glow);assert.equal(b.density,a.density);assert(b.footprintU>a.footprintU);assert(b.footprintU/a.footprintU<=1.16);
});
