import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'vitest';
import vm from 'node:vm';
import {applyBroadcastRendererPerformanceV81} from './broadcast-renderer-performance-v81.mjs';

const original=await readFile('docs/demos/releases/v79/game.html','utf8'),
 start='function makeBroadcastRenderer(canvas,labelHost){',end="\n'use strict';\nconst freeze=o=>";
function renderer(html){
 const through=html.indexOf(end,html.indexOf(start)),source=html.slice(html.indexOf(start),through),calls={sin:0,cos:0},
  math=Object.create(Math),raster={arcs:0,captures:0,restores:0},context={fillStyle:'#000',globalAlpha:1,shadowColor:'#000',shadowBlur:0,
   globalCompositeOperation:'source-over',filter:'none',shadowOffsetX:0,shadowOffsetY:0,
   setTransform(){},fillRect(){},beginPath(){},arc(){raster.arcs++;},fill(){},
   getImageData(){raster.captures++;return {captured:raster.captures};},putImageData(){raster.restores++;}};
 math.sin=value=>{calls.sin++;return Math.sin(value);};math.cos=value=>{calls.cos++;return Math.cos(value);};
 const instrumented=source.replace('return {draw,paintBallOverlay',`return {testV81:{
  configure:(value,input,settings)=>{cam=value;observed=input;state=settings;if(typeof updateProjectionV81==='function')updateProjectionV81();},
  project,viewRay,groundAt,paintWorldCell,
  begin:()=>{anchors=[];sceneDepth=new Map();rasterCells=new Map();fieldMarkCells=[];ctx.fillStyle='#000';},
  paintPark:()=>typeof drawParkV81==='function'?drawParkV81():park(),
  diagnostics:()=>({anchors,marks:fieldMarkCells,depths:[...sceneDepth.values()],groundCells,markingOwner}),
  depthKeys:()=>[...sceneDepth.keys()],
  touch:()=>{sceneDepth.set(typeof rasterKeyV81==='function'?rasterKeyV81(4,4):'4,4',-999);anchors[0][0]=-999;fieldMarkCells[0].x=-999;}
  },draw,paintBallOverlay`),canvas={width:1200,height:864,getContext:()=>context},
  create=vm.runInNewContext('('+instrumented+')',{window:{KneekuraBallSurface:{},KneekuraPitchSymbols:{}},Math:math,freeze:value=>value});
 return {api:create(canvas,{}).testV81,calls,raster,canvas,context};
}
const copy=value=>structuredClone(value);

test('patches only the exact renderer and fails closed on changed or duplicate markers',()=>{
 const modified=applyBroadcastRendererPerformanceV81(original),from=original.indexOf(start),through=original.indexOf(end,from);
 assert.equal(modified.slice(0,from),original.slice(0,from));
 assert.equal(modified.slice(modified.indexOf(end,from)),original.slice(through));
 assert.throws(()=>applyBroadcastRendererPerformanceV81(modified));
 assert.throws(()=>applyBroadcastRendererPerformanceV81(original.replace('function viewRay(u,v){','function viewRay(u, v){')));
 assert.throws(()=>applyBroadcastRendererPerformanceV81(original+start));
 assert.throws(()=>applyBroadcastRendererPerformanceV81(null));
});

const parkCamera={eye:{x:0,y:100,z:-35},yaw:0,pitch:Math.atan2(100,85),f:470,cx:300,cy:224},
 parkObservation={liveObservation:true,livePark:{center:{x:0,z:0},radiusMeters:110,heightMeters:3}},
 parkSettings={camera:'overhead',detail:false,glow:.2};
function paint(renderer,camera=parkCamera,observation=parkObservation,settings=parkSettings){
 renderer.api.configure(copy(camera),copy(observation),copy(settings));renderer.api.begin();renderer.api.paintPark();return copy(renderer.api.diagnostics());
}

test('caches only a repeated exact park and restores diagnostics with private dynamic ownership',()=>{
 const before=renderer(original),after=renderer(applyBroadcastRendererPerformanceV81(original)),expected=paint(before);
 assert.deepEqual(paint(after),expected);assert.equal(after.raster.captures,0,'moving-camera first key does not read back a bitmap');
 assert.deepEqual(paint(after),expected);assert.equal(after.raster.captures,1);
 assert(after.api.depthKeys().every(key=>typeof key==='number'),'bounded raster depth keys are numeric');
 assert.equal(new Set(after.api.depthKeys()).size,expected.depths.length);
 after.api.touch();const arcs=after.raster.arcs;
 assert.deepEqual(paint(after),expected,'dynamic depth/mark/anchor writes cannot contaminate cached park');
 assert.equal(after.raster.arcs,arcs,'cache hit does not repeat park dots');assert.equal(after.raster.restores,1);
 after.api.touch();assert.deepEqual(paint(after),expected);assert.equal(after.raster.restores,2);
});

test('invalidates the park for exact projection, park, style and canvas changes without rounded keys',()=>{
 const after=renderer(applyBroadcastRendererPerformanceV81(original));paint(after);paint(after);paint(after);
 const changes=[
  [{...parkCamera,eye:{...parkCamera.eye,x:-0}},parkObservation,parkSettings],
  [{...parkCamera,eye:{...parkCamera.eye,x:Number.MIN_VALUE}},parkObservation,parkSettings],
  [{...parkCamera,yaw:Number.MIN_VALUE},parkObservation,parkSettings],
  [{...parkCamera,f:471},parkObservation,parkSettings],
  [parkCamera,{...parkObservation,livePark:{...parkObservation.livePark,radiusMeters:111}},parkSettings],
  [parkCamera,{...parkObservation,livePark:{...parkObservation.livePark,heightMeters:4}},parkSettings],
  [parkCamera,parkObservation,{...parkSettings,detail:true}],
  [parkCamera,parkObservation,{...parkSettings,glow:.3}],
  [parkCamera,parkObservation,{...parkSettings,camera:'catcher'}],
 ];
 for(const args of changes){const arcs=after.raster.arcs;paint(after,...args);assert(after.raster.arcs>arcs,'changed key redraws park');}
 const arcs=after.raster.arcs;after.canvas.width=1216;paint(after);assert(after.raster.arcs>arcs);
 const filtered=after.raster.arcs;after.context.filter='blur(1px)';paint(after);assert(after.raster.arcs>filtered);
});

test('retains the original park path if optional bitmap readback is unavailable',()=>{
 const before=renderer(original),after=renderer(applyBroadcastRendererPerformanceV81(original)),expected=paint(before);
 after.context.getImageData=()=>{throw Error('readback unavailable');};
 for(let i=0;i<4;i++)assert.deepEqual(paint(after),expected);
 assert.equal(after.raster.restores,0);
});

test('keeps distinct depth cells and the original non-finite-coordinate behavior',()=>{
 const before=renderer(original),after=renderer(applyBroadcastRendererPerformanceV81(original));
 for(const value of [before,after]){
  value.api.configure(copy(parkCamera),copy(parkObservation),copy(parkSettings));value.api.begin();
  for(const [x,y,depth]of [[4,4,5],[4,428,6],[596,4,7],[596,428,8],[NaN,4,9],[NaN,8,10],[4,NaN,11]])
   value.api.paintWorldCell(x,y,depth,'#fff',1,'actor');
 }
 assert.deepEqual(copy(after.api.diagnostics()),copy(before.api.diagnostics()));
 assert.equal(after.api.depthKeys().length,7);
});

test('shares camera coefficients while preserving project, ray and ground results exactly',()=>{
 const before=renderer(original),after=renderer(applyBroadcastRendererPerformanceV81(original)),observation={liveObservation:true,
  livePark:{center:{x:0,z:0},radiusMeters:110,heightMeters:3}},settings={camera:'overhead',detail:false,glow:.2};
 for(const yaw of [0,-0,-.37,Math.PI/2])for(const pitch of [-.11,.018,.71]){
  const camera={eye:{x:yaw===0?-0:.13,y:1.83,z:-1},yaw,pitch,f:440,cx:300,cy:104};
  before.api.configure(copy(camera),observation,settings);after.api.configure(copy(camera),observation,settings);
  const calls={...after.calls};
  for(const point of [{x:0,y:0,z:0},{x:-0,y:-0,z:20},{x:.003,y:1.23,z:16.9},{x:-100,y:13,z:100},{x:1,y:-2,z:-10}])
   assert.deepEqual(copy(after.api.project(point)),copy(before.api.project(point)));
  for(const [u,v]of [[4,4],[300,216],[596,428],[300,428],[4,428],[596,4],[11.5,53.2],[0,-0]]){
   assert.deepEqual(copy(after.api.viewRay(u,v)),copy(before.api.viewRay(u,v)));
   assert.deepEqual(copy(after.api.groundAt(u,v)),copy(before.api.groundAt(u,v)));
  }
  assert.deepEqual(after.calls,calls,'point observations do not repeat camera sin/cos');
 }
});
