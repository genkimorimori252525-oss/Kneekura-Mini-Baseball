/* Display-only HR watch window. Source ticks, dead-ball state, runners and
 * rulings remain owned by Core. Never consult an unobserved frame payload. */
(function(root){
 'use strict';
 const holdMs=1750,point=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k])),copy=p=>({x:p.x,y:p.y,z:p.z});
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 function evidence(record,preparationMs,selectedCamera){
  if(!['mound','fielder'].includes(selectedCamera)||record?.play?.classification!=='home_run'||!record.frames?.length||!Number.isFinite(preparationMs))return null;
  const facts=record.play.field?.ruleFacts,fence=facts?.overFence,tps=record.play.diagnostics?.sourceClockTicksPerSecond,first=record.frames[0].tick;
  if(!Number.isFinite(fence?.tick)||!Number.isFinite(tps)||tps<=0||!Number.isFinite(first)||fence.tick<first
   ||!fence.fair||!fence.untouchedGround||fence.cause!=='batted'||facts.firstGroundContactTick!=null&&facts.firstGroundContactTick<=fence.tick)return null;
  return {crossingTick:fence.tick,startAtMs:preparationMs+(fence.tick-first)/tps*1000,tps,first};
 }
 function create(){
  const cache=new WeakMap();
  function observe({record,frame,sceneMs,preparationMs,selectedCamera,cameraAt}){
   // Check the occurrence header before inspecting its outcome payload.
   const tick=record?.play?.field?.ruleFacts?.overFence?.tick;
   if(!Number.isFinite(frame?.tick)||!Number.isFinite(tick)||tick>frame.tick||!Number.isFinite(sceneMs))return null;
   const e=evidence(record,preparationMs,selectedCamera);
   if(!e||sceneMs<e.startAtMs||sceneMs>=e.startAtMs+holdMs||typeof cameraAt!=='function')return null;
   let lower=0,upper=record.frames.length;
   while(lower<upper){const middle=Math.floor((lower+upper)/2);if(record.frames[middle].tick<=e.crossingTick)lower=middle+1;else upper=middle;}
   const last=lower-1;let confirmed=false;
   // Confirmation is an observed-prefix fact, not the final classification.
   for(let i=last;i>=0;i--)if(record.frames[i].homeRunConfirmed){confirmed=true;break;}
   // A fence event may fall between saved frames. Its first confirmation is
   // then the next admitted frame, rather than a row exactly at crossingTick.
   if(!confirmed)for(let i=last+1;i<record.frames.length&&record.frames[i].tick<=frame.tick;i++)if(record.frames[i].homeRunConfirmed){confirmed=true;break;}
   if(!confirmed)return null;
   const key=selectedCamera+':'+preparationMs;let entries=cache.get(record),descriptor=entries?.get(key);
   if(!descriptor){
    let admitted=null,fenceTarget=null;
    for(let i=last;i>=0;i--){
     const sample=record.frames[i];
     if(!fenceTarget&&point(sample.ball?.position))fenceTarget=copy(sample.ball.position);
     const view=cameraAt(sample,preparationMs+(sample.tick-e.first)/e.tps*1000);
     if(view?.camera==='fielder'&&typeof view.observerPlayerId==='string'&&view.observerPlayerId){admitted=view;break;}
    }
    if(!admitted||!fenceTarget)return null;
    descriptor=freeze({observerPlayerId:admitted.observerPlayerId,fenceTarget});
    if(!entries){entries=new Map();cache.set(record,entries);}entries.set(key,descriptor);
   }
   const sourceBall=frame.ball,target=point(sourceBall?.position)?copy(sourceBall.position):copy(descriptor.fenceTarget);
   let displayBall;
   // HR dead balls can still have a sampled physical position. Show only that
   // current sample during the watch; never invent a flight or expose custody.
   if(frame.ballKind==='batted'&&sourceBall?.phase==='dead'&&sourceBall.visible===false
    &&!frame.possessedBy&&!sourceBall.possessedBy&&point(sourceBall.position)){
    displayBall={...sourceBall,position:copy(sourceBall.position),visible:true};
    for(const name of ['velocity','spin'])if(point(sourceBall[name]))displayBall[name]=copy(sourceBall[name]);
    if(sourceBall.orientation)displayBall.orientation={...sourceBall.orientation};
   }
   return freeze({active:true,camera:'fielder',observerPlayerId:descriptor.observerPlayerId,target,...(displayBall?{displayBall}:{}),
    crossingTick:e.crossingTick,startAtMs:e.startAtMs,untilMs:e.startAtMs+holdMs,holdMs,authority:'READ_ONLY_PRESENTATION_CONVENTION'});
  }
  return Object.freeze({observe,minDurationMs:input=>{const e=evidence(input.record,input.preparationMs,input.selectedCamera);return e?e.startAtMs+holdMs:0;}});
 }
 root.KneekuraHomeRunWatchV83=Object.freeze({version:83,holdMs,create});
})(typeof globalThis==='object'?globalThis:this);
