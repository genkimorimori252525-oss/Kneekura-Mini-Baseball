/* Canonical authoring UI. Pitch trajectories and trial metrics are produced by
 * the same LivePitch Core used by the ordinary game, never by canvas formulas. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id),core=root.KneekuraBaseballWorkbench,maker=root.baseballMaker,
  catalog=root.KneekuraLiveGameRosterCatalog,library=root.KneekuraReferenceBatMotions;
 if(root.KneekuraIndependentTraitsV77!==true||!maker||!catalog)return;
 const clone=value=>root.structuredClone(value),json=value=>JSON.stringify(value,null,2),finite=Number.isFinite,
  types=['fastball','slider','curve','changeup','cutter','sinker','splitter'],
  names={fastball:'ストレート',slider:'スライダー',curve:'カーブ',changeup:'チェンジアップ',cutter:'カットボール',sinker:'シンカー',splitter:'スプリット'},
  pending=new Map(),forbidden=new Set(['__proto__','prototype','constructor']);
 let mode='human',activeTab='player',pitcherId=catalog.players.find(p=>p.role==='P')?.playerId??catalog.players[0].playerId,
  selectedPitch='fastball',trial=null,trialInput=null,trialContext=null,trialPlayers=null,clock=0,playing=false,
  duration=1,view='mound',renderer=null,frame=null,loading=false,loadPromise=null,lastWall=null,generation=0,committing=false,lastError=null;
 const panel=document.createElement('section');panel.id='pitcher-panel';panel.className='pitcher-lab';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','tab-pitcher');panel.hidden=true;
 const control=(id,label,type,min,max,step,help)=>`<label>${label}<input id="${id}" type="${type}"${min===null?'':` min="${min}" max="${max}" step="${step}"`} data-help="${help}"></label>`;
 panel.innerHTML=`<div class="pitcher-lab-title-row"><h2>投手調整室</h2><button id="pitcher-export-roster" type="button">試合用能力JSONを保存</button></div>
 <p class="note">球種の回転・投げる位置・投球動作を調整し、試合と同じ物理と画面で確かめます。変更は選手作成と共通です。</p>
 <div class="pitcher-lab-toolbar"><label>投げる選手<select id="pitcher-player"></select></label><label>投げる腕<select id="pitcher-hand" data-help="右投げは投手の右側、左投げは左側から放します。回転の方向は捕手から見た世界の向きで保存するため、腕だけ変えても回転方向は反転しません。"><option value="R">右投げ</option><option value="L">左投げ</option></select></label>
 ${control('pitcher-public-speed','最高球速（km/h）','number',54,306,'any','公開の最高球速です。球種の初速はこの上限以下にします。球種別の初速が上限を超える変更は、全体を変更せずエラーにします。')}
 <div>${control('pitcher-public-control','制球','number',null,null,null,'選手作成と同じ基礎制球です。得能の有無では変わりません。100を超える基礎能力もメーカーだけで編集できます。')}<output id="pitcher-public-grade" class="pitcher-public-grade"></output></div></div>
 <div class="swing-toolbar"><button id="pitcher-run" class="primary" type="button">この球を試投</button><button id="pitcher-next" type="button">次の番号で試投</button><label>狙うコース<select id="pitcher-location"><option value="zone">ゾーン内</option><option value="low">低め</option><option value="high">高め</option><option value="inside">内角</option><option value="outside">外角</option></select></label><label>再現番号<input id="pitcher-seed" type="number" min="0" max="4294967295" step="1" value="20261020" data-help="同じ選手・球種・番号なら同じ投球を再現します。通常試合の当該投球と比較するときは、その投球に記録されたseedを使います。"></label></div>
 <p id="pitcher-status" class="note pitcher-lab-status" role="status">球種を選び「この球を試投」を押してください。</p>
 <div class="pitcher-lab-grid"><section class="pitcher-lab-box"><h3>球種と曲がる向き</h3><p class="pitcher-hint">矢印は捕手から見た回転による向き。重力による落下とは別です。</p><div id="pitcher-cards" class="pitcher-cards"></div>
 <details id="pitcher-pitch-details"><summary>選んだ球の速さ・回転を調整</summary><div class="pitcher-lab-fields">
 ${control('pitcher-pitch-speed','初速（km/h）','number',54,306,'any','この球種の初速です。投球ごとの小さなばらつきは通常試合と共通です。最高球速の上限以下で設定してください。')}
 ${control('pitcher-pitch-rpm','回転数（rpm）','number',0,11459,'any','1分あたりの回転数です。回転軸とジャイロ成分も実際の空力へ渡します。多ければ必ず大きく曲がるわけではありません。')}
 ${control('pitcher-pitch-direction','曲がる向き（度）','number',0,360,'any','捕手から見た方向。0度が上、90度が右、180度が下、270度が左です。実際の変化は初速度と回転軸を使うCoreが計算します。')}
 ${control('pitcher-pitch-gyro','ジャイロ成分','number',-1,1,.01,'回転のうち進行方向に近い軸の割合です。0は横向きの回転のみ、±1は全てジャイロ回転。符号でねじれる向きが逆になります。同じ回転数でも大きいほど横・縦へ曲げる成分が少なくなります。')}
 </div><div class="swing-toolbar"><button id="pitcher-pitch-apply" type="button">この球種の設定を保存</button><button id="pitcher-pitch-reset" type="button">この球種を従来設定へ</button></div><p id="pitcher-pitch-note" class="note"></p></details></section>
 <section class="pitcher-lab-box"><div class="pitcher-lab-title-row"><h3>試合の見え方で試投</h3><label>視点<select id="pitcher-camera"><option value="mound">投手目線</option><option value="catcher">捕手目線</option></select></label></div>
 <div class="pitcher-lab-stage"><canvas id="pitcher-canvas" width="1200" height="864" aria-label="通常試合と同じ投球描画"></canvas></div>
 <div class="pitcher-lab-playbar"><button id="pitcher-play" type="button" disabled>▶ 再生</button><input id="pitcher-time" aria-label="投球動作からの再生位置" type="range" min="0" max="3" step=".001" value="0"><output id="pitcher-time-label">0.000秒</output><label>再生速度<select id="pitcher-play-speed"><option value=".25">0.25倍</option><option value=".5" selected>0.5倍</option><option value="1">1倍</option></select></label><button id="pitcher-release" type="button" disabled>リリースへ</button></div>
 <p class="pitcher-hint">投球動作は作者モデルです。実測の全身フォームではありません。</p>
 <details><summary>横・上から同じ軌道を見る</summary><div class="pitcher-lab-plots"><figure><figcaption>横から：高さ</figcaption><canvas id="pitcher-plot-side" width="600" height="300"></canvas></figure><figure><figcaption>上から：左右</figcaption><canvas id="pitcher-plot-top" width="600" height="300"></canvas></figure></div><p class="note">緑が実投球、灰色が同じ初期位置・初速度の無回転球です。線はCoreの観測結果です。</p></details></section>
 <section class="pitcher-lab-box pitcher-lab-results"><h3>本塁での到達点</h3><canvas id="pitcher-zone" class="pitcher-zone" width="360" height="360" aria-label="捕手から見たストライクゾーンと到達点"></canvas>
 <div id="pitcher-metrics" class="pitcher-lab-metrics"></div><p class="note" data-help="変化量は同じ初期位置・初速度の無回転球との差です。狙いへ投げるため初速度が調整されるので、狙いの点からのずれとは別です。総落下量やストライク率でもありません。">変化量は、同じ投げ出し方の無回転球との差です。</p></section></div>
 <details id="pitcher-delivery-details"><summary>投げる位置・投球動作を詳しく調整</summary><div class="swing-toolbar"><label>フォームの設定例<select id="pitcher-form-preset"><option value="over">上手投げ</option><option value="threequarter">斜め上から</option><option value="side">横手投げ</option><option value="submarine">下手投げ</option></select></label><button id="pitcher-form-apply" type="button">設定例を使う</button><button id="pitcher-form-reset" type="button">個別の投球位置・動作を解除</button></div>
 <div class="pitcher-lab-fields">
 ${control('pitcher-release-height','放す高さ（マウンド上からm）','number',.2,3.2,'any','マウンドの地面から球を放す高さです。選手の頭の高さとは別です。')}
 ${control('pitcher-release-side','腕側への幅（m）','number',0,1.5,'any','投手の中心から投げる腕側へどれだけ離れて放すかです。右投げと左投げで世界の左右が入れ替わります。')}
 ${control('pitcher-release-extension','本塁への伸び（m）','number',0,3.5,'any','投手板から本塁へ近づいて放す距離です。球の初期位置へ反映し、放した後の球を動かす補正は行いません。')}
 ${control('pitcher-motion-duration','投げ始めから放すまで（ms）','number',500,4000,1,'作者モデルの投球動作に使う時間です。リリースまでの演出・カメラと共通です。投球後の球速や物理時間は変わりません。')}
 ${control('pitcher-motion-head','身体に伴う頭の動き（倍）','number',0,2,.05,'投球動作に伴う投手カメラの動きです。0で固定、1で従来、2で強め。リリース位置やボールの計算は変わりません。')}
 </div><p class="note">設定例は体格に応じた作者モデルです。名前のある実在投手の実測フォームではありません。選手の身体と利き腕は維持します。</p></details>`;
 // Keep the shared help button inside its field, rather than occupying a grid cell.
 for(const label of panel.querySelectorAll('.pitcher-lab-toolbar label,.pitcher-lab-fields label')){const wrap=document.createElement('div'),input=label.querySelector('input,select');wrap.className='control pitcher-field';label.before(wrap);wrap.append(label);if(input){label.htmlFor=input.id;wrap.append(input);}}
 const tab=document.createElement('button');tab.id='tab-pitcher';tab.type='button';tab.setAttribute('role','tab');tab.setAttribute('aria-controls',panel.id);tab.setAttribute('aria-selected','false');tab.textContent='投手調整';
 document.querySelector('.tabs').append(tab);$('maker-layout').after(panel);
 const modeBar=document.createElement('div');modeBar.className='maker-mode-switch';modeBar.innerHTML='<span>メーカーの操作</span><button id="maker-mode-human" type="button" aria-pressed="true">人間向け</button><button id="maker-mode-ai" type="button" aria-pressed="false" data-help="選手作成・打者・投手で共通の能力JSONを一括編集します。モード切替だけでは選手・物理・乱数・設定を変更しません。">AI用JSON</button>';
 document.querySelector('header').append(modeBar);
 const ai=document.createElement('section');ai.id='maker-ai-panel';ai.className='maker-ai-panel';ai.hidden=true;
 ai.innerHTML=`<h2>AI用：共通の選手データを検証・編集</h2><p class="note">人間向け画面と同じ20選手・同じ検証を使います。JSONの検証だけでは保存値を変更しません。全項目が通った時だけ一括適用します。</p>
 <label>試合用能力JSON<textarea id="maker-ai-roster" spellcheck="false" aria-label="共通の能力JSON"></textarea></label>
 <div class="swing-toolbar"><button id="maker-ai-refresh" type="button">現在のJSONを取得</button><button id="maker-ai-validate" type="button">変更せず検証</button><button id="maker-ai-apply" class="primary" type="button">全体を検証して適用</button><button id="maker-ai-export" type="button">共通JSONを保存</button></div>
 <details><summary>選手・項目を指定して一括変更</summary><p class="note">例：[{"playerId":"0-p0","path":"physical.pitchReleaseHeightMeters","value":1.65}]。physical・throws・heightMeters・traitProfileを指定できます。1件でも不正なら全件を適用しません。valueを省略すると、その任意項目を解除します。</p><textarea id="maker-ai-patches" class="maker-ai-patches" spellcheck="false">[]</textarea><button id="maker-ai-patch-apply" type="button">一括変更を検証して適用</button></details>
 <div class="swing-toolbar"><button id="maker-ai-trial" type="button">現在の投手・球種・番号で試投</button><button id="maker-ai-result-export" type="button" disabled>試投条件・結果JSONを保存</button></div><p id="maker-ai-status" class="note" role="status"></p><pre id="maker-ai-result" aria-label="試投結果・エラー箇所">試投結果はここへ表示されます。</pre>`;
 panel.after(ai);
 function say(message,error=false){$('pitcher-status').textContent=message;$('pitcher-status').classList.toggle('error',error);lastError=error?message:null;}
 function aiSay(message,error=false){$('maker-ai-status').textContent=message;$('maker-ai-status').classList.toggle('error',error);}
 function noPending(){if(pending.size)throw Error('投手調整に未確定の入力があります。'+[...pending.values()].map(x=>x.label+': '+x.error).join(' / '));}
 function assertReady(){noPending();maker.assertCanSave();}
 function snapshot(){return maker.getLiveRoster();}
 function identity(id=pitcherId){return catalog.players.find(p=>p.playerId===id);}
 function entry(roster=snapshot(),id=pitcherId){const e=roster.entries.find(p=>p.playerId===id);if(!e)throw Error('登録のない選手です: '+id);return e;}
 function accepted(raw){try{return maker.validateLiveRoster(raw);}catch(error){
  // Diagnostics only: acceptance always belongs to the same full maker validator.
  try{const packet=inert(raw);if(Array.isArray(packet.entries))for(let i=0;i<packet.entries.length;i++){
   const e=packet.entries[i];try{core.applyLivePhysicalRosterV1({players:catalog.players,roster:{version:packet.version,sourceId:packet.sourceId,entries:[e]}});}catch(local){throw Error('entries['+i+'] ('+(e?.playerId??'選手未指定')+'): '+local.message);}
  }}catch(local){throw local;}throw error;
 }}
 function commit(raw){const next=accepted(raw);committing=true;try{maker.importLiveRoster(next);}finally{committing=false;}invalidate();refresh();return snapshot();}
 function patchPhysical(patch){const next=snapshot(),e=entry(next);e.physical={...e.physical,...clone(patch)};return commit(next);}
 function number(id){const input=$(id);if(input.value.trim()===''||!finite(Number(input.value)))throw Error('有限の数値を入力してください。');return Number(input.value);}
 function currentPlayer(){return core.applyLivePhysicalRosterV1({players:catalog.players,roster:snapshot()}).players.find(p=>p.playerId===pitcherId);}
 function projection(){return core.projectLivePublicAbilitiesV1({roster:snapshot(),reference:root.KneekuraLivePublicAbilityReference,playerId:pitcherId});}
 function rows(){return core.resolvePitcherRepertoireV77(currentPlayer().physical);}
 function currentRow(){return rows().find(row=>row.pitchType===selectedPitch);}
 function arrow(spin){const c=core.pitchSpinToControlsV77(spin),r=c.breakDirectionDegrees*Math.PI/180,length=12*Math.sqrt(Math.max(0,1-c.gyroFraction*c.gyroFraction)),x=19+Math.sin(r)*length,y=19-Math.cos(r)*length;
  return `<svg viewBox="0 0 38 38" aria-hidden="true"><circle cx="19" cy="19" r="17"></circle><line x1="19" y1="19" x2="${x}" y2="${y}"></line><circle cx="${x}" cy="${y}" r="2.3" style="fill:#286644"></circle></svg>`;}
 function put(id,value){if(!pending.has(id))$(id).value=value;}
 function refresh(){
  const p=currentPlayer(),e=entry(),physical=p.physical,abilities=projection().abilities;
  $('pitcher-player').value=pitcherId;put('pitcher-hand',p.throws??'R');
  for(const [id,ability]of [['pitcher-public-speed','maxSpeedKmh'],['pitcher-public-control','control']])put(id,Number(abilities.find(a=>a.id===ability)?.value?.toPrecision(12)));
  $('pitcher-public-grade').textContent=maker.publicRank(abilities.find(a=>a.id==='control')?.value);
  put('pitcher-release-height',physical.pitchReleaseHeightMeters??p.heightMeters*.86);put('pitcher-release-side',physical.pitchReleaseSideMeters??p.heightMeters*.25);put('pitcher-release-extension',physical.pitchReleaseExtensionMeters??1.54);
  put('pitcher-motion-duration',physical.pitchingMotion?.preparationMs??1540);put('pitcher-motion-head',physical.pitchingMotion?.headMotionScale??1);
  const cards=$('pitcher-cards');cards.replaceChildren();for(const row of rows()){
   const b=document.createElement('button');b.type='button';b.className='pitcher-card';b.dataset.pitchType=row.pitchType;b.setAttribute('aria-pressed',String(row.pitchType===selectedPitch));
   b.innerHTML=arrow(row.spinRadPerSecond)+`<span><strong>${names[row.pitchType]}</strong><small>${(row.releaseSpeedMps*3.6).toFixed(1)} km/h · ${row.authored?'個別設定':'従来設定'}</small></span>`;
   b.onclick=()=>{selectedPitch=row.pitchType;clearPitchPending();invalidate();refresh();};cards.append(b);
  }
  const row=currentRow(),spin=core.pitchSpinToControlsV77(row.spinRadPerSecond);
  put('pitcher-pitch-speed',Number((row.releaseSpeedMps*3.6).toPrecision(12)));put('pitcher-pitch-rpm',Number(spin.spinRpm.toPrecision(12)));put('pitcher-pitch-direction',Number(spin.breakDirectionDegrees.toPrecision(12)));put('pitcher-pitch-gyro',Number(spin.gyroFraction.toPrecision(12)));
  $('pitcher-pitch-note').textContent=names[selectedPitch]+'。'+(row.authored?'この球種だけの設定を保存済みです。':'従来の共通設定から参考表示しています。表示しただけでは保存値は変わりません。');
  root.KneekuraMakerHelp?.decorate(panel);
 }
 function clearPitchPending(){for(const id of ['pitcher-pitch-speed','pitcher-pitch-rpm','pitcher-pitch-direction','pitcher-pitch-gyro']){pending.delete(id);$(id).setCustomValidity('');}}
 function markError(id,error){const input=$(id),label=input.labels?.[0]?.textContent.trim()??id;input.setCustomValidity(error.message);pending.set(id,{label,error:error.message});say(label+': '+error.message,true);}
 function handle(id,action){$(id).addEventListener('change',()=>{try{action();pending.delete(id);$(id).setCustomValidity('');refresh();say('設定を共通の選手データへ反映しました。同じ番号で再試投できます。');}catch(e){markError(id,e);}});}
 function invalidate(){generation++;trial=null;trialInput=null;trialContext=null;trialPlayers=null;playing=false;clock=0;lastWall=null;$('pitcher-play').disabled=true;$('pitcher-release').disabled=true;$('maker-ai-result-export').disabled=true;renderer?.reset();blank('この球を試投すると表示します。');drawPlots();drawMetrics();}
 function blank(message){const c=$('pitcher-canvas').getContext('2d');c.fillStyle='#102019';c.fillRect(0,0,1200,864);c.fillStyle='#eaf4ed';c.font='24px sans-serif';c.fillText(message,30,55);}
 function applyPitch(){const row={pitchType:selectedPitch,releaseSpeedMps:number('pitcher-pitch-speed')/3.6,spinRadPerSecond:core.pitchSpinFromControlsV77({spinRpm:number('pitcher-pitch-rpm'),breakDirectionDegrees:number('pitcher-pitch-direction'),gyroFraction:number('pitcher-pitch-gyro')})};
  const next=snapshot(),e=entry(next);e.physical.pitchRepertoire=[...(e.physical.pitchRepertoire??[]).filter(p=>p.pitchType!==selectedPitch),row];commit(next);clearPitchPending();refresh();say(names[selectedPitch]+'の設定を保存しました。');}
 function setTab(which){activeTab=which;const isPitcher=which==='pitcher';$('maker-layout').hidden=isPitcher||mode==='ai';panel.hidden=!isPitcher||mode==='ai';ai.hidden=mode!=='ai';tab.setAttribute('aria-selected',String(isPitcher));
  if(isPitcher){for(const id of ['tab-bat','tab-player'])$(id).setAttribute('aria-selected','false');refresh();}else playing=false;
 }
 function setMode(value){if(!['human','ai'].includes(value))throw Error('モードはhumanまたはaiです。');const changed=mode!==value;mode=value;$('maker-mode-human').setAttribute('aria-pressed',String(mode==='human'));$('maker-mode-ai').setAttribute('aria-pressed',String(mode==='ai'));document.documentElement.dataset.makerMode=mode;setTab(activeTab);if(changed&&mode==='ai')$('maker-ai-roster').value=json(snapshot());return mode;}
 function inert(value,path='input'){
  if(value===null||['string','boolean'].includes(typeof value))return value;
  if(typeof value==='number'){if(!finite(value))throw Error(path+': 有限の数値が必要です。');return value;}
  if(!value||typeof value!=='object'||![Object.prototype,null,Array.prototype].includes(Object.getPrototypeOf(value)))throw Error(path+': JSONの値が必要です。');
  const out=Array.isArray(value)?[]:{},descriptors=Object.getOwnPropertyDescriptors(value);
  for(const key of Reflect.ownKeys(descriptors)){
   if(Array.isArray(value)&&key==='length')continue;
   if(typeof key!=='string'||forbidden.has(key)||!Object.hasOwn(descriptors[key],'value')||!descriptors[key].enumerable)throw Error(path+': 不正なプロパティです。');
   out[key]=inert(descriptors[key].value,path+'.'+key);
  }
  return out;
 }
 function patchRoster(rawOperations){const operations=inert(rawOperations,'patch');
  if(!Array.isArray(operations)||operations.length>500)throw Error('一括変更は500件以下の配列にしてください。');let next=snapshot();
  for(let i=0;i<operations.length;i++){
   const op=operations[i];if(!op||typeof op!=='object'||Array.isArray(op)||Object.keys(op).some(k=>!['playerId','path','value'].includes(k))||typeof op.playerId!=='string'||typeof op.path!=='string')throw Error('patch['+i+']: playerId・path・valueを確認してください。');
   const keys=op.path.split('.');if(!['physical','throws','heightMeters','traitProfile'].includes(keys[0])||keys.some(k=>!k||forbidden.has(k)||!/^[A-Za-z0-9_]+$/.test(k)))throw Error('patch['+i+'].path: 編集できない項目です。');
   let parent=entry(next,op.playerId);for(const key of keys.slice(0,-1)){if(!parent[key]||typeof parent[key]!=='object')parent[key]={};parent=parent[key];}
   if(Object.hasOwn(op,'value'))parent[keys.at(-1)]=clone(op.value);else delete parent[keys.at(-1)];
  }
  return commit(next);
 }
 function serialTrial(){if(!trial)return null;return {version:77,authority:trial.authority,nativeAdmission:false,context:clone(trialContext),input:clone(trialInput),metrics:clone(trial.metrics),fixedInitial:clone(trial.fixedInitial),call:trial.pitch.call,diagnostics:clone(trial.pitch.diagnostics),frames:clone(trial.pitch.frames),view};}
 function exportPacket(){assertReady();return {version:77,authority:'CANONICAL_MAKER_AUTHORING',roster:snapshot(),pitcherLab:{pitcherId,pitchType:selectedPitch,seed:number('pitcher-seed'),location:$('pitcher-location').value,view},result:serialTrial()};}
 function download(value,name){const url=URL.createObjectURL(new Blob([json(value)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function ensureRenderer(){if(renderer)return Promise.resolve(renderer);if(loadPromise)return loadPromise;if(typeof root.KneekuraMakerPitcherMatchHtmlV77!=='string')return Promise.reject(Error('通常試合の描画データを読み込めませんでした。'));
  loading=true;frame=document.createElement('iframe');frame.id='pitcher-renderer-frame-v77';frame.className='pitcher-renderer-frame-v77';frame.title='投手調整の通常試合描画';frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
  loadPromise=new Promise((resolve,reject)=>{frame.onload=async()=>{try{await frame.contentDocument.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));renderer=frame.contentWindow.KneekuraMakerPitcherRendererV77;if(!renderer)throw Error('投手用の通常描画adapterがありません。');loading=false;resolve(renderer);}catch(e){loading=false;reject(e);}};frame.srcdoc=root.KneekuraMakerPitcherMatchHtmlV77;document.body.append(frame);});return loadPromise;
 }
 async function run(){assertReady();const ticket=++generation;playing=false;say('同じCoreで試投しています…');
  try{const p=identity(),b=catalog.players.find(x=>x.teamName!==p.teamName&&x.role!=='P')??catalog.players.find(x=>x.playerId!==pitcherId),c=catalog.players.find(x=>x.teamName===p.teamName&&x.role==='C'),seed=number('pitcher-seed');
   const batterPhysical=core.applyLivePhysicalRosterV1({players:catalog.players,roster:snapshot()}).players.find(x=>x.playerId===b.playerId).physical,
    clips=library.clips.filter(clip=>clip.side===b.bats&&(batterPhysical.clipId?clip.id===batterPhysical.clipId:clip.defaultSelection!==false)).map(clip=>({id:clip.id,side:clip.side,source:{sha256:clip.source.sha256,repository:clip.source.repository},contactTimeSeconds:clip.contactTimeSeconds,
     normalization:clone(clip.normalization),frames:clip.frames.map(f=>({tick:f.tick,grip:clone(f.grip),orientation:clone(f.orientation)})),defaultSelection:clip.defaultSelection}));
   const input=core.buildPitcherWorkbenchInputV77({players:catalog.players,roster:snapshot(),pitcherId,batterId:b.playerId,catcherId:c.playerId,measuredClips:clips,seed,pitchType:selectedPitch,location:$('pitcher-location').value});
   const context={pitcherId,batterId:b.playerId,catcherId:c.playerId},calculated=core.simulatePitcherWorkbenchV77({pitch:input,context:{pitcherId,batterId:b.playerId}});
   const render=await ensureRenderer();if(ticket!==generation)return null;
   trial=calculated;trialInput=input;trialContext=context;trialPlayers=core.applyLivePhysicalRosterV1({players:catalog.players,roster:snapshot()}).players;
   render.prepare({result:trial,input:trialInput,context:trialContext,players:trialPlayers});duration=(currentPlayer().physical.pitchingMotion?.preparationMs??1540)/1000+(trial.pitch.endedAtTick-input.originTick)/trial.pitch.diagnostics.sourceClockTicksPerSecond;
   clock=0;$('pitcher-time').max=duration;$('pitcher-play').disabled=false;$('pitcher-release').disabled=false;$('maker-ai-result-export').disabled=false;playing=true;lastWall=null;drawMetrics();drawPlots();paint();$('maker-ai-result').textContent=json(serialTrial());say('試投しました。緑の到達点と変化量は実際のCore計算結果です。');return trial;
  }catch(e){if(ticket===generation){say(String(e.message??e),true);$('maker-ai-result').textContent=json({error:String(e.message??e),unchangedRoster:true});}throw e;}
 }
 function paint(){if(!trial||!renderer)return;renderer.render({seconds:clock,camera:view,playing});renderer.copyToCanvas($('pitcher-canvas'));$('pitcher-time').value=clock;$('pitcher-time-label').textContent=clock.toFixed(3)+'秒';$('pitcher-play').textContent=playing?'⏸ 停止':'▶ 再生';}
 function seek(seconds){if(!finite(seconds))throw Error('再生時刻を確認してください。');clock=Math.max(0,Math.min(duration,seconds));playing=false;paint();return clock;}
 function drawMetrics(){const zone=$('pitcher-zone'),c=zone.getContext('2d');c.fillStyle='#fbfdfb';c.fillRect(0,0,360,360);const region=trial?.metrics.strikeZone;
  if(!region){c.fillStyle='#52685a';c.font='13px sans-serif';c.fillText('試投後に同じ判定ゾーンを表示',18,28);$('pitcher-metrics').replaceChildren();return;}
  const points=[trial.metrics.platePosition,trial.metrics.baselinePlatePosition],extentX=Math.max(region.halfWidth,...points.map(p=>Math.abs(p.x)))+.15,
   lower=Math.min(region.lowerY,...points.map(p=>p.y))-.15,upper=Math.max(region.upperY,...points.map(p=>p.y))+.15,
   scale=Math.min(300/(2*extentX),280/(upper-lower)),pos=p=>({x:180+p.x*scale,y:195-(p.y-(lower+upper)/2)*scale}),
   a=pos({x:-region.halfWidth,y:region.upperY}),b=pos({x:region.halfWidth,y:region.lowerY});
  c.fillStyle='#edf6f0';c.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);c.strokeStyle='#a6b9ac';c.lineWidth=2;c.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);c.strokeStyle='#d0e0d5';for(let i=1;i<3;i++){c.beginPath();c.moveTo(a.x+(b.x-a.x)*i/3,a.y);c.lineTo(a.x+(b.x-a.x)*i/3,b.y);c.moveTo(a.x,a.y+(b.y-a.y)*i/3);c.lineTo(b.x,a.y+(b.y-a.y)*i/3);c.stroke();}
  if(trial){for(const [point,color,r]of [[trial.metrics.baselinePlatePosition,'#89968e',4],[trial.metrics.platePosition,'#157b48',6]]){const p=pos(point);c.fillStyle=color;c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.fill();}}
  c.fillStyle='#52685a';c.font='12px sans-serif';c.fillText('捕手から見た左右・高さ',18,20);
  const box=$('pitcher-metrics');box.replaceChildren();for(const [label,value]of [['初速',trial.metrics.releaseSpeedKmh.toFixed(1)+' km/h'],['本塁での球速',trial.metrics.speedKmh.toFixed(1)+' km/h'],['回転数',trial.metrics.spinRpm.toFixed(0)+' rpm'],['本塁まで',trial.metrics.flightSeconds.toFixed(3)+'秒'],['横変化',(trial.metrics.horizontalBreakCm>=0?'右 ':'左 ')+Math.abs(trial.metrics.horizontalBreakCm).toFixed(1)+' cm'],['縦変化',(trial.metrics.verticalBreakCm>=0?'上 ':'下 ')+Math.abs(trial.metrics.verticalBreakCm).toFixed(1)+' cm']]){const cell=document.createElement('div'),strong=document.createElement('strong');cell.textContent=label;strong.textContent=value;cell.append(strong);box.append(cell);}
  if(trial.metrics.baselineGroundIgnored){const note=document.createElement('p');note.className='note';note.textContent='無回転の比較球は途中で接地するため、灰色の線は地面を除いた空中の比較です。実投球の物理は変更していません。';box.append(note);}}
 function drawPlots(){for(const [id,axis]of [['side','y'],['top','x']]){const canvas=$('pitcher-plot-'+id),c=canvas.getContext('2d');c.fillStyle='#fbfdfb';c.fillRect(0,0,600,300);if(!trial)continue;
   const samples=[],baselines=[];for(let t=0;t<=trial.metrics.flightSeconds;t+=.008){const q=trial.sampleAtPitchElapsedSeconds(t),base=trial.sampleBaselineAtPitchElapsedSeconds(t);if(q)samples.push(q.position??q.ball?.position);if(base)baselines.push(base.position);}
   const points=samples.filter(Boolean),min=axis==='y'?0:-1.5,max=axis==='y'?Math.max(3,...points.map(p=>p.y)):1.5,point=p=>({x:30+(18.44-p.z)/18.44*540,y:270-(p[axis]-min)/(max-min)*240});
   c.strokeStyle='#dce6df';c.beginPath();c.moveTo(30,270);c.lineTo(570,270);c.stroke();
   for(const [path,color]of [[baselines,'#89968e'],[points,'#18824d']]){c.strokeStyle=color;c.lineWidth=2;c.beginPath();path.forEach((p,i)=>{const q=point(p);if(i)c.lineTo(q.x,q.y);else c.moveTo(q.x,q.y);});c.stroke();}
   const base=trial.metrics.baselinePlatePosition,release=trial.fixedInitial.position??trial.fixedInitial.ball?.position;if(base&&release){c.fillStyle='#89968e';const q=point(base);c.beginPath();c.arc(q.x,q.y,4,0,Math.PI*2);c.fill();}
  }}
 function populate(){for(const p of [...catalog.players].sort((a,b)=>(a.role==='P'?0:1)-(b.role==='P'?0:1))){const o=document.createElement('option');o.value=p.playerId;o.textContent=p.teamName+' · '+p.name+(p.role==='P'?'':'（野手の投球）');$('pitcher-player').append(o);}}
 function publicChange(id,abilityId){handle(id,()=>{const edited=core.editLivePublicAbilityV1({roster:snapshot(),reference:root.KneekuraLivePublicAbilityReference,playerId:pitcherId,abilityId,value:number(id)});commit(edited.roster);});}
 populate();publicChange('pitcher-public-speed','maxSpeedKmh');publicChange('pitcher-public-control','control');
 handle('pitcher-hand',()=>{const next=snapshot();entry(next).throws=$('pitcher-hand').value;commit(next);});
 for(const [id,key]of [['pitcher-release-height','pitchReleaseHeightMeters'],['pitcher-release-side','pitchReleaseSideMeters'],['pitcher-release-extension','pitchReleaseExtensionMeters']])handle(id,()=>patchPhysical({[key]:number(id)}));
 for(const [id,key]of [['pitcher-motion-duration','preparationMs'],['pitcher-motion-head','headMotionScale']])handle(id,()=>patchPhysical({pitchingMotion:{preparationMs:currentPlayer().physical.pitchingMotion?.preparationMs??1540,headMotionScale:currentPlayer().physical.pitchingMotion?.headMotionScale??1,[key]:number(id)}}));
 for(const id of ['pitcher-pitch-speed','pitcher-pitch-rpm','pitcher-pitch-direction','pitcher-pitch-gyro'])$(id).addEventListener('input',()=>{pending.set(id,{label:names[selectedPitch]+'の未保存入力',error:'「この球種の設定を保存」で確定してください。'});say('球種の入力は未保存です。「この球種の設定を保存」で確定してください。');});
 $('pitcher-pitch-apply').onclick=()=>{try{applyPitch();}catch(e){markError('pitcher-pitch-speed',e);}};
 $('pitcher-pitch-reset').onclick=()=>{try{const next=snapshot(),e=entry(next),list=(e.physical.pitchRepertoire??[]).filter(p=>p.pitchType!==selectedPitch);if(list.length)e.physical.pitchRepertoire=list;else delete e.physical.pitchRepertoire;clearPitchPending();commit(next);}catch(e){say(e.message,true);}};
 $('pitcher-player').onchange=()=>{pending.clear();panel.querySelectorAll('input,select').forEach(i=>i.setCustomValidity(''));pitcherId=$('pitcher-player').value;invalidate();refresh();};
 $('pitcher-form-apply').onclick=()=>{try{const h=currentPlayer().heightMeters,preset={over:[.86,.25,1.54,1540],threequarter:[.72,.32,1.6,1450],side:[.52,.4,1.45,1300],submarine:[.25,.45,1.4,1400]}[$('pitcher-form-preset').value];patchPhysical({pitchReleaseHeightMeters:h*preset[0],pitchReleaseSideMeters:h*preset[1],pitchReleaseExtensionMeters:preset[2],pitchingMotion:{preparationMs:preset[3],headMotionScale:1}});say('投球動作の設定例を反映しました。');}catch(e){say(e.message,true);}};
 $('pitcher-form-reset').onclick=()=>{try{const next=snapshot(),e=entry(next);for(const key of ['pitchReleaseHeightMeters','pitchReleaseSideMeters','pitchReleaseExtensionMeters','pitchingMotion'])delete e.physical[key];commit(next);}catch(e){say(e.message,true);}};
 tab.onclick=()=>setTab('pitcher');for(const which of ['bat','player'])$('tab-'+which).addEventListener('click',()=>setTab(which));
 $('maker-mode-human').onclick=()=>setMode('human');$('maker-mode-ai').onclick=()=>setMode('ai');
 $('pitcher-run').onclick=()=>run().catch(()=>{});$('pitcher-next').onclick=()=>{$('pitcher-seed').value=(number('pitcher-seed')+1)>>>0;run().catch(()=>{});};
 $('pitcher-camera').onchange=()=>{view=$('pitcher-camera').value;paint();};$('pitcher-time').oninput=()=>seek(number('pitcher-time'));
 $('pitcher-play').onclick=()=>{if(!trial)return;playing=!playing;if(playing&&clock>=duration)clock=0;lastWall=null;paint();};$('pitcher-release').onclick=()=>seek((currentPlayer().physical.pitchingMotion?.preparationMs??1540)/1000);
 $('pitcher-export-roster').onclick=()=>{try{assertReady();download(snapshot(),'試合用能力.json');}catch(e){say(e.message,true);}};
 $('maker-ai-refresh').onclick=()=>{$('maker-ai-roster').value=json(snapshot());aiSay('現在の共通JSONを取得しました。');};
 $('maker-ai-validate').onclick=()=>{try{accepted(JSON.parse($('maker-ai-roster').value));aiSay('全項目の検証に通りました。保存値は変更していません。');}catch(e){aiSay(e.message,true);$('maker-ai-result').textContent=json({error:e.message,unchangedRoster:true});}};
 $('maker-ai-apply').onclick=()=>{try{const next=JSON.parse($('maker-ai-roster').value);commit(next);pending.clear();refresh();aiSay('全項目を検証し、一括適用しました。');}catch(e){aiSay(e.message,true);$('maker-ai-result').textContent=json({error:e.message,unchangedRoster:true});}};
 $('maker-ai-patch-apply').onclick=()=>{try{patchRoster(JSON.parse($('maker-ai-patches').value));$('maker-ai-roster').value=json(snapshot());aiSay('一括変更を検証して適用しました。');}catch(e){aiSay(e.message,true);$('maker-ai-result').textContent=json({error:e.message,unchangedRoster:true});}};
 $('maker-ai-export').onclick=()=>{try{assertReady();download(snapshot(),'試合用能力.json');}catch(e){aiSay(e.message,true);}};
 $('maker-ai-trial').onclick=()=>run().then(()=>aiSay('共通Coreで試投しました。')).catch(e=>aiSay(e.message,true));$('maker-ai-result-export').onclick=()=>{try{download(exportPacket(),'投手試投_条件と結果.json');}catch(e){aiSay(e.message,true);}};
 document.addEventListener('kneekura:maker-roster-change',()=>{if(committing)return;pending.clear();panel.querySelectorAll('input,select').forEach(i=>i.setCustomValidity(''));invalidate();refresh();});
 function loop(now){if(playing&&trial){if(lastWall!==null)clock+=Math.min(.1,(now-lastWall)/1000)*number('pitcher-play-speed');if(clock>=duration){clock=duration;playing=false;}try{paint();}catch(e){playing=false;say(e.message,true);}}lastWall=now;requestAnimationFrame(loop);}
 root.KneekuraPitcherMakerV77=Object.freeze({version:77,run,seek,assertNoPending:noPending,getResult:()=>trial,getInput:()=>trialInput&&clone(trialInput),
  inspect:()=>({version:77,mode,activeTab,pitcherId,pitchType:selectedPitch,view,ready:!!trial,loading,error:lastError,playing,clockSeconds:clock,duration,pending:[...pending.entries()].map(([id,v])=>({id,...v})),metrics:trial&&clone(trial.metrics),renderer:renderer?.inspect()??null}),
  selectPlayer:id=>{if(!catalog.players.some(p=>p.playerId===id))throw Error('登録のない選手です。');pitcherId=id;pending.clear();invalidate();refresh();return pitcherId;},
  selectPitch:value=>{if(!types.includes(value))throw Error('未対応の球種です。');selectedPitch=value;clearPitchPending();invalidate();refresh();return selectedPitch;},
  setCamera:value=>{if(!['mound','catcher'].includes(value))throw Error('未対応の投手調整視点です。');view=value;$('pitcher-camera').value=value;paint();return view;},
  exportResult:serialTrial,exportPacket,setMode,getMode:()=>mode,validateRoster:accepted,applyRoster:commit,applyPatches:patchRoster,
  show:()=>{setMode('human');setTab('pitcher');},getRoster:snapshot});
 root.KneekuraMakerModesV77=Object.freeze({version:77,setMode,getMode:()=>mode,exportPacket,validateRoster:accepted,applyRoster:commit,applyPatches:patchRoster,runPitch:run});
 refresh();blank('この球を試投すると表示します。');drawMetrics();requestAnimationFrame(loop);root.KneekuraMakerHelp?.decorate(panel);root.KneekuraMakerHelp?.decorate(ai);root.KneekuraMakerHelp?.decorate(modeBar);
})(globalThis);
