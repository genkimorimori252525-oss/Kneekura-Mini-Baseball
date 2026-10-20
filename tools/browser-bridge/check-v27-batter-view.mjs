import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {runInNewContext} from 'node:vm';
const plain=v=>JSON.parse(JSON.stringify(v)),P=(x,y,z)=>({x,y,z}),origin=1e6,preparationMs=1540;
let fieldCalls=0;
const field={observe:args=>{fieldCalls++;const t=Math.max(0,(args.sceneMs-preparationMs)/1000);return {eye:P(-.4,1.8*.77,-.95+Math.max(0,t-.5)*3),yaw:1.2,pitch:-.1,f:400,cx:300,cy:110,labelMetres:.55,phase:'batted-tracking'};}};
const root={KneekuraContinuousBatterView:field};runInNewContext(await readFile(process.argv.includes('--baseline')?'tools/browser-bridge/live-batter-braking-view.js':'tools/browser-bridge/live-v27-batter-view.js','utf8'),root);
function fixture(swing=false){return {batterPlayerId:'B',beforeMatch:{half:'top'},beforeFrame:{actors:[]},command:{managedTeam:0,batting:'balanced'},
 frames:Array.from({length:201},(_,i)=>{const t=i*.008,hit=swing&&t>=.5,held=!swing&&t>=.56;return{tick:origin+i*8000,phase:held?'held':hit?'batted':'pitch',ballKind:hit?'batted':'pitch',possessedBy:held?'C':null,
 ball:{visible:!held,position:hit?P(12*t,2+8*t,10+25*t):P(.1,1.3-.8*t,18-35*t),velocity:hit?P(12,8,25):P(0,-.8,-35)},actors:[]};}),
 play:{diagnostics:{sourceClockTicksPerSecond:1e6,swingOffered:swing,predictionMadeAtElapsedSeconds:.14,referenceStartTick:origin+300000,referenceThroughTick:origin+700000,
 zoneJudgment:{observedForecastPosition:P(.1,.95,.15)},aimErrorMeters:P(0,0,0)}}};}
const side=hand=>({playerId:'B',height:1.8,hand});
const at=(r,ms,hand='R',cap=null)=>root.KneekuraContinuousBatterView.observe({record:r,frame:r.frames.findLast(f=>f.tick<=origin+(cap??ms)*1000)??r.frames[0],sceneMs:preparationMs+ms,preparationMs,batter:side(hand)});
for(const hand of ['R','L']){const base=at(fixture(),0,hand),s=hand==='R'?1:-1;
 assert.deepEqual(plain(base.eye),P(-.4*s,1.8*.77,-.95));assert.equal(base.yaw,Math.atan2(.4*s,19.4));assert.equal(base.pitch,.08);assert.equal(base.f,400);assert.equal(base.cy,110);
 const r=fixture(),start=r.frames.find(f=>f.ball.position.z<=1).tick,settled=at(r,900,hand),pose=v=>plain({eye:v.eye,yaw:v.yaw,pitch:v.pitch,f:v.f,cx:v.cx,cy:v.cy,labelMetres:v.labelMetres});
 for(let ms=900;ms<=2500;ms+=55)assert.deepEqual(pose(at(r,ms,hand)),pose(settled),'no post-take drift');
 assert.equal(settled.phase,'take-held');assert.equal(settled.f,400*.94);assert.equal(settled.cy,172);assert(settled.target.z>=-.42);
 const midMs=(start-origin)/1000+82.5,v=at(r,midMs,hand),target=v.target,dx=target.x-base.eye.x,dz=target.z-base.eye.z,delta=Math.atan2(Math.sin(Math.atan2(dx,dz)-base.yaw),Math.cos(Math.atan2(dx,dz)-base.yaw));
 assert(Math.abs(v.yaw-(base.yaw+Math.max(-.4,Math.min(.4,delta))*.5))<1e-12,'lv27 take angle/165ms smoothstep');
}
assert.equal(fieldCalls,0,'takes never invoke the inertial controller');
const r=fixture(true),held=at(r,1399.999),release=at(r,1400),complete=at(r,1895);
assert.equal(held.phase,'post-swing-hold');assert.equal(held.followAtMs,preparationMs+1400);assert.equal(held.swingEndAtMs,preparationMs+700);
assert.equal(release.phase,'field-follow');assert.equal(release.followProgress,0);assert.equal(complete.followProgress,1);assert.equal(complete.yaw,1.2);assert.equal(complete.pitch,-.1);
const aim=P(.1,.95,.15),yaw=Math.atan2(aim.x-held.eye.x,aim.z-held.eye.z);assert.equal(held.yaw,yaw);assert.deepEqual(plain(held.target),aim);
assert(Math.abs(held.yaw-release.yaw)<.00001,'delayed start has no angle cut');
const initial=plain(at(r,1000));at(r,1500);assert.deepEqual(plain(at(r,1000)),initial,'rewind deterministic');
const stopped=fixture(true);stopped.frames=stopped.frames.filter(f=>f.tick<=origin+600000);assert.equal(at(stopped,1399,undefined,600).phase,'post-swing-hold');assert.equal(at(stopped,1400,undefined,600).phase,'field-follow','presentation clock releases after dead Source clock stops');
const future=fixture();Object.defineProperty(future.play.diagnostics,'swingOffered',{get(){throw Error('future decision read');}});assert.equal(at(future,100).phase,'ready');
const prefix=fixture();for(const f of prefix.frames)if(f.tick>origin+300000)Object.defineProperty(f,'ball',{get(){throw Error('future ball read');}});assert.equal(at(prefix,300).phase,'ready');
const miss=fixture(true);for(const f of miss.frames){f.ballKind='pitch';f.phase='pitch';}assert.equal(at(miss,1500).phase,'swing-miss-reset');
assert.equal(root.KneekuraV27BatterView.version,1);
console.log(JSON.stringify({pass:true,checks:['v27-R-L-base','165ms-limited-take','held-take-no-drift','no-take-inertia','measured-end-plus700','field-follow-endpoint','body-eye-retained','rewind','stopped-source-clock','decision-and-frame-prefix','miss-reset']}));
