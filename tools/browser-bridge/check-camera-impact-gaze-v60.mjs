import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext,runInThisContext} from 'node:vm';

const load=async path=>{const context={};runInNewContext(await readFile(path,'utf8'),context);return context.KneekuraCameraTuningBatterView;};
const factory=await load(process.argv[2]??'tools/browser-bridge/live-camera-tuning-batter-view-v60.js'),
 frozen=await load('tools/browser-bridge/live-camera-tuning-batter-view-v59.js'),
 plain=x=>JSON.parse(JSON.stringify(x)),sha=x=>createHash('sha256').update(x).digest('hex'),v=(x=0,y=0,z=0)=>({x,y,z}),
 origin=1e6,prep=1540,oldDefaults=plain(frozen.defaults),
 defaults={...oldDefaults,impactStabilizeOffsetMs:0,impactMaxMotionRadians:.025,impactMaxSpeedRadPerSecond:.18},
 delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),angular=(a,b)=>Math.hypot(delta(a.yaw,b.yaw),a.pitch-b.pitch),
 compatible=view=>{const result=plain(view);for(const key of ['impactStabilizeOffsetMs','impactMaxMotionRadians','impactMaxSpeedRadPerSecond'])delete result.tuning.settings[key];
  if(result.model.impactStabilization)delete result.model.impactStabilization.offsetMs;
  if(result.tuning.swingHeadLock)for(const key of ['expectedImpactSeconds','requestedStartSeconds'])delete result.tuning.swingHeadLock[key];return result;},results=[];
assert.equal(factory.version,1);assert(Object.isFrozen(factory));assert(Object.isFrozen(factory.defaults));
assert.deepEqual(plain(factory.defaults),defaults);assert.deepEqual(plain(factory.normalizeSettings({})),defaults);
assert.deepEqual(plain(factory.normalizeSettings(oldDefaults)),defaults,'seven-key saved JSON receives only the three new defaults');
let getterCalled=false;const getter={};Object.defineProperty(getter,'impactMaxMotionRadians',{enumerable:true,get(){getterCalled=true;return .1;}});
const invalid=[null,[],new Date(),{unknown:1},{enabled:1},{enabled:undefined},{impactStabilizeOffsetMs:NaN},
 {impactStabilizeOffsetMs:Infinity},{impactStabilizeOffsetMs:-250.001},{impactStabilizeOffsetMs:150.001},
 {impactStabilizeOffsetMs:'0'},{impactMaxMotionRadians:-.001},{impactMaxMotionRadians:.150001},
 {impactMaxMotionRadians:undefined},{impactMaxSpeedRadPerSecond:-.001},{impactMaxSpeedRadPerSecond:1.50001},
 {impactMaxSpeedRadPerSecond:NaN},{impactMaxMotionRadians:.1,impactMaxSpeedRadPerSecond:2},getter,
 {[Symbol('unknown')]:1},Object.defineProperty({},'impactStabilizeOffsetMs',{value:0,enumerable:false})],configured=factory.create();
for(const bad of invalid){assert.throws(()=>factory.normalizeSettings(bad));assert.throws(()=>configured.configure(bad));
 assert.deepEqual(plain(configured.inspectSettings()),defaults,'invalid patch is atomic');}
assert.equal(getterCalled,false);
for(const settings of [{impactStabilizeOffsetMs:-250,impactMaxMotionRadians:0,impactMaxSpeedRadPerSecond:0},
 {impactStabilizeOffsetMs:150,impactMaxMotionRadians:.15,impactMaxSpeedRadPerSecond:1.5}])
 assert.deepEqual(plain(factory.normalizeSettings(settings)),{...defaults,...settings},'inclusive slider endpoints');
configured.configure({impactStabilizeOffsetMs:-100});configured.configure({impactMaxMotionRadians:.05});
assert.deepEqual(plain(configured.inspectSettings()),{...defaults,impactStabilizeOffsetMs:-100,impactMaxMotionRadians:.05});
assert(Object.isFrozen(configured.inspectSettings()));
results.push('ten immutable settings; strict atomic validation; inclusive bounds; old seven-key JSON defaults');

const batter=side=>({playerId:'B',height:1.8,hand:side,physical:{aimStdMeters:.04,timingStdSeconds:.012,zoneJudgmentStdMeters:.025}});
function fixture({side='R',swing=true,bunt=false,hit=false,hitAt=.52,heldAt=1.4,decision=.14,start=.293125,
 impact=.520375,through=.890375,allField=false,bodyMoves=true}={}){
 const sign=side==='R'?1:-1,frames=Array.from({length:301},(_,i)=>{const t=i*.008,field=allField||hit&&t>=hitAt,held=t>=heldAt;
  return {tick:origin+Math.round(t*1e6),phase:held?'held':field?'batted':'pitch',ballKind:field?'batted':'pitch',possessedBy:held?'C':null,
   ball:{position:field?v(12*(t-hitAt),1+9*(t-hitAt),.15+30*(t-hitAt)):v(sign*(.15+.3*t),1.9+2*t-3*t*t,18-35*t),
    velocity:field?v(12,9,30):v(sign*.3,2-6*t,-35),visible:!held},
   bat:{grip:v(-sign*.8,1,t),tip:v(sign*.1,.9,.15)},actors:[{playerId:'B',role:bodyMoves&&t>=.58?'runner':'batter',
    position:v(-sign*.85,0,-.2+(bodyMoves?Math.max(0,t-.58)*3:0)),velocity:v(0,0,bodyMoves&&t>=.58?3:0)}]};});
 return {batterPlayerId:'B',pitcherPlayerId:'P',beforeMatch:{half:'top'},beforeFrame:frames[0],frames,
  command:{managedTeam:0,batting:bunt?'bunt':swing?'balanced':'take'},play:{contactMoment:hit?{ball:{tick:origin+Math.round(hitAt*1e6),velocity:v(12,9,30)}}:null,
   diagnostics:{sourceClockTicksPerSecond:1e6,predictionMadeAtElapsedSeconds:decision,swingOffered:swing,
    referenceStartTick:origin+Math.round(start*1e6),referenceContactTick:origin+Math.round(impact*1e6),referenceThroughTick:origin+Math.round(through*1e6),
    zoneJudgment:{observedForecastPosition:v(sign*.1,.55,.15)},aimErrorMeters:v(sign*.01,-.01,0)}}};
}
function at(controller,record,ms,side='R',capMs=ms){let frame=record.beforeFrame;
 for(const current of record.frames){if(current.tick>record.frames[0].tick+capMs*1000)break;frame=current;}
 return controller.observe({record,frame,sceneMs:prep+ms,preparationMs:prep,batter:batter(side)});
}
const cases=[],releaseSteps=[];
for(const side of ['R','L'])for(const [intent,options]of [
 ['early',{decision:.14,start:.293125,impact:.520375,through:.890375}],
 ['late',{decision:.430125,start:.535125,impact:.740875,through:1.110875}]]){
 const record=fixture({side,...options}),before=sha(JSON.stringify(record));cases.push({side,intent,record});
 for(const offset of [-250,-100,0,75,150]){
  const settings={...defaults,impactStabilizeOffsetMs:offset},controller=factory.create(settings),
   requested=options.impact+offset/1000,expected=Math.max(options.decision,Math.min(options.through,requested));
  const beforeStart=at(controller,record,expected*1000-.001,side),onset=at(controller,record,expected*1000,side),lock=onset.tuning.swingHeadLock;
  assert(!beforeStart.tuning.swingHeadLock?.active,intent+' '+offset+' no early activation');
  assert(lock?.active,intent+' '+offset+' exact configured start activates');
  assert.equal(lock.startSeconds,expected);assert.equal(lock.expectedImpactSeconds,options.impact);assert.equal(lock.requestedStartSeconds,requested);
  assert.equal(lock.motorStartSeconds,options.start);assert.equal(lock.throughSeconds,options.through);
  assert.equal(onset.model.impactStabilization.offsetMs,offset);assert.equal(onset.model.impactStabilization.angleConeRadians,.025);
  assert.equal(onset.model.impactStabilization.speedLimitRadPerSecond,.18);
  assert.equal(onset.yaw,lock.yaw);assert.equal(onset.pitch,lock.pitch);
  assert(angular(beforeStart,onset)<=2.5*.000001+1e-8,'fractional configured onset is position continuous');
  const decision=options.decision*1000,acquired=at(factory.create(settings),record,decision+85.01,side),d=record.play.diagnostics;
  assert.deepEqual(plain(acquired.tuning.aimTarget),{x:d.zoneJudgment.observedForecastPosition.x+d.aimErrorMeters.x,
   y:d.zoneJudgment.observedForecastPosition.y+d.aimErrorMeters.y+.30,z:.15},'each curve intent keeps the registered future contact objective');
  assert.equal(acquired.aimWeight,1,'own intent acquisition remains 85ms or shorter');
  for(const boundary of [expected,options.through,options.through+.07]){
   const one=at(controller,record,boundary*1000-.001,side),two=at(controller,record,boundary*1000+.001,side);
   if(boundary===options.through+.07){
    // v59 already changes phase at this endpoint. Preserve its motor law,
    // while bounding the inherited step below 0.1 logical px (focal=400).
    const frozenStep=angular(at(frozen.create(),record,boundary*1000-.001,side),at(frozen.create(),record,boundary*1000+.001,side));
    releaseSteps.push({side,intent,offset,stepRadians:angular(one,two),frozenStepRadians:frozenStep});
    assert(angular(one,two)<.00025,'inherited release-end step stays below 0.1 logical pixel');
   }else assert(angular(one,two)<=2.5*.000002+1e-8,side+' '+intent+' '+offset+' boundary '+boundary+' onset/through remain position continuous');
  }
  for(const ms of [1800,expected*1000,options.impact*1000,96,options.through*1000+30,decision+40])
   assert.deepEqual(plain(at(controller,record,ms,side)),plain(at(factory.create(settings),record,ms,side)),'seek/rewind reproduces the same configured observation');
 }
 for(const [cone,speed]of [[.008,.04],[.10,.75],[0,.18],[.025,0],[0,0]]){
  const settings={...defaults,impactStabilizeOffsetMs:-100,impactMaxMotionRadians:cone,impactMaxSpeedRadPerSecond:speed},
   controller=factory.create(settings),start=options.impact-.1,onset=at(controller,record,start*1000,side);
  let prior=onset,priorMs=start*1000,maxMotion=0;
  for(let ms=Math.ceil(start*1000);ms<options.through*1000;ms++){
   const view=at(controller,record,ms,side),motion=angular(view,onset),dt=(ms-priorMs)/1000;
   assert(view.tuning.swingHeadLock?.active);assert(motion<=cone+1e-9,'actual pose cone follows the selected limit');
   assert(angular(view,prior)<=speed*dt+1e-9,'actual 1ms angular speed follows the selected limit');
   if(cone===0||speed===0){assert.equal(view.yaw,onset.yaw,'either zero limit freezes actual yaw');assert.equal(view.pitch,onset.pitch,'either zero limit freezes actual pitch');}
   maxMotion=Math.max(maxMotion,motion);prior=view;priorMs=ms;
  }
  if(cone>0&&speed>0)assert(maxMotion>1e-6,'nonzero controls retain body/aim corrections');
 }
 const nearThrough=options.through*1000-1,
  narrow=at(factory.create({impactMaxMotionRadians:.001,impactMaxSpeedRadPerSecond:1.5}),record,nearThrough,side),
  wide=at(factory.create({impactMaxMotionRadians:.15,impactMaxSpeedRadPerSecond:1.5}),record,nearThrough,side),
  slow=at(factory.create({impactMaxMotionRadians:.15,impactMaxSpeedRadPerSecond:.005}),record,nearThrough,side);
 assert(angular(narrow,wide)>1e-4,'nonzero motion-cone slider changes actual pose');
 assert(angular(slow,wide)>1e-4,'nonzero speed slider changes actual pose');
 // Defaults must retain the frozen v59 motor arithmetic, not only similar screenshots.
 const current=factory.create(),old=frozen.create();
 for(const ms of [0,96,options.decision*1000,options.decision*1000+85.01,options.start*1000,options.impact*1000-.001,
  options.impact*1000,options.impact*1000+.001,700,options.through*1000,options.through*1000+70,1800])
  assert.deepEqual(compatible(at(current,record,ms,side)),plain(at(old,record,ms,side)),'default output is v59 exact apart from new diagnostics/settings');
 const saved=plain(at(current,record,800,side));current.configure({impactMaxMotionRadians:0});at(current,record,800,side);current.configure(defaults);
 assert.deepEqual(plain(at(current,record,800,side)),saved,'configure clears impact pose cache and round trips');
 assert.equal(sha(JSON.stringify(record)),before,'all curve settings preserve Source and bat');
 results.push(side+' '+intent+' curve intent: offset start, exact onset/through, inherited release step below 0.1px, 1ms motion bounds, zero freeze, exact v59 defaults and seek');
}

const capped=fixture({decision:.14,impact:.520375,through:.600375}),cappedController=factory.create({impactStabilizeOffsetMs:150}),
 cappedView=at(cappedController,capped,600.375);
assert(cappedView.tuning.swingHeadLock?.active,'requested start after through still has a valid exact endpoint');
assert.equal(cappedView.tuning.swingHeadLock.startSeconds,.600375);assert.equal(cappedView.tuning.swingHeadLock.requestedStartSeconds,.520375+.15);
const decisionClamped=fixture({decision:.49}),decisionController=factory.create({impactStabilizeOffsetMs:-250});
assert(!at(decisionController,decisionClamped,489.999).tuning.swingHeadLock?.active);
assert.equal(at(decisionController,decisionClamped,490).tuning.swingHeadLock.startSeconds,.49,'stabilization cannot precede own decision');
const beforeDecision=fixture();Object.defineProperty(beforeDecision.play.diagnostics,'zoneJudgment',{get(){throw Error('prediction before own decision');}});
at(factory.create({impactStabilizeOffsetMs:-250}),beforeDecision,139.999);
const fallback=fixture({start:.10,impact:.200375,through:.570375});delete fallback.play.diagnostics.predictionMadeAtElapsedSeconds;
assert.equal(at(factory.create({impactStabilizeOffsetMs:-250}),fallback,140).tuning.swingHeadLock.startSeconds,.14,'missing decision retains the .14s lower bound');
for(const options of [{swing:false},{swing:true,bunt:true},{swing:false,allField:true}])for(const side of ['R','L']){
 const record=fixture({side,...options});
 for(const ms of [96,240,400,700,1100,1800]){
  const current=at(factory.create({impactStabilizeOffsetMs:-250,impactMaxMotionRadians:0}),record,ms,side),old=at(frozen.create(),record,ms,side);
  assert(!current.tuning.swingHeadLock?.active);const compared=compatible(current);compared.model.impactStabilization.angleConeRadians=.025;
  assert.deepEqual(compared,plain(old),'take/bunt/field unaffected apart from chosen control diagnostics');
 }
}
const prefix=fixture({hit:true}),poison=structuredClone(prefix);
Object.defineProperty(poison.play,'contactMoment',{get(){throw Error('future collision result');}});
for(const frame of poison.frames)if(frame.tick>origin+400000)for(const key of ['ball','actors','phase','homeRunConfirmed'])
 Object.defineProperty(frame,key,{get(){throw Error('unobserved future '+key);}});
for(const offset of [-250,150]){
 const settings={impactStabilizeOffsetMs:offset},limited=at(factory.create(settings),poison,1000,'R',400);
 assert.equal(limited.tuning.hitObservedAtSeconds,null);assert.deepEqual(plain(limited),plain(at(factory.create(settings),prefix,1000,'R',400)),'offset does not grant future frame/result access');
 const cache=factory.create(settings);at(cache,prefix,2000);
 assert.deepEqual(plain(at(cache,prefix,1000,'R',400)),plain(at(factory.create(settings),prefix,1000,'R',400)),'capped rewind discards later observations');
}
results.push('through and own-decision clamps; no early forecast read; old exempt behavior; future collision/frame poison and prefix rewind');

const sourceBytes=await readFile('dist/native-match-core-browser.js'),pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
assert.equal(sha(sourceBytes),pins.entrySha256);for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,path);
runInThisContext(sourceBytes.toString());const core=globalThis.KneekuraNativeMatchCore,roles=['P','C','1B','2B','3B','SS','LF','CF','RF'],
 teams=[0,1].map(t=>({id:'T'+t,name:'T'+t,battingOrder:roles.map((_,i)=>t+'B'+i),pitcherId:t+'P',defense:Object.fromEntries(roles.map((r,i)=>[r,i?t+'B'+(i-1):t+'P']))})),
 players=[0,1].flatMap(t=>[...roles.map((_,i)=>({playerId:t+'B'+i,name:'B'+i,heightMeters:1.8,bats:i%2?'R':'L'})),{playerId:t+'P',name:'P',heightMeters:1.8,bats:'R'}]),
 measuredBytes=await readFile('docs/demos/measured-bat-motions.json'),host=core.createLiveBaseballMatchV1({seed:1234,teams,players,measuredClips:JSON.parse(measuredBytes).clips}),hashes=[];
let contactCount=0,swingCount=0;
for(let i=0;i<12;i++){
 const record=host.issuePitch({batting:'balanced',managedTeam:0,pitchType:i<6?'auto':'curve',location:'auto'}),before=sha(JSON.stringify(record)),
  actualBatter=players.find(player=>player.playerId===record.batterPlayerId),d=record.play.diagnostics,first=record.frames[0].tick;
 if(record.play.contactMoment)contactCount++;if(d.swingOffered)swingCount++;
 const current=factory.create(),old=frozen.create();
 for(const frame of record.frames.filter((_,index)=>index%5===0)){
  const input={record,frame,sceneMs:prep+(frame.tick-first)/1000,preparationMs:prep,batter:actualBatter};
  assert.deepEqual(compatible(current.observe(input)),plain(old.observe(input)),'real Core default gaze is frozen v59 exact');
 }
 for(const settings of [{impactStabilizeOffsetMs:-250,impactMaxMotionRadians:.008,impactMaxSpeedRadPerSecond:.04},
  {impactStabilizeOffsetMs:150,impactMaxMotionRadians:.15,impactMaxSpeedRadPerSecond:1.5},{impactMaxSpeedRadPerSecond:0}]){
  const controller=factory.create(settings);let last=null;
  for(const frame of record.frames.filter((_,index)=>index%5===0)){
   const view=controller.observe({record,frame,sceneMs:prep+(frame.tick-first)/1000,preparationMs:prep,batter:actualBatter}),lock=view.tuning.swingHeadLock;
   if(lock?.active){assert(angular(view,lock)<=view.model.impactStabilization.angleConeRadians+1e-9,'actual Core pose cone');
    if(last)assert(angular(view,last.view)<=view.model.impactStabilization.speedLimitRadPerSecond*(frame.tick-last.tick)/d.sourceClockTicksPerSecond+1e-9,'actual Core angular speed');
    last={view,tick:frame.tick};}
  }
 }
 assert.equal(sha(JSON.stringify(record)),before,'new controls never mutate actual Source, event, clock or bat data');hashes.push(before);
}
assert(contactCount>0);assert(swingCount>0);assert.equal(sha(await readFile('docs/demos/measured-bat-motions.json')),sha(measuredBytes));
console.log(JSON.stringify({pass:true,results,invalidCases:invalid.length,curveIntents:cases.map(({side,intent})=>({side,intent})),releaseSteps,
 actualCore:{nativeSha256:sha(sourceBytes),sourceInputs:Object.keys(pins.inputs).length,pitches:hashes.length,contactCount,swingCount,
 recordsSha256:sha(JSON.stringify(hashes)),measuredBatSha256:sha(measuredBytes)},
 scope:'configurable expected-impact start and actual bounded motion; early/late registered curve intent; v59 exact defaults; Source and measured bat unchanged'}));
