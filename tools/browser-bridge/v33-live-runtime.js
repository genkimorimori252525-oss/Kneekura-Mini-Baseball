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
 let playing=false,fast=false,pauseAfterPitch=false,token=0,gameToken=0,playStart=0,playFromTick=0,lastDraw=-Infinity;
 let options={camera:'batter',appearance:'retro',labels:true,zone:true,homeClose:false,zoom:1,autoOverhead:true};
 const hashSeed=value=>{let state=2166136261;for(const character of value)state=Math.imul(state^character.charCodeAt(0),16777619);return state>>>0;};
 const command=()=>({batting:$('batting-choice').value,pitchType:$('pitch-choice').value,
  location:$('location-choice').value,managedTeam:Number($('managed-team').value)});
 const vecLength=value=>value?Math.hypot(value.x,value.y,value.z):0;
 const tickOf=frame=>frame.tick;
 function stop(cancelNext=true){playing=false;token++;if(cancelNext)pauseAfterPitch=true;$('play').textContent=host?.inspect().finished?'試合終了':'試合を進める';}
 function activeResult(){return records[selected]??null;}
 function knownResult(result){
  if(result?.play?.classification==='count')return resultLabels[result.play.call]??'カウント更新';
  if(result?.play?.classification==='live_ball'){
   const outs=result.play.rules.outcomes.length;return outs?outs+'アウト':'インプレーの進塁';
  }
  return result?.play?.label??resultLabels[result?.play?.classification]??'プレー終了';
 }
 function sourceActor(actor,batterId){
  const source=playerById[actor.playerId];
  if(!source)throw new Error('Core observation has unknown player: '+actor.playerId);
  const id=actor.playerId===batterId?'BAT':roles.includes(actor.role)?actor.role:'RUN:'+actor.playerId;
  return {id,sourcePlayerId:actor.playerId,role:actor.role,player:{...source,
   hand:actor.role==='P'?(source.throws??source.hand):source.hand},position:actor.position,
   running:vecLength(actor.velocity)>0,walking:actor.action==='bench'||currentFrame.phase==='bench'};
 }
 function cameraFor(frame,actors){
  if(frame.phase==='bench')return 'overhead';
  const live=frame.ballKind==='batted'||frame.ballKind==='throw';
  if(options.camera==='mound'&&live&&frame.fieldObserverPlayerId){
   const pitcher=actors.find(actor=>actor.id==='P');
   const result=activeResult(),first=result?.frames.find(f=>f.ballKind==='batted');
   const delay=first?.ball?Math.min(2,Math.max(.35,70/Math.max(1,vecLength(first.ball.velocity)))):2;
   if(first&&(frame.tick-first.tick)/1e6>=delay&&frame.fieldObserverPlayerId!==pitcher?.sourcePlayerId)return 'fielder';
   return 'mound';
  }
  if(options.camera==='batter'&&actors.some(actor=>actor.id==='BAT'&&actor.role==='runner'))return 'runner';
  return options.autoOverhead&&frame.fairKnown&&live?'overhead':options.camera;
 }
 function updateScore(match,line){
  const count=Math.max(9,line?.length??0),heading=document.querySelector('.scoreboard thead tr');
  heading.replaceChildren();
  for(const label of ['チーム',...Array.from({length:count},(_,i)=>String(i+1)),'計','安','失']){
   const cell=document.createElement('th');cell.textContent=label;heading.append(cell);
  }
  $('score-body').replaceChildren();
  for(const team of [0,1]){
   const row=document.createElement('tr'),values=[data.teams[team],...Array.from({length:count},(_,index)=>{
    const entry=line?.find(item=>item.inning===index+1);return (team===0?entry?.away:entry?.home)??'';
   }),team===0?match.score.away:match.score.home,'未採点','未採点'];
   values.forEach((value,index)=>{const cell=document.createElement('td');cell.textContent=String(value);if(index===count+1)cell.className='total';row.append(cell);});
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
  observedMatch=result?(officialKnown?result.match:result.beforeMatch):state.match;
  const match=observedMatch,line=result?(officialKnown?result.line:result.beforeLine):state.line;
  updateScore(match,line);
  const finished=state.finished&&selected===records.length-1&&atEnd;
  $('inning-label').textContent=finished?'試合終了':match.inning+'回'+(match.half==='top'?'表':'裏');
  $('pitch-number').textContent=selected<0?'—':String(selected+1);
  $('result-text').textContent=finished?data.teams[0]+' '+match.score.away+' − '+match.score.home+' '+data.teams[1]:
   result?(officialKnown?knownResult(result):frame.phase==='pitch'?'投球中':frame.phase==='batted'?'打球を追う':frame.phase==='throw'?'送球中':'プレー中'):'投球を待っています';
  $('pitch-meta').textContent=result?result.speedKmh.toFixed(1)+' km/h / '+(pitchNames[result.pitchType]??result.pitchType):'指示を選び、試合を進めてください';
  const batterId=result?.batterPlayerId??state.batterPlayerId,pitcherId=result?.pitcherPlayerId??state.pitcherPlayerId;
  const batter=playerById[batterId],pitcher=playerById[pitcherId];
  for(const [prefix,player]of [['pitcher',pitcher],['batter',batter]]){
   $(prefix+'-number').textContent=player?.number??'';$(prefix+'-name').textContent=player?.name??'';
   $(prefix+'-hand').textContent=prefix==='pitcher'?(player?.throws==='L'?'左投':'右投'):(player?.hand==='L'?'左打':'右打');
   $(prefix+'-hand').classList.toggle('left',(prefix==='pitcher'?player?.throws:player?.hand)==='L');
   $(prefix+'-meta').textContent=player?Math.round(player.height*100)+'cm':'';
  }
  $('phase').textContent=finished?'試合終了':frame.phase==='ready'?'次球の指示待ち':frame.phase==='held'?'捕球・保持':
   frame.phase==='bench'?'攻守交代':frame.phase==='throw'?'送球':frame.phase==='batted'?'打球':frame.phase==='pitch'?'投球':'プレー';
  $('manager-hint').textContent=fast?'Coreで試合を計算中。停止は現在の投球が終わってから':pauseAfterPitch?'指示変更を予約。この球の終了後に一時停止':
   finished?'試合終了。新しい試合を開始できます':playing?'新しい指示は次の投球から適用':'次の未生成球へ指示を適用します';
  $('manager-status').textContent='オフラインHostが共通Coreを実行。能力SIは明示的な参照校正で、実在選手・リーグの実測校正は未完です。';
  $('match-progress').textContent=state.pitchCount+'球 / '+(finished?'試合終了':'進行中');
  $('play').textContent=playing?'一時停止':finished?'試合終了':'試合を進める';
  $('play').disabled=fast||finished;$('finish-game').textContent=fast?'高速計算を止める':'残りを高速計算';
  $('finish-game').disabled=finished;$('previous-pitch').disabled=fast||selected<=0;
  $('next-pitch').disabled=fast||(state.finished&&selected>=records.length-1);
  $('inning-select').replaceChildren();$('pa-select').replaceChildren();
  const firstPitchByPlay=new Map();
  for(const [index,record]of records.entries()){
   if(firstPitchByPlay.has(record.beforeMatch.playId))continue;
   firstPitchByPlay.set(record.beforeMatch.playId,index);
   const option=document.createElement('option');option.value=String(index);
   option.textContent=playerById[record.batterPlayerId]?.name??'打席';$('pa-select').append(option);
  }
  $('pa-select').value=String(firstPitchByPlay.get(result?.beforeMatch.playId)??selected);$('pa-select').disabled=records.length===0||fast;
  const inningKeys=new Set(records.map(record=>record.beforeMatch.inning+'-'+record.beforeMatch.half));
  for(const key of inningKeys){const option=document.createElement('option');option.value=key;
   const [inning,half]=key.split('-');option.textContent=inning+'回'+(half==='top'?'表':'裏');$('inning-select').append(option);}
  $('inning-select').value=match.inning+'-'+match.half;$('inning-select').disabled=records.length===0||fast;
  $('pitch-list').replaceChildren();
  for(const [index,record]of records.entries()){
   if(record.beforeMatch.playId!==match.playId&&index!==selected)continue;
   const button=document.createElement('button'),number=document.createElement('span'),meta=document.createElement('span'),
    type=document.createElement('b'),speed=document.createElement('small'),result=document.createElement('span');
   number.textContent=String(index+1);type.textContent=pitchNames[record.pitchType]??record.pitchType;
   speed.textContent=record.speedKmh.toFixed(1)+' km/h';meta.append(type,speed);
   result.className='pitch-result';result.textContent=index===selected&&!atEnd?'投球中':knownResult(record);
   button.append(number,meta,result);button.setAttribute('aria-pressed',String(index===selected));
   button.onclick=()=>selectPitch(index,false);$('pitch-list').append(button);
  }
  $('chart-caption').textContent='球道・結果はCore記録。配球図の位置記録は未接続';
 }
 function draw(){
  const result=activeResult(),state=host.inspect();currentFrame=result?result.frames[frameIndex]:state.frame;
  const batterId=result?.batterPlayerId??state.batterPlayerId,pitcherId=result?.pitcherPlayerId??state.pitcherPlayerId;
  const actors=currentFrame.actors.map(actor=>sourceActor(actor,batterId));
  const batter={...playerById[batterId],hand:playerById[batterId].hand},pitcher={...playerById[pitcherId],hand:playerById[pitcherId].throws??'R'};
  const first=result?.frames[0],contact=result?.frames.find(frame=>frame.ballKind==='batted');
  const localTick=first?(currentFrame.tick-first.tick)/55000:0,contactLocal=contact?(contact.tick-first.tick)/55000:null;
  const ball=currentFrame.ball&&currentFrame.ball.visible!==false&&!currentFrame.possessedBy?{...currentFrame.ball,
   sourceObservation:true,ballKind:currentFrame.ballKind}:null;
  const bat=currentFrame.bat?{...currentFrame.bat,sourceObservation:true}:null;
  const world={liveObservation:true,livePark:state.fenceGeometry,liveBattedObservation:currentFrame.ballKind==='batted'||currentFrame.ballKind==='throw',
   liveFieldObserverPlayerId:currentFrame.fieldObserverPlayerId??null,tick:currentFrame.tick,localTick,batter,pitcher,actors,ball,bat,
   liveRunnerDirection:currentFrame.actors.find(actor=>actor.playerId===batterId)?.velocity??null,
   p:{contactLocal,catchLocal:null,swing:!!bat,outcome:currentFrame.homeRunConfirmed?'HR':null,actors:[],presentationEvidence:null},
   batFrame:0,pitchFrame:0,fair:false,fairKnown:currentFrame.fairKnown,custody:currentFrame.possessedBy,
   ballKind:currentFrame.ballKind,benchReturn:currentFrame.phase==='bench',officialKnown:!!currentFrame.homeRunConfirmed||!!result&&currentFrame.tick>=result.play.rules.endedAtTick,
   phase:currentFrame.phase,history:[]};
  const camera=cameraFor(currentFrame,actors);rendered=visual.liveDrawWorld(world,{...options,camera});
  $('camera-caption').textContent=cameras[camera]+' / Core試合';
  document.querySelectorAll('[data-camera]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.camera===options.camera)));
  document.querySelectorAll('[data-appearance]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.appearance===options.appearance)));
  const runners=actors.filter(actor=>actor.role==='runner');$('runner-presence').hidden=camera==='overhead'||!runners.length;
  if(runners.length)$('runner-presence').textContent='走者 '+runners.map(actor=>actor.player.name).join(' ・ ');
  syncUi(result,!!result&&frameIndex===result.frames.length-1,currentFrame);
  if(lastFailure){$('result-text').textContent='Core処理を停止';$('manager-hint').textContent=lastFailure;}
 }
 function issue(){
  if(host.inspect().finished)return null;
  lastFailure=null;lastFailureDetails=null;
  const beforeLine=host.inspect().line,result=host.issuePitch(command());
  if(!result.frames.length)throw new Error('Core returned no live observations');
  records.push({...result,beforeLine});selected=records.length-1;frameIndex=0;return records[selected];
 }
 function animate(){
  const result=activeResult();if(!result)return;
  playing=true;playStart=performance.now();playFromTick=tickOf(result.frames[frameIndex]);const clock=++token;lastDraw=-Infinity;draw();
  function update(now){
   if(!playing||clock!==token)return;
   const target=playFromTick+Math.max(0,now-playStart)*1000*(Number($('speed').value)||1);
   while(frameIndex+1<result.frames.length&&tickOf(result.frames[frameIndex+1])<=target)frameIndex++;
   const atEnd=frameIndex===result.frames.length-1;
   if(now-lastDraw>=55||atEnd){draw();lastDraw=now;}
   if(atEnd){stop(false);draw();if(!pauseAfterPitch&&!host.inspect().finished&&selected===records.length-1){
    const thisGame=gameToken;setTimeout(()=>{if(thisGame!==gameToken||playing||fast||pauseAfterPitch)return;issue();animate();},250);}
    return;
   }requestAnimationFrame(update);
  }requestAnimationFrame(update);
 }
 function play(){
  if(fast)return;
  if(playing){stop();pauseAfterPitch=true;draw();return;}
  pauseAfterPitch=false;
  if(!activeResult()||frameIndex===activeResult().frames.length-1){
   if(selected<records.length-1){selected++;frameIndex=0;}else if(!issue()){draw();return;}
  }animate();
 }
 function selectPitch(index,replay){stop();pauseAfterPitch=true;selected=Math.max(0,Math.min(records.length-1,index));frameIndex=0;draw();if(replay)animate();}
 async function finish(){
  if(fast){fast=false;return;}
  stop();fast=true;pauseAfterPitch=true;const thisGame=gameToken;
  if(records.length){selected=records.length-1;frameIndex=activeResult().frames.length-1;draw();}
  try{while(fast&&thisGame===gameToken&&!host.inspect().finished){issue();frameIndex=activeResult().frames.length-1;draw();await new Promise(resolve=>setTimeout(resolve,0));}}
  catch(error){fail(error);}
  finally{if(thisGame===gameToken){fast=false;draw();}}
 }
 function fail(error){lastFailure=error.message;lastFailureDetails={name:error.name,message:error.message,stack:error.stack,cause:error.cause??null};
  stop();fast=false;pauseAfterPitch=true;$('announcement').textContent='Core処理を停止: '+error.message;
  $('result-text').textContent='Core処理を停止';$('manager-hint').textContent=error.message;console.error(error);}
 function createGame(randomize=false){
  stop();fast=false;gameToken++;records=[];selected=-1;frameIndex=0;pauseAfterPitch=false;lastFailure=null;lastFailureDetails=null;
  if(randomize&&!$('fixed-seed').checked){const random=new Uint32Array(1);crypto.getRandomValues(random);$('match-seed').value='TBD-LAD-'+random[0];}
  activeConfiguration={seedText:$('match-seed').value,seed:hashSeed($('match-seed').value),innings:Number($('inning-limit').value)||9};
  host=core.createLiveBaseballMatchV1({seed:activeConfiguration.seed,innings:activeConfiguration.innings,
   teams,players,park,measuredClips:measured.clips});draw();
 }
 visual.seek(0);
 $('play').onclick=()=>{try{play();}catch(error){fail(error);}};
 $('next-pitch').onclick=()=>{try{stop();pauseAfterPitch=true;if(selected<records.length-1){selected++;frameIndex=0;}else issue();draw();animate();pauseAfterPitch=true;}catch(error){fail(error);}};
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
 document.querySelectorAll('[data-appearance]').forEach(button=>button.onclick=()=>{options.appearance=button.dataset.appearance;draw();});
 for(const [id,key]of [['auto-overhead','autoOverhead'],['home-close','homeClose'],['labels','labels'],['zone','zone']])$(id).onchange=event=>{options[key]=event.target.checked;draw();};
 $('history').checked=false;$('history').disabled=true;
 $('zoom').oninput=event=>{options.zoom=Number(event.target.value)/100;$('zoom-value').textContent=event.target.value+'%';draw();};
 $('field').onclick=()=>{};$('pitch-chart').onclick=()=>{};
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
 document.querySelector('.edition').textContent='TBD対LAD Core試合版 33';
 document.querySelector('footer p').textContent='オフラインHostが共通Coreの球・接触・守備・走者・裁定を実行し、既存4pxカメラが観測します。打撃軌道はOpenBiomechanicsの実測軸を参考にします。選手能力と材料は明示的な参照校正で、NLB/MLB実選手の実測値ではありません。';
 document.querySelector('footer>span').textContent='4px / 中継55ms / オフラインCore';document.querySelector('footer details').hidden=true;
 $('spin-hud')&&($('spin-hud').hidden=true);
 $('pitch-chart').getContext('2d').clearRect(0,0,$('pitch-chart').width,$('pitch-chart').height);
 window.addEventListener('resize',()=>requestAnimationFrame(draw));
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing){stop();pauseAfterPitch=true;draw();}});
 document.addEventListener('keydown',event=>{
  if(event.target.matches('input,select,textarea'))return;
  if([' ','Enter','ArrowLeft','ArrowRight'].includes(event.key)){
   event.preventDefault();event.stopImmediatePropagation();
   if(event.key==='ArrowLeft')$('previous-pitch').click();else if(event.key==='ArrowRight')$('next-pitch').click();else $('play').click();
  }
 },true);
 window.liveMatchPlayback=Object.freeze({newGame:()=>createGame(false),play,stop,finish,
  inspect:()=>({version:33,authority:'OFFLINE_HOST_SHARED_CORE',nativeSqliteAdmission:false,playing,fast,error:lastFailure,errorDetails:lastFailureDetails,selectedPitch:selected,
   generatedPitches:records.length,frameIndex,currentFrame,rendered,observedMatch,host:host.inspect(),
   lastResult:activeResult(),legacyResultFallback:false,measuredSwingAuthority:measured.authority}),
  seekPitch:(index,atFrame=0)=>{if(!Number.isSafeInteger(index)||index<0||index>=records.length)throw new Error('Unknown recorded pitch');
   selectPitch(index,false);frameIndex=Math.max(0,Math.min(activeResult().frames.length-1,atFrame));draw();},
  seekFrame:index=>{stop();pauseAfterPitch=true;if(activeResult())frameIndex=Math.max(0,Math.min(activeResult().frames.length-1,index));draw();}});
 try{createGame(false);}catch(error){fail(error);}
})();
