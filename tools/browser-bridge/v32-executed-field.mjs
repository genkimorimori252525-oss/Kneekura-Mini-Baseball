/** Adds a read-only primary-canvas observation of a finite Native export.
 * Existing PNGs, camera projection, coarse ball material and 4px raster stay
 * owned by the approved renderer. No legacy result is used after entry. */
export function transformExecutedFieldV32(source, recording, provenance) {
  let html = source;
  const replace = (before, after) => {
    if (!html.includes(before) || html.indexOf(before) !== html.lastIndexOf(before)) throw new Error('v32 guard: ' + before.slice(0, 90));
    html = html.replace(before, after);
  };
  replace('presentationVersion:31', 'presentationVersion:32');
  replace('version:23,presentationVersion:32,', `version:23,presentationVersion:32,
 nativeDrawExecutedWorld:(observed,options)=>{pause();
  broadcast.draw(observed,{...state,...options,ballOverlay:true,batOverlay:true,zone:false,history:false});
  broadcast.paintBallOverlay(observed.ball,$('ball-overlay'));
  broadcast.paintBatOverlay(observed.bat,$('bat-overlay'));return broadcast.inspect();},`);
  replace('const illustratedBat=action===\'bat\'&&state.camera===\'mound\';',
    'const illustratedBat=action===\'bat\'&&state.camera===\'mound\'&&!observed.nativeBattedObservation;');
  replace("if(state?.camera==='mound'&&state.appearance==='retro')return 0;",
    "if(state?.camera==='mound'&&state.appearance==='retro'&&!observed.nativeBattedObservation)return 0;");
  replace('if(observed.fair&&observed.ball){const target=observed.ball.position;',
    `if(observed.nativeBattedObservation){
    const pitcher=observed.actors.find(actor=>actor.id==='P');
    if(pitcher)base.eye={x:pitcher.position.x,y:pitcher.position.y+pitcher.player.height*.92,z:pitcher.position.z};
   }
   if((observed.fair||observed.nativeBattedObservation)&&observed.ball){const target=observed.ball.position;`);
  replace("window.addEventListener('resize',()=>render(true));",
    "window.addEventListener('resize',()=>{if(!window.nativeFieldPlayback)render(true);});");
  const paintStart=html.indexOf('function paintBatOverlay(bat,overlay){'),paintEnd=html.indexOf('function ballVisibleFromCamera()',paintStart);
  if(paintStart<0||paintEnd<0)throw new Error('v32 native bat radius seam missing');
  let paint=html.slice(paintStart,paintEnd).replaceAll('batReferenceRadius(t)','displayBatRadius(t)');
  const segment='const segment=(a,b,t)=>';
  if(!paint.includes(segment))throw new Error('v32 bat interpolation seam missing');
  paint=paint.replace(segment,`const displayBatRadius=t=>{
   const knots=bat.nativeObservation?bat.radiusProfile?.knots:null;
   if(!knots)return batReferenceRadius(t);
   const index=knots.findIndex(k=>k.t>=t),b=knots[index<0?knots.length-1:index],a=knots[Math.max(0,(index<0?knots.length-1:index)-1)];
   return b.t===a.t?b.radiusM:a.radiusM+(b.radiusM-a.radiusM)*(t-a.t)/(b.t-a.t);
  };\n  `+segment);
  html=html.slice(0,paintStart)+paint+html.slice(paintEnd);
  const escaped = value => JSON.stringify(value).replaceAll('<', '\\u003c');
  const runtime = `
(() => {
 'use strict';
 const $=id=>document.getElementById(id),visual=window.matchPreview;
 const payload=JSON.parse($('v32-executed-field-recording').textContent);
 const exportProvenance=JSON.parse($('v32-executed-field-provenance').textContent);
 const observer=window.KneekuraNativeMatchCore.createExecutedFieldWorldObserverV1(payload);
 const roles=['P','C','1B','2B','3B','SS','LF','CF','RF'];
 // Explicit presentation names only. This export does not establish the named
 // TBD/LAD roster's SI capability calibration, so no famous-player alias is used.
 const playerBindings=Object.fromEntries(observer.frames[0].players.map((actor,index)=>{
  const held=observer.frames[0].heldBats.some(b=>b.holderPlayerId===actor.playerId);
  const role=held?'BAT':roles.filter(r=>r!=='BAT')[index-(observer.frames[0].heldBats.some(b=>b.holderPlayerId===observer.frames[0].players[0].playerId)?1:0)]??('F'+index);
  return [actor.playerId,{id:role,role:held?'batter':role,player:{name:held?'打者':role,team:held?0:1,height:1.83,hand:'R',form:'over'}}];
 }));
 let elapsed=observer.fromElapsedSeconds,playing=false,startedAt=0,startElapsed=elapsed,token=0,lastDraw=-Infinity;
 let currentFrame=null,rendered=null,options={camera:'overhead',appearance:'retro',labels:true,zoom:1,homeClose:false};
 const cameras={catcher:'捕手目線',batter:'打者目線',runner:'走者目線',mound:'投手目線',overhead:'俯瞰'};
 function stop(){playing=false;token++;$('play').textContent='実行済み区間を再生';}
 function draw(){
  currentFrame=observer.observe(elapsed);
  const actors=currentFrame.players.map(actor=>({...playerBindings[actor.playerId],sourcePlayerId:actor.playerId,
   position:actor.anchor,running:Math.hypot(...Object.values(actor.velocity))>0,walking:false}));
  const batter=actors.find(actor=>actor.id==='BAT')?.player??actors[0].player;
  const pitcher=actors.find(actor=>actor.id==='P')?.player??actors[0].player;
  const localTick=(currentFrame.moment.elapsedSeconds-observer.fromElapsedSeconds)/.055;
  const world={nativeBattedObservation:true,tick:currentFrame.moment.ball.tick,localTick,
   p:{contactLocal:0,catchLocal:null,swing:true,outcome:null,actors:[],presentationEvidence:null},
   batter,pitcher,actors,ball:currentFrame.ball,bat:currentFrame.heldBats[0]??null,
   batFrame:0,pitchFrame:0,fair:false,fairKnown:false,custody:null,benchReturn:false,officialKnown:false,
   phase:currentFrame.atCoverageEnd?'実行済み区間の終端':'正式Coreの実行済み動作',history:[]};
  rendered=visual.nativeDrawExecutedWorld(world,options);
  $('phase').textContent=world.phase;$('camera-caption').textContent=cameras[options.camera]+' / 正式Core実行記録';
  $('result-text').textContent=currentFrame.atCoverageEnd?'後続の承認済み動作待ち':'正式Coreの実行済み動作';
  $('pitch-meta').textContent=((currentFrame.moment.elapsedSeconds-observer.fromElapsedSeconds)*1000).toFixed(1)+' ms / '+
   ((observer.throughElapsedSeconds-observer.fromElapsedSeconds)*1000).toFixed(1)+' ms';
  $('match-progress').textContent='保存済み物理状態 '+observer.frames.length+'件 / 公式結果は未確定';
  $('runner-presence').hidden=true;
  document.querySelectorAll('[data-camera]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.camera===options.camera)));
  document.querySelectorAll('[data-appearance]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.appearance===options.appearance)));
 }
 function seek(value){stop();elapsed=Math.max(observer.fromElapsedSeconds,Math.min(observer.throughElapsedSeconds,value));draw();}
 function play(){
  if(playing){stop();return;}
  if(elapsed>=observer.throughElapsedSeconds)elapsed=observer.fromElapsedSeconds;
  playing=true;startedAt=performance.now();startElapsed=elapsed;const clock=++token;lastDraw=-Infinity;$('play').textContent='一時停止';
  function update(now){
   if(!playing||clock!==token)return;
   const speed=Number($('speed').value)||1;
   // The first rAF timestamp may precede performance.now() taken in the click
   // handler. Clamp only the wall-clock playback offset, never a Core time.
   elapsed=Math.min(observer.throughElapsedSeconds,startElapsed+Math.max(0,now-startedAt)*speed/1000);
   if(now-lastDraw>=55||elapsed===observer.throughElapsedSeconds){draw();lastDraw=now;}
   if(elapsed===observer.throughElapsedSeconds){stop();return;}
   requestAnimationFrame(update);
  }requestAnimationFrame(update);
 }
 visual.seek(0);
 for(const id of ['new-game','finish-game','inning-select','pa-select','managed-team','batting-choice','pitch-choice','location-choice',
  'inning-limit','match-seed','fixed-seed','auto-overhead','zone','history','native-enter','native-issue','native-exit'])if($(id))$(id).disabled=true;
 for(const id of ['auto-overhead','zone','history'])$(id).checked=false;
 $('play').onclick=play;$('restart').onclick=()=>seek(observer.fromElapsedSeconds);
 $('previous-pitch').disabled=false;$('next-pitch').disabled=false;
 $('restart').textContent='実行区間の最初へ';
 $('previous-pitch').textContent='1コマ戻る';$('next-pitch').textContent='1コマ進む';
 function adjacentFrame(direction){
  let index=0;while(index+1<observer.frames.length&&observer.frames[index+1].moment.elapsedSeconds<=currentFrame.moment.elapsedSeconds)index++;
  seek(observer.frames[Math.max(0,Math.min(observer.frames.length-1,index+direction))].moment.elapsedSeconds);
 }
 $('previous-pitch').onclick=()=>adjacentFrame(-1);$('next-pitch').onclick=()=>adjacentFrame(1);
 $('speed').onchange=()=>{if(playing){stop();play();}};
 document.querySelectorAll('[data-camera]').forEach(button=>button.onclick=()=>{options.camera=button.dataset.camera;draw();});
 document.querySelectorAll('[data-appearance]').forEach(button=>button.onclick=()=>{options.appearance=button.dataset.appearance;draw();});
 $('labels').onchange=e=>{options.labels=e.target.checked;draw();};$('home-close').onchange=e=>{options.homeClose=e.target.checked;draw();};
 $('zoom').oninput=e=>{options.zoom=Number(e.target.value)/100;$('zoom-value').textContent=e.target.value+'%';draw();};
 $('field').onclick=()=>{};$('pitch-chart').onclick=()=>{};
 $('export-game').textContent='実行記録を保存';$('export-game').onclick=()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download='kneekura-native-field-execution.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 $('native-proof-panel').hidden=true;
 document.querySelector('.edition').textContent='正式Core 後続動作観測版 32';
 document.querySelector('.match-heading h1').textContent='Core実行記録';
 document.querySelector('.match-heading>span').textContent='身体・球・バット';
 $('inning-label').textContent='公式結果は未確定';
 $('pitch-number').textContent='—';
 const resetSelect=(id,text)=>{const option=document.createElement('option');option.textContent=text;option.value='';$(id).replaceChildren(option);};
 resetSelect('managed-team','実行済み記録');resetSelect('inning-limit','有限の動作区間');
 resetSelect('inning-select','未確定');resetSelect('pa-select','後続動作');
 $('match-seed').value=observer.executionSource.sourceId;
 // Old prototype statistics are not Native facts and must not survive entry.
 $('score-body').replaceChildren();$('bso').replaceChildren();$('bases').hidden=true;
 $('pitch-list').replaceChildren();$('chart-caption').textContent='この後続動作区間に投球結果の追加はありません';
 $('pitch-chart').getContext('2d').clearRect(0,0,$('pitch-chart').width,$('pitch-chart').height);
 for(const id of ['pitcher-number','pitcher-hand','pitcher-meta','batter-number','batter-hand','batter-meta'])$(id).textContent='';
 $('pitcher-name').textContent='投手';$('batter-name').textContent='打者';
 $('manager-hint').textContent='実行済み区間の観測。追加動作・走者・裁定は未接続';
 $('manager-status').textContent='正式Coreの保存済み後続動作。材料・負荷応答は明示的な合成校正で、実在選手の能力を証明するものではありません。';
 document.querySelector('footer p').textContent='正式Coreが実行・保存した有限区間を同じ4pxカメラで観測します。球・回転・身体位置・保持バットは記録に従い、描画から結果や次動作は作りません。9回の全試合は未完成です。';
 document.querySelector('footer details').hidden=true;
 document.querySelector('footer>span').textContent='4px / 実行済み状態55ms・物理境界';
 $('spin-hud')&&($('spin-hud').hidden=true);
 window.addEventListener('resize',()=>requestAnimationFrame(draw));
 document.addEventListener('keydown',event=>{
  if(event.target.matches('input,select,textarea'))return;
  if([' ','Enter','ArrowLeft','ArrowRight'].includes(event.key)){
   event.preventDefault();event.stopImmediatePropagation();
   if(event.key==='ArrowLeft')$('previous-pitch').click();else if(event.key==='ArrowRight')$('next-pitch').click();else play();
  }
 },true);
 window.nativeFieldPlayback=Object.freeze({play,stop,seek,inspect:()=>({version:32,playing,elapsedSeconds:elapsed,
  observedMoment:currentFrame.moment,playerCount:currentFrame.players.length,primitiveCount:currentFrame.players.reduce((sum,p)=>sum+p.primitives.length,0),
  heldBatCount:currentFrame.heldBats.length,ball:currentFrame.ball,actors:currentFrame.players,rendered,executionSource:observer.executionSource,
  exportProvenance,provenance:observer.provenance,fromElapsedSeconds:observer.fromElapsedSeconds,throughElapsedSeconds:observer.throughElapsedSeconds,
  frameCount:observer.frames.length,atCoverageEnd:currentFrame.atCoverageEnd,officialResult:null,canIssueMotion:false,legacyFallback:false})});
 seek(observer.fromElapsedSeconds);
})();`;
  replace('</body></html>', `<script id="v32-executed-field-recording" type="application/json">${escaped(recording)}</script>\n` +
    `<script id="v32-executed-field-provenance" type="application/json">${escaped(provenance)}</script>\n<script id="v32-executed-field-observer">${runtime}\n</script>\n</body></html>`);
  return html;
}
