
(() => {
 'use strict';
 const $=id=>document.getElementById(id),visual=window.matchPreview,core=window.KneekuraNativeMatchCore;
 const data=JSON.parse($('match-data').textContent),measured=window.KneekuraMeasuredBatLibrary.decode($('v68-measured-bat-library').textContent);
 const oldRobinSlot=data.players['1-p0'];data.players.robin={...oldRobinSlot,id:'robin',name:'ロビン',height:1.63,hand:'R',bats:'R',throws:'R'};
 const roles=['P','C','1B','2B','3B','SS','LF','CF','RF'];
 const EXPERIMENTAL_UI_POLICIES_V2={robinSource:{version:'robin_original_source_v1',sourceSha256:'27d84474f8d842a8a969b6aceb07ebac94dd92aea4267826b24fa2a31221efc8'},robinAuto:{version:'robin_original_auto_v1',sourceSha256:'27d84474f8d842a8a969b6aceb07ebac94dd92aea4267826b24fa2a31221efc8'},generalLoose:{version:'general_loose_policy_v1',implementationSha256:'7c3ce16289511e184ebe572314349c85e05b0137edb94314ff6edc36e4a760b0',partialFallback:'partial_reference_fallback_v1',catcherObservation:'fixed_release_100ms_v1',batModel:'prescribed_bat_attached_and_no_interference_v1',uncaughtThird:'uncaught_third_empty_before_two_out_v4'}}; // never enabled until actual Worker/visibility acceptance
 // Each park plays on its real wall: fenceShapeV1 from park-shapes-v1.js, written
 // from tools/ballpark-studio/model.mjs by tools/release/export-park-shapes.mjs.
 // These rows are only the circle a Core without that wall would fall back on:
 // center, foul line and one height, its backstop side solved through both
 // distances. Niikura's real 142/94.5 needs a negative backstop, so its row is the
 // least-squares circle holding the studio's 8.2m backstop. The core key has no
 // row and no shape, and keeps the plain 110m circle.
 const parkDimensions={fukuoka:[122,100,4.2],tambov:[128,105,1.3],niikura:[136.5,101.7,3],koshien:[118,95,3],dodger:[120.396,100.584,2.4384]};
 function parkForStadium(){
  const choice=document.getElementById('stadium-choice')?.value,row=parkDimensions[choice],shape=window.KneekuraParkShapesV1?.[choice];
  if(!row)return Object.freeze({fenceRadiusMeters:110,fenceHeightMeters:3});
  const [center,line,height]=row,r2=Math.SQRT2;
  return Object.freeze({fenceRadiusMeters:center,fenceHeightMeters:height,foulFenceRadiusMeters:line*(line-center/r2)/(center-line/r2),...(shape?{fenceShapeV1:shape}:{}),...(window.KneekuraNativeMatchCore?.LIVE_MATCH_GRASS_V2?{groundMaterialV101:window.KneekuraNativeMatchCore.LIVE_MATCH_GRASS_V2}:{})});
 }
 let park=parkForStadium();
 const teams=[0,1].map(team=>({id:data.teams[team],name:data.teamNames[team],
  battingOrder:Array.from({length:9},(_,i)=>team+'-b'+i),pitcherId:team===1?'robin':team+'-p0',
  defense:Object.fromEntries(roles.map(role=>[role,role==='P'?(team===1?'robin':team+'-p0'):team+'-b'+data.defenseMap[team][role]]))}));window.KneekuraActiveTeamsV1=teams;
 // Identity/presentation data alone comes from the old HTML. Ratings and league
 // labels are deliberately not converted into physical capability or outcomes.
 const basePlayers=Object.values(data.players).map(player=>({playerId:player.id,name:player.name,
  heightMeters:player.height,bats:player.hand,throws:player.throws??'R'}));
 const defaultRoster=JSON.parse($('v40-physical-roster').textContent),rosterCatalog=JSON.parse($('v40-roster-catalog').textContent),publicReference=JSON.parse($('v61-public-ability-reference').textContent);
 const robinPhysical={...core.LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,releaseSpeedMps:50,maximumPitchSpeedMps:50};
 const robinPitchTypes=['fastball','slider','curve','forkball','changeup','sinker'];let robinRepertoire=core.validatePitchRepertoireV78({version:'pitch_repertoire_v78',pitches:robinPitchTypes.map(type=>core.createPitchSnapshotFromPresetV78({presetId:type,pitchId:type==='fastball'?'robin-type2':'robin-'+type,physical:robinPhysical,throws:'R'}))},50);
 const robinEntry=structuredClone(defaultRoster.entries.find(e=>e.playerId==='1-p0'));defaultRoster.entries.push(robinEntry);Object.assign(robinEntry,{playerId:'robin',sourceId:'robin-reference-si-v1',heightMeters:1.63,physical:{...robinPhysical,pitchRepertoireV78:robinRepertoire}});delete robinEntry.traitProfile;
 const robinCatalog=rosterCatalog.players.find(e=>e.playerId==='1-p0');if(robinCatalog)rosterCatalog.players.push({...robinCatalog,playerId:'robin',name:'ロビン',heightMeters:1.63,bats:'R',throws:'R'});
 let players=basePlayers,playerById=Object.fromEntries(Object.values(data.players).map(player=>[player.id,player])),
  pendingRoster=structuredClone(defaultRoster),activeRoster=null,physicalRosterAudit=null;
 const season=window.KneekuraLiveSeasonMatchV79.create({core,getAuthoredPlayers:()=>core.applyLivePhysicalRosterV1({players:basePlayers,roster:pendingRoster}).players});window.liveMatchSeasonsV79=season;
 const cameras={umpire:'球審視点',catcher:'捕手目線',batter:'打者目線',runner:'走者目線',mound:'投手目線',overhead:'俯瞰',fielder:'守備目線'};
 const pitchNames={fastball:'直球',slider:'スライダー',curve:'カーブ',changeup:'チェンジアップ',cutter:'カットボール',
  sinker:'シンカー',splitter:'スプリット',fork:'フォーク','two-seam':'ツーシーム'};
 const resultLabels={ball:'ボール',called_strike:'ストライク',swinging_strike:'空振り',foul:'ファウル',
  strikeout:'三振',walk:'四球',hit_by_pitch:'死球',single:'単打',double:'二塁打',triple:'三塁打',home_run:'ホームラン',
  ground_out:'ゴロアウト',fly_out:'フライアウト',foul_out:'ファウルフライアウト',ground_rule_double:'二塁の安全進塁権',field_out:'アウト',in_play:'インプレー',fair:'フェア',
  BALL:'ボール',STRIKE:'ストライク',FOUL:'ファウル',K:'三振',BB:'四球',HBP:'死球',HR:'ホームラン',
  '1B':'単打','2B':'二塁打','3B':'三塁打',GO:'ゴロアウト',FO:'フライアウト'};
 let host,records=[],selected=-1,frameIndex=0,currentFrame,rendered,observedMatch,activeConfiguration,activeAutoDirectionV250={},lastFailure=null,lastFailureDetails=null;
 // Presentation time includes the v31 preparation and result pauses. It never
 // changes a Core tick, physical frame, command or adjudication.
 const timingDefaults=Object.freeze({preparationMs:28*55,countHoldMs:29*55,fieldHoldMs:14*55,terminalHoldMs:1000,thirdOutMs:3000,foulMs:5000});
 const timing=Object.freeze({...timingDefaults,get preparationMs(){return activeResult()?.play.diagnostics.pitchingMotion?.preparationMs??timingDefaults.preparationMs;}});
 let playing=false,fast=false,pauseAfterPitch=false,token=0,gameToken=0,playStart=0,playFromMs=0,lastDraw=-Infinity;
 let pitcherReactionView=null,pitcherBodyHeadView=null;
 let sceneMs=0,skipAtMs=null,selectedMark=null,chartObservation=null,fieldCameraObservation=null,actorAnimation=null;
 let continuousBatterView=null;
 let takenPitchGaze=null;
 let pitchMarksOpacity=1,catcherFollow=null,resultDisplay=null,batterGaze=null;
 const pitchSource=window.KneekuraPitchBallCadence.create(core);
 const cadence={sceneMs:55/1.5,pitchBallMs:22/1.5,sceneDraws:0,pitchBallSamples:0,pitchBallPaints:0,nonPitchFastPaints:0,lastSceneMs:null,lastPitchBallMs:null,
  get effectiveSceneMs(){return window.KneekuraPresentationControlsV84.intervalMs();},get effectiveFreePitchMs(){return window.KneekuraPresentationControlsV84.intervalMs({kind:'pitch',free:true});},get effectiveBattedMs(){return window.KneekuraPresentationControlsV84.intervalMs({kind:'batted',free:true});},ballOnlyPainting:false,boundaryRedraws:0};
 let lastCadenceBoundaryV81=null,continuousPitchObservationV81=false;
 function cadenceBoundaryV81(){
  const result=activeResult(),stage=sceneStage(),frame=result?(stage==='preparation'?result.beforeFrame:result.frames[frameIndex]):null;
  return [result,stage,frame?.phase,frame?.ballKind,frame?.possessedBy??null,frame?.ball?.visible!==false,
   frame?.ball?.custody??null,freePitchAt(sceneMs),frame?.homeRunConfirmed??false,frame?.fairKnown??false,
   !!result&&!!frame&&frame.tick>=result.play.rules.endedAtTick];
 }
 function sameCadenceBoundaryV81(a,b){return !!a&&!!b&&a.length===b.length&&a.every((value,index)=>value===b[index]);}
 let lastPitchBall=-Infinity,pitchBallActive=false,pitchBallSample=null;
 function freePitchAt(ms){const r=activeResult();if(!r||ms<timing.preparationMs)return false;
  const seconds=(ms-timing.preparationMs)/1000,d=r.play.diagnostics;
  if(Number.isFinite(d.catcherContactElapsedSeconds)&&seconds>=d.catcherContactElapsedSeconds||Number.isFinite(r.play.contactMoment?.elapsedSeconds)&&seconds>=r.play.contactMoment.elapsedSeconds)return false;
  const tick=r.frames[0].tick+(ms-timing.preparationMs)/1000*(r.play.diagnostics.sourceClockTicksPerSecond??1e6);
  let lo=0,hi=r.frames.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(r.frames[mid].tick<=tick)lo=mid;else hi=mid-1;}
  const f=r.frames[lo];return f.ballKind==='pitch'&&!!f.ball&&f.ball.visible!==false&&!f.possessedBy&&!f.ball.custody&&!f.ball.possessedBy;
 }
 function observePitchBallAtPresentationMs(ms){if(!Number.isFinite(ms)||ms<0)throw Error('Invalid presentation time');
  return freePitchAt(ms)?pitchSource.sample(activeResult(),(ms-timing.preparationMs)/1000):null;
 }
 function refreshPitchBall(now){const active=(playing||continuousPitchObservationV81)&&freePitchAt(sceneMs);
  if(!active){const clear=pitchBallActive;pitchBallActive=false;pitchBallSample=null;return clear;}
  // Sample only as part of draw(), at that draw's shared sceneMs. Font/camera,
  // actors, bat and ball are submitted in one scene, never a ball-only paint.
  pitchBallActive=true;lastPitchBall=now;
  pitchBallSample=observePitchBallAtPresentationMs(sceneMs);cadence.pitchBallSamples++;cadence.lastPitchBallMs=sceneMs;return true;
 }
 // v81 experiment: private ball-only painting removed; public observer APIs remain.
 window.addEventListener('kneekura:presentation-controls-v84',()=>draw());
 function syncNameDisplay(){const input=$('name-display-scale');if(input)input.value=window.KneekuraNameDisplayControls.inspect().scale;}
 function setNameDisplay(patch){return window.KneekuraNameDisplayControls.configure(patch);}
 function setPitcherBodyHead(patch){const value=window.KneekuraPitcherBodyHeadView.configure(patch);
  const enabled=$('pitcher-head-enabled'),scale=$('pitcher-head-scale');if(enabled)enabled.checked=value.enabled;if(scale)scale.value=value.scale;draw();return value;}
 window.addEventListener('kneekura:name-display-change',()=>{syncNameDisplay();draw();});
 function syncBallDisplay(){const s=window.KneekuraBallDisplayControls.inspect();const status=$('ball-height-model-status');if(status)status.textContent=s.overheadHeightModel==='LEGACY_DIAMETER_V4'?'読み込んだ設定は旧方式（直径倍率）です。高さの値を変更すると新方式へ切り替わります。':'高さの遠近感：地面からの高さを指定倍にしてサイズを投影しています。';
  for(const key of ['perspective','overhead','overheadHeightEmphasis']){const input=$('ball-scale-'+key);if(input)input.value=s[key];}
 }
 function setBallDisplay(patch){if(Object.hasOwn(patch,'overheadHeightEmphasis')&&!Object.hasOwn(patch,'overheadHeightModel'))patch={...patch,overheadHeightModel:'VIRTUAL_HEIGHT_V1'};const s=window.KneekuraBallDisplayControls.configure(patch);syncBallDisplay();draw();return s;}
 let options={camera:'catcher',appearance:'retro',labels:true,zone:true,history:true,homeClose:false,zoom:1,autoOverhead:true};
 try{options.appearance=localStorage.getItem('kneekura.presentation.actorAppearance.v1')||'retro';}catch{}
 const chart=window.KneekuraLivePitchChart.create({canvas:$('pitch-chart'),caption:$('chart-caption'),legend:$('symbol-legend'),core,
  onSelect:({pitchId})=>{selectedMark=pitchId;draw();}});
 const hashSeed=value=>{let state=2166136261;for(const character of value)state=Math.imul(state^character.charCodeAt(0),16777619);return state>>>0;};
 // Retain the approved controls. Their older names select the corresponding
 // available Core physical model; they do not claim a new measured arsenal.
 const pitchModels={fork:'splitter',change:'changeup','two-seam':'sinker'};
 const legacyPitchMenu=[...$('pitch-choice').options].map(o=>({value:o.value,label:o.textContent}));let pitchMenuIdentity=null;
 function syncPitchMenuV78(){
  const state=host.inspect(),p=players.find(p=>p.playerId===state.pitcherPlayerId),rows=p?.physical?.pitchRepertoireV78?.pitches,
   identity=rows?JSON.stringify([state.pitcherPlayerId,rows.map(r=>[r.pitchId,r.name])]):'legacy';
  if(identity===pitchMenuIdentity)return;const menu=$('pitch-choice'),selected=menu.value;
  const entries=rows?[{value:'auto',label:'おまかせ'},...rows.map(r=>({value:'v78:'+r.pitchId,label:r.name}))]:legacyPitchMenu;
  menu.replaceChildren();for(const row of entries){const o=document.createElement('option');o.value=row.value;o.textContent=row.label;menu.append(o);}
  menu.value=entries.some(row=>row.value===selected)?selected:'auto';pitchMenuIdentity=identity;
 }
 const command=()=>{syncPitchMenuV78();const selected=$('pitch-choice').value,state=host.inspect(),
  row=selected.startsWith('v78:')?players.find(p=>p.playerId===state.pitcherPlayerId)?.physical?.pitchRepertoireV78?.pitches.find(p=>p.pitchId===selected.slice(4)):null;
  if(selected.startsWith('v78:')&&!row)throw Error('選択した球は現在の投手に登録されていません');
  const original=$('robin-original-choice').value;if(original&&(state.pitcherPlayerId!=='robin'||Number($('managed-team').value)!==state.team||$('batting-choice').value!=='take'))throw Error('原作球の実験はロビン投手・攻撃側の待球に限ります');
  return {batting:$('batting-choice').value,pitchType:row?.pitchType??pitchModels[selected]??selected,...(row?{pitchId:row.pitchId}:{}),...(original?{robinOriginalV1:{version:'robin_original_command_v1',sourceSha256:'27d84474f8d842a8a969b6aceb07ebac94dd92aea4267826b24fa2a31221efc8',selection:original}}:{}),
   ...($('direction-choice').value==='AUTO'?{}:{battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'manager-card-v1',mode:$('direction-choice').value}}),location:$('location-choice').value,managedTeam:Number($('managed-team').value),baserunning:$('baserunning-choice').value};};
   let battedTrailMode='overhead';try{const saved=localStorage.getItem('kneekura.battedTrail.v1');if(['off','overhead','all'].includes(saved))battedTrailMode=saved;}catch{}
  function battedTrailPoints(result,frame,camera){
   if(!result||battedTrailMode==='off'||(battedTrailMode==='overhead'&&camera!=='overhead'))return null;
   const points=[];for(const f of result.frames){if(f.tick>frame.tick)break;if(f.ballKind==='batted'&&f.ball?.position&&f.ball.visible!==false&&!f.ball.possessedBy)points.push(f.ball.position);}
   return points.length>1?points:null;
  }
const vecLength=value=>value?Math.hypot(value.x,value.y,value.z):0;
 let preparingPitchV99=false,preparingSceneV99=null;
 function stop(cancelNext=true){liveAudioV100.stop();playing=false;token++;if(preparingPitchV99){preparingPitchV99=false;if(Number.isFinite(preparingSceneV99))setSceneTime(preparingSceneV99);preparingSceneV99=null;}if(cancelNext)pauseAfterPitch=true;}
 const whiffFollowThroughControllerV88=window.KneekuraWhiffFollowThroughV88.create({core});
 let whiffFollowThroughV88=null;
 const homeRunWatchControllerV83=window.KneekuraHomeRunWatchV83.create();
 let homeRunWatchV83=null;
 function activeResult(){return preparingPitchV99?null:records[selected]??null;}
 function foulStop(result){
  if(result?.play.classification!=='foul')return null;
  const event=result.events.find(event=>event.kind==='play_end'&&event.reason==='foul_dead_ball');
  return event?{deadTick:event.tick,holdMs:1500,source:'CORE_FOUL_DEAD_BALL'}:null;
 }
 function catcherFlight(result){
  const first=result?.frames.find(frame=>frame.ballKind==='batted');
  return first?{first,delaySeconds:.3}:null;// C2: overhead starts 0.3 s after contact (was 1-2 s)
 }
 function sceneTiming(result){
  const first=result.frames[0].tick,last=result.frames.at(-1).tick,physicalMs=(last-first)/1000;
  const officialMs=(result.play.rules.endedAtTick-first)/1000;
  const thirdOut=result.beforeMatch.outs+result.play.rules.outcomes.length>=3;
  let duration=physicalMs+(result.play.field?timing.fieldHoldMs:timing.countHoldMs);
  if(result.play.rules.batterAdvanced)duration+=timing.terminalHoldMs;
  if(thirdOut)duration=Math.max(physicalMs,officialMs+timing.thirdOutMs);
  const foul=foulStop(result);
  if(foul)duration=Math.max(physicalMs,(foul.deadTick-first)/1000+foul.holdMs);
  else if(result.play.classification==='foul')duration=Math.max(duration,officialMs+timing.foulMs);
  const flight=catcherFlight(result);
  if(!foul&&options.camera==='catcher'&&options.autoOverhead&&flight)
   duration=Math.max(duration,(flight.first.tick-first)/1000+flight.delaySeconds*1000+330);
  duration=Math.max(duration,homeRunWatchControllerV83.minDurationMs({record:result,preparationMs:timing.preparationMs,selectedCamera:options.camera})-timing.preparationMs);
  return {first,physicalMs,officialMs,thirdOut,durationMs:timing.preparationMs+duration};
 }
 function setSceneTime(value){
  const result=activeResult();if(!result){sceneMs=0;frameIndex=0;return;}
  const layout=sceneTiming(result);sceneMs=Math.max(0,Math.min(layout.durationMs,value));
  const tick=layout.first+Math.max(0,sceneMs-timing.preparationMs)*1000;
  let lowerV81=0,upperV81=result.frames.length;
  while(lowerV81<upperV81){const middleV81=Math.floor((lowerV81+upperV81)/2);
   if(result.frames[middleV81].tick<=tick)lowerV81=middleV81+1;else upperV81=middleV81;}
  frameIndex=Math.max(0,lowerV81-1);
 }
 // The Core keeps a frame every 55ms after the pitch. The picture steps 1.5 times as often: between two frames the
 // ball, bat and bodies are read at the same point of the gap. frame.tick stays the Core's, so every rule reads as before.
 const presentedStepTicksV1=55000/1.5,presentedGapTicksV1=55000,
  lerpV1=(a,b,u)=>a+(b-a)*u,
  lerpPointV1=(a,b,u)=>({...a,x:lerpV1(a.x,b.x,u),y:lerpV1(a.y,b.y,u),z:lerpV1(a.z,b.z,u)}),
  hermiteV1=(p,q,v,w,u,seconds)=>{const u2=u*u,u3=u2*u;return (2*u3-3*u2+1)*p+(u3-2*u2+u)*seconds*v+(3*u2-2*u3)*q+(u3-u2)*seconds*w;};
 function presentedBallV1(a,b,u,seconds){
  if(!a||!b||a.visible===false||b.visible===false||a.possessedBy||b.possessedBy||a.custody!==b.custody||a.phase!==b.phase)return a;
  const position=a.phase==='airborne'&&a.velocity&&b.velocity
   ?{x:hermiteV1(a.position.x,b.position.x,a.velocity.x,b.velocity.x,u,seconds),y:hermiteV1(a.position.y,b.position.y,a.velocity.y,b.velocity.y,u,seconds),z:hermiteV1(a.position.z,b.position.z,a.velocity.z,b.velocity.z,u,seconds)}
   :lerpPointV1(a.position,b.position,u);
  return {...a,position};
 }
 function presentedActorV1(a,b,u){
  if(!b||Math.hypot(b.position.x-a.position.x,b.position.z-a.position.z)>1.5)return a;
  const pose=a.bodyPoseV105,next=b.bodyPoseV105,moved=pose&&next?{...pose}:null;
  if(moved)for(const key of ['foot','hip','shoulder','head','eye'])if(pose[key]&&next[key])moved[key]=lerpPointV1(pose[key],next[key],u);
  return {...a,position:lerpPointV1(a.position,b.position,u),...(moved?{bodyPoseV105:moved}:{})};
 }
 function presentedFrameV1(result,index){
  const tick=sceneTiming(result).first+Math.max(0,sceneMs-timing.preparationMs)*1000,first=result.frames[0].tick,
   sample=first+Math.floor((tick-first)/presentedStepTicksV1+1e-6)*presentedStepTicksV1;
  // The step can fall just before this frame: then the gap that holds it is the one before.
  const at=sample<result.frames[index].tick&&index>0?index-1:index,a=result.frames[at],b=result.frames[at+1];
  if(!b||b.tick-a.tick!==presentedGapTicksV1||sample<=a.tick||a.phase!==b.phase||a.ballKind!==b.ballKind||a.possessedBy!==b.possessedBy)return result.frames[index];
  const u=(sample-a.tick)/presentedGapTicksV1,others=new Map(b.actors.map(actor=>[actor.playerId,actor]));
  return {...a,ball:presentedBallV1(a.ball,b.ball,u,presentedGapTicksV1/1e6),
   bat:a.bat&&b.bat?{...a.bat,grip:lerpPointV1(a.bat.grip,b.bat.grip,u),tip:lerpPointV1(a.bat.tip,b.bat.tip,u)}:a.bat,
   actors:a.actors.map(actor=>presentedActorV1(actor,others.get(actor.playerId),u))};
 }
 function sceneEnded(){const result=activeResult();return !!result&&sceneMs>=sceneTiming(result).durationMs;}
 function sceneStage(){
  const result=activeResult();if(!result)return 'ready';
  if(sceneMs<timing.preparationMs)return 'preparation';
  return sceneMs>=timing.preparationMs+sceneTiming(result).physicalMs?'result':'physical';
 }
 function knownResult(result){
  return result?window.KneekuraLivePlayDescription.describe(result).label:'プレー終了';
 }
 function observeCatcher(result,frame){
  const flight=catcherFlight(result);
  if(!flight||sceneStage()==='preparation'||frame.tick<flight.first.tick)return null;
  const source=frame.ball??result.frames.slice(0,frameIndex+1).findLast(sample=>sample.tick<=frame.tick&&sample.ball)?.ball;
  const foul=foulStop(result),normalCut=timing.preparationMs+(flight.first.tick-result.frames[0].tick)/1000+flight.delaySeconds*1000,
   foulCut=foul&&frame.tick>=foul.deadTick?timing.preparationMs+(foul.deadTick-result.frames[0].tick)/1000+foul.holdMs-330:Infinity;
  return {startTick:flight.first.tick,delaySeconds:flight.delaySeconds,
   cutoverAtMs:Math.min(normalCut,foulCut),
   elapsedSeconds:Math.max(0,(sceneMs-timing.preparationMs)/1000-(flight.first.tick-result.frames[0].tick)/1e6),
   target:source?{...source.position}:null};
 }
 function displayResult(result,frame,early){
  if(!result)return null;
  const official=frame.tick>=result.play.rules.endedAtTick,description=official?window.KneekuraLivePlayDescription.describe(result):null,
   playLabel=description?.label??early?.label??null,thirdOut=description?.thirdOut??false,
   changeAtMs=timing.preparationMs+(result.play.rules.endedAtTick-result.frames[0].tick)/1000+1100,
   change=thirdOut&&sceneMs>=changeAtMs;
  return {playLabel,label:change?'チェンジ（3アウト）':playLabel,change,thirdOut,
   outsAfter:description?.outsAfter??result.beforeMatch.outs};
 }
 // A ball result can be known before the runners and play have finished.
 // This projection never advances the score/count/inning or ends playback.
 function observedResult(result,frame){
  if(!result||!frame)return null;
  const play=result.play,facts=play.field?.ruleFacts,at=frame.tick;
  const fence=facts?.overFence;
  if(play.classification==='home_run'&&frame.homeRunConfirmed&&fence&&fence.fair&&fence.untouchedGround&&fence.cause!=='throw'
   &&at>=fence.tick&&(facts.firstGroundContactTick==null||facts.firstGroundContactTick>fence.tick))
   return {label:'ホームラン',category:'hit',atTick:fence.tick,source:'CORE_FAIR_UNTOUCHED_FENCE_CROSSING'};
  const caught=facts?.flyCatch;
  if((play.classification==='fly_out'||play.classification==='foul_out')&&caught&&at>=caught.secureCatchTick
   &&play.rules.outcomes.some(out=>out.runnerId===result.batterPlayerId&&out.cause==='fly_catch'&&out.tick===caught.secureCatchTick))
   return {label:play.classification==='foul_out'?'ファウルフライアウト':'フライアウト',category:'out',atTick:caught.secureCatchTick,source:'CORE_SECURE_FLY_CATCH_OUT'};
  return null;
 }
 function sourceActor(actor,batterId,battingSide){
  const source=playerById[actor.playerId];
  if(!source)throw new Error('Core observation has unknown player: '+actor.playerId);
  const id=actor.playerId===batterId?'BAT':roles.includes(actor.role)?actor.role:'RUN:'+actor.playerId;
  return {id,sourcePlayerId:actor.playerId,role:actor.role,player:{...source,
   hand:actor.playerId===batterId?battingSide:actor.role==='P'||actorAnimation?.actors[actor.playerId]?.action==='pitch'?
    (source.throws??source.hand):source.hand},position:actor.position,
   ...(actor.bodyPoseV105?{bodyPoseV105:actor.bodyPoseV105}:{}),
   ...(actor.athleticV115?{athleticV115:actor.athleticV115}:{}),
   running:vecLength(actor.velocity)>0,walking:actor.action==='bench'||currentFrame.phase==='bench',
   velocity:actor.velocity,presentationArt:window.KneekuraArtBankV1?.actorArt({record:activeResult(),frame:currentFrame,actor,anim:actorAnimation?.actors[actor.playerId],ordinal:selected,batterHeight:playerById[batterId]?.height,sceneMs,preparationMs:timing.preparationMs}),presentationPose:actorAnimation?.actors[actor.playerId]?.pose,presentationAction:actorAnimation?.actors[actor.playerId]?.action,presentationFrame:actorAnimation?.actors[actor.playerId]?.frame};
 }
 function baseCameraForV83(frame,actors,fieldCameraV83=fieldCameraObservation,reactionV83=pitcherReactionView){
  if(options.camera==='catcher'&&catcherFollow)
   return options.autoOverhead&&sceneMs>=catcherFollow.cutoverAtMs?'overhead':'catcher';
  if(frame.phase==='bench'){const record=activeResult(),caught=record?.play.field?.ruleFacts.flyCatch,safe=caught&&caught.secureCatchTick<=frame.tick&&(record.beforeMatch.outs===2||Object.values(record.beforeMatch.bases).every(v=>v===null));return safe&&(options.camera==='fielder'||options.camera==='mound')&&fieldCameraV83?.phase==='held'&&!fieldCameraV83?.target?'fielder':'overhead';}
  if(options.camera==='mound'&&frame.defensiveOpportunity?.kind==='none-decisive-over-fence')return 'mound';
  if(options.camera==='batter'&&batterGaze)return 'batter';
  if(options.camera==='batter'&&continuousBatterView)return 'batter';
  if(options.camera==='mound'&&reactionV83?.view)return 'mound';
  const live=frame.ballKind==='batted'||frame.ballKind==='throw';
  const observer=fieldCameraV83?.observerPlayerId??frame.fieldObserverPlayerId;
  if(options.camera==='mound'&&live&&observer){
   if(reactionV83&&!reactionV83.handoffAllowed)return 'mound';
   const pitcher=actors.find(actor=>actor.id==='P');
   const result=activeResult(),first=result?.frames.find(f=>f.ballKind==='batted');
   const delay=first?.ball?Math.min(2,Math.max(.35,70/Math.max(1,vecLength(first.ball.velocity)))):2;
   const fieldCommitted=fieldCameraV83?.phase==='held'||fieldCameraV83?.phase==='throw';
   if(first&&((frame.tick-first.tick)/1e6>=delay||fieldCommitted)&&observer!==pitcher?.sourcePlayerId)return 'fielder';
   return 'mound';
  }
  if(options.camera==='batter'&&actors.some(actor=>actor.id==='BAT'&&actor.role==='runner'))return 'runner';
  return options.autoOverhead&&frame.fairKnown&&live?'overhead':options.camera;
 }
 function cameraFor(frame,actors){return homeRunWatchV83?.active?homeRunWatchV83.camera:baseCameraForV83(frame,actors);}
 function updateScore(match,line,finished,scored){
  const count=Math.max(9,line?.length??0),heading=document.querySelector('.scoreboard thead tr');
  heading.replaceChildren();
  for(const label of ['チーム',...Array.from({length:count},(_,i)=>String(i+1)),'計','安','失']){
   const cell=document.createElement('th');cell.textContent=label;heading.append(cell);
  }
  $('score-body').replaceChildren();
  for(const team of [0,1]){
   const row=document.createElement('tr'),values=[data.teams[team],...Array.from({length:count},(_,index)=>{
    const entry=line?.find(item=>item.inning===index+1),value=team===0?entry?.away:entry?.home;
    return value??(finished&&team===1&&index+1===match.inning&&match.half==='top'&&match.score.home>match.score.away?'×':'');
   }),team===0?match.score.away:match.score.home,...['hits','errors'].map(key=>{const n=scored?.[key],side=team===0?'away':'home',pending=team===0?'pendingAway':'pendingHome';return n?String(n[side])+(n[pending]?'＋保留'+n[pending]:''):'未採点';})];
   values.forEach((value,index)=>{const cell=document.createElement('td');cell.textContent=String(value);
    if(index===count+1)cell.className='total';
    if(!finished&&index===match.inning&&(team===0?match.half==='top':match.half==='bottom'))cell.className='active';row.append(cell);});
   $('score-body').append(row);
  }
  $('bso').replaceChildren();
  for(const [label,total,value,style]of [['B',3,match.balls,'b'],['S',2,match.strikes,'s'],['O',2,match.outs,'o']]){
   const item=document.createElement('div');item.setAttribute('aria-label',label+' '+value);
   const title=document.createElement('b');title.textContent=label;item.append(title);
   for(let index=0;index<total;index++){const lamp=document.createElement('i');lamp.className='lamp '+style+(index<value?' on':'');lamp.setAttribute('aria-hidden','true');item.append(lamp);}
   $('bso').append(item);
  }
  const bases=[match.bases.first,match.bases.second,match.bases.third];
  $('bases').hidden=false;$('bases').querySelectorAll('[data-base]').forEach(base=>base.classList.toggle('on',!!bases[Number(base.dataset.base)-1]));
  $('bases').setAttribute('aria-label',bases.map((id,index)=>id?(index+1)+'塁 '+playerById[id]?.name:'').filter(Boolean).join('、')||'走者なし');
 }
 function syncUi(result,atEnd,frame){
  const state=host.inspect();
  const officialKnown=!!result&&frame.tick>=result.play.rules.endedAtTick;
  const resultObservation=observedResult(result,frame),resultKnown=officialKnown||resultObservation!==null;
  resultDisplay=displayResult(result,frame,resultObservation);
  observedMatch=result?(officialKnown?result.match:result.beforeMatch):state.match;
  const match=observedMatch,line=result?(officialKnown?result.line:result.beforeLine):state.line;
  const finished=state.finished&&selected===records.length-1&&atEnd;
  updateScore(match,line,finished,result?(atEnd?result:records[selected-1]??{hits:{away:0,home:0},errors:{away:0,home:0}}):state);
  $('inning-label').textContent=finished?'試合終了':match.inning+'回'+(match.half==='top'?'表':'裏');
  const currentMark=chartObservation.history.find(entry=>entry.pitchId===window.KneekuraLivePitchChart.pitchId(selected));
  const color=window.KneekuraPitchSymbols.colors[resultObservation?.category??currentMark?.category]??'#e0b541';
  $('pitch-number').textContent=String(chartObservation.number);$('pitch-number').style.color=color;$('pitch-number').style.borderColor=color;
  $('result-text').textContent=finished?data.teams[0]+' '+match.score.away+' − '+match.score.home+' '+data.teams[1]:
   !result||sceneStage()==='preparation'?'第'+chartObservation.number+'球　投球準備':
   resultKnown?resultDisplay.label:frame.phase==='pitch'?'投球中':frame.phase==='batted'?'打球を追う':frame.phase==='throw'?'送球中':'プレー中';
  $('pitch-meta').textContent=resultKnown?(resultDisplay.change?resultDisplay.playLabel+'　':'')+result.speedKmh.toFixed(1)+' km/h　'+(result.pitchName??pitchNames[result.pitchType]??result.pitchType):
   !result||sceneStage()==='preparation'?(playerById[result?.batterPlayerId??state.batterPlayerId]?.name??'')+' の打席':'球の行方を追っています';
  const batterId=result?.batterPlayerId??state.batterPlayerId,pitcherId=result?.pitcherPlayerId??state.pitcherPlayerId;
  const batter={...playerById[batterId],hand:result?.play.diagnostics.battingSide??playerById[batterId].hand},pitcher=playerById[pitcherId];
  for(const [prefix,player]of [['pitcher',pitcher],['batter',batter]]){
   $(prefix+'-number').textContent=player?.number??'';$(prefix+'-name').textContent=player?.name??'';
   $(prefix+'-hand').textContent=prefix==='pitcher'?(player?.throws==='L'?'左投':'右投'):(player?.hand==='L'?'左打':'右打');
   $(prefix+'-hand').classList.toggle('left',(prefix==='pitcher'?player?.throws:player?.hand)==='L');
   const formNames={over:'オーバースロー',side:'サイドスロー',under:'アンダースロー',overhand:'オーバースロー',threequarter:'スリークォーター',sidearm:'サイドスロー',submarine:'アンダースロー'};
   const before=result?.beforeMatch??match;
   $(prefix+'-meta').textContent=player?(prefix==='pitcher'?(formNames[player.form]??player.form??'投手'):
    before.inning+'回'+(before.half==='top'?'表':'裏'))+' / '+Math.round(player.height*100)+'cm':'';
  }
  $('phase').textContent=finished?'試合終了':sceneStage()==='preparation'||!result?'投球準備':frame.phase==='ready'?'次球の指示待ち':
   frame.phase==='bench'?(resultDisplay?.change?'攻守交代':'プレー終了'):officialKnown&&result.play.classification==='foul'?'ファウル · タップで次へ':frame.possessedBy?'捕球・保持':
   frame.phase==='bench'?'攻守交代':frame.phase==='throw'?'送球':frame.phase==='batted'?'打球':frame.phase==='pitch'?'投球':'プレー';
  $('manager-hint').textContent=fast?'Coreで試合を計算中。停止は現在の投球が終わってから':finished?'試合終了。最終結果を確認できます':
   pauseAfterPitch&&playing?'指示変更を予約。この球の終了後に一時停止':
   pauseAfterPitch&&atEnd?'この球が終了 · 一時停止中。次の未生成球から指示が有効':
   playing?'新しい指示は次の投球から適用':'次の未生成球へ指示を適用します';
  $('manager-status').textContent='20選手の個別能力を適用中。初期値は編集できる暫定設定です。安打・本塁打の確率補正は使いません。';
  $('match-progress').textContent=state.pitchCount+'球 / '+(finished?'試合終了':'進行中');
  $('play').textContent=playing?'一時停止':finished?'試合を振り返る':'試合を進める';$('play').setAttribute('aria-pressed',String(playing));
  $('play').disabled=fast;$('finish-game').textContent=fast?'高速計算を止める':'残りを高速計算';
  $('finish-game').disabled=finished;$('previous-pitch').disabled=fast||selected<=0;
  $('next-pitch').disabled=fast||(state.finished&&selected>=records.length-1);
  $('inning-select').replaceChildren();$('pa-select').replaceChildren();
  const firstPitchByPlay=new Map();
  for(const [index,record]of records.entries()){
   const before=result?.beforeMatch??match;
   if(record.beforeMatch.inning!==before.inning||record.beforeMatch.half!==before.half)continue;
   if(firstPitchByPlay.has(record.beforeMatch.playId))continue;
   firstPitchByPlay.set(record.beforeMatch.playId,index);
   const option=document.createElement('option');option.value=String(index);
   const player=playerById[record.batterPlayerId];option.textContent=(player?.name??'打席')+'（'+(player?.hand==='L'?'左':'右')+'打）';$('pa-select').append(option);
  }
  $('pa-select').value=String(firstPitchByPlay.get(result?.beforeMatch.playId)??selected);$('pa-select').disabled=records.length===0||fast;
  const inningKeys=new Set(records.map(record=>record.beforeMatch.inning+'-'+record.beforeMatch.half));
  for(const key of inningKeys){const option=document.createElement('option');option.value=key;
   const [inning,half]=key.split('-');option.textContent=inning+'回'+(half==='top'?'表':'裏');$('inning-select').append(option);}
  $('inning-select').value=match.inning+'-'+match.half;$('inning-select').disabled=records.length===0||fast;
  const focusedPitch=$('pitch-list').contains(document.activeElement)?document.activeElement.dataset.pitchId:null;
  $('pitch-list').replaceChildren();
  for(const entry of chartObservation.history){
   const button=document.createElement('button'),number=document.createElement('span'),meta=document.createElement('span'),
    type=document.createElement('b'),speed=document.createElement('small'),result=document.createElement('span');
   number.textContent=String(entry.number);number.style.color=window.KneekuraPitchSymbols.colors[entry.category];type.textContent=entry.pitchType;
   speed.textContent=entry.speedKmh+' km/h';meta.append(type,speed);
   result.className='pitch-result';result.textContent=entry.resultLabel;
   button.append(number,meta,result);button.dataset.pitchId=entry.pitchId;button.setAttribute('aria-pressed',String(entry.pitchId===chartObservation.selectedPitchId));
   button.setAttribute('aria-label',entry.number+'球目 '+entry.pitchType+' '+entry.speedKmh+'キロ '+entry.resultLabel);
   button.onclick=()=>{selectedMark=entry.pitchId;draw();};$('pitch-list').append(button);
   if(entry.pitchId===focusedPitch)button.focus({preventScroll:true});
  }
  chart.draw(chartObservation);
  $('announcement').textContent=resultKnown?result.beforeMatch.inning+'回'+(result.beforeMatch.half==='top'?'表':'裏')+'、'+batter.name+'、'+chartObservation.number+'球目、'+resultDisplay.label:'';
 }
 const liveAudioV100=window.KneekuraAudioV100.create();
 window.KneekuraAudioV100.installControls(document.querySelector('.settings')?.parentElement??document.body);
 function draw(){
  syncPitchMenuV78();const result=activeResult(),state=host.inspect();
  currentFrame=result?(sceneStage()==='preparation'?result.beforeFrame:presentedFrameV1(result,frameIndex)):state.frame;
  refreshPitchBall(performance.now());lastCadenceBoundaryV81=cadenceBoundaryV81();
  const batterId=result?.batterPlayerId??state.batterPlayerId,pitcherId=result?.pitcherPlayerId??state.pitcherPlayerId;
  const battingSide=result?.play.diagnostics.battingSide??playerById[batterId].hand;
   actorAnimation=window.KneekuraLiveActorAnimation.observe({record:result,frame:currentFrame,sceneMs,
    preparationMs:timing.preparationMs,measuredClip:measured.clips.find(clip=>clip.id===result?.play.diagnostics.measuredClipId)});
  const actors=currentFrame.actors.map(actor=>sourceActor(actor,batterId,battingSide));
  const batter={...playerById[batterId],hand:battingSide},pitcher={...playerById[pitcherId],hand:playerById[pitcherId].throws??'R'};
  const first=result?.frames[0],contact=result?.frames.find(frame=>frame.ballKind==='batted'),
   catchSeconds=result?.play.diagnostics.catcherContactElapsedSeconds;
  const localTick=result?(sceneStage()==='preparation'?sceneMs/55:28+(currentFrame.tick-first.tick)/55000):0,
   contactLocal=contact?28+(contact.tick-first.tick)/55000:null;
  const releasing=result&&sceneStage()==='preparation'&&sceneMs>=timing.preparationMs-55,
   flyingPitch=result&&sceneStage()==='physical'&&currentFrame.phase==='pitch'&&currentFrame.ballKind==='pitch'
    &&currentFrame.ball&&currentFrame.ball.visible!==false&&!currentFrame.possessedBy;
  pitchMarksOpacity=(releasing||flyingPitch)? .06:1;
  chartObservation=Object.freeze({...chart.observe({records,pitchIndex:preparingPitchV99&&records[selected]?.play.rules.batterAdvanced?-1:selected,atTick:currentFrame.tick,batterHeightMeters:batter.height,battingSetupV94:result?.play.diagnostics.battingSetupV94??window.KneekuraBattingSetupViewV94.resolveBatter(batter),selectedPitchId:selectedMark}),marksOpacity:pitchMarksOpacity});
  const ball=currentFrame.ball&&currentFrame.ball.visible!==false&&!currentFrame.possessedBy?{...currentFrame.ball,
   sourceObservation:true,ballKind:currentFrame.ballKind}:null;
  let displayBall=(playing||continuousPitchObservationV81)&&currentFrame.ballKind==='pitch'&&pitchBallActive&&pitchBallSample?pitchBallSample:ball;
  whiffFollowThroughV88=whiffFollowThroughControllerV88.observe({record:result,frame:currentFrame,sceneMs,preparationMs:timing.preparationMs,
   measuredClip:measured.clips.find(clip=>clip.id===result?.play.diagnostics.measuredClipId),bodyBatFrame:actorAnimation.batFrame});
  const batSourceV88=whiffFollowThroughV88?whiffFollowThroughV88.bat:currentFrame.bat;
  const bat=batSourceV88?{...batSourceV88,sourceObservation:true}:null;
  fieldCameraObservation=result?window.KneekuraLiveFieldCamera.observe({record:result,frame:currentFrame,bases:core.LIVE_MATCH_BASES_V1,
   defaultObserverPlayerId:currentFrame.fieldObserverPlayerId}):null;
  pitcherBodyHeadView=window.KneekuraPitcherBodyHeadView.observe({record:result,frame:currentFrame,sceneMs,preparationMs:timing.preparationMs,
   pitcherActor:actors.find(actor=>actor.id==='P'),moundSurfacePosition:state.moundSurfacePosition});
  pitcherReactionView=window.KneekuraLivePitcherReactionView.observe({record:result,frame:currentFrame,sceneMs,
   preparationMs:timing.preparationMs,pitcherActor:actors.find(actor=>actor.id==='P'),pitcherBodyHeadView});
  homeRunWatchV83=homeRunWatchControllerV83.observe({record:result,frame:currentFrame,sceneMs,preparationMs:timing.preparationMs,selectedCamera:options.camera,
   cameraAt:(sample,sampleSceneMs)=>{
    const field=window.KneekuraLiveFieldCamera.observe({record:result,frame:sample,bases:core.LIVE_MATCH_BASES_V1,defaultObserverPlayerId:sample.fieldObserverPlayerId}),
     sourceActors=sample.actors.map(actor=>sourceActor(actor,batterId,battingSide)),
     reaction=window.KneekuraLivePitcherReactionView.observe({record:result,frame:sample,sceneMs:sampleSceneMs,preparationMs:timing.preparationMs,pitcherActor:sourceActors.find(actor=>actor.id==='P')});
    return {camera:baseCameraForV83(sample,sourceActors,field,reaction),observerPlayerId:field?.observerPlayerId??sample.fieldObserverPlayerId};
   }});
  if(homeRunWatchV83?.displayBall)displayBall={...homeRunWatchV83.displayBall,sourceObservation:true,ballKind:'batted'};
  continuousBatterView=window.KneekuraContinuousBatterView.observe({record:result,frame:currentFrame,sceneMs,preparationMs:timing.preparationMs,
   batter:{...batter,physical:players.find(player=>player.playerId===batterId)?.physical},previousRecord:selected>0?records[selected-1]:null});
  takenPitchGaze=window.KneekuraLiveTakenPitchGaze.observe({record:result,frame:currentFrame,sceneMs,preparationMs:timing.preparationMs});
  catcherFollow=observeCatcher(result,currentFrame);
  batterGaze=window.KneekuraLiveBatterGaze.observe({record:result,frame:currentFrame,sceneMs,preparationMs:timing.preparationMs});
  const world={liveOriginalVisualV1:(()=>{const p=result?.play?.diagnostics?.loosePitchV1?.sourceProvenance,id=p?.selection??p?.sourceId;return result?.pitcherPlayerId==='robin'&&currentFrame.ballKind==='pitch'&&p&&typeof id==='string'?{pitchId:id}:null})(),liveBaseUmpireCalls:window.KneekuraBaseUmpireCallsV1.observe(result,currentFrame.tick),liveUmpireArtV1:window.KneekuraArtBankV1?.umpireArt({record:result,frame:currentFrame,preparing:sceneStage()==='preparation',ordinal:selected,sceneMs,preparationMs:timing.preparationMs}),liveObservation:true,awayHit:!!(result && result.beforeMatch.half==='top' && result.play.localScoringV100?.status==='confirmed' && result.play.localScoringV100.hits===1 && currentFrame.tick>=result.play.localScoringV100.atTick),liveBattingSetupV94:result?.play.diagnostics.battingSetupV94??window.KneekuraBattingSetupViewV94.resolveBatter(batter),livePark:state.fenceGeometry,liveBattedObservation:currentFrame.ballKind==='batted'||currentFrame.ballKind==='throw',
   liveFieldObserverPlayerId:homeRunWatchV83?.observerPlayerId??fieldCameraObservation?.observerPlayerId??currentFrame.fieldObserverPlayerId??null,
    liveFieldGazeV99:result?.play.field&&currentFrame.ballKind!=='pitch'&&(options.camera==='fielder'||options.camera==='mound')?window.KneekuraLiveFieldGazeV99.observe({record:result,frame:currentFrame,bases:core.LIVE_MATCH_BASES_V1,defaultObserverPlayerId:fieldCameraObservation?.observerPlayerId??currentFrame.fieldObserverPlayerId,eyeHeightMeters:(actors.find(a=>a.sourcePlayerId===(fieldCameraObservation?.observerPlayerId??currentFrame.fieldObserverPlayerId))?.player.height??1.79)*.92}):null,
    liveFieldCameraTarget:homeRunWatchV83?.target??fieldCameraObservation?.target??null,liveCatcherCameraTarget:catcherFollow?.target??(options.camera==='catcher'?window.KneekuraLiveFieldCamera.catcherBaseGlance({record:result,frame:currentFrame,bases:core.LIVE_MATCH_BASES_V1})?.target:null)??null,
   liveBatterCameraTarget:batterGaze?.target??null,
    livePitcherBodyHeadView:pitcherBodyHeadView,liveDefensiveOpportunity:currentFrame.defensiveOpportunity,livePitcherReactionView:pitcherReactionView,liveContinuousBatterView:continuousBatterView,liveTakenPitchGaze:takenPitchGaze,livePitchMarksOpacity:pitchMarksOpacity,tick:currentFrame.tick,localTick,batter,pitcher,actors,ball:displayBall,bat,
   liveBallExactFrameTick:!!ball&&displayBall===ball,liveRunnerDirection:currentFrame.actors.find(actor=>actor.playerId===batterId)?.velocity??null,
   liveBatterRunStarted:result?.batterRunStartedAtTick!=null&&currentFrame.tick>=result.batterRunStartedAtTick,
   p:{contactLocal,catchLocal:Number.isFinite(catchSeconds)?28+catchSeconds/.055:null,swing:result?.play.diagnostics.swingOffered??false,
    outcome:currentFrame.homeRunConfirmed?'HR':null,actors:[],presentationEvidence:null},
    batFrame:actorAnimation.batFrame,pitchFrame:actorAnimation.pitchFrame,fair:false,fairKnown:currentFrame.fairKnown,custody:currentFrame.possessedBy,
   ballKind:currentFrame.ballKind,benchReturn:currentFrame.phase==='bench',officialKnown:!!currentFrame.homeRunConfirmed||!!result&&currentFrame.tick>=result.play.rules.endedAtTick,
   phase:currentFrame.phase,history:chartObservation.history};
  cadence.sceneDraws++;cadence.lastSceneMs=sceneMs;
  const camera=cameraFor(currentFrame,actors);// C3: the pitch chart stays in every view
  const fielderEyesV1=camera==='fielder'?world.liveFieldObserverPlayerId:null;
  window.KneekuraLiveBroadcastView.before({camera,playing,sceneMs,record:result,observer:fielderEyesV1});
  const drawStartedV1=performance.now();
  rendered=visual.liveDrawWorld(world,{...options,camera,selectedPitch:chartObservation.selectedPitchId,battedTrail:battedTrailPoints(result,currentFrame,camera)});
  if(playing)window.KneekuraPresentationControlsV84.noteDraw(performance.now()-drawStartedV1);
  $('camera-caption').textContent=cameras[camera];
  window.KneekuraLiveBroadcastView.after({camera,labels:cameras,observerName:actors.find(a=>a.sourcePlayerId===fielderEyesV1)?.player.name??null,contactReached:!!contact&&sceneStage()!=='preparation'&&currentFrame.tick>=contact.tick});
  document.querySelectorAll('[data-camera]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.camera===camera)));
  document.querySelectorAll('[data-appearance]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.appearance===options.appearance)));
  const runners=actors.filter(actor=>actor.role==='runner');$('runner-presence').hidden=camera==='overhead'||!runners.length;
  if(runners.length)$('runner-presence').textContent='走者 '+runners.map(actor=>actor.player.name).join(' ・ ');
  syncUi(result,sceneEnded(),currentFrame);
  liveAudioV100.observe({record:result,tick:currentFrame.tick,playing:playing&&!fast&&sceneStage()!=='preparation'});
  if(state.finished&&selected===records.length-1&&sceneEnded())season.playbackEnded();
  if(lastFailure){$('result-text').textContent='Core処理を停止';$('manager-hint').textContent=lastFailure;}
 }
 let issuePendingV116=null;
 function backgroundFailureV116(error){if(error?.name==='AbortError')return;fail(error);draw();}
 async function issue(){
  if(issuePendingV116)return issuePendingV116;
  const thisHost=host,thisGame=gameToken,work=(async()=>{
  if(host.inspect().finished)return null;
  lastFailure=null;lastFailureDetails=null;
  const before=host.inspect(),beforeLine=before.line,beforeFrame=before.frame,result=await thisHost.issuePitch(command());if(result?.play?.intentionalWalkV1&&$('location-choice').value==='intentional')$('location-choice').value='auto';
  if(thisGame!==gameToken||host!==thisHost||!result)return null;
  if(!result.frames.length)throw new Error('Core returned no live observations');
  const batterRunStartedAtTick=result.frames.find(frame=>frame.actors.some(actor=>actor.playerId===result.batterPlayerId&&
   actor.role==='runner'&&vecLength(actor.velocity)>0))?.tick??null;
  season.acceptPitch(result);records.push({...result,beforeLine,beforeFrame,batterRunStartedAtTick});
  window.KneekuraLiveMatchContactV252.acceptAfterHistory(core,result,before.pitchCount,thisHost.inspect().pitchCount);selected=records.length-1;frameIndex=0;sceneMs=0;skipAtMs=null;selectedMark=null;thisHost.prefetch(command());return records[selected];
 
  })();
  issuePendingV116=work;try{return await work;}finally{if(issuePendingV116===work)issuePendingV116=null;}
 }
 function animate(){
  const result=activeResult();if(!result)return;
  playing=true;playStart=performance.now();playFromMs=sceneMs;const clock=++token;lastDraw=-Infinity;lastPitchBall=-Infinity;pitchBallActive=false;pitchBallSample=null;draw();
  function update(now){
   if(!playing||clock!==token)return;
   const target=playFromMs+Math.max(0,now-playStart)*(Number($('speed').value)||1);
   setSceneTime(skipAtMs!==null&&target>=skipAtMs?sceneTiming(result).durationMs:target);
   const atEnd=sceneEnded(),boundaryV81=cadenceBoundaryV81(),boundaryChangedV81=!sameCadenceBoundaryV81(lastCadenceBoundaryV81,boundaryV81),
    cadenceFrameV84=activeResult()?(sceneStage()==='preparation'?activeResult().beforeFrame:activeResult().frames[frameIndex]):currentFrame,
    periodV81=window.KneekuraPresentationControlsV84.intervalMs({kind:cadenceFrameV84?.ballKind,
     free:boundaryV81[7]||cadenceFrameV84?.ballKind==='batted'&&cadenceFrameV84?.ball?.visible!==false&&!cadenceFrameV84?.possessedBy&&!cadenceFrameV84?.ball?.possessedBy&&!cadenceFrameV84?.ball?.custody,
     possessed:cadenceFrameV84?.possessedBy}),elapsedV81=now-lastDraw;
   // V84 shared whole-scene frequency; pitch 2.5x and free batted 2x, capped by
   // the single RAF loop. Contact/custody/visibility changes bypass the period.
   if(elapsedV81>=periodV81||atEnd||boundaryChangedV81){
    if(boundaryChangedV81)cadence.boundaryRedraws++;
    draw();lastDraw=!Number.isFinite(lastDraw)||boundaryChangedV81&&elapsedV81<periodV81?now:
     lastDraw+Math.max(1,Math.floor(elapsedV81/periodV81))*periodV81;
   }
   if(atEnd){
    stop(false);
    if(!pauseAfterPitch&&(selected<records.length-1||!host.inspect().finished)){
     if(selected<records.length-1){selected++;setSceneTime(0);skipAtMs=null;selectedMark=null;animate();}
     else {const nextToken=token,nextGame=gameToken;preparingSceneV99=sceneMs;preparingPitchV99=true;sceneMs=0;frameIndex=0;draw();
      requestAnimationFrame(()=>requestAnimationFrame(async()=>{if(nextToken!==token||nextGame!==gameToken||!preparingPitchV99)return;
       const heldV1=window.KneekuraManagerGateV1?.holdBeforePitch?.();if(heldV1){await heldV1;if(nextToken!==token||nextGame!==gameToken||!preparingPitchV99)return;pauseAfterPitch=false;}
       preparingPitchV99=false;preparingSceneV99=null;try{const result=await issue();if(result&&nextToken===token&&nextGame===gameToken&&!pauseAfterPitch&&!fast)animate();else draw();}catch(error){backgroundFailureV116(error);}}));}

    }else draw();return;
   }requestAnimationFrame(onFrame);
  }
  function onFrame(now){try{update(now);}catch(error){fail(error);draw();}}
  requestAnimationFrame(onFrame);
 }
 async function play(){
  const thisGame=gameToken;
  if(issuePendingV116){pauseAfterPitch=true;return;}
  if(preparingPitchV99){stop();draw();return;}
  if(fast)return;
  if(playing){stop();pauseAfterPitch=true;draw();return;}
  pauseAfterPitch=false;
  if(!activeResult()||sceneEnded()){
   if(selected<records.length-1){selected++;setSceneTime(0);skipAtMs=null;selectedMark=null;}
   else if(!await issue()){if(thisGame!==gameToken)return;selected=0;setSceneTime(0);skipAtMs=null;selectedMark=null;}
  }if(thisGame===gameToken&&!pauseAfterPitch&&!fast)animate();
 }
 function selectPitch(index,replay){stop();pauseAfterPitch=true;selected=Math.max(0,Math.min(records.length-1,index));setSceneTime(0);skipAtMs=null;selectedMark=null;draw();if(replay)animate();}
 async function finish(){
  if(fast){fast=false;return;}
  stop();fast=true;pauseAfterPitch=true;const thisGame=gameToken;
  if(records.length){selected=records.length-1;setSceneTime(sceneTiming(activeResult()).durationMs);draw();}
  try{while(fast&&thisGame===gameToken&&!host.inspect().finished){const next=await issue();if(!next||thisGame!==gameToken)break;setSceneTime(sceneTiming(activeResult()).durationMs);draw();await new Promise(resolve=>setTimeout(resolve,0));}}
  catch(error){if(thisGame===gameToken)backgroundFailureV116(error);}
  finally{if(thisGame===gameToken){fast=false;draw();}}
 }
 function fail(error){lastFailure=error.message;lastFailureDetails={name:error.name,message:error.message,stack:error.stack,cause:error.cause??null};
  stop();fast=false;pauseAfterPitch=true;$('announcement').textContent='Core処理を停止: '+error.message;
  $('result-text').textContent='Core処理を停止';$('manager-hint').textContent=error.message;console.error(error);}
 function policyAckUi(event){const label=$('worker-ack-status'),cancel=$('worker-ack-cancel');if(event.phase==='WAITING'){label.hidden=false;cancel.hidden=false;label.textContent='試合を準備しています。';}else if(event.phase==='ACKNOWLEDGED'){label.hidden=true;cancel.hidden=true;label.textContent='';}else if(event.phase==='FAILED'){label.hidden=false;cancel.hidden=true;label.textContent='試合の準備に失敗しました: '+event.message;}else if(event.phase==='CANCELLED'){label.hidden=false;cancel.hidden=true;label.textContent='試合の準備を取り消しました。';}else{label.hidden=true;cancel.hidden=true;label.textContent='';}}
 $('worker-ack-cancel').onclick=()=>{host.invalidate();issuePendingV116=null;policyAckUi({phase:'CANCELLED'});};
 function createGame(randomize=false){policyAckUi({phase:'IDLE'});park=parkForStadium();
  const selectedPitcher=$('home-pitcher-choice').value;teams[1].pitcherId=selectedPitcher;teams[1].defense.P=selectedPitcher;for(const team of [0,1]){const lineup=window.KneekuraPregameLineupV1?.team(team);if(lineup){teams[team].battingOrder=lineup.battingOrder;Object.assign(teams[team].defense,lineup.defense);}}
  season.commitCompleted();const entry=pendingRoster.entries.find(e=>e.playerId==='robin');if(!entry)throw Error('ロビンが能力データにありません');entry.physical={...entry.physical,pitchRepertoireV78:robinRepertoire};delete entry.physical.pitchRepertoire;const configured=core.applyLivePhysicalRosterV1({players:basePlayers,roster:pendingRoster});
  let seedText=$('match-seed').value;
  if(randomize&&!$('fixed-seed').checked){const random=new Uint32Array(1);crypto.getRandomValues(random);seedText='TBD-LAD-'+random[0];}
  const nextAutoDirectionV250=$('match-auto-direction-v250').value,
   nextAutoDirectionPolicyV250=window.KneekuraMatchAutoDirectionV250.forNextGame(core,nextAutoDirectionV250,false),
   nextConfiguration={seedText,seed:hashSeed(seedText),innings:Number($('inning-limit').value)||9},
   nextSeason=season.prepareGame({players:configured.players,seed:nextConfiguration.seed}),
    workerConfigurationV116=window.KneekuraLiveExecutionV122.decorate({...(EXPERIMENTAL_UI_POLICIES_V2?{experimentalMatchPoliciesV2:EXPERIMENTAL_UI_POLICIES_V2}:{}),seed:nextConfiguration.seed,innings:nextConfiguration.innings,teams,players:nextSeason.players,park,measuredClips:measured.clips,...nextAutoDirectionPolicyV250}),
    nextHost=window.KneekuraBackgroundMatchV116.create({configuration:workerConfigurationV116,onPolicyAckStatus:policyAckUi,initialHost:EXPERIMENTAL_UI_POLICIES_V2?core.createExperimentalMatchHostV2(workerConfigurationV116,EXPERIMENTAL_UI_POLICIES_V2):core.createLiveBaseballMatchV1(workerConfigurationV116)});
  stop();fast=false;gameToken++;globalThis.__robinAcceptedContinuation=null;globalThis.__robinTrialEvidence=null;records=[];selected=-1;frameIndex=0;sceneMs=0;skipAtMs=null;selectedMark=null;pauseAfterPitch=false;lastFailure=null;lastFailureDetails=null;
  $('match-seed').value=seedText;activeConfiguration=nextConfiguration;activeAutoDirectionV250=nextAutoDirectionPolicyV250;
  $('match-auto-direction-status-v250').dataset.active=nextAutoDirectionV250==='observed'?'観測に応じて両軍へ適用':'従来';$('match-auto-direction-status-v250').textContent='現試合: '+$('match-auto-direction-status-v250').dataset.active;
  players=nextSeason.players;globalThis.__robinObservedConfiguration=workerConfigurationV116;physicalRosterAudit=configured.audit;activeRoster=structuredClone(pendingRoster);
  playerById=Object.fromEntries(Object.values(data.players).map(player=>{const configured=players.find(candidate=>candidate.playerId===player.id);return[player.id,{...player,
   height:configured?.heightMeters??player.height,hand:configured?.bats??player.hand,throws:configured?.throws??player.throws,physical:configured?.physical}];}));
  host?.dispose?.();issuePendingV116=null;host=nextHost;window.KneekuraPresentationVisualExperimentV1.init(nextHost.inspect().frame,nextHost.inspect().pitchCount);season.beginGame(nextSeason);window.KneekuraLiveMatchContactV252.reset(core,playerById);draw();
 }
 visual.seek(0);
 $('play').onclick=()=>{play().catch(backgroundFailureV116);};
 $('next-pitch').onclick=async()=>{try{const thisGame=gameToken;stop();pauseAfterPitch=true;if(selected<records.length-1){selected++;setSceneTime(0);skipAtMs=null;selectedMark=null;}else await issue();if(thisGame===gameToken)draw();}catch(error){backgroundFailureV116(error);}};
 $('previous-pitch').onclick=()=>{if(records.length)selectPitch(selected-1,false);};
 $('restart').onclick=()=>{if(records.length)selectPitch(0,false);else draw();};
 $('new-game').onclick=()=>{try{createGame(true);}catch(error){fail(error);}};
 $('match-auto-direction-v250').onchange=()=>{$('match-auto-direction-status-v250').textContent='現試合: '+$('match-auto-direction-status-v250').dataset.active+'（変更は次の試合から）';};
 $('finish-game').onclick=finish;
 $('pa-select').onchange=event=>selectPitch(Number(event.target.value),false);
 $('inning-select').onchange=event=>{const index=records.findIndex(record=>record.beforeMatch.inning+'-'+record.beforeMatch.half===event.target.value);if(index>=0)selectPitch(index,false);};
 $('speed').onchange=()=>{if(playing){const requestedPause=pauseAfterPitch;stop();pauseAfterPitch=requestedPause;animate();}};
 for(const id of ['batting-choice','pitch-choice','location-choice','managed-team','baserunning-choice'])$(id).addEventListener('change',()=>{
  host.invalidate(command());issuePendingV116=null;pauseAfterPitch=true;$('manager-hint').textContent=playing?'指示変更を予約。この球の終了後に一時停止':'次の未生成球へ指示を適用します';
 });
 document.querySelectorAll('[data-camera]').forEach(button=>button.onclick=()=>{options.camera=button.dataset.camera;
  if(currentFrame.fairKnown){options.autoOverhead=false;$('auto-overhead').checked=false;}draw();});
 document.querySelectorAll('[data-appearance]').forEach(button=>button.onclick=()=>{options.appearance=button.dataset.appearance;
  try{localStorage.setItem('kneekura.presentation.actorAppearance.v1',options.appearance);}catch{}draw();});
 for(const [id,key]of [['auto-overhead','autoOverhead'],['home-close','homeClose'],['labels','labels'],['zone','zone'],['history','history']])$(id).onchange=event=>{options[key]=event.target.checked;draw();};
 $('history').checked=true;$('history').disabled=false;
 $('zoom').oninput=event=>{options.zoom=Number(event.target.value)/100;$('zoom-value').textContent=event.target.value+'%';draw();};
 $('field').onclick=event=>{
  const result=activeResult();if(!result)return;
  const layout=sceneTiming(result),officialAt=timing.preparationMs+layout.officialMs;
  if(layout.thirdOut&&sceneMs>=officialAt+1000)skipAtMs=sceneMs;
  else if(result.play.classification==='foul'&&sceneMs>=officialAt)skipAtMs=Math.max(sceneMs,officialAt+2000);
  else if(rendered.camera==='runner'&&currentFrame.fairKnown&&currentFrame.tick>=result.play.rules.endedAtTick)skipAtMs=sceneMs;
  else{
   const rect=event.currentTarget.getBoundingClientRect(),x=(event.clientX-rect.left)*600/rect.width,y=(event.clientY-rect.top)*432/rect.height;
   const mark=[...(rendered.historyMarks??[])].reverse().find(mark=>Math.hypot(mark.x-x,mark.y-y)<(mark.hitRadius??mark.r+9));
   if(mark){selectedMark=mark.pitchId;draw();}
  }
  if(skipAtMs!==null&&!playing){setSceneTime(layout.durationMs);draw();}
 };
 $('export-game').onclick=()=>{
  const {history,frame,...state}=host.inspect();
  const report={schema:'offline_core_match_summary_v1',authority:'OFFLINE_HOST_SHARED_CORE',nativeSqliteAdmission:false,
   seed:activeConfiguration.seedText,numericSeed:activeConfiguration.seed,state,
   configuration:{...window.KneekuraMatchAutoDirectionV250.summary(activeAutoDirectionV250),innings:activeConfiguration.innings,teams,players,physicalRoster:activeRoster,physicalRosterAudit,park,measuredSourceCommit:measured.sourceCommit,
    measuredClipIds:measured.clips.map(clip=>clip.id)},
   pitches:records.map(record=>({beforeMatch:record.beforeMatch,match:record.match,command:record.command,
    events:record.events,play:{classification:record.play.classification,call:record.play.call,contact:record.play.contact,rules:record.play.rules,
     field:record.play.field?{facts:record.play.field.facts,ruleFacts:record.play.field.ruleFacts,end:record.play.field.end,finalFrame:record.play.field.frames.at(-1),finalRunners:record.play.field.finalRunners,diagnostics:record.play.field.diagnostics}:null},
    frameCount:record.frames.length,fieldFrameCount:record.play.field?.frames.length??0})),
   omittedFields:['presentation frames','field frames','state.history'],frameHashesIncluded:false,
   calibration:'EXPLICIT_REFERENCE_SI_NOT_EMPIRICAL_NAMED_PLAYER_CALIBRATION',gameStatisticsV79:season.exportGame(),courseSeasons:season.getState()};
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download='kneekura-core-match.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const rosterPanel=document.createElement('details');rosterPanel.id='roster-controls';rosterPanel.style.padding='12px 18px';
 const summary=document.createElement('summary');summary.textContent='選手メーカーの能力を読み込む';rosterPanel.append(summary);
 const rosterNote=document.createElement('p');rosterNote.textContent='「試合用能力JSON」または試合用能力を含むメーカー設定を選択します。変更は「新しい試合」から適用されます。';rosterPanel.append(rosterNote);
 const rosterFile=document.createElement('input');rosterFile.id='physical-roster-file';rosterFile.type='file';rosterFile.accept='.json,application/json';rosterFile.setAttribute('aria-label','試合用能力JSON');rosterPanel.append(rosterFile);
 const rosterSave=document.createElement('button');rosterSave.id='save-physical-roster';rosterSave.textContent='能力JSONを保存';rosterPanel.append(rosterSave);
 const rosterStatus=document.createElement('p');rosterStatus.id='physical-roster-status';rosterStatus.setAttribute('role','status');rosterStatus.textContent='初期の選手設定を使用します。';rosterPanel.append(rosterStatus);
 document.querySelector('details.settings').after(rosterPanel);
 const robinPanel=document.createElement('section');robinPanel.innerHTML='<h3>ロビン 投手メーカー候補</h3><p>210 km/h直球の現Core近似です。旧Type 3〜6はこのメーカーで扱いません。ロビンの確認用素材は捕手視点の一部姿勢に表示します。未採用です。6球種を保持し、設定した球種だけ更新します。保存JSONの読み込み後は新しい試合で反映します。</p><label>球種 <select id=robin-type><option value=fastball>直球</option><option value=slider>スライダー</option><option value=curve>カーブ</option><option value=forkball>フォーク</option><option value=changeup>チェンジアップ</option><option value=sinker>シンカー</option></select></label><label>初速 km/h <input id=robin-speed type=number min=18 max=306 value=210></label><label>回転倍率 <input id=robin-spin type=number min=0 max=4 step=0.1 value=1></label><button id=robin-make>球を設定</button><button id=robin-trial>共通Coreで試投（見送り）</button><canvas id=robin-plot width=480 height=200 aria-label=試投の横から見た球の軌跡></canvas><p>標準球種は現Coreの物理設定例で、旧ロビン球の再現ではありません。試投は現在の試合状態で次球を見送りとして計算します。ロビンが投手で、操作チームが守備側のときに使えます。疲労設定を含む試合の試投は未対応です。</p><button id=robin-save>snapshotを保存</button><input id=robin-load type=file accept=.json,application/json aria-label=ロビン投球snapshot><p id=robin-status role=status></p>';rosterPanel.after(robinPanel);
 $('robin-make').onclick=()=>{try{const type=$('robin-type').value,speed=Number($('robin-speed').value)/3.6,scale=Number($('robin-spin').value);if(!Number.isFinite(scale)||scale<0||scale>4)throw Error('回転倍率は0〜4です');const previous=robinRepertoire.pitches.find(p=>p.pitchType===type);if(!previous)throw Error('球種が登録されていません');const row=core.createPitchSnapshotFromPresetV78({presetId:type,pitchId:previous.pitchId,physical:robinPhysical,throws:'R'}),spin=row.spinRadPerSecond;robinRepertoire=core.validatePitchRepertoireV78({version:'pitch_repertoire_v78',pitches:robinRepertoire.pitches.map(p=>p.pitchId===previous.pitchId?{...row,releaseSpeedMps:speed,spinRadPerSecond:{x:spin.x*scale,y:spin.y*scale,z:spin.z*scale}}:p)},85);$('robin-status').textContent='設定しました。新しい試合から反映します。';}catch(e){$('robin-status').textContent=e.message}};
 $('robin-trial').onclick=()=>{try{const state=host.inspect(),count=state.pitchCount,ordinal=count+1,cmd=command();if(state.finished)throw Error('試合は終了しています');if(state.pitcherPlayerId!=='robin'||cmd.managedTeam!==1||!cmd.pitchId)throw Error('ロビンが投手の守備側で球種を選択してください');if(count>0&&(!globalThis.__robinAcceptedContinuation||readMatchContinuation(globalThis.__robinAcceptedContinuation).pitchCount!==count))throw Error('直前の試合状態を確認できません');if(globalThis.__robinObservedConfiguration.workloadV122)throw Error('疲労設定を含む試合の試投は未対応です');const p=players.find(p=>p.playerId==='robin'),row=p?.physical?.pitchRepertoireV78?.pitches.find(row=>row.pitchId===cmd.pitchId);if(!row||JSON.stringify(p.physical.pitchRepertoireV78)!==JSON.stringify(robinRepertoire))throw Error('設定後に新しい試合を開始してください');const seed=(activeConfiguration.seed+Math.imul(ordinal,0x9e3779b9))>>>0,originTick=count?readMatchContinuation(globalThis.__robinAcceptedContinuation).nextTick:1000000,m=state.match,input=core.buildPitcherWorkbenchInputV77({players,pitcherId:'robin',batterId:state.batterPlayerId,catcherId:teams[1].defense.C,measuredClips:measured.clips.filter(c=>c.side===players.find(x=>x.playerId===state.batterPlayerId).bats&&c.defaultSelection!==false),seed,originTick,pitchType:row.pitchType,pitchId:row.pitchId,pitchSituationV111:{balls:m.balls,strikes:m.strikes,outs:m.outs,occupiedBases:{first:m.bases.first!==null,second:m.bases.second!==null,third:m.bases.third!==null}},location:cmd.location}),trial=core.simulatePitcherWorkbenchV77({pitch:{...input,...(globalThis.__robinObservedConfiguration.randomnessV152?{randomnessV152:core.deriveLivePlayRandomnessV152(globalThis.__robinObservedConfiguration.randomnessV152,ordinal)}:{})}}),c=$('robin-plot'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.beginPath();const duration=trial.metrics.flightSeconds;for(let i=0;i<=60;i++){const ball=trial.sampleAtPitchElapsedSeconds(duration*i/60);const x=20+440*i/60,y=180-ball.position.y*55;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke();globalThis.__robinTrialEvidence={seed,ordinal,originTick,pitchId:trial.pitch.pitchId,source:trial.pitch.diagnostics.sourceDescriptor};$('robin-status').textContent='次の'+ordinal+'球目を試投しました。横軸は投球経過、縦軸は高さです。seed '+seed;}catch(e){$('robin-status').textContent='試投できません: '+e.message}};
 $('robin-save').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(robinRepertoire,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='robin-pitch-snapshot.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
 $('robin-load').onchange=async()=>{try{const r=core.validatePitchRepertoireV78(JSON.parse(await $('robin-load').files[0].text()),85);if(r.pitches.some(p=>!robinPitchTypes.includes(p.pitchType))||new Set(r.pitches.map(p=>p.pitchType)).size!==r.pitches.length)throw Error('対応する球種を重複なく選んでください');const incoming=new Map(r.pitches.map(p=>[p.pitchType,p]));robinRepertoire=core.validatePitchRepertoireV78({version:'pitch_repertoire_v78',pitches:robinRepertoire.pitches.map(p=>incoming.get(p.pitchType)??p)},85);$('robin-status').textContent='読み込みました。新しい試合から反映します。'}catch(e){$('robin-status').textContent=e.message}};
 rosterFile.onchange=async()=>{try{
  const file=rosterFile.files[0];if(!file)return;if(file.size>256_000_000)throw Error('能力・シーズンJSONは256MB以内にしてください');
  const raw=JSON.parse(await file.text()),packet=raw.livePhysicalRoster??raw,
   ids=rosterCatalog.players.map(player=>player.playerId).sort();
  if(packet.version!=='live_physical_roster_v1'||!Array.isArray(packet.entries))throw new Error('試合用能力JSONの形式を確認してください');
  const supplied=packet.entries.map(entry=>entry.playerId).sort(),missing=ids.filter(id=>!supplied.includes(id));
  if(new Set(supplied).size!==supplied.length||supplied.some(id=>!ids.includes(id))||missing.length>1||missing.some(id=>!['robin','1-p0'].includes(id)))throw new Error('選手IDが不足、重複、または未登録です');
  const savedRobin=packet.entries.find(entry=>entry.playerId==='robin')??defaultRoster.entries.find(entry=>entry.playerId==='robin');
  const oldEntries=packet.entries.filter(entry=>entry.playerId!=='robin');
  if(!oldEntries.some(entry=>entry.playerId==='1-p0'))oldEntries.push(structuredClone(defaultRoster.entries.find(entry=>entry.playerId==='1-p0')));
  const originalPacket={...packet,entries:oldEntries};
  const migratedOriginal=core.materializeLivePlateVisionV1({roster:originalPacket,reference:publicReference}).roster;
  const migrated={...migratedOriginal,entries:[...migratedOriginal.entries,structuredClone(savedRobin)]};
  const importedRepertoire=savedRobin.physical?.pitchRepertoireV78?core.validatePitchRepertoireV78(savedRobin.physical.pitchRepertoireV78,savedRobin.physical.maximumPitchSpeedMps??85):null;
  const candidate=core.applyLivePhysicalRosterV1({players:basePlayers,roster:migrated});
   const nextCourseSeasons=raw.courseSeasons===undefined?null:season.validateState(raw.courseSeasons);
    core.createLiveBaseballMatchV1({seed:hashSeed($('match-seed').value),innings:Number($('inning-limit').value)||9,
    teams,players:candidate.players,park,measuredClips:measured.clips});if(nextCourseSeasons)season.replaceState(nextCourseSeasons);pendingRoster=structuredClone(migrated);if(importedRepertoire)robinRepertoire=importedRepertoire;season.render();
  rosterStatus.textContent=(missing.length?'旧形式を読み込み、不足投手を既定値で補いました。':'全選手を読み込みました。')+'「新しい試合」から適用されます。';rosterStatus.dataset.error='false';
 }catch(error){rosterStatus.textContent=error.message;rosterStatus.dataset.error='true';}};
 rosterSave.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(pendingRoster,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download='にーくら試合用選手能力.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('native-proof-panel').hidden=true;
 for(const id of ['native-enter','native-issue','native-exit'])$(id).disabled=true;
 document.querySelector('.edition').textContent='TBD対LAD 連続スイングと状況実行版 122';
 document.querySelector('footer p').textContent='オフラインHostが共通Coreの球・接触・守備・走者・裁定を実行し、既存4pxカメラが観測します。打撃軌道はOpenBiomechanicsの実測軸を参考にします。選手能力と材料は明示的な参照校正で、NLB/MLB実選手の実測値ではありません。';
 document.querySelector('footer>span').textContent='4px / 中継55ms / オフラインCore';
 document.querySelector('footer details summary').textContent='物理・描画の接続と表示';
 document.querySelector('footer details p').textContent='v31の画面構成・球種記号・4px格子を維持しています。球・バット・守備・走者と裁定は共通Coreの観測記録を表示し、投球前の準備と結果待機は再生側で管理します。準備・待機・記号選択は物理時刻や確定記録を変更しません。コース成績はローカルの記録方針に基づき、判定不足は記録確認中として保持します。Native認証付き公式採点・実選手の校正・実機スマートフォン検証とは別です。';
 $('spin-hud')&&($('spin-hud').hidden=true);
 window.addEventListener('resize',()=>requestAnimationFrame(draw));
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing){stop();pauseAfterPitch=true;draw();}});
 document.addEventListener('keydown',event=>{
  if(event.target.closest('input,select,textarea,button,summary,a,[contenteditable="true"]'))return;
  if([' ','Enter','ArrowLeft','ArrowRight'].includes(event.key)){
   event.preventDefault();event.stopImmediatePropagation();
   if(event.key==='ArrowLeft')$('previous-pitch').click();else if(event.key==='ArrowRight')$('next-pitch').click();else $('play').click();
  }
 },true);
 const pitcherHeadPanel=document.createElement('details');pitcherHeadPanel.id='pitcher-head-controls';pitcherHeadPanel.style.padding='12px 18px';
 pitcherHeadPanel.innerHTML='<summary>投手視点：投球時の身体・頭の動き</summary><p>投手の位置に付いた目が、投球動作と同じ時間で踏み込み・回復します。動きは調整中の仮モデルです。</p><label><input id="pitcher-head-enabled" type="checkbox" checked>身体に伴うカメラ移動</label><label>動きの倍率 <input id="pitcher-head-scale" type="number" min="0" max="2" step="0.05" value="1"></label><button id="pitcher-head-reset">初期値に戻す</button>';
 document.querySelector('details.settings').after(pitcherHeadPanel);
 $('pitcher-head-enabled').onchange=()=>setPitcherBodyHead({enabled:$('pitcher-head-enabled').checked});
 $('pitcher-head-scale').onchange=()=>{try{setPitcherBodyHead({scale:Number($('pitcher-head-scale').value)});}catch(error){setPitcherBodyHead({});$('announcement').textContent=error.message;}};
 $('pitcher-head-reset').onclick=()=>setPitcherBodyHead(window.KneekuraPitcherBodyHeadView.defaults);
 const nameDisplayPanel=document.createElement('details');nameDisplayPanel.id='name-display-controls';nameDisplayPanel.style.padding='12px 18px';
 nameDisplayPanel.innerHTML='<summary>選手名の表示サイズ</summary><p>文字と背景枠を一緒に拡大します。初期値は1です。全視点で名前の重なりを許し、走者名を上に表示します。</p><label>名前の倍率 <input id="name-display-scale" type="number" min="0.5" max="2.5" step="0.05" value="1"></label><button id="name-display-reset">倍率を1に戻す</button>';
 document.querySelector('details.settings').after(nameDisplayPanel);
 $('name-display-scale').onchange=()=>{try{setNameDisplay({scale:Number($('name-display-scale').value)});}catch(error){syncNameDisplay();$('announcement').textContent=error.message;}};
 $('name-display-reset').onclick=()=>setNameDisplay(window.KneekuraNameDisplayControls.defaults);
   const trailPanel=document.createElement('details');trailPanel.id='batted-trail-controls';trailPanel.style.padding='12px 18px';
  trailPanel.innerHTML='<summary>打球の軌道線</summary><p>打球が通った線を映像に重ねます。試合の結果には影響しません。</p><div class="segmented" role="group" aria-label="打球の軌道線"><button data-trail="off">なし</button><button data-trail="overhead">俯瞰のみ</button><button data-trail="all">全視点</button></div>';
  document.querySelector('details.settings').after(trailPanel);
  function syncTrailMode(){trailPanel.querySelectorAll('[data-trail]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.trail===battedTrailMode)));}
  trailPanel.querySelectorAll('[data-trail]').forEach(button=>{button.onclick=()=>{battedTrailMode=button.dataset.trail;try{localStorage.setItem('kneekura.battedTrail.v1',battedTrailMode);}catch{}syncTrailMode();draw();};});syncTrailMode();
const ballDisplayPanel=document.createElement('details');ballDisplayPanel.id='ball-display-controls';ballDisplayPanel.style.padding='12px 18px';
 ballDisplayPanel.innerHTML='<summary>ボールの表示倍率</summary><p>物理の大きさは変わりません。初期値はどちらも1です。投球の描画間隔は22ms、ほかは55msです。</p><label>通常視点 <input id="ball-scale-perspective" type="number" min="0.25" max="8" step="0.05" value="1"></label><label>俯瞰 <input id="ball-scale-overhead" type="number" min="0.25" max="8" step="0.05" value="1"></label><label>俯瞰：高さの遠近感 <input id="ball-scale-overheadHeightEmphasis" type="number" min="1" max="8" step="0.1" value="2"></label><button id="ball-scale-reset">表示を初期値へ</button><p id="ball-height-model-status" aria-live="polite"></p><p>地面からの高さを、サイズ計算時だけ指定倍として投影します。2mの球は設定2で4m相当のサイズ。表示位置・物理は変えず、接地球・投球・送球・他視点は維持します。旧方式の設定は数値を変更すると新方式に切り替わります。初期2。</p>';
 document.querySelector('details.settings').after(ballDisplayPanel);
 for(const key of ['perspective','overhead','overheadHeightEmphasis'])$('ball-scale-'+key).onchange=()=>{try{setBallDisplay({[key]:Number($('ball-scale-'+key).value)});}catch(error){syncBallDisplay();$('announcement').textContent=error.message;}};
 $('ball-scale-reset').onclick=()=>setBallDisplay(window.KneekuraBallDisplayControls.defaults);
 document.getElementById('presentation-visual-save').onclick=()=>{const pv=window.KneekuraPresentationVisualExperimentV1;try{const save=pv.capture(globalThis.__robinAcceptedContinuation);const url=URL.createObjectURL(new Blob([JSON.stringify(save,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='presentation-visual-checkpoint.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);pv.status('表示状態を保存しました。')}catch(e){pv.status('表示状態 HOLD: '+e.message)}};
document.getElementById('presentation-visual-load').onchange=async e=>{const pv=window.KneekuraPresentationVisualExperimentV1;try{const file=e.target.files?.[0];if(!file)return;const raw=JSON.parse(await file.text());pv.restore(raw,globalThis.__robinAcceptedContinuation);pv.status('表示状態を復元しました。試合状態は変更していません。')}catch(error){pv.status('表示状態 HOLD: '+error.message)}};
document.getElementById('stadium-choice').addEventListener('change',()=>draw());window.liveMatchPlayback=Object.freeze({setPitcherBodyHead,setNameDisplay,setBallDisplay,isFreePitchAtPresentationMs:ms=>{if(!Number.isFinite(ms)||ms<0)throw Error('Invalid presentation time');return freePitchAt(ms);},observePitchBallAtPresentationMs,paintLivePitchBall:(ball,projection)=>visual.paintLivePitchBall(ball,projection),newGame:()=>createGame(false),play,stop:()=>{stop();draw();},finish,
  inspect:()=>({version:88,whiffFollowThrough:whiffFollowThroughV88,homeRunWatch:homeRunWatchV83,authority:'OFFLINE_HOST_SHARED_CORE',nativeSqliteAdmission:false,playing,fast,preparingPitchV99,error:lastFailure,errorDetails:lastFailureDetails,selectedPitch:selected,
   resultObservation:observedResult(activeResult(),currentFrame),
   physicalRoster:{active:structuredClone(activeRoster),pending:structuredClone(pendingRoster),audit:physicalRosterAudit,players},
   fieldCamera:fieldCameraObservation,
   presentation:{nameDisplay:window.KneekuraNameDisplayControls.inspect(),ballDisplay:window.KneekuraBallDisplayControls.inspect(),cadence:{...cadence},fastPitchEligible:freePitchAt(sceneMs),continuousBatterView,stage:sceneStage(),pitcherReactionView,pitcherBodyHeadView,elapsedMs:sceneMs,durationMs:activeResult()?sceneTiming(activeResult()).durationMs:0,timing,chart:chart.inspect(),actorAnimation,
    takenPitchGaze,pitchMarksOpacity,catcherFollow,resultDisplay,batterGaze,foulStop:activeResult()&&foulStop(activeResult())&&currentFrame.tick>=foulStop(activeResult()).deadTick?foulStop(activeResult()):null},
   generationV116:host.generationV116(),generatedPitches:records.length,frameIndex,currentFrame,rendered,observedMatch,host:host.inspect(),
   lastResult:activeResult(),legacyResultFallback:false,measuredSwingAuthority:measured.authority}),
  seekPitch:(index,atFrame=0)=>{if(!Number.isSafeInteger(index)||index<0||index>=records.length)throw new Error('Unknown recorded pitch');
   selectPitch(index,false);seekFrame(atFrame);},
  seekPresentationMs:(value,optionsV81)=>{if(!Number.isFinite(value)||value<0)throw new Error('Invalid presentation time');
   stop();pauseAfterPitch=true;setSceneTime(value);
   // Read-only opt-in for a lab's single synchronous scene observation. The
   // default paused seek still paints the original v79 physical-frame ball.
   const previousObservationV81=continuousPitchObservationV81;
   try{continuousPitchObservationV81=optionsV81?.continuousPitchObservation===true;draw();}
   finally{continuousPitchObservationV81=previousObservationV81;}
  },
  seekFrame});
 function seekFrame(index){stop();pauseAfterPitch=true;if(activeResult()){
  const result=activeResult(),at=Math.max(0,Math.min(result.frames.length-1,index));
  setSceneTime(timing.preparationMs+(result.frames[at].tick-result.frames[0].tick)/1000);
 }draw();}
 try{createGame(false);}catch(error){fail(error);}
})();

