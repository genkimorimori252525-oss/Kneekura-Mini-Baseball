/* Read-only adapter over the ordinary match's PNG/4px/camera renderer.
 * Positions, possession and official results come only from the shared Core. */
(function(parent){
 'use strict';
 function install(root){
  const data=JSON.parse(root.document.getElementById('match-data').textContent),visual=root.matchPreview,
   normal=root.liveMatchPlayback,core=root.KneekuraNativeMatchCore,roles=['P','C','1B','2B','3B','SS','LF','CF','RF'],
   field=root.document.getElementById('field'),composite=root.document.createElement('canvas'),clone=v=>root.structuredClone(v);
  if(!visual?.liveDrawWorld||!normal||!field)throw Error('通常試合の描画エンジンがありません');
  let prepared=null,last=null,points=[],gridMeasurements=null;
  const length=v=>Math.hypot(v?.x??0,v?.y??0,v?.z??0);
  function player(id){const source=data.players[id];if(!source)throw Error('表示用の選手が見つかりません: '+id);
   const p=prepared.profiles.find(v=>v.playerId===id);return {...source,height:p?.heightMeters??source.height,physical:p?.physical??source.physical,
    throws:p?.throws??source.throws,hand:p?.bats??source.hand};}
  function prepare({result,profiles,park}){normal.stop();if(!result?.frames?.length)throw Error('守備の表示フレームがありません');
   const recovery=result.field.recoveryFramesV115??[],converted=recovery.length?core.convertLiveFieldFramesV98({
    field:{...result.field,frames:recovery},readyFrame:result.beforeFrame,
    defense:Object.fromEntries(result.input.fielders.map(f=>[f.defensivePosition,f.playerId])),
    battingTeam:result.context.battingTeam,ticksPerSecond:result.ticksPerSecond,rules:null
   }).map((frame,index)=>({...frame,recoveryV115:recovery[index].recoveryV115})):[],
    playbackFrames=recovery.length?[...result.frames,...converted]:result.frames,
    sourceFrames=recovery.length?[...result.field.frames,...recovery]:result.field.frames;
   const origin=result.frames[0].tick,diagnostics={sourceClockTicksPerSecond:result.ticksPerSecond,swingOffered:false},
    record={...result,frames:playbackFrames,play:{field:result.field,rules:result.rules??{endedAtTick:Number.MAX_SAFE_INTEGER},diagnostics,contactMoment:result.input.ball},
     events:result.field.facts??[],command:{managedTeam:result.context?.battingTeam??0,batting:'auto'}};
   const geometry=result.field.fieldGeometry;
   if(!geometry?.fenceCenter||!Number.isFinite(geometry.fenceRadiusMeters))throw Error('Coreの球場形状がありません');
   const livePark={center:{x:geometry.fenceCenter.x,z:geometry.fenceCenter.z},radiusMeters:geometry.fenceRadiusMeters,heightMeters:park.fenceHeightMeters};
   const preparationMs=normal.inspect().presentation.timing.preparationMs;
   prepared={result,record,playbackFrames,sourceFrames,profiles,park:livePark,origin,preparationMs,durationMs:(playbackFrames.at(-1).tick-origin)/result.ticksPerSecond*1000};
   last=null;points=[];gridMeasurements=null;return {durationMs:prepared.durationMs};}
  function at(tick){const frames=prepared.playbackFrames;let lo=0,hi=frames.length-1;while(lo<hi){const m=Math.ceil((lo+hi)/2);if(frames[m].tick<=tick)lo=m;else hi=m-1;}return frames[lo];}
  function fieldAt(tick){const frames=prepared.sourceFrames;let lo=0,hi=frames.length-1;while(lo<hi){const m=Math.ceil((lo+hi)/2);if(frames[m].tick<=tick)lo=m;else hi=m-1;}return frames[lo];}
  function render({ms=0,camera='overhead',selectedPlayerId=null,zoom=1,appearance='retro',labels=true}={}){
   if(!prepared)throw Error('守備の計算結果がありません');
   const r=prepared.result,tps=r.ticksPerSecond,frame=at(prepared.origin+Math.max(0,Math.min(prepared.durationMs,ms))/1000*tps),
    record=prepared.record,batter=player(r.batterPlayerId),pitcher=player(r.pitcherPlayerId),
    animation=root.KneekuraLiveActorAnimation.observe({record,frame,sceneMs:prepared.preparationMs+ms,preparationMs:prepared.preparationMs,measuredClip:null}),
    actors=frame.actors.map(a=>({id:a.playerId===r.batterPlayerId?'BAT':roles.includes(a.role)?a.role:'RUN:'+a.playerId,
     sourcePlayerId:a.playerId,role:a.role,player:{...player(a.playerId),hand:a.role==='P'?(player(a.playerId).throws??'R'):player(a.playerId).hand},position:a.position,
     ...(a.bodyPoseV105?{bodyPoseV105:a.bodyPoseV105}:{}),
     ...(a.athleticV115?{athleticV115:a.athleticV115}:{}),
     running:length(a.velocity)>0,walking:frame.phase==='bench',presentationAction:animation.actors?.[a.playerId]?.action,presentationFrame:animation.actors?.[a.playerId]?.frame})),
    observed=root.KneekuraLiveFieldCamera?.observe({record,frame,bases:core.LIVE_MATCH_BASES_V1,defaultObserverPlayerId:selectedPlayerId??frame.fieldObserverPlayerId}),
    ball=frame.ball&&frame.ball.visible!==false&&!frame.possessedBy?{...frame.ball,sourceObservation:true,ballKind:frame.ballKind}:null,
    world={liveObservation:true,livePark:prepared.park,liveBattedObservation:frame.ballKind==='batted'||frame.ballKind==='throw',
     liveFieldObserverPlayerId:selectedPlayerId??observed?.observerPlayerId??frame.fieldObserverPlayerId??null,liveFieldCameraTarget:observed?.target??null,
     liveCatcherCameraTarget:null,liveBatterCameraTarget:null,livePitcherBodyHeadView:null,livePitcherReactionView:null,liveContinuousBatterView:null,liveTakenPitchGaze:null,
     livePitchMarksOpacity:.06,liveDefensiveOpportunity:frame.defensiveOpportunity??null,tick:frame.tick,localTick:28+(frame.tick-prepared.origin)/55000,
     batter,pitcher,actors,ball,bat:frame.bat?{...frame.bat,sourceObservation:true}:null,
     liveRunnerDirection:frame.actors.find(a=>a.playerId===r.batterPlayerId)?.velocity??null,liveBatterRunStarted:true,
     p:{contactLocal:28,catchLocal:null,swing:false,outcome:frame.homeRunConfirmed?'HR':null,actors:[],presentationEvidence:null},
     batFrame:animation.batFrame,pitchFrame:animation.pitchFrame,fair:false,fairKnown:frame.fairKnown,custody:frame.possessedBy,
     ballKind:frame.ballKind,benchReturn:frame.phase==='bench',officialKnown:!!r.rules&&frame.tick>=r.rules.endedAtTick,phase:frame.phase,history:[]},
    options={camera,appearance,zoom,labels,zone:false,history:false,autoOverhead:false,homeClose:false},rendered=visual.liveDrawWorld(world,options);
   // Hit targets come from the actual ordinary renderer's projected actors.
   points=(rendered?.actors??[]).map(a=>({playerId:actors.find(source=>source.id===a.id)?.sourcePlayerId,
    x:(a.bounds.x+a.bounds.w/2)*field.width/600,y:(a.bounds.y+a.bounds.h/2)*field.height/432,role:a.role})).filter(p=>p.playerId&&Number.isFinite(p.x)&&Number.isFinite(p.y));
   if(camera==='overhead'&&ms===0)measureGrid(rendered.cameraProjection);
   last={ms,frameTick:frame.tick,frame,fieldFrame:fieldAt(frame.tick),rendered,world,options,points};return {durationMs:prepared.durationMs,...last};}
  function projectPoint(p){const c=last?.rendered?.cameraProjection;if(!c)return null;const dx=p.x-c.eye.x,dy=(p.y??0)-c.eye.y,dz=p.z-c.eye.z,side=Math.cos(c.yaw)*dx-Math.sin(c.yaw)*dz,ahead=Math.sin(c.yaw)*dx+Math.cos(c.yaw)*dz,up=Math.cos(c.pitch)*dy+Math.sin(c.pitch)*ahead,depth=-Math.sin(c.pitch)*dy+Math.cos(c.pitch)*ahead;if(depth<.12)return null;return {x:(c.cx+c.f*side/depth)*field.width/600,y:(c.cy-c.f*up/depth)*field.height/432};}
  function copyToCanvas(canvas){if(!last)throw Error('表示を先に更新してください');
   if(canvas.width!==field.width)canvas.width=field.width;if(canvas.height!==field.height)canvas.height=field.height;
   if(composite.width!==field.width)composite.width=field.width;if(composite.height!==field.height)composite.height=field.height;
   const c=composite.getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,composite.width,composite.height);c.imageSmoothingEnabled=false;
   c.drawImage(field,0,0);const bat=root.document.getElementById('bat-overlay');if(bat)c.drawImage(bat,0,0,canvas.width,canvas.height);
   root.KneekuraNameDisplayControls?.paintToCanvas(c,canvas.width,canvas.height);const ball=root.document.getElementById('ball-overlay');if(ball)c.drawImage(ball,0,0,canvas.width,canvas.height);
   const target=canvas.getContext('2d');target.setTransform(1,0,0,1,0,0);target.clearRect(0,0,canvas.width,canvas.height);target.imageSmoothingEnabled=false;target.drawImage(composite,0,0);
   return {width:canvas.width,height:canvas.height,layers:['field','bat-overlay','actor-labels','ball-overlay']};}
  function measureGrid(c){if(!c)return;const sy=Math.sin(c.yaw),cy=Math.cos(c.yaw),sp=Math.sin(c.pitch),cp=Math.cos(c.pitch),grid=root.KneekuraPresentationControlsV84.grid;
   const cell=p=>{const dx=p.x-c.eye.x,dy=(p.y??0)-c.eye.y,dz=p.z-c.eye.z,side=cy*dx-sy*dz,ahead=sy*dx+cy*dz,up=cp*dy+sp*ahead,depth=-sp*dy+cp*ahead;if(depth<.12)return null;return {x:grid.floor(c.cx+c.f*side/depth),y:grid.floor(c.cy-c.f*up/depth)};},rows=[];
   for(const a of prepared.result.beforeFrame.actors.filter(a=>roles.includes(a.role))){const initial=cell(a.position);let changed=null,previousMs=0,maximumSampleIntervalMs=0;for(const frame of prepared.result.frames){const actor=frame.actors.find(v=>v.playerId===a.playerId);if(!actor)continue;const ms=(frame.tick-prepared.origin)/prepared.result.ticksPerSecond*1000,at=cell(actor.position);maximumSampleIntervalMs=Math.max(maximumSampleIntervalMs,ms-previousMs);if(at&&initial&&(at.x!==initial.x||at.y!==initial.y)){changed={ms,previousMs,cell:at};break;}previousMs=ms;}rows.push({playerId:a.playerId,initialCell:initial,firstChanged:changed,maximumSampleIntervalMs});}
   gridMeasurements={authority:'FIXED_OVERHEAD_GROUND_ANCHOR_GRID_OBSERVATION',camera:clone(c),rows,summary:'固定俯瞰の足元投影セルをフレーム間で計測（PNG全画素の差分ではありません）',note:'視点を固定した位置の見え方です。身体動作の開始・アニメーションの画素変化とは別です。'};}
  return Object.freeze({prepare,render,copyToCanvas,inspect:()=>last,hitTargets:()=>points,projectPoint,
   inspectGridMeasurements:()=>gridMeasurements??{authority:'NOT_MEASURED_FOR_THIS_CAMERA',rows:[],summary:'俯瞰・時刻0で固定投影セルを計測できます。',note:'未測定を0秒と扱いません。'}});
 }
 parent.KneekuraFieldPracticeRendererV98=Object.freeze({install});
})(window);
