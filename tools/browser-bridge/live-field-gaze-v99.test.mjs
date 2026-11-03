import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
const scope=vm.createContext({});vm.runInContext(readFileSync('tools/browser-bridge/live-field-camera.js','utf8'),scope);
try{vm.runInContext(readFileSync('tools/browser-bridge/live-field-gaze-v99.js','utf8'),scope);}catch(e){if(e.code!=='ENOENT')throw e;}
const frame=(tick,ball,held=false,phase='batted')=>({tick,phase,possessedBy:held?'A':null,ball:{position:ball},actors:[{playerId:'A',position:{x:tick/1e6,y:0,z:0}}]});
const frames=[frame(0,{x:0,y:5,z:10}),frame(100000,{x:0,y:3,z:2}),frame(200000,{x:.2,y:1.5,z:0},true,'held'),frame(500000,{x:.5,y:1,z:0},true,'bench')];
const bases={home:{x:0,y:0,z:0},first:{x:20,y:0,z:20},second:{x:0,y:0,z:40},third:{x:-20,y:0,z:20}};
const record={frames,beforeMatch:{outs:0,bases:{first:null,second:null,third:null}},play:{diagnostics:{sourceClockTicksPerSecond:1e6},field:{frames:frames.map(f=>({...f,elapsedSeconds:f.tick/1e6,fielders:f.actors})),facts:[{kind:'catch_secured',tick:200000,elapsedSeconds:.2,playerId:'A'}],diagnostics:{handPreparationProofs:[]}}}};
test('holds a safe fly-catch orientation through moving-body bench samples and deterministic seek',()=>{
 const observe=scope.KneekuraLiveFieldGazeV99?.observe;assert.equal(typeof observe,'function');
 const input={record,bases,eyeHeightMeters:1.65,defaultObserverPlayerId:'A'};
 const atCatch=observe({...input,frame:frames[2]}),bench=observe({...input,frame:frames[3]});
 assert.equal(bench.holding,true);assert.equal(bench.yaw,atCatch.yaw);assert.equal(bench.pitch,atCatch.pitch);
 assert.deepEqual(observe({...input,frame:frames[2]}),atCatch);
});
test('does not read future fact or frame payloads and turns toward a new issued throw at bounded speed',()=>{
 const observe=scope.KneekuraLiveFieldGazeV99?.observe;assert.equal(typeof observe,'function');
 const copy=structuredClone(record);copy.beforeMatch.bases.first='R';
 copy.play.field.diagnostics.handPreparationProofs=[{playerId:'A',from:.3,base:1,target:bases.first}];
 copy.frames.push({tick:1e9,get ball(){throw Error('future ball');}});copy.play.field.facts.push({tick:1e9,get kind(){throw Error('future fact');}});
 const a=observe({record:copy,bases,frame:copy.frames[2],eyeHeightMeters:1.65,defaultObserverPlayerId:'A'});
 const b=observe({record:copy,bases,frame:copy.frames[3],eyeHeightMeters:1.65,defaultObserverPlayerId:'A'});
 assert.equal(b.holding,false);assert(Math.abs(b.yaw-a.yaw)<=4.5*.3+1e-8);assert.notEqual(b.yaw,a.yaw);
});

test('keeps the current glove ball as target at capture before an issued throw reorientation',()=>{
 const copy=structuredClone(record);copy.beforeMatch.bases.first='R';
 copy.play.field.diagnostics.handPreparationProofs=[{playerId:'A',from:.2,base:1,target:bases.first}];
 const observed=scope.KneekuraLiveFieldCamera.observe({record:copy,bases,frame:copy.frames[2],defaultObserverPlayerId:'A'});
 assert.deepEqual(JSON.parse(JSON.stringify(observed.target)),copy.frames[2].ball.position);
 const gaze=scope.KneekuraLiveFieldGazeV99.observe;
 const a=gaze({record:copy,bases,frame:copy.frames[0],defaultObserverPlayerId:'A'}),b=gaze({record:copy,bases,frame:copy.frames[1],defaultObserverPlayerId:'A'});
 assert(Math.abs(b.pitch-a.pitch)<=3.2*.1+1e-8,'pre-catch head turns are also bounded');
});

test('brakes head rotation without resetting angular velocity abruptly at the target',()=>{
 const list=Array.from({length:31},(_,i)=>frame(i*55000,{x:10*Math.sin(i? .8:0),y:1.65,z:10*Math.cos(i? .8:0)}));
 for(const f of list)f.actors[0].position={x:0,y:0,z:0};
 const r={frames:list,beforeMatch:{outs:0,bases:{first:'R',second:null,third:null}},play:{diagnostics:{sourceClockTicksPerSecond:1e6},field:{facts:[],frames:list.map(f=>({...f,elapsedSeconds:f.tick/1e6,fielders:f.actors})),diagnostics:{}}}};
 let previous=null;
 for(const f of list){const gaze=scope.KneekuraLiveFieldGazeV99.observe({record:r,bases,frame:f,defaultObserverPlayerId:'A'});
  if(previous){const dt=(f.tick-previous.tick)/1e6;assert(Math.abs(gaze.yawVelocity-previous.yawVelocity)<=18*dt+1e-8,'bounded acceleration including arrival');}
  previous=gaze;
 }
 assert(Math.abs(previous.yaw-.8)<.01,'settles at the intended direction');
});

test('brakes continuously when a ground-ball capture has no issued throw target yet',()=>{
 const list=Array.from({length:18},(_,i)=>frame(i*55000,{x:10*Math.sin(i?.8:0),y:1.65,z:10*Math.cos(i?.8:0)},i>=5,i>=5?'held':'batted'));
 for(const f of list)f.actors[0].position={x:0,y:0,z:0};
 const r={frames:list,beforeMatch:{outs:0,bases:{first:'R',second:null,third:null}},play:{diagnostics:{sourceClockTicksPerSecond:1e6},field:{facts:[{kind:'ground_contact',tick:0,elapsedSeconds:0},{kind:'catch_secured',tick:275000,elapsedSeconds:.275,playerId:'A'}],frames:list.map(f=>({...f,elapsedSeconds:f.tick/1e6,fielders:f.actors})),diagnostics:{handPreparationProofs:[]}}}};
 let previous=null;
 for(const f of list){const gaze=scope.KneekuraLiveFieldGazeV99.observe({record:r,bases,frame:f,defaultObserverPlayerId:'A'});
  if(previous)assert(Math.abs(gaze.yawVelocity-previous.yawVelocity)<=18*.055+1e-8,'no target is a braking command, not an instantaneous velocity reset');
  previous=gaze;
 }
});

test('faces the issued destination by hand completion and at actual release, using only an issued plan',()=>{
 const copy=structuredClone(record);copy.beforeMatch.bases.first='R';
 copy.frames=[...frames.slice(0,3),frame(300000,{x:.3,y:1.5,z:0},true),frame(400000,{x:.4,y:1.5,z:0},true),frame(500000,{x:.5,y:1.5,z:0},true),frame(600000,{x:.5,y:1.5,z:0},false,'throw')];
 copy.play.field.frames=copy.frames.map(f=>({...f,elapsedSeconds:f.tick/1e6,fielders:f.actors}));
 copy.play.field.diagnostics.handPreparationProofs=[{playerId:'A',from:.3,through:.5,base:1,target:bases.first}];
 copy.play.field.facts.push({kind:'throw_release',tick:600000,elapsedSeconds:.6,playerId:'A',base:1,target:bases.first,position:{x:.5,y:1.5,z:0}});
 for(const f of copy.frames.filter(f=>f.tick>=500000)){
  const g=scope.KneekuraLiveFieldGazeV99.observe({record:copy,frame:f,bases,defaultObserverPlayerId:'A',fixedObserverPlayerId:'A'}),a=f.actors[0].position,eye={...a,y:a.y+1.65};
  assert(Math.abs(g.yaw-Math.atan2(bases.first.x-eye.x,bases.first.z-eye.z))<1e-9,'destination centred before releasing');
  assert(Math.abs(g.pitch+Math.atan2(bases.first.y-eye.y,Math.hypot(bases.first.x-eye.x,bases.first.z-eye.z)))<1e-9,'destination vertical angle');
 }
});

const angles=(f,p)=>{const a=f.actors.find(a=>a.playerId==='A').position;return {yaw:Math.atan2(p.x-a.x,p.z-a.z),pitch:-Math.atan2(p.y-a.y-1.65,Math.hypot(p.x-a.x,p.z-a.z))};};
const faces=(g,want)=>{assert(Math.abs(Math.atan2(Math.sin(g.yaw-want.yaw),Math.cos(g.yaw-want.yaw)))<1e-9);assert(Math.abs(g.pitch-want.pitch)<1e-9);};
const prepared=()=>{
 const r=structuredClone(record);r.beforeMatch.bases.first='R';r.frames=Array.from({length:11},(_,i)=>frame(i*100000,{x:i*.1,y:1.5,z:0},i>=2,'held'));
 r.play.field.frames=r.frames.map(f=>({...f,elapsedSeconds:f.tick/1e6,fielders:f.actors}));
 r.play.field.diagnostics.handPreparationProofs=[{playerId:'A',from:.3,through:.5,base:1,target:bases.first}];return r;
};
test('faces the release target on the first visible sample, including same-tick catch and release',()=>{
 const r=prepared(),f=r.frames[5];r.frames=[f];r.play.field.frames=[{...f,fielders:f.actors,elapsedSeconds:.5}];
 r.play.field.facts=[{kind:'catch_secured',tick:f.tick,elapsedSeconds:.5,playerId:'A'},{kind:'throw_release',tick:f.tick,elapsedSeconds:.5,playerId:'A',target:bases.third}];
 faces(scope.KneekuraLiveFieldGazeV99.observe({record:r,frame:f,bases,defaultObserverPlayerId:'A'}),angles(f,bases.third));
});
test('does not read an unissued preparation payload',()=>{
 const r=prepared();r.play.field.diagnostics.handPreparationProofs.push({from:10,get through(){throw Error('future deadline');},get target(){throw Error('future target');},get playerId(){throw Error('future actor');}});
 assert.doesNotThrow(()=>scope.KneekuraLiveFieldGazeV99.observe({record:r,frame:r.frames[4],bases,defaultObserverPlayerId:'A'}));
});
test('cancels stale preparation and ignores preparations from before a new catch',()=>{
 const r=prepared();r.play.field.diagnostics.throwDecisions=[{elapsedSeconds:.4,reason:'no_positive_margin'}];
 const g=scope.KneekuraLiveFieldGazeV99.observe({record:r,frame:r.frames[5],bases,defaultObserverPlayerId:'A'});assert.notEqual(g.facingThrowV102,true);assert.equal(g.throwPlanV102,undefined);
 const again=prepared();again.play.field.facts.push({kind:'catch_secured',tick:400000,elapsedSeconds:.4,playerId:'A'});
 const after=scope.KneekuraLiveFieldGazeV99.observe({record:again,frame:again.frames[5],bases,defaultObserverPlayerId:'A'});assert.equal(after.throwPlanV102,undefined);
});
test('replans a changed target and holds it through a delayed release without mutating the record',()=>{
 const r=prepared();r.play.field.diagnostics.handPreparationProofs.push({playerId:'A',from:.6,through:.8,base:3,target:bases.third});
 r.play.field.facts.push({kind:'throw_release',tick:900000,elapsedSeconds:.9,playerId:'A',target:bases.third});const original=JSON.stringify(r),input={record:r,bases,defaultObserverPlayerId:'A'};
 for(const i of [8,9])faces(scope.KneekuraLiveFieldGazeV99.observe({...input,frame:r.frames[i]}),angles(r.frames[i],bases.third));
 const a=scope.KneekuraLiveFieldGazeV99.observe({...input,frame:r.frames[4]});
 faces(scope.KneekuraLiveFieldGazeV99.observe({...input,frame:r.frames[5]}),angles(r.frames[5],bases.first));
 assert.deepEqual(scope.KneekuraLiveFieldGazeV99.observe({...input,frame:r.frames[4]}),a);assert.equal(JSON.stringify(r),original);
});
test('keeps another fixed observer independent and faces each relay thrower at release',()=>{
 const r=prepared();for(const f of r.frames)f.actors.push({playerId:'B',position:{x:20,y:0,z:20}});
 r.play.field.frames=r.frames.map(f=>({...f,elapsedSeconds:f.tick/1e6,fielders:f.actors}));
 r.play.field.facts.push({kind:'throw_release',tick:600000,elapsedSeconds:.6,playerId:'A',target:bases.first,receiverPlayerId:'B'},
  {kind:'catch_secured',tick:700000,elapsedSeconds:.7,playerId:'B'},{kind:'throw_release',tick:900000,elapsedSeconds:.9,playerId:'B',target:bases.second});
 r.play.field.diagnostics.handPreparationProofs.push({playerId:'B',from:.7,through:.85,base:2,target:bases.second});
 const foreign=scope.KneekuraLiveFieldGazeV99.observe({record:r,frame:r.frames[5],bases,defaultObserverPlayerId:'A',fixedObserverPlayerId:'B'});assert.notEqual(foreign.facingThrowV102,true);
 const g=scope.KneekuraLiveFieldGazeV99.observe({record:r,frame:r.frames[9],bases,defaultObserverPlayerId:'A'});assert.equal(g.observerPlayerId,'B');assert.equal(g.facingThrowV102,true);assert(Math.abs(g.yaw+Math.PI/4)<1e-9);
});
test('zero-duration authored preparation faces its destination immediately',()=>{
 const r=prepared();r.play.field.diagnostics.handPreparationProofs[0].through=.3;
 faces(scope.KneekuraLiveFieldGazeV99.observe({record:r,frame:r.frames[3],bases,defaultObserverPlayerId:'A'}),angles(r.frames[3],bases.first));
});
test('safe fly hold after cancellation clears obsolete throw-facing metadata',()=>{
 const r=prepared();r.beforeMatch.bases.first=null;r.play.field.diagnostics.throwDecisions=[{elapsedSeconds:.6,reason:'no_positive_margin'}];
 const g=scope.KneekuraLiveFieldGazeV99.observe({record:r,frame:r.frames[7],bases,defaultObserverPlayerId:'A'});
 assert.equal(g.holding,true);assert.equal(g.throwPlanV102,undefined);assert.equal(g.facingThrowV102,undefined);
});

const approachingFlyV104=({distance=10,radialVelocity=-6,held=false}={})=>{
 const list=Array.from({length:41},(_,i)=>{
  const t=i*.025,yaw=.15+.55*t,pitch=-.2-.65*t,r=distance+radialVelocity*t,
   yd=.55,pd=-.65,rd=radialVelocity,cp=Math.cos(pitch),sp=Math.sin(pitch),sy=Math.sin(yaw),cy=Math.cos(yaw),
   actor={playerId:'A',position:{x:.7*t,y:0,z:-.2*t},velocity:{x:.7,y:0,z:-.2}},
   ball={position:{x:actor.position.x+r*cp*sy,y:1.65-r*sp,z:actor.position.z+r*cp*cy},
    velocity:{x:.7+rd*cp*sy+r*(-sp*pd*sy+cp*cy*yd),y:-rd*sp-r*cp*pd,z:-.2+rd*cp*cy+r*(-sp*pd*cy-cp*sy*yd)}};
  return {tick:Math.round(t*1e6),phase:held?'held':'batted',possessedBy:held?'A':null,ball,actors:[actor]};
 });
 return {frames:list,beforeMatch:{outs:0,bases:{first:'R',second:null,third:null}},play:{diagnostics:{sourceClockTicksPerSecond:1e6},field:{frames:list.map(f=>({...f,elapsedSeconds:f.tick/1e6,fielders:f.actors})),facts:[],diagnostics:{}}}};
};
const withoutVelocitiesV104=r=>{
 const copy=structuredClone(r);for(const f of copy.frames){delete f.ball.velocity;delete f.actors[0].velocity;}return copy;
};
const observeFlyV104=(r,f)=>scope.KneekuraLiveFieldGazeV99.observe({record:r,frame:f,bases,defaultObserverPlayerId:'A',fixedObserverPlayerId:'A'});
test('follows the current angular motion of a nearby approaching free ball without the old damping delay',()=>{
 const r=approachingFlyV104(),legacy=withoutVelocitiesV104(r),f=r.frames.at(-1),want=angles(f,f.ball.position),before=observeFlyV104(legacy,legacy.frames.at(-1)),after=observeFlyV104(r,f),
  lag=g=>Math.hypot(g.yaw-want.yaw,g.pitch-want.pitch);
 assert(lag(after)<lag(before)*.4,'near approach tracks moving direction rather than repeatedly braking toward its old direction');
 let previous=null;
 for(const f of r.frames){const g=observeFlyV104(r,f);assert(Math.abs(g.yawVelocity)<=4.5+1e-9);assert(Math.abs(g.pitchVelocity)<=3.2+1e-9);
  if(previous){const dt=(g.tick-previous.tick)/1e6;assert(Math.abs(g.yawVelocity-previous.yawVelocity)<=18*dt+1e-9);assert(Math.abs(g.pitchVelocity-previous.pitchVelocity)<=18*dt+1e-9);}
  previous=g;
 }
});
test('leaves distant, departing and possessed-ball tracking unchanged',()=>{
 for(const options of [{distance:100},{distance:4,radialVelocity:6},{held:true}]){const r=approachingFlyV104(options),legacy=withoutVelocitiesV104(r);
  for(let i=0;i<r.frames.length;i++)assert.deepEqual(observeFlyV104(r,r.frames[i]),observeFlyV104(legacy,legacy.frames[i]));
 }
});
test('does not compensate an explicitly hidden ball or a ball with current custody metadata',()=>{
 for(const patch of [{visible:false},{possessedBy:'A'},{custody:{playerId:'A'}}]){
  const r=approachingFlyV104();for(const f of r.frames)Object.assign(f.ball,patch);const legacy=withoutVelocitiesV104(r);
  for(let i=0;i<r.frames.length;i++)assert.deepEqual(observeFlyV104(r,r.frames[i]),observeFlyV104(legacy,legacy.frames[i]));
 }
});
test('uses the observer velocity so common body and ball translation adds no angular motion',()=>{
 const r=approachingFlyV104();for(const f of r.frames){const a=f.actors[0],t=f.tick/1e6;
  f.ball.position={x:a.position.x+2,y:3,z:a.position.z+3};f.ball.velocity={...a.velocity};
  if(t>.5)f.ball.velocity={x:NaN,y:0,z:0};
 }
 const legacy=withoutVelocitiesV104(r);
 for(let i=0;i<r.frames.length;i++)assert.deepEqual(observeFlyV104(r,r.frames[i]),observeFlyV104(legacy,legacy.frames[i]));
});
test('keeps overhead approach finite and bounded when the horizontal direction passes through zero',()=>{
 const r=approachingFlyV104();for(const f of r.frames){const t=f.tick/1e6,a=f.actors[0];f.ball.position={x:a.position.x+.001*(.5-t),y:2.1,z:a.position.z+2*(.5-t)};f.ball.velocity={x:.699,y:-.3,z:-2.2};}
 let previous=null;
 for(const f of r.frames){const g=observeFlyV104(r,f);assert(['yaw','pitch','yawVelocity','pitchVelocity'].every(k=>Number.isFinite(g[k])));
  if(previous){const dt=(g.tick-previous.tick)/1e6;assert(Math.abs(g.yawVelocity-previous.yawVelocity)<=18*dt+1e-9);assert(Math.abs(g.pitchVelocity-previous.pitchVelocity)<=18*dt+1e-9);}
  previous=g;
 }
});
test('near approach remains prefix-causal, rewindable and independent of render sampling cadence',()=>{
 const r=approachingFlyV104(),prefix=structuredClone(r),end=20;
 prefix.frames=prefix.frames.slice(0,end+1);prefix.play.field.frames=prefix.play.field.frames.slice(0,end+1);
 r.frames.push({tick:2e6,get ball(){throw Error('future ball velocity');},get actors(){throw Error('future actor velocity');}});
 r.play.field.facts.push({tick:2e6,get kind(){throw Error('future catch');}});
 const only=observeFlyV104(prefix,prefix.frames.at(-1)),first=observeFlyV104(r,r.frames[end]);assert.deepEqual(first,only);
 const later=observeFlyV104(r,r.frames[35]);for(let i=0;i<=35;i++)observeFlyV104(r,r.frames[i]);
 assert.deepEqual(observeFlyV104(r,r.frames[35]),later);assert.deepEqual(observeFlyV104(r,r.frames[end]),first);
 const sparse=approachingFlyV104();assert.deepEqual(observeFlyV104(sparse,sparse.frames[35]),later);
});

test('uses the Source eye through crouching instead of adding a second height to the foot anchor',()=>{
 const r=approachingFlyV104(),f=r.frames[0],pose={eye:{x:.3,y:1.04,z:-.2},eyeVelocity:{x:.7,y:-.8,z:-.2}};
 f.actors[0].bodyPoseV105=pose;const before=JSON.stringify(r),g=observeFlyV104(r,f),p=f.ball.position;
 faces(g,{yaw:Math.atan2(p.x-pose.eye.x,p.z-pose.eye.z),pitch:-Math.atan2(p.y-pose.eye.y,Math.hypot(p.x-pose.eye.x,p.z-pose.eye.z))});
 assert.equal(JSON.stringify(r),before,'pose observation is read-only');
});

test('uses eye velocity while crouching so common eye and ball motion creates no angular compensation',()=>{
 const r=approachingFlyV104();for(const f of r.frames){const t=f.tick/1e6,a=f.actors[0],eye={x:a.position.x,y:1.65-.3*t,z:a.position.z},eyeVelocity={x:.7,y:-.3,z:-.2};
  a.bodyPoseV105={eye,eyeVelocity};a.velocity={x:8,y:5,z:9};f.ball.position={x:eye.x+2,y:eye.y+1,z:eye.z+3};f.ball.velocity={...eyeVelocity};
 }
 const without=structuredClone(r);for(const f of without.frames)delete f.ball.velocity;
 for(let i=0;i<r.frames.length;i++)assert.deepEqual(observeFlyV104(r,r.frames[i]),observeFlyV104(without,without.frames[i]));
});

test('faces an issued throw from the canonical eye and preserves deterministic rewind after a posture change',()=>{
 const r=prepared();for(const f of r.frames)f.actors[0].bodyPoseV105={eye:{x:.2,y:1.1+f.tick/1e6,z:.15},eyeVelocity:{x:0,y:1,z:0}};
 const f=r.frames[5],eye=f.actors[0].bodyPoseV105.eye,want={yaw:Math.atan2(bases.first.x-eye.x,bases.first.z-eye.z),pitch:-Math.atan2(bases.first.y-eye.y,Math.hypot(bases.first.x-eye.x,bases.first.z-eye.z))},
  observe=frame=>scope.KneekuraLiveFieldGazeV99.observe({record:r,frame,bases,defaultObserverPlayerId:'A'}),early=observe(r.frames[2]);
 faces(observe(f),want);observe(r.frames[9]);assert.deepEqual(observe(r.frames[2]),early);faces(observe(f),want);
});

test('falls back to the legacy eye when an old or malformed pose has no finite eye',()=>{
 for(const pose of [{},{eye:{x:0,y:NaN,z:0}}]){const r=approachingFlyV104(),copy=structuredClone(r);for(const f of copy.frames)f.actors[0].bodyPoseV105=pose;
  for(let i=0;i<r.frames.length;i++)assert.deepEqual(observeFlyV104(copy,copy.frames[i]),observeFlyV104(r,r.frames[i]));
 }
});
