import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInThisContext} from 'node:vm';
const sha=x=>createHash('sha256').update(x).digest('hex'),plain=x=>JSON.parse(JSON.stringify(x)),
 bytes=await readFile('dist/native-match-core-browser.js'),pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8')),
 measured=await readFile('docs/demos/measured-bat-motions.json');
assert.equal(sha(bytes),'4a581b262a71530ef67503ba76e71849d52c394a2b7c113852a461b423486279');
assert.equal(sha(bytes),pins.entrySha256);
for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,path);
runInThisContext(bytes.toString());
runInThisContext(await readFile(process.argv[2]??'tools/browser-bridge/live-pitch-ball-cadence-v56.js','utf8'));
const api=globalThis.KneekuraPitchBallCadence,core=globalThis.KneekuraNativeMatchCore,roles=['P','C','1B','2B','3B','SS','LF','CF','RF'],
 teams=[0,1].map(t=>({id:'T'+t,name:'T'+t,battingOrder:roles.map((_,i)=>t+'B'+i),pitcherId:t+'P',
  defense:Object.fromEntries(roles.map((r,i)=>[r,i?t+'B'+(i-1):t+'P']))})),
 players=[0,1].flatMap(t=>[...roles.map((_,i)=>({playerId:t+'B'+i,name:'B'+i,heightMeters:1.8,bats:i%2?'R':'L'})),
  {playerId:t+'P',name:'P',heightMeters:1.8,bats:'R'}]),
 host=()=>core.createLiveBaseballMatchV1({seed:1234,teams,players,measuredClips:JSON.parse(measured).clips}),
 live=host(),reference=host(),command={batting:'balanced',managedTeam:0,pitchType:'auto',location:'auto'},hashes=[],batHashes=[];
assert.equal(api.version,1);assert(Object.isFrozen(api));assert.throws(()=>api.create({}));
let observerCount=0;
const sampler=api.create({createSourceBallMaterialHistoryV1(input){observerCount++;return core.createSourceBallMaterialHistoryV1(input);}});
assert(Object.isFrozen(sampler));assert(Object.isFrozen(sampler.inspect()));
assert.deepEqual(plain(sampler.inspect()),{version:1,ballKind:'pitch',source:'ORIGINAL_SOURCE_MATERIAL_HISTORY',readOnly:true,interpolated:false,reanchored:false});
const close=(a,b,tolerance,label)=>{for(const key of Object.keys(b))assert(Math.abs(a[key]-b[key])<=tolerance,`${label}.${key}: ${a[key]} != ${b[key]}`);},
 assertSample=(actual,expected,label)=>{assert(actual,label);close(actual.position,expected.moment.ball.position,1e-10,label+' SI position');
  close(actual.velocity,expected.moment.ball.velocity,1e-10,label+' SI velocity');close(actual.orientation,expected.orientation,1e-12,label+' material quaternion');
  assert.equal(actual.visible,true);assert.equal(actual.sourceObservation,true);assert.equal(actual.ballKind,'pitch');};
let contacts=0,catches=0,exactFrames=0,midFrames=0,blockedFrames=0,firstRecord;
for(let pitch=0;pitch<12;pitch++){
 const record=live.issuePitch(command),same=reference.issuePitch(command),before=sha(JSON.stringify(record)),
  batBefore=sha(JSON.stringify(record.frames.map(f=>f.bat))),d=record.play.diagnostics,descriptor=d.sourceDescriptor,tps=d.sourceClockTicksPerSecond,
  origin=record.frames[0].tick,cut=Math.min(descriptor.throughElapsedSeconds,record.play.contactMoment?.elapsedSeconds??Infinity,
   d.catcherContactElapsedSeconds??Infinity),
  original=core.createSourceBallMaterialHistoryV1({initialMaterialOrientation:record.frames[0].ball.orientation,
   spans:[{descriptor,throughElapsedSeconds:cut,side:'incoming'}]});
 firstRecord??=record;
 assert.equal(before,sha(JSON.stringify(same)),'same canonical pitch before observer');
 if(record.play.contactMoment)contacts++;else catches++;
 for(const invalid of [-1,-Number.EPSILON,NaN,Infinity,-Infinity,'0',null,undefined])assert.equal(sampler.sample(record,invalid),null,'invalid/preparation time');
 for(const invalid of [null,undefined,{},[],{frames:[]}])assert.equal(sampler.sample(invalid,0),null,'missing record');
 assertSample(sampler.sample(record,0),original.evaluateAt(0,'incoming'),'first release');
 for(let i=0;i<record.frames.length;i++){
  const frame=record.frames[i],seconds=(frame.tick-origin)/tps,at=plain(sampler.sample(record,seconds));
  if(frame.phase==='pitch'&&frame.ballKind==='pitch'&&frame.ball?.visible&&!frame.possessedBy&&seconds<cut){
   assertSample(at,original.evaluateAt(seconds,'incoming'),'record frame');
   close(at.position,frame.ball.position,1e-9,'record SI position');close(at.velocity,frame.ball.velocity,1e-9,'record SI velocity');
   close(at.orientation,frame.ball.orientation,1e-12,'record spin phase');exactFrames++;
  }else{assert.equal(at,null,'contact/batted/throw/held/hidden does not use free pitch');blockedFrames++;}
  const next=record.frames[i+1];
  if(next&&next.tick>frame.tick&&frame.phase==='pitch'&&frame.ball?.visible&&seconds<cut){
   const middle=Math.min((seconds+(next.tick-origin)/tps)/2,cut-1e-9);
   if(middle>seconds){assertSample(sampler.sample(record,middle),original.evaluateAt(middle,'incoming'),'between frames');midFrames++;}
  }
 }
 assert(sampler.sample(record,cut-1e-9),'last precontact sample');
 assert.equal(sampler.sample(record,cut),null,'exact original bat/glove contact stops free Source');
 assert.equal(sampler.sample(record,cut+1e-9),null,'after contact');
 assert.equal(sampler.sample(record,(record.frames.at(-1).tick-origin)/tps+1e-6),null,'after record end');
 const beforeCount=observerCount,saved=plain(sampler.sample(record,cut*.37));
 for(const seconds of [cut*.8,0,cut*.37,cut*.1,cut*.37]){
  assertSample(sampler.sample(record,seconds),original.evaluateAt(seconds,'incoming'),'deterministic seek/rewind');
 }
 assert.deepEqual(plain(sampler.sample(record,cut*.37)),saved);assert.equal(observerCount,beforeCount,'one cached Source observer per record');
 const mutable=sampler.sample(record,cut*.37);mutable.position.x=999;mutable.velocity.y=999;mutable.orientation.w=999;mutable.visible=false;
 assert.deepEqual(plain(sampler.sample(record,cut*.37)),saved,'caller output mutation cannot contaminate observation');
 assert.equal(sha(JSON.stringify(record)),before,'canonical record unchanged');assert.equal(sha(JSON.stringify(record.frames.map(f=>f.bat))),batBefore,'bat unchanged');
 hashes.push(before);batHashes.push(batBefore);
}
assert(contacts>0&&catches>0);assert(exactFrames>0&&midFrames>0&&blockedFrames>0);assert.equal(observerCount,12);
// A declared initial material phase is carried by the original observer.
const rotated=plain(firstRecord),q={w:Math.cos(.23),x:Math.sin(.23),y:0,z:0};rotated.frames[0].ball.orientation=q;
const rotatedObserver=core.createSourceBallMaterialHistoryV1({initialMaterialOrientation:q,
 spans:[{descriptor:rotated.play.diagnostics.sourceDescriptor,throughElapsedSeconds:rotated.play.diagnostics.sourceDescriptor.throughElapsedSeconds,side:'incoming'}]});
for(const seconds of [0,.019,.137])assertSample(sampler.sample(rotated,seconds),rotatedObserver.evaluateAt(seconds,'incoming'),'original declared material phase');
close(sampler.sample(rotated,0).orientation,q,1e-15,'first orientation retained');
// Forward payloads may be unavailable even though their clock metadata is known.
const guarded=plain(firstRecord),early=.04,earlyTick=guarded.frames[0].tick+early*guarded.play.diagnostics.sourceClockTicksPerSecond;
for(const frame of guarded.frames)if(frame.tick>earlyTick)for(const key of ['ball','phase','ballKind','possessedBy'])Object.defineProperty(frame,key,{get(){throw Error('future frame '+key);}});
for(const key of ['field','outgoingBallMoment','battedSource'])Object.defineProperty(guarded.play,key,{get(){throw Error('future outgoing '+key);}});
assert.deepEqual(plain(sampler.sample(guarded,early)),plain(sampler.sample(firstRecord,early)),'only original incoming Source and observed prefix are read');
// Same-tick contact successor and nonpitch payloads must be rejected before ball access.
for(const phase of ['batted','throw','held','bench','ready']){
 const r=plain(firstRecord),frame={tick:r.frames[0].tick,phase,ballKind:phase==='throw'?'throw':'batted'};
 Object.defineProperty(frame,'ball',{get(){throw Error('nonpitch ball read');}});r.frames=[r.frames[0],frame];
 assert.equal(sampler.sample(r,0),null,'latest same-tick successor '+phase);
}
for(const patch of [{visible:false},{possessedBy:'C'},{custody:'C'}]){
 const r=plain(firstRecord);Object.assign(r.frames[0].ball,patch);assert.equal(sampler.sample(r,0),null,'hidden/custody gate');
}
const secured=plain(firstRecord);secured.frames[0].possessedBy='C';assert.equal(sampler.sample(secured,0),null,'frame secure gate');
assert.equal(sha(await readFile('dist/native-match-core-browser.js')),sha(bytes));
assert.equal(sha(await readFile('docs/demos/measured-bat-motions.json')),sha(measured));
console.log(JSON.stringify({pass:true,scope:'original Source incoming pitched ball only; no renderer trajectory, Euler, lerp or extrapolation',
 nativeSha256:sha(bytes),sourceInputs:Object.keys(pins.inputs).length,pitches:hashes.length,contacts,catches,exactFrames,midFrames,blockedFrames,
 recordsSha256:sha(JSON.stringify(hashes)),batRecordsSha256:sha(JSON.stringify(batHashes)),measuredBatSha256:sha(measured),
 checks:['release/contact/secure/hidden/end boundaries','SI position/velocity/material spin','mid-frame Source observation','invalid/preparation time',
  'deterministic seek/rewind/cached observer','initial material orientation','output copies','prefix-only payload access','12 canonical records and bats unchanged']}));
