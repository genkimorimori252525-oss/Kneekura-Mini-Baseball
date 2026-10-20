/* V81 whole-scene cadence; public v70 observation contract retained.
 * v70 research view. Only the observed bat/ball and normal presentation are
 * reused. This adapter never issues Host commands or creates fielding, running,
 * scores, custody, wall contacts, or official rulings for the comparison. */
(function(root){
 'use strict';
 const clone=value=>root.structuredClone(value),roles=['P','C','1B','2B','3B','SS','LF','CF','RF'];
 const field=root.document.getElementById('field')||root.document.querySelector('canvas');
 const batLayer=root.document.getElementById('bat-overlay'),ballLayer=root.document.getElementById('ball-overlay');
 const composite=root.document.createElement('canvas');
 const data=JSON.parse(root.document.getElementById('match-data').textContent);
 const normal=root.liveMatchPlayback,visual=root.matchPreview;
 if(!field||!normal||!visual||!root.KneekuraCameraTuningBatterView||!root.KneekuraPitchBallCadence)throw Error('maker match renderer: normal presentation unavailable');
 const cadence=root.KneekuraPitchBallCadence.create(root.KneekuraNativeMatchCore),sceneIntervalMsV81=55/3,freePitchIntervalMsV81=22/3;
 let prepared=null,last=null,lastSceneWall=-Infinity,lastRequest=null;
 const finite=(value,name,min,max)=>{if(!Number.isFinite(value)||value<min||value>max)throw Error('maker match renderer: invalid '+name);return value;};
 const magnitude=v=>Math.hypot(v?.x||0,v?.y||0,v?.z||0);
 const hostSignature=()=>JSON.stringify(normal.inspect().host);
 function assertHost(){if(prepared&&hostSignature()!==prepared.hostSignature)throw Error('maker match renderer: Host state changed outside observation');}
 function atOrBefore(frames,tick){let lo=0,hi=frames.length-1;while(lo<hi){const middle=Math.ceil((lo+hi)/2);if(frames[middle].tick<=tick)lo=middle;else hi=middle-1;}return frames[lo];}
 function profileFor(id,profiles){return profiles.find(p=>(p.playerId??p.id)===id);}
 function presentationPlayer(id,profiles){
  const visualPlayer=data.players[id];if(!visualPlayer)throw Error('maker match renderer: unknown presentation player '+id);
  const profile=profileFor(id,profiles),physical=profile?.physical;
  return {...clone(visualPlayer),...(physical?{physical:clone(physical)}:{}),height:profile?.heightMeters??physical?.heightMeters??visualPlayer.height};
 }
 function makeActors(ready,input,context,profiles){
  const pitcher=presentationPlayer(context.pitcherId,profiles),batter=presentationPlayer(context.batterId,profiles),team=pitcher.team;
  const placements=new Map((ready.actors||[]).map(actor=>[actor.role,actor.position]));
  const actors=[];
  for(const role of roles){
   const playerId=role==='P'?context.pitcherId:team+'-b'+data.defenseMap[team][role];
   // A research selection can put the same team on both sides. Represent the
   // batter once instead of inventing a second copy as a stationary fielder.
   if(playerId===context.batterId)continue;
   const original=ready.actors?.find(actor=>actor.role===role),position=placements.get(role);
   if(!position)continue;
   actors.push({...clone(original),playerId,role,position:clone(position),velocity:{x:0,y:0,z:0},action:'hold'});
  }
  const original=ready.actors?.find(actor=>actor.role==='batter');
  actors.push({...clone(original||{}),playerId:context.batterId,role:'batter',position:{x:input.batter.bats==='L'?.85:-.85,y:0,z:-.2},velocity:{x:0,y:0,z:0},action:'hold'});
  batter.hand=input.batter.bats;batter.bats=input.batter.bats;batter.height=input.batter.heightMeters??batter.height;
  batter.physical={...(batter.physical||{}),...clone(input.batter)};
  pitcher.hand=input.pitcher.throws??pitcher.throws??pitcher.hand;pitcher.height=input.pitcher.heightMeters??pitcher.height;
  return {actors,batter,pitcher};
 }
 function makeRecord(source,input,context,actors,ready){
  const tps=source.pitch.diagnostics.sourceClockTicksPerSecond,origin=source.pitch.frames[0].tick;
  const frameOf=(frame,kind)=>({tick:frame.tick,elapsedSeconds:frame.elapsedSeconds,phase:kind==='pitch'?'pitch':'batted',ballKind:kind,
   ball:clone(frame.ball??{position:frame.position,velocity:frame.velocity,spin:frame.spin,orientation:frame.orientation,visible:frame.visible,possessedBy:null}),
   bat:clone(frame.bat??source.pitch.sampleBatAtTick(frame.tick)),actors:clone(actors),possessedBy:frame.ball?.possessedBy??null});
  const frames=source.pitch.frames.map(frame=>frameOf(frame,'pitch'));
  for(const frame of source.flightFrames)frames.push(frameOf(frame,'batted'));
  frames.sort((a,b)=>a.tick-b.tick);
  const distinct=[];for(const frame of frames){if(distinct.at(-1)?.tick===frame.tick)distinct[distinct.length-1]=frame;else distinct.push(frame);}
  if(!distinct.length||!Number.isSafeInteger(tps)||distinct[0].tick!==origin)throw Error('maker match renderer: invalid observation clock');
  return {frames:distinct,beforeFrame:{...clone(ready),actors:clone(actors)},beforeMatch:{half:'top'},
   command:{managedTeam:0,batting:input.batting},batterPlayerId:context.batterId,pitcherPlayerId:context.pitcherId,
   batterRunStartedAtTick:null,events:[],play:{diagnostics:clone(source.pitch.diagnostics),contactMoment:clone(source.pitch.contactMoment),call:source.pitch.call}};
 }
 function prepare({result,input,context,players}={}){
  if(!result||result.version!==69||!Array.isArray(result.cases)||result.cases.length!==4||!input||!context)throw Error('maker match renderer: four-case comparison required');
  normal.stop();
  const state=normal.inspect(),ready=state.currentFrame??state.host.frame;
  if(!ready||!Array.isArray(ready.actors))throw Error('maker match renderer: normal ready actors unavailable');
  const localInput=clone(input),localContext=clone(context),profiles=clone(players??state.physicalRoster.players);
  const cast=makeActors(ready,localInput,localContext,profiles),rows=new Map();
  for(const source of result.cases){
   if(![1,2,3,4].includes(source.level)||rows.has(source.level)||typeof source.pitch?.sampleBatAtTick!=='function'||typeof source.sampleFlightAtPitchElapsedSeconds!=='function')throw Error('maker match renderer: invalid case');
   rows.set(source.level,{source,record:makeRecord(source,localInput,localContext,cast.actors,ready),controller:root.KneekuraCameraTuningBatterView.create()});
  }
  prepared={input:localInput,context:localContext,profiles,rows,...cast,park:clone(state.host.fenceGeometry),
   appearance:root.document.querySelector('[data-appearance][aria-pressed="true"]')?.dataset.appearance??'retro',
   preparationMs:state.presentation.timing.preparationMs,hostSignature:hostSignature(),hostBaseline:clone(state.host)};
  last=null;lastRequest=null;lastSceneWall=-Infinity;
  return {version:70,ready:true,levels:[...rows.keys()],authority:'READ_ONLY_NORMAL_GAME_PRESENTATION',nativeAdmission:false};
 }
 function sourceBall(row,seconds,frame){
  const origin=row.record.frames[0].tick,tps=row.record.play.diagnostics.sourceClockTicksPerSecond;
  if(origin+seconds*tps>row.record.frames.at(-1).tick)return null;
  const outgoing=row.source.sampleFlightAtPitchElapsedSeconds(seconds);
  if(outgoing)return {...clone(outgoing),visible:true,sourceObservation:true,ballKind:'batted'};
  const incoming=cadence.sample(row.record,seconds);
  if(incoming)return clone(incoming);
  if(frame.ball?.visible===true&&!frame.possessedBy&&!frame.ball.possessedBy)return {...clone(frame.ball),sourceObservation:true,ballKind:frame.ballKind};
  return null;
 }
 function render({level,seconds,yawOffset=0,pitchOffset=0,zoom=1,playing=false}={}){
  if(!prepared)throw Error('maker match renderer: prepare required');
  if(!Number.isInteger(level)||!prepared.rows.has(level))throw Error('maker match renderer: unknown level');
  finite(seconds,'seconds',0,60);finite(yawOffset,'yawOffset',-Math.PI,Math.PI);finite(pitchOffset,'pitchOffset',-1,1);finite(zoom,'zoom',.25,4);
  if(typeof playing!=='boolean')throw Error('maker match renderer: playing must be boolean');
  assertHost();
  const row=prepared.rows.get(level),record=row.record,tps=record.play.diagnostics.sourceClockTicksPerSecond,
   sourceTick=record.frames[0].tick+seconds*tps,frame=atOrBefore(record.frames,sourceTick),now=root.performance.now(),
   changed=!lastRequest||lastRequest.level!==level||lastRequest.yawOffset!==yawOffset||lastRequest.pitchOffset!==pitchOffset||lastRequest.zoom!==zoom||seconds<lastRequest.seconds,
   ball=sourceBall(row,seconds,frame),
   boundaryChanged=!!last&&(last.ball?.ballKind!==ball?.ballKind||!!last.ball!==!!ball||last.world.custody!==frame.possessedBy||last.world.phase!==frame.phase),
   sceneDue=!playing||changed||boundaryChanged||now-lastSceneWall>=(ball?.ballKind==='pitch'?freePitchIntervalMsV81:sceneIntervalMsV81)||!last;
  lastRequest={level,seconds,yawOffset,pitchOffset,zoom,playing};
  if(!sceneDue){
   last.requestedSeconds=seconds;last.sourceTick=sourceTick;last.playing=playing;assertHost();return inspect();
  }
  const sceneMs=prepared.preparationMs+seconds*1000,bat=row.source.pitch.sampleBatAtTick(sourceTick),
   animation=root.KneekuraLiveActorAnimation.observe({record,frame,sceneMs,preparationMs:prepared.preparationMs,measuredClip:prepared.input.measuredClips.find(clip=>clip.id===row.source.pitch.clipId)}),
   cameraBase=row.controller.observe({record,frame,sceneMs,preparationMs:prepared.preparationMs,batter:prepared.batter,previousRecord:null}),
   camera={...cameraBase,eye:clone(cameraBase.eye),yaw:cameraBase.yaw+yawOffset,pitch:cameraBase.pitch+pitchOffset},
   actors=frame.actors.map(actor=>{const player=presentationPlayer(actor.playerId,prepared.profiles),state=animation.actors?.[actor.playerId];
    return {id:actor.role==='batter'?'BAT':roles.includes(actor.role)?actor.role:'RUN:'+actor.playerId,sourcePlayerId:actor.playerId,role:actor.role,
     player:{...player,hand:actor.role==='batter'?prepared.input.batter.bats:actor.role==='P'?(player.throws??player.hand):player.hand},
     position:clone(actor.position),running:magnitude(actor.velocity)>0,walking:false,presentationAction:state?.action,presentationFrame:state?.frame};}),
   contact=record.play.contactMoment,contactLocal=contact?28+(contact.ball.tick-record.frames[0].tick)/55000:null,
   world={liveObservation:true,livePark:prepared.park,liveBattedObservation:ball?.ballKind==='batted',
    liveFieldObserverPlayerId:null,liveFieldCameraTarget:null,liveCatcherCameraTarget:null,liveBatterCameraTarget:null,
    livePitcherBodyHeadView:null,liveDefensiveOpportunity:null,livePitcherReactionView:null,liveContinuousBatterView:camera,liveTakenPitchGaze:null,
    livePitchMarksOpacity:.06,tick:frame.tick,localTick:28+(frame.tick-record.frames[0].tick)/55000,
    batter:prepared.batter,pitcher:prepared.pitcher,actors,ball,bat:bat?{...clone(bat),sourceObservation:true}:null,
    liveRunnerDirection:{x:0,y:0,z:0},liveBatterRunStarted:false,
    p:{contactLocal,catchLocal:Number.isFinite(record.play.diagnostics.catcherContactElapsedSeconds)?28+record.play.diagnostics.catcherContactElapsedSeconds/.055:null,
     swing:record.play.diagnostics.swingOffered,outcome:null,actors:[],presentationEvidence:null},
    batFrame:animation.batFrame,pitchFrame:animation.pitchFrame,fair:false,fairKnown:false,custody:frame.possessedBy,
    ballKind:ball?.ballKind??frame.ballKind,benchReturn:false,officialKnown:false,phase:frame.phase,history:[]},
   options={camera:'batter',appearance:prepared.appearance,zoom,labels:true,zone:frame.phase==='pitch',history:false,autoOverhead:false,homeClose:false};
  const rendered=visual.liveDrawWorld(world,options);
  last={version:70,ready:true,authority:'READ_ONLY_NORMAL_GAME_PRESENTATION',nativeAdmission:false,officialResult:null,
   level,requestedSeconds:seconds,sceneSeconds:seconds,ballSeconds:seconds,sourceTick,sceneSourceTick:sourceTick,frameTick:frame.tick,ballSourceTick:sourceTick,
   playing,cameraBase:clone(cameraBase),camera:clone(camera),offsets:{yawOffset,pitchOffset,zoom},ball:clone(ball),bat:clone(world.bat),
   world:clone(world),readOnlyOptions:clone(options),rendered:clone(rendered),animation:clone(animation),
   context:clone(prepared.context),actorsFixed:true,fieldingAndRunningSimulated:false};
  lastSceneWall=now;assertHost();return inspect();
 }
 function inspect(options={}){
  if(!prepared)return {version:70,ready:false};
  const result=last?clone(last):{version:70,ready:true,rendered:null};
  result.layers=[field,batLayer,ballLayer].filter(Boolean).map(layer=>({id:layer.id,width:layer.width,height:layer.height,display:root.getComputedStyle(layer).display}));
  result.hostUnchanged=hostSignature()===prepared.hostSignature;result.hostPitchCount=normal.inspect().host.pitchCount;
  if(options.includeRecord&&last)result.record=clone(prepared.rows.get(last.level).record);
  return result;
 }
 function copyToCanvas(canvas){
  if(!last||!canvas||typeof canvas.getContext!=='function')throw Error('maker match renderer: rendered target canvas required');
  if(canvas.width!==field.width)canvas.width=field.width;if(canvas.height!==field.height)canvas.height=field.height;
  if(composite.width!==field.width)composite.width=field.width;if(composite.height!==field.height)composite.height=field.height;
  // Resolve the game's font in its own document. A parent-owned destination
  // canvas otherwise resolves child @font-face names through the maker page.
  const ctx=composite.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;
  ctx.drawImage(field,0,0);if(batLayer)ctx.drawImage(batLayer,0,0,canvas.width,canvas.height);
  const names=root.KneekuraNameDisplayControls?.paintToCanvas(ctx,canvas.width,canvas.height);
  if(ballLayer)ctx.drawImage(ballLayer,0,0,canvas.width,canvas.height);
  const target=canvas.getContext('2d');target.setTransform(1,0,0,1,0,0);target.clearRect(0,0,canvas.width,canvas.height);target.imageSmoothingEnabled=false;target.drawImage(composite,0,0);
  return {width:canvas.width,height:canvas.height,names:clone(names??null),order:['field','bat-overlay','actor-labels','ball-overlay']};
 }
 function reset(){prepared=null;last=null;lastRequest=null;lastSceneWall=-Infinity;return {version:70,ready:false};}
 root.KneekuraMakerMatchRenderer=Object.freeze({version:70,prepare,render,inspect,reset,copyToCanvas});
})(window);
