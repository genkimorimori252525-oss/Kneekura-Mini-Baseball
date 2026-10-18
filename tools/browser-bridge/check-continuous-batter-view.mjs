import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const context={};
runInNewContext(await readFile(process.argv[2]??'tools/browser-bridge/live-continuous-batter-view.js','utf8'),context);
const observe=context.KneekuraContinuousBatterView.observe;
const plain=value=>JSON.parse(JSON.stringify(value));
const preparationMs=1540,releaseTick=1_000_000,tps=1_000_000;
const batter={playerId:'BATTER',heightMeters:1.8,height:1.8,bats:'R',hand:'R',name:'fixture',
 physical:{basis:'EXPLICIT_AUTHORED_SI_V1',zoneJudgmentStdMeters:.025}};
const point=(x,y,z)=>({x,y,z});
const actor=(seconds,side='R')=>({playerId:'BATTER',role:seconds<.65?'batter':'runner',team:0,
 position:point(side==='R'?-.85:.85,0,-.2+(seconds<.65?0:3*(seconds-.65))),
 velocity:point(0,0,seconds<.65?0:3)});
function fixture({swing=true,side='R',abrupt=false,heldAt=.9}={}){
 const frames=Array.from({length:151},(_,index)=>{
  const seconds=index*.008,after=abrupt&&seconds>=.4,held=seconds>=heldAt;
  const position=after?point(20*(seconds-.4),1,4+20*(seconds-.4))
   :point(.05+seconds*.15,1.15-seconds*.3,18-35*seconds);
  return {tick:releaseTick+Math.round(seconds*tps),phase:held?'held':after||swing&&seconds>=.5?'batted':'pitch',
   ballKind:after||swing&&seconds>=.5?'batted':'pitch',possessedBy:held?'C':null,
   ball:{position,velocity:after?point(20,0,20):point(.15,-.3,-35),visible:!held},
   actors:[actor(seconds,side)],batterPlayerId:'BATTER'};
 });
 return {batterPlayerId:'BATTER',pitcherPlayerId:'P',beforeMatch:{half:'top'},
  beforeFrame:{...frames[0],phase:'ready'},command:{managedTeam:0,batting:swing?'balanced':'take'},frames,
  play:{diagnostics:{sourceClockTicksPerSecond:tps,battingSide:side,swingOffered:swing,
   predictionMadeAtElapsedSeconds:.14,referenceStartTick:releaseTick+300_000,
   referenceContactTick:releaseTick+500_000,referenceThroughTick:releaseTick+650_000,
   zoneJudgment:{standardDeviationMeters:.025,observedForecastPosition:point(.1,.9,.15)},
   aimErrorMeters:point(.015,-.01,0)},contactMoment:null}};
}
function at(record,elapsedMs,selectedBatter=batter,previousRecord=null){
 const tick=releaseTick+Math.max(0,elapsedMs)/1000*tps;
 let frame=record?.beforeFrame??{tick:releaseTick,phase:'ready',actors:[]};
 if(record&&elapsedMs>=0)for(const sample of record.frames){if(sample.tick>tick)break;frame=sample;}
 return observe({record,frame,sceneMs:preparationMs+elapsedMs,preparationMs,batter:selectedBatter,previousRecord});
}
const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const angularDistance=(a,b)=>Math.hypot(angleDifference(a.yaw,b.yaw),a.pitch-b.pitch);
const eyeDistance=(a,b)=>Math.hypot(a.eye.x-b.eye.x,a.eye.y-b.eye.y,a.eye.z-b.eye.z);
function finitePose(value,label){
 assert(value&&typeof value==='object',label+': observer supplies a view');
 for(const n of [value.eye?.x,value.eye?.y,value.eye?.z,value.yaw,value.pitch,value.f,value.cx,value.cy,value.labelMetres])
  assert(Number.isFinite(n),label+': finite camera pose and optics');
 assert.equal(value.f,400,label+': fixed focal length');assert.equal(value.cx,300);assert.equal(value.cy,110);assert.equal(value.labelMetres,.55);
}
function continuous(record,elapsedMs,selectedBatter,label){
 const epsilonMs=.001,before=at(record,elapsedMs-epsilonMs,selectedBatter),exact=at(record,elapsedMs,selectedBatter),
  after=at(record,elapsedMs+epsilonMs,selectedBatter);
 for(const view of [before,exact,after])finitePose(view,label);
 assert(angularDistance(before,after)<=2.5*(2*epsilonMs/1000)+1e-8,label+': no angular snap at exact boundary');
 assert(eyeDistance(before,after)<1e-4,label+': no eye-position snap at exact boundary');
 assert(angularDistance(before,exact)<=2.5*(epsilonMs/1000)+1e-8,label+': boundary cannot reset angular state');
}

// The exact start/end and role transition must preserve a single view even
// when a query falls between ordinary 55ms display frames.
for(const side of ['R','L']){
 const record=fixture({side}),selectedBatter={...batter,bats:side,hand:side};
 for(const [ms,label]of [[300,'swing start'],[500,'contact'],[650,'swing end / runner role'],[900,'possession']])
  continuous(record,ms,selectedBatter,side+' '+label);
 const fractional=structuredClone(record);fractional.play.diagnostics.referenceThroughTick+=.652717371;
 continuous(fractional,(fractional.play.diagnostics.referenceThroughTick-releaseTick)/1000,selectedBatter,side+' fractional swing end');
}

// Actual field observations normally arrive every 55ms, with extra event
// frames between them. A short interpolation bracket must not teleport the
// embodied eye when a newly available actor sample becomes readable.
const irregular=fixture({swing:false});
irregular.frames=[0,55,101,156,211,237,292,347,401].map(ms=>({
 tick:releaseTick+ms*1000,phase:'batted',ballKind:'batted',possessedBy:null,
 ball:{position:point(20,2,30),velocity:point(0,0,0),visible:true},
 actors:[{playerId:'BATTER',role:ms<156?'batter':'runner',team:0,
  position:point(-.85,0,-.2+8*ms/1000),velocity:point(0,0,8)}],batterPlayerId:'BATTER'}));
irregular.beforeFrame={...irregular.frames[0],phase:'ready'};
for(const sample of irregular.frames.slice(1))continuous(irregular,(sample.tick-releaseTick)/1000,batter,'irregular field sample '+sample.tick);

// A caller may advance presentation while holding a smaller Source prefix.
// Previously computed later observations must not survive a reduced cap.
const capFixture=fixture({swing:false});
capFixture.frames=[0,100,200,300,400].map(ms=>({
 tick:releaseTick+ms*1000,phase:'pitch',ballKind:'pitch',possessedBy:null,
 ball:{position:point(ms===0?0:10,1,2),velocity:point(0,0,0),visible:true},
 actors:[{playerId:'BATTER',role:'batter',team:0,position:point(-.85,0,-.2),velocity:point(0,0,0)}],batterPlayerId:'BATTER'}));
capFixture.beforeFrame={...capFixture.frames[0],phase:'ready'};
const capped=(r,index)=>plain(observe({record:r,frame:r.frames[index],sceneMs:preparationMs+400,preparationMs,batter}));
for(const index of [0,1,2,3]){
 const fresh=structuredClone(capFixture),cached=structuredClone(capFixture),freshHigh=structuredClone(capFixture);
 const expected=capped(fresh,index),expectedHigh=capped(freshHigh,4);
 capped(cached,4);
 assert.deepEqual(capped(cached,index),expected,'lower Source cap matches fresh prefix after high-cap cache at index '+index);
 assert.deepEqual(capped(cached,4),expectedHigh,'restored higher Source cap matches fresh high prefix at index '+index);
}

// Derive velocity and acceleration from observed orientations, not from a
// second copy of the implementation's state or its reported limits.
for(const record of [fixture(),fixture({swing:false,abrupt:true})]){
 let previous=null,velocity=null;
 for(let ms=0;ms<=1200;ms+=8){
  const view=at(record,ms);finitePose(view,'8ms sample '+ms);
  assert.equal(view.model.angularSpeedLimitRadPerSecond,2.5);
  assert.equal(view.model.angularAccelerationLimitRadPerSecond2,20);
  if(previous){
   const nextVelocity={yaw:angleDifference(view.yaw,previous.yaw)/.008,pitch:(view.pitch-previous.pitch)/.008};
   assert(Math.hypot(nextVelocity.yaw,nextVelocity.pitch)<=2.5+1e-7,'combined angular speed bounded at '+ms+'ms');
   if(velocity)assert(Math.hypot(nextVelocity.yaw-velocity.yaw,nextVelocity.pitch-velocity.pitch)/.008<=20+1e-5,
    'combined angular acceleration bounded at '+ms+'ms');
   velocity=nextVelocity;
  }
  previous=view;
 }
}

// Rendering history is irrelevant: direct seek, forward replay and rewind
// must yield byte-identical observer values and leave Source inputs unchanged.
const record=fixture(),previousRecord=fixture({swing:false}),original=JSON.stringify({record,previousRecord,batter});
const times=[-55,0,139.999,140,299.999,300,499.337,500,649.999,650,900,1400];
const direct=new Map(times.map(ms=>[ms,plain(at(record,ms,batter,previousRecord))]));
for(const ms of [...times,...times.toReversed(),...times])assert.deepEqual(plain(at(record,ms,batter,previousRecord)),direct.get(ms),
 'direct seek / sequence / rewind agree at '+ms+'ms');
assert.equal(JSON.stringify({record,previousRecord,batter}),original,'observer never mutates records or abilities');

// A future row exposes only its timestamp. Final results and a planned aim
// are unavailable before the decision; accessing either fails this test.
const guarded=fixture(),cutoff=100,fail=label=>{throw Error('noncausal read: '+label);};
Object.defineProperty(guarded.play.diagnostics,'aimErrorMeters',{get:()=>fail('aim before decision')});
Object.defineProperty(guarded.play.diagnostics.zoneJudgment,'observedForecastPosition',{get:()=>fail('forecast before decision')});
Object.defineProperty(guarded.play,'contactMoment',{get:()=>fail('future contact result')});
const future={tick:releaseTick+cutoff*1000+1};
for(const key of ['ball','actors','ballKind','phase','possessedBy'])Object.defineProperty(future,key,{get:()=>fail('future '+key)});
guarded.frames=guarded.frames.filter(f=>f.tick<=releaseTick+cutoff*1000).concat(future);
finitePose(at(guarded,cutoff),'prefix-only predecision view');
const causal=fixture({swing:false}),causalBefore=plain(at(causal,300));
for(const sample of causal.frames)if(sample.tick>releaseTick+300_000){sample.ball.position=point(100,100,-100);sample.ball.velocity=point(99,99,99);}
assert.deepEqual(plain(at(causal,300)),causalBefore,'later actual trajectory cannot change earlier view');

// Surprise must follow an observed abrupt change, with a finite delay and
// reacquisition. Hidden possessed ball payload must never become a new target.
const abrupt=fixture({swing:false,abrupt:true}),early=at(abrupt,392),surprises=[];
for(let ms=400;ms<=1000;ms+=8)surprises.push(at(abrupt,ms).surprise);
assert(Number.isFinite(early.surprise)&&surprises.every(Number.isFinite),'surprise diagnostic is finite');
assert(Math.max(...surprises)>early.surprise+1e-6,'observed abrupt velocity change produces later surprise');
const held=fixture({swing:false}),heldBaseline=plain(at(held,1400));
for(const sample of held.frames)if(sample.possessedBy){sample.ball.position=point(-100,100,-100);sample.ball.velocity=point(100,100,100);}
assert.deepEqual(plain(at(held,1400)),heldBaseline,'possession retains last visible target rather than hidden ball payload');

// Only the declared visual-estimate uncertainty influences this presentation
// policy. Names, league, field reaction and bat motor latency supply no bonus.
const neutral={...batter,physical:{...batter.physical,zoneJudgmentStdMeters:0}},extreme={...batter,physical:{...batter.physical,zoneJudgmentStdMeters:.6}};
const low=at(abrupt,800,neutral),high=at(abrupt,800,extreme);
for(const [selectedBatter,label]of [[neutral,'zero uncertainty'],[extreme,'maximum uncertainty'],[{...batter,physical:{}},'missing ability']]){
 const view=at(abrupt,800,selectedBatter);finitePose(view,label);
 assert(Number.isFinite(view.model.sensorDelaySeconds)&&view.model.sensorDelaySeconds>=0,label+': bounded finite sensor delay');
 const reacquired=at(abrupt,10000+view.model.sensorDelaySeconds*1000,selectedBatter);finitePose(reacquired,label+' held recovery');
 assert(Number.isFinite(reacquired.trackingErrorRadians)&&reacquired.trackingErrorRadians<.025,label+': finite recovery to stationary last visible target');
}
assert(high.model.sensorDelaySeconds>=low.model.sensorDelaySeconds,'larger visual uncertainty cannot shorten recognition delay');
const renamed={...batter,name:'different name',leagueId:'different league',physical:{...batter.physical,
 reactionSeconds:1.5,defensiveDecisionSeconds:1.5,motorLatencySeconds:2,maximumSweetSpotSpeedMps:90}};
assert.deepEqual(plain(at(record,800,renamed)),plain(at(record,800,batter)),'unrelated abilities and identity cannot change visual tracking');
const missing=fixture({swing:true});missing.play.diagnostics={sourceClockTicksPerSecond:tps,swingOffered:true};
finitePose(at(missing,600,{...batter,physical:{}}),'missing optional plan diagnostics');
finitePose(at(null,0),'null record ready view');

// Pitch-only late break: no early knowledge of the changed velocity, then a
// finite prediction discrepancy after the normal sensory delay.
const straightPitch=fixture({swing:false}),lateBreak=fixture({swing:false});
for(const f of lateBreak.frames){const seconds=(f.tick-releaseTick)/tps;if(seconds>=.4&&!f.possessedBy){
 f.ball.velocity.x+=6;f.ball.position.x+=6*(seconds-.4);
}}
assert.deepEqual(plain(at(lateBreak,450)),plain(at(straightPitch,450)),'late break cannot affect gaze before it is observed');
assert(at(lateBreak,600).surprise>at(straightPitch,600).surprise,'late pitch break raises an observed prediction discrepancy');

// The same fastball is more surprising after an observed slow prior pitch
// than after the same fast prior pitch. This changes only the visual observer.
const makePitch=speed=>{
 const r=fixture({swing:false});for(const f of r.frames){const seconds=(f.tick-releaseTick)/tps;
  f.ball.position.z=18-speed*seconds;f.ball.velocity.z=-speed;
 }return r;
};
const currentFast=makePitch(44),knownFast=makePitch(44),priorSlow=makePitch(27);
let expectedError=0,unexpectedError=0,moreSurprising=false;
for(let ms=96;ms<=256;ms+=8){const known=at(currentFast,ms,batter,knownFast),unexpected=at(currentFast,ms,batter,priorSlow);
 expectedError+=known.trackingErrorRadians;unexpectedError+=unexpected.trackingErrorRadians;
 moreSurprising ||= unexpected.surprise>known.surprise+.01;
}
assert(moreSurprising,'observed prior speed changes the finite surprise response');
assert(unexpectedError>expectedError,'unexpected fastball has a larger visual tracking lag in this controlled fixture');

console.log('PASS: continuous batter boundaries; angular speed/acceleration; deterministic seek/rewind; causal prefix; finite surprise/recovery; read-only source and ability scope');
