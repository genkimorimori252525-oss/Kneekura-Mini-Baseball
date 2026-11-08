import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const current={},previous={};
runInNewContext(await readFile('tools/browser-bridge/live-batter-braking-view.js','utf8'),current);
const oldHtml=await readFile('docs/demos/releases/v47/game.html','utf8');
runInNewContext(oldHtml.match(/<script id="v47-continuous-view">\s*([\s\S]*?)<\/script>/)[1],previous);
const plain=v=>JSON.parse(JSON.stringify(v)),point=(x,y,z)=>({x,y,z}),origin=1e6,preparationMs=1540;
const batter=side=>({playerId:'B',heightMeters:1.8,bats:side,physical:{zoneJudgmentStdMeters:.025}});
function fixture(side='R',swing=false,kind='pitch'){
 const frames=Array.from({length:201},(_,i)=>{
  const t=i*.008,held=kind==='pitch'&&!swing&&t>=.56,hit=kind!=='pitch'||swing&&t>=.5;
  return {tick:origin+Math.round(t*1e6),phase:held?'held':hit?'batted':'pitch',ballKind:hit?kind==='throw'?'throw':'batted':'pitch',
   possessedBy:held?'C':null,ball:{visible:!held,position:hit?point(12*t,2+8*t,10+25*t):point(.1,1.3-.8*t,18-35*t),
    velocity:hit?point(12,8,25):point(0,-.8,-35)},actors:[{playerId:'B',role:hit?'runner':'batter',
     position:point(side==='R'?-.85:.85,0,hit?3*(swing?Math.max(0,t-.5):t):0),velocity:point(0,0,hit?3:0)}]};
 });
 return {batterPlayerId:'B',pitcherPlayerId:'P',beforeMatch:{half:'top'},beforeFrame:frames[0],frames,
  command:{managedTeam:0,batting:swing?'balanced':'take'},play:{diagnostics:{sourceClockTicksPerSecond:1e6,swingOffered:swing,
   predictionMadeAtElapsedSeconds:.14,referenceStartTick:origin+300000,referenceContactTick:origin+500000,
   referenceThroughTick:origin+700000,zoneJudgment:{observedForecastPosition:point(.1,.95,.15)},aimErrorMeters:point(0,0,0)}}};
}
function at(api,r,ms,side){const frame=r.frames.findLast(f=>f.tick<=origin+ms*1000)??r.frames[0];
 return api.KneekuraContinuousBatterView.observe({record:r,frame,sceneMs:preparationMs+ms,preparationMs,batter:batter(side)});}
const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),distance=(a,b)=>Math.hypot(angle(a.yaw,b.yaw),a.pitch-b.pitch);
const results=[];
for(const side of ['R','L']){
 const take=fixture(side),oldTake=structuredClone(take),samples=[],oldSamples=[];
 for(let ms=0;ms<=850;ms+=8){samples.push(at(current,take,ms,side));oldSamples.push(at(previous,oldTake,ms,side));}
 const maximumPitch=Math.max(...samples.map(s=>s.pitch));
 assert(maximumPitch<=.325,'take stops short of looking down into mitt: '+maximumPitch);
 assert(maximumPitch<Math.max(...oldSamples.map(s=>s.pitch))-.15,'meaningfully less bowing than v47');
 const stopped=samples.filter((_,i)=>i*8>=480&&i*8<=560);
 const endSpeed=Math.max(...stopped.slice(1).map((s,i)=>distance(s,stopped[i])/.008));
 assert(endSpeed<.35,'take gaze brakes before catch: '+endSpeed);
 const swing=fixture(side,true),oldSwing=structuredClone(swing);
 const hold=fixture(side,true);for(const f of hold.frames){f.actors[0].position.z=0;f.actors[0].velocity=point(0,0,0);}
 const oldHoldRecord=structuredClone(hold);
 let newHold=0,oldHold=0,newError=0,oldError=0;
 for(let ms=560;ms<=696;ms+=8){
  const s=at(current,swing,ms,side),o=at(previous,oldSwing,ms,side);
  const aim=p=>({yaw:Math.atan2(.1-p.eye.x,.15-p.eye.z),pitch:-Math.atan2(.95-p.eye.y,Math.hypot(.1-p.eye.x,.15-p.eye.z))});
  newError+=distance(s,aim(s));oldError+=distance(o,aim(o));
  // Separate a fixed-body gaze hold from the legitimate angle change needed
  // to keep looking at the same world point while the runner starts moving.
  newHold+=distance(at(current,hold,ms,side),at(current,hold,ms-8,side));
  oldHold+=distance(at(previous,oldHoldRecord,ms,side),at(previous,oldHoldRecord,ms-8,side));
 }
 assert(newError<oldError*.75,'brace settles closer to planned aim');
 assert(newHold<oldHold*.85,'brace moves less during stationary swing finish: '+newHold/oldHold);
 // Field tracking starts with its own real observed state. No pitch-only
 // damping, target limits or altered body motion may leak into this mode.
 for(const kind of ['batted','throw']){
  const field=fixture(side,false,kind),oldField=structuredClone(field);
  for(const ms of [0,96,192,400,704,1000,1400]){
   const a=plain(at(current,field,ms,side)),b=plain(at(previous,oldField,ms,side));
   delete a.regulation;delete b.regulation;assert.deepEqual(a,b,kind+' runner observer unchanged');
  }
 }
 const times=[96,280,496,500,696,700,880,1200];
 const views=new Map(times.map(ms=>[ms,plain(at(current,swing,ms,side))]));
 for(const ms of times.toReversed())assert.deepEqual(plain(at(current,swing,ms,side)),views.get(ms),'rewind determinism');
 assert.equal(at(current,swing,696,side).regulation.mode,'swing-brace');
 assert.equal(at(current,swing,752,side).regulation.mode,'field-follow','bracing must release into original field controller');
 for(const boundary of [215,700,740]){
  const a=at(current,swing,boundary-.001,side),b=at(current,swing,boundary+.001,side);
  assert(distance(a,b)<=2.5*.000002+1e-8,'no camera cut at braking boundary '+boundary);
 }
 const futureTake=fixture(side),futureSwing=fixture(side,true);
 futureTake.command.batting=futureSwing.command.batting='balanced';
 // Identical available world prefix; only the not-yet-readable decision differs.
 futureSwing.frames=structuredClone(futureTake.frames);futureSwing.beforeFrame=futureSwing.frames[0];
 for(const ms of [80,100,160,214.999])assert.deepEqual(plain(at(current,futureTake,ms,side)),plain(at(current,futureSwing,ms,side)),
  'take/swing decision must not alter the earlier balanced-pitch view');
 const guarded=fixture(side);Object.defineProperty(guarded.play.diagnostics,'swingOffered',{get(){throw Error('decision read before available');}});
 at(current,guarded,100,side);
 const bunt=fixture(side,true);bunt.command.batting='bunt';const oldBunt=structuredClone(bunt);
 for(const ms of [96,280,500,700,1000]){
  const a=plain(at(current,bunt,ms,side)),b=plain(at(previous,oldBunt,ms,side));delete a.regulation;assert.deepEqual(a,b,'bunt unchanged');
 }
 const whiff=fixture(side,true);for(const f of whiff.frames){f.ballKind='pitch';f.phase='pitch';f.actors[0].role='batter';}
 for(const ms of [300,500,700,740,1000]){const s=at(current,whiff,ms,side);assert(Number.isFinite(s.yaw)&&Number.isFinite(s.pitch),'finite whiff');}
 results.push({side,maximumPitch,endSpeed,swingAimErrorRatio:newError/oldError,swingFinishMotionRatio:newHold/oldHold});
}
console.log(JSON.stringify({pass:true,results,pureBattedAndThrowObserverExactlyPreserved:true}));
