import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext,runInThisContext} from 'node:vm';

const load=async path=>{const context={};runInNewContext(await readFile(path,'utf8'),context);return context.KneekuraCameraTuningBatterView;};
const factory=await load(process.argv[2]??'tools/browser-bridge/live-camera-tuning-batter-view-v57.js'),
 legacy=await load('tools/browser-bridge/live-camera-tuning-batter-view-v56.js'),
 plain=x=>JSON.parse(JSON.stringify(x)),sha=x=>createHash('sha256').update(x).digest('hex'),v=(x=0,y=0,z=0)=>({x,y,z}),
 origin=1e6,prep=1540,defaults={enabled:true,aimLiftMeters:.30,swingMaxDownRadians:.20,hitFollowDelayMs:300,
  aimReleaseMs:70,pitchTrackingGain:.26,pitchTrackingDeadbandRadians:.02},
 delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),angular=(a,b)=>Math.hypot(delta(a.yaw,b.yaw),a.pitch-b.pitch),
 withoutLock=view=>{const result=plain(view);delete result.tuning.swingHeadLock;return result;},results=[];
assert.equal(factory.version,1);assert(Object.isFrozen(factory));assert(Object.isFrozen(factory.defaults));
assert.deepEqual(plain(factory.defaults),defaults);assert.deepEqual(plain(factory.normalizeSettings({})),defaults);

const configured=factory.create();let getterCalled=false;
const getter={};Object.defineProperty(getter,'pitchTrackingGain',{enumerable:true,get(){getterCalled=true;return .5;}});
const symbolGetter={};Object.defineProperty(symbolGetter,Symbol.toStringTag,{get(){getterCalled=true;return 'Object';}});
const invalid=[null,[],new Date(),{unknown:1},{enabled:1},{enabled:undefined},{aimLiftMeters:NaN},{aimLiftMeters:Infinity},
 {aimLiftMeters:-.01},{aimLiftMeters:.81},{swingMaxDownRadians:.09},{swingMaxDownRadians:1.26},{hitFollowDelayMs:-1},
 {hitFollowDelayMs:601},{hitFollowDelayMs:'300'},{aimReleaseMs:19},{aimReleaseMs:401},{pitchTrackingGain:-.01},
 {pitchTrackingGain:1.01},{pitchTrackingGain:undefined},{pitchTrackingGain:NaN},{pitchTrackingGain:Infinity},
 {pitchTrackingDeadbandRadians:-.001},{pitchTrackingDeadbandRadians:.151},{pitchTrackingDeadbandRadians:NaN},
 getter,symbolGetter,{[Symbol('unknown')]:1},Object.defineProperty({},'enabled',{value:true,enumerable:false})];
for(const value of invalid){assert.throws(()=>factory.normalizeSettings(value));assert.throws(()=>configured.configure(value));
 assert.deepEqual(plain(configured.inspectSettings()),defaults,'invalid configure is atomic');}
assert.equal(getterCalled,false,'settings validation never executes getters');
configured.configure({pitchTrackingGain:.4});configured.configure({aimReleaseMs:90});
assert.deepEqual(plain(configured.inspectSettings()),{...defaults,pitchTrackingGain:.4,aimReleaseMs:90});
assert(Object.isFrozen(configured.inspectSettings()));
configured.configure(Object.assign(Object.create(null),{pitchTrackingGain:.26}));
results.push('seven approved defaults; strict settings; partial, atomic and immutable configure');

const batter=side=>({playerId:'B',height:1.8,hand:side,physical:{aimStdMeters:.04,timingStdSeconds:.012,zoneJudgmentStdMeters:.025}});
function fixture({side='R',swing=true,bunt=false,hit=false,hitAt=.5,heldAt=1.4,start=.333125,through=.890375,allField=false}={}){
 const frames=Array.from({length:301},(_,i)=>{const t=i*.008,field=allField||hit&&t>=hitAt,held=t>=heldAt;
  return {tick:origin+Math.round(t*1e6),phase:held?'held':field?'batted':'pitch',ballKind:field?'batted':'pitch',possessedBy:held?'C':null,
   ball:{position:field?v(12*(t-hitAt),1+9*(t-hitAt),.15+30*(t-hitAt)):v((side==='R'?1:-1)*(.15+.3*t),1.15-.7*t,18-35*t),
    velocity:field?v(12,9,30):v(side==='R'?.3:-.3,-.7,-35),visible:!held},
   bat:{grip:v(side==='R'?-.8:.8,1,t),tip:v(.1,.9,.15)},
   actors:[{playerId:'B',role:t>=.7?'runner':'batter',position:v(side==='R'?-.85:.85,0,-.2+Math.max(0,t-.7)*3),velocity:v(0,0,t>=.7?3:0)}]};});
 return {batterPlayerId:'B',pitcherPlayerId:'P',beforeMatch:{half:'top'},beforeFrame:frames[0],frames,
  command:{managedTeam:0,batting:bunt?'bunt':swing?'balanced':'take'},
  play:{contactMoment:hit?{ball:{tick:origin+Math.round(hitAt*1e6),velocity:v(12,9,30)}}:null,
   diagnostics:{sourceClockTicksPerSecond:1e6,predictionMadeAtElapsedSeconds:.14,swingOffered:swing,
    referenceStartTick:origin+Math.round(start*1e6),referenceContactTick:origin+520000,referenceThroughTick:origin+Math.round(through*1e6),
    zoneJudgment:{observedForecastPosition:v(.1,.55,.15)},aimErrorMeters:v(.01,-.01,0)}}};
}
function at(controller,record,ms,side='R',capMs=ms){let frame=record.beforeFrame;
 for(const current of record.frames){if(current.tick>record.frames[0].tick+capMs*1000)break;frame=current;}
 return controller.observe({record,frame,sceneMs:prep+ms,preparationMs:prep,batter:batter(side)});
}
const poseEqual=(a,b,message)=>{assert.equal(a.yaw,b.yaw,message+' yaw');assert.equal(a.pitch,b.pitch,message+' pitch');};
for(const side of ['R','L']){
 const record=fixture({side}),controller=factory.create(),snapshot=sha(JSON.stringify(record)),
  noIntention=structuredClone(record);noIntention.play.diagnostics.swingOffered=undefined;
 for(const ms of [96,200,280,320,333.124]){
  const actual=at(controller,record,ms,side),incoming=at(legacy.create(defaults),noIntention,ms,side);
  poseEqual(actual,incoming,side+' follows pitch without pre-aim before actual motor start');
  assert.equal(actual.aimWeight,0);assert.notEqual(actual.regulation?.mode,'take-brake');
 }
 const frozen=at(controller,record,333.125,side),expected=at(legacy.create(defaults),noIntention,333.125,side),lock=frozen.tuning.swingHeadLock;
 poseEqual(frozen,expected,side+' exact fractional onset captures incoming pose');
 assert(lock&&lock.active);assert.equal(lock.startSeconds,.333125);assert.equal(lock.throughSeconds,.890375);
 assert.equal(lock.yaw,frozen.yaw);assert.equal(lock.pitch,frozen.pitch);assert.equal(frozen.phase,'swing-head-hold');
 for(const ms of [333.1251,334,400,520,700,888,890.3749]){
  const view=at(controller,record,ms,side);poseEqual(view,frozen,side+' holds yaw/pitch through the finite swing');
  assert(view.tuning.swingHeadLock.active);assert.equal(view.phase,'swing-head-hold');
  assert.notEqual(view.regulation?.mode,'take-brake');
  assert.deepEqual(plain(view.eye),plain(at(legacy.create(defaults),record,ms,side).eye),'body eye law continues during head lock');
 }
 const movingEye=at(controller,record,888,side);assert.notDeepEqual(plain(movingEye.eye),plain(frozen.eye),'running/body translation remains live');
 const ending=at(controller,record,890.375,side);poseEqual(ending,frozen,'release begins at the frozen pose');
 assert.equal(ending.tuning.swingHeadLock.releaseAtSeconds,.890375);
 const released=at(controller,record,1100,side);assert(!released.tuning.swingHeadLock.active);
 assert(angular(released,frozen)>1e-6,'finite release returns to the existing observer');
 let prior=at(controller,record,0,side);
 for(let ms=8;ms<=1400;ms+=8){const next=at(controller,record,ms,side);
  assert(angular(next,prior)/.008<=2.5+1e-8,'hold and release retain the finite angular speed limit');prior=next;}
 for(const boundary of [333.125,890.375,960.375]){
  const a=at(controller,record,boundary-.001,side),b=at(controller,record,boundary+.001,side);
  assert(angular(a,b)<=2.5*.000002+1e-8,'fractional start/end/release pose is continuous');
 }
 for(const ms of [2000,333.125,888,96,960.375,400]){
  assert.deepEqual(plain(at(controller,record,ms,side)),plain(at(factory.create(),record,ms,side)),'seek and rewind equal a fresh observation');
 }
 const later=fixture({side,start:.413125}),late=at(factory.create(),later,700,side);
 assert(angular(late,frozen)>1e-5,'a later swing freezes a later pursued pose');
 poseEqual(late,at(factory.create(),later,413.125,side),'later timing has its own onset pose');
 const mitt=fixture({side,heldAt:.48}),mittController=factory.create(),mittStart=at(mittController,mitt,333.125,side);
 for(const ms of [550,700,888]){const view=at(mittController,mitt,ms,side);poseEqual(view,mittStart,'hidden mitt cannot move a swinging head');assert.equal(view.phase,'swing-head-hold');}
 for(const options of [{swing:false},{swing:true,bunt:true},{swing:false,allField:true}]){
  const exempt=fixture({side,...options});for(const ms of [200,400,700,1100,1800]){
   const view=at(factory.create(),exempt,ms,side);assert(!view.tuning.swingHeadLock?.active);
   assert.deepEqual(withoutLock(view),plain(at(legacy.create(defaults),exempt,ms,side)),'take/bunt/field preserve v56 with explicit settings');
  }
 }
 for(const enabledSettings of [defaults,{...defaults,aimLiftMeters:.7,swingMaxDownRadians:1.1,hitFollowDelayMs:0,aimReleaseMs:300,pitchTrackingGain:.9}]){
  const settings={...enabledSettings,enabled:false},newController=factory.create(settings),oldController=legacy.create(settings);
  for(const ms of [0,96,200,333.125,400,700,890.375,1100,1800])
   assert.deepEqual(withoutLock(at(newController,record,ms,side)),plain(at(oldController,record,ms,side)),'disabled retains v56 exact output under identical settings');
 }
 const saved=plain(at(controller,record,700,side));controller.configure({pitchTrackingGain:.9});
 assert(angular(at(controller,record,700,side),saved)>1e-5,'configure recomputes the actual frozen pose');
 controller.configure(defaults);assert.deepEqual(plain(at(controller,record,700,side)),saved,'configure A to B to A is deterministic');
 controller.configure({enabled:false});assert.deepEqual(withoutLock(at(controller,record,700,side)),plain(at(legacy.create({...defaults,enabled:false}),record,700,side)));
 controller.configure({enabled:true});assert.deepEqual(plain(at(controller,record,700,side)),saved,'mode switching clears the prior state');
 assert.equal(sha(JSON.stringify(record)),snapshot,'Source and measured bat fixtures are unchanged');
 results.push(side+' exact onset/hold/end; pitch pursuit; body eye; later swing; mitt; take/bunt/field; disabled; seek/configure');
}

// A known hit may extend the hold past finite swing end. A hit first seen
// after release has started cannot restart the hold or move its release time.
for(const [name,options,shouldExtend]of [
 ['known-hit',{hit:true,hitAt:.4,through:.550375},true],
 ['late-hit',{hit:true,hitAt:.6,through:.650375},false],
 ['whiff',{hit:false,through:.550375},false]]){
 const record=fixture(options),controller=factory.create(),frozen=at(controller,record,333.125),through=(record.play.diagnostics.referenceThroughTick-origin)/1e6;
 const atEnd=at(controller,record,through*1000),observed=atEnd.tuning.hitObservedAtSeconds;
 const expectedRelease=shouldExtend?Math.max(through,observed+defaults.hitFollowDelayMs/1000):through;
 assert(Number.isFinite(expectedRelease));assert.equal(atEnd.tuning.swingHeadLock.releaseAtSeconds??atEnd.tuning.aimReleaseAtSeconds,expectedRelease,name+' release obeys known prefix');
 if(shouldExtend){assert(observed!==null);assert(expectedRelease>through);poseEqual(at(controller,record,expectedRelease*1000-.001),frozen,'known hit extends the same held pose');}
 const after=at(controller,record,(expectedRelease+.02)*1000);assert(!after.tuning.swingHeadLock.active);assert(after.tuning.swingHeadLock.releasing);
 const late=at(controller,record,1100);assert.equal(late.tuning.swingHeadLock.releaseAtSeconds,expectedRelease,name+' release is latched once');
 assert(!late.tuning.swingHeadLock.active);assert(!late.tuning.swingHeadLock.releasing);
}
results.push('known-hit max(through, observed+300ms); whiff end; 70ms release; late observations cannot relock');

const prefix=fixture({hit:true}),poison=structuredClone(prefix);
Object.defineProperty(poison.play,'contactMoment',{get(){throw Error('future collision result');}});
for(const frame of poison.frames)if(frame.tick>origin+400000)for(const key of ['ball','actors','phase','homeRunConfirmed'])
 Object.defineProperty(frame,key,{get(){throw Error('unobserved future '+key);}});
const limited=at(factory.create(),poison,1000,'R',400);
assert.equal(limited.tuning.hitObservedAtSeconds,null,'future hit cannot extend a hold');
assert.deepEqual(plain(limited),plain(at(factory.create(),prefix,1000,'R',400)),'future payload is not accessed');
const cache=factory.create();at(cache,prefix,2000);
assert.deepEqual(plain(at(cache,prefix,1000,'R',400)),plain(at(factory.create(),prefix,1000,'R',400)),'cap rewind discards future observations');
assert.equal(at(factory.create(),prefix,400,'R',2000).tuning.hitObservedAtSeconds,null,'future cap does not override current elapsed time');
results.push('future payload poison; causal hit observation; Source cap and elapsed-time rewind');

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
 for(const settings of [defaults,{...defaults,enabled:false},{...defaults,pitchTrackingGain:0},{...defaults,pitchTrackingGain:.9,hitFollowDelayMs:0}]){
  const controller=factory.create(settings);let held=null;
  for(const frame of record.frames.filter((_,index)=>index%5===0)){
   const view=controller.observe({record,frame,sceneMs:prep+(frame.tick-first)/1000,preparationMs:prep,batter:actualBatter});
   if(view.tuning.swingHeadLock?.active){if(held)poseEqual(view,held,'actual Core swing has no angular drift');held=view;}
  }
  assert.equal(sha(JSON.stringify(record)),before,'actual Core Source, event, clock and measured bat data remain unchanged');
 }
 hashes.push(before);
}
assert(contactCount>0);assert(swingCount>0);assert.equal(sha(await readFile('docs/demos/measured-bat-motions.json')),sha(measuredBytes));
console.log(JSON.stringify({pass:true,results,invalidCases:invalid.length,actualCore:{nativeSha256:sha(sourceBytes),sourceInputs:Object.keys(pins.inputs).length,
 pitches:hashes.length,contactCount,swingCount,recordsSha256:sha(JSON.stringify(hashes)),measuredBatSha256:sha(measuredBytes)},
 scope:'read-only actual measured motor onset head hold; incoming pitch pursuit; causal finite release; physical Source and bat unchanged'}));
