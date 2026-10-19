/* Research controls use the same rigid-bat sampler as the ordinary match. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id),clone=value=>JSON.parse(JSON.stringify(value)),
  core=root.KneekuraBaseballWorkbench,maker=root.baseballMaker,library=root.KneekuraReferenceBatMotions,
  colors=['#64748b','#1763a6','#18824d','#b05200','#8937a3'],labels=['元の打ち方','弾道1：低め','弾道2：基準','弾道3：高め','弾道4：さらに高め'],
  defaults={level:2,angleDegreesByLevel:[-10,0,10,20],beforeSeconds:.1,afterSeconds:.06},
  connectedPreview=root.KneekuraPlayerSwingPreviewEnabled===true;
 if(!maker||!library?.clips?.length||!core?.withReferenceImpactTrajectoryV1)return;
 let current=null,motions=[],clockMs=0,playing=false,lastTime=null,cacheKey='',error=null,refreshing=false;
 const viewSettings=Object.fromEntries(['front','side','top'].map(view=>[view,{yawDegrees:0,pitchDegrees:0}]));
 let projectedViews={},rotationDrag=null,previewSignature='',sharedSourceTick=null;
 const angleFields=[1,2,3,4].map(i=>`<label>弾道${i}の振り上げ方（度）<input id="swing-angle-${i}" type="number" min="-30" max="30" step="1" data-help="元の打ち方と比べて、当たる瞬間に何度上向き・下向きに振るかを変えます。芯が通る位置は保ち、当たる前後だけ道筋を変えます。打球の角度を直接指定する値ではありません。"></label>`).join('');
 const panel=document.createElement('section');panel.id='player-swing-editor';panel.className='swing-editor';
 panel.innerHTML=`<h3>この選手の打ち方と弾道</h3>
  <p class="note">元の打ち方を選び、ボールに当たる付近だけ振り上げ方を変えて比べます。打球の結果を指定する設定ではありません。</p>
  <div class="swing-settings-grid">
   ${connectedPreview?'<label>調整する選手<select id="swing-player-select" data-help="選手作成と同じ選手を選びます。この選手の打ち方・弾道を、大きい黒い画面を見ながら調整できます。"></select></label>':''}
   <label>打ち方を探す<input id="swing-search" type="search" placeholder="番号や打ち方の名前" data-help="選べる打ち方を名前や記録番号で絞ります。匿名の実測データなので、同じ人の別のスイングが含まれます。"></label>
   <label>この選手が使う打ち方<select id="swing-clip" data-help="選んだ打ち方をこの選手の試合用設定へ保存します。右打者には右打ち、左打者には左打ちの記録を表示します。『これまでどおり』なら従来の代表例から試合ごとに選びます。"></select></label>
   <label><input id="swing-enabled" type="checkbox" data-help="オンにすると、下の弾道の設定をこの選手へ保存します。オフなら従来の振り方を保ちます。元の実測記録は書き換えません。">当たる付近の振り方を調整する</label>
   <label>試合で使う弾道<select id="swing-grade" data-help="1は低め、2は基準、3・4は上向きに振るための試験設定です。実際の打球は投球、当たった場所、タイミング、能力で変わります。必ずゴロやフライになる指定ではありません。"><option value="1">1：低め</option><option value="2">2：元の振り方が基準</option><option value="3">3：高め</option><option value="4">4：さらに高め</option></select></label>
  </div><p id="swing-source-note" class="note"></p>
  ${connectedPreview?'<h4>弾道ごとの振り上げ方</h4><p class="note">プラスは上向き、マイナスは下向き。0度なら元の打ち方です。数値を変えると大きい黒い画面にもすぐ反映します。</p><div class="swing-settings-grid">'+angleFields+'</div><details><summary>当たる前後の時間など</summary><div class="swing-settings-grid">':'<details><summary>弾道ごとの変え方を細かく調整</summary><p class="note">プラスは上向き、マイナスは下向き。0度なら元の打ち方です。</p><div class="swing-settings-grid">'+angleFields}
   <label>当たる前に変える時間（ミリ秒）<input id="swing-before-ms" type="number" min="20" max="300" step="1" data-help="元の打ち方で、当たる何ミリ秒前から道筋を変え始めるかです。100ミリ秒は0.1秒です。振る速さを変えると試合中の時間も変わります。区間の外は元の道筋を保ちます。"></label>
   <label>当たった後に戻す時間（ミリ秒）<input id="swing-after-ms" type="number" min="20" max="77" step="1" data-help="元の打ち方で、当たった後に何ミリ秒かけて元の道筋へ戻すかです。元の記録がある範囲で設定します。振り抜き全体を一律に回す設定ではありません。"></label>
  </div><button id="swing-reset" type="button" data-help="この選手の打ち方と弾道の指定だけを外します。ミート・パワー・得能など、ほかの能力は変更しません。">この選手の打ち方指定を外す</button></details>
  ${connectedPreview?'<div class="swing-toolbar"><button id="swing-export-roster" type="button" data-help="この画面で変えた打ち方・弾道を含む、全選手の試合用能力JSONを保存します。通常試合で能力JSONを読み込むと反映します。">試合用能力JSONを保存</button></div>':''}
  <h4>同じ瞬間で見比べる</h4><div class="swing-toolbar"><button id="swing-preview-play" type="button">▶ 再生</button><button id="swing-preview-impact" type="button" data-help="元の測定でボールに当たった時刻へ移動します。試合の投球に必ず当たる保証ではありません。">当たる瞬間へ</button><button id="swing-preview-back" type="button">5ms前</button><button id="swing-preview-next" type="button">5ms後</button>
   <label>再生の速さ<select id="swing-preview-speed" data-help="比較画面の再生速度だけを変えます。選手のバット速度や、通常試合の速さには影響しません。"><option value="0.1">0.1倍</option><option value="0.25">0.25倍</option><option value="0.5" selected>0.5倍</option><option value="1">1倍</option>${connectedPreview?'<option value="2">2倍</option>':''}</select></label>
   <label><input id="swing-all-paths" type="checkbox" checked data-help="元の道筋と弾道1〜4を同じ時刻で重ねて表示します。外すと元の道筋と選んだ弾道だけを比べます。">すべての弾道を重ねる</label></div>
  <label>当たる瞬間からの時間 <output id="swing-time-label"></output><input id="swing-preview-time" data-help="元の測定で当たった瞬間を0ミリ秒として、前後の同じ時刻を見比べます。負の値は当たる前、正の値は当たった後です。" type="range" min="-300" max="77" step="1" value="0"></label>
  <p class="note">下の3つのバット図は、右ボタンを押しながらドラッグすると、それぞれ別の角度から見られます。図を選んで矢印キーでも向きを変えられます。打ち方や能力は変わりません。</p><button id="swing-preview-reset-views" type="button" data-help="3つのバット図の向きだけを最初の状態へ戻します。再生時間・選手・弾道の設定は変わりません。">3つの図の向きを戻す</button>
  <div class="swing-preview-grid"><figure><figcaption>投手側から見る</figcaption><canvas id="swing-preview-front" width="720" height="360"></canvas></figure><figure><figcaption>横から見る</figcaption><canvas id="swing-preview-side" width="720" height="360"></canvas></figure><figure><figcaption>上から見る</figcaption><canvas id="swing-preview-top" width="720" height="360"></canvas></figure></div>
  <div id="swing-comparison-values" class="swing-legend"></div><p class="note">比較は元の測定でのバット長・芯の位置・体格・速さを基準にした道筋です。通常試合では選手の用具・体格・速さ・従来の全体角度を反映し、投球へ合わせた位置で振ります。頭や身体のフォームは描きません。</p><p id="swing-editor-status" class="note" aria-live="polite"></p>`;
 let research=null;
 if(connectedPreview){
  $('maker-layout').classList.add('player-swing-connected');
  const batPanel=$('bat-panel');research=document.createElement('details');research.id='swing-legacy-research';
  const summary=document.createElement('summary');summary.textContent='元の記録と接触の研究（詳しい設定）';research.append(summary);
  const note=document.createElement('p');note.className='note';note.textContent='この中は選手へ保存する弾道とは別の研究用設定です。通常は上の選手と弾道を調整してください。';research.append(note);
  for(const child of [...batPanel.children])if(child.tagName!=='H2')research.append(child);
  batPanel.append(panel,research);
  for(const option of $('live-roster-player').options)$('swing-player-select').append(option.cloneNode(true));
  $('swing-player-select').addEventListener('change',()=>{const select=$('live-roster-player');if(select.value===$('swing-player-select').value)return;activatePlayerPreview();
   select.value=$('swing-player-select').value;select.dispatchEvent(new Event('change',{bubbles:true}));});
  $('swing-export-roster').onclick=()=>$('export-live-roster').click();
  research.addEventListener('toggle',()=>{const enabled=!research.open;if(enabled&&!getPreviewSource().ready)return;
   if(maker.getPlayerSwingPreview?.().active!==enabled)maker.showPlayerSwingPreview?.(enabled);});
 }else $('live-roster-identity').after(panel);
 function selected(){
  const id=$('live-roster-player').value,identity=root.KneekuraLiveGameRosterCatalog.players.find(p=>p.playerId===id),
   entry=maker.getLiveRoster().entries.find(p=>p.playerId===id),settings=entry.physical.impactTrajectory??defaults,
   clip=library.clips.find(c=>c.id===entry.physical.clipId)??library.clips.find(c=>c.side===identity.bats&&c.defaultSelection!==false);
  if(!clip)throw Error('この選手に合う打ち方を読み込めませんでした。');
  return {id,identity,entry,settings:clone(settings),clip};
 }
 function makeInput(clip){return {provenance:{clipId:clip.id,sourceSha256:clip.source.sha256},
  frames:clip.frames.map(f=>({tick:f.tick,grip:{...f.grip},orientation:{...f.orientation}})),
  batLengthM:clip.normalization.batLengthM,sweetSpotT:clip.normalization.sweetSpotT,
  sourceTicksPerSecond:1e6,startTick:0,ticksPerSecond:1e6,playbackRate:1,
  transform:{rotation:{w:1,x:0,y:0,z:0},translation:{x:0,y:0,z:0},scale:1}};}
 function buildMotions(){
  const input=makeInput(current.clip),contactTick=Math.round(current.clip.contactTimeSeconds*1e6),
   sourceTicks=current.clip.frames.map(f=>f.tick),min=current.clip.frames[0].tick,max=sourceTicks.at(-1);
  motions=[core.createReferenceBatKinematicsV1(input),...[1,2,3,4].map(level=>
   core.createReferenceBatKinematicsV1(core.withReferenceImpactTrajectoryV1(input,contactTick,{...current.settings,level})))];
  const pivot=motions[0].sampleAtSourceTick(contactTick).sweetSpot;
  current.contactTick=contactTick;current.pivot=pivot;
  current.traces=motions.map(m=>sourceTicks.map(t=>m.sampleAtSourceTick(t).sweetSpot));
  current.boundsPoints=motions.flatMap(m=>sourceTicks.filter((_,i)=>i%3===0).flatMap(t=>{
   const s=m.sampleAtSourceTick(t);return [s.state.pose.grip,s.state.pose.tip,s.sweetSpot];}));
  $('swing-preview-time').min=connectedPreview?(min-contactTick)/1000:Math.ceil((min-contactTick)/1000);$('swing-preview-time').max=connectedPreview?(max-contactTick)/1000:Math.floor((max-contactTick)/1000);
  clockMs=Math.max(Number($('swing-preview-time').min),Math.min(Number($('swing-preview-time').max),clockMs));sharedSourceTick=null;
  $('swing-comparison-values').replaceChildren(...motions.map((m,i)=>{
   const v=m.sampleAtSourceTick(contactTick).sweetSpotVelocity,angle=Math.atan2(v.y,Math.hypot(v.x,v.z))*180/Math.PI,
    item=document.createElement('span');item.style.color=colors[i];item.dataset.level=String(i);
   item.textContent=labels[i]+'：芯の進む角度 '+angle.toFixed(1)+'°';
   item.dataset.help='当たる瞬間に、芯が上へ・下へ何度の向きで進むかを共通の計算で測っています。打球の飛び出す角度とは別です。';return item;
  }));
 }
 function render(){
  if(!current||!motions.length)return;
  $('swing-time-label').textContent=(clockMs>=0?'+':'')+clockMs.toFixed(0)+' ms';$('swing-preview-time').value=String(clockMs);
  const samples=motions.map(m=>m.sampleAtSourceTick(currentSourceTick())),
   active=current.entry.physical.impactTrajectory?.level??2,all=$('swing-all-paths').checked;
  for(const [view,a,b]of [['front','x','y'],['side','z','y'],['top','x','z']]){
   const canvas=$('swing-preview-'+view),c=canvas.getContext('2d'),angles=viewSettings[view],depth=['x','y','z'].find(axis=>axis!==a&&axis!==b),depthSign=view==='front'?1:-1,
    yaw=angles.yawDegrees*Math.PI/180,pitch=angles.pitchDegrees*Math.PI/180,worldPivot=current.pivot,
    rotated=angles.yawDegrees===0&&angles.pitchDegrees===0?p=>p:p=>{
     const u=p[a]-worldPivot[a],v=p[b]-worldPivot[b],w=(p[depth]-worldPivot[depth])*depthSign,
      horizontal=u*Math.cos(yaw)+w*Math.sin(yaw),back=-u*Math.sin(yaw)+w*Math.cos(yaw);
     return {[a]:worldPivot[a]+horizontal,[b]:worldPivot[b]+v*Math.cos(pitch)-back*Math.sin(pitch)};
    },points=current.boundsPoints.map(rotated),
    loA=Math.min(...points.map(p=>p[a])),hiA=Math.max(...points.map(p=>p[a])),loB=Math.min(...points.map(p=>p[b])),hiB=Math.max(...points.map(p=>p[b])),
    scale=Math.min(650/Math.max(.3,hiA-loA),285/Math.max(.3,hiB-loB)),cx=(loA+hiA)/2,cy=(loB+hiB)/2,
    point=p=>{const q=rotated(p);return {x:360+(q[a]-cx)*scale,y:185-(q[b]-cy)*scale};};
   projectedViews[view]={...angles,projection:{a,b,depth,depthSign,scale,cx,cy},pivot:point(worldPivot),
    samples:samples.map((s,level)=>({level,grip:point(s.state.pose.grip),tip:point(s.state.pose.tip),sweetSpot:point(s.sweetSpot)}))};
   c.clearRect(0,0,720,360);c.fillStyle='#fbfdfb';c.fillRect(0,0,720,360);
   c.strokeStyle='#dae6df';c.lineWidth=1;for(let x=30;x<720;x+=40){c.beginPath();c.moveTo(x,15);c.lineTo(x,345);c.stroke();}for(let y=25;y<360;y+=40){c.beginPath();c.moveTo(15,y);c.lineTo(705,y);c.stroke();}
   for(let i=0;i<motions.length;i++){
    if(!all&&i!==0&&i!==active)continue;
    c.strokeStyle=colors[i];c.globalAlpha=i===active?1:.6;c.lineWidth=i===active?3:1.5;c.beginPath();
    current.traces[i].forEach((p,j)=>{const q=point(p);if(j)c.lineTo(q.x,q.y);else c.moveTo(q.x,q.y);});c.stroke();
    const s=samples[i],grip=point(s.state.pose.grip),tip=point(s.state.pose.tip),sweet=point(s.sweetSpot);
    c.lineWidth=i===active?6:2;c.beginPath();c.moveTo(grip.x,grip.y);c.lineTo(tip.x,tip.y);c.stroke();
    c.fillStyle=colors[i];c.beginPath();c.arc(sweet.x,sweet.y,i===active?5:3,0,2*Math.PI);c.fill();
   }
   const pivot=point(current.pivot);c.globalAlpha=1;c.strokeStyle='#192c22';c.lineWidth=1.5;c.beginPath();c.arc(pivot.x,pivot.y,8,0,2*Math.PI);c.stroke();
  }
 }
 function setView(view,patch){
  if(!Object.hasOwn(viewSettings,view)||!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('バット図の向きを確認してください。');
  const next={...viewSettings[view]};
  for(const [key,descriptor]of Object.entries(Object.getOwnPropertyDescriptors(patch))){
   if(!['yawDegrees','pitchDegrees'].includes(key)||!Object.hasOwn(descriptor,'value')||!Number.isFinite(descriptor.value)
    ||Math.abs(descriptor.value)>(key==='yawDegrees'?180:85))throw Error('バット図の角度が範囲外です。');next[key]=descriptor.value;
  }
  viewSettings[view]=next;render();return clone(next);
 }
 function stopRotation(){const previous=rotationDrag;rotationDrag=null;
  if(previous){const canvas=$('swing-preview-'+previous.view);canvas.style.cursor='default';if(canvas.hasPointerCapture(previous.id))canvas.releasePointerCapture(previous.id);}}
 function resetViews(){stopRotation();for(const view of Object.keys(viewSettings))viewSettings[view]={yawDegrees:0,pitchDegrees:0};render();return clone(viewSettings);}
 $('swing-preview-reset-views').onclick=resetViews;
 for(const view of Object.keys(viewSettings)){
  const canvas=$('swing-preview-'+view);canvas.tabIndex=0;canvas.setAttribute('aria-label','バット軌道。右ドラッグまたは矢印キーで見る向きを変えられます。');
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  canvas.addEventListener('pointerdown',event=>{if(event.button!==2||rotationDrag)return;event.preventDefault();canvas.focus({preventScroll:true});
   rotationDrag={id:event.pointerId,view,x:event.clientX,y:event.clientY,angles:{...viewSettings[view]}};canvas.setPointerCapture(event.pointerId);canvas.style.cursor='move';});
  canvas.addEventListener('pointermove',event=>{if(!rotationDrag||rotationDrag.id!==event.pointerId||rotationDrag.view!==view)return;
   const bounds=canvas.getBoundingClientRect(),drag=rotationDrag;
   setView(view,{yawDegrees:Math.max(-180,Math.min(180,drag.angles.yawDegrees+(event.clientX-drag.x)/bounds.width*180)),
    pitchDegrees:Math.max(-85,Math.min(85,drag.angles.pitchDegrees-(event.clientY-drag.y)/bounds.height*90))});});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,event=>{if(rotationDrag?.id===event.pointerId)stopRotation();});
  canvas.addEventListener('keydown',event=>{const step=event.shiftKey?10:2,angles=viewSettings[view];let patch;
   if(event.key==='ArrowLeft'||event.key==='ArrowRight')patch={yawDegrees:Math.max(-180,Math.min(180,angles.yawDegrees+(event.key==='ArrowLeft'?-step:step)))};
   else if(event.key==='ArrowUp'||event.key==='ArrowDown')patch={pitchDegrees:Math.max(-85,Math.min(85,angles.pitchDegrees+(event.key==='ArrowUp'?step:-step)))};
   else return;event.preventDefault();setView(view,patch);});
 }
 function refresh(){
  if(refreshing)return;refreshing=true;
  try{
   const previous=current;current=selected();if(connectedPreview)$('swing-player-select').value=current.id;
   const search=$('swing-search').value.trim().toLowerCase(),sel=$('swing-clip');sel.replaceChildren();
   const auto=document.createElement('option');auto.value='';auto.textContent='これまでどおり（代表例から自動で選ぶ）';sel.append(auto);
   const clips=library.clips.filter(c=>c.side===current.identity.bats);
   for(const [i,clip]of clips.entries()){
    if(search&&!clip.label.toLowerCase().includes(search)&&!clip.id.toLowerCase().includes(search)&&clip.id!==current.entry.physical.clipId)continue;
    const o=document.createElement('option');o.value=clip.id;o.textContent=(clip.side==='L'?'左打ち':'右打ち')+' '+(i+1)+'：'+clip.label;sel.append(o);
   }
   sel.value=current.entry.physical.clipId??'';$('swing-enabled').checked=!!current.entry.physical.impactTrajectory;
   $('swing-grade').value=String(current.settings.level);
   for(let i=0;i<4;i++)$('swing-angle-'+(i+1)).value=String(current.settings.angleDegreesByLevel[i]);
   $('swing-before-ms').value=String(Math.round(current.settings.beforeSeconds*1000));$('swing-after-ms').value=String(Math.round(current.settings.afterSeconds*1000));
   $('swing-source-note').textContent=library.clips.length+'本の記録（元の索引は'+library.index.length+'試行）から、'+current.identity.name+'に合う'+clips.length+'本を選べます。'+(!current.entry.physical.clipId?'比較には代表例を表示しています。':'選んだ打ち方は試合用JSONへ保存されます。');
   const key=current.clip.id+JSON.stringify(current.settings);
   if(key!==cacheKey){buildMotions();cacheKey=key;}
   else for(const field of ['contactTick','pivot','traces','boundsPoints'])current[field]=previous[field];
   error=null;$('swing-editor-status').classList.remove('error');$('swing-editor-status').textContent=current.entry.physical.impactTrajectory?'この選手の弾道設定を保存しています。通常試合では試合用JSONを読み込んで反映します。':'この選手は従来の弾道設定です。色の線で変更例を比較できます。';render();
  }catch(e){error=String(e.message??e);$('swing-editor-status').textContent=error;$('swing-editor-status').classList.add('error');}
  finally{refreshing=false;root.KneekuraMakerHelp?.decorate(panel);}
  if(connectedPreview&&!error){const next=JSON.stringify({playerId:current.id,clipId:current.clip.id,enabled:!!current.entry.physical.impactTrajectory,settings:current.settings});
   if(next!==previewSignature){previewSignature=next;document.dispatchEvent(new CustomEvent('kneekura:swing-preview-source-change'));}}
 }
 function activatePlayerPreview(){if(connectedPreview){research.open=false;if(!maker.getPlayerSwingPreview?.().active)maker.showPlayerSwingPreview?.(true);}}
 function commit(patch){
  try{activatePlayerPreview();maker.setPlayerSwing({playerId:$('live-roster-player').value,...patch});refresh();}
  catch(e){refresh();error=String(e.message??e);$('swing-editor-status').textContent='変更できませんでした。保存済みの値に戻しました。'+error;$('swing-editor-status').classList.add('error');}
 }
 function settingsFromControls(){const number=id=>connectedPreview&&$(id).value.trim()===''?NaN:Number($(id).value);
  return {level:Number($('swing-grade').value),angleDegreesByLevel:[1,2,3,4].map(i=>number('swing-angle-'+i)),beforeSeconds:number('swing-before-ms')/1000,afterSeconds:number('swing-after-ms')/1000};}
 $('swing-search').addEventListener('input',refresh);$('swing-clip').addEventListener('change',()=>commit({clipId:$('swing-clip').value||null}));
 $('swing-enabled').addEventListener('change',()=>commit({impactTrajectory:$('swing-enabled').checked?settingsFromControls():null}));
 const settingIds=['swing-angle-1','swing-angle-2','swing-angle-3','swing-angle-4','swing-before-ms','swing-after-ms'];
 function commitSettings(){const settings=settingsFromControls();if(connectedPreview&&JSON.stringify(settings)===JSON.stringify(current?.entry.physical.impactTrajectory))return;commit({impactTrajectory:settings});}
 for(const id of ['swing-grade',...settingIds])$(id).addEventListener('change',commitSettings);
 if(connectedPreview)for(const id of settingIds)$(id).addEventListener('input',()=>{
  const valid=settingIds.every(key=>{const input=$(key),value=Number(input.value);return input.value.trim()!==''&&Number.isFinite(value)&&!input.validity.badInput&&value>=Number(input.min)&&value<=Number(input.max);});
  if(valid)commitSettings();else{$('swing-editor-status').textContent='入力途中の値は保存していません。有効な数値になると反映します。';}
 });
 $('swing-reset').addEventListener('click',()=>commit({clipId:null,impactTrajectory:null}));
 function seek(ms){const next=Math.max(Number($('swing-preview-time').min),Math.min(Number($('swing-preview-time').max),ms));
  if(connectedPreview&&maker.seekMeasuredPreview){activatePlayerPreview();maker.seekMeasuredPreview(current.contactTick+next*1000);return;}
  playing=false;clockMs=next;$('swing-preview-play').textContent='▶ 再生';render();}
 $('swing-preview-time').addEventListener('input',()=>seek(Number($('swing-preview-time').value)));$('swing-preview-impact').addEventListener('click',()=>seek(0));
 $('swing-preview-back').addEventListener('click',()=>seek(clockMs-5));$('swing-preview-next').addEventListener('click',()=>seek(clockMs+5));$('swing-all-paths').addEventListener('change',render);
 $('swing-preview-play').addEventListener('click',()=>{if(connectedPreview&&maker.setMeasuredPreviewPlayback){activatePlayerPreview();maker.setMeasuredPreviewPlayback({playing:!playing});return;}
  playing=!playing;lastTime=null;if(playing&&clockMs>=Number($('swing-preview-time').max))clockMs=Number($('swing-preview-time').min);$('swing-preview-play').textContent=playing?'⏸ 停止':'▶ 再生';});
 if(connectedPreview)$('swing-preview-speed').addEventListener('change',()=>{activatePlayerPreview();maker.setMeasuredPreviewPlayback?.({speed:Number($('swing-preview-speed').value)});});
 document.addEventListener('kneekura:maker-roster-change',refresh);
 function loop(now){if(connectedPreview&&maker.seekMeasuredPreview)return;
  if(playing&&current){if(lastTime!==null)clockMs+=Math.min(100,now-lastTime)*Number($('swing-preview-speed').value);if(clockMs>=Number($('swing-preview-time').max)){clockMs=Number($('swing-preview-time').max);playing=false;$('swing-preview-play').textContent='▶ 再生';}render();}lastTime=now;requestAnimationFrame(loop);}
 function chosenMotion(adjusted=true){return motions[adjusted&&current?.entry.physical.impactTrajectory?current.settings.level:0];}
 function sampleAtSourceTick(tick,{adjusted=true}={}){if(!Number.isFinite(tick))throw Error('バットの表示時刻を確認してください。');return clone(chosenMotion(adjusted).sampleAtSourceTick(tick));}
 function getPreviewFrames({adjusted=true}={}){if(!current)return [];
  return current.clip.frames.map(frame=>{const sample=chosenMotion(adjusted).sampleAtSourceTick(frame.tick);return {tick:frame.tick,grip:clone(sample.state.pose.grip),tip:clone(sample.state.pose.tip),
   sweetSpot:clone(sample.sweetSpot),orientation:clone(sample.orientation),sweetSpotVelocity:clone(sample.sweetSpotVelocity)};});}
 function getPreviewSource(){return current?{ready:motions.length===5&&cacheKey===current.clip.id+JSON.stringify(current.settings),clip:clone(current.clip),playerId:current.id,identity:clone(current.identity),
  contactTick:current.contactTick,startTick:current.clip.frames[0].tick,endTick:current.clip.frames.at(-1).tick,enabled:!!current.entry.physical.impactTrajectory,
  level:current.settings.level,settings:clone(current.settings)}:{ready:false};}
 function syncClock(sourceTick,isPlaying,speed){if(!current||!Number.isFinite(sourceTick)||typeof isPlaying!=='boolean'||!Number.isFinite(speed)||speed<=0)throw Error('バット図の再生時刻を確認してください。');
  sharedSourceTick=Math.max(current.clip.frames[0].tick,Math.min(current.clip.frames.at(-1).tick,sourceTick));clockMs=(sharedSourceTick-current.contactTick)/1000;playing=isPlaying;
  $('swing-preview-speed').value=String(speed);$('swing-preview-play').textContent=playing?'⏸ 停止':'▶ 再生';render();}
 function currentSourceTick(){return connectedPreview&&sharedSourceTick!==null?sharedSourceTick:current.contactTick+clockMs*1000;}
 root.KneekuraSwingMaker=Object.freeze({refresh,seek,setTrajectory:settings=>commit({impactTrajectory:settings}),setClip:clipId=>commit({clipId}),setView,resetViews,
  getPreviewFrames,sampleAtSourceTick,getPreviewSource,getPreviewBounds:()=>current?{points:clone(current.boundsPoints),pivot:clone(current.pivot)}:null,syncClock,
  inspect:()=>({ready:!!current&&motions.length===5,error,playerId:current?.id,clipId:current?.clip.id,explicitClipId:current?.entry.physical.clipId??null,
   settings:current?.settings,enabled:!!current?.entry.physical.impactTrajectory,clockMs,playing,clips:library.clips.length,
   sourceTick:current?currentSourceTick():null,views:clone(projectedViews),samples:current?motions.map((m,level)=>({level,...clone(m.sampleAtSourceTick(currentSourceTick()))})):[]})});
 refresh();requestAnimationFrame(loop);
})(globalThis);
