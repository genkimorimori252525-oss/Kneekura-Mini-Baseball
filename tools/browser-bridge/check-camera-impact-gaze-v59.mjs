import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext,runInThisContext} from 'node:vm';

const load=async path=>{const context={};runInNewContext(await readFile(path,'utf8'),context);return context.KneekuraCameraTuningBatterView;};
const factory=await load(process.argv[2]??'tools/browser-bridge/live-camera-tuning-batter-view-v59.js'),
 legacy=await load('tools/browser-bridge/live-camera-tuning-batter-view-v56.js'),
 frozen=await load('tools/browser-bridge/live-camera-tuning-batter-view-v57.js'),
 plain=x=>JSON.parse(JSON.stringify(x)),sha=x=>createHash('sha256').update(x).digest('hex'),v=(x=0,y=0,z=0)=>({x,y,z}),
 origin=1e6,prep=1540,defaults={enabled:true,aimLiftMeters:.30,swingMaxDownRadians:.20,hitFollowDelayMs:300,
  aimReleaseMs:70,pitchTrackingGain:.26,pitchTrackingDeadbandRadians:.02},
 delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),angular=(a,b)=>Math.hypot(delta(a.yaw,b.yaw),a.pitch-b.pitch),
 withoutLock=view=>{const result=plain(view);delete result.tuning.swingHeadLock;delete result.model.impactStabilization;return result;},results=[];
assert.equal(factory.version,1);assert(Object.isFrozen(factory));assert(Object.isFrozen(factory.defaults));
assert.deepEqual(plain(factory.defaults),defaults);assert.deepEqual(plain(factory.normalizeSettings({})),defaults);
let getterCalled=false;const getter={};Object.defineProperty(getter,'enabled',{enumerable:true,get(){getterCalled=true;return true;}});
const invalid=[null,[],new Date(),{unknown:1},{enabled:1},{enabled:undefined},{aimLiftMeters:NaN},{aimLiftMeters:Infinity},
 {aimLiftMeters:-.01},{aimLiftMeters:.81},{swingMaxDownRadians:.09},{swingMaxDownRadians:1.26},{hitFollowDelayMs:-1},
 {hitFollowDelayMs:601},{hitFollowDelayMs:'300'},{aimReleaseMs:19},{aimReleaseMs:401},{pitchTrackingGain:-.01},
 {pitchTrackingGain:1.01},{pitchTrackingGain:undefined},{pitchTrackingDeadbandRadians:-.001},{pitchTrackingDeadbandRadians:.151},
 getter,{[Symbol('unknown')]:1},Object.defineProperty({},'enabled',{value:true,enumerable:false})],configured=factory.create();
for(const bad of invalid){assert.throws(()=>factory.normalizeSettings(bad));assert.throws(()=>configured.configure(bad));
 assert.deepEqual(plain(configured.inspectSettings()),defaults,'invalid settings remain atomic');}
assert.equal(getterCalled,false);configured.configure({aimLiftMeters:.4});configured.configure({pitchTrackingGain:.5});
assert.deepEqual(plain(configured.inspectSettings()),{...defaults,aimLiftMeters:.4,pitchTrackingGain:.5});assert(Object.isFrozen(configured.inspectSettings()));
results.push('approved seven settings; strict atomic validation; immutable partial configure');

const batter=side=>({playerId:'B',height:1.8,hand:side,physical:{aimStdMeters:.04,timingStdSeconds:.012,zoneJudgmentStdMeters:.025}});
function fixture({side='R',swing=true,bunt=false,hit=false,hitAt=.52,heldAt=1.4,start=.293125,impact=.520375,
 through=.890375,allField=false,rising=false,bodyMoves=true}={}){
 const sign=side==='R'?1:-1,frames=Array.from({length:301},(_,i)=>{const t=i*.008,field=allField||hit&&t>=hitAt,held=t>=heldAt;
  return {tick:origin+Math.round(t*1e6),phase:held?'held':field?'batted':'pitch',ballKind:field?'batted':'pitch',possessedBy:held?'C':null,
   ball:{position:field?v(12*(t-hitAt),1+9*(t-hitAt),.15+30*(t-hitAt)):v(sign*(.15+.3*t),rising?1.9+2*t:1.15-.7*t,18-35*t),
    velocity:field?v(12,9,30):v(sign*.3,rising?2:-.7,-35),visible:!held},
   bat:{grip:v(-sign*.8,1,t),tip:v(sign*.1,.9,.15)},actors:[{playerId:'B',role:bodyMoves&&t>=.58?'runner':'batter',
    position:v(-sign*.85,0,-.2+(bodyMoves?Math.max(0,t-.58)*3:0)),velocity:v(0,0,bodyMoves&&t>=.58?3:0)}]};});
 return {batterPlayerId:'B',pitcherPlayerId:'P',beforeMatch:{half:'top'},beforeFrame:frames[0],frames,
  command:{managedTeam:0,batting:bunt?'bunt':swing?'balanced':'take'},
  play:{contactMoment:hit?{ball:{tick:origin+Math.round(hitAt*1e6),velocity:v(12,9,30)}}:null,
   diagnostics:{sourceClockTicksPerSecond:1e6,predictionMadeAtElapsedSeconds:.14,swingOffered:swing,
    referenceStartTick:origin+Math.round(start*1e6),referenceContactTick:origin+Math.round(impact*1e6),referenceThroughTick:origin+Math.round(through*1e6),
    zoneJudgment:{observedForecastPosition:v(sign*.1,.55,.15)},aimErrorMeters:v(sign*.01,-.01,0)}}};
}
function at(controller,record,ms,side='R',capMs=ms){let frame=record.beforeFrame;
 for(const current of record.frames){if(current.tick>record.frames[0].tick+capMs*1000)break;frame=current;}
 return controller.observe({record,frame,sceneMs:prep+ms,preparationMs:prep,batter:batter(side)});
}
for(const side of ['R','L']){
 const record=fixture({side,rising:true}),snapshot=sha(JSON.stringify(record)),controller=factory.create(),d=record.play.diagnostics,
  forecast=d.zoneJudgment.observedForecastPosition,error=d.aimErrorMeters,
  aim={x:forecast.x+error.x,y:forecast.y+error.y+defaults.aimLiftMeters,z:forecast.z+error.z};
 const undecided=structuredClone(record);Object.defineProperty(undecided.play.diagnostics,'zoneJudgment',{get(){throw Error('prediction before own decision');}});
 at(factory.create(),undecided,139.999,side);
 const acquiring=at(controller,record,180,side);assert(acquiring.aimWeight>0&&acquiring.aimWeight<1,'own decision starts acquisition before delayed visual decision');
 assert.deepEqual(plain(acquiring.tuning.aimTarget),aim,'rising curve uses registered future hitting point plus error/lift');
 const aiming=at(controller,record,240,side);
 assert.equal(aiming.aimWeight,1,'85ms acquisition completes before the finite impact');
 assert.deepEqual(plain(aiming.tuning.aimTarget),aim);assert(aiming.regulation.targetPitch>0,'planned lower hitting point looks down while current pitch is high');
 assert(aiming.regulation.targetPitch<=defaults.swingMaxDownRadians+1e-12);
 assert(at(controller,record,480,side).pitch>at(frozen.create(defaults),record,480,side).pitch+.01,'planned hitting point corrects the rising-ball gaze before impact');
 for(const ms of [293.125,350,480,520.374])assert(!at(controller,record,ms,side).tuning.swingHeadLock?.active,'early swing never arms impact stabilization');
 assert(angular(at(controller,record,350,side),at(controller,record,480,side))>1e-4,'head continues acquiring through the early swing');
 const impact=at(controller,record,520.375,side),lock=impact.tuning.swingHeadLock;
 assert(lock?.active);assert.equal(lock.startSeconds,.520375);assert.equal(lock.throughSeconds,.890375);
 assert.equal(lock.yaw,impact.yaw);assert.equal(lock.pitch,impact.pitch);
 let previous=impact,maxTravel=0;
 for(let ms=521;ms<=889;ms++){
  const view=at(controller,record,ms,side),dt=(ms-(ms===521?520.375:ms-1))/1000;
  assert(angular(view,previous)<=.18*dt+1e-9,'actual impact head speed remains within 0.18rad/s');
  assert(angular(view,impact)<=.025+1e-9,'actual impact head remains within the 0.025rad cone');
  assert.notEqual(view.regulation?.mode,'take-brake');maxTravel=Math.max(maxTravel,angular(view,impact));previous=view;
 }
 assert(maxTravel>1e-5,'body/aim movement creates small continuous motion instead of a rigid freeze');
 assert.notDeepEqual(plain(at(controller,record,880,side).eye),plain(impact.eye),'one embodied eye still translates with the actor');
 const stationary=fixture({side,rising:true,bodyMoves:false}),repeat=factory.create(),stationaryOne=plain(at(repeat,stationary,800,side));
 assert.deepEqual(plain(at(repeat,stationary,800,side)),stationaryOne,'repeated presentation time never injects jitter');
 assert.deepEqual(plain(at(factory.create(),stationary,800,side)),stationaryOne,'micro motion is deterministic without random phase');
 const resting=fixture({side,rising:true,bodyMoves:false,through:2.1}),restController=factory.create(),rest=at(restController,resting,1400,side);
 for(const ms of [1600,1800])assert(angular(at(restController,resting,ms,side),rest)<1e-5,'a constant body/aim converges without persistent periodic jitter');
 for(const boundary of [293.125,520.375,890.375,960.375]){
  const one=at(controller,record,boundary-.001,side),two=at(controller,record,boundary+.001,side);
  assert(angular(one,two)<=2.5*.000002+1e-8,'motor onset, impact and release remain position continuous');
 }
 for(const ms of [2000,520.375,700,96,960.375,350])assert.deepEqual(plain(at(controller,record,ms,side)),plain(at(factory.create(),record,ms,side)),'seek/rewind equals a fresh observation');
 const lifted=at(factory.create({...defaults,aimLiftMeters:.7,swingMaxDownRadians:1.25}),record,480,side),
  unlifted=at(factory.create({...defaults,aimLiftMeters:0,swingMaxDownRadians:1.25}),record,480,side);
 assert(lifted.pitch<unlifted.pitch-.01,'aim lift changes actual preimpact gaze');
 const limited=at(factory.create({...defaults,aimLiftMeters:0,swingMaxDownRadians:.1}),record,480,side),
  unlimited=at(factory.create({...defaults,aimLiftMeters:0,swingMaxDownRadians:1.25}),record,480,side);
 assert(limited.pitch<unlimited.pitch-.01,'downward bound changes actual preimpact gaze');
 for(const options of [{swing:false},{swing:true,bunt:true},{swing:false,allField:true}]){
  const exempt=fixture({side,...options});for(const ms of [96,240,400,700,1100,1800]){
   const view=at(factory.create(),exempt,ms,side);assert(!view.tuning.swingHeadLock?.active);
   assert.deepEqual(withoutLock(view),plain(at(legacy.create(defaults),exempt,ms,side)),'take/bunt/field retain v56 exact output');
  }
 }
 for(const settings of [{...defaults,enabled:false},{...defaults,enabled:false,aimLiftMeters:.7,aimReleaseMs:300,pitchTrackingGain:.9}]){
  const current=factory.create(settings),old=legacy.create(settings);
  for(const ms of [0,96,180,350,520.375,700,1100,1800])assert.deepEqual(withoutLock(at(current,record,ms,side)),plain(at(old,record,ms,side)),'disabled preserves v56 exactly');
 }
 const saved=plain(at(controller,record,700,side));controller.configure({aimLiftMeters:.7,swingMaxDownRadians:1.25});
 assert(angular(at(controller,record,700,side),saved)>.01,'configure changes actual gaze');controller.configure(defaults);
 assert.deepEqual(plain(at(controller,record,700,side)),saved,'configure A to B to A recomputes the same gaze');
 controller.configure({enabled:false});controller.configure({enabled:true});assert.deepEqual(plain(at(controller,record,700,side)),saved,'mode switch clears cached impact state');
 assert.equal(sha(JSON.stringify(record)),snapshot,'fixture Source and bat data are untouched');
 results.push(side+' rising curve forecast aim; immediate decision; no early freeze; exact impact; bounded natural motion; no jitter; controls; legacy; seek');
}

for(const [name,options,extend]of [
 ['known-hit',{hit:true,hitAt:.4,impact:.450375,through:.550375},true],
 ['late-hit',{hit:true,hitAt:.6,through:.650375},false],
 ['whiff',{hit:false,through:.650375},false]]){
 const record=fixture(options),controller=factory.create(),through=(record.play.diagnostics.referenceThroughTick-origin)/1e6,
  end=at(controller,record,through*1000),observed=end.tuning.hitObservedAtSeconds,
  release=extend?Math.max(through,observed+defaults.hitFollowDelayMs/1000):through;
 assert.equal(end.tuning.swingHeadLock.releaseAtSeconds??end.tuning.aimReleaseAtSeconds,release,name+' uses causal hit observation');
 const after=at(controller,record,(release+.02)*1000);assert(!after.tuning.swingHeadLock.active);assert(after.tuning.swingHeadLock.releasing);
 assert(at(controller,record,(release+.069999)*1000).tuning.swingHeadLock.releasing);
 assert(!at(controller,record,(release+.070001)*1000).tuning.swingHeadLock.releasing);
 const late=at(controller,record,1100);assert.equal(late.tuning.swingHeadLock.releaseAtSeconds,release,'a later hit cannot restart stabilization');assert(!late.tuning.swingHeadLock.active);
}
const prefix=fixture({hit:true}),poison=structuredClone(prefix);
Object.defineProperty(poison.play,'contactMoment',{get(){throw Error('future collision result');}});
for(const frame of poison.frames)if(frame.tick>origin+400000)for(const key of ['ball','actors','phase','homeRunConfirmed'])
 Object.defineProperty(frame,key,{get(){throw Error('unobserved future '+key);}});
const limited=at(factory.create(),poison,1000,'R',400);assert.equal(limited.tuning.hitObservedAtSeconds,null);
assert.deepEqual(plain(limited),plain(at(factory.create(),prefix,1000,'R',400)),'future payload and future collision result are never used');
const cache=factory.create();at(cache,prefix,2000);
assert.deepEqual(plain(at(cache,prefix,1000,'R',400)),plain(at(factory.create(),prefix,1000,'R',400)),'prefix rewind discards later observations');
assert.equal(at(factory.create(),prefix,400,'R',2000).tuning.hitObservedAtSeconds,null,'Source cap never advances presentation time');
results.push('known/late hit and whiff; exact 70ms release; no relock; future payload/collision poison; capped rewind');

const sourceBytes=await readFile('dist/native-match-core-browser.js'),pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
assert.equal(sha(sourceBytes),pins.entrySha256);for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,path);
runInThisContext(sourceBytes.toString());const core=globalThis.KneekuraNativeMatchCore,roles=['P','C','1B','2B','3B','SS','LF','CF','RF'],
 teams=[0,1].map(t=>({id:'T'+t,name:'T'+t,battingOrder:roles.map((_,i)=>t+'B'+i),pitcherId:t+'P',defense:Object.fromEntries(roles.map((r,i)=>[r,i?t+'B'+(i-1):t+'P']))})),
 players=[0,1].flatMap(t=>[...roles.map((_,i)=>({playerId:t+'B'+i,name:'B'+i,heightMeters:1.8,bats:i%2?'R':'L'})),{playerId:t+'P',name:'P',heightMeters:1.8,bats:'R'}]),
 measuredBytes=await readFile('docs/demos/measured-bat-motions.json'),host=core.createLiveBaseballMatchV1({seed:1234,teams,players,measuredClips:JSON.parse(measuredBytes).clips}),hashes=[];
let contactCount=0,swingCount=0;
for(let i=0;i<12;i++){
 const record=host.issuePitch({batting:'balanced',managedTeam:0,pitchType:'auto',location:'auto'}),before=sha(JSON.stringify(record)),
  actualBatter=players.find(player=>player.playerId===record.batterPlayerId),d=record.play.diagnostics,first=record.frames[0].tick;
 if(record.play.contactMoment)contactCount++;if(d.swingOffered)swingCount++;
 for(const settings of [defaults,{...defaults,enabled:false},{...defaults,aimLiftMeters:.7},{...defaults,pitchTrackingGain:.9,hitFollowDelayMs:0}]){
  const controller=factory.create(settings);let last=null;
  for(const frame of record.frames.filter((_,index)=>index%5===0)){
   const view=controller.observe({record,frame,sceneMs:prep+(frame.tick-first)/1000,preparationMs:prep,batter:actualBatter}),lock=view.tuning.swingHeadLock;
   if(lock?.active){assert(angular(view,lock)<=.025+1e-9,'actual Core head stays within its impact cone');
    if(last)assert(angular(view,last.view)<=.18*(frame.tick-last.tick)/d.sourceClockTicksPerSecond+1e-9,'actual Core stabilization speed is bounded');
    last={view,tick:frame.tick};}
  }
  assert.equal(sha(JSON.stringify(record)),before,'actual Core Source, event, clock and bat data stay unchanged');
 }
 hashes.push(before);
}
assert(contactCount>0);assert(swingCount>0);assert.equal(sha(await readFile('docs/demos/measured-bat-motions.json')),sha(measuredBytes));
console.log(JSON.stringify({pass:true,results,invalidCases:invalid.length,actualCore:{nativeSha256:sha(sourceBytes),sourceInputs:Object.keys(pins.inputs).length,
 pitches:hashes.length,contactCount,swingCount,recordsSha256:sha(JSON.stringify(hashes)),measuredBatSha256:sha(measuredBytes)},
 scope:'registered forecast aim before planned impact; bounded deterministic impact head motion; causal release; Source and measured bat unchanged'}));
