import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext,runInThisContext} from 'node:vm';

const load=async path=>{const context={};runInNewContext(await readFile(path,'utf8'),context);return context.KneekuraCameraTuningBatterView;},
 factory=await load(process.argv[2]??'tools/browser-bridge/live-camera-tuning-batter-view-v61.js'),
 frozen=await load('tools/browser-bridge/live-camera-tuning-batter-view-v60.js'),
 plain=x=>JSON.parse(JSON.stringify(x)),sha=x=>createHash('sha256').update(x).digest('hex'),v=(x=0,y=0,z=0)=>({x,y,z}),
 origin=1e6,prep=1540,delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),
 angular=(a,b)=>Math.hypot(delta(a.yaw,b.yaw),a.pitch-b.pitch),results=[];
const batter=(side='R',vision=45)=>({playerId:'B',height:1.8,hand:side,
 physical:{plateVision:vision,aimStdMeters:.04,timingStdSeconds:.012,zoneJudgmentStdMeters:.025}});
function fixture({side='R',swing=false,bunt=false,field=false,heldAt=.640375,through=.89}={}){
 const sign=side==='R'?1:-1,times=[...Array.from({length:301},(_,i)=>i*.008),heldAt].sort((a,b)=>a-b),
  frames=times.map(t=>{const held=!field&&t>=heldAt;
   return {tick:origin+Math.round(t*1e6),phase:held?'held':field?'batted':'pitch',ballKind:field?'batted':'pitch',possessedBy:held?'C':null,
    ball:{position:field?v(12*t,1+9*t,.15+30*t):v(sign*(.15+.3*t),1.9+2*t-3*t*t,18-30*t),
     velocity:field?v(12,9,30):v(sign*.3,2-6*t,-30),visible:!held},
    bat:{grip:v(-sign*.8,1,t),tip:v(sign*.1,.9,.15)},actors:[{playerId:'B',role:'batter',position:v(-sign*.85,0,-.2),velocity:v()}]};});
 return {batterPlayerId:'B',pitcherPlayerId:'P',beforeMatch:{half:'top'},beforeFrame:frames[0],frames,
  command:{managedTeam:0,batting:bunt?'bunt':swing?'balanced':'take'},
  play:{diagnostics:{sourceClockTicksPerSecond:1e6,predictionMadeAtElapsedSeconds:.14,swingOffered:swing,
   referenceStartTick:origin+293125,referenceContactTick:origin+520375,referenceThroughTick:origin+Math.round(through*1e6),
   zoneJudgment:{observedForecastPosition:v(sign*.1,.55,.15)},aimErrorMeters:v(sign*.01,-.01,0)}}};
}
function at(controller,record,ms,actor=batter(),capMs=ms){let frame=record.beforeFrame;
 for(const current of record.frames){if(current.tick>origin+capMs*1000)break;frame=current;}
 return controller.observe({record,frame,sceneMs:prep+ms,preparationMs:prep,batter:actor});
}
// Regression first: v60 turns again after the physical catcher has the ball.
const regress=fixture(),old=frozen.create(),oldCaught=at(old,regress,640.375),oldLater=at(old,regress,1500),
 current=factory.create(),caught=at(current,regress,640.375),later=at(current,regress,1500);
assert(angular(oldCaught,oldLater)>.001,'frozen v60 reproduces late held-ball turn');
assert.equal(later.yaw,caught.yaw,'a caught take no longer turns yaw after the catcher has the ball');
assert.equal(later.pitch,caught.pitch,'a caught take no longer turns pitch after the catcher has the ball');
results.push({regression:'v60 late post-catch angular movement',oldRadians:angular(oldCaught,oldLater),newRadians:angular(caught,later)});

assert.deepEqual(plain(factory.defaults),plain(frozen.defaults),'no new settings or default tuning changes');
const traces=[];
for(const side of ['R','L'])for(const grade of [1,45,100]){
 const record=fixture({side}),actor=batter(side,grade),controller=factory.create(),before=sha(JSON.stringify(record));
 let last=null,maxStep=0;
 for(let ms=0;ms<=1500;ms++){
  const view=at(controller,record,ms,actor);
  if(last){const step=angular(last,view);maxStep=Math.max(maxStep,step);assert(step<=2.5*.001+1e-9,'1ms pose remains continuous');}
  if(ms>=641){assert.equal(view.phase,'take-caught');assert.equal(view.yaw,caughtFor(controller,record,actor).yaw);
   assert.equal(view.pitch,caughtFor(controller,record,actor).pitch);}
  last=view;
 }
 const beforeCatch=at(controller,record,640.374,actor),atCatch=at(controller,record,640.375,actor),
  afterCatch=at(controller,record,640.376,actor);
 assert(angular(beforeCatch,atCatch)<=2.5*.000001+1e-8,'fractional capture onset does not snap');
 assert.equal(afterCatch.yaw,atCatch.yaw);assert.equal(afterCatch.pitch,atCatch.pitch);
 const view=at(controller,record,350,actor),tracking=view.tuning.pitchTracking,
  expectedGain=grade===1?.13:grade===45?.26:.70,expectedBand=grade===1?.04:grade===45?.02:0;
 assert.equal(tracking.absolutePlateVision,grade);assert.equal(tracking.baselinePlateVision,45);
 assert.equal(tracking.gain,expectedGain);assert.equal(tracking.deadbandRadians,expectedBand);
 assert.equal(view.model.pitchTracking.gain,expectedGain);assert.equal(view.model.absolutePlateVision,grade);
 assert.equal(view.regulation.measurementBasis,'CURRENT_OBSERVED_PITCH_PREFIX');
 assert.equal(view.regulation.measurementTick,origin+344000,'take target uses the latest available pitch sample, not the delayed sample');
 assert.equal(sha(JSON.stringify(record)),before,'read-only Source and bat');
 traces.push({side,grade,gain:tracking.gain,deadband:tracking.deadbandRadians,maxStepRadians:maxStep,
  latestPitchTick:view.regulation.measurementTick,capturePitch:atCatch.pitch});
}
function caughtFor(controller,record,actor){return at(controller,record,640.375,actor);}
results.push({curves:traces});

const record=fixture(),control=factory.create();
for(let grade=1;grade<=100;grade++){
 const view=at(control,record,350,batter('R',grade)),tracking=view.tuning.pitchTracking;
 assert(tracking.gain>=.13&&tracking.gain<=.70);assert(tracking.deadbandRadians>=0&&tracking.deadbandRadians<=.04);
 if(grade>1){const previous=at(control,record,350,batter('R',grade-1)).tuning.pitchTracking;
  assert(tracking.gain>=previous.gain);assert(tracking.deadbandRadians<=previous.deadbandRadians);}
}
for(const [physical,controls,expected]of [
 [{plateVision:75},{plateVision:10},75],[{}, {plateVision:80},80],
 [{plateVision:1000},{plateVision:10},100],[{plateVision:-5},{plateVision:80},1],
 [{zoneJudgmentStdMeters:.025},{},45],[{zoneJudgmentStdMeters:0},{},100],
 [{zoneJudgmentStdMeters:.025*Math.exp(-.55)},{},100],[{}, {},45],
 [{plateVision:NaN},{plateVision:60},60]]){
 const actor={...batter(),physical},sample=fixture();sample.play.diagnostics.individualControls=controls;
 assert(Math.abs(at(factory.create(),sample,350,actor).model.absolutePlateVision-expected)<1e-10);
}
const neutral=at(factory.create(),record,350,batter()),strong=at(factory.create(),record,350,batter('R',100)),
 weak=at(factory.create(),record,350,batter('R',1));
assert(angular(strong,neutral)>1e-4&&angular(neutral,weak)>1e-4,'vision changes actual camera, not just UI diagnostics');
assert.equal(strong.model.pitchTrackingGain,neutral.model.pitchTrackingGain,'inherited meet pursuit does not apply a second variable vision gain');
const fasterBatter=batter('R',100);fasterBatter.physical.aimStdMeters=.005;
assert.notEqual(at(factory.create(),record,350,fasterBatter).model.pitchTrackingGain,strong.model.pitchTrackingGain,'existing meet still affects finite pursuit');
const custom=factory.create({pitchTrackingGain:.5,pitchTrackingDeadbandRadians:.05});
assert.equal(at(custom,record,350,batter('R',45)).tuning.pitchTracking.gain,.5);
assert.equal(at(custom,record,350,batter('R',100)).tuning.pitchTracking.gain,.70);
assert.equal(at(factory.create({pitchTrackingGain:1}),record,350,batter()).tuning.pitchTracking.gain,.70,'normal observer remains capped');
results.push('absolute 1/45/100 piecewise mapping, explicit/diagnostic/SI fallback precedence, monotonic grades, real pose differences, meet-only inherited pursuit');

// Keep A legacy exact in its pose/regulation motor outputs; only diagnostics grow.
for(const options of [{},{swing:true},{bunt:true},{field:true}])for(const side of ['R','L']){
 const sample=fixture({side,...options}),actor=batter(side),one=factory.create({enabled:false}),two=frozen.create({enabled:false});
 for(const ms of [0,96,240,350,640.374,640.375,800,1500]){
  const now=at(one,sample,ms,actor),then=at(two,sample,ms,actor);
  for(const key of ['eye','yaw','pitch','phase','aimWeight','surprise','trackingErrorRadians'])assert.deepEqual(plain(now[key]),plain(then[key]),'A legacy '+key);
 }
}
// B swing/field motor at the reference ability must remain exact.
for(const options of [{swing:true},{bunt:true},{field:true}])for(const side of ['R','L']){
 const sample=fixture({side,...options}),actor=batter(side),one=factory.create(),two=frozen.create();
 for(const ms of [0,96,240,350,520.375,640.375,800,1100,1500]){
  const now=at(one,sample,ms,actor),then=at(two,sample,ms,actor);
  for(const key of ['eye','yaw','pitch','phase','aimWeight','surprise','trackingErrorRadians'])assert.deepEqual(plain(now[key]),plain(then[key]),'45-grade swing/bunt/field '+key);
 }
}
results.push('A legacy exact pose; B reference-45 swing, bunt and field pose exact');

for(const capMs of [120,350,600,640.374]){
 const poisoned=fixture(),clean=fixture();
 Object.defineProperty(poisoned.play,'contactMoment',{get(){throw Error('future collision');}});
 Object.defineProperty(poisoned.play.diagnostics,'secureTick',{get(){throw Error('future secure tick');}});
 for(const f of poisoned.frames)if(f.tick>origin+capMs*1000)for(const key of ['possessedBy','ball','actors','phase','homeRunConfirmed','ballKind'])
  Object.defineProperty(f,key,{get(){throw Error('unavailable frame '+key);}});
 const now=at(factory.create(),poisoned,1600,batter(),capMs),reference=at(factory.create(),clean,1600,batter(),capMs);
 assert.deepEqual(plain(now),plain(reference),'a future catch/frame is not read through the cap');
 assert.equal(now.tuning.takeCatchLock,null,'no observed capture means no capture lock');
}
const seek=factory.create();at(seek,record,1600);
for(const ms of [350,640.375,96,1600,600,1200])assert.deepEqual(plain(at(seek,record,ms)),plain(at(factory.create(),record,ms)),'seek/replay deterministic');
assert.deepEqual(plain(at(seek,record,1600,batter(),350)),plain(at(factory.create(),record,1600,batter(),350)),'late cache discarded on prefix rewind');
results.push('future possession/result/frame poison; observed-prefix capture only; deterministic seek/replay and capped rewind');

const sourceBytes=await readFile('dist/native-match-core-browser.js'),pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
assert.equal(sha(sourceBytes),pins.entrySha256);for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,path);
runInThisContext(sourceBytes.toString());const core=globalThis.KneekuraNativeMatchCore,roles=['P','C','1B','2B','3B','SS','LF','CF','RF'],
 teams=[0,1].map(t=>({id:'T'+t,name:'T'+t,battingOrder:roles.map((_,i)=>t+'B'+i),pitcherId:t+'P',defense:Object.fromEntries(roles.map((r,i)=>[r,i?t+'B'+(i-1):t+'P']))})),
 players=[0,1].flatMap(t=>[...roles.map((_,i)=>({playerId:t+'B'+i,name:'B'+i,heightMeters:1.8,bats:i%2?'R':'L'})),{playerId:t+'P',name:'P',heightMeters:1.8,bats:'R'}]),
 measuredBytes=await readFile('docs/demos/measured-bat-motions.json'),host=core.createLiveBaseballMatchV1({seed:1234,teams,players,measuredClips:JSON.parse(measuredBytes).clips}),hashes=[];
let takes=0,swings=0,actualCaptureChecks=0;
for(let i=0;i<12;i++){
 const sample=host.issuePitch({batting:i%3===0?'take':'balanced',managedTeam:0,pitchType:i%3===0?'curve':'auto',location:'auto'}),before=sha(JSON.stringify(sample)),
  actualBatter=players.find(player=>player.playerId===sample.batterPlayerId),first=sample.frames[0].tick;
 if(sample.play.diagnostics.swingOffered)swings++;else takes++;
 for(const grade of [1,45,100]){
  const controller=factory.create(),actor={...actualBatter,physical:{...actualBatter.physical,plateVision:grade}};
  let captured=null;
  for(const frame of sample.frames.filter((_,index)=>index%5===0)){
   const view=controller.observe({record:sample,frame,sceneMs:prep+(frame.tick-first)/1000,preparationMs:prep,batter:actor});
   assert(Number.isFinite(view.yaw)&&Number.isFinite(view.pitch));
   if(view.tuning.takeCatchLock){if(captured){assert.equal(view.yaw,captured.yaw);assert.equal(view.pitch,captured.pitch);}else captured=view;}
  }
  const caughtFrame=sample.play.diagnostics.swingOffered===false?sample.frames.find(frame=>frame.ballKind==='pitch'&&(frame.possessedBy||frame.ball?.visible===false)):null;
  if(caughtFrame){
   const caughtMs=prep+(caughtFrame.tick-first)/1000,
    one=controller.observe({record:sample,frame:caughtFrame,sceneMs:caughtMs,preparationMs:prep,batter:actor}),
    two=controller.observe({record:sample,frame:caughtFrame,sceneMs:caughtMs+1000,preparationMs:prep,batter:actor});
   assert.equal(one.phase,'take-caught');assert.equal(one.tuning.takeCatchLock.caughtTick,caughtFrame.tick);
   assert.equal(two.yaw,one.yaw);assert.equal(two.pitch,one.pitch);actualCaptureChecks++;
  }
 }
 assert.equal(sha(JSON.stringify(sample)),before,'actual Source/bat preserved');hashes.push(before);
}
assert(takes>0&&swings>0&&actualCaptureChecks>=3);
console.log(JSON.stringify({pass:true,results,actualCore:{nativeSha256:sha(sourceBytes),sourceInputs:Object.keys(pins.inputs).length,
 pitches:hashes.length,takes,swings,actualCaptureChecks,recordsSha256:sha(JSON.stringify(hashes)),measuredBatSha256:sha(measuredBytes)},
 scope:'causal live-prefix take target, exact observed-catch angular stop, absolute plateVision camera mapping; no Source, measured bat or physics changes'}));
