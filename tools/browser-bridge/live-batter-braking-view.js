/* One embodied observer. This authored reduced-order eye/head controller is
 * read-only, not a calibrated neural model or an authority for batting results.
 * All measurements are from the available Source prefix. */
(function(root){
 'use strict';
 const caches=new Map(),STEP=.008,MAX_SPEED=2.5,MAX_ACCELERATION=20;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const finite=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
 const copy=p=>({x:p.x,y:p.y,z:p.z});
 const length=p=>Math.hypot(p.x,p.y,p.z);
 const ease=x=>{x=clamp(x,0,1);return x*x*x*(10+x*(-15+6*x));};
 const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
 const angleDelta=a=>Math.atan2(Math.sin(a),Math.cos(a));
 const limit=(x,y,bound)=>{const n=Math.hypot(x,y);return n>bound?[x*bound/n,y*bound/n]:[x,y];};
 function baseFor(batter){
  const side=(batter?.hand??batter?.bats)==='L'?-1:1,height=batter?.height??batter?.heightMeters??1.8;
  return {eye:{x:-.4*side,y:Math.max(1.15,height*.77),z:-.95},yaw:Math.atan2(.4*side,19.4),pitch:.08,
   f:400,cx:300,cy:110,labelMetres:.55};
 }
 function indexAt(frames,tick){
  let lo=0,hi=frames.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(frames[mid].tick<=tick)lo=mid+1;else hi=mid;}
  return lo-1;
 }
 function actorAt(sample,id){return sample?.actors?.find(a=>a.playerId===id)??sample?.actors?.find(a=>a.role==='batter');}
 function visibleBall(frames,index){
  for(let i=index;i>=0;i--){const f=frames[i];
   if(!f.possessedBy&&f.ball&&f.ball.visible!==false&&finite(f.ball.position))return {frame:f,index:i};
  }return null;
 }
 function priorExpectation(record,previous){
  if(!previous||record.pitcherPlayerId!==previous.pitcherPlayerId)return null;
  let speed=null,course=null,best=Infinity;
  for(const f of previous.frames??[]){
   if(f.ballKind!=='pitch'||f.possessedBy||!f.ball||f.ball.visible===false)continue;
   const p=f.ball.position,v=f.ball.velocity;if(!finite(p))continue;
   if(speed===null&&finite(v))speed=length(v);
   const distance=Math.abs(p.z-.15);if(distance<best){best=distance;course=copy(p);}
  }return speed===null?null:{speed,course};
 }
 function create(record,batter,previous){
  const d=record.play?.diagnostics??{},base=baseFor(batter),tps=d.sourceClockTicksPerSecond??1e6,
   origin=record.frames[0].tick,std=clamp(batter?.physical?.zoneJudgmentStdMeters??d.individualControls?.zoneJudgmentStdMeters??.025,0,.6),
   delay=.060+Math.min(.060,std*.6),id=record.batterPlayerId??batter?.playerId,
   initial=actorAt(record.beforeFrame,id)??actorAt(record.frames[0],id),prior=priorExpectation(record,previous);
  const initialState={t:0,eye:copy(base.eye),eyeVelocity:{x:0,y:0,z:0},yaw:base.yaw,pitch:base.pitch,vy:0,vp:0,surprise:0,heldSince:null,lastMeasuredTick:null,
   expectedSpeed:prior?.speed??null,expectedCourse:prior?.course??null,lastMeasurement:null,target:null,aimWeight:0,phase:'incoming'};
  return {record,previous,std,height:batter?.height??batter?.heightMeters,hand:batter?.hand??batter?.bats,
   d,base,tps,origin,id,initialPosition:finite(initial?.position)?copy(initial.position):null,delay,states:[initialState]};
 }
 function bodyTarget(c,t,cap){
  const frames=c.record.frames,tick=c.origin+t*c.tps,index=indexAt(frames,Math.min(tick,cap));
  if(index<0||!c.initialPosition)return copy(c.base.eye);
  const a=actorAt(frames[index],c.id);if(!finite(a?.position))return copy(c.base.eye);
  // A bounded prediction from observed body velocity bridges irregular field
  // samples. Continuous eye state absorbs new measurements; no camera switch
  // or future actor endpoint is required at a sample/role boundary.
  const age=clamp((tick-frames[index].tick)/c.tps,0,.055),v=finite(a.velocity)?a.velocity:{x:0,y:0,z:0},
   position={x:a.position.x+v.x*age,y:a.position.y+v.y*age,z:a.position.z+v.z*age};
  return {x:c.base.eye.x+position.x-c.initialPosition.x,y:c.base.eye.y+position.y-c.initialPosition.y,z:c.base.eye.z+position.z-c.initialPosition.z};
 }
 function measurement(c,t,cap){
  const at=Math.min(cap,c.origin+Math.max(0,t-c.delay)*c.tps),frames=c.record.frames,index=indexAt(frames,at);
  // Even the release observation is unavailable until its sensory delay.
  if(t<c.delay||index<0)return null;
  const visible=visibleBall(frames,index);if(!visible)return null;
  const f=visible.frame,ball=f.ball,held=!!frames[index].possessedBy||frames[index].ball?.visible===false,
   velocity=finite(ball.velocity)?copy(ball.velocity):{x:0,y:0,z:0};
  let acceleration={x:0,y:ball.position.y>.04?-9.80665:0,z:0};
  const prior=visibleBall(frames,visible.index-1);
  if(prior&&prior.frame.ballKind===f.ballKind&&finite(prior.frame.ball.velocity)&&f.tick>prior.frame.tick){
   const dt=(f.tick-prior.frame.tick)/c.tps;
   acceleration={x:(velocity.x-prior.frame.ball.velocity.x)/dt,y:(velocity.y-prior.frame.ball.velocity.y)/dt,z:(velocity.z-prior.frame.ball.velocity.z)/dt};
   const n=length(acceleration);if(n>60)for(const k of ['x','y','z'])acceleration[k]*=60/n;
  }
  const age=held?0:clamp(t-(f.tick-c.origin)/c.tps,0,.14),p=ball.position,
   target={x:p.x+velocity.x*age+acceleration.x*age*age/2,y:p.y+velocity.y*age+acceleration.y*age*age/2,z:p.z+velocity.z*age+acceleration.z*age*age/2};
  if(f.ballKind==='pitch')target.z=Math.max(-.42,target.z);
  const toPlate=velocity.z<-.1?clamp((.15-p.z)/velocity.z,0,.8):0,
   course={x:p.x+velocity.x*toPlate+acceleration.x*toPlate*toPlate/2,y:p.y+velocity.y*toPlate+acceleration.y*toPlate*toPlate/2,z:.15};
  return {tick:f.tick,target,kind:f.ballKind,velocity,course,held};
 }
 function advance(c,state,t,cap){
  const dt=t-state.t,s={...state,t},body=bodyTarget(c,t,cap),m=measurement(c,t,cap),d=c.d,
   acceleration={x:0,y:0,z:0},velocity={x:0,y:0,z:0},eye={x:0,y:0,z:0};
  for(const k of ['x','y','z'])acceleration[k]=35*35*(body[k]-state.eye[k])-70*state.eyeVelocity[k];
  const bodyAcceleration=length(acceleration);if(bodyAcceleration>60)for(const k of ['x','y','z'])acceleration[k]*=60/bodyAcceleration;
  for(const k of ['x','y','z'])velocity[k]=state.eyeVelocity[k]+acceleration[k]*dt;
  const bodySpeed=length(velocity);if(bodySpeed>14)for(const k of ['x','y','z'])velocity[k]*=14/bodySpeed;
  for(const k of ['x','y','z'])eye[k]=state.eye[k]+(state.eyeVelocity[k]+velocity[k])*dt/2;
  s.eye=eye;s.eyeVelocity=velocity;
  s.surprise=state.surprise*Math.exp(-dt/.14);
  if(m&&!m.held&&state.lastMeasurement&&m.tick!==state.lastMeasuredTick){
   const previous=state.lastMeasurement.velocity,
    innovation=Math.hypot(m.velocity.x-previous.x,m.velocity.y-previous.y,m.velocity.z-previous.z);
   s.surprise=Math.max(s.surprise,clamp((innovation-.4)/12,0,1));
  }
  if(m&&m.kind==='pitch'){
   const speed=length(m.velocity),gain=1-Math.exp(-dt/.10);
   if(state.expectedSpeed!==null&&state.expectedCourse){
    const unexpected=clamp(Math.max(Math.abs(speed-state.expectedSpeed)/12,
     Math.hypot(m.course.x-state.expectedCourse.x,m.course.y-state.expectedCourse.y)/(.6+3*c.std)),0,1);
    // Updating a prediction never restarts a waiting timer. Recognition and
    // bounded motion continue even while the observed course is surprising.
    s.surprise=Math.max(s.surprise,unexpected);
    s.expectedSpeed=state.expectedSpeed+(speed-state.expectedSpeed)*gain;
    s.expectedCourse=mix(state.expectedCourse,m.course,gain);
   }else{s.expectedSpeed=speed;s.expectedCourse=copy(m.course);}
  }
  if(m){s.lastMeasuredTick=m.tick;s.lastMeasurement=m;}
  s.heldSince=m?.held?(state.heldSince??t):null;
  let target=m?.target??state.target,aimWeight=0;
  const decision=d.predictionMadeAtElapsedSeconds??.14,contact=(d.referenceContactTick-c.origin)/c.tps,
   through=(d.referenceThroughTick-c.origin)/c.tps,
   offense=c.record.beforeMatch?.half==='top'?0:1,bunt=c.record.command?.managedTeam===offense&&c.record.command?.batting==='bunt';
  if(t>=decision+c.delay&&d.swingOffered===true&&!bunt&&Number.isFinite(contact)&&Number.isFinite(through)){
   // Commit the available motor intention sooner, then settle on it. The
   // short acquisition has a firmer stop than a long floating crossfade.
   const start=Math.max(decision+c.delay,contact-.23),ready=Math.max(start+.065,contact-.09);
   aimWeight=ease((t-start)/(ready-start))*(1-ease((t-through)/.18));
   if(aimWeight>0){
    // This is the registered motor intention, only available after decision;
    // never the eventual actual collision or the future path of the hit.
    const forecast=d.zoneJudgment?.observedForecastPosition,error=d.aimErrorMeters;
    if(finite(forecast)&&finite(error)){
     const aim={x:forecast.x+error.x,y:forecast.y+error.y,z:forecast.z+error.z};
     target=target?mix(target,aim,aimWeight):aim;
    }else aimWeight=0;
   }
  }
  s.aimWeight=aimWeight;s.target=target;
  s.phase=aimWeight>0?(t<=through?'swing-aim':'aim-release'):m?.kind==='batted'||m?.kind==='throw'?'batted-tracking':m?.held?'held-gaze':'incoming';
  const latest=c.record.frames[indexAt(c.record.frames,Math.min(cap,c.origin+t*c.tps))];
  if(latest?.homeRunConfirmed){
   const actor=actorAt(latest,c.id),v=actor?.velocity;
   if(finite(v)&&Math.hypot(v.x,v.z)>.05){target={x:eye.x+v.x*10,y:eye.y-.2,z:eye.z+v.z*10};s.target=target;s.phase='home-run-forward';}
  }
  const takeWeight=t>=decision+c.delay&&d.swingOffered===false&&!bunt&&m?.kind==='pitch'&&aimWeight===0
    ?ease((t-decision-c.delay)/.032):0,taking=takeWeight>0,
   braceWeight=aimWeight>0?aimWeight*(1-ease((t-through)/.04)):0,bracing=braceWeight>0;
  let yaw=c.base.yaw,pitch=c.base.pitch;
  if(target){yaw=Math.atan2(target.x-eye.x,target.z-eye.z);pitch=clamp(-Math.atan2(target.y-eye.y,Math.max(.05,Math.hypot(target.x-eye.x,target.z-eye.z))),-1.25,1.25);}
  if(taking&&target){
   // Stop pursuing the pitch before it reaches the face/mitt. The stop point
   // is captured only from the observed prefix, never the future catch.
   if(!state.takeStopTarget&&target.z<=3.5)s.takeStopTarget={...target,z:3.5};
   target=state.takeStopTarget??s.takeStopTarget??target;s.target=target;
  }
  if(taking){
   // Let the pitch leave the useful forward view. Following a hidden mitt at
   // arm's length would turn a modest eye movement into a deep head bow.
   const stopYaw=target?Math.atan2(target.x-eye.x,target.z-eye.z):yaw,
    stopPitch=target?-Math.atan2(target.y-eye.y,Math.max(.05,Math.hypot(target.x-eye.x,target.z-eye.z))):pitch,
    limitedYaw=c.base.yaw+clamp(angleDelta(stopYaw-c.base.yaw),-.38,.38);
   pitch+=(clamp(stopPitch,-.22,.30)-pitch)*takeWeight;
   yaw+=angleDelta(limitedYaw-yaw)*takeWeight;
  }
  if(m?.held&&m.kind==='pitch'&&aimWeight===0&&s.heldSince!==null){
   const returning=ease((t-s.heldSince-.30)/.40);
   yaw+=angleDelta(c.base.yaw-yaw)*returning;pitch+=(c.base.pitch-pitch)*returning;
   if(returning>0)s.phase='return-ready';
  }
  const omega=12/(1+2*c.std)/(1+.65*s.surprise);
  let ay,ap;
  if(taking||bracing){
   const ey=angleDelta(yaw-state.yaw),ep=pitch-state.pitch,error=Math.hypot(ey,ep),
    gain=(bracing?32:24)/(1+2*c.std)/(1+.65*s.surprise),
    // Stopping-distance speed prevents chasing the final near-body sample
    // with residual momentum. Acceleration remains bounded in one eye state;
    // no pose snap, random shake, quantization or second camera is introduced.
    speed=Math.min(MAX_SPEED,gain*error,Math.sqrt(2*MAX_ACCELERATION*.65*error)),
    desiredY=error>0?ey/error*speed:0,desiredP=error>0?ep/error*speed:0;
   const weight=taking?takeWeight:braceWeight,
    oldY=omega*omega*ey-2*omega*state.vy,oldP=omega*omega*ep-2*omega*state.vp;
   [ay,ap]=limit(oldY+((desiredY-state.vy)/.024-oldY)*weight,oldP+((desiredP-state.vp)/.024-oldP)*weight,MAX_ACCELERATION);
  }else{
   // Preserve the existing batted-ball / runner tracking law and eye motion.
   [ay,ap]=limit(omega*omega*angleDelta(yaw-state.yaw)-2*omega*state.vy,omega*omega*(pitch-state.pitch)-2*omega*state.vp,MAX_ACCELERATION);
  }
  const [vy,vp]=limit(state.vy+ay*dt,state.vp+ap*dt,MAX_SPEED);
  s.yaw=state.yaw+(state.vy+vy)*dt/2;s.pitch=state.pitch+(state.vp+vp)*dt/2;s.vy=vy;s.vp=vp;
  s.regulation={mode:bracing?'swing-brace':taking?'take-brake':'field-follow',targetYaw:yaw,targetPitch:pitch};
  s.trackingErrorRadians=Math.hypot(angleDelta(yaw-s.yaw),pitch-s.pitch);
  return s;
 }
 function observe({record,frame,sceneMs,preparationMs,batter,previousRecord=null}){
  const base=baseFor(batter),model={sensorDelaySeconds:.075,angularSpeedLimitRadPerSecond:MAX_SPEED,
   angularAccelerationLimitRadPerSecond2:MAX_ACCELERATION,abilityBasis:'EXISTING_ZONE_JUDGMENT_UNCERTAINTY_PROVISIONAL_PRESENTATION_POLICY'};
  if(!record||!frame||sceneMs<=preparationMs||!record.frames?.length)return {...base,phase:'ready',aimWeight:0,surprise:0,trackingErrorRadians:0,model};
  let c=caches.get(record);
  const std=clamp(batter?.physical?.zoneJudgmentStdMeters??record.play?.diagnostics?.individualControls?.zoneJudgmentStdMeters??.025,0,.6);
  if(!c||c.std!==std||c.previous!==previousRecord||c.height!==(batter?.height??batter?.heightMeters)||c.hand!==(batter?.hand??batter?.bats)){
   c=create(record,batter,previousRecord);caches.delete(record);caches.set(record,c);if(caches.size>4)caches.delete(caches.keys().next().value);
  }
  const t=Math.max(0,(sceneMs-preparationMs)/1000),whole=Math.floor(t/STEP),cap=frame.tick;
  if(c.lastCap!==undefined&&c.lastCap!==cap){
   const unchangedThrough=Math.max(0,(Math.min(c.lastCap,cap)-c.origin)/c.tps);
   c.states.length=Math.min(c.states.length,Math.floor(unchangedThrough/STEP)+1);
  }
  c.lastCap=cap;
  while(c.states.length<=whole){const i=c.states.length;c.states.push(advance(c,c.states[i-1],i*STEP,cap));}
  let state=c.states[whole];if(t>state.t)state=advance(c,state,t,cap);
  model.sensorDelaySeconds=c.delay;
  return {...c.base,eye:copy(state.eye),yaw:state.yaw,pitch:state.pitch,phase:frame.phase==='bench'?'bench':state.phase,
   aimWeight:state.aimWeight,surprise:state.surprise,trackingErrorRadians:state.trackingErrorRadians??0,regulation:state.regulation??null,model};
 }
 root.KneekuraContinuousBatterView=Object.freeze({version:1,observe});
})(typeof globalThis==='object'?globalThis:this);
