import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext,runInThisContext} from 'node:vm';

const path=process.argv[2]??'tools/browser-bridge/live-camera-tuning-batter-view.js',context={};
runInNewContext(await readFile(path,'utf8'),context);
const factory=context.KneekuraCameraTuningBatterView,oldContext={};
const oldBytes=await readFile('tools/browser-bridge/live-soft-pitch-batter-view.js');
runInNewContext(oldBytes.toString(),oldContext);
const old=oldContext.KneekuraContinuousBatterView,plain=x=>JSON.parse(JSON.stringify(x)),v=(x=0,y=0,z=0)=>({x,y,z}),
 origin=1e6,preparationMs=1540,sha=x=>createHash('sha256').update(x).digest('hex'),results=[];
assert.equal(factory.version,1);assert(Object.isFrozen(factory));assert(Object.isFrozen(factory.defaults));
assert.deepEqual(plain(factory.normalizeSettings({})),{enabled:true,aimLiftMeters:.30,swingMaxDownRadians:.30,hitFollowDelayMs:100,aimReleaseMs:100});
for(const bad of [null,[],{unknown:1},{enabled:1},{aimLiftMeters:NaN},{aimLiftMeters:Infinity},{aimLiftMeters:-.01},
 {aimLiftMeters:.81},{swingMaxDownRadians:.09},{swingMaxDownRadians:1.26},{hitFollowDelayMs:601},{hitFollowDelayMs:'100'},
 {aimReleaseMs:19},{aimReleaseMs:401},{enabled:undefined}])assert.throws(()=>factory.normalizeSettings(bad));
let getterCalled=false;const accessor={};Object.defineProperty(accessor,'enabled',{enumerable:true,get(){getterCalled=true;return true;}});
assert.throws(()=>factory.normalizeSettings(accessor));assert.equal(getterCalled,false,'settings getters are not executed');
assert.throws(()=>factory.normalizeSettings(Object.defineProperty({},'enabled',{value:true,enumerable:false})));
assert.throws(()=>factory.normalizeSettings({[Symbol('unknown')]:1}));
const configured=factory.create({aimLiftMeters:.5});configured.configure({hitFollowDelayMs:200});
assert.deepEqual(plain(configured.inspectSettings()),{enabled:true,aimLiftMeters:.5,swingMaxDownRadians:.3,hitFollowDelayMs:200,aimReleaseMs:100});
assert(Object.isFrozen(configured.inspectSettings()));const settingsBefore=plain(configured.inspectSettings());
assert.throws(()=>configured.configure({aimLiftMeters:99}));assert.deepEqual(plain(configured.inspectSettings()),settingsBefore);
results.push('strict settings, partial configure, immutable normalized values');

const batter=(side='R',quality='ordinary')=>({playerId:'B',height:1.8,hand:side,physical:{aimStdMeters:quality==='high'?0:quality==='low'?.35:.04,
 timingStdSeconds:quality==='high'?0:quality==='low'?.08:.012,zoneJudgmentStdMeters:quality==='high'?0:quality==='low'?.6:.025}});
function fixture({side='R',swing=true,hit=true,allField=false}={}){
 const frames=Array.from({length:201},(_,i)=>{const t=i*.008,field=allField||hit&&t>=.5,held=t>=1.35;
  return {tick:origin+Math.round(t*1e6),phase:held?'held':field?'batted':'pitch',ballKind:field?'batted':'pitch',possessedBy:held?'C':null,
   ball:{position:field?v(12*(t-.5),1+9*(t-.5),.15+30*(t-.5)):v(.1,1.15-.7*t,18-35*t),velocity:field?v(12,9,30):v(0,-.7,-35),visible:!held},
   bat:{grip:v(side==='R'?-.8:.8,1,t),tip:v(.1,.9,.15)},actors:[{playerId:'B',role:t>=.7?'runner':'batter',
    position:v(side==='R'?-.85:.85,0,-.2+Math.max(0,t-.7)*3),velocity:v(0,0,t>=.7?3:0)}]};});
 return {batterPlayerId:'B',pitcherPlayerId:'P',beforeMatch:{half:'top'},beforeFrame:frames[0],frames,
  command:{managedTeam:0,batting:swing?'balanced':'take'},play:{contactMoment:{ball:{velocity:v(12,9,30)}},diagnostics:{sourceClockTicksPerSecond:1e6,
   predictionMadeAtElapsedSeconds:.14,swingOffered:swing,referenceContactTick:origin+500000,referenceThroughTick:origin+1200000,
   zoneJudgment:{observedForecastPosition:v(.1,.55,.15)},aimErrorMeters:v(.01,-.01,0)}}};
}
function at(api,record,ms,b=batter(),capMs=ms){
 let frame=record.beforeFrame;for(const f of record.frames){if(f.tick>origin+capMs*1000)break;frame=f;}
 return api.observe({record,frame,sceneMs:preparationMs+ms,preparationMs,batter:b});
}
const withoutTuning=view=>{const {tuning:_t,...oldView}=view;return plain(oldView);},delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),
 angular=(a,b)=>Math.hypot(delta(a.yaw,b.yaw),a.pitch-b.pitch);
for(const side of ['R','L']){
 const b=batter(side),record=fixture({side}),baseline=factory.create({enabled:false}),improved=factory.create({}),before=sha(JSON.stringify(record));
 for(const ms of [0,96,280,400,496,584,700,800,1100,1400,1600]){
  const a=at(baseline,record,ms,b),expected=at(old,record,ms,b);
  assert.deepEqual(withoutTuning(a),plain(expected),side+' disabled v52 exact pose, timing, regulation and model');
  const n=at(improved,record,ms,b);assert.deepEqual(plain(n.eye),plain(a.eye),side+' same embodied eye');
 }
 const beforeHit=at(improved,record,496,b);assert.equal(beforeHit.tuning.hitObservedAtSeconds,null);
 const aiming=at(improved,record,450,b),legacyAiming=at(baseline,record,450,b);
 assert(Math.abs(aiming.tuning.aimTarget.y-.84)<1e-12);assert(aiming.regulation.targetPitch<=.3+1e-12);
 assert(aiming.regulation.targetPitch<legacyAiming.regulation.targetPitch,'lift and downward target limit avoid ground-heavy aim');
 const tracked=at(improved,record,850,b);assert.equal(tracked.aimWeight,0);assert.equal(tracked.phase,'batted-tracking');
 assert(at(baseline,record,850,b).aimWeight>.99,'default releases before the former planned swing end');
 assert(tracked.tuning.hitObservedAtSeconds>=.5);assert(tracked.tuning.aimReleaseAtSeconds<1.2);
 let previous=at(improved,record,0,b),velocity=null;
 for(let ms=8;ms<=1400;ms+=8){const next=at(improved,record,ms,b),vel=[delta(next.yaw,previous.yaw)/.008,(next.pitch-previous.pitch)/.008];
  assert(Math.hypot(...vel)<=2.5+1e-8,'bounded angular speed');if(velocity)assert(Math.hypot(vel[0]-velocity[0],vel[1]-velocity[1])/.008<=20+1e-7,'bounded angular acceleration');
  previous=next;velocity=vel;
 }
 for(const ms of [500,tracked.tuning.aimReleaseAtSeconds*1000,tracked.tuning.aimReleaseAtSeconds*1000+100,1200]){
  const a=at(improved,record,ms-.001,b),z=at(improved,record,ms+.001,b);assert(angular(a,z)<=2.5*.000002+1e-8,'no switch-boundary snap');
 }
 assert.equal(sha(JSON.stringify(record)),before,'Source and measured bat frames remain untouched');
 const saved=plain(at(improved,record,850,b)),alternate={aimLiftMeters:.7,hitFollowDelayMs:400,aimReleaseMs:300};
 improved.configure(alternate);const alternateView=at(improved,record,850,b);assert(alternateView.aimWeight>.99);assert(angular(alternateView,saved)>.01,'settings change actual camera motion, not only diagnostics');
 improved.configure(factory.defaults);assert.deepEqual(plain(at(improved,record,850,b)),saved,'A to B to A recomputes deterministically');
 for(const ms of [1100,400,850,96,850])assert.deepEqual(plain(at(improved,record,ms,b)),plain(at(factory.create({}),record,ms,b)),'rewind and query-order determinism');
 for(const quality of ['high','low'])for(const ms of [96,200])assert.deepEqual(withoutTuning(at(improved,record,ms,batter(side,quality))),plain(at(old,record,ms,batter(side,quality))),'incoming ability law unchanged');
 for(const options of [{side,swing:false,hit:false},{side,swing:false,allField:true}]){
  const unchanged=fixture(options);for(const ms of [96,400,850,1400])assert.deepEqual(withoutTuning(at(factory.create({}),unchanged,ms,b)),plain(at(old,unchanged,ms,b)),'take and existing field tracking laws unchanged');
 }
 assert.deepEqual(withoutTuning(at(factory.create({enabled:false,aimLiftMeters:.8,swingMaxDownRadians:1.25,hitFollowDelayMs:600,aimReleaseMs:400}),record,850,b)),plain(at(old,record,850,b)),'disabled ignores all numerical knobs');
 const highAim=at(factory.create({aimLiftMeters:.8}),record,450,b),lowAim=at(factory.create({aimLiftMeters:0}),record,450,b);
 assert(highAim.pitch<lowAim.pitch-.01,'lift changes the actual single-eye pitch');
 const shallow=at(factory.create({aimLiftMeters:0,swingMaxDownRadians:.1}),record,450,b),deep=at(factory.create({aimLiftMeters:0,swingMaxDownRadians:1.25}),record,450,b);
 assert(shallow.regulation.targetPitch<=.1+1e-12);assert(shallow.pitch<deep.pitch-.01,'downward objective bound changes the actual observer');
 assert.equal(at(factory.create({aimReleaseMs:20}),record,800,b).aimWeight,0);
 assert(at(factory.create({aimReleaseMs:400}),record,800,b).aimWeight>.1,'release duration changes when tracking takes over');
 results.push(side+' baseline/early follow/lift/one-eye/continuous limits/Source/rewind/abilities/take/field');
}

const prefix=fixture(),poisoned=structuredClone(prefix);
const fractionalHit=at(factory.create({}),prefix,581),wholeHit=at(factory.create({}),prefix,584);
assert.equal(fractionalHit.tuning.firstBattedTick,wholeHit.tuning.firstBattedTick);
assert.equal(fractionalHit.tuning.hitObservedAtSeconds,wholeHit.tuning.hitObservedAtSeconds,'sensory onset is independent of partial integration query');
assert.equal(fractionalHit.tuning.hitObservedAtSeconds,(fractionalHit.tuning.firstBattedTick-origin)/1e6+fractionalHit.model.sensorDelaySeconds);
for(const f of poisoned.frames)if(f.tick>origin+400000)for(const key of ['ball','actors','phase','homeRunConfirmed'])
 Object.defineProperty(f,key,{get(){throw Error('unobserved future '+key);}});
const capped=factory.create({}),cappedView=at(capped,poisoned,1000,batter(),400);
assert.equal(cappedView.tuning.hitObservedAtSeconds,null,'unobserved hit cannot start timer');
assert.deepEqual(plain(cappedView),plain(at(factory.create({}),prefix,1000,batter(),400)),'future payload is irrelevant');
const cache=factory.create({});at(cache,prefix,1400);assert.deepEqual(plain(at(cache,prefix,1000,batter(),400)),plain(at(factory.create({}),prefix,1000,batter(),400)),'cap rewind invalidates unseen cache');
assert.equal(at(factory.create({}),prefix,400,batter(),1600).tuning.hitObservedAtSeconds,null,'future cap cannot overrule elapsed observation time');
const homeRun=fixture({swing:false,allField:true});
for(const f of homeRun.frames){if(f.tick>=origin+800000)f.homeRunConfirmed=true;if(f.tick>=origin+1400000)f.phase='bench';}
for(const ms of [900,1100,1400,1550])assert.deepEqual(withoutTuning(at(factory.create({}),homeRun,ms)),plain(at(old,homeRun,ms)),'existing home-run-forward and bench law unchanged');
results.push('prefix poison, sensory causal hit timer, cap and scene rewind');

// Execute a current compiled Core pitch, then observe its frozen record from
// several presets. Camera configuration never enters the Host or bat motor.
const nativeBytes=await readFile('dist/native-match-core-browser.js'),pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
assert.equal(sha(nativeBytes),pins.entrySha256);for(const [sourcePath,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(sourcePath)),hash,sourcePath);
runInThisContext(nativeBytes.toString());
const roles=['P','C','1B','2B','3B','SS','LF','CF','RF'],
 teams=[0,1].map(t=>({id:'T'+t,name:'T'+t,battingOrder:roles.map((_,i)=>t+'B'+i),pitcherId:t+'P',
  defense:Object.fromEntries(roles.map((role,i)=>[role,i?t+'B'+(i-1):t+'P']))})),
 players=[0,1].flatMap(t=>[...roles.map((_,i)=>({playerId:t+'B'+i,name:'B'+i,heightMeters:1.8,bats:i%2?'R':'L'})),{playerId:t+'P',name:'P',heightMeters:1.8,bats:'R'}]),
 measured=await readFile('docs/demos/measured-bat-motions.json');
const host=globalThis.KneekuraNativeMatchCore.createLiveBaseballMatchV1({seed:1234,teams,players,measuredClips:JSON.parse(measured).clips}),
 record=host.issuePitch({batting:'balanced',managedTeam:0,pitchType:'auto',location:'auto'}),snapshot=sha(JSON.stringify(record)),realBatter=players.find(p=>p.playerId===record.batterPlayerId);
assert(record.play.contactMoment&&record.play.field&&record.frames.some(f=>f.ballKind==='batted'),'the actual Core proof contains real rigid-bat contact and live field motion');
for(const settings of [{enabled:false},{},{aimLiftMeters:.7,hitFollowDelayMs:0}]){
 const controller=factory.create(settings),start=record.frames[0].tick;
 for(const frame of record.frames.filter((_,i)=>i%5===0))controller.observe({record,frame,sceneMs:preparationMs+(frame.tick-start)/1000,preparationMs,batter:realBatter});
 assert.equal(sha(JSON.stringify(record)),snapshot,'real Source / rigid bat record unchanged');
}
assert.equal(sha(await readFile('tools/browser-bridge/live-soft-pitch-batter-view.js')),sha(oldBytes));
assert.equal(sha(await readFile('docs/demos/measured-bat-motions.json')),sha(measured));
console.log(JSON.stringify({pass:true,results,actualCore:{nativeSha256:sha(nativeBytes),sourceInputs:Object.keys(pins.inputs).length,
 recordSha256:snapshot,measuredBatSha256:sha(measured),frames:record.frames.length},scope:'read-only authored camera controller, not physical or neural calibration'}));
