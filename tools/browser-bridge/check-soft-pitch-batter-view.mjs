import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const load=async path=>{const ctx={};runInNewContext(await readFile(path,'utf8'),ctx);return ctx.KneekuraContinuousBatterView;};
const current=await load(process.argv[2]??'tools/browser-bridge/live-soft-pitch-batter-view.js');
const old=await load('tools/browser-bridge/live-batter-braking-view.js');
const plain=x=>JSON.parse(JSON.stringify(x)),v=(x=0,y=0,z=0)=>({x,y,z});
const origin=1e6,preparationMs=1540;
const profile=(side='R',aim=.04,timing=.012,zone=.025)=>({playerId:'B',height:1.8,hand:side,
 physical:{aimStdMeters:aim,timingStdSeconds:timing,zoneJudgmentStdMeters:zone}});
const distance=(a,b)=>Math.hypot(Math.atan2(Math.sin(a.yaw-b.yaw),Math.cos(a.yaw-b.yaw)),a.pitch-b.pitch);
function fixture(side='R',mode='jitter'){
 const base=old.observe({record:null,frame:null,sceneMs:0,preparationMs,batter:profile(side)});
 const frames=Array.from({length:151},(_,i)=>{
  const t=i*.008,field=mode==='batted'||mode==='throw',offset=mode==='jitter'?.01*Math.sin(t*27):t>=.2?.7:0;
  return {tick:origin+Math.round(t*1e6),phase:field?'batted':'pitch',ballKind:field?mode:'pitch',possessedBy:null,
   ball:{visible:true,position:field?v(15*t,2+8*t,10+25*t):v(base.eye.x+Math.sin(base.yaw)*10+offset,base.eye.y-Math.tan(base.pitch)*10,base.eye.z+Math.cos(base.yaw)*10),
    velocity:field?v(15,8,25):v()},actors:[{playerId:'B',role:field?'runner':'batter',position:v(0,0,field?3*t:0),velocity:v(0,0,field?3:0)}]};
 });
 return {batterPlayerId:'B',pitcherPlayerId:'P',beforeMatch:{half:'top'},beforeFrame:frames[0],frames,
  command:{managedTeam:0,batting:'balanced'},play:{diagnostics:{sourceClockTicksPerSecond:1e6,predictionMadeAtElapsedSeconds:.14}}};
}
function at(api,record,ms,batter=profile(),capMs=ms){
 const frame=record.frames.findLast(f=>f.tick<=origin+capMs*1000)??record.frames[0];
 return api.observe({record,frame,sceneMs:preparationMs+ms,preparationMs,batter});
}
const results=[];
for(const side of ['R','L']){
 const r=fixture(side),before=JSON.stringify(r),b=profile(side),base=at(current,r,0,b);
 let newMovement=0,oldMovement=0,previous=base,oldPrevious=at(old,r,0,b);
 for(let ms=8;ms<=1000;ms+=8){
  const a=at(current,r,ms,b),o=at(old,r,ms,b);
  newMovement+=distance(a,previous);oldMovement+=distance(o,oldPrevious);previous=a;oldPrevious=o;
 }
 assert(oldMovement>1e-4,'stimulus actually moves the v49 camera');
 assert(newMovement<oldMovement*.15,'small ball movements should not drag the camera: '+newMovement+'/'+oldMovement);
 assert.equal(JSON.stringify(r),before,'observer never mutates Source');
 const step=fixture(side,'step'),high=profile(side,0,0,0),low=profile(side,.35,.08,.6);
 const target=at(old,step,1200,high),highView=at(current,step,1200,high),lowView=at(current,step,1200,low),ready=at(current,step,0,low);
 assert(distance(highView,target)<distance(lowView,target),'combined high abilities follow a broad motion more closely');
 assert(distance(lowView,ready)>.025,'low abilities still follow the ball substantially');
 assert(distance(highView,target)>.001,'even perfect authored abilities are not glued to the ball');
 const contactLow=at(current,step,1100,profile(side,.35,.08,.025)),contactHigh=at(current,step,1100,profile(side,0,0,.025));
 const visionLow=at(current,step,1100,profile(side,.04,.012,.6)),visionHigh=at(current,step,1100,profile(side,.04,.012,0));
 assert(contactHigh.model.pitchTrackingGain>contactLow.model.pitchTrackingGain,'meet alone affects the policy');
 assert(visionHigh.model.pitchTrackingGain>visionLow.model.pitchTrackingGain,'vision alone affects the policy');
 for(const q of [highView,lowView,contactLow,contactHigh,visionLow,visionHigh]){
  assert(q.model.pitchTrackingGain>=.55&&q.model.pitchTrackingGain<=.92);
  assert(q.model.pitchTrackingDeadbandRadians>=.006&&q.model.pitchTrackingDeadbandRadians<=.026);
  assert.deepEqual(plain(q.eye),plain(target.eye));
 }
 // The same cached record must respond when a user edits either existing SI.
 assert.deepEqual(plain(at(current,step,1200,low)),plain(lowView));
 assert.deepEqual(plain(at(current,step,1200,high)),plain(highView));
 const saved=new Map([96,280,496,700,1000].map(ms=>[ms,plain(at(current,step,ms,b))]));
 for(const [ms,pose]of [...saved].reverse())assert.deepEqual(plain(at(current,step,ms,b)),pose,'seek order determinism');
 const prefix=fixture(side,'step'),fresh=structuredClone(prefix),cached=at(current,prefix,900,b,400);
 assert.deepEqual(plain(cached),plain(at(current,fresh,900,b,400)),'observed prefix cap');
 for(const kind of ['batted','throw']){
  const field=fixture(side,kind),copy=structuredClone(field);
  for(const ms of [0,96,280,496,700,1000]){
   const a=at(current,field,ms,b),o=at(old,copy,ms,b);
   for(const key of ['eye','yaw','pitch','f','cx','cy','labelMetres','phase','aimWeight','surprise'])assert.deepEqual(plain(a[key]),plain(o[key]),kind+' v49 '+key);
  }
 }
 results.push({side,newMovement,oldMovement,highError:distance(highView,target),lowError:distance(lowView,target)});
}
console.log(JSON.stringify({pass:true,results,scope:'v49 observer with bounded pitch-only pursuit; synthetic controller stimuli, not real-player calibration'}));
