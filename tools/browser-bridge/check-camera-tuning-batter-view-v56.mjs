import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext,runInThisContext} from 'node:vm';
const load=async path=>{const context={};runInNewContext(await readFile(path,'utf8'),context);return context.KneekuraCameraTuningBatterView;};
const api=await load(process.argv[2]??'tools/browser-bridge/live-camera-tuning-batter-view-v56.js'),old=await load('tools/browser-bridge/live-camera-tuning-batter-view.js'),
 plain=x=>JSON.parse(JSON.stringify(x)),sha=x=>createHash('sha256').update(x).digest('hex'),v=(x=0,y=0,z=0)=>({x,y,z}),origin=1e6,prep=1540,
 identity={pitchTrackingGain:1,pitchTrackingDeadbandRadians:0},baseline=view=>{const out=plain(view);delete out.tuning.pitchTracking;
  delete out.tuning.settings.pitchTrackingGain;delete out.tuning.settings.pitchTrackingDeadbandRadians;return out;},
 angular=(a,b)=>Math.hypot(Math.atan2(Math.sin(a.yaw-b.yaw),Math.cos(a.yaw-b.yaw)),a.pitch-b.pitch);
assert.equal(api.version,1);assert(Object.isFrozen(api));assert(Object.isFrozen(api.defaults));
assert.equal(api.defaults.pitchTrackingGain,.15);assert.equal(api.defaults.pitchTrackingDeadbandRadians,.02);
const controller=api.create(),beforeSettings=plain(controller.inspectSettings());
let getterCalled=false;const getter={};Object.defineProperty(getter,'pitchTrackingGain',{enumerable:true,get(){getterCalled=true;return .5;}});
const symbolGetter={};Object.defineProperty(symbolGetter,Symbol.toStringTag,{get(){getterCalled=true;return 'Object';}});
const bad=[null,[],{},new Date(),{unknown:1},{pitchTrackingGain:-.01},{pitchTrackingGain:1.01},{pitchTrackingGain:NaN},
 {pitchTrackingGain:Infinity},{pitchTrackingGain:'0.1'},{pitchTrackingGain:undefined},{pitchTrackingDeadbandRadians:-.001},
 {pitchTrackingDeadbandRadians:.151},{pitchTrackingDeadbandRadians:NaN},{pitchTrackingDeadbandRadians:Infinity},getter,symbolGetter,
 {[Symbol('unknown')]:1},{enabled:1},{aimLiftMeters:NaN},{aimLiftMeters:.81},{swingMaxDownRadians:.09},{hitFollowDelayMs:601},
 {aimReleaseMs:401},{pitchTrackingGain:.8,pitchTrackingDeadbandRadians:.9},Object.defineProperty({},'pitchTrackingGain',{value:.1,enumerable:false})];
bad.splice(2,1); // An empty settings patch is deliberately valid.
for(const value of bad){assert.throws(()=>controller.configure(value));assert.throws(()=>api.normalizeSettings(value));
 assert.deepEqual(plain(controller.inspectSettings()),beforeSettings,'invalid patch remains atomic');}
assert.equal(getterCalled,false);assert.equal(bad.length,25);
controller.configure({pitchTrackingGain:.1});controller.configure({pitchTrackingDeadbandRadians:0});
assert.equal(controller.inspectSettings().pitchTrackingGain,.1);assert.equal(api.normalizeSettings({}).pitchTrackingGain,.15);
controller.configure(Object.assign(Object.create(null),{pitchTrackingGain:1}));
assert(Object.isFrozen(controller.inspectSettings()));
const batter=side=>({playerId:'B',height:1.8,hand:side,physical:{aimStdMeters:0,timingStdSeconds:0,zoneJudgmentStdMeters:0}});
const ready=(factory,side)=>factory.create().observe({record:null,frame:null,sceneMs:0,preparationMs:prep,batter:batter(side)});
function fixture({side='R',yaw=.3,pitch=.1,swing=false,hit=false,field=false,release=false}={}){
 const base=ready(old,side),target=release?v(0,2.1,16):v(base.eye.x+10*Math.sin(base.yaw+yaw),base.eye.y-10*Math.tan(base.pitch+pitch),base.eye.z+10*Math.cos(base.yaw+yaw));
 const frames=Array.from({length:801},(_,i)=>{const t=i*.008,batted=field||hit&&t>=.5;
  return {tick:origin+Math.round(t*1e6),phase:batted?'batted':'pitch',ballKind:batted?'batted':'pitch',possessedBy:null,
   ball:{position:batted?v(15*t,1+7*t,.15+30*t):target,velocity:batted?v(15,7,30):v(),visible:true},
   actors:[{playerId:'B',role:batted?'runner':'batter',position:v(side==='R'?-.85:.85,0,batted?3*t:0),velocity:v(0,0,batted?3:0)}],
   bat:{grip:v(0,1,t),tip:v(.1,.9,.15)}};});
 return {batterPlayerId:'B',pitcherPlayerId:'P',beforeMatch:{half:'top'},beforeFrame:frames[0],frames,command:{managedTeam:0,batting:swing?'balanced':'take'},
  play:{contactMoment:{ball:{velocity:v(15,7,30)}},diagnostics:{sourceClockTicksPerSecond:1e6,predictionMadeAtElapsedSeconds:.14,swingOffered:swing,
   referenceContactTick:origin+500000,referenceThroughTick:origin+1200000,zoneJudgment:{observedForecastPosition:v(.1,.7,.15)},aimErrorMeters:v()}}};
}
function at(c,r,ms,side='R',cap=ms){let frame=r.beforeFrame;for(const f of r.frames){if(f.tick>origin+cap*1000)break;frame=f;}
 return c.observe({record:r,frame,sceneMs:prep+ms,preparationMs:prep,batter:batter(side)});}
const results=[];
for(const side of ['R','L']){
 for(const enabled of [false,true])for(const options of [{},{swing:true,hit:true},{field:true},{release:true}]){
  const r=fixture({side,...options}),one=api.create({enabled,...identity}),two=old.create({enabled});
  for(const ms of [0,96,200,400,504,579,800,1200,1800,4000,6000])assert.deepEqual(baseline(at(one,r,ms,side)),plain(at(two,r,ms,side)),'identity keeps complete v55 view exact');
 }
 const r=fixture({side}),c=api.create({enabled:false,pitchTrackingGain:.1,pitchTrackingDeadbandRadians:0}),base=ready(api,side),snapshot=sha(JSON.stringify(r)),
  early=at(c,r,1000,side),late=at(c,r,6000,side),tracking=late.tuning.pitchTracking;
 assert(tracking.applied);assert(Math.abs(tracking.headTargetErrorRadians/tracking.rawErrorRadians-.1)<1e-12,'one-to-ten angular objective');
 assert(angular(late,base)<=tracking.headTargetErrorRadians+1e-5,'long observation cannot creep back to the full ball angle');
 assert(angular(late,at(c,r,4000,side))<1e-5,'constant target remains settled');
 assert(angular(early,base)>.005,'existing motor still turns toward the compressed objective');
 const bandRecord=fixture({side,yaw:.01,pitch:0}),band=at(api.create({}),bandRecord,6000,side);
 assert.equal(band.tuning.pitchTracking.headTargetErrorRadians,0);assert(angular(band,base)<1e-12,'small movement within band holds the stance direction');
 const zero=at(api.create({pitchTrackingGain:0,pitchTrackingDeadbandRadians:0}),r,6000,side);
 assert(angular(zero,base)<1e-12,'zero debug gain holds base even for a large pitch angle');
 const release=fixture({side,release:true}),newRelease=at(api.create({}),release,200,side),oldRelease=at(old.create(),release,200,side);
 assert(newRelease.pitch>oldRelease.pitch,'default reduces excessive upward release-height pursuit');
 let previous=at(c,r,0,side),velocity=null;
 for(let ms=8;ms<=1400;ms+=8){const next=at(c,r,ms,side),vel=[Math.atan2(Math.sin(next.yaw-previous.yaw),Math.cos(next.yaw-previous.yaw))/.008,(next.pitch-previous.pitch)/.008];
  assert(Math.hypot(...vel)<=2.5+1e-8);if(velocity)assert(Math.hypot(vel[0]-velocity[0],vel[1]-velocity[1])/.008<=20+1e-7);previous=next;velocity=vel;}
 const saved=plain(at(c,r,1600,side));c.configure({pitchTrackingGain:.9});assert(angular(at(c,r,1600,side),saved)>.05);
 c.configure({pitchTrackingGain:.1});assert.deepEqual(plain(at(c,r,1600,side)),saved,'gain A to B to A');
 for(const ms of [4000,1000,579,1600])assert.deepEqual(plain(at(c,r,ms,side)),plain(at(api.create({enabled:false,pitchTrackingGain:.1,pitchTrackingDeadbandRadians:0}),r,ms,side)),'rewind is deterministic');
 const changed=fixture({side,swing:true,hit:true}),active=api.create(),oldActive=old.create();
 for(const hit of [false,true]){
  const boundaryRecord=fixture({side,swing:true,hit}),reader=api.create();
  // The old controller has a binary pursuit/bracing seam. New compression
  // must not introduce another seam, including queries between 8 ms states.
  for(const ms of [270,410,...(hit?[664,764]:[1200,1300])])assert(angular(at(reader,boundaryRecord,ms-.001,side),at(reader,boundaryRecord,ms+.001,side))<=2.5*.000002+1e-8,'new tracking gate is continuous at a fractional swing boundary');
  let prev=at(reader,boundaryRecord,0,side),priorVelocity=null;
  for(let ms=8;ms<=1400;ms+=8){const next=at(reader,boundaryRecord,ms,side),velocity=[(next.yaw-prev.yaw)/.008,(next.pitch-prev.pitch)/.008];
   assert(Math.hypot(...velocity)<=2.5+1e-8,'swing transition respects angular speed');
   if(priorVelocity)assert(Math.hypot(velocity[0]-priorVelocity[0],velocity[1]-priorVelocity[1])/.008<=20+1e-7,'swing transition respects angular acceleration');
   prev=next;priorVelocity=velocity;
  }
 }
 const acquiring=at(api.create(),changed,340,side),acquisition=acquiring.tuning.pitchTracking;
 assert(acquiring.aimWeight>0&&acquiring.aimWeight<1&&acquisition.applied);
 assert(acquisition.headTargetErrorRadians/acquisition.rawErrorRadians>api.defaults.pitchTrackingGain,'pitch compression releases continuously during aim acquisition');
 for(const ms of [400,450,900,1100]){const a=at(active,changed,ms,side),o=at(oldActive,changed,ms,side);
  assert.deepEqual(plain(a.eye),plain(o.eye),'body eye law preserved');
  if(a.aimWeight===1||a.phase==='batted-tracking'){assert.equal(a.tuning.pitchTracking.applied,false);
   assert.equal(a.regulation.targetYaw,o.regulation.targetYaw);assert.equal(a.regulation.targetPitch,o.regulation.targetPitch,'swing and field objective laws preserved');}}
 assert.equal(sha(JSON.stringify(r)),snapshot);results.push(side+' exact identity/static ratio/no creep/band/zero/release height/limits/cache/field law');
}
const prefix=fixture({swing:true,hit:true}),poison=structuredClone(prefix);
for(const f of poison.frames)if(f.tick>origin+400000)for(const key of ['ball','actors','phase','homeRunConfirmed'])Object.defineProperty(f,key,{get(){throw Error('future '+key);}});
assert.deepEqual(plain(at(api.create(),poison,1000,'R',400)),plain(at(api.create(),prefix,1000,'R',400)),'future payload is never observed');
const sourceBytes=await readFile('dist/native-match-core-browser.js'),pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
assert.equal(sha(sourceBytes),pins.entrySha256);for(const [p,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(p)),hash,p);
runInThisContext(sourceBytes.toString());const core=globalThis.KneekuraNativeMatchCore,roles=['P','C','1B','2B','3B','SS','LF','CF','RF'],
 teams=[0,1].map(t=>({id:'T'+t,name:'T'+t,battingOrder:roles.map((_,i)=>t+'B'+i),pitcherId:t+'P',defense:Object.fromEntries(roles.map((r,i)=>[r,i?t+'B'+(i-1):t+'P']))})),
 players=[0,1].flatMap(t=>[...roles.map((_,i)=>({playerId:t+'B'+i,name:'B'+i,heightMeters:1.8,bats:i%2?'R':'L'})),{playerId:t+'P',name:'P',heightMeters:1.8,bats:'R'}]),
 measuredBytes=await readFile('docs/demos/measured-bat-motions.json'),host=core.createLiveBaseballMatchV1({seed:1234,teams,players,measuredClips:JSON.parse(measuredBytes).clips}),hashes=[];
let contactCount=0;
for(let i=0;i<12;i++){
 const record=host.issuePitch({batting:'balanced',managedTeam:0,pitchType:'auto',location:'auto'}),before=sha(JSON.stringify(record)),b=players.find(p=>p.playerId===record.batterPlayerId);
 if(record.play.contactMoment)contactCount++;
 for(const settings of [identity,{}, {pitchTrackingGain:0,pitchTrackingDeadbandRadians:.15},{pitchTrackingGain:.9,pitchTrackingDeadbandRadians:0}]){
  const c=api.create(settings),first=record.frames[0].tick;
  for(const frame of record.frames.filter((_,index)=>index%11===0))c.observe({record,frame,sceneMs:prep+(frame.tick-first)/1000,preparationMs:prep,batter:b});
  assert.equal(sha(JSON.stringify(record)),before,'real physical record and bat data unchanged');
 }
 hashes.push(before);
}
assert(contactCount>0);assert.equal(sha(await readFile('docs/demos/measured-bat-motions.json')),sha(measuredBytes));
console.log(JSON.stringify({pass:true,results,invalidCases:bad.length,actualCore:{nativeSha256:sha(sourceBytes),sourceInputs:Object.keys(pins.inputs).length,
 pitches:hashes.length,contactCount,recordsSha256:sha(JSON.stringify(hashes)),measuredBatSha256:sha(measuredBytes)},scope:'static stance-relative authored head objective; SI coefficients and motor limits retained; continuous aim boundary weights; no physical changes'}));
