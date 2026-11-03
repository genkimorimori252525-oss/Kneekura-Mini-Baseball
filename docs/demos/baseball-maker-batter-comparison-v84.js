/* Read-only ordinary-match rendering of the existing four comparison cases. */
(function(root){
 'use strict';
 const comparison=root.KneekuraBallComparison,$=id=>document.getElementById(id),
  clone=value=>JSON.parse(JSON.stringify(value)),radians=degrees=>degrees*Math.PI/180,
  defaults=Object.freeze({yawDegrees:0,pitchDegrees:0,zoom:1,panX:0,panY:0}),
  limits={yawDegrees:180,pitchDegrees:57,panX:2,panY:2};
 if(!comparison||!$('ball-comparison-editor'))return;
 const panel=document.createElement('section');panel.id='comparison-batter-panel';panel.className='comparison-batter-panel';
 panel.innerHTML=`<h4>打者の目線で比べる</h4>
  <p class="note">上の「強調する弾道」と再生時間に合わせて、試合と同じ見え方で表示します。打席からの比較用表示です。守備・走塁は動かしません。右ボタンでドラッグすると見回せます。左ボタンは表示位置、マウスホイールは拡大率の調整です。</p>
  <div class="swing-toolbar comparison-batter-controls">
   <label>左右の向き <output id="comparison-batter-yaw-label">0°</output><input id="comparison-batter-yaw" type="range" min="-180" max="180" step="0.5" value="0" data-help="試合中の打者の視線を基準に、左右を見回します。右ボタンで画面をドラッグしても調整できます。投球や打球の結果は変わりません。"></label>
   <label>上下の向き <output id="comparison-batter-pitch-label">0°</output><input id="comparison-batter-pitch" type="range" min="-57" max="57" step="0.5" value="0" data-help="試合中の打者の視線を基準に、上下を見回します。角度を変えても打者の目の位置は変わりません。"></label>
   <label>打者画面の拡大率 <output id="comparison-batter-zoom-label">1倍</output><input id="comparison-batter-zoom" type="range" min="0.25" max="4" step="0.05" value="1" data-help="打者の画面だけを拡大します。横から・上からの図や、バットと球の計算は変わりません。"></label>
   <button id="comparison-batter-reset" type="button" data-help="再生している時間や弾道はそのままに、打者画面の向き・拡大率・表示位置を最初の状態へ戻します。">打者の向きと拡大を戻す</button>
  </div>
  <p id="comparison-batter-status" class="note" role="status">「同じ球で4段階を計算」を押すと表示します。</p>
  <div id="comparison-batter-surface" class="comparison-batter-surface" tabindex="0" role="img" aria-label="試合と同じ打者目線。右ドラッグで見回し、左ドラッグで表示位置を調整。矢印キーで向き、プラス・マイナスで拡大、Homeで初期状態へ戻します。"><canvas id="comparison-canvas-batter" width="1200" height="864"></canvas></div>`;
 $('ball-comparison-editor').querySelector('.comparison-views').before(panel);
 if(root.KneekuraBallComparisonLayoutV74===true){
  panel.classList.add('comparison-batter-compact');panel.querySelector('h4').textContent='打者目線で比べる';
  const actions=document.createElement('div');actions.className='swing-toolbar comparison-batter-actions';actions.id='comparison-batter-actions';
  const moveWithHelp=(node,parent)=>{const help=node.nextElementSibling?.classList.contains('maker-help-button')?node.nextElementSibling:null;parent.append(node);if(help)parent.append(help);};
  moveWithHelp($('comparison-run'),actions);moveWithHelp($('comparison-next'),actions);panel.querySelector('h4').after(actions);
  const playback=$('comparison-play').closest('.swing-toolbar');playback.classList.add('comparison-batter-playback');actions.after(playback);
  const timeline=document.createElement('div');timeline.className='comparison-batter-timeline';moveWithHelp($('comparison-time').closest('label'),timeline);playback.after(timeline);
  const controls=panel.querySelector('.comparison-batter-controls'),details=document.createElement('details'),summary=document.createElement('summary');
  summary.textContent='打者画面の向き・拡大を調整';details.append(summary,controls);$('comparison-batter-surface').after(details);
  panel.append(panel.querySelector('p.note'));
 }
 const canvas=$('comparison-canvas-batter'),surface=$('comparison-batter-surface'),status=$('comparison-batter-status'),
  frame=document.createElement('iframe');frame.id='comparison-batter-frame';frame.className='comparison-batter-frame';
 frame.title='打者比較の試合描画';frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
 let view={...defaults},renderer=null,cachedResult=null,cachedInput=null,cachedContext=null,preparedResult=null,
  generation=0,rendered=null,drag=null,error=null,loading=false,lastPaint=-Infinity;
 const numberText=value=>value.toFixed(1).replace(/\.0$/,''),clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 function refreshControls(){
  for(const [key,id]of [['yawDegrees','yaw'],['pitchDegrees','pitch'],['zoom','zoom']]){
   $('comparison-batter-'+id).value=String(view[key]);
   $('comparison-batter-'+id+'-label').textContent=numberText(view[key])+(id==='zoom'?'倍':'°');
  }
  canvas.style.transform=`translate(${view.panX*100}%,${view.panY*100}%)`;
 }
 function blank(message){const c=canvas.getContext('2d');c.fillStyle='#18221c';c.fillRect(0,0,canvas.width,canvas.height);
  c.fillStyle='#eef6ef';c.font='22px sans-serif';c.fillText(message,28,48);}
 function current(){const info=comparison.inspect();return {info,level:Number($('comparison-level').value)};}
 function render(force=false){
  const result=comparison.getResult(),{info,level}=current();
  if(result!==cachedResult){if(renderer&&preparedResult)renderer.reset();generation++;cachedResult=result;cachedInput=result?comparison.getInput():null;
   cachedContext=result?clone(info.context):null;preparedResult=null;rendered=null;stopDrag();error=null;lastPaint=-Infinity;}
  if(!result){preparedResult=null;rendered=null;
   blank('同じ球で4段階を計算すると表示します。');status.textContent='「同じ球で4段階を計算」を押すと表示します。';return;}
  if(!renderer){blank(error?'試合画面を読み込めませんでした。':'試合の描画を準備しています…');
   status.textContent=error??'試合の描画を準備しています…';return;}
  const now=performance.now();
  // V84: the child adapter owns the shared whole-scene cadence.
  try{
   if(preparedResult!==result){
    const core=root.KneekuraBaseballWorkbench,catalog=root.KneekuraLiveGameRosterCatalog,
     players=core?.applyLivePhysicalRosterV1&&catalog?core.applyLivePhysicalRosterV1({players:catalog.players,roster:root.baseballMaker.getLiveRoster()}).players:undefined;
    renderer.prepare({result,input:cachedInput,context:cachedContext,...(players?{players}:{})});preparedResult=result;
   }
   renderer.render({level,seconds:info.clockSeconds,yawOffset:radians(view.yawDegrees),pitchOffset:radians(view.pitchDegrees),zoom:view.zoom,playing:info.playing});
   renderer.copyToCanvas(canvas);lastPaint=now;rendered={level,clockSeconds:info.clockSeconds,generation};error=null;
   status.textContent='弾道'+level+' ／ 投球が始まってから '+info.clockSeconds.toFixed(3)+'秒';status.classList.remove('error');
  }catch(e){error=String(e.message??e);rendered=null;status.textContent=error;status.classList.add('error');blank('打者画面の描画に失敗しました。');}
 }
 function setView(patch={}){
  if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('打者画面の設定を確認してください。');
  const next={...view};
  for(const [key,descriptor]of Object.entries(Object.getOwnPropertyDescriptors(patch))){
   if(!Object.hasOwn(defaults,key)||!Object.hasOwn(descriptor,'value')||!Number.isFinite(descriptor.value))throw Error('打者画面の設定を確認してください。');
   const value=descriptor.value;if(key==='zoom'?(value<.25||value>4):Math.abs(value)>limits[key])throw Error('打者画面の設定が範囲外です。');next[key]=value;
  }
  view=next;refreshControls();render(true);return clone(view);
 }
 function stopDrag(){const previous=drag;drag=null;delete surface.dataset.dragging;
  if(previous&&surface.hasPointerCapture(previous.id))surface.releasePointerCapture(previous.id);}
 function resetView(){stopDrag();return setView(defaults);}
 for(const [id,key]of [['yaw','yawDegrees'],['pitch','pitchDegrees'],['zoom','zoom']])$('comparison-batter-'+id).addEventListener('input',e=>setView({[key]:Number(e.target.value)}));
 $('comparison-batter-reset').onclick=resetView;
 surface.addEventListener('contextmenu',e=>e.preventDefault());
 surface.addEventListener('pointerdown',e=>{
  if(!cachedResult||![0,2].includes(e.button)||drag)return;
  e.preventDefault();surface.focus({preventScroll:true});drag={id:e.pointerId,button:e.button,x:e.clientX,y:e.clientY,view:{...view}};
  surface.setPointerCapture(e.pointerId);surface.dataset.dragging=e.button===2?'angle':'pan';
 });
 surface.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;const r=surface.getBoundingClientRect(),dx=(e.clientX-drag.x)/r.width,dy=(e.clientY-drag.y)/r.height;
  if(drag.button===2)setView({yawDegrees:clamp(drag.view.yawDegrees+dx*180,-180,180),pitchDegrees:clamp(drag.view.pitchDegrees-dy*90,-limits.pitchDegrees,limits.pitchDegrees)});
  else setView({panX:clamp(drag.view.panX+dx,-2,2),panY:clamp(drag.view.panY+dy,-2,2)});
 });
 for(const event of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(event,e=>{
  if(drag&&drag.id!==e.pointerId)return;stopDrag();
 });
 surface.addEventListener('wheel',e=>{if(!cachedResult)return;e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?surface.clientHeight:1;
  setView({zoom:clamp(view.zoom*Math.exp(-e.deltaY*unit*.0015),.25,4)});},{passive:false});
 surface.addEventListener('keydown',e=>{
  const step=e.shiftKey?10:2,patch={};
  if(e.key==='ArrowLeft')patch.yawDegrees=clamp(view.yawDegrees-step,-180,180);
  else if(e.key==='ArrowRight')patch.yawDegrees=clamp(view.yawDegrees+step,-180,180);
  else if(e.key==='ArrowUp')patch.pitchDegrees=clamp(view.pitchDegrees+step,-limits.pitchDegrees,limits.pitchDegrees);
  else if(e.key==='ArrowDown')patch.pitchDegrees=clamp(view.pitchDegrees-step,-limits.pitchDegrees,limits.pitchDegrees);
  else if(e.key==='+'||e.key==='=')patch.zoom=clamp(view.zoom*1.25,.25,4);
  else if(e.key==='-')patch.zoom=clamp(view.zoom/1.25,.25,4);
  else if(e.key==='Home'){e.preventDefault();resetView();return;}else return;
  e.preventDefault();setView(patch);
 });
 document.addEventListener('kneekura:ball-comparison-change',()=>render());
 frame.addEventListener('load',async()=>{
  try{
   await frame.contentDocument.fonts.ready;
   // Let the normal match's initial resize paint settle before observation.
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   renderer=frame.contentWindow.KneekuraMakerMatchRenderer;if(!renderer||renderer.version!==70)throw Error('試合の描画機能を読み込めませんでした。');error=null;render(true);
  }catch(e){error=String(e.message??e);status.textContent=error;status.classList.add('error');blank('試合画面を読み込めませんでした。');}
  finally{loading=false;}
 });
 root.KneekuraBatterComparisonV70=Object.freeze({setView,resetView,inspect:()=>{
  const {info,level}=current();return {version:70,ready:!!renderer&&!error,loading,error,generation,level,clockSeconds:info.clockSeconds,
   playing:info.playing,view:clone(view),rendered:rendered&&clone(rendered),renderer:renderer?.inspect()??null};
 }});
 root.addEventListener('kneekura:presentation-controls-v84',()=>render(true));
 refreshControls();blank('同じ球で4段階を計算すると表示します。');root.KneekuraMakerHelp?.decorate(panel);
 if(typeof root.KneekuraMakerMatchHtmlV70==='string'&&root.KneekuraMakerMatchHtmlV70.length){loading=true;frame.srcdoc=root.KneekuraMakerMatchHtmlV70;document.body.append(frame);}
 else{error='打者画面の試合データがありません。';status.textContent=error;status.classList.add('error');}
})(globalThis);
