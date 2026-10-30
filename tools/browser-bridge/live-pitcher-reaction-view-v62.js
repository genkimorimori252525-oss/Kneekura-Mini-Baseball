/* Read-only pitcher gaze convention. The contact-time exit ball supplies a
 * bounded display reaction delay; no later trajectory/result or pitch speed
 * selects it. Core movement, possession, actions and clocks are untouched. */
(function(root){
 'use strict';
 const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value)),
  finitePoint=value=>value&&['x','y','z'].every(key=>Number.isFinite(value[key])),
  copy=value=>({x:value.x,y:value.y,z:value.z}),ease=value=>value*value*(3-2*value),
  model=Object.freeze({basis:'CAUSAL_CONTACT_EXIT_SPEED_PITCHER_GAZE_DELAY_V1',minimumDelaySeconds:.1,
   maximumDelaySeconds:.25,speedScaleMeters:7,blendMs:180,empiricallyCalibrated:false,
   sourcePhysicsChanged:false,authority:'READ_ONLY_PRESENTATION_CONVENTION'});
 function baseFor(actor,pitcherBodyHeadView){
  const height=actor?.player?.height??actor?.player?.heightMeters,
   eye=finitePoint(pitcherBodyHeadView?.eye)?copy(pitcherBodyHeadView.eye):finitePoint(actor?.position)&&Number.isFinite(height)&&height>0
    ?{x:actor.position.x,y:actor.position.y+height*.92,z:actor.position.z}:{x:-.25,y:1.72,z:18};
  return Object.freeze({eye:Object.freeze(eye),yaw:Math.atan2(-eye.x,-eye.z),
   pitch:Math.atan2(eye.y-1.03,Math.hypot(eye.x,eye.z)),f:1600,cx:300,cy:192,labelMetres:.23});
 }
 function observe({record,frame,sceneMs,preparationMs,pitcherActor,pitcherBodyHeadView}){
  const empty={phase:'ready',trackingAllowed:false,handoffAllowed:false,trackingProgress:0,trackingBlend:0,
   delaySeconds:null,contactSpeedMps:null,contactTick:null,contactAtMs:null,trackingAtMs:null,handoffAtMs:null,
   observedContactSampleTick:null,atTick:Number.isFinite(frame?.tick)?frame.tick:null,view:null,model};
  if(frame?.phase==='bench')return Object.freeze({...empty,phase:'bench'});
  if(!record||!frame||!record.frames?.length||!Number.isFinite(sceneMs)||!Number.isFinite(preparationMs)
   ||sceneMs<=preparationMs)return Object.freeze(empty);
  const tps=record.play?.diagnostics?.sourceClockTicksPerSecond,origin=record.frames[0]?.tick;
  if(!Number.isFinite(tps)||tps<=0||!Number.isFinite(origin)||!Number.isFinite(frame.tick))
   return Object.freeze({...empty,phase:'unavailable'});
  const cap=Math.min(frame.tick,origin+Math.max(0,sceneMs-preparationMs)*tps/1000);
  let observedHit=null;
  for(const sample of record.frames){
   if(!Number.isFinite(sample.tick))continue;
   // A future row's occurrence header is allowed; its payload is not read.
   if(sample.tick>cap)break;
   if(sample.ballKind==='batted'){observedHit=sample;break;}
  }
  if(!observedHit)return Object.freeze({...empty,phase:'pre-contact',atTick:cap});
  // Contact has already occurred in the observed prefix. Its exact Source
  // clock may precede the first batted presentation sample by a fraction of a
  // frame. A malformed/future contact header never moves the timer forward.
  const declaredTick=record.play?.contactMoment?.ball?.tick,
   contactTick=Number.isFinite(declaredTick)&&declaredTick>=origin&&declaredTick<=observedHit.tick&&declaredTick<=cap
    ?declaredTick:observedHit.tick,
   velocity=observedHit.ball?.velocity,speed=finitePoint(velocity)?Math.hypot(velocity.x,velocity.y,velocity.z):null,
   delaySeconds=speed===null?model.maximumDelaySeconds
    :clamp(model.speedScaleMeters/Math.max(1,speed),model.minimumDelaySeconds,model.maximumDelaySeconds),
   contactAtMs=preparationMs+(contactTick-origin)/tps*1000,trackingAtMs=contactAtMs+delaySeconds*1000,
   handoffAtMs=trackingAtMs+model.blendMs,trackingProgress=clamp((sceneMs-trackingAtMs)/model.blendMs,0,1),
   trackingBlend=ease(trackingProgress),trackingAllowed=sceneMs>=trackingAtMs,handoffAllowed=sceneMs>=handoffAtMs;
  return Object.freeze({...empty,phase:!trackingAllowed?'reaction-hold':handoffAllowed?'tracking':'tracking-blend',
   trackingAllowed,handoffAllowed,trackingProgress,trackingBlend,delaySeconds,contactSpeedMps:speed,
   contactTick,contactAtMs,trackingAtMs,handoffAtMs,observedContactSampleTick:observedHit.tick,atTick:cap,
   view:handoffAllowed?null:baseFor(pitcherActor,pitcherBodyHeadView)});
 }
 /** Mix only the orientation/optics with the original mound follower. Both
  * poses use the SAME current pitcher eye; interpolation never creates a
  * stationary second camera while the actual pitcher moves. */
 function mixTrackingView({reaction,tracked}){
  const eye=finitePoint(tracked?.eye)?copy(tracked.eye):tracked?.eye;
  if(!reaction?.view||reaction.trackingBlend>=1)return {...tracked,eye};
  const base=reaction.view,weight=clamp(reaction.trackingBlend??0,0,1),result={...tracked,eye};
  if(weight===0)return {...result,yaw:base.yaw,pitch:base.pitch,f:base.f,cx:base.cx,cy:base.cy,labelMetres:base.labelMetres};
  const delta=Math.atan2(Math.sin(tracked.yaw-base.yaw),Math.cos(tracked.yaw-base.yaw));
  result.yaw=base.yaw+delta*weight;
  for(const key of ['pitch','f','cx','cy','labelMetres'])result[key]=base[key]+(tracked[key]-base[key])*weight;
  return result;
 }
 root.KneekuraLivePitcherReactionView=Object.freeze({version:1,observe,mixTrackingView});
})(typeof globalThis==='object'?globalThis:this);
