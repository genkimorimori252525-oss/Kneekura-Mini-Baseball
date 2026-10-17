/* Read-only broadcast convention. A viewpoint is not a fielding decision,
 * possession, throw recipient, trajectory, or official result. Only Source
 * facts/actor samples available at the observed tick are inspected. */
(function(root){
 'use strict';
 const finitePoint=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
 const point=p=>finitePoint(p)?Object.freeze({x:p.x,y:p.y,z:p.z}):undefined;
 const baseNames={1:'first',2:'second',3:'third',4:'home'};
 const planarDistance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 function assert(value,message){if(!value)throw new Error('Live field camera: '+message);}
 // Reading a future row's tick for the prefix fence must not read its payload.
 function through(rows,tick){const result=[];for(const row of rows??[])if(Number.isFinite(row.tick)&&row.tick<=tick)result.push(row);return result;}
 function latest(rows,tick){let value=null;for(const row of rows??[])if(Number.isFinite(row.tick)&&row.tick<=tick&&(!value||row.tick>=value.tick))value=row;return value;}
 const actors=frame=>frame?.fielders??frame?.actors??[];
 const actor=(frame,id)=>actors(frame).find(a=>a.playerId===id);
 const targetBase=(bases,base)=>point(bases?.[baseNames[base]]);
 function releaseView(record,release,bases){
  const field=latest(record.play?.field?.frames,release.tick),sample=latest(record.frames,release.tick);
  const candidates=actors(field??sample),goal=point(release.target)??targetBase(bases,release.base);
  const explicitId=release.receiverPlayerId;
  if(typeof explicitId==='string'&&candidates.some(a=>a.playerId===explicitId))return {receiverPlayerId:explicitId,
   receiverBasis:'SOURCE_EXPLICIT_RECIPIENT',goal:goal??point(candidates.find(a=>a.playerId===explicitId).position)};
  // Legacy recordings have no actual recipient metadata. Retain the thrower
  // until a real catch; proximity/base-cover guesses are not recipient proof.
  return {receiverPlayerId:null,receiverBasis:'SOURCE_RECIPIENT_UNAVAILABLE',goal};
 }
 function progress(position,origin,goal){
  if(!finitePoint(position)||!finitePoint(origin)||!finitePoint(goal))return 0;
  const x=goal.x-origin.x,z=goal.z-origin.z,length2=x*x+z*z;
  return length2>0?Math.max(0,Math.min(1,((position.x-origin.x)*x+(position.z-origin.z)*z)/length2)):0;
 }
 function heldTarget(record,frame,holder,lastCatch,bases){
  const sample=latest(record?.play?.field?.frames,frame.tick),elapsed=sample?.elapsedSeconds;
  if(!Number.isFinite(elapsed))return undefined;
  if(lastCatch&&!Number.isFinite(lastCatch.elapsedSeconds))return undefined;
  let command=null;
  for(const value of record?.play?.field?.diagnostics?.handPreparationProofs??[]){
   // from is the actual issue time of this hand command. Its future through,
   // control points and any later throw/catch result are deliberately unread.
   if(!Number.isFinite(value.from)||value.from>elapsed)continue;
   if(value.playerId===holder&&value.from>=(lastCatch?.elapsedSeconds??-Infinity)&&(!command||value.from>=command.from))command=value;
  }
  if(command)for(const decision of record?.play?.field?.diagnostics?.throwDecisions??[]){
   if(!Number.isFinite(decision.elapsedSeconds)||decision.elapsedSeconds>elapsed||decision.elapsedSeconds<command.from)continue;
   if(decision.reason!=='positive_margin_physical_throw')return undefined;
  }
  return command?targetBase(bases,command.base):undefined;
 }
 /** observe({record,frame,bases,defaultObserverPlayerId?}) -> immutable display
  * observation. Pass actual Core LIVE_MATCH_BASES_V1 for bases. The caller may
  * retain the previous yaw/pitch when target is absent during unplanned hold.
  * A free ball always uses its CURRENT Source position as the gaze target. */
 function observe({record,frame,bases,defaultObserverPlayerId=null}){
  assert(frame&&Number.isFinite(frame.tick),'current Source frame required');
  const facts=through(record?.play?.field?.facts,frame.tick);
  let caught=null,release=null,lastCatchIndex=-1,lastReleaseIndex=-1;
  for(let i=0;i<facts.length;i++){
   const fact=facts[i];if(fact.kind==='catch_secured'){caught=fact;lastCatchIndex=i;}
   else if(fact.kind==='throw_release'){release=fact;lastReleaseIndex=i;}
  }
  // Field frames also mark pending glove retention as possessedBy. Secure
  // custody is known only from catch_secured; do not promote glove contact.
  const held=lastCatchIndex>lastReleaseIndex||!record?.play?.field&&!!frame.possessedBy;
  const holder=lastCatchIndex>lastReleaseIndex?caught?.playerId:!record?.play?.field?frame.possessedBy:null;
  let observerPlayerId=holder??defaultObserverPlayerId??frame.fieldObserverPlayerId??null;
  let target=held?heldTarget(record,frame,holder,caught,bases):point(frame.ball?.position);
  let handoff=null;
  if(release&&lastReleaseIndex>lastCatchIndex&&!held){
   const view=releaseView(record,release,bases),origin=point(release.position);
   const distance=origin&&view.goal?planarDistance(origin,view.goal):0;
   // A continuous deterministic display convention: 48% for a tiny toss,
   // tending to 52% for a long throw. It never alters any physical tick.
   const threshold=.48+.04*distance/(distance+30);
   let maximumProgress=progress(frame.ball?.position,origin,view.goal);
   for(const sample of through(record.frames,frame.tick))if(sample.tick>=release.tick)
    maximumProgress=Math.max(maximumProgress,progress(sample.ball?.position,origin,view.goal));
   const switched=!!view.receiverPlayerId&&maximumProgress>=threshold;
   observerPlayerId=switched?view.receiverPlayerId:release.playerId??observerPlayerId;
   handoff=Object.freeze({releaseTick:release.tick,throwerPlayerId:release.playerId??null,
    receiverPlayerId:view.receiverPlayerId,receiverBasis:view.receiverBasis,goal:view.goal??null,
    distanceMeters:distance,progress:maximumProgress,threshold,switched});
  }
  // An actual catch prefix wins over a prior display-selected recipient. The
  // next release restarts progress from that actual new thrower, generically.
  if(observerPlayerId&&!actor(frame,observerPlayerId))observerPlayerId=defaultObserverPlayerId??null;
  const phase=held?'held':handoff?'throw':'chase';
  return Object.freeze({observerPlayerId,...(target?{target}:{}),phase,handoff,
   targetBasis:held?(target?'SOURCE_ISSUED_HAND_COMMAND_BASE':'HELD_UNPLANNED_RETAIN_GAZE'):'CURRENT_SOURCE_BALL',
   authority:'READ_ONLY_PRESENTATION_CONVENTION',atTick:frame.tick});
 }
 root.KneekuraLiveFieldCamera=Object.freeze({version:1,observe});
})(typeof globalThis==='object'?globalThis:this);
