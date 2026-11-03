/* One match, two read-only camera observers. UI commands use the existing match runtime. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),meta=JSON.parse($('camera-workbench-source').textContent),
  frame=$('match-engine'),STORE='kneekura.camera-workbench.settings.v65',SIDES=['A','B'],
  COMMANDS=['managed-team','batting-choice','baserunning-choice','pitch-choice','location-choice'],
  TITLES=['操作チーム','打撃','走塁','球種','コース'];
 let win,playback,factory,controllers={},ready=false,busy=false,cancel=false,playing=false,
  currentMs=0,speed=1,mode='loop',camera='batter',loopStartMs=0,loopEndMs=null,
  snapshots={},uiCommands=[],lastMeasure=null,raf=0,lastPaint=0,playOrigin=0,playStarted=0,
  lastPitchPaint=-Infinity,fastBall=null,fastPitchIndex=-1,fastBallSceneMs=-Infinity,selectedPitchAtDraw=-1;
 const cadence={sceneMs:55,pitchBallMs:22,sceneDraws:0,pitchBallSamples:0,pitchBallPaints:0,nonPitchFastPaints:0};
 const clone=value=>JSON.parse(JSON.stringify(value));
 const fail=error=>{pause();$('status').textContent=error.message??String(error);$('status').classList.add('error');};
 const message=text=>{$('status').textContent=text;$('status').classList.remove('error');};
 const guard=()=>{if(!ready)throw Error('試合Coreは準備中です');if(busy)throw Error('生成中です。先に生成を停止してください');};
 function object(value,keys,label){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)throw Error(label+'はJSON objectが必要です');
  if(Object.keys(value).some(key=>!keys.includes(key))||Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>d.get||d.set))throw Error(label+'に未対応の項目があります');
 }
 function number(value,min,max,label){if(!Number.isFinite(value)||value<min||value>max)throw Error(label+'が範囲外です');return value;}
 function settingsPacket(value){
  object(value,['schema','sourceGameSha256','settings','ballDisplay','nameDisplay','pitcherBodyHead'],'調整JSON');
  if(value.schema!=='kneekura_camera_tuning_v1'||value.sourceGameSha256!==meta.sourceGameSha256)throw Error('調整JSONのschema／基準試合が一致しません');
  return {pair:normalizePair(value.settings),ballDisplay:win.KneekuraBallDisplayControls.normalizeSettings(value.ballDisplay??{}),nameDisplay:win.KneekuraNameDisplayControls.normalizeSettings(value.nameDisplay??{}),pitcherBodyHead:win.KneekuraPitcherBodyHeadView.normalizeSettings(value.pitcherBodyHead??{})};
 }
 function normalizePair(value){
  object(value,SIDES,'A/B設定');if(!value.A||!value.B)throw Error('AとBの設定が必要です');
  const migrate=s=>{const validated=factory.normalizeSettings(s);return factory.normalizeSettings({...validated,pitchTrackingGain:Object.hasOwn(s,'pitchTrackingGain')?validated.pitchTrackingGain:1,pitchTrackingDeadbandRadians:Object.hasOwn(s,'pitchTrackingDeadbandRadians')?validated.pitchTrackingDeadbandRadians:0,swingUsesAbsoluteVision:Object.hasOwn(s,'swingUsesAbsoluteVision')?validated.swingUsesAbsoluteVision:true,swingHeadCoupling:Object.hasOwn(s,'swingHeadCoupling')?validated.swingHeadCoupling:0});};
  return {A:migrate(value.A),B:migrate(value.B)};
 }
 function exportSettings(){return {schema:'kneekura_camera_tuning_v1',sourceGameSha256:meta.sourceGameSha256,
  settings:Object.fromEntries(SIDES.map(side=>[side,controllers[side].inspectSettings()])),ballDisplay:win.KneekuraBallDisplayControls.inspect(),nameDisplay:win.KneekuraNameDisplayControls.inspect(),pitcherBodyHead:win.KneekuraPitcherBodyHeadView.inspectSettings()};}
 function persist(){
  const packet=exportSettings();$('settings-json').value=JSON.stringify(packet,null,2);
  try{localStorage.setItem(STORE,JSON.stringify(packet));}catch{message('調整値は画面に反映済みです。ブラウザ保存は利用できないためJSONで保存してください。');}
 }
 function applyPair(pair){for(const side of SIDES)controllers[side].configure(pair[side]);syncSettings();persist();lastMeasure=null;}
 function setSettings(side,patch){guard();if(!SIDES.includes(side))throw Error('Unknown camera side');
  const next=factory.normalizeSettings({...controllers[side].inspectSettings(),...patch});
  controllers[side].configure(next);pause();syncSettings();persist();lastMeasure=null;refreshMarkers();renderPair(currentMs);return exportSettings();}
 function importSettings(packet){guard();const next=settingsPacket(packet);pause();applyPair(next.pair);applyBallDisplay(next.ballDisplay);applyNameDisplay(next.nameDisplay);applyPitcherBodyHead(next.pitcherBodyHead);refreshMarkers();renderPair(currentMs);return exportSettings();}
 const fields=[['aimLiftMeters','狙い目から上へ','m',0,.8,.01],['swingMaxDownRadians','下向きの上限','rad',.1,1.25,.01],
  ['hitFollowDelayMs','打球を観測してからの待機','ms',0,600,5],['aimReleaseMs','打球追尾への移行時間','ms',20,400,5],
  ['impactStabilizeOffsetMs','安定開始：予定インパクトから（−は早め）','ms',-250,150,5],
   ['impactMaxMotionRadians','安定中に許す角度','rad',0,.15,.001],['impactMaxSpeedRadPerSecond','安定中の最大角速度','rad/s',0,1.5,.01],
   ['swingHeadCoupling','バットに伴う頭の動き（0で連動なし）','×',0,.08,.001],
   ['pitchTrackingGain','基準の投球追従率','×',0,1,.01],['pitchTrackingDeadbandRadians','基準の追わずに許す範囲','rad',0,.15,.001]];
 function applyBallDisplay(settings){playback.setBallDisplay(settings);for(const key of ['perspective','overhead','overheadHeightEmphasis'])$('lab-ball-scale-'+key).value=settings[key];persist();}
 function setBallDisplay(patch){guard();const next=win.KneekuraBallDisplayControls.normalizeSettings({...win.KneekuraBallDisplayControls.inspect(),...patch});
  pause();applyBallDisplay(next);persist();renderPair(currentMs);return inspect();}
 function applyPitcherBodyHead(settings){playback.setPitcherBodyHead(settings);$('lab-pitcher-head-enabled').checked=settings.enabled;$('lab-pitcher-head-scale').value=settings.scale;persist();}
 function setPitcherBodyHead(patch){guard();const next=win.KneekuraPitcherBodyHeadView.normalizeSettings({...win.KneekuraPitcherBodyHeadView.inspectSettings(),...patch});
  pause();applyPitcherBodyHead(next);renderPair(currentMs);return inspect();}
 function applyNameDisplay(settings){playback.setNameDisplay(settings);$('lab-name-scale').value=settings.scale;persist();}
 function setNameDisplay(patch){guard();const next=win.KneekuraNameDisplayControls.normalizeSettings({...win.KneekuraNameDisplayControls.inspect(),...patch});
  pause();applyNameDisplay(next);renderPair(currentMs);return inspect();}
 function curveTiming(kind){guard();const rows=inspectSource().host.history.map((record,index)=>({record,index,ms:record.play?.diagnostics?.timingErrorSeconds*1000}))
  .filter(row=>row.record.command?.['pitchType']==='curve'||row.record.command?.['pitch-choice']==='curve'||row.record.pitchType==='curve');
  const eligible=rows.filter(row=>row.record.play?.diagnostics?.swingOffered&&Number.isFinite(row.ms)&&(kind==='early'?row.ms<0:row.ms>=0))
   .sort((a,b)=>kind==='early'?a.ms-b.ms:b.ms-a.ms);
  if(!eligible.length){message('該当する'+(kind==='early'?'早め':'遅め')+'のカーブ記録がありません。球種をカーブにして追加生成してください。');return inspect();}
  selectPitch(eligible[0].index);message('打者の予測に対するタイミング誤差 '+eligible[0].ms.toFixed(1)+'ms のカーブを選びました。');return inspect();}
 function createSettings(){for(const side of SIDES){
  const box=$('settings-'+side),enabled=document.createElement('label'),toggle=document.createElement('input');
  toggle.type='checkbox';toggle.id='enabled-'+side;toggle.onchange=()=>run(()=>setSettings(side,{enabled:toggle.checked}));
  const span=document.createElement('span');span.append(toggle,' 打点へ狙い、インパクト付近で視線を安定');enabled.append(span);box.append(enabled);
  const visionLabel=document.createElement('label'),visionToggle=document.createElement('input');visionToggle.type='checkbox';visionToggle.id='swingUsesAbsoluteVision-'+side;
  visionToggle.onchange=()=>run(()=>setSettings(side,{swingUsesAbsoluteVision:visionToggle.checked}));visionLabel.append(visionToggle,' スイング前の追従にも選球眼を反映（OFFでv59基準）');box.append(visionLabel);
  const grid=document.createElement('div');grid.className='controls';
  for(const [key,title,unit,min,max,step]of fields){const label=document.createElement('label'),input=document.createElement('input'),out=document.createElement('output');
   input.type='range';input.id=key+'-'+side;input.min=min;input.max=max;input.step=step;label.htmlFor=input.id;label.textContent=title;
   out.id='value-'+key+'-'+side;out.htmlFor=input.id;input.oninput=()=>run(()=>setSettings(side,{[key]:Number(input.value)}));
   grid.append(label,out,input);
  }box.append(grid);
 }}
 function syncSettings(){for(const side of SIDES){const settings=controllers[side].inspectSettings();$('enabled-'+side).checked=settings.enabled;$('swingUsesAbsoluteVision-'+side).checked=settings.swingUsesAbsoluteVision;$('swingUsesAbsoluteVision-'+side).disabled=!settings.enabled;
  $('label-'+side).textContent=settings.enabled?(!settings.swingUsesAbsoluteVision&&settings.swingHeadCoupling===0?'v59スイング基準':'調整設定'):'従来設定';
  for(const [key,,unit]of fields){$(key+'-'+side).value=settings[key];$(key+'-'+side).disabled=!settings.enabled&&!key.startsWith('pitchTracking');
   $('value-'+key+'-'+side).value=(unit==='m'?settings[key].toFixed(2):unit==='rad'?settings[key].toFixed(3):settings[key])+' '+unit+(unit==='rad'?' / '+(settings[key]*180/Math.PI).toFixed(1)+'°':'');}
 }}
 const inspectSource=()=>playback.inspect();
 function checkSource(){const s=inspectSource();if(s.error)throw Error('Core: '+s.error);return s;}
 function summarize(s){const view=s.presentation.continuousBatterView;return {sceneMs:s.presentation.elapsedMs,tick:s.currentFrame.tick,
  camera:s.rendered.camera,eye:s.rendered.cameraEye,yaw:s.rendered.cameraYaw,pitch:s.rendered.cameraPitch,phase:view?.phase,
  aimWeight:view?.aimWeight,model:view?.model??null,regulation:view?.regulation??null,tuning:view?.tuning??null,ball:s.rendered.ballDotDisplay??null,
  pitcherBodyHeadView:s.presentation.pitcherBodyHeadView,defensiveOpportunity:s.currentFrame.defensiveOpportunity,projection:s.rendered.cameraProjection,freePitch:s.presentation.fastPitchEligible};}
 function copyCanvas(side,s){const source=win.document.getElementById('field'),canvas=$('view-'+side);
  if(canvas.width!==source.width)canvas.width=source.width;if(canvas.height!==source.height)canvas.height=source.height;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);
  // The match paints these transparent canvases above the field, in DOM order.
  // Copy all three; copying only #field loses the actual physical bat and ball.
  for(const id of ['field','bat-overlay','ball-overlay']){
   if(id==='ball-overlay')win.KneekuraNameDisplayControls.paintToCanvas(ctx,canvas.width,canvas.height);
   if(id==='ball-overlay'&&playing&&snapshots[side].freePitch)continue;
   const layer=win.document.getElementById(id);if(!layer)throw Error('試合の描画レイヤーがありません: '+id);
   ctx.drawImage(layer,0,0,canvas.width,canvas.height);
  }
  if($('guides').checked&&s.rendered.camera==='batter'){const v=s.presentation.continuousBatterView,cx=v?.cx??300,cy=v?.cy??216;
   ctx.save();ctx.scale(canvas.width/600,canvas.height/432);
   ctx.strokeStyle=side==='A'?'#70c8ff':'#ffdc69';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx-8,cy);ctx.lineTo(cx+8,cy);ctx.moveTo(cx,cy-8);ctx.lineTo(cx,cy+8);ctx.stroke();ctx.restore();}
  const snapshot=snapshots[side];$('phase-'+side).textContent=snapshot.tuning?.swingHeadLock?.active?'インパクト付近：微動を許して安定':snapshot.phase==='take-caught'?'見逃し：捕球時の向きを維持':snapshot.phase??'準備';
  const degrees=r=>Number.isFinite(r)?(r*180/Math.PI).toFixed(1)+'°':'—';
  $('metrics-'+side).textContent='同時刻 '+snapshot.sceneMs.toFixed(0)+'ms / Source tick '+snapshot.tick+'\n'+
   '下向き '+degrees(snapshot.pitch)+' / 左右 '+degrees(snapshot.yaw)+' / 狙い保持 '+(snapshot.aimWeight??0).toFixed(2)+'\n'+
   '目標の下向き '+degrees(snapshot.regulation?.targetPitch)+' / '+(snapshot.camera??camera)+'\n'+
   '絶対選球眼 '+(snapshot.model?.pitchTracking?.absolutePlateVision??'—')+' / 実追従 '+(snapshot.tuning?.pitchTracking?.gain??0).toFixed(3)+' / 実許容角 '+(snapshot.tuning?.pitchTracking?.deadbandRadians??0).toFixed(3)+'rad';
 }
 function renderPair(ms){if(!ready)return;
  if(ms<fastBallSceneMs){fastBall=null;fastPitchIndex=-1;lastPitchPaint=-Infinity;fastBallSceneMs=-Infinity;}
  clearPitchLayers();
  for(const side of SIDES){win.KneekuraContinuousBatterView=controllers[side];playback.seekPresentationMs(Math.max(0,ms));
   const s=checkSource();selectedPitchAtDraw=s.selectedPitch;snapshots[side]=summarize(s);copyCanvas(side,s);currentMs=s.presentation.elapsedMs;}
  cadence.sceneDraws++;if(playing&&fastBall&&fastPitchIndex===selectedPitchAtDraw&&snapshots.B.freePitch)paintPitchLayers(fastBall);
  syncTransport();
 }
 function clearPitchLayers(){for(const side of SIDES){const c=$('pitch-view-'+side);c.getContext('2d').clearRect(0,0,c.width,c.height);}}
 function paintPitchLayers(ball){for(const side of SIDES){const c=$('pitch-view-'+side),base=$('view-'+side);if(c.width!==base.width)c.width=base.width;if(c.height!==base.height)c.height=base.height;
   const rendering=playback.paintLivePitchBall(ball,snapshots[side].projection),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
   ctx.drawImage(win.document.getElementById('ball-overlay'),0,0,c.width,c.height);snapshots[side].fastBall=rendering.ballDotDisplay??null;
  }cadence.pitchBallPaints++;}
 const advanceDeadline=(previous,now,interval)=>Number.isFinite(previous)?previous+Math.max(1,Math.floor((now-previous)/interval))*interval:now;
 function updatePitchLayers(now,ms){if(!playback.isFreePitchAtPresentationMs(ms)){fastBall=null;fastPitchIndex=-1;clearPitchLayers();return;}
  if(now-lastPitchPaint<22&&fastPitchIndex===selectedPitchAtDraw)return;
  const ball=playback.observePitchBallAtPresentationMs(ms);lastPitchPaint=advanceDeadline(lastPitchPaint,now,22);
  if(!ball){fastBall=null;fastPitchIndex=-1;clearPitchLayers();return;}
  fastBall=ball;fastBallSceneMs=ms;fastPitchIndex=selectedPitchAtDraw;cadence.pitchBallSamples++;
  paintPitchLayers(ball);
 }
 function syncTransport(){const s=inspectSource(),duration=s.presentation.durationMs;
  $('timeline').max=Math.max(1,duration);$('timeline').value=currentMs;$('time-label').value=Math.round(currentMs)+' / '+Math.round(duration)+' ms';
  $('loop-label').value='区間 '+Math.round(loopStartMs)+'–'+Math.round(loopEndMs??duration)+' ms';
  const m=s.observedMatch??s.host.match;
  $('match-status').textContent=(m.inning??1)+'回'+(m.half==='top'?'表':'裏')+' / '+(m.outs??0)+'アウト / '+s.generatedPitches+'球生成'+(s.host.finished?' / 規定終了':'')+' / seed '+win.document.getElementById('match-seed').value;
  $('play').disabled=busy;$('next-pitch').disabled=busy||s.host.finished&&s.selectedPitch>=s.generatedPitches-1;
 }
 function refreshHistory(){const s=inspectSource(),select=$('pitch-list'),selected=s.selectedPitch;select.replaceChildren();
  for(const [i,r]of s.host.history.entries()){const option=document.createElement('option');option.value=i;
   option.textContent=(i+1)+'球目 / '+r.beforeMatch.inning+'回'+(r.beforeMatch.half==='top'?'表':'裏')+' / '+r.batterPlayerId+' / '+r.play.classification;
   select.append(option);}select.value=selected;refreshMarkers();
 }
 function refreshMarkers(){const s=inspectSource(),r=s.lastResult,box=$('markers');box.replaceChildren();if(!r)return;
  const prep=s.presentation.timing.preparationMs,d=r.play.diagnostics,tps=d.sourceClockTicksPerSecond??1e6,first=r.frames[0].tick,
   eventMs=tick=>prep+(tick-first)/tps*1000,hit=r.frames.find(f=>f.ballKind==='batted'),
   offense=r.beforeMatch.half==='top'?0:1,bunt=r.command.managedTeam===offense&&r.command.batting==='bunt',entries=[['投球開始',prep],
    ['スイング開始',d.swingOffered&&!bunt?eventMs(d.referenceStartTick):NaN],
    ['予定インパクト',eventMs(d.referenceContactTick)],
    ...SIDES.map(side=>{const setting=controllers[side].inspectSettings(),start=Math.max(d.predictionMadeAtElapsedSeconds??.14,Math.min((d.referenceThroughTick-first)/tps,(d.referenceContactTick-first)/tps+setting.impactStabilizeOffsetMs/1000));return [side+'：視線安定開始',setting.enabled&&d.swingOffered&&!bunt?prep+start*1000:NaN];}),['スイング終端',eventMs(d.referenceThroughTick)],
    ['打球発生',hit?eventMs(hit.tick):NaN],['公式終了',eventMs(r.play.rules.endedAtTick)]];
  for(const [title,ms]of entries)if(Number.isFinite(ms)&&ms>=0){const b=document.createElement('button');b.textContent=title+' '+Math.round(ms)+'ms';b.onclick=()=>run(()=>seek(ms));box.append(b);}
 }
 function readCommand(){return Object.fromEntries(COMMANDS.map(id=>[id,$('cmd-'+id).value]));}
 function validateCommand(value){object(value,COMMANDS,'配球指示');for(const id of COMMANDS){
  if(typeof value[id]!=='string'||![...win.document.getElementById(id).options].some(o=>o.value===value[id]))throw Error('未対応の配球指示: '+id);
 }return clone(value);}
 function applyCommand(value){for(const id of COMMANDS){const source=win.document.getElementById(id);source.value=value[id];$('cmd-'+id).value=value[id];source.dispatchEvent(new win.Event('change'));}}
 function pause(){const wasPlaying=playing;playing=false;cancelAnimationFrame(raf);fastBall=null;fastPitchIndex=-1;clearPitchLayers();if(ready&&!busy){playback.stop();if(wasPlaying)renderPair(currentMs);}}
 function seek(ms){guard();number(ms,0,1e9,'再生時刻');pause();renderPair(ms);return inspect();}
 function selectPitch(index){guard();const s=inspectSource();if(!Number.isSafeInteger(index)||index<0||index>=s.generatedPitches)throw Error('Unknown pitch');
  pause();playback.seekPitch(index);loopStartMs=0;loopEndMs=null;renderPair(0);$('pitch-list').value=index;refreshMarkers();return inspect();}
 function issueNext(){const before=inspectSource(),command=readCommand();applyCommand(command);win.document.getElementById('next-pitch').click();
  const after=checkSource();if(after.generatedPitches>before.generatedPitches)uiCommands.push(command);
  loopStartMs=0;loopEndMs=null;refreshHistory();return after;
 }
 function nextPitch(){guard();pause();issueNext();renderPair(0);return inspect();}
 function setCamera(value){guard();if(!['batter','runner','mound','catcher','overhead'].includes(value))throw Error('Unknown camera');
  pause();camera=value;$('camera-choice').value=value;win.document.querySelector('[data-camera="'+value+'"]').click();renderPair(currentMs);return inspect();}
 function setSpeed(value){guard();number(value,.1,4,'再生速度');pause();speed=value;$('speed').value=String(value);return inspect();}
 function setLoop(start,end){guard();const duration=inspectSource().presentation.durationMs;
  number(start,0,duration,'始点');if(end!==null){number(end,0,duration,'終点');if(end<=start)throw Error('終点は始点より後にしてください');}
  pause();loopStartMs=start;loopEndMs=end;syncTransport();return inspect();}
 function play(){guard();pause();if(!inspectSource().generatedPitches)issueNext();
  if(currentMs>=(loopEndMs??inspectSource().presentation.durationMs))renderPair(mode==='loop'?loopStartMs:0);
  if(mode==='loop'&&currentMs<loopStartMs)renderPair(loopStartMs);
  playing=true;playOrigin=currentMs;playStarted=performance.now();lastPaint=-Infinity;lastPitchPaint=-Infinity;
  const update=now=>{if(!playing)return;try{
   const duration=inspectSource().presentation.durationMs,end=mode==='loop'?(loopEndMs??duration):duration,
    desired=playOrigin+(now-playStarted)*speed;
   if(desired>=end){renderPair(end);
    if(mode==='loop'){playOrigin=loopStartMs;playStarted=now;renderPair(loopStartMs);updatePitchLayers(now,loopStartMs);}
    else if(mode==='match'&&!(inspectSource().host.finished&&inspectSource().selectedPitch===inspectSource().generatedPitches-1)){
     issueNext();renderPair(0);playOrigin=0;playStarted=now;
    }else{pause();return;}
   }else{if(now-lastPaint>=55){renderPair(desired);lastPaint=advanceDeadline(lastPaint,now,55);}updatePitchLayers(now,desired);}
   raf=requestAnimationFrame(update);
  }catch(error){fail(error);}};raf=requestAnimationFrame(update);
 }
 function setPlayMode(value){guard();if(!['loop','pause','match'].includes(value))throw Error('Unknown play mode');pause();mode=value;$('play-mode').value=value;}
 function gameConfig(value={}){object(value,['seed','innings'],'試合条件');const seed=value.seed??$('seed').value,innings=value.innings??Number($('innings').value);
  if(typeof seed!=='string'||!seed.length||seed.length>128)throw Error('seedは1〜128文字です');
  if(![...win.document.getElementById('inning-limit').options].some(option=>Number(option.value)===innings))throw Error('未対応の回数です');return {seed,innings};
 }
 function resetGame(config){pause();win.document.getElementById('match-seed').value=config.seed;win.document.getElementById('inning-limit').value=config.innings;
  $('seed').value=config.seed;$('innings').value=config.innings;playback.newGame();checkSource();uiCommands=[];loopStartMs=0;loopEndMs=null;
 }
 function newGame(value){guard();const config=gameConfig(value);resetGame(config);refreshHistory();renderPair(0);message('新しい試合です。次の一球を自由に生成できます。');return inspect();}
 function setBusy(value){busy=value;$('cancel-generation').disabled=!value;for(const id of ['next-pitch','play','new-game','generate','finish-game','load-session'])$(id).disabled=value;}
 function settleGeneration(){setBusy(false);refreshHistory();const partial=inspectSource();if(!partial.error)renderPair(partial.presentation.elapsedMs);else{snapshots={};currentMs=0;for(const side of SIDES){const canvas=$('view-'+side);canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);$('metrics-'+side).textContent='Coreエラーにより描画を停止';}syncTransport();}}
 async function generate(count=12){guard();if(!Number.isSafeInteger(count)||count<1||count>2048)throw Error('生成球数が範囲外です');pause();cancel=false;setBusy(true);
  try{const s=inspectSource();if(s.generatedPitches)playback.seekPitch(s.generatedPitches-1);
   for(let i=0;i<count&&!cancel&&!inspectSource().host.finished;i++){issueNext();message((i+1)+' / '+count+'球を生成中');await new Promise(resolve=>setTimeout(resolve,0));}
   checkSource();refreshHistory();renderPair(0);message(cancel?'生成を停止しました。':'球を生成しました。記録から比較するプレーを選べます。');
  }finally{setBusy(false);syncTransport();}return inspect();
 }
 async function finish(){guard();pause();cancel=false;setBusy(true);const command=readCommand();applyCommand(command);
  const progress=setInterval(()=>{const s=inspectSource();message('規定終了まで生成中 / '+s.generatedPitches+'球');},200);
  try{await playback.finish();const s=checkSource();while(uiCommands.length<s.generatedPitches)uiCommands.push(clone(command));
   refreshHistory();renderPair(s.presentation.elapsedMs);message(cancel?'生成を停止しました。':s.host.finished?'規定終了まで生成しました。全ての球を比較できます。':'生成を停止しました。');
  }finally{clearInterval(progress);const completed=inspectSource().generatedPitches;while(uiCommands.length<completed)uiCommands.push(clone(command));settleGeneration();}return inspect();
 }
 function cancelGeneration(){cancel=true;if(ready&&inspectSource().fast)void playback.finish();}
 function exportSession(){guard();const s=checkSource();if(uiCommands.length!==s.generatedPitches)throw Error('配球履歴と試合が一致しないため保存を停止しました');return {schema:'kneekura_camera_session_v1',sourceGameSha256:meta.sourceGameSha256,
  sourceCoreSha256:meta.sourceCoreSha256,settings:exportSettings().settings,ballDisplay:win.KneekuraBallDisplayControls.inspect(),nameDisplay:win.KneekuraNameDisplayControls.inspect(),pitcherBodyHead:win.KneekuraPitcherBodyHeadView.inspectSettings(),
  scenario:{seed:win.document.getElementById('match-seed').value,innings:Number(win.document.getElementById('inning-limit').value),commands:clone(uiCommands)},
  position:{pitchIndex:s.selectedPitch,sceneMs:currentMs,camera},playback:{speed,mode,loopStartMs,loopEndMs}};}
 async function importSession(packet){guard();
  object(packet,['schema','sourceGameSha256','sourceCoreSha256','settings','ballDisplay','nameDisplay','pitcherBodyHead','scenario','position','playback'],'再現session');
  if(packet.schema!=='kneekura_camera_session_v1'||packet.sourceGameSha256!==meta.sourceGameSha256||packet.sourceCoreSha256!==meta.sourceCoreSha256&&!meta.compatibleSessionCoreSha256.includes(packet.sourceCoreSha256))throw Error('再現sessionのschema／Coreが一致しません。v62は投球物理と守備AIが変わったため、旧版の同一試合としては再現できません');
  const ballDisplay=win.KneekuraBallDisplayControls.normalizeSettings(packet.ballDisplay??{}),nameDisplay=win.KneekuraNameDisplayControls.normalizeSettings(packet.nameDisplay??{}),pair=normalizePair(packet.settings),pitcherBodyHead=win.KneekuraPitcherBodyHeadView.normalizeSettings(packet.pitcherBodyHead??{});object(packet.scenario,['seed','innings','commands'],'scenario');if(typeof packet.scenario.seed!=='string'||!Number.isSafeInteger(packet.scenario.innings))throw Error('sessionにseedと回数が必要です');const config=gameConfig({seed:packet.scenario.seed,innings:packet.scenario.innings}),commands=packet.scenario.commands;
  if(!Array.isArray(commands)||commands.length>2048)throw Error('配球履歴が範囲外です');const validated=commands.map(validateCommand);
  object(packet.position,['pitchIndex','sceneMs','camera'],'position');const pos=packet.position;
  if(!Number.isSafeInteger(pos.pitchIndex)||pos.pitchIndex<(validated.length?0:-1)||pos.pitchIndex>=validated.length)throw Error('選択球が範囲外です');
  number(pos.sceneMs,0,1e9,'再生時刻');if(!['batter','runner','mound','catcher','overhead'].includes(pos.camera))throw Error('Unknown camera');
  object(packet.playback,['speed','mode','loopStartMs','loopEndMs'],'playback');const state=packet.playback;
  number(state.speed,.1,4,'速度');if(!['loop','pause','match'].includes(state.mode))throw Error('Unknown play mode');number(state.loopStartMs,0,1e9,'始点');
  if(state.loopEndMs!==null){number(state.loopEndMs,0,1e9,'終点');if(state.loopEndMs<=state.loopStartMs)throw Error('不正な再生区間です');}
  // Validate the entire packet before replacing the current match/settings.
  pause();cancel=false;setBusy(true);
  try{resetGame(config);for(const [i,command]of validated.entries()){
    if(cancel)throw Error('再現を中断しました。途中までの試合を保持します');if(inspectSource().host.finished)throw Error('規定終了後の配球が含まれています');
    applyCommand(command);issueNext();message('セッション再現中 '+(i+1)+' / '+validated.length+'球');await new Promise(resolve=>setTimeout(resolve,0));
   }
   applyPair(pair);applyBallDisplay(ballDisplay);applyNameDisplay(nameDisplay);applyPitcherBodyHead(pitcherBodyHead);if(pos.pitchIndex>=0)playback.seekPitch(pos.pitchIndex);camera=pos.camera;$('camera-choice').value=camera;
   win.document.querySelector('[data-camera="'+camera+'"]').click();speed=state.speed;$('speed').value=String(speed);mode=state.mode;$('play-mode').value=mode;
   loopStartMs=Math.min(state.loopStartMs,inspectSource().presentation.durationMs);loopEndMs=state.loopEndMs===null?null:Math.min(state.loopEndMs,inspectSource().presentation.durationMs);
   if(loopEndMs!==null&&loopEndMs<=loopStartMs){loopStartMs=0;loopEndMs=null;}
   refreshHistory();renderPair(pos.sceneMs);message('同じCoreでセッションを再現しました。');
  }finally{settleGeneration();}return inspect();
 }
 function measure(){guard();const source=inspectSource(),r=source.lastResult;if(!r)throw Error('先に球を生成してください');
  const player=source.physicalRoster.players.find(p=>p.playerId===r.batterPlayerId),batter={...player,height:player.heightMeters,hand:r.play.diagnostics.battingSide},
   prep=source.presentation.timing.preparationMs,tps=r.play.diagnostics.sourceClockTicksPerSecond??1e6,origin=r.frames[0].tick,
   readers=Object.fromEntries(SIDES.map(side=>[side,factory.create(controllers[side].inspectSettings())])),samples=[];
  for(let ms=0;ms<=source.presentation.durationMs;ms+=55){const tick=origin+Math.max(0,ms-prep)/1000*tps,
   f=ms<=prep?r.beforeFrame:r.frames.findLast(f=>f.tick<=tick)??r.frames[0],row={ms};
   for(const side of SIDES){const v=readers[side].observe({record:r,frame:f,sceneMs:ms,preparationMs:prep,batter,
     previousRecord:source.selectedPitch>0?source.host.history[source.selectedPitch-1]:null});
    row[side]={pitch:v.pitch,yaw:v.yaw,phase:v.phase,aimWeight:v.aimWeight,tuning:v.tuning??null,regulation:v.regulation??null};}
   samples.push(row);
  }
  lastMeasure={pitchIndex:source.selectedPitch,samples};drawPlot(samples);$('measure-status').textContent='青=A、黄=B / '+samples.length+'標本 / '+Math.round(source.presentation.durationMs)+'ms。設定変更後は再計測してください。';return clone(lastMeasure);
 }
 function drawPlot(samples){const canvas=$('angle-plot'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,pad=32;
  ctx.clearRect(0,0,w,h);ctx.font='12px sans-serif';ctx.lineWidth=1;ctx.fillStyle='#aebdc8';
  for(const degrees of [-60,-30,0,30,60]){const y=pad+(degrees+80)/160*(h-pad*2);ctx.strokeStyle='#34414c';ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-pad,y);ctx.stroke();ctx.fillText(degrees+'°',0,y+4);}
  for(const side of SIDES){ctx.strokeStyle=side==='A'?'#70c8ff':'#ffdc69';ctx.lineWidth=2;ctx.beginPath();
   for(const [i,row]of samples.entries()){const x=pad+row.ms/Math.max(1,samples.at(-1).ms)*(w-pad*2),y=pad+(row[side].pitch*180/Math.PI+80)/160*(h-pad*2);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.stroke();}
 }
 function inspect(){if(!ready)return {version:1,ready:false};const s=inspectSource();return {version:1,ready:true,busy,playing,speed,mode,camera,
  sceneMs:currentMs,durationMs:s.presentation.durationMs,selectedPitch:s.selectedPitch,generatedPitches:s.generatedPitches,finished:s.host.finished,
  loopStartMs,loopEndMs,A:clone(snapshots.A??null),B:clone(snapshots.B??null),settings:exportSettings().settings,ballDisplay:win.KneekuraBallDisplayControls.inspect(),nameDisplay:win.KneekuraNameDisplayControls.inspect(),pitcherBodyHead:win.KneekuraPitcherBodyHeadView.inspectSettings(),cadence:{...cadence},
  seed:win.document.getElementById('match-seed').value,uiCommands:clone(uiCommands),error:s.error,source:meta};}
 function save(packet,name){const url=URL.createObjectURL(new Blob([JSON.stringify(packet,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function run(action){try{return await action();}catch(error){fail(error);}}
 function bind(){const click=(id,action)=>$(id).onclick=()=>run(action);
  click('next-pitch',nextPitch);click('play',play);click('pause',pause);click('step-back',()=>seek(Math.max(0,currentMs-55)));click('step-forward',()=>seek(currentMs+55));
  $('timeline').oninput=()=>run(()=>seek(Number($('timeline').value)));$('pitch-list').onchange=()=>run(()=>selectPitch(Number($('pitch-list').value)));
  $('camera-choice').onchange=()=>run(()=>setCamera($('camera-choice').value));$('speed').onchange=()=>run(()=>setSpeed(Number($('speed').value)));
  $('play-mode').onchange=()=>run(()=>setPlayMode($('play-mode').value));$('guides').onchange=()=>run(()=>renderPair(currentMs));
  click('loop-start',()=>setLoop(currentMs,loopEndMs));click('loop-end',()=>setLoop(loopStartMs,currentMs));click('loop-clear',()=>setLoop(0,null));
  click('copy-a-b',()=>setSettings('B',controllers.A.inspectSettings()));click('copy-b-a',()=>setSettings('A',controllers.B.inspectSettings()));
  click('reset-baseline',()=>setSettings('A',{...factory.defaults,swingUsesAbsoluteVision:false,swingHeadCoupling:0,impactMaxMotionRadians:.025,impactMaxSpeedRadPerSecond:.18}));click('reset-default',()=>setSettings('B',factory.defaults));
  for(const key of ['perspective','overhead','overheadHeightEmphasis'])$('lab-ball-scale-'+key).onchange=()=>run(()=>setBallDisplay({[key]:Number($('lab-ball-scale-'+key).value)}));
  click('lab-ball-scale-reset',()=>setBallDisplay(win.KneekuraBallDisplayControls.defaults));
   $('lab-name-scale').onchange=()=>run(()=>setNameDisplay({scale:Number($('lab-name-scale').value)}));click('lab-name-reset',()=>setNameDisplay(win.KneekuraNameDisplayControls.defaults));
   click('curve-early',()=>curveTiming('early'));click('curve-late',()=>curveTiming('late'));
  click('new-game',()=>newGame());click('generate',()=>generate(12));click('finish-game',finish);click('cancel-generation',cancelGeneration);click('measure',measure);
  click('save-settings',()=>save(exportSettings(),'kneekura-camera-tuning.json'));click('save-session',()=>save(exportSession(),'kneekura-camera-session.json'));
  $('load-settings').onchange=event=>run(async()=>{const file=event.target.files[0];if(file){if(file.size>100000)throw Error('調整JSONが大きすぎます');importSettings(JSON.parse(await file.text()));}});
  $('lab-pitcher-head-enabled').onchange=()=>run(()=>setPitcherBodyHead({enabled:$('lab-pitcher-head-enabled').checked}));
  $('lab-pitcher-head-scale').onchange=()=>run(()=>setPitcherBodyHead({scale:Number($('lab-pitcher-head-scale').value)}));
  $('load-session').onchange=event=>run(async()=>{const file=event.target.files[0];if(file){if(file.size>2000000)throw Error('再現sessionが大きすぎます');await importSession(JSON.parse(await file.text()));}});
  click('copy-json',async()=>{try{await navigator.clipboard.writeText($('settings-json').value);message('調整JSONをコピーしました。');}catch{$('settings-json').select();message('JSONを選択しました。コピー操作で保存できます。');}});
  document.addEventListener('keydown',event=>{if(/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)||event.ctrlKey||event.metaKey||event.altKey)return;
   if(event.code==='Space'){event.preventDefault();run(playing?pause:play);}else if(event.key==='ArrowLeft'){event.preventDefault();run(()=>seek(Math.max(0,currentMs-55)));}
   else if(event.key==='ArrowRight'){event.preventDefault();run(()=>seek(currentMs+55));}});
 }
 frame.addEventListener('load',()=>run(()=>{
  win=frame.contentWindow;playback=win.liveMatchPlayback;factory=win.KneekuraCameraTuningBatterView;if(!playback||!factory)throw Error('埋め込み試合の起動に失敗しました');
  controllers={A:factory.create({swingUsesAbsoluteVision:false,swingHeadCoupling:0,impactMaxMotionRadians:.025,impactMaxSpeedRadPerSecond:.18}),B:factory.create()};createSettings();
  for(const [i,id]of COMMANDS.entries()){const source=win.document.getElementById(id),label=document.createElement('label'),select=source.cloneNode(true);
   select.id='cmd-'+id;label.textContent=TITLES[i];label.append(select);$('commands').append(label);select.onchange=()=>run(()=>{guard();applyCommand(readCommand());});}
  $('seed').value=win.document.getElementById('match-seed').value;win.document.getElementById('fixed-seed').checked=true;
  $('innings').replaceChildren(...[...win.document.getElementById('inning-limit').options].map(option=>option.cloneNode(true)));$('innings').value=win.document.getElementById('inning-limit').value;
  const overhead=win.document.getElementById('auto-overhead');overhead.checked=false;overhead.dispatchEvent(new win.Event('change'));
  win.document.querySelector('[data-camera="batter"]').click();
  let storageWarning='',restored=false;try{const saved=localStorage.getItem(STORE);if(saved){const restoredPacket=settingsPacket(JSON.parse(saved));applyPair(restoredPacket.pair);applyBallDisplay(restoredPacket.ballDisplay);applyNameDisplay(restoredPacket.nameDisplay);applyPitcherBodyHead(restoredPacket.pitcherBodyHead);restored=true;}}catch{storageWarning=' 保存済み設定は読み込めなかったため初期値を使用しました。';}
  ready=true;bind();syncSettings();persist();renderPair(0);$('pause').disabled=false;$('step-back').disabled=false;$('step-forward').disabled=false;
  $('source-info').textContent='基準試合SHA256 '+meta.sourceGameSha256+' / Core '+meta.sourceCoreSha256+' / '+meta.sourceInputCount+'入力';
  message((restored?'準備完了。保存済みのA/B設定を復元しました。':'準備完了。Aはv59スイング基準、Bは身体連動を加えた初期値です。')+storageWarning);
 }));
 window.KneekuraCameraLab=Object.freeze({version:1,inspect,setSettings,seek,selectPitch,nextPitch,generate,play,pause,setCamera,setSpeed,setLoop,setPlayMode,
  measure,setBallDisplay,setNameDisplay,setPitcherBodyHead,curveTiming,exportSettings,importSettings,exportSession,importSession,newGame,finish,cancelGeneration});
 frame.srcdoc=CAMERA_LAB_GAME_HTML;
})();
