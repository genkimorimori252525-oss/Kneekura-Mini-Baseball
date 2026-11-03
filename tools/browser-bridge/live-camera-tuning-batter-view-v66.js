/* v66: independent swing response settles before runner/field tracking.
 * The head response is authored presentation, not measured head biomechanics. */
/* One embodied observer. This authored reduced-order eye/head controller is
 * read-only, not a calibrated neural model or an authority for batting results.
 * All measurements are from the available Source prefix. */
(function(root){
 'use strict';
 const defaults=Object.freeze({enabled:true,aimLiftMeters:.30,swingMaxDownRadians:.20,hitFollowDelayMs:300,aimReleaseMs:70,pitchTrackingGain:.26,pitchTrackingDeadbandRadians:.02,impactStabilizeOffsetMs:0,impactMaxMotionRadians:.04,impactMaxSpeedRadPerSecond:.35,swingUsesAbsoluteVision:false,swingHeadCoupling:.025});
 const ranges=Object.freeze({aimLiftMeters:[0,.8],swingMaxDownRadians:[.1,1.25],hitFollowDelayMs:[0,600],aimReleaseMs:[20,400],pitchTrackingGain:[0,1],pitchTrackingDeadbandRadians:[0,.15],impactStabilizeOffsetMs:[-250,150],impactMaxMotionRadians:[0,.15],impactMaxSpeedRadPerSecond:[0,1.5],swingHeadCoupling:[0,.08]});
 function normalizeSettings(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('camera tuning: settings object required');
  const prototype=Object.getPrototypeOf(input);
  if(prototype!==null&&Object.getPrototypeOf(prototype)!==null)throw new Error('camera tuning: plain settings object required');
  const supplied={};
  for(const key of Reflect.ownKeys(input)){
   if(typeof key!=='string'||!Object.hasOwn(defaults,key))throw new Error('camera tuning: unknown setting '+String(key));
   const descriptor=Object.getOwnPropertyDescriptor(input,key);
   if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)throw new Error('camera tuning: enumerable data setting required '+key);
   supplied[key]=descriptor.value;
  }
  const normalized={};
  for(const key of Object.keys(defaults)){
   const value=Object.hasOwn(supplied,key)?supplied[key]:defaults[key];
   if(key==='enabled'||key==='swingUsesAbsoluteVision'){if(typeof value!=='boolean')throw new Error('camera tuning: '+key+' must be boolean');}
   else if(!Number.isFinite(value)||value<ranges[key][0]||value>ranges[key][1])throw new Error('camera tuning: out of range '+key);
   normalized[key]=value;
  }
  return Object.freeze(normalized);
 }
 function absoluteVisionFor(batter,d){
  const physical=batter?.physical??{},controls=d?.individualControls??{};
  if(Number.isFinite(physical.plateVision))return Math.max(1,Math.min(100,physical.plateVision));
  if(Number.isFinite(controls.plateVision))return Math.max(1,Math.min(100,controls.plateVision));
  const zone=Number.isFinite(physical.zoneJudgmentStdMeters)?physical.zoneJudgmentStdMeters:
   Number.isFinite(controls.zoneJudgmentStdMeters)?controls.zoneJudgmentStdMeters:.025;
  return zone<=0?100:Math.max(1,Math.min(100,45-100*Math.log(zone/.025)));
 }
 function trackingFor(settings,vision,useAbsoluteVision=settings.swingUsesAbsoluteVision){
  if(!settings.enabled||!useAbsoluteVision)return {gain:settings.pitchTrackingGain,deadbandRadians:settings.pitchTrackingDeadbandRadians};
  const weight=vision>=45?(vision-45)/55:(vision-1)/44,
   base=Math.min(.70,settings.pitchTrackingGain);
  return vision>=45?{gain:base+(.70-base)*weight,deadbandRadians:settings.pitchTrackingDeadbandRadians*(1-weight)}:
   {gain:base*(.5+.5*weight),deadbandRadians:settings.pitchTrackingDeadbandRadians*(2-weight)};
 }
 function pitchTrackingFor(base,settings,vision){return {rawErrorRadians:null,headTargetErrorRadians:null,
  ...trackingFor(settings,vision),absolutePlateVision:vision,baselinePlateVision:45,
  configuredGain:settings.pitchTrackingGain,configuredDeadbandRadians:settings.pitchTrackingDeadbandRadians,
  anchorYaw:base.yaw,anchorPitch:base.pitch,applied:false};}
 function createController(initialSettings={}){
 let settings=normalizeSettings(initialSettings);
 const caches=new Map(),STEP=.008,MAX_SPEED=2.5,MAX_ACCELERATION=20;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const finite=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
 const copy=p=>({x:p.x,y:p.y,z:p.z});
 const length=p=>Math.hypot(p.x,p.y,p.z);
 const ease=x=>{x=clamp(x,0,1);return x*x*x*(10+x*(-15+6*x));};
 const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
 const angleDelta=a=>Math.atan2(Math.sin(a),Math.cos(a));
 const limit=(x,y,bound)=>{const n=Math.hypot(x,y);return n>bound?[x*bound/n,y*bound/n]:[x,y];};
 // Existing meet/vision SI, not a new rating or a calibrated eye model.
 // Even the best authored profile retains finite slack; low skill can still
 // pursue broad ball motion. This policy affects incoming pitch gaze only.
 function pursuitFor(batter,d,useAbsoluteVision=settings.swingUsesAbsoluteVision){
  const controls=d?.individualControls??{},p=batter?.physical??{},value=(key,fallback)=>
   Number.isFinite(p[key])?Math.max(0,p[key]):Number.isFinite(controls[key])?Math.max(0,controls[key]):fallback,
   aim=value('aimStdMeters',.04),timing=value('timingStdSeconds',.012),zone=value('zoneJudgmentStdMeters',.025),
   contactQuality=(1/(1+aim/.04)+1/(1+timing/.012))/2,
   // The new vision gain is applied once, above. Keep the inherited meet
   // pursuit finite, calibrated to the old grade-45 default rather than
   // multiplying a second variable vision gain into the same objective.
   visionQuality=1/(1+(settings.enabled&&useAbsoluteVision ? .025 : zone)/.045),
   quality=clamp((contactQuality+visionQuality)/2,0,1);
  return {contactQuality,visionQuality,gain:.55+.37*quality,deadband:.006+.020*(1-quality)};
 }
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
 function createRecord(record,batter,previous){
  const d=record.play?.diagnostics??{},base=baseFor(batter),tps=d.sourceClockTicksPerSecond??1e6,
   origin=record.frames[0].tick,std=clamp(batter?.physical?.zoneJudgmentStdMeters??d.individualControls?.zoneJudgmentStdMeters??.025,0,.6),
   delay=.060+Math.min(.060,std*.6),id=record.batterPlayerId??batter?.playerId,
   initial=actorAt(record.beforeFrame,id)??actorAt(record.frames[0],id),prior=priorExpectation(record,previous);
  const initialState={t:0,eye:copy(base.eye),eyeVelocity:{x:0,y:0,z:0},yaw:base.yaw,pitch:base.pitch,vy:0,vp:0,surprise:0,heldSince:null,lastMeasuredTick:null,
   expectedSpeed:prior?.speed??null,expectedCourse:prior?.course??null,lastMeasurement:null,target:null,aimWeight:0,phase:'incoming',
   hitObservedAtSeconds:null,firstBattedTick:null,aimReleaseAtSeconds:null,aimTarget:null};
  return {record,previous,std,pursuit:pursuitFor(batter,d),absolutePursuit:pursuitFor(batter,d,true),vision:absoluteVisionFor(batter,d),height:batter?.height??batter?.heightMeters,hand:batter?.hand??batter?.bats,
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
  const frames=c.record.frames,currentIndex=indexAt(frames,Math.min(cap,c.origin+t*c.tps)),
   current=currentIndex<0?null:frames[currentIndex],offense=c.record.beforeMatch?.half==='top'?0:1,
   bunt=c.record.command?.managedTeam===offense&&c.record.command?.batting==='bunt',
   currentTake=settings.enabled&&c.d.swingOffered===false&&!bunt&&current?.ballKind==='pitch'&&t>=(c.d.predictionMadeAtElapsedSeconds??.14),
   at=Math.min(cap,c.origin+Math.max(0,currentTake?t:t-c.delay)*c.tps),index=indexAt(frames,at);
  // Even the release observation is unavailable until its sensory delay.
  if((!currentTake&&t<c.delay)||index<0)return null;
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
  const age=held?0:clamp(t-(f.tick-c.origin)/c.tps,0,currentTake ? .055 : .14),p=ball.position,
   target={x:p.x+velocity.x*age+acceleration.x*age*age/2,y:p.y+velocity.y*age+acceleration.y*age*age/2,z:p.z+velocity.z*age+acceleration.z*age*age/2};
  if(f.ballKind==='pitch')target.z=Math.max(-.42,target.z);
  const toPlate=velocity.z<-.1?clamp((.15-p.z)/velocity.z,0,.8):0,
   course={x:p.x+velocity.x*toPlate+acceleration.x*toPlate*toPlate/2,y:p.y+velocity.y*toPlate+acceleration.y*toPlate*toPlate/2,z:.15};
  return {tick:f.tick,target,kind:f.ballKind,velocity,course,held,
   basis:currentTake?'CURRENT_OBSERVED_PITCH_PREFIX':'DELAYED_OBSERVED_PREFIX'};
 }
 function observeSwingBat(c,state,t,cap){
  const d=c.d,offense=c.record.beforeMatch?.half==='top'?0:1,
   start=(d.referenceStartTick-c.origin)/c.tps,decision=d.predictionMadeAtElapsedSeconds??.14;
  if(!settings.enabled||settings.swingHeadCoupling===0||d.swingOffered!==true
   ||c.record.command?.managedTeam===offense&&c.record.command?.batting==='bunt'||t<Math.max(start,decision))return null;
  const previous=state.swingBatMotion;
  let index=indexAt(c.record.frames,Math.min(cap,c.origin+t*c.tps));
  while(index>=0&&!c.record.frames[index].bat)index--;
  if(index<0)return previous??null;
  const frame=c.record.frames[index],bat=frame.bat;
  if(!finite(bat?.grip)||!finite(bat?.tip))return previous??null;
  const axis={x:bat.tip.x-bat.grip.x,y:bat.tip.y-bat.grip.y,z:bat.tip.z-bat.grip.z},n=length(axis);
  if(n<1e-8)return previous??null;
  for(const k of ['x','y','z'])axis[k]/=n;
  let yawSweep=previous?.yawSweep??0,pitchSweep=previous?.pitchSweep??0;
  if(previous&&frame.tick>previous.observedTick){
   const a=previous.axis,cross={x:a.y*axis.z-a.z*axis.y,y:a.z*axis.x-a.x*axis.z,z:a.x*axis.y-a.y*axis.x},
    sin=length(cross),cos=clamp(a.x*axis.x+a.y*axis.y+a.z*axis.z,-1,1);
   // Integrate the shortest observed rotation, avoiding azimuth singularities
   // for an upright bat. An ambiguous exact half-turn contributes no guess.
   if(sin>1e-8){const scale=Math.atan2(sin,cos)/sin;
    yawSweep+=cross.y*scale;pitchSweep+=(cross.x*Math.cos(c.base.yaw)-cross.z*Math.sin(c.base.yaw))*scale;}
  }
  const weight=ease((t-Math.max(start,decision))/.04),
   [yawOffset,pitchOffset]=limit(yawSweep*settings.swingHeadCoupling*weight,pitchSweep*settings.swingHeadCoupling*.35*weight,
    Math.min(.06,settings.impactMaxMotionRadians));
  return {axis,observedTick:frame.tick,yawSweep,pitchSweep,yawOffset,pitchOffset,
   basis:'CURRENT_OBSERVED_RIGID_BAT_AXIS_ROTATION',measuredHeadMotion:false};
 }
 // The bat response is a small angular displacement of the same embodied
 // eye. It never enters the base gaze motor or changes its body/runner clock.
 function swingResponse(c,state,t,motion){
  const zero={yaw:0,pitch:0,vy:0,vp:0,phase:'inactive'},
   through=(c.d.referenceThroughTick-c.origin)/c.tps;
  if(!settings.enabled||settings.swingHeadCoupling===0||!motion||!Number.isFinite(through))return zero;
  const previous=state.swingHeadResponse??zero,dt=t-state.t;
  if(t>through){
   const stop=previous.stop??{atSeconds:through,yaw:previous.yaw,pitch:previous.pitch,vy:previous.vy,vp:previous.vp},
    duration=.18,u=clamp((t-stop.atSeconds)/duration,0,1);
   if(u>=1)return {...zero,phase:'settled',stop,settledAtSeconds:stop.atSeconds+duration};
   // Finite quintic settling matches angle and angular velocity at the end
   // of the registered swing; both reach zero without a lingering motor tail.
   const h=1-ease(u),g=u-6*u**3+8*u**4-3*u**5,
    dh=(-30*u**2+60*u**3-30*u**4)/duration,dg=1-18*u**2+32*u**3-15*u**4;
   return {yaw:stop.yaw*h+stop.vy*duration*g,pitch:stop.pitch*h+stop.vp*duration*g,
    vy:stop.yaw*dh+stop.vy*dg,vp:stop.pitch*dh+stop.vp*dg,phase:'settling',stop,settledAtSeconds:stop.atSeconds+duration};
  }
  const [ay,ap]=limit(400*(motion.yawOffset-previous.yaw)-40*previous.vy,
   400*(motion.pitchOffset-previous.pitch)-40*previous.vp,4),
   [vy,vp]=limit(previous.vy+ay*dt,previous.vp+ap*dt,settings.impactMaxSpeedRadPerSecond),
   [yaw,pitch]=limit(previous.yaw+(previous.vy+vy)*dt/2,previous.pitch+(previous.vp+vp)*dt/2,
    Math.min(.06,settings.impactMaxMotionRadians));
  return {yaw,pitch,vy,vp,phase:'swing'};
 }
 function advanceFree(c,state,t,cap){
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
  // Latch only the first batted measurement actually admitted by the delayed
  // available prefix. Its Source stamp plus sensory delay gives one onset,
  // including partial integration queries; future contact/results cannot arm it.
  if(settings.enabled&&m?.kind==='batted'&&s.hitObservedAtSeconds===null){
   s.hitObservedAtSeconds=(m.tick-c.origin)/c.tps+c.delay;s.firstBattedTick=m.tick;
  }
  s.heldSince=m?.held?(state.heldSince??t):null;
  let target=m?.target??state.target,aimWeight=0;
  const decision=d.predictionMadeAtElapsedSeconds??.14,contact=(d.referenceContactTick-c.origin)/c.tps,
   through=(d.referenceThroughTick-c.origin)/c.tps,
   offense=c.record.beforeMatch?.half==='top'?0:1,bunt=c.record.command?.managedTeam===offense&&c.record.command?.batting==='bunt',
   releaseAt=settings.enabled&&d.swingOffered===true&&!bunt
    ?(state.swingHeadLock?.releaseAtSeconds??(s.hitObservedAtSeconds===null?through:Math.max(through,s.hitObservedAtSeconds+settings.hitFollowDelayMs/1000)))
    :settings.enabled&&s.hitObservedAtSeconds!==null?Math.min(through,s.hitObservedAtSeconds+settings.hitFollowDelayMs/1000):through,
   releaseDuration=settings.enabled?settings.aimReleaseMs/1000:.18;
  s.aimReleaseAtSeconds=Number.isFinite(releaseAt)?releaseAt:null;s.plannedAimThroughSeconds=Number.isFinite(through)?through:null;s.aimTarget=null;
  if(t>=(settings.enabled?decision:decision+c.delay)&&d.swingOffered===true&&!bunt&&Number.isFinite(contact)&&Number.isFinite(through)){
   // Commit the available motor intention sooner, then settle on it. The
   // short acquisition has a firmer stop than a long floating crossfade.
   const start=settings.enabled?Math.max(0,decision):Math.max(decision+c.delay,contact-.23),
    ready=settings.enabled?start+Math.min(.085,Math.max(.001,contact-start-.04)):Math.max(start+.065,contact-.09);
   aimWeight=ease((t-start)/(ready-start))*(1-ease((t-releaseAt)/releaseDuration));
   if(aimWeight>0){
    // This is the registered motor intention, only available after decision;
    // never the eventual actual collision or the future path of the hit.
    const forecast=d.zoneJudgment?.observedForecastPosition,error=d.aimErrorMeters;
    if(finite(forecast)&&finite(error)){
     const aim={x:forecast.x+error.x,y:forecast.y+error.y,z:forecast.z+error.z};
     if(settings.enabled)aim.y+=settings.aimLiftMeters;
     s.aimTarget=aim;
     target=target?mix(target,aim,aimWeight):aim;
    }else aimWeight=0;
   }
  }
  s.aimWeight=aimWeight;s.target=target;
  s.phase=aimWeight>0?(t<=releaseAt?'swing-aim':'aim-release'):m?.kind==='batted'||m?.kind==='throw'?'batted-tracking':m?.held?'held-gaze':'incoming';
  const latest=c.record.frames[indexAt(c.record.frames,Math.min(cap,c.origin+t*c.tps))];
  if(latest?.homeRunConfirmed){
   const actor=actorAt(latest,c.id),v=actor?.velocity;
   if(finite(v)&&Math.hypot(v.x,v.z)>.05){target={x:eye.x+v.x*10,y:eye.y-.2,z:eye.z+v.z*10};s.target=target;s.phase='home-run-forward';}
  }
  const takeStart=settings.enabled?decision:decision+c.delay,
   takeWeight=t>=takeStart&&d.swingOffered===false&&!bunt&&m?.kind==='pitch'&&aimWeight===0
    ?ease((t-takeStart)/.032):0,taking=takeWeight>0,
   braceWeight=aimWeight>0?aimWeight*(1-ease((t-releaseAt)/.04)):0,bracing=braceWeight>0;
  s.swingBatMotion=observeSwingBat(c,state,t,cap);
  s.swingHeadResponse=swingResponse(c,state,t,s.swingBatMotion);
  let yaw=c.base.yaw,pitch=c.base.pitch;
  if(target){yaw=Math.atan2(target.x-eye.x,target.z-eye.z);pitch=clamp(-Math.atan2(target.y-eye.y,Math.max(.05,Math.hypot(target.x-eye.x,target.z-eye.z))),-1.25,1.25);}
  // Constrain the gaze objective, not the physical camera state: instant
  // clipping of a pre-existing downward pose would create a second-eye snap.
  s.downwardTargetLimited=settings.enabled&&aimWeight>0&&pitch>settings.swingMaxDownRadians;
  if(settings.enabled&&aimWeight>0)pitch=Math.min(pitch,settings.swingMaxDownRadians);
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
  if(m?.held&&m.kind==='pitch'&&aimWeight===0&&s.heldSince!==null&&(!settings.enabled||d.swingOffered!==false||bunt)){
   const returning=ease((t-s.heldSince-.30)/.40);
   yaw+=angleDelta(c.base.yaw-yaw)*returning;pitch+=(c.base.pitch-pitch)*returning;
   if(returning>0)s.phase='return-ready';
  }
  const pitchTracking=pitchTrackingFor(c.base,settings,c.vision),
   takeVisionWeight=settings.enabled&&!settings.swingUsesAbsoluteVision&&taking?takeWeight:0;
  if(takeVisionWeight>0){const absolute=trackingFor(settings,c.vision,true);
   for(const key of ['gain','deadbandRadians'])pitchTracking[key]+= (absolute[key]-pitchTracking[key])*takeVisionWeight;
  }
  pitchTracking.swingUsesAbsoluteVision=settings.swingUsesAbsoluteVision;
  pitchTracking.takeVisionWeight=takeVisionWeight;
  if(m?.kind==='pitch'&&(!m.held||settings.enabled&&taking)&&aimWeight<1){
   // Compress the original desired angle around the fixed stance, not around
   // the last eye state. A constant ball angle therefore cannot creep toward
   // full tracking over time. Preserve the old take limits and meet/vision
   // pursuit below. Let the compression fade continuously as the swing aim
   // acquires/releases; an aimWeight===0 gate would jump at fractional times.
   // Full swing aim and field objectives retain their original target law.
   const ey=angleDelta(yaw-c.base.yaw),ep=pitch-c.base.pitch,raw=Math.hypot(ey,ep),
    reduced=pitchTracking.gain*Math.max(0,raw-pitchTracking.deadbandRadians),
    headError=reduced+(raw-reduced)*aimWeight,factor=raw>0?headError/raw:0;
   Object.assign(pitchTracking,{rawErrorRadians:raw,headTargetErrorRadians:headError,applied:true});
   // Bypass the identity arithmetic, including its possible last-bit rounding,
   // so the old v55 view remains byte-for-byte equal at gain 1 / band 0.
   if(pitchTracking.gain!==1||pitchTracking.deadbandRadians!==0){
    yaw=c.base.yaw+ey*factor;pitch=c.base.pitch+ep*factor;
   }
  }
  s.pitchTracking=pitchTracking;
  let pitchPursuit=null;
  const legacyTracking=pitchTracking.gain===1&&pitchTracking.deadbandRadians===0,
   pursuitWeight=legacyTracking?(bracing?0:1):1-braceWeight;
  if(m?.kind==='pitch'&&!m.held&&pursuitWeight>0&&target){
   const ey=angleDelta(yaw-state.yaw),ep=pitch-state.pitch,rawError=Math.hypot(ey,ep),
    gain=takeVisionWeight>0?c.pursuit.gain+(c.absolutePursuit.gain-c.pursuit.gain)*takeVisionWeight:c.pursuit.gain,
    deadband=takeVisionWeight>0?c.pursuit.deadband+(c.absolutePursuit.deadband-c.pursuit.deadband)*takeVisionWeight:c.pursuit.deadband,
    relaxedError=gain*Math.max(0,rawError-deadband),factor=rawError>0?relaxedError/rawError:0;
   // The inherited controller switches this slack off at bracing>0. With
   // the new compressed incoming objective that binary switch would expose
   // a fractional-time jump. Fade only the slack, preserving its SI values,
   // and keep the old arithmetic/branch exactly for the identity preset.
   if(legacyTracking){yaw=state.yaw+ey*factor;pitch=state.pitch+ep*factor;}
   else{yaw+=ey*(factor-1)*pursuitWeight;pitch+=ep*(factor-1)*pursuitWeight;}
   pitchPursuit={rawErrorRadians:rawError,relaxedErrorRadians:relaxedError,
    gain,deadbandRadians:deadband};
  }
  // Once the held head is released, blend only its angular objective into
  // the existing field-follow motor. Its eye/body and speed limits persist.
  const headLock=state.swingHeadLock,stabilizing=settings.enabled&&headLock&&(headLock.releaseAtSeconds===null||t<=headLock.releaseAtSeconds);
  if(stabilizing){
   const [ey,ep]=limit(angleDelta(yaw-headLock.yaw),pitch-headLock.pitch,settings.impactMaxMotionRadians);
   yaw=headLock.yaw+ey;pitch=headLock.pitch+ep;
  }else if(settings.enabled&&Number.isFinite(headLock?.releaseAtSeconds)&&t>headLock.releaseAtSeconds){
   const blend=ease((t-headLock.releaseAtSeconds)/(settings.aimReleaseMs/1000));
   const releaseYaw=headLock.releaseYaw??headLock.yaw,releasePitch=headLock.releasePitch??headLock.pitch;
   yaw=releaseYaw+angleDelta(yaw-releaseYaw)*blend;
   pitch=releasePitch+(pitch-releasePitch)*blend;
  }
  const omega=12/(1+2*c.std)/(1+.65*s.surprise);
  let ay,ap;
  if(stabilizing){
   [ay,ap]=limit(400*angleDelta(yaw-state.yaw)-40*state.vy,400*(pitch-state.pitch)-40*state.vp,4);
  }else if(taking||bracing){
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
  let [vy,vp]=limit(state.vy+ay*dt,state.vp+ap*dt,stabilizing?settings.impactMaxSpeedRadPerSecond:MAX_SPEED);
  s.yaw=state.yaw+(state.vy+vy)*dt/2;s.pitch=state.pitch+(state.vp+vp)*dt/2;s.vy=vy;s.vp=vp;
  if(stabilizing){
   if(settings.impactMaxMotionRadians===0||settings.impactMaxSpeedRadPerSecond===0){s.yaw=headLock.yaw;s.pitch=headLock.pitch;s.vy=0;s.vp=0;}
   const ey=angleDelta(s.yaw-headLock.yaw),ep=s.pitch-headLock.pitch,n=Math.hypot(ey,ep);
   if(n>settings.impactMaxMotionRadians){
    const [cy,cp]=limit(ey,ep,settings.impactMaxMotionRadians);s.yaw=headLock.yaw+cy;s.pitch=headLock.pitch+cp;
    const outward=(vy*ey+vp*ep)/n;if(outward>0){s.vy=vy-outward*ey/n;s.vp=vp-outward*ep/n;}
   }
  }
  s.regulation={mode:stabilizing?'impact-stabilize':bracing?'swing-brace':taking?'take-brake':'field-follow',targetYaw:yaw,targetPitch:pitch,pitchPursuit,
   measurementBasis:m?.basis??null,measurementTick:m?.tick??null,takeStopTarget:s.takeStopTarget??null};
  s.trackingErrorRadians=Math.hypot(angleDelta(yaw-s.yaw),pitch-s.pitch);
  return s;
 }
 function swingWindow(c){
  const d=c.d,offense=c.record.beforeMatch?.half==='top'?0:1,
   bunt=c.record.command?.managedTeam===offense&&c.record.command?.batting==='bunt';
  if(!settings.enabled||d.swingOffered!==true||bunt)return null;
  const expectedImpactSeconds=(d.referenceContactTick-c.origin)/c.tps,throughSeconds=(d.referenceThroughTick-c.origin)/c.tps,
   motorStartSeconds=(d.referenceStartTick-c.origin)/c.tps,decisionSeconds=Math.max(0,d.predictionMadeAtElapsedSeconds??.14),
   requestedStartSeconds=expectedImpactSeconds+settings.impactStabilizeOffsetMs/1000,
   startSeconds=Math.max(decisionSeconds,Math.min(throughSeconds,requestedStartSeconds));
  return Number.isFinite(startSeconds)&&startSeconds>=0&&Number.isFinite(throughSeconds)&&throughSeconds>=startSeconds
   ?{startSeconds,throughSeconds,motorStartSeconds,expectedImpactSeconds,requestedStartSeconds,basis:'REGISTERED_EXPECTED_IMPACT'}:null;
 }
 function advance(c,state,t,cap){
  if(settings.enabled&&c.d.swingOffered===false){
   const offense=c.record.beforeMatch?.half==='top'?0:1,
    bunt=c.record.command?.managedTeam===offense&&c.record.command?.batting==='bunt';
   if(!bunt){
    let lock=state.takeCatchLock;
    if(!lock){
     const frames=c.record.frames,index=indexAt(frames,Math.min(cap,c.origin+t*c.tps)),latest=frames[index],
      held=f=>f?.ballKind==='pitch'&&(!!f.possessedBy||f.ball?.visible===false);
     if(held(latest)){
      // Read only the already available prefix. Resolve the actual first
      // captured sample, without secureTick/contact/result look-ahead.
      let first=index;while(first>0&&held(frames[first-1]))first--;
      const caughtAtSeconds=Math.max(0,(frames[first].tick-c.origin)/c.tps),
       onset=state.t<caughtAtSeconds?advanceFree(c,state,caughtAtSeconds,cap):state;
      lock={caughtAtSeconds,caughtTick:frames[first].tick,yaw:onset.yaw,pitch:onset.pitch};
      state={...onset,takeCatchLock:lock,vy:0,vp:0};
     }
    }
    if(lock){
     const settled=advanceFree(c,state,t,cap);
     settled.yaw=lock.yaw;settled.pitch=lock.pitch;settled.vy=0;settled.vp=0;settled.takeCatchLock=lock;
     settled.phase='take-caught';settled.regulation={...settled.regulation,mode:'take-caught',targetYaw:lock.yaw,targetPitch:lock.pitch};
     settled.trackingErrorRadians=0;
     return settled;
    }
   }
  }
  const window=swingWindow(c);if(!window||t<window.startSeconds)return advanceFree(c,state,t,cap);
  if(!state.swingHeadLock){
   // The intended contact clock belongs to the registered motor plan, not
   // a future collision. Acquire its point before settling at this instant.
   const onset=state.t<window.startSeconds?advanceFree(c,state,window.startSeconds,cap):state;
   const latched={...onset,vy:0,vp:0,
    swingHeadLock:{...window,yaw:onset.yaw,pitch:onset.pitch,releaseAtSeconds:null,
     batYawOffset:onset.swingBatMotion?.yawOffset??0,batPitchOffset:onset.swingBatMotion?.pitchOffset??0}};
   return advance(c,latched,t,cap);
  }
  const lock=state.swingHeadLock;
  if(state.t<lock.throughSeconds&&t>lock.throughSeconds){
   return advance(c,advance(c,state,lock.throughSeconds,cap),t,cap);
  }
  let s=advanceFree(c,state,t,cap),releaseAt=lock.releaseAtSeconds;
  const candidate=s.hitObservedAtSeconds===null?lock.throughSeconds:
   Math.max(lock.throughSeconds,s.hitObservedAtSeconds+settings.hitFollowDelayMs/1000);
  if(releaseAt===null&&t>=candidate){
   if(state.t<candidate&&t>candidate)return advance(c,advance(c,state,candidate,cap),t,cap);
   releaseAt=candidate;
  }
  const active=releaseAt===null||t<=releaseAt,releasing=!active&&t<releaseAt+settings.aimReleaseMs/1000;
  s.swingHeadLock={...lock,releaseAtSeconds:releaseAt,active,releasing,
   ...(releaseAt!==null&&lock.releaseAtSeconds===null?{releaseYaw:lock.yaw,releasePitch:lock.pitch}:{})};
  s.aimReleaseAtSeconds=releaseAt??candidate;s.plannedAimThroughSeconds=lock.throughSeconds;
  if(active){
   // Stabilize around the impact pose while retaining small real corrections
   // from the intended point and embodied eye; no authored random shake.
   s.aimWeight=1;s.phase='swing-impact-stabilize';
  }else if(releasing){s.phase='aim-release';s.aimWeight=1-ease((t-releaseAt)/(settings.aimReleaseMs/1000));}
  return s;
 }
 function observe({record,frame,sceneMs,preparationMs,batter,previousRecord=null}){
  const base=baseFor(batter),pursuit=pursuitFor(batter,record?.play?.diagnostics),vision=absoluteVisionFor(batter,record?.play?.diagnostics),
   effectiveTracking=trackingFor(settings,vision),model={sensorDelaySeconds:.075,angularSpeedLimitRadPerSecond:MAX_SPEED,
   angularAccelerationLimitRadPerSecond2:MAX_ACCELERATION,abilityBasis:settings.enabled?(settings.swingUsesAbsoluteVision?'ABSOLUTE_PLATE_VISION_1_100_AND_EXISTING_MEET_PURSUIT':'V59_SWING_AND_POST_DECISION_ABSOLUTE_TAKE'):'EXISTING_MEET_AND_VISION_SI_BOUNDED_PITCH_PURSUIT_V52',
    pitchTrackingGain:pursuit.gain,pitchTrackingDeadbandRadians:pursuit.deadband,
    contactQuality:pursuit.contactQuality,visionQuality:pursuit.visionQuality,absolutePlateVision:vision,
    pitchTracking:{...effectiveTracking,absolutePlateVision:vision,baselinePlateVision:45},
    swingHeadCoupling:{gain:settings.swingHeadCoupling,basis:'CURRENT_OBSERVED_RIGID_BAT_AXIS_ROTATION',measuredHeadMotion:false,composition:'INDEPENDENT_ANGULAR_RESPONSE_NO_GAZE_MOTOR_FEEDBACK',settleAfterThroughMs:180},
    impactStabilization:{basis:'REGISTERED_EXPECTED_IMPACT',offsetMs:settings.impactStabilizeOffsetMs,angleConeRadians:settings.impactMaxMotionRadians,speedLimitRadPerSecond:settings.impactMaxSpeedRadPerSecond}};
  if(!record||!frame||sceneMs<=preparationMs||!record.frames?.length)return {...base,phase:'ready',aimWeight:0,surprise:0,trackingErrorRadians:0,model,
   tuning:{settings,hitObservedAtSeconds:null,firstBattedTick:null,aimReleaseAtSeconds:null,plannedAimThroughSeconds:null,aimTarget:null,downwardTargetLimited:false,pitchTracking:pitchTrackingFor(base,settings,vision)}};
  let c=caches.get(record);
  const std=clamp(batter?.physical?.zoneJudgmentStdMeters??record.play?.diagnostics?.individualControls?.zoneJudgmentStdMeters??.025,0,.6);
  if(!c||c.vision!==vision||c.pursuit.gain!==pursuit.gain||c.pursuit.deadband!==pursuit.deadband||c.std!==std||c.previous!==previousRecord||c.height!==(batter?.height??batter?.heightMeters)||c.hand!==(batter?.hand??batter?.bats)){
   c=createRecord(record,batter,previousRecord);caches.delete(record);caches.set(record,c);if(caches.size>4)caches.delete(caches.keys().next().value);
  }
  let t=Math.max(0,(sceneMs-preparationMs)/1000);
  // A marker's registered motor timestamp must round-trip exactly. Adding
  // preparation milliseconds and dividing back can otherwise lose one ULP.
  // Match the encoded presentation instant, with no tolerance/Source shift.
  const window=swingWindow(c);
  if(window)for(const seconds of [...[c.d.referenceStartTick,c.d.referenceContactTick,c.d.referenceThroughTick].map(tick=>(tick-c.origin)/c.tps),window.startSeconds]){
   if(Number.isFinite(seconds)&&sceneMs===preparationMs+seconds*1000){t=seconds;break;}
  }
  if(settings.enabled&&c.d.swingOffered===false&&frame.ballKind==='pitch'&&(frame.possessedBy||frame.ball?.visible===false)){
   const seconds=(frame.tick-c.origin)/c.tps;
   if(sceneMs===preparationMs+seconds*1000)t=seconds;
  }
  const whole=Math.floor(t/STEP),cap=frame.tick;
  if(c.lastCap!==undefined&&c.lastCap!==cap){
   const unchangedThrough=Math.max(0,(Math.min(c.lastCap,cap)-c.origin)/c.tps);
   c.states.length=Math.min(c.states.length,Math.floor(unchangedThrough/STEP)+1);
  }
  c.lastCap=cap;
  while(c.states.length<=whole){const i=c.states.length;c.states.push(advance(c,c.states[i-1],i*STEP,cap));}
  let state=c.states[whole];if(t>state.t)state=advance(c,state,t,cap);
  model.sensorDelaySeconds=c.delay;
  if(state.pitchTracking)model.pitchTracking={...model.pitchTracking,...state.pitchTracking};
  return {...c.base,eye:copy(state.eye),yaw:state.yaw+(state.swingHeadResponse?.yaw??0),pitch:state.pitch+(state.swingHeadResponse?.pitch??0),phase:frame.phase==='bench'?'bench':state.phase,
   aimWeight:state.aimWeight,surprise:state.surprise,trackingErrorRadians:state.trackingErrorRadians??0,regulation:state.regulation??null,model,
   tuning:{settings,hitObservedAtSeconds:state.hitObservedAtSeconds,firstBattedTick:state.firstBattedTick,aimReleaseAtSeconds:state.aimReleaseAtSeconds,
    plannedAimThroughSeconds:state.plannedAimThroughSeconds??null,aimTarget:state.aimTarget,downwardTargetLimited:state.downwardTargetLimited??false,
    pitchTracking:state.pitchTracking??pitchTrackingFor(c.base,settings,vision),swingBatMotion:state.swingBatMotion??null,swingHeadResponse:state.swingHeadResponse??null,swingHeadLock:state.swingHeadLock??null,takeCatchLock:state.takeCatchLock??null}};
 }
 function configure(patch={}){
  // Validate the patch on its own first, so unknown keys/undefined values are
  // never hidden by a merge. Existing settings survive a partial UI edit.
  const validated=normalizeSettings(patch),merged={...settings};
  for(const key of Object.keys(patch))merged[key]=validated[key];
  const next=normalizeSettings(merged);
  if(Object.keys(defaults).some(key=>next[key]!==settings[key])){settings=next;caches.clear();}
  return settings;
 }
 return Object.freeze({observe,configure,inspectSettings:()=>settings});
 }
 root.KneekuraCameraTuningBatterView=Object.freeze({version:1,defaults,normalizeSettings,create:createController});
})(typeof globalThis==='object'?globalThis:this);
