/* Presentation-only selection of the existing B1 silhouettes. Core continues
 * to own every ball, bat, actor position, event and clock. The four body poses
 * are display phases, not measured body motion or collision geometry. */
(function(root){
 'use strict';
 const speed=v=>v?Math.hypot(v.x,v.y,v.z):0;
 const runStarts=new WeakMap();
 function assert(value,message){if(!value)throw new Error('Live actor animation: '+message);}
 function pitcherFrame(tick){return tick<8?0:tick<17?1:tick<27?2:tick<30?3:tick<38?4:5;}
 function observe({record,frame,sceneMs,preparationMs=1540,measuredClip=null}){
  assert(frame&&Number.isSafeInteger(frame.tick)&&Array.isArray(frame.actors),'actual Core frame required');
  assert(Number.isFinite(sceneMs)&&sceneMs>=0&&Number.isFinite(preparationMs)&&preparationMs>0,'finite presentation time required');
  const diagnostic=record?.play?.diagnostics,tps=diagnostic?.sourceClockTicksPerSecond??1e6,
   releaseTick=record?.frames[0]?.tick??frame.tick,preparing=!!record&&sceneMs<preparationMs,
   localTick=!record?0:preparing?sceneMs/preparationMs*28:28+Math.max(0,sceneMs-preparationMs)/55;
  assert(Number.isSafeInteger(tps)&&tps>0,'original Source clock required');
  const pitchFrame=record?pitcherFrame(localTick):0;
  let batFrame=0,swingTiming=null,batReason='READY_BODY_POSE';
  const offense=record?.beforeMatch?.half==='top'?0:1,
   bunt=!!record&&record.command?.managedTeam===offense&&record.command?.batting==='bunt';
  if(record&&!preparing&&diagnostic?.swingOffered===true&&!bunt){
   assert(measuredClip&&measuredClip.id===diagnostic.measuredClipId&&measuredClip.side===diagnostic.battingSide,
    'the actual selected measured clip is required');
   const start=diagnostic.referenceStartTick,through=diagnostic.referenceThroughTick,rate=diagnostic.playbackRate,
    lastSource=measuredClip.frames.at(-1)?.tick,sourceContact=measuredClip.contactTimeSeconds*1e6;
   assert([start,through,lastSource,sourceContact,rate].every(Number.isFinite)&&rate>0&&through>=start,
    'finite original reference timing required');
   // The selected Source window always retains the original last key. Recover
   // its exact contact reference from that key and the declared execution rate;
   // never guess the selected first index or infer impact from the result label.
   const contact=Number.isFinite(diagnostic.referenceContactTick)?diagnostic.referenceContactTick:through-(lastSource-sourceContact)/1e6/rate*tps;
   assert(contact>start&&contact<=through,'reference does not bracket measured contact');
   const actual=record.play.contactMoment?.ball?.tick??null,
    actualObserved=Number.isSafeInteger(actual)&&frame.tick>=actual,
    follow=actualObserved?actual:contact,
    displayedElapsedSeconds=Math.max((frame.tick-releaseTick)/tps,(sceneMs-preparationMs)/1000),
    motorTick=releaseTick+displayedElapsedSeconds*tps;
   swingTiming={referenceStartTick:start,referenceContactTick:contact,referenceThroughTick:through,
    actualContactTick:actual,actualContactObserved:actualObserved,measuredClipId:measuredClip.id,
    bodyPhaseConvention:'FIVE_TO_THREE_PRECONTACT_SPLIT; 55MS_IMPACT_POSE; 22_LEGACY_TICKS_FOLLOW_HOLD',nativeBodyMotion:false};
   if(motorTick<start){batFrame=0;batReason='BEFORE_FINITE_MEASURED_MOTOR';}
   else if(displayedElapsedSeconds>=(follow-releaseTick)/tps+22*.055){batFrame=0;batReason='FOLLOW_BODY_HOLD_COMPLETED';}
   else if((actualObserved||motorTick>=contact)&&motorTick<follow+.055*tps){batFrame=2;batReason=actualObserved?'ACTUAL_CCD_IMPACT_BODY_POSE':'MEASURED_REFERENCE_IMPACT_BODY_POSE';}
   else if(motorTick>=follow+.055*tps){batFrame=3;batReason=actualObserved?'ACTUAL_CCD_CONTACT_OBSERVED':'MEASURED_REFERENCE_FOLLOW_THROUGH';}
   else if(motorTick<start+(contact-start)*5/8){batFrame=1;batReason='MEASURED_REFERENCE_EARLY_SWING';}
   else {batFrame=2;batReason='MEASURED_REFERENCE_LATE_SWING';}
  }else if(preparing)batReason='PRESENTATION_PREPARATION';
  else if(bunt)batReason='CORE_BUNT_HELD_REFERENCE';
  else if(record)batReason='CORE_NO_SWING';
  const contactTick=record?.play?.contactMoment?.ball?.tick,
   live=!preparing&&(frame.ballKind==='batted'||frame.ballKind==='throw'||Number.isSafeInteger(contactTick)&&frame.tick>=contactTick);
  let runStarted=null;
  if(record){
   if(record.batterRunStartedAtTick!==undefined)runStarted=record.batterRunStartedAtTick;
   else{
    if(!runStarts.has(record))runStarts.set(record,record.frames.find(f=>f.phase!=='bench'&&f.actors.some(a=>a.playerId===record.batterPlayerId&&a.role==='runner'&&speed(a.velocity)>0))?.tick??null);
    runStarted=runStarts.get(record);
   }
  }
  const actors={};
  for(const actor of frame.actors){
   const moving=speed(actor.velocity)>0,isBatter=actor.playerId===(record?.batterPlayerId??frame.batterPlayerId)||!record&&actor.role==='batter';
   let action='field',selectedFrame=0,reason='STATIONARY_FIELD_BODY';
   const release=live&&frame.phase!=='bench'?record.events.filter(e=>e.kind==='throw_release'&&e.playerId===actor.playerId&&e.tick<=frame.tick).at(-1):null;
   const throwSeconds=release?Math.max((frame.tick-release.tick)/tps,
    (sceneMs-preparationMs)/1000-(release.tick-releaseTick)/tps):Infinity;
   if(frame.phase==='bench'){
    action=moving?'run':'field';selectedFrame=moving?Math.floor(localTick/10)%2:0;reason='CORE_BENCH_WALK';
   }else if(throwSeconds<.77){
    action='pitch';selectedFrame=throwSeconds<.11?3:throwSeconds<.55?4:5;reason='ACTUAL_THROW_RELEASE_AND_FOLLOW';
   }else if(moving){
    action='run';selectedFrame=Math.floor(localTick/4)%2;reason='ACTUAL_ACTOR_MOTION';
   }else if(isBatter&&(!live||runStarted===null||frame.tick<runStarted)){
    action='bat';selectedFrame=batFrame;reason=batReason;
   }else if(actor.role==='runner'){
    action='runner';reason='STATIONARY_RUNNER_BODY';
   }else if(actor.role==='P'&&!live){
    action='pitch';selectedFrame=pitchFrame;reason=preparing?'V31_PREPARATION_SEQUENCE':'RELEASE_AND_FOLLOW_SEQUENCE';
   }else if(actor.role==='C'&&!live){
    action='catch';reason='PITCH_RECEIVING_CATCHER';
   }
   actors[actor.playerId]={action,frame:selectedFrame,reason};
  }
  return {pitchFrame,batFrame,actors,swingTiming};
 }
 root.KneekuraLiveActorAnimation=Object.freeze({version:1,observe});
})(typeof globalThis==='object'?globalThis:this);
