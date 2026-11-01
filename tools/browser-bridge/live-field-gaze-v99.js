/* Read-only, prefix-causal head orientation. No ball, motor or rule command. */
(function(root){
 'use strict';
 const cache=new WeakMap(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 const defaults=Object.freeze({yawSpeed:4.5,pitchSpeed:3.2,acceleration:18});
 function settings(raw={}){const out={...defaults,...raw};for(const k of Object.keys(defaults))if(!Number.isFinite(out[k])||out[k]<.1||out[k]>60)throw Error('首振り設定は0.1〜60で指定してください');return out;}
 function move(angle,velocity,target,dt,speed,acceleration,angular,targetVelocity=0){
  if(!(dt>0))return {angle,velocity};
  // Bounded critically damped tracking, including arrival. Never teleport the
  // angle or discard a nonzero velocity when crossing the target. Substeps
  // are local camera arithmetic, not a second physics or render scheduler.
  const count=Math.max(1,Math.ceil(dt*120)),h=dt/count,omega=10;
  for(let i=0;i<count;i++){
   const d=angular?wrap(target-angle):target-angle,
    a=clamp(omega*omega*d-2*omega*(velocity-targetVelocity),-acceleration,acceleration),next=clamp(velocity+a*h,-speed,speed);
   angle+=(velocity+next)*h/2;velocity=next;
  }
  return {angle,velocity};
 }
 function nearBallAngularVelocity(sample,actor,eye,phase,tuning){
  const zero={yaw:0,pitch:0},ball=sample.ball,finite=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k])),
   observerVelocity=finite(actor.bodyPoseV105?.eyeVelocity)?actor.bodyPoseV105.eyeVelocity:actor.velocity;
  if(phase==='held'||sample.visible===false||ball?.visible===false||sample.possessedBy||ball?.possessedBy||ball?.custody||!finite(ball?.position)||!finite(ball?.velocity)||!finite(observerVelocity))return zero;
  const x=ball.position.x-eye.x,y=ball.position.y-eye.y,z=ball.position.z-eye.z,
   vx=ball.velocity.x-observerVelocity.x,vy=ball.velocity.y-observerVelocity.y,vz=ball.velocity.z-observerVelocity.z,
   horizontal2=x*x+z*z,distance2=horizontal2+y*y,distance=Math.sqrt(distance2);
  if(!(distance>0)||distance>=12)return zero;
  // Provisional camera-only blend: current relative motion removes damping lag
  // inside 12m, becoming full inside 4m. Departing/held balls retain V103 gaze.
  const smooth=v=>{const u=clamp(v,0,1);return u*u*(3-2*u);},closing=-(x*vx+y*vy+z*vz)/distance,
   blend=smooth((12-distance)/8)*smooth(closing/2),horizontal=Math.sqrt(horizontal2),
   // Yaw is undefined directly overhead. Fade its contribution and bound the
   // denominator; pitch also uses a finite horizontal derivative there.
   yaw=(z*vx-x*vz)/Math.max(horizontal2,.0625)*horizontal2/(horizontal2+.0625),
   pitch=(y*(x*vx+z*vz)/Math.max(horizontal,.05)-horizontal*vy)/Math.max(distance2,.0625);
  return {yaw:clamp(yaw,-tuning.yawSpeed,tuning.yawSpeed)*blend,pitch:clamp(pitch,-tuning.pitchSpeed,tuning.pitchSpeed)*blend};
 }
 function observe({record,frame,bases,eyeHeightMeters=1.65,defaultObserverPlayerId=null,fixedObserverPlayerId=null,config}){
  if(!record||!frame||!Number.isFinite(frame.tick))return null;
  const tuning=settings(config??root.KneekuraFieldGazeTuningV99??{}),key=JSON.stringify([eyeHeightMeters,defaultObserverPlayerId,fixedObserverPlayerId,tuning]),tps=record.play?.diagnostics?.sourceClockTicksPerSecond??1e6;
  if(!Number.isFinite(tps)||tps<=0||!Number.isFinite(eyeHeightMeters))return null;
  let variants=cache.get(record);if(!variants){variants=new Map();cache.set(record,variants);}
  let saved=variants.get(key);if(!saved){saved={states:[],next:0};variants.set(key,saved);if(variants.size>12)variants.delete(variants.keys().next().value);}
  function step(sample,prior){
   const view=root.KneekuraLiveFieldCamera.observe({record,frame:sample,bases,defaultObserverPlayerId}),id=fixedObserverPlayerId??view.observerPlayerId,
    actor=(sample.actors??sample.fielders??[]).find(a=>a.playerId===id);
   if(!actor)return prior?{...prior,tick:sample.tick}:null;
   const sourceEye=actor.bodyPoseV105?.eye,
    eye=sourceEye&&['x','y','z'].every(k=>Number.isFinite(sourceEye[k]))?{...sourceEye}:{...actor.position,y:actor.position.y+eyeHeightMeters},facts=[];
   for(const f of record.play?.field?.facts??[])if(f.tick<=sample.tick)facts.push(f);
   let caught=null,released=null,catchIndex=-1,releaseIndex=-1,wasGround=false,wasThrow=false,fly=false;
   for(let i=0;i<facts.length;i++){const f=facts[i];if(f.kind==='ground_contact')wasGround=true;if(f.kind==='throw_release'){wasThrow=true;released=f;releaseIndex=i;}
    if(f.kind==='catch_secured'){caught=f;catchIndex=i;fly=!wasGround&&!wasThrow;}}
   const noRunners=record.beforeMatch?.bases&&Object.values(record.beforeMatch.bases).every(v=>v===null),
    safe=!!caught&&fly&&(noRunners||record.beforeMatch?.outs===2),
    holding=!!safe&&view.phase==='held'&&view.observerPlayerId===caught.playerId,
    target=fixedObserverPlayerId&&id!==view.observerPlayerId?sample.ball?.position:view.target,desired=target?{yaw:Math.atan2(target.x-eye.x,target.z-eye.z),pitch:-Math.atan2(target.y-eye.y,Math.hypot(target.x-eye.x,target.z-eye.z))}:null,
    same=prior?.observerPlayerId===id;
   if(!same){const start=desired??{yaw:prior?.yaw??0,pitch:prior?.pitch??0};prior={...start,yawVelocity:0,pitchVelocity:0,tick:sample.tick,observerPlayerId:id,holding};}
   // An issued motor deadline is known intent, never a future release fact.
   // Completion precedes any physical release; short authored preparations
   // prioritise facing the destination over ordinary free-ball tracking limits.
   const first=record.play?.field?.frames?.[0],elapsed=first&&first.tick<=sample.tick&&Number.isFinite(first.elapsedSeconds)?first.elapsedSeconds+(sample.tick-first.tick)/tps:null,
    toAngles=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]))?{yaw:Math.atan2(p.x-eye.x,p.z-eye.z),pitch:-Math.atan2(p.y-eye.y,Math.hypot(p.x-eye.x,p.z-eye.z))}:null;
   let issued=null;
   if(elapsed!==null&&caught?.playerId===id&&catchIndex>releaseIndex){
    for(const c of record.play?.field?.diagnostics?.handPreparationProofs??[]){
     if(!Number.isFinite(c.from)||c.from>elapsed)continue;
     if(c.playerId===id&&c.from>=(caught.elapsedSeconds??Infinity)&&(!issued||c.from>=issued.from))issued=c;
    }
    if(issued)for(const d of record.play?.field?.diagnostics?.throwDecisions??[]){
     if(!Number.isFinite(d.elapsedSeconds)||d.elapsedSeconds>elapsed||d.elapsedSeconds<issued.from)continue;
     if(d.reason!=='positive_margin_physical_throw')issued=null;
     if(!issued)break;
    }
   }
   const outgoing=released?.playerId===id&&releaseIndex>catchIndex&&(sample.tick-released.tick)/tps<=.12?toAngles(released.target??bases?.[{1:'first',2:'second',3:'third',4:'home'}[released.base]]):null,
    goal=issued&&Number.isFinite(issued.through)&&issued.through>=issued.from?toAngles(issued.target??bases?.[{1:'first',2:'second',3:'third',4:'home'}[issued.base]]):null;
   if(outgoing)return {...outgoing,yawVelocity:0,pitchVelocity:0,tick:sample.tick,observerPlayerId:id,holding:false,facingThrowV102:true};
   if(goal){
    const stamp=JSON.stringify([issued.from,issued.through,issued.target,issued.base]),plan=prior?.throwPlanV102?.stamp===stamp?prior.throwPlanV102:{stamp,yaw:prior?.yaw??goal.yaw,pitch:prior?.pitch??goal.pitch},
     u=issued.through===issued.from?1:clamp((elapsed-issued.from)/(issued.through-issued.from),0,1),blend=u*u*u*(10+u*(-15+6*u)),
     yaw=plan.yaw+wrap(goal.yaw-plan.yaw)*blend,pitch=plan.pitch+(goal.pitch-plan.pitch)*blend,dt=prior?Math.max(0,(sample.tick-prior.tick)/tps):0;
    return {yaw,pitch,yawVelocity:dt?wrap(yaw-prior.yaw)/dt:0,pitchVelocity:dt?(pitch-prior.pitch)/dt:0,tick:sample.tick,observerPlayerId:id,holding:false,throwPlanV102:plan,facingThrowV102:u===1};
   }
   if(!same)return prior;
   if(holding){const {throwPlanV102,facingThrowV102,...held}=prior;return {...held,tick:sample.tick,holding,yawVelocity:0,pitchVelocity:0};}
   const aim=desired??{yaw:prior.yaw,pitch:prior.pitch},motion=nearBallAngularVelocity(sample,actor,eye,view.phase,tuning),dt=Math.max(0,(sample.tick-prior.tick)/tps),yaw=move(prior.yaw,prior.yawVelocity,aim.yaw,dt,tuning.yawSpeed,tuning.acceleration,true,motion.yaw),
    pitch=move(prior.pitch,prior.pitchVelocity,aim.pitch,dt,tuning.pitchSpeed,tuning.acceleration,false,motion.pitch);
   return {yaw:yaw.angle,pitch:pitch.angle,yawVelocity:yaw.velocity,pitchVelocity:pitch.velocity,tick:sample.tick,observerPlayerId:id,holding:false};
  }
  while(saved.next<(record.frames?.length??0)){
   const sample=record.frames[saved.next];if(sample.tick>frame.tick)break;
   const state=step(sample,saved.states.at(-1)??null);saved.states.push(state);saved.next++;
  }
  let low=0,high=saved.states.length;while(low<high){const middle=(low+high)>>>1;const state=saved.states[middle];if(!state||state.tick<=frame.tick)low=middle+1;else high=middle;}
  const prior=saved.states[low-1]??null,result=prior?.tick===frame.tick?prior:step(frame,prior);
  return result?Object.freeze({...result,authority:'READ_ONLY_PREFIX_HEAD_ORIENTATION_V99'}):null;
 }
 root.KneekuraLiveFieldGazeV99=Object.freeze({observe,defaults});
})(typeof globalThis==='object'?globalThis:this);
