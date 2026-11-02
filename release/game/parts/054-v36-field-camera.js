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
  // An issued relay command may aim at a receiver away from the eventual out
  // base. Its frozen issue-time target is causal; legacy commands keep bases.
  if(!command)return undefined;
  const goal=point(command.target)??targetBase(bases,command.base),ball=point(frame.ball?.position);
  if(!goal||!ball)return goal??ball;
  const tps=record.play?.diagnostics?.sourceClockTicksPerSecond??1e6,
   sinceCatch=lastCatch?Math.max(0,(frame.tick-lastCatch.tick)/tps):Math.max(0,elapsed-command.from),
   sinceCommand=Math.max(0,elapsed-command.from),u=Math.max(0,Math.min(1,Math.min(sinceCatch-.12,sinceCommand)/.22)),blend=u*u*(3-2*u);
  return point({x:ball.x+(goal.x-ball.x)*blend,y:ball.y+(goal.y-ball.y)*blend,z:ball.z+(goal.z-ball.z)*blend});
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
 // Catcher view only. After the catcher secures a pitch while a runner is stealing, or once the pitcher
 // holds the ball for a pickoff, the view turns to the target base over GLANCE_SECONDS and stays there.
 // The turn is made of the same recorded frames the throw is drawn from; the throw time is not moved.
 const GLANCE_SECONDS=.3,speedOf=a=>Math.hypot(a?.velocity?.x??0,a?.velocity?.z??0),
  ease=u=>{const v=Math.max(0,Math.min(1,u));return v*v*(3-2*v);},nextBase={first:'second',second:'third'};
 function catcherBaseGlance({record,frame,bases}){
  if(!record||!frame||!Number.isFinite(frame.tick)||frame.ballKind==='batted')return null;
  const catcher=actors(frame).find(a=>a.role==='C'),pitcherId=record.pitcherPlayerId;
  if(!catcher||!finitePoint(catcher.position))return null;
  let caught=null,held=null;
  for(const row of through(record.frames,frame.tick)){
   if(row.phase!=='pitch'||row.ballKind==='batted')continue;
   if(!caught){if(row.possessedBy===catcher.playerId)caught=row;}
   else if(!held&&pitcherId&&row.possessedBy===pitcherId){held=row;break;}
  }
  let base=null,startTick=null,kind=null;
  if(held){base='first';startTick=held.tick;kind='pickoff';}
  else if(caught){
   const runner=actors(caught).find(a=>a.role==='runner'&&speedOf(a)>=2),
    from=runner&&['first','second','third'].find(name=>record.beforeMatch?.bases?.[name]===runner.playerId);
   if(from&&nextBase[from]){base=nextBase[from];startTick=caught.tick;kind='steal';}
  }
  const goal=base&&targetBase(bases,{first:1,second:2,third:3}[base]);
  if(!goal)return null;
  const tps=record.play?.diagnostics?.sourceClockTicksPerSecond??1e6,progress=ease((frame.tick-startTick)/(GLANCE_SECONDS*tps));
  // render picks yaw/pitch from this point: same eye and angle formulas as the catcher camera there.
  const eye={x:catcher.position.x,y:catcher.position.y+1.03,z:catcher.position.z+.5},
   distance=Math.max(1,planarDistance(eye,goal)),yaw1=Math.atan2(goal.x-eye.x,goal.z-eye.z),
   pitch1=-Math.atan2(.9-eye.y,distance),yaw=yaw1*progress,pitch=.018+(pitch1-.018)*progress;
  return Object.freeze({kind,base,progress,startTick,
   target:Object.freeze({x:eye.x+Math.sin(yaw)*distance,y:eye.y-Math.tan(pitch)*distance,z:eye.z+Math.cos(yaw)*distance})});
 }
 root.KneekuraLiveFieldCamera=Object.freeze({version:1,observe,catcherBaseGlance});
})(typeof globalThis==='object'?globalThis:this);


/* Read-only broadcast cues around a camera change. Display only: no tick, frame, ball or result is touched.
 * before() runs ahead of the scene draw: when playback itself switched the view, the picture on screen
 * is copied to a layer that fades out over the new view (a short dissolve instead of a cut).
 * after() runs once the scene is drawn: it names the change in the camera caption and shows the
 * batted-ball readout (the tab's box) only after a ball has been put in play. */
(function(root){
 'use strict';
 const FADE_MS=320,CAPTION_MS=1600,CONTINUOUS_SCENE_MS=700;
 let lastCamera=null,lastView=null,lastRecord=null,lastSceneMs=-Infinity,fade=null,fadeAnimation=null,captionText='',settledText='',captionTimer=0,styled=false;
 const doc=()=>root.document;
 function style(){
  if(styled||!doc())return;styled=true;
  const el=doc().createElement('style');
  el.textContent='.camera-fade{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0}'
   +'.camera-caption.camera-switch{color:#f0d77a;outline:1px solid #e0b541}'
   +'.hit-window[data-bip="0"]{display:none!important}';
  doc().head.append(el);
 }
 function layer(field){
  if(fade&&fade.isConnected)return fade;
  fade=doc().createElement('canvas');fade.className='camera-fade';fade.setAttribute('aria-hidden','true');
  field.after(fade);return fade;
 }
 // observer: whose eyes a fielder view shows. A change of eyes inside the same view dissolves too.
 function before({camera,playing,sceneMs,record,observer=null}){
  const field=doc()?.getElementById('field');if(!field||typeof field.getContext!=='function')return;style();
  const continuous=!!playing&&record===lastRecord&&sceneMs>=lastSceneMs&&sceneMs-lastSceneMs<=CONTINUOUS_SCENE_MS;
  const view=camera+':'+(observer??'');
  if(continuous&&lastView&&view!==lastView){
   const layerCanvas=layer(field);
   if(layerCanvas.width!==field.width||layerCanvas.height!==field.height){layerCanvas.width=field.width;layerCanvas.height=field.height;}
   const context=layerCanvas.getContext('2d');context.clearRect(0,0,layerCanvas.width,layerCanvas.height);context.drawImage(field,0,0);
   fadeAnimation?.cancel();
   fadeAnimation=typeof layerCanvas.animate==='function'?layerCanvas.animate([{opacity:1},{opacity:0}],{duration:FADE_MS,easing:'ease-out',fill:'forwards'}):null;
   if(camera!==lastCamera)captionText={from:lastCamera,until:root.performance.now()+CAPTION_MS};
  }else if(!continuous&&fadeAnimation){fadeAnimation.cancel();fadeAnimation=null;captionText='';}
  lastCamera=camera;lastView=view;lastRecord=record;lastSceneMs=sceneMs;
 }
 function after({camera,labels,contactReached,observerName=null}){
  const d=doc();if(!d)return;
  const caption=d.getElementById('camera-caption');
  if(caption&&labels){
   const active=captionText&&root.performance.now()<captionText.until;
   const name=labels[camera]+(observerName?'（'+observerName+'）':'');
   settledText=name;
   caption.textContent=active?(labels[captionText.from]??captionText.from)+' → '+name:name;
   caption.classList.toggle('camera-switch',!!active);
   if(active){root.clearTimeout(captionTimer);captionTimer=root.setTimeout(()=>{caption.classList.remove('camera-switch');caption.textContent=settledText;},Math.max(0,captionText.until-root.performance.now())+30);}
  }
  const box=d.querySelector('.hit-window');if(box)box.dataset.bip=contactReached?'1':'0';
 }
 root.KneekuraLiveBroadcastView=Object.freeze({version:1,before,after});
})(typeof globalThis==='object'?globalThis:this);
