(() => {
 'use strict';
 const $=id=>document.getElementById(id),visual=window.matchPreview,core=window.KneekuraNativeMatchCore;
 const data=JSON.parse($('match-data').textContent),measured=JSON.parse($('v33-measured-bats').textContent);
 const roles=['P','C','1B','2B','3B','SS','LF','CF','RF'];
 const park=Object.freeze({fenceRadiusMeters:110,fenceHeightMeters:3});
 const teams=[0,1].map(team=>({id:data.teams[team],name:data.teamNames[team],
  battingOrder:Array.from({length:9},(_,i)=>team+'-b'+i),pitcherId:team+'-p0',
  defense:Object.fromEntries(roles.map(role=>[role,role==='P'?team+'-p0':team+'-b'+data.defenseMap[team][role]]))}));
 // Identity/presentation data alone comes from the old HTML. Ratings and league
 // labels are deliberately not converted into physical capability or outcomes.
 const players=Object.values(data.players).map(player=>({playerId:player.id,name:player.name,
  heightMeters:player.height,bats:player.hand}));
 const playerById=Object.fromEntries(Object.values(data.players).map(player=>[player.id,player]));
 const cameras={catcher:'捕手目線',batter:'打者目線',runner:'走者目線',mound:'投手目線',overhead:'俯瞰',fielder:'守備目線'};
 const pitchNames={fastball:'直球',slider:'スライダー',curve:'カーブ',changeup:'チェンジアップ',cutter:'カットボール',
  sinker:'シンカー',splitter:'スプリット',fork:'フォーク','two-seam':'ツーシーム'};
 const resultLabels={ball:'ボール',called_strike:'ストライク',swinging_strike:'空振り',foul:'ファウル',
  strikeout:'三振',walk:'四球',hit_by_pitch:'死球',single:'単打',double:'二塁打',triple:'三塁打',home_run:'ホームラン',
  ground_out:'ゴロアウト',fly_out:'フライアウト',foul_out:'ファウルフライアウト',ground_rule_double:'二塁の安全進塁権',field_out:'アウト',in_play:'インプレー',fair:'フェア',
  BALL:'ボール',STRIKE:'ストライク',FOUL:'ファウル',K:'三振',BB:'四球',HBP:'死球',HR:'ホームラン',
  '1B':'単打','2B':'二塁打','3B':'三塁打',GO:'ゴロアウト',FO:'フライアウト'};
 let host,records=[],selected=-1,frameIndex=0,currentFrame,rendered,observedMatch,activeConfiguration,lastFailure=null,lastFailureDetails=null;
 // Presentation time includes the v31 preparation and result pauses. It never
 // changes a Core tick, physical frame, command or adjudication.
 const timing=Object.freeze({preparationMs:28*55,countHoldMs:29*55,fieldHoldMs:14*55,terminalHoldMs:1000,thirdOutMs:3000,foulMs:5000});
 let playing=false,fast=false,pauseAfterPitch=false,token=0,gameToken=0,playStart=0,playFromMs=0,lastDraw=-Infinity;
 let sceneMs=0,skipAtMs=null,selectedMark=null,chartObservation=null,fieldCameraObservation=null,actorAnimation=null;
 let pitchMarksOpacity=1,catcherFollow=null,resultDisplay=null;
 let options={camera:'catcher',appearance:'retro',labels:true,zone:true,history:true,homeClose:false,zoom:1,autoOverhead:true};
 try{options.appearance=localStorage.getItem('kneekura.presentation.actorAppearance.v1')||'retro';}catch{}
 const chart=window.KneekuraLivePitchChart.create({canvas:$('pitch-chart'),caption:$('chart-caption'),legend:$('symbol-legend'),core,
  onSelect:({pitchId})=>{selectedMark=pitchId;draw();}});
 const hashSeed=value=>{let state=2166136261;for(const character of value)state=Math.imul(state^character.charCodeAt(0),16777619);return state>>>0;};
 // Retain the approved controls. Their older names select the corresponding
 // available Core physical model; they do not claim a new measured arsenal.
 const pitchModels={fork:'splitter',change:'changeup','two-seam':'sinker'};
 const command=()=>({batting:$('batting-choice').value,pitchType:pitchModels[$('pitch-choice').value]??$('pitch-choice').value,
  location:$('location-choice').value,managedTeam:Number($('managed-team').value)});
 const vecLength=value=>value?Math.hypot(value.x,value.y,value.z):0;
 function stop(cancelNext=true){playing=false;token++;if(cancelNext)pauseAfterPitch=true;}
 function activeResult(){return records[selected]??null;}
 function foulStop(result){
  if(result?.play.classification!=='foul')return null;
  const event=result.events.find(event=>event.kind==='play_end'&&event.reason==='foul_dead_ball');
  return event?{deadTick:event.tick,holdMs:1500,source:'CORE_FOUL_DEAD_BALL'}:null;
 }
 function catcherFlight(result){
  const first=result?.frames.find(frame=>frame.ballKind==='batted');
  return first?{first,delaySeconds:Math.max(1,Math.min(2,70/Math.max(1,vecLength(first.ball?.velocity))))}:null;
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
  return {first,physicalMs,officialMs,thirdOut,durationMs:timing.preparationMs+duration};
 }
 function setSceneTime(value){
  const result=activeResult();if(!result){sceneMs=0;frameIndex=0;return;}
  const layout=sceneTiming(result);sceneMs=Math.max(0,Math.min(layout.durationMs,value));
  const tick=layout.first+Math.max(0,sceneMs-timing.preparationMs)*1000;
  frameIndex=0;while(frameIndex+1<result.frames.length&&result.frames[frameIndex+1].tick<=tick)frameIndex++;
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
   running:vecLength(actor.velocity)>0,walking:actor.action==='bench'||currentFrame.phase==='bench',
   presentationAction:actorAnimation?.actors[actor.playerId]?.action,presentationFrame:actorAnimation?.actors[actor.playerId]?.frame};
 }
 function cameraFor(frame,actors){
  if(options.camera==='catcher'&&catcherFollow)
   return options.autoOverhead&&sceneMs>=catcherFollow.cutoverAtMs?'overhead':'catcher';
  if(frame.phase==='bench')return 'overhead';
  const live=frame.ballKind==='batted'||frame.ballKind==='throw';
  const observer=fieldCameraObservation?.observerPlayerId??frame.fieldObserverPlayerId;
  if(options.camera==='mound'&&live&&observer){
   const pitcher=actors.find(actor=>actor.id==='P');
   const result=activeResult(),first=result?.frames.find(f=>f.ballKind==='batted');
   const delay=first?.ball?Math.min(2,Math.max(.35,70/Math.max(1,vecLength(first.ball.velocity)))):2;
   const fieldCommitted=fieldCameraObservation?.phase==='held'||fieldCameraObservation?.phase==='throw';
   if(first&&((frame.tick-first.tick)/1e6>=delay||fieldCommitted)&&observer!==pitcher?.sourcePlayerId)return 'fielder';
   return 'mound';
  }
  if(options.camera==='batter'&&actors.some(actor=>actor.id==='BAT'&&actor.role==='runner'))return 'runner';
  return options.autoOverhead&&frame.fairKnown&&live?'overhead':options.camera;
 }
 function updateScore(match,line,finished){
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
   }),team===0?match.score.away:match.score.home,'未採点','未採点'];
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
  updateScore(match,line,finished);
  $('inning-label').textContent=finished?'試合終了':match.inning+'回'+(match.half==='top'?'表':'裏');
  const currentMark=chartObservation.history.find(entry=>entry.pitchId===window.KneekuraLivePitchChart.pitchId(selected));
  const color=window.KneekuraPitchSymbols.colors[resultObservation?.category??currentMark?.category]??'#e0b541';
  $('pitch-number').textContent=String(chartObservation.number);$('pitch-number').style.color=color;$('pitch-number').style.borderColor=color;
  $('result-text').textContent=finished?data.teams[0]+' '+match.score.away+' − '+match.score.home+' '+data.teams[1]:
   !result||sceneStage()==='preparation'?'第'+chartObservation.number+'球　投球準備':
   resultKnown?resultDisplay.label:frame.phase==='pitch'?'投球中':frame.phase==='batted'?'打球を追う':frame.phase==='throw'?'送球中':'プレー中';
  $('pitch-meta').textContent=resultKnown?(resultDisplay.change?resultDisplay.playLabel+'　':'')+result.speedKmh.toFixed(1)+' km/h　'+(pitchNames[result.pitchType]??result.pitchType):
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
  $('manager-status').textContent='オフラインHostが共通Coreを実行。能力SIは明示的な参照校正で、実在選手・リーグの実測校正は未完です。';
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
 function draw(){
  const result=activeResult(),state=host.inspect();
  currentFrame=result?(sceneStage()==='preparation'?result.beforeFrame:result.frames[frameIndex]):state.frame;
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
  chartObservation=Object.freeze({...chart.observe({records,pitchIndex:selected,atTick:currentFrame.tick,batterHeightMeters:batter.height,selectedPitchId:selectedMark}),marksOpacity:pitchMarksOpacity});
  const ball=currentFrame.ball&&currentFrame.ball.visible!==false&&!currentFrame.possessedBy?{...currentFrame.ball,
   sourceObservation:true,ballKind:currentFrame.ballKind}:null;
  const bat=currentFrame.bat?{...currentFrame.bat,sourceObservation:true}:null;
  fieldCameraObservation=result?window.KneekuraLiveFieldCamera.observe({record:result,frame:currentFrame,bases:core.LIVE_MATCH_BASES_V1,
   defaultObserverPlayerId:currentFrame.fieldObserverPlayerId}):null;
  catcherFollow=observeCatcher(result,currentFrame);
  const world={liveObservation:true,livePark:state.fenceGeometry,liveBattedObservation:currentFrame.ballKind==='batted'||currentFrame.ballKind==='throw',
   liveFieldObserverPlayerId:fieldCameraObservation?.observerPlayerId??currentFrame.fieldObserverPlayerId??null,
    liveFieldCameraTarget:fieldCameraObservation?.target??null,liveCatcherCameraTarget:catcherFollow?.target??null,
    livePitchMarksOpacity:pitchMarksOpacity,tick:currentFrame.tick,localTick,batter,pitcher,actors,ball,bat,
   liveRunnerDirection:currentFrame.actors.find(actor=>actor.playerId===batterId)?.velocity??null,
   liveBatterRunStarted:result?.batterRunStartedAtTick!=null&&currentFrame.tick>=result.batterRunStartedAtTick,
   p:{contactLocal,catchLocal:Number.isFinite(catchSeconds)?28+catchSeconds/.055:null,swing:result?.play.diagnostics.swingOffered??false,
    outcome:currentFrame.homeRunConfirmed?'HR':null,actors:[],presentationEvidence:null},
    batFrame:actorAnimation.batFrame,pitchFrame:actorAnimation.pitchFrame,fair:false,fairKnown:currentFrame.fairKnown,custody:currentFrame.possessedBy,
   ballKind:currentFrame.ballKind,benchReturn:currentFrame.phase==='bench',officialKnown:!!currentFrame.homeRunConfirmed||!!result&&currentFrame.tick>=result.play.rules.endedAtTick,
   phase:currentFrame.phase,history:chartObservation.history};
  const camera=cameraFor(currentFrame,actors);rendered=visual.liveDrawWorld(world,{...options,camera,selectedPitch:chartObservation.selectedPitchId});
  $('camera-caption').textContent=cameras[camera];
  document.querySelectorAll('[data-camera]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.camera===camera)));
  document.querySelectorAll('[data-appearance]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.appearance===options.appearance)));
  const runners=actors.filter(actor=>actor.role==='runner');$('runner-presence').hidden=camera==='overhead'||!runners.length;
  if(runners.length)$('runner-presence').textContent='走者 '+runners.map(actor=>actor.player.name).join(' ・ ');
  syncUi(result,sceneEnded(),currentFrame);
  if(lastFailure){$('result-text').textContent='Core処理を停止';$('manager-hint').textContent=lastFailure;}
 }
 function issue(){
  if(host.inspect().finished)return null;
  lastFailure=null;lastFailureDetails=null;
  const before=host.inspect(),beforeLine=before.line,beforeFrame=before.frame,result=host.issuePitch(command());
  if(!result.frames.length)throw new Error('Core returned no live observations');
  const batterRunStartedAtTick=result.frames.find(frame=>frame.actors.some(actor=>actor.playerId===result.batterPlayerId&&
   actor.role==='runner'&&vecLength(actor.velocity)>0))?.tick??null;
  records.push({...result,beforeLine,beforeFrame,batterRunStartedAtTick});selected=records.length-1;frameIndex=0;sceneMs=0;skipAtMs=null;selectedMark=null;return records[selected];
 }
 function animate(){
  const result=activeResult();if(!result)return;
  playing=true;playStart=performance.now();playFromMs=sceneMs;const clock=++token;lastDraw=-Infinity;draw();
  function update(now){
   if(!playing||clock!==token)return;
   const target=playFromMs+Math.max(0,now-playStart)*(Number($('speed').value)||1);
   setSceneTime(skipAtMs!==null&&target>=skipAtMs?sceneTiming(result).durationMs:target);
   const atEnd=sceneEnded();
   if(now-lastDraw>=55||atEnd){draw();lastDraw=now;}
   if(atEnd){
    stop(false);
    if(!pauseAfterPitch&&(selected<records.length-1||!host.inspect().finished)){
     if(selected<records.length-1){selected++;setSceneTime(0);skipAtMs=null;selectedMark=null;}else issue();
     animate();
    }else draw();return;
   }requestAnimationFrame(onFrame);
  }
  function onFrame(now){try{update(now);}catch(error){fail(error);draw();}}
  requestAnimationFrame(onFrame);
 }
 function play(){
  if(fast)return;
  if(playing){stop();pauseAfterPitch=true;draw();return;}
  pauseAfterPitch=false;
  if(!activeResult()||sceneEnded()){
   if(selected<records.length-1){selected++;setSceneTime(0);skipAtMs=null;selectedMark=null;}
   else if(!issue()){selected=0;setSceneTime(0);skipAtMs=null;selectedMark=null;}
  }animate();
 }
 function selectPitch(index,replay){stop();pauseAfterPitch=true;selected=Math.max(0,Math.min(records.length-1,index));setSceneTime(0);skipAtMs=null;selectedMark=null;draw();if(replay)animate();}
 async function finish(){
  if(fast){fast=false;return;}
  stop();fast=true;pauseAfterPitch=true;const thisGame=gameToken;
  if(records.length){selected=records.length-1;setSceneTime(sceneTiming(activeResult()).durationMs);draw();}
  try{while(fast&&thisGame===gameToken&&!host.inspect().finished){issue();setSceneTime(sceneTiming(activeResult()).durationMs);draw();await new Promise(resolve=>setTimeout(resolve,0));}}
  catch(error){fail(error);}
  finally{if(thisGame===gameToken){fast=false;draw();}}
 }
 function fail(error){lastFailure=error.message;lastFailureDetails={name:error.name,message:error.message,stack:error.stack,cause:error.cause??null};
  stop();fast=false;pauseAfterPitch=true;$('announcement').textContent='Core処理を停止: '+error.message;
  $('result-text').textContent='Core処理を停止';$('manager-hint').textContent=error.message;console.error(error);}
 function createGame(randomize=false){
  stop();fast=false;gameToken++;records=[];selected=-1;frameIndex=0;sceneMs=0;skipAtMs=null;selectedMark=null;pauseAfterPitch=false;lastFailure=null;lastFailureDetails=null;
  if(randomize&&!$('fixed-seed').checked){const random=new Uint32Array(1);crypto.getRandomValues(random);$('match-seed').value='TBD-LAD-'+random[0];}
  activeConfiguration={seedText:$('match-seed').value,seed:hashSeed($('match-seed').value),innings:Number($('inning-limit').value)||9};
  host=core.createLiveBaseballMatchV1({seed:activeConfiguration.seed,innings:activeConfiguration.innings,
   teams,players,park,measuredClips:measured.clips});draw();
 }
 visual.seek(0);
 $('play').onclick=()=>{try{play();}catch(error){fail(error);}};
 $('next-pitch').onclick=()=>{try{stop();pauseAfterPitch=true;if(selected<records.length-1){selected++;setSceneTime(0);skipAtMs=null;selectedMark=null;}else issue();draw();}catch(error){fail(error);}};
 $('previous-pitch').onclick=()=>{if(records.length)selectPitch(selected-1,false);};
 $('restart').onclick=()=>{if(records.length)selectPitch(0,false);else draw();};
 $('new-game').onclick=()=>{try{createGame(true);}catch(error){fail(error);}};
 $('finish-game').onclick=finish;
 $('pa-select').onchange=event=>selectPitch(Number(event.target.value),false);
 $('inning-select').onchange=event=>{const index=records.findIndex(record=>record.beforeMatch.inning+'-'+record.beforeMatch.half===event.target.value);if(index>=0)selectPitch(index,false);};
 $('speed').onchange=()=>{if(playing){const requestedPause=pauseAfterPitch;stop();pauseAfterPitch=requestedPause;animate();}};
 for(const id of ['batting-choice','pitch-choice','location-choice','managed-team'])$(id).addEventListener('change',()=>{
  pauseAfterPitch=true;$('manager-hint').textContent=playing?'指示変更を予約。この球の終了後に一時停止':'次の未生成球へ指示を適用します';
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
   configuration:{innings:activeConfiguration.innings,teams,players,park,measuredSourceCommit:measured.sourceCommit,
    measuredClipIds:measured.clips.map(clip=>clip.id)},
   pitches:records.map(record=>({beforeMatch:record.beforeMatch,match:record.match,command:record.command,
    events:record.events,play:{classification:record.play.classification,call:record.play.call,contact:record.play.contact,rules:record.play.rules,
     field:record.play.field?{facts:record.play.field.facts,ruleFacts:record.play.field.ruleFacts,end:record.play.field.end}:null},
    frameCount:record.frames.length,fieldFrameCount:record.play.field?.frames.length??0})),
   omittedFields:['presentation frames','field frames','state.history'],frameHashesIncluded:false,
   calibration:'EXPLICIT_REFERENCE_SI_NOT_EMPIRICAL_NAMED_PLAYER_CALIBRATION'};
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download='kneekura-core-match.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 $('native-proof-panel').hidden=true;
 for(const id of ['native-enter','native-issue','native-exit'])$(id).disabled=true;
 document.querySelector('.edition').textContent='TBD対LAD ファウル待機短縮版 39';
 document.querySelector('footer p').textContent='オフラインHostが共通Coreの球・接触・守備・走者・裁定を実行し、既存4pxカメラが観測します。打撃軌道はOpenBiomechanicsの実測軸を参考にします。選手能力と材料は明示的な参照校正で、NLB/MLB実選手の実測値ではありません。';
 document.querySelector('footer>span').textContent='4px / 中継55ms / オフラインCore';
 document.querySelector('footer details summary').textContent='物理・描画の接続と表示';
 document.querySelector('footer details p').textContent='v31の画面構成・球種記号・4px格子を維持しています。球・バット・守備・走者と裁定は共通Coreの観測記録を表示し、投球前の準備と結果待機は再生側で管理します。準備・待機・記号選択は物理時刻や確定記録を変更しません。安打・失策の公式採点、実選手の能力校正、実機スマートフォンの検証は未完です。';
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
 window.liveMatchPlayback=Object.freeze({newGame:()=>createGame(false),play,stop:()=>{stop();draw();},finish,
  inspect:()=>({version:39,authority:'OFFLINE_HOST_SHARED_CORE',nativeSqliteAdmission:false,playing,fast,error:lastFailure,errorDetails:lastFailureDetails,selectedPitch:selected,
   resultObservation:observedResult(activeResult(),currentFrame),
   fieldCamera:fieldCameraObservation,
   presentation:{stage:sceneStage(),elapsedMs:sceneMs,durationMs:activeResult()?sceneTiming(activeResult()).durationMs:0,timing,chart:chart.inspect(),actorAnimation,
    pitchMarksOpacity,catcherFollow,resultDisplay,foulStop:activeResult()&&foulStop(activeResult())&&currentFrame.tick>=foulStop(activeResult()).deadTick?foulStop(activeResult()):null},
   generatedPitches:records.length,frameIndex,currentFrame,rendered,observedMatch,host:host.inspect(),
   lastResult:activeResult(),legacyResultFallback:false,measuredSwingAuthority:measured.authority}),
  seekPitch:(index,atFrame=0)=>{if(!Number.isSafeInteger(index)||index<0||index>=records.length)throw new Error('Unknown recorded pitch');
   selectPitch(index,false);seekFrame(atFrame);},
  seekPresentationMs:value=>{if(!Number.isFinite(value)||value<0)throw new Error('Invalid presentation time');
   stop();pauseAfterPitch=true;setSceneTime(value);draw();},
  seekFrame});
 function seekFrame(index){stop();pauseAfterPitch=true;if(activeResult()){
  const result=activeResult(),at=Math.max(0,Math.min(result.frames.length-1,index));
  setSceneTime(timing.preparationMs+(result.frames[at].tick-result.frames[0].tick)/1000);
 }draw();}
 try{createGame(false);}catch(error){fail(error);}
})();
