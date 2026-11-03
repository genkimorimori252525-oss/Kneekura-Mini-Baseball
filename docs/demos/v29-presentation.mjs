/** Approved v27 PNG presentation changes. Legacy match remains separate from Native.
 * Transform guards deliberately fail on an unrelated or silently changed baseline.
 * Only one legacy-engine edit exposes an already-resolved capture to observers.
 */
export const V29_CAPTURE_OBSERVER_INSERTION = `
 // Observation metadata only: this capture was already resolved by fieldSimulation.
 // No predicted arrival/catch time is promoted to secure possession.
 p.presentationEvidence=Object.freeze({capture:field?.field?Object.freeze({...field.field,
   pos:[...field.field.pos],ball:[...field.field.ball]}):null});`;

export function transformV29(source) {
  let html = source;
  const replace = (before, after) => {
    if (!html.includes(before) || html.indexOf(before) !== html.lastIndexOf(before)) {
      throw new Error('v29 source guard failed: ' + before.slice(0, 100));
    }
    html = html.replace(before, after);
  };
  const between = (start, end, replacement) => {
    const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
    if (a < 0 || b < 0) throw new Error('v29 function guard failed: ' + start);
    html = html.slice(0, a) + replacement + html.slice(b);
  };
  replace('TBD対LAD 物理・描画照合版 23', 'TBD対LAD 描画修正版 29');
  replace('TBD対LAD 守備・球道・放送改善版 23', 'TBD対LAD 描画修正版 29');

  replace('function buildActors(rec,pa,p,flight,field,outcome,targets){',
    'function buildActors(rec,pa,p,flight,field,outcome,targets){' + V29_CAPTURE_OBSERVER_INSERTION);

  const observerHelpers = `
// v29: legacy renderer observations, NOT Native adjudication or actor physics.
// Existing officialAt owns OUT; existing fieldSimulation owns capture.
function presentationCustody(p,t){
 if(p.contactLocal===null)return p.catchLocal!=null&&t>=p.catchLocal?'C':null;
 const capture=p.presentationEvidence?.capture;
 if(!capture||t<39+capture.frame)return null;
 if(!p.throwPlan)return capture.role;
 const hold=Math.max(1,Math.ceil((p.throwPlan.releaseSec-capture.time)/.055));
 const release=39+capture.frame+hold;
 const arrival=release+Math.max(1,Math.ceil((p.throwPlan.arrivalSec-p.throwPlan.releaseSec)/.055));
 return t<=release?capture.role:t>=arrival?p.throwPlan.receiver:null;
}
function presentationDeparture(p,pa,actor){
 const official=p.officialAt-p.start;
 const third=p.terminal&&pa.after?.outs>=3;
 const batterOut=p.terminal&&['K','GO','FO','SF'].includes(p.outcome);
 // FC retires its identified existing runner, not the batter.
 const forcedOut=p.outcome==='FC'&&actor.id==='RUN'+p.forcedRunnerOut;
 return third||actor.id==='BAT'&&batterOut||forcedOut?official:null;
}
function presentationActorPosition(p,pa,actor,t){
 const departure=presentationDeparture(p,pa,actor);
 if(departure==null||t<departure)return trackPosition(actor.track,t);
 // Reconstruct the accepted pre-departure track; old delayed bench animation
 // must not move the observation backward once the official result is known.
 const position=trackPosition(actor.track,departure),team=recording.players[actor.player].team;
 const dx=(team===1?34:-34)-position.x,dz=-12-position.z,length=Math.hypot(dx,dz)||1;
 const metres=Math.min(length,1.55*(t-departure)*.055);
 return {x:position.x+dx/length*metres,y:0,z:position.z+dz/length*metres};
}
function committedFieldObserver(current){
 if(!current.fair)return null;
 const capture=current.p.presentationEvidence?.capture;
 if(capture&&current.localTick>=39+capture.frame){
  const role=current.custody??capture.role;
  return current.actors.find(a=>a.id===role)??null;
 }
 // Only an existing actor physically moving toward this live ball is eligible.
 // Never select the future catcher solely from its precomputed outcome.
 const candidates=current.actors.filter(a=>!['BAT','runner','batter'].includes(a.id)&&
   !['runner','batter'].includes(a.role)&&a.running&&!a.walking);
 if(!candidates.length)return null;
 const target=current.ball?.position;
 return target?candidates.sort((a,b)=>Math.hypot(a.position.x-target.x,a.position.z-target.z)-
   Math.hypot(b.position.x-target.x,b.position.z-target.z))[0]:null;
}
function pitcherBallWatchTicks(p){
 const a=p.motion[p.contactLocal]?.[0],b=p.motion[p.contactLocal+1]?.[0];
 const speed=a&&b?Math.hypot(...a.map((n,i)=>b[i]-n))/.055:0;
 return Math.ceil(Math.min(2,Math.max(.35,70/Math.max(1,speed)))/.055);
}
function batReferenceRadius(t){
 const profile=[[0,.022],[.02,.028],[.045,.012],[.29,.010],[.35,.016],
   [.44,.020],[.51,.030],[.64,.035],[.94,.035],[.99,.032],[1,.020]];
 const i=profile.findIndex(k=>k[0]>=t),b=profile[Math.max(0,i)],a=profile[Math.max(0,i-1)];
 return a[1]+(b[1]-a[1])*(b[0]===a[0]?0:(t-a[0])/(b[0]-a[0]));
}
function presentationBat(p,batter,actors,points){
 if(!points||actors.find(a=>a.id==='BAT')?.walking)return null;
 // Legacy animationTemplates are artwork, not accepted physical body poses.
 // Attach their one rigid axis to a documented hand anchor on the same body.
 // Native source bat poses bypass this display-only legacy rig entirely.
 const body=actors.find(a=>a.id==='BAT');if(!body||body.role==='runner')return null;
 const first=p.motion[0][2],hand={x:body.position.x+(batter.hand==='R'?.22:-.22),
  y:batter.height*.60,z:body.position.z-.22};
 const delta={x:hand.x-first[0],y:hand.y-first[1],z:hand.z-first[2]};
 return {grip:{x:points[0]+delta.x,y:points[1]+delta.y,z:points[2]+delta.z},
  tip:{x:points[3]+delta.x,y:points[4]+delta.y,z:points[5]+delta.z}};
}
`;
  replace('function observe(tick){', observerHelpers + '\nfunction observe(tick){');
  replace('const position=trackPosition(a.track,localTick),previous=trackPosition(a.track,Math.max(0,localTick-1));',
    'const position=presentationActorPosition(p,pa,a,localTick),previous=presentationActorPosition(p,pa,a,Math.max(0,localTick-1));');
  replace('const walking=a.benchWalkStartLocal!=null&&localTick>=a.benchWalkStartLocal;',
    'const departure=presentationDeparture(p,pa,a);const walking=departure!=null&&localTick>=departure;');
  replace("const role=a.role==='batter'&&a.runAfter!=null&&localTick>=a.runAfter?'runner':a.role;",
    "const role=walking?'departing':a.role==='batter'&&a.runAfter!=null&&localTick>=a.runAfter?'runner':a.role;");
  replace('const ball=sample[0]?{position:', 'const custody=presentationCustody(p,localTick);const ball=!custody&&sample[0]?{position:');
  replace('const bat=sample[2]?{grip:{x:sample[2][0],y:sample[2][1],z:sample[2][2]},tip:{x:sample[2][3],y:sample[2][4],z:sample[2][5]}}:null;',
    'const bat=presentationBat(p,batter,actors,sample[2]);');
  replace("broadcast.paintBatOverlay({grip:{x:points[0],y:points[1],z:points[2]},\n     tip:{x:points[3],y:points[4],z:points[5]}},$('bat-overlay'));",
    "broadcast.paintBatOverlay(presentationBat(here,frame.batter,frame.actors,points),$('bat-overlay'));");
  // Retain retired runners while they visibly depart; old hideAfter was an
  // artificial disappearance five frames after OUT, unrelated to bench arrival.
  replace('p.actors.filter(a=>a.hideAfter==null||localTick<a.hideAfter)',
    'p.actors.filter(a=>a.hideAfter==null||localTick<a.hideAfter||presentationDeparture(p,pa,a)!=null)');
  replace('const benchReturn=!!p.inningRetired&&p.benchWalkStartLocal!=null&&localTick>=p.benchWalkStartLocal;',
    'const benchReturn=p.terminal&&pa.after?.outs>=3&&officialKnown;');
  replace('actors,ball,bat,benchReturn,transitionHold', 'actors,ball,bat,custody,benchReturn,transitionHold');
  replace("function ballVisibleFromCamera(){\n   return !(observed&&!observed.p.swing&&observed.p.catchLocal!=null&&\n     observed.localTick>=observed.p.catchLocal&&state.camera!=='overhead');\n }",
    'function ballVisibleFromCamera(){return !observed?.custody;}');
  // The ball painter accepts authoritative Native samples too. They must not
  // inherit a paused legacy frame's custody state.
  replace('if(!ball||!ballVisibleFromCamera())return 0;',
    "if(!ball||ball.custody||(!ball.nativeObservation&&!ballVisibleFromCamera()))return 0;");

  replace("if(state.camera==='mound')return {eye:{x:-.25,y:1.72,z:18},yaw:Math.atan2(.25,-18),pitch:Math.atan2(.69,18),f:1600,cx:300,cy:192,labelMetres:.23};",
    `if(state.camera==='fielder'){
   const actor=committedFieldObserver(observed);
   const eye=actor?{...actor.position,y:actor.player.height*.92}:{x:-.25,y:1.72,z:18};
   const target=observed.ball?.position??{x:0,y:1,z:0};
   return {eye,yaw:Math.atan2(target.x-eye.x,target.z-eye.z),
     pitch:-Math.atan2(target.y-eye.y,Math.hypot(target.x-eye.x,target.z-eye.z)),f:530,cx:300,cy:196,labelMetres:.5};
  }
  if(state.camera==='mound'){
   const base={eye:{x:-.25,y:1.72,z:18},yaw:Math.atan2(.25,-18),pitch:Math.atan2(.69,18),f:1600,cx:300,cy:192,labelMetres:.23};
   if(observed.fair&&observed.ball){const target=observed.ball.position;
    base.yaw=Math.atan2(target.x-base.eye.x,target.z-base.eye.z);
    base.pitch=-Math.atan2(target.y-base.eye.y,Math.hypot(target.x-base.eye.x,target.z-base.eye.z));
    base.f=530;
   }return base;
  }`);
  replace('const followsBattedBall=observed.p.contactLocal!==null&&observed.localTick>=observed.p.contactLocal;',
    `const homeRunForward=state.camera==='runner'&&observed.p.outcome==='HR'&&observed.officialKnown;
   if(homeRunForward){const runner=observed.p.actors.find(a=>a.id==='BAT');
    const here=observed.actors.find(a=>a.id==='BAT')?.position,next=runner?.track.find(k=>k[0]>observed.localTick);
    if(here&&next)base.yaw=Math.atan2(next[1]-here.x,next[3]-here.z);
    else if(runner?.track.length>1){const last=runner.track.at(-1),previous=runner.track.at(-2);
     base.yaw=Math.atan2(last[1]-previous[1],last[3]-previous[3]);}base.pitch=.04;
   }
   const followsBattedBall=!homeRunForward&&observed.p.contactLocal!==null&&observed.localTick>=observed.p.contactLocal;`);
  replace("if(current.benchReturn)return 'overhead';", `if(current.benchReturn)return 'overhead';
  if(state.cameraChoice==='mound'&&current.fair){
   if(current.localTick-current.p.contactLocal<pitcherBallWatchTicks(current.p))return 'mound';
   const actor=committedFieldObserver(current);return actor&&actor.id!=='P'?'fielder':'mound';
  }`);
  replace("overhead:'俯瞰'};", "overhead:'俯瞰',fielder:'守備目線'};");
  replace("overhead:'俯瞰'}[state.camera]", "overhead:'俯瞰',fielder:'守備目線'}[state.camera]");
  replace("function viewHidesActor(actor){return (actor.id==='C'", "function viewHidesActor(actor){return (state.camera==='fielder'&&actor.id===committedFieldObserver(observed)?.id)||(actor.id==='C'");
  // Continuous optical sphere; overhead pitch/throw curve is retained exactly.
  replace('function visualBallDiameter(projectedPx,view){', 'function visualBallDiameter(projectedPx,view,ballKind=null){');
  replace("return optical*(view==='overhead'?1.12:1.00);", `const batted=view==='overhead'&&(ballKind==='batted'||observed?.fair&&!observed?.custody&&
   (!observed.p.presentationEvidence?.capture||observed.localTick<39+observed.p.presentationEvidence.capture.frame));
  return batted?optical*(.20+.92*(-Math.expm1(-2.5*projectedPx))):optical*(view==='overhead'?1.12:1.00);`);
  replace('visualBallDiameter(realD,state.camera);','visualBallDiameter(realD,state.camera,ball.ballKind??null);');
  between('  if(realD>=15){', '  c.restore();\n  return 1;', `  const r=displayD/2;c.save();c.translate(pixels.x,pixels.y);
  const leather=c.createRadialGradient(-r*.28,-r*.32,r*.08,0,0,r);
  leather.addColorStop(0,'#fffdf7');leather.addColorStop(.70,'#f1f0e4');leather.addColorStop(1,'#b8c4c0');
  c.fillStyle=leather;c.beginPath();c.arc(0,0,r,0,2*Math.PI);c.fill();
  const q=BallSurface.quaternion(ball.orientation);
  if(q&&displayD>=4.1&&state.camera!=='overhead'){
   // Project each seam point onto the same sphere using source quaternion.
   // A single 2D rotation cannot represent world-space baseball spin.
   c.beginPath();c.arc(0,0,r,0,2*Math.PI);c.clip();
   const turn=v=>{const tx=2*(q.y*v.z-q.z*v.y),ty=2*(q.z*v.x-q.x*v.z),tz=2*(q.x*v.y-q.y*v.x);
    return {x:v.x+q.w*tx+q.y*tz-q.z*ty,y:v.y+q.w*ty+q.z*tx-q.x*tz,z:v.z+q.w*tz+q.x*ty-q.y*tx};};
   const right={x:Math.cos(cam.yaw),y:0,z:-Math.sin(cam.yaw)};
   const up={x:Math.sin(cam.pitch)*Math.sin(cam.yaw),y:Math.cos(cam.pitch),z:Math.sin(cam.pitch)*Math.cos(cam.yaw)};
   const facing={x:Math.cos(cam.pitch)*Math.sin(cam.yaw),y:-Math.sin(cam.pitch),z:Math.cos(cam.pitch)*Math.cos(cam.yaw)};
   const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
   c.strokeStyle='#d85761';c.lineWidth=Math.max(.45,Math.min(1.2,r*.12));c.beginPath();let open=false;
   for(let i=0;i<=256;i++){const t=i*Math.PI/128,v=turn({x:.75*Math.cos(t)+.25*Math.cos(3*t),y:.75*Math.sin(t)-.25*Math.sin(3*t),z:Math.sqrt(.75)*Math.sin(2*t)});
    if(dot(v,facing)>0){open=false;continue;}const x=r*dot(v,right),y=-r*dot(v,up);open?c.lineTo(x,y):c.moveTo(x,y);open=true;
   }c.stroke();
  }
`);

  replace("rasterSphere(p,.012+.022*t,t<.22?'#cba66d':'#f4d891','bat');", "rasterSphere(p,batReferenceRadius(t),t<.22?'#cba66d':'#f4d891','bat');");
  replace('const thickness=Math.max(1,Math.min(2,Math.round((.010+.017*t)*pr.scale/5)));',
    'const thickness=Math.max(1,Math.min(8,Math.ceil(batReferenceRadius(t)*pr.scale/4)));');
  replace("cells.set(x+','+y,{x,y,color:t<.20?'#cba66d':'#f4d891'});",
    "if(Math.hypot(ox*4,oy*4)>batReferenceRadius(t)*pr.scale+1)continue;cells.set(x+','+y,{x,y,color:oy<0?'#f4d891':t<.20?'#cba66d':'#d8ae70'});");
  replace("cameraEye:{...cam.eye}", "cameraEye:{...cam.eye},custody:observed?.custody??null,fieldObserver:state.camera==='fielder'?committedFieldObserver(observed)?.id??null:null");
  replace('version:23,nativePaintBall:', 'version:23,presentationVersion:29,probeOpticalDiameter:(diameter,view)=>broadcast.visualBallDiameter(diameter,view),nativePaintBall:');
  replace('let pendingCommandPauseAt=null,commandRevision=0,instructionPauseCompleted=false,benchSkipAt=null;',
    'let pendingCommandPauseAt=null,commandRevision=0,instructionPauseCompleted=false,benchSkipAt=null,lastSceneCut=null;');
  replace('version:23,commandRevision,pendingCommandPauseAt,', 'version:23,lastSceneCut,commandRevision,pendingCommandPauseAt,');
  between(' function requestSceneSkip(){', '  if(requestFoulSkip())return true;', ` function requestSceneSkip(){
  if(frame?.benchReturn){
   const threshold=frame.p.officialAt+Math.ceil(1000/55);
   if(state.tick<threshold)return false;
   leaveFoulScene();return true;
  }
`);
  replace('if(foulSkipAt!==null&&state.tick>=foulSkipAt||benchSkipAt!==null&&state.tick>=benchSkipAt){',
    `const currentPitch=frame?.p??findPitch(state.tick),currentPa=recording.plateAppearances[currentPitch.pa];
   const thirdOutCut=currentPitch.terminal&&currentPa.after?.outs>=3&&
    state.tick>=currentPitch.officialAt+Math.ceil(3000/55)&&pendingCommandPauseAt===null;
   if(thirdOutCut){state.tick=currentPitch.officialAt+Math.ceil(3000/55);
    lastSceneCut={kind:'third-out',officialTick:currentPitch.officialAt,atTick:state.tick};}
   if(thirdOutCut||foulSkipAt!==null&&state.tick>=foulSkipAt||benchSkipAt!==null&&state.tick>=benchSkipAt){`);

  between('    const { spin } = ball;', '    // Same authoritative Native swing pose', `    const spinFrames=last.result.spinFrames??[];
    let frameIndex=0;while(frameIndex+1<spinFrames.length&&spinFrames[frameIndex+1].tick<=sample.world.tick)frameIndex++;
    const orientation=sample.materialOrientation??spinFrames[frameIndex]?.orientationMaterialToWorld??null;
    // Latest actual Native spin frame; no invented omega or interpolation across
    // multiple turns. Unknown release phase remains explicitly uncalibrated.
    visual.nativePaintBall({position:ball.position,orientation,nativeObservation:true,ballKind:sample.materialOrientation?'batted':null});
`);
  replace('prefixRendererOnly:!!visual.nativePaintBall,',
    'prefixRendererOnly:!!visual.nativePaintBall,spinFrames:last?.result.spinFrames?.length??0,spinSource:last?.result.spinFrames?.[0]?.authority??null,continuationAuthority:continuation?.authority??null,groundContactCount:continuation?.groundContacts.length??0,continuationSamples:continuation?.samples.length??0,continuationPhases:[...new Set(continuation?.samples.map(s=>s.phase)??[])],contactSegmentT:last?.result.rigidContact?.segmentT??null,officialFreeBallResult:continuation?.officialResult??null,');
  replace("let nativeMode = 'aero';", "let nativeMode = 'aero';let continuation=null,nativeOverhead=false;");
  replace("batterAction: request.batter.approach === 'take' ? 'take' : 'swing',",
    "batterAction: request.batter.approach === 'take' ? 'take' : 'swing',sweetSpotBand:{minimumT:.65,maximumT:.78},aimAtPlate:true,");
  replace('last=result;playing=true;', `last=result;continuation=null;nativeOverhead=false;
    if(result.result.rigidContact&&native.observeNativeFreeBallContinuation){
     // Explicit synthetic reference calibration. Not Tikao ability or stadium material.
     try{continuation=native.observeNativeFreeBallContinuation({observation:result.result,
      throughTick:result.result.rigidContact.tick+8000000,
      aerodynamics:{ticksPerSecond:1000000,integrationStepTicks:1000,gravityY:-9.81,
       aerodynamics:{ballMassKg:.145,ballRadiusM:.0366,airDensityKgM3:1.225,
        windVelocityMps:{x:0,y:0,z:0},dragCoefficient:.35}},
      ground:{radiusM:.0366,inertiaRatio:.378,gravityMps2:9.81,ticksPerSecond:1000000,
       restingVerticalSpeedMps:.15,material:{restitution:.4,slidingFriction:.3,
        rollingDecelerationMps2:.8,normalSpinDecayPerSecond:.5}}});
     }catch(error){playing=false;proofLog('Native実打球の観測停止: '+error.message);return;}
    }playing=true;`);
  replace('const samples=result.result.samples;', `const samples=continuation?[...result.result.samples,
     ...continuation.samples.slice(1).map(s=>({world:{tick:s.tick,ball:s.ball},
       materialOrientation:s.orientation,batter:{action:'follow_through',bat:null}}))]:result.result.samples;`);
  replace('displayBall(ballSample);', `// Contact/ground impulses are discontinuities: observe their exact source
      // sample instead of interpolating a pre-impact state through a bounce.
      if(continuation&&a.world.tick>=result.result.rigidContact.tick){ballSample=a;
       if(!nativeOverhead){nativeOverhead=true;
        visual.setOptions({cameraChoice:'overhead',autoOverhead:false});
        if($('camera-caption'))$('camera-caption').textContent='Native 実打球・俯瞰';
       }
      }
      displayBall(ballSample);`);
  replace("proofLog(source+' / 接触後の正史物理: '+kinds+'\\n守備・走者・審判の受理された正史履歴がないため、安打・フライアウト等を捏造せず停止。');",
    "proofLog(source+' / 接触後の正史物理: '+kinds+'\\n'+(continuation?'正式Coreの実打球・地面接触 '+continuation.groundContacts.length+'回を観測。土の反発・摩擦は明示的な参照校正。\\n':'')+'守備・走者・審判の受理された正史履歴がないため、公式結果は未確定で停止。');");
  return html;
}
