/* lv27 stance/limited take with the current measured bat and field observer.
 * A pure take projection has no angular inertia or automatic return motion.
 * Core positions, bat samples, possession, outcomes and clocks are read-only. */
(function(root){
 'use strict';
 const fieldFollower=root.KneekuraContinuousBatterView;
 if(!fieldFollower||typeof fieldFollower.observe!=='function')throw Error('v27 batter view requires existing field follower');
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x);},
  finite=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k])),copy=p=>({x:p.x,y:p.y,z:p.z}),
  delta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
 const model=Object.freeze({basis:'LV27_STANCE_AND_LIMITED_TAKE; CURRENT_MEASURED_SWING; EXISTING_FIELD_FOLLOWER',
  takeSeconds:.165,afterSwingHoldMs:700,fieldBlendMs:9*55,returnReadyAfterTake:false,angularInertiaDuringTake:false});
 function baseFor(batter){
  const s=(batter?.hand??batter?.bats)==='L'?-1:1,h=batter?.height??batter?.heightMeters??1.8;
  return {eye:{x:-.4*s,y:Math.max(1.15,h*.77),z:-.95},yaw:Math.atan2(.4*s,19.4),pitch:.08,f:400,cx:300,cy:110,labelMetres:.55};
 }
 function aim(pose,target){const dx=target.x-pose.eye.x,dz=target.z-pose.eye.z;
  return {...pose,yaw:Math.atan2(dx,dz),pitch:-Math.atan2(target.y-pose.eye.y,Math.hypot(dx,dz))};}
 function observe(args){
  const {record,frame,sceneMs,preparationMs,batter}=args,base=baseFor(batter),ready={...base,phase:'ready',model};
  if(frame?.phase==='bench')return {...ready,phase:'bench'};
  if(!record||!frame||!record.frames?.length||sceneMs<=preparationMs)return ready;
  const d=record.play?.diagnostics,tps=d?.sourceClockTicksPerSecond,origin=record.frames[0].tick;
  if(!Number.isFinite(tps)||tps<=0)return ready;
  const decisionAtMs=preparationMs+(d.predictionMadeAtElapsedSeconds??.14)*1000;
  if(sceneMs<decisionAtMs)return ready;
  const cap=Math.min(frame.tick,origin+Math.max(0,sceneMs-preparationMs)*tps/1000);
  if(d.swingOffered===false){
   let start=null,last=null;
   for(const sample of record.frames){
    if(sample.tick>cap)break;
    if(sample.ballKind!=='pitch'||sample.possessedBy||!sample.ball||sample.ball.visible===false||!finite(sample.ball.position))continue;
    if(start===null&&sample.ball.position.z<=1)start=sample.tick;
    if(start!==null&&sample.tick<=start+model.takeSeconds*tps)last=sample;
   }
   if(start===null||!last)return ready;
   const startAtMs=preparationMs+(start-origin)/tps*1000,progress=clamp((sceneMs-startAtMs)/(model.takeSeconds*1000),0,1),smooth=ease(progress),
    target={...last.ball.position,z:Math.max(-.42,last.ball.position.z)},yaw=Math.atan2(target.x-base.eye.x,target.z-base.eye.z),
    pitch=-Math.atan2(target.y-base.eye.y,Math.max(.05,Math.hypot(target.x-base.eye.x,target.z-base.eye.z)));
   return {...base,yaw:base.yaw+clamp(delta(base.yaw,yaw),-.40,.40)*smooth,pitch:base.pitch+clamp(pitch-base.pitch,-.18,.18)*smooth,
    f:base.f*(1-.06*smooth),labelMetres:base.labelMetres*(1-.03*smooth),cy:172,target,
    phase:progress<1?'take-glance':'take-held',startAtMs,completedAtMs:startAtMs+model.takeSeconds*1000,progress,model};
  }
  if(d.swingOffered!==true)return ready;
  const offense=record.beforeMatch?.half==='top'?0:1,bunt=record.command?.managedTeam===offense&&record.command?.batting==='bunt';
  let observedHit=null;
  for(const sample of record.frames){if(sample.tick>cap)break;if(sample.ballKind==='batted'){observedHit=sample;break;}}
  const startAtMs=preparationMs+(d.referenceStartTick-origin)/tps*1000,
   endTick=bunt?observedHit?.tick:d.referenceThroughTick,
   swingEndAtMs=preparationMs+(endTick-origin)/tps*1000,followAtMs=swingEndAtMs+model.afterSwingHoldMs,
   forecast=d.zoneJudgment?.observedForecastPosition,error=d.aimErrorMeters;
  if(!Number.isFinite(startAtMs)||sceneMs<startAtMs||!Number.isFinite(swingEndAtMs)||!finite(forecast)||!finite(error))return ready;
  const target={x:forecast.x+error.x,y:forecast.y+error.y,z:forecast.z+error.z},field=fieldFollower.observe(args),
   // Retain the existing body eye while running. Reverting the angular policy
   // must not leave a second eye standing at home after the actor departs.
   held=aim({...base,eye:copy(field.eye)},target),timing={swingEndAtMs,followAtMs,target,model};
  if(sceneMs<followAtMs)return {...held,...timing,phase:sceneMs<swingEndAtMs?'swing-aim':'post-swing-hold',followProgress:0};
  if(!observedHit)return {...base,...timing,target:null,phase:'swing-miss-reset',followProgress:0};
  const followProgress=clamp((sceneMs-followAtMs)/model.fieldBlendMs,0,1),blend=ease(followProgress);
  return {...field,yaw:followProgress===1?field.yaw:held.yaw+delta(held.yaw,field.yaw)*blend,
   pitch:followProgress===1?field.pitch:held.pitch+(field.pitch-held.pitch)*blend,...timing,phase:'field-follow',followProgress};
 }
 const api=Object.freeze({version:1,observe});
 root.KneekuraV27BatterView=api;root.KneekuraContinuousBatterView=api;
})(typeof globalThis==='object'?globalThis:this);
