/* V84 shared whole-scene cadence; public v77 observation contract retained.
 * Observation-only pitcher trial adapter for the unmodified ordinary renderer.
 * Owns no ball physics, official result, roster, or Host pitch command. */
(function(root){
 'use strict';
 const clone=value=>root.structuredClone(value),roles=['P','C','1B','2B','3B','SS','LF','CF','RF'],
  normal=root.liveMatchPlayback,visual=root.matchPreview,field=root.document.getElementById('field'),
  batLayer=root.document.getElementById('bat-overlay'),ballLayer=root.document.getElementById('ball-overlay'),
  data=JSON.parse(root.document.getElementById('match-data').textContent),composite=root.document.createElement('canvas');
 if(!normal||!visual||!field||!root.KneekuraPitchBallCadence||!root.KneekuraLiveActorAnimation)throw Error('pitcher renderer: ordinary presentation unavailable');
 const cadence=root.KneekuraPitchBallCadence.create(root.KneekuraNativeMatchCore),presentationControlsV84=root.KneekuraPresentationControlsV84;
 let prepared=null,last=null,lastSceneWall=-Infinity,lastRequest=null;
 const signature=()=>JSON.stringify(normal.inspect().host),magnitude=v=>Math.hypot(v?.x??0,v?.y??0,v?.z??0);
 function assertHost(){if(prepared&&signature()!==prepared.hostSignature)throw Error('pitcher renderer: Host state changed outside observation');}
 function atOrBefore(frames,tick){let lo=0,hi=frames.length-1;while(lo<hi){const m=Math.ceil((lo+hi)/2);if(frames[m].tick<=tick)lo=m;else hi=m-1;}return frames[lo];}
 function player(id,profiles){const base=data.players[id],profile=profiles.find(p=>p.playerId===id);if(!base||!profile)throw Error('pitcher renderer: unknown player '+id);
  return {...clone(base),height:profile.heightMeters,heightMeters:profile.heightMeters,throws:profile.throws??base.throws,physical:clone(profile.physical)};}
 function prepare({result,input,context,players}={}){
  if(result?.version!==77||result.authority!=='SHARED_LIVE_PITCHER_WORKBENCH'||!input||input.batting!=='take'||!context||!Array.isArray(players)||typeof result.sampleAtPitchElapsedSeconds!=='function')throw Error('pitcher renderer: shared Core trial required');
  normal.stop();const state=normal.inspect(),ready=state.currentFrame??state.host.frame,profiles=clone(players),localInput=clone(input),localContext=clone(context),
   pitcher=player(context.pitcherId,profiles),batter=player(context.batterId,profiles),catcher=player(context.catcherId,profiles),actors=[],
   selectedIds=new Set([context.pitcherId,context.catcherId,context.batterId]);
  for(const actor of ready.actors){
   if(!roles.includes(actor.role)&&actor.role!=='batter')continue;
   const background=!['P','C','batter'].includes(actor.role),index=background?data.defenseMap?.[pitcher.team]?.[actor.role]:null;
   if(background&&index===undefined)throw Error('pitcher renderer: defensive team role unavailable '+actor.role);
   const id=actor.role==='P'?context.pitcherId:actor.role==='C'?context.catcherId:actor.role==='batter'?context.batterId:pitcher.team+'-b'+index;
   // The selected pitcher/catcher/batter is represented once even when the
   // author selects an ordinary position player to pitch in the trial.
   if(background&&selectedIds.has(id))continue;
   if(actors.some(a=>a.playerId===id))continue;
   actors.push({...clone(actor),playerId:id,team:actor.role==='batter'?batter.team:pitcher.team,position:actor.role==='batter'?{x:input.batter.bats==='L'?.85:-.85,y:0,z:-.2}:clone(actor.position),velocity:{x:0,y:0,z:0}});
  }
  batter.bats=input.batter.bats;batter.hand=input.batter.bats;pitcher.hand=input.pitcher.throws??pitcher.throws??pitcher.hand;
  const frames=result.pitch.frames.map(f=>({tick:f.tick,elapsedSeconds:f.elapsedSeconds,phase:'pitch',ballKind:'pitch',ball:clone(f.ball),bat:f.bat?clone(f.bat):null,actors:clone(actors),
   possessedBy:f.ball.possessedBy==='catcher'?context.catcherId:f.ball.possessedBy??null}));
  if(!frames.length)throw Error('pitcher renderer: actual pitch frames required');
  const record={frames,beforeFrame:{...clone(ready),actors:clone(actors)},beforeMatch:{half:'top'},command:{managedTeam:0,batting:'take'},
   batterPlayerId:context.batterId,pitcherPlayerId:context.pitcherId,batterRunStartedAtTick:null,events:[],
   play:{diagnostics:clone(result.pitch.diagnostics),contactMoment:null,call:result.pitch.call}};
  const motion=input.pitcher.pitchingMotion??{preparationMs:1540,headMotionScale:1};
  prepared={result,input:localInput,context:localContext,profiles,pitcher,batter,catcher,actors,record,park:clone(state.host.fenceGeometry),
   motion:clone(motion),appearance:root.document.querySelector('[data-appearance][aria-pressed="true"]')?.dataset.appearance??'retro',hostSignature:signature()};
  last=null;lastRequest=null;lastSceneWall=-Infinity;
  return {version:77,ready:true,authority:'READ_ONLY_NORMAL_PITCHER_PRESENTATION',nativeAdmission:false};
 }
 function render({seconds,camera='mound',playing=false}={}){
  if(!prepared||!Number.isFinite(seconds)||seconds<0||seconds>10||!['mound','catcher'].includes(camera)||typeof playing!=='boolean')throw Error('pitcher renderer: invalid observation request');
  assertHost();const localSeconds=seconds-prepared.motion.preparationMs/1000,tps=prepared.result.pitch.diagnostics.sourceClockTicksPerSecond,
   tick=prepared.input.originTick+Math.max(0,localSeconds)*tps,source=atOrBefore(prepared.record.frames,tick),beforeRelease=localSeconds<0,
   observedFrame=beforeRelease?{...source,phase:'ready',possessedBy:prepared.context.pitcherId}:source,
   sample=beforeRelease||source.possessedBy||source.ball.possessedBy?null:cadence.sample(prepared.record,localSeconds),
   ball=sample?{...clone(sample),ballKind:'pitch',sourceObservation:true}:null,now=root.performance.now(),
   changed=!lastRequest||lastRequest.camera!==camera||seconds<lastRequest.seconds,
   boundaryChanged=!!last&&(!!last.ball!==!!ball||last.world.custody!==observedFrame.possessedBy),
   sceneDue=!playing||changed||boundaryChanged||!last||now-lastSceneWall>=presentationControlsV84.intervalMs({kind:'pitch',free:!!ball,possessed:observedFrame.possessedBy});
  lastRequest={seconds,camera};
  if(!sceneDue){last.requestedSeconds=seconds;return inspect();}
  // The record supplies the player's motion scale to the shared helper once.
  // Keep its separate presentation gain at the normal default.
  root.KneekuraPitcherBodyHeadView.configure({scale:1});
  const animation=root.KneekuraLiveActorAnimation.observe({record:prepared.record,frame:observedFrame,sceneMs:seconds*1000,preparationMs:prepared.motion.preparationMs,
    measuredClip:prepared.input.measuredClips.find(c=>c.id===prepared.result.pitch.clipId)}),
   actors=prepared.actors.map(actor=>{const p=actor.role==='P'?prepared.pitcher:actor.role==='batter'?prepared.batter:actor.role==='C'?prepared.catcher:player(actor.playerId,prepared.profiles),a=animation.actors?.[actor.playerId];
    return {id:actor.role==='batter'?'BAT':actor.role,sourcePlayerId:actor.playerId,role:actor.role,player:{...p,hand:actor.role==='P'?p.throws??p.hand:actor.role==='batter'?prepared.input.batter.bats:p.hand},
     position:clone(actor.position),running:magnitude(actor.velocity)>0,walking:false,presentationAction:a?.action,presentationFrame:a?.frame};}),
   pitcherActor=actors.find(a=>a.role==='P'),head=root.KneekuraPitcherBodyHeadView.observe({record:prepared.record,frame:observedFrame,sceneMs:seconds*1000,preparationMs:prepared.motion.preparationMs,
    pitcherActor,moundSurfacePosition:prepared.input.pitcher.moundPosition}),
   world={liveObservation:true,livePark:prepared.park,liveBattedObservation:false,liveFieldObserverPlayerId:null,liveFieldCameraTarget:null,liveCatcherCameraTarget:null,
    liveBatterCameraTarget:null,livePitcherBodyHeadView:head,liveDefensiveOpportunity:null,livePitcherReactionView:null,liveContinuousBatterView:null,liveTakenPitchGaze:null,
    livePitchMarksOpacity:.06,tick:observedFrame.tick,localTick:28+(tick-prepared.input.originTick)/55000,batter:prepared.batter,pitcher:prepared.pitcher,actors,ball,bat:null,
    liveRunnerDirection:{x:0,y:0,z:0},liveBatterRunStarted:false,p:{contactLocal:null,catchLocal:Number.isFinite(prepared.result.pitch.diagnostics.catcherContactElapsedSeconds)?28+prepared.result.pitch.diagnostics.catcherContactElapsedSeconds/.055:null,
     swing:false,outcome:null,actors:[],presentationEvidence:null},batFrame:animation.batFrame,pitchFrame:animation.pitchFrame,fair:false,fairKnown:false,custody:observedFrame.possessedBy,
    ballKind:'pitch',benchReturn:false,officialKnown:false,phase:observedFrame.phase,history:[]},
   options={camera,appearance:prepared.appearance,zoom:1,labels:true,zone:true,history:false,autoOverhead:false,homeClose:false},rendered=visual.liveDrawWorld(world,options);
  last={version:77,ready:true,authority:'READ_ONLY_NORMAL_PITCHER_PRESENTATION',nativeAdmission:false,officialResult:null,requestedSeconds:seconds,sceneSeconds:seconds,ballSeconds:localSeconds,
   sourceTick:tick,frameTick:observedFrame.tick,camera,ball:clone(ball),head:clone(head),animation:clone(animation),world:clone(world),readOnlyOptions:clone(options),rendered:clone(rendered),context:clone(prepared.context),fieldingAndRunningSimulated:false};
  lastSceneWall=now;assertHost();return inspect();
 }
 function inspect(){if(!prepared)return {version:77,ready:false};return {...(last?clone(last):{version:77,ready:true,rendered:null}),hostUnchanged:signature()===prepared.hostSignature,hostPitchCount:normal.inspect().host.pitchCount,
  preparationMs:prepared.motion.preparationMs,layers:[field,batLayer,ballLayer].filter(Boolean).map(l=>({id:l.id,width:l.width,height:l.height}))};}
 function copyToCanvas(canvas){if(!last||!canvas?.getContext)throw Error('pitcher renderer: a rendered canvas is required');
  canvas.width=field.width;canvas.height=field.height;composite.width=field.width;composite.height=field.height;const c=composite.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(field,0,0);
  if(batLayer)c.drawImage(batLayer,0,0,field.width,field.height);root.KneekuraNameDisplayControls?.paintToCanvas(c,field.width,field.height);if(ballLayer)c.drawImage(ballLayer,0,0,field.width,field.height);
  const target=canvas.getContext('2d');target.imageSmoothingEnabled=false;target.clearRect(0,0,canvas.width,canvas.height);target.drawImage(composite,0,0);return {width:canvas.width,height:canvas.height,order:['field','bat-overlay','actor-labels','ball-overlay']};}
 function reset(){prepared=null;last=null;lastRequest=null;lastSceneWall=-Infinity;return {version:77,ready:false};}
 root.KneekuraMakerPitcherRendererV77=Object.freeze({version:77,prepare,render,inspect,copyToCanvas,reset,presentationControls:presentationControlsV84});
})(window);
