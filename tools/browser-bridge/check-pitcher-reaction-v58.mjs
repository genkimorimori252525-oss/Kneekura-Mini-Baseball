import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile('tools/browser-bridge/live-pitcher-reaction-view-v58.js','utf8'),old=await readFile('tools/browser-bridge/live-pitcher-reaction-view.js','utf8');
assert.equal(source.replace('minimumDelaySeconds:.1,','minimumDelaySeconds:.5,').replace('maximumDelaySeconds:.25,speedScaleMeters:7,','maximumDelaySeconds:1.2,speedScaleMeters:35,'),old,'only three authored timing constants change');
const root={};runInNewContext(source,root);const api=root.KneekuraLivePitcherReactionView,origin=1e6,prep=1540,
 v=(x=0,y=0,z=0)=>({x,y,z}),plain=x=>JSON.parse(JSON.stringify(x)),actor={position:v(1,0,18.44),player:{height:1.8}},
 fixture=speed=>({frames:Array.from({length:121},(_,i)=>({tick:origin+i*10000,phase:i<40?'pitch':'batted',ballKind:i<40?'pitch':'batted',
  ball:{position:v(i*.1,1,i*.1),velocity:i<40?v(0,0,-40):v(speed,0,0)}})),play:{diagnostics:{sourceClockTicksPerSecond:1e6},contactMoment:{ball:{tick:origin+400000}}}}),
 at=(r,ms,cap=ms,p=actor)=>api.observe({record:r,frame:r.frames.findLast(f=>f.tick<=origin+cap*1000),sceneMs:prep+ms,preparationMs:prep,pitcherActor:p});
const samples=[];
for(const [speed,expected]of [[0,.25],[5,.25],[28,.25],[35,.2],[40,.175],[50,.14],[70,.1],[100,.1]]){
 const r=fixture(speed),before=JSON.stringify(r),observed=at(r,450),start=400+expected*1000;
 assert.equal(observed.delaySeconds,expected);assert(observed.delaySeconds>=.1&&observed.delaySeconds<=.25);
 assert.equal(at(r,start-.001).phase,'reaction-hold');
 assert.equal(at(r,start).trackingAllowed,true);assert.equal(at(r,start).trackingBlend,0);
 assert(Math.abs(at(r,start+90).trackingBlend-.5)<1e-12);assert.equal(at(r,start+179.999).handoffAllowed,false);
 assert.equal(at(r,start+180).handoffAllowed,true);assert.equal(at(r,start+180).trackingBlend,1);
 assert.equal(observed.model.blendMs,180);assert.equal(observed.model.speedScaleMeters,7);
 assert.equal(JSON.stringify(r),before);samples.push({speed,delaySeconds:observed.delaySeconds});
}
const r=fixture(40),view=at(r,450),moved={...actor,position:v(2,0,19)};
assert.deepEqual(plain(at(r,450,450,moved).view.eye),v(2,1.8*.92,19),'same moving pitcher eye');
assert.equal(at(r,755,450).handoffAllowed,true,'presentation wait finishes after Source stops');
const before=plain(at(r,450));at(r,1100);assert.deepEqual(plain(at(r,450)),before,'stateless rewind');
const future=fixture(40);for(const f of future.frames)if(f.tick>origin+300000)Object.defineProperty(f,'ballKind',{get(){throw Error('future payload');}});
Object.defineProperty(future.play,'contactMoment',{get(){throw Error('future contact');}});assert.equal(at(future,300).phase,'pre-contact');
const modified=fixture(40);for(const f of modified.frames){if(f.ballKind==='pitch')f.ball.velocity=v(0,0,-999);else if(f.tick>origin+400000)f.ball.velocity=v(999,999,999);}
assert.equal(at(modified,700).delaySeconds,view.delaySeconds,'uses only admitted contact exit speed');
const missing=fixture(40);missing.frames[40].ball.velocity=null;assert.equal(at(missing,450).delaySeconds,.25,'unknown exit speed uses bounded maximum');
const miss=fixture(40);for(const f of miss.frames)f.ballKind='pitch';assert.equal(at(miss,900).phase,'pre-contact');
assert.equal(api.observe({record:r,frame:r.frames[0],sceneMs:100,preparationMs:prep,pitcherActor:actor}).phase,'ready');
assert.equal(api.observe({record:r,frame:{...r.frames[80],phase:'bench'},sceneMs:2300,preparationMs:prep,pitcherActor:actor}).phase,'bench');
const tracked={eye:v(7,4,16),yaw:-3.1,pitch:.7,f:530,cx:310,cy:196,labelMetres:.5},mixed=api.mixTrackingView({reaction:{view:{...view.view,yaw:3.1},trackingBlend:.5},tracked});
assert.deepEqual(plain(mixed.eye),tracked.eye);assert(Math.abs(mixed.yaw-Math.PI)<1e-12);
assert.deepEqual(plain(api.mixTrackingView({reaction:{...view,trackingBlend:1},tracked})),tracked);
console.log(JSON.stringify({pass:true,samples,onlyThreeTimingConstantsChanged:true,blendMs:180,checks:['hold/start/blend/handoff','same-pitcher-eye','prefix','rewind','stopped-source-clock','next-pitch/miss/bench','fallback','shortest-angle']}));
