import {defaultScoreboard} from './scoreboard.mjs';
import {ANCHORS,FIXED,SCHEMA,referenceDesign,symmetricDesign,russianDomeDesign,validateDesign,wallAt,outline,editableCopy,inspection} from './model.mjs';
import {russianArchitecture} from './architecture.mjs';
import {detailZone,DEFAULT_SURFACE_DETAIL} from './surface-layers.mjs';
import {createCrowdPlayback,DEFAULT_CROWD_APPEARANCE} from './crowd.mjs';
const $=id=>document.getElementById(id),clone=v=>structuredClone(v),token=v=>JSON.stringify(v),storageKey='kneekura_ballpark_studio_v3';
let draft=russianDomeDesign(),savedToken='',validation=validateDesign(draft),geometry=validation.geometry,renderer=null,ready=false,failure=null,
 selected='CF',undoStack=[],redoStack=[],revision=0,renderedRevision=-1,raf=0,jsonDirty=false,
 view={camera:'stadium',zoom:1,orbit:null,people:true,roofCutaway:true},renderCount=0,fixedProof=null;
const logs=[],crowd=createCrowdPlayback({paused:matchMedia('(prefers-reduced-motion: reduce)').matches});
crowd.configure({hidden:document.hidden});
let crowdCache=[],crowdTimer=0,crowdBlits=0,crowdSceneRenders=0,crowdShownFrame=0,manualCrowdEvent=0;
function log(action){logs.push({action,revision,valid:validation.ok});if(logs.length>80)logs.shift();}
function message(text){$('message').textContent=text;}
try{const saved=localStorage.getItem(storageKey);if(saved){const p=JSON.parse(saved),v=validateDesign(p);if(v.ok){draft=p;validation=v;geometry=v.geometry;savedToken=token(p);}else message('保存データにエラーがあります。現行球場を表示しています。保存済みデータは上書きしていません。');}}
catch{message('ブラウザの保存データを読めません。JSON保存も利用できます。');}
const attendance=g=>g.architecture?.crowd?.attendance??'full';
crowd.configure({visible:attendance(geometry)==='full'});
function pushUndo(){undoStack.push(clone(draft));if(undoStack.length>80)undoStack.shift();redoStack=[];}
function commit(next,{record=true,action='edit'}={}){if(token(next)===token(draft))return inspect();if(record)pushUndo();draft=clone(next);revision++;
  validation=validateDesign(draft);if(validation.ok){const oldMode=attendance(geometry);geometry=validation.geometry;if(attendance(geometry)!==oldMode)crowd.configure({visible:attendance(geometry)==='full'});}log(action);sync();schedule();return inspect();}
function inspect(){return {version:3,ready,error:failure,revision,renderedRevision,renderCount,design:clone(draft),view:clone(view),
  validation:{ok:validation.ok,errors:clone(validation.errors),warnings:clone(validation.warnings),fairMinimumDistanceMeters:validation.fairMinimumDistanceMeters},
  geometry:clone(geometry),fixed:FIXED,renderedFixed:fixedProof,
  rendererGeometry:clone(renderer?.inspect()?.rendered.fieldGeometry??null),cameraProjection:clone(renderer?.inspect()?.rendered.cameraProjection??null),architectureRender:clone(renderer?.inspect()?.architecture??null),logoRender:clone(renderer?.inspect()?.logo??null),surfaceDetailRender:clone(renderer?.inspect()?.surface??null),
  crowd:{...crowd.inspect(),shownFrame:crowdShownFrame,cachedFrames:crowdCache.length,blits:crowdBlits,sceneRenders:crowdSceneRenders,cacheBytes:crowdCache.reduce((n,c)=>n+c.width*c.height*4,0)},
  selectedPoint:selected,canUndo:undoStack.length>0,canRedo:redoStack.length>0,
  browserSaved:token(draft)===savedToken,simulationIntegration:'DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED',logs:clone(logs),build:BALLPARK_BUILD_INFO};}
function apply(raw){const v=validateDesign(raw);if(!v.ok)return {ok:false,errors:v.errors};commit(v.design,{action:'apply_json'});return {ok:true};}
function exportJSON(){if(!validation.ok)throw Error('入力エラーを直してから保存してください');return JSON.stringify(draft,null,2)+'\n';}
function download(){try{const url=URL.createObjectURL(new Blob([exportJSON()],{type:'application/json'})),a=document.createElement('a');a.href=url;
  a.download=(draft.name||'球場設計')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('設計JSONを書き出しました。');}catch(e){message(e.message);}}
function save(){if(!validation.ok)return false;try{localStorage.setItem(storageKey,exportJSON());savedToken=token(draft);sync();message('このブラウザに保存しました。');return true;}
  catch{message('ブラウザに保存できませんでした。JSON保存で書き出してください。');return false;}}
function undo(){if(!undoStack.length)return inspect();redoStack.push(clone(draft));const next=undoStack.pop();return commit(next,{record:false,action:'undo'});}
function redo(){if(!redoStack.length)return inspect();undoStack.push(clone(draft));const next=redoStack.pop();return commit(next,{record:false,action:'redo'});}
function reset(){selected='CF';return commit(referenceDesign(),{action:'reset'});}
function pointUpdate(id,values,{record=true}={}){if(!values||Object.keys(values).some(k=>!['angleDegrees','distanceMeters','heightMeters'].includes(k)))throw Error('点の角度・距離・壁高だけを編集できます');
  const d=editableCopy(draft),p=d.fencePoints.find(p=>p.id===id);if(!p)throw Error('編集する点が見つかりません');Object.assign(p,values);return commit(d,{record,action:'point'});}
globalThis.BallparkStudio=Object.freeze({inspect,setDesign:apply,updatePoint:pointUpdate,exportJSON,downloadJSON:download,save,undo,redo,reset,
  setCrowdPlayback,reactCrowd,
  measure:angleDegrees=>{if(!Number.isFinite(angleDegrees))throw Error('有限の角度が必要です');return wallAt(geometry,angleDegrees*Math.PI/180);}});

function errorText(paths){return validation.errors.filter(e=>paths.some(p=>e.path===p||e.path.startsWith(p+'.'))).map(e=>e.message).join('\n');}
function setError(id,paths,inputs=[]){const text=errorText(paths);$(id).textContent=text;for(const input of inputs)$(input).setAttribute('aria-invalid',text?'true':'false');}
function numberValue(id,value){if(document.activeElement!==$(id))$(id).value=typeof value==='number'?String(Number(value.toFixed(2))):'';}
function sync(){
  if(document.activeElement!==$('park-name'))$('park-name').value=draft.name;
  setError('name-error',['name'],['park-name']);$('shape-error').textContent=validation.errors.filter(e=>e.path==='fencePoints').map(e=>e.message).join('\n');
  $('architecture-settings').hidden=!draft.architecture;
  syncCrowdControls();
  if(draft.architecture){const a=draft.architecture;numberValue('capacity',a.capacity);numberValue('roof-opening',a.roof.openingPercent);
    $('roof-value').textContent=String(a.roof.openingPercent)+'%';for(const k of ['red','blue','gold'])$('color-'+k).value=a.colors[k];
    setError('architecture-error',['architecture.capacity','architecture.colors','architecture.roof','architecture.tiers'],['capacity','roof-opening']);
    const detail=a.details??{factor:6,logos:true,ornaments:true};$('building-logos').checked=detail.logos;$('building-ornaments').checked=detail.ornaments;$('building-factor').value=String(detail.factor);
    setError('building-error',['architecture.details'],['building-factor']);
    const l=a.logo??{...russianArchitecture().logo,enabled:false};$('logo-enabled').checked=l.enabled;$('logo-fine').checked=l.detail==='fine';numberValue('logo-width',l.widthMeters);numberValue('logo-center',l.centerZ);
    numberValue('logo-brightness',l.brightness??1);numberValue('logo-glow',l.glow??0);
    $('logo-brightness-value').textContent=(l.brightness??1).toFixed(1)+'倍';$('logo-glow-value').textContent=Math.round((l.glow??0)*100)+'%';
    setError('logo-error',['architecture.logo'],['logo-width','logo-center','logo-brightness','logo-glow']);}
  if(draft.architecture){const d=draft.architecture.surfaceDetail??DEFAULT_SURFACE_DETAIL;$('detail-factor').value=String(d.factor);numberValue('detail-margin',d.marginMeters);numberValue('detail-feather',d.featherMeters);
    setError('detail-error',['architecture.surfaceDetail'],['detail-factor','detail-margin','detail-feather']);}
  if(draft.architecture){const c=draft.architecture.crowd??DEFAULT_CROWD_APPEARANCE;
   numberValue('crowd-density',c.density*100);$('crowd-density-value').textContent=Math.round(c.density*100)+'%';$('crowd-detail').value=c.detail;
   numberValue('crowd-size',c.size*100);$('crowd-size-value').textContent=Math.round(c.size*100)+'%';numberValue('crowd-brightness',c.brightness*100);$('crowd-brightness-value').textContent=Math.round(c.brightness*100)+'%';
   numberValue('crowd-glow',(c.glow??.7)*100);$('crowd-glow-value').textContent=Math.round((c.glow??.7)*100)+'%';
   setError('crowd-error',['architecture.crowd'],['crowd-density','crowd-size','crowd-brightness','crowd-glow']);}
  if(draft.architecture){const board=draft.architecture.scoreboard??defaultScoreboard();$('scoreboard-enabled').checked=board.enabled;
   for(let row=0;row<2;row++){const t=board.teams[row];if(document.activeElement!==$('score-name-'+row))$('score-name-'+row).value=t.name;
    for(let i=0;i<9;i++)numberValue('score-'+row+'-'+i,t.innings[i]);numberValue('score-hits-'+row,t.hits);numberValue('score-errors-'+row,t.errors);}
   for(const k of ['balls','strikes','outs','speedKmh'])numberValue('score-'+k,board[k]);setError('scoreboard-error',['architecture.scoreboard']);}
  for(const a of ANCHORS){const i=draft.fencePoints.findIndex(p=>p.id===a.id),p=draft.fencePoints[i];
    numberValue('distance-'+a.id,p.distanceMeters);numberValue('height-'+a.id,p.heightMeters);
    setError('error-'+a.id,['fencePoints.'+i],['distance-'+a.id,'height-'+a.id]);}
  numberValue('backstop',draft.foul.backstopMeters);numberValue('first-side',draft.foul.firstSideMeters);numberValue('third-side',draft.foul.thirdSideMeters);
  numberValue('foul-height',draft.foul.heightMeters);numberValue('track-width',draft.trackWidthMeters);$('ruleset').value=draft.ruleset;
  setError('backstop-error',['foul.backstopMeters'],['backstop']);setError('sides-error',['foul.firstSideMeters','foul.thirdSideMeters'],['first-side','third-side']);
  setError('foul-height-error',['foul.heightMeters'],['foul-height']);setError('track-error',['trackWidthMeters'],['track-width']);
  const sorted=[...draft.fencePoints].sort((a,b)=>a.angleDegrees-b.angleDegrees),select=$('point-select');
  if(!draft.fencePoints.some(p=>p.id===selected))selected='CF';
  select.replaceChildren(...sorted.map(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=ANCHORS.find(a=>a.id===p.id)?.label??p.id;return o;}));select.value=selected;
  const p=draft.fencePoints.find(p=>p.id===selected),i=draft.fencePoints.indexOf(p),locked=ANCHORS.some(a=>a.id===selected);
  $('point-angle').readOnly=locked;numberValue('point-angle',p.angleDegrees);numberValue('point-distance',p.distanceMeters);numberValue('point-height',p.heightMeters);
  setError('point-error',['fencePoints.'+i],['point-angle','point-distance','point-height']);$('remove-point').disabled=locked||!validation.ok;$('add-point').disabled=!validation.ok||draft.fencePoints.length>=65;
  $('undo').disabled=!undoStack.length;$('redo').disabled=!redoStack.length;$('download').disabled=!validation.ok;$('browser-save').disabled=!validation.ok;
  $('saved-state').textContent=token(draft)===savedToken?'ブラウザ保存済み':'ブラウザ未保存';
  $('shape-status').textContent=draft.mode==='reference_circle'?'現行の円形基準':'外周 '+draft.fencePoints.length+'点';
  $('warnings').replaceChildren(...validation.warnings.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));
  $('validation-status').classList.toggle('invalid',!validation.ok);
  $('validation-status').textContent=validation.ok?'設計値を表示中 · 塁と白線の方向は共通固定':`入力を確認してください（${validation.errors.length}件）。直前の有効な形を表示中。 `+validation.errors[0].message;
  if(!jsonDirty&&document.activeElement!==$('design-json'))$('design-json').value=JSON.stringify(draft,null,2);
  if(!$('ai-panel').hidden)$('audit-json').textContent=JSON.stringify(inspection(draft),null,2);
  const w=wallAt(geometry,(p.angleDegrees??0)*Math.PI/180);$('point-info').textContent=(ANCHORS.find(a=>a.id===selected)?.label??selected)+'：本塁から'+w.distanceMeters.toFixed(2)+'m ／ 壁'+w.heightMeters.toFixed(2)+'m';
  drawPlan();
}
function crowdTick(){clearTimeout(crowdTimer);crowdTimer=0;const s=crowd.inspect();
 if(!geometry.architecture||!crowdCache.length){$('crowd-status').textContent='ドームで応援を確認できます';return;}
 crowdShownFrame=s.frame%crowdCache.length;const frame=crowdCache[crowdShownFrame],target=$('preview');target.getContext('2d').drawImage(frame,0,0);crowdBlits++;
 $('crowd-status').textContent=!s.visible?'無観客 · 元の座席色':s.reaction?({hit:'安打',home_run:'本塁打',out:'アウト',error:'失策'}[s.reaction]+'の反応'):s.paused?'停止中':'通常の応援';
 if(s.active)crowdTimer=setTimeout(crowdTick,s.nextInMs+1);
}
function syncCrowdControls(){const s=crowd.inspect();$('crowd-attendance').value=s.visible?'full':'empty';$('crowd-attendance').disabled=!geometry.architecture;
 $('crowd-play').checked=!s.paused;$('crowd-frames').value=s.pattern==='223'?'223':String(s.frames);
 for(const id of ['crowd-play','crowd-frames','crowd-hit','crowd-home_run','crowd-out','crowd-error'])$(id).disabled=!geometry.architecture||!s.visible;
}
function setCrowdPlayback(options){const before=crowd.inspect(),s=crowd.configure(attendance(geometry)==='empty'?{...options,visible:false}:options);syncCrowdControls();
 if(before.visible!==s.visible||before.frames!==s.frames)schedule();else crowdTick();return inspect();}
function reactCrowd(event){const result=crowd.react(event);crowdTick();return result;}
function schedule(){if(!renderer||raf)return;clearTimeout(crowdTimer);crowdTimer=0;raf=requestAnimationFrame(()=>{raf=0;try{
 const s=crowd.inspect(),count=geometry.architecture&&s.visible?s.frames:1,next=[];let r;
 for(let frame=0;frame<count;frame++){r=renderer.draw(geometry,{...view,crowdFrame:frame,crowdFrames:s.frames,crowdVisible:s.visible});crowdSceneRenders++;
  const canvas=document.createElement('canvas');renderer.copyTo(canvas);next.push(canvas);}
 crowdCache=next;renderer.copyTo($('preview'));fixedProof=clone(r.fixed);crowdTick();
    failure=null;renderCount++;renderedRevision=revision;$('render-status').textContent='既存描画 · '+(geometry.architecture?(view.roofCutaway?'ドーム · 屋根の手前を省略':'ドーム · 屋根全体'):(geometry.kind==='reference_circle'?'現行基準':'設計形状'));drawPlan();}
    catch(e){failure=e.message;$('render-status').textContent='描画エラー';message(e.message);}});}
function numeric(id,change){const el=$(id);el.addEventListener('focus',()=>el.dataset.group='');el.addEventListener('input',()=>{
  const record=!el.dataset.group;el.dataset.group='yes';const value=el.value===''?null:Number(el.value);change(value,record);});}
for(const a of ANCHORS){const row=document.createElement('div');row.className='anchor-row';
 row.innerHTML=`<div class="anchor-heading"><strong>${a.label}</strong><button type="button" data-select="${a.id}">図で選択</button></div><div class="numeric-pair"><label>距離（m）<input id="distance-${a.id}" type="number" step="0.1" aria-describedby="error-${a.id}"></label><label>壁高（m）<input id="height-${a.id}" type="number" step="0.1" aria-describedby="error-${a.id}"></label></div><p id="error-${a.id}" class="error" aria-live="polite"></p>`;
 $('anchor-inputs').append(row);row.querySelector('button').onclick=()=>{selected=a.id;sync();};
 numeric('distance-'+a.id,(n,record)=>pointUpdate(a.id,{distanceMeters:n},{record}));numeric('height-'+a.id,(n,record)=>pointUpdate(a.id,{heightMeters:n},{record}));}
function changeValue(path,value,record){const d=editableCopy(draft),keys=path.split('.');let o=d;for(const k of keys.slice(0,-1))o=o[k];o[keys.at(-1)]=value;commit(d,{record});}
for(const [id,path]of [['backstop','foul.backstopMeters'],['first-side','foul.firstSideMeters'],['third-side','foul.thirdSideMeters'],['foul-height','foul.heightMeters'],['track-width','trackWidthMeters']])numeric(id,(n,record)=>changeValue(path,n,record));
for(const [id,key]of [['point-angle','angleDegrees'],['point-distance','distanceMeters'],['point-height','heightMeters']])numeric(id,(n,record)=>pointUpdate(selected,{[key]:n},{record}));
$('park-name').onfocus=()=>$('park-name').dataset.group='';$('park-name').oninput=()=>{const record=!$('park-name').dataset.group;$('park-name').dataset.group='yes';commit({...draft,name:$('park-name').value},{record});};
$('ruleset').onchange=()=>commit({...draft,ruleset:$('ruleset').value});
$('point-select').onchange=()=>{selected=$('point-select').value;sync();};
$('symmetric').onclick=()=>commit(symmetricDesign(),{action:'example'});$('reset').onclick=reset;$('undo').onclick=undo;$('redo').onclick=redo;
$('dome-preset').onclick=()=>commit(russianDomeDesign(),{action:'dome_preset'});
function architectureValue(path,value,record=true){const d=clone(draft);if(!d.architecture)return;d.schema=SCHEMA;const keys=path.split('.');let o=d.architecture;
 if(keys[0]==='scoreboard'&&!d.architecture.scoreboard)d.architecture.scoreboard=defaultScoreboard();
 if(keys[0]==='details'&&!d.architecture.details)d.architecture.details={factor:6,logos:true,ornaments:true};
 if(keys[0]==='logo'&&!d.architecture.logo)d.architecture.logo=russianArchitecture().logo;
 if(keys[0]==='surfaceDetail'&&!d.architecture.surfaceDetail)d.architecture.surfaceDetail={...DEFAULT_SURFACE_DETAIL};
 if(keys[0]==='crowd'&&!d.architecture.crowd)d.architecture.crowd={...DEFAULT_CROWD_APPEARANCE};
 for(const k of keys.slice(0,-1))o=o[k];o[keys.at(-1)]=value;commit(d,{record,action:'architecture'});}
const scoreFields=$('scoreboard-teams');
for(let row=0;row<2;row++){
 const wrap=document.createElement('div');wrap.className='score-team-editor';wrap.innerHTML=`<label>チーム<input id="score-name-${row}" maxlength="12"></label><div class="score-innings">${Array.from({length:9},(_,i)=>`<label>${i+1}<input id="score-${row}-${i}" type="number" min="0" max="99" step="1" aria-label="チーム${row+1} ${i+1}回"></label>`).join('')}</div><div class="numeric-pair"><label>安打 H<input id="score-hits-${row}" type="number" min="0" max="999"></label><label>失策 E<input id="score-errors-${row}" type="number" min="0" max="99"></label></div>`;scoreFields.append(wrap);
 const el=$('score-name-'+row);el.onchange=()=>architectureValue('scoreboard.teams.'+row+'.name',el.value);
 for(let i=0;i<9;i++)numeric('score-'+row+'-'+i,(n,record)=>architectureValue('scoreboard.teams.'+row+'.innings.'+i,n,record));
 for(const k of ['hits','errors'])numeric('score-'+k+'-'+row,(n,record)=>architectureValue('scoreboard.teams.'+row+'.'+k,n,record));
}
$('scoreboard-enabled').onchange=()=>architectureValue('scoreboard.enabled',$('scoreboard-enabled').checked);
for(const k of ['balls','strikes','outs','speedKmh'])numeric('score-'+k,(n,record)=>architectureValue('scoreboard.'+k,n,record));
numeric('capacity',(n,record)=>architectureValue('capacity',n,record));numeric('roof-opening',(n,record)=>architectureValue('roof.openingPercent',n,record));
for(const k of ['red','blue','gold'])$('color-'+k).onchange=()=>architectureValue('colors.'+k,$('color-'+k).value);
$('building-factor').onchange=()=>architectureValue('details.factor',Number($('building-factor').value));
for(const k of ['logos','ornaments'])$('building-'+k).onchange=()=>architectureValue('details.'+k,$('building-'+k).checked);
$('logo-enabled').onchange=()=>architectureValue('logo.enabled',$('logo-enabled').checked);$('logo-fine').onchange=()=>architectureValue('logo.detail',$('logo-fine').checked?'fine':'dots');
numeric('logo-width',(n,record)=>architectureValue('logo.widthMeters',n,record));numeric('logo-center',(n,record)=>architectureValue('logo.centerZ',n,record));
numeric('logo-brightness',(n,record)=>architectureValue('logo.brightness',n,record));numeric('logo-glow',(n,record)=>architectureValue('logo.glow',n,record));
for(const [id,key]of [['crowd-density','density'],['crowd-size','size'],['crowd-brightness','brightness'],['crowd-glow','glow']])numeric(id,(n,record)=>architectureValue('crowd.'+key,n===null?null:n/100,record));
$('crowd-detail').onchange=()=>architectureValue('crowd.detail',$('crowd-detail').value);
$('detail-factor').onchange=()=>architectureValue('surfaceDetail.factor',Number($('detail-factor').value));
numeric('detail-margin',(n,record)=>architectureValue('surfaceDetail.marginMeters',n,record));numeric('detail-feather',(n,record)=>architectureValue('surfaceDetail.featherMeters',n,record));
$('detail-debug').onchange=drawPlan;
$('crowd-attendance').onchange=()=>{const mode=$('crowd-attendance').value;architectureValue('crowd.attendance',mode);setCrowdPlayback({visible:mode==='full'});};$('crowd-play').onchange=()=>setCrowdPlayback({paused:!$('crowd-play').checked});
$('crowd-play').checked=!crowd.inspect().paused;$('crowd-frames').onchange=()=>setCrowdPlayback($('crowd-frames').value==='223'?{frames:3,pattern:'223'}:{frames:Number($('crowd-frames').value),pattern:'uniform'});
for(const type of ['hit','home_run','out','error'])$('crowd-'+type).onclick=()=>reactCrowd({type,id:'preview-'+(++manualCrowdEvent)});
document.addEventListener('visibilitychange',()=>setCrowdPlayback({hidden:document.hidden}));
addEventListener('pagehide',()=>{clearTimeout(crowdTimer);crowd.configure({hidden:true});});
addEventListener('pageshow',()=>setCrowdPlayback({hidden:document.hidden}));
$('add-point').onclick=()=>{const d=editableCopy(draft),points=[...d.fencePoints].sort((a,b)=>a.angleDegrees-b.angleDegrees),index=points.findIndex(p=>p.id===selected),
  a=points[Math.min(index,points.length-2)],b=points[Math.min(index+1,points.length-1)],angle=(a.angleDegrees+b.angleDegrees)/2;
  if(b.angleDegrees-a.angleDegrees<.004){message('点が近すぎます。別の区間を選んでください。');return;}
  let n=1;while(points.some(p=>p.id==='POINT_'+n))n++;const w=wallAt(geometry,angle*Math.PI/180),id='POINT_'+n;
  d.fencePoints.push({id,angleDegrees:angle,distanceMeters:w.distanceMeters,heightMeters:w.heightMeters});selected=id;commit(d,{action:'add_point'});};
$('remove-point').onclick=()=>{if(ANCHORS.some(a=>a.id===selected))return;const d=editableCopy(draft);d.fencePoints=d.fencePoints.filter(p=>p.id!==selected);selected='CF';commit(d,{action:'remove_point'});};
$('download').onclick=download;$('browser-save').onclick=save;
$('load-file').onchange=async()=>{const file=$('load-file').files[0];if(!file)return;try{if(file.size>1024*1024)throw Error('設計JSONは1MB以内にしてください');
  const raw=JSON.parse((await file.text()).replace(/^\uFEFF/,'')),r=apply(raw);if(!r.ok)throw Error(r.errors.map(e=>e.path+'：'+e.message).join('\n'));
  jsonDirty=false;sync();message('設計JSONを読み込みました。');}catch(e){message('読み込めません：'+e.message);}finally{$('load-file').value='';}};
function mode(ai){$('human-panel').hidden=ai;$('ai-panel').hidden=!ai;$('human-mode').setAttribute('aria-pressed',String(!ai));$('ai-mode').setAttribute('aria-pressed',String(ai));sync();}
$('human-mode').onclick=()=>mode(false);$('ai-mode').onclick=()=>mode(true);$('design-json').oninput=()=>{jsonDirty=true;$('json-error').textContent='未適用のJSONです。';};
$('apply-json').onclick=()=>{try{const r=apply(JSON.parse($('design-json').value));if(!r.ok)throw Error(r.errors.map(e=>e.path+'：'+e.message).join('\n'));jsonDirty=false;$('json-error').textContent='';sync();}
  catch(e){$('json-error').textContent=e.message;}};
$('cancel-json').onclick=()=>{jsonDirty=false;$('design-json').value=JSON.stringify(draft,null,2);$('json-error').textContent='';};
$('camera').onchange=()=>{view.camera=$('camera').value;view.orbit=null;if(view.camera==='exterior'){view.roofCutaway=false;$('roof-cutaway').checked=false;}schedule();};
$('zoom').oninput=()=>{view.zoom=Number($('zoom').value);$('zoom-value').textContent=view.zoom.toFixed(2)+'×';schedule();};
$('people').onchange=()=>{view.people=$('people').checked;schedule();};
$('roof-cutaway').onchange=()=>{view.roofCutaway=$('roof-cutaway').checked;schedule();};
$('reset-view').onclick=()=>{view={camera:geometry.architecture?'stadium':'overhead',zoom:1,orbit:null,people:$('people').checked,roofCutaway:$('roof-cutaway').checked};$('camera').value=view.camera;$('zoom').value='1';$('zoom-value').textContent='1.0×';schedule();};
let orbitDrag=null;$('preview').oncontextmenu=e=>e.preventDefault();$('preview').onpointerdown=e=>{if(e.button!==2)return;e.preventDefault();orbitDrag={x:e.clientX,y:e.clientY,orbit:view.orbit??{yaw:0,elevation:1.05}};$('preview').setPointerCapture(e.pointerId);};
$('preview').onpointermove=e=>{if(!orbitDrag)return;view.orbit={yaw:orbitDrag.orbit.yaw-(e.clientX-orbitDrag.x)*.006,elevation:Math.max(.12,Math.min(1.55,orbitDrag.orbit.elevation+(e.clientY-orbitDrag.y)*.004))};schedule();};
$('preview').onpointerup=$('preview').onpointercancel=()=>{orbitDrag=null;};$('preview').addEventListener('wheel',e=>{e.preventDefault();view.zoom=Math.max(.4,Math.min(2.5,view.zoom*(e.deltaY>0?.95:1.05)));$('zoom').value=view.zoom;$('zoom-value').textContent=view.zoom.toFixed(2)+'×';schedule();},{passive:false});

function drawPlan(){
 const svg=$('plan'),ring=outline(geometry),extent=Math.max(130,...ring.map(p=>Math.abs(p.x))),zMax=Math.max(140,...ring.map(p=>p.z)),zMin=Math.min(-45,...ring.map(p=>p.z));
 svg.setAttribute('viewBox',`${-extent-12} ${-zMax-15} ${extent*2+24} ${zMax-zMin+30}`);
 const poly=(points,attrs)=>`<polygon points="${points.map(p=>p.x+','+-p.z).join(' ')}" ${attrs}/>`,
  base=FIXED.baseDistanceMeters/Math.SQRT2,drawn=geometry.fencePoints,
  construction=[{x:0,z:0},{x:base,z:base},{x:0,z:2*base},{x:-base,z:base}],
  left=wallAt(geometry,-Math.PI/4).position,right=wallAt(geometry,Math.PI/4).position;
 let html=poly(ring,'fill="#e4edde" stroke="#416b4a" stroke-width="1.2"')+
  `<path d="M${left.x},${-left.z} L0,0 L${right.x},${-right.z}" fill="none" stroke="#b08a28" stroke-width=".7"/>`+
  poly(construction,'fill="none" stroke="#97ad92" stroke-dasharray="1.5 1.5" stroke-width=".45"');
 if(fixedProof){for(const key of ['homePlate','rubber'])if(fixedProof[key])html+=poly(fixedProof[key],'fill="#fff" stroke="#6a8065" stroke-width=".3"');
   for(const bag of fixedProof.bases??[])html+=poly(bag,'fill="#fff" stroke="#6a8065" stroke-width=".3"');
   for(const box of fixedProof.batterBoxes??[])html+=poly(box.points,'fill="none" stroke="#83977a" stroke-width=".3"');}
 html+='<text x="0" y="7" text-anchor="middle" font-size="4" fill="#4b6b4a">本塁</text>';
 const zone=detailZone(geometry);if(zone&&$('detail-debug').checked){const z=zone.center.z,x=zone.halfX,h=zone.halfZ,f=zone.featherMeters;
  html+=`<rect x="${-x}" y="${-z-h}" width="${2*x}" height="${2*h}" fill="none" stroke="#d6ae4d" stroke-width=".8"/>`+
   `<rect x="${-x-f}" y="${-z-h-f}" width="${2*(x+f)}" height="${2*(h+f)}" rx="${f}" fill="none" stroke="#a68a48" stroke-dasharray="2 2" stroke-width=".7"/>`;}
 for(const p of drawn){const chosen=p.id===selected,label=ANCHORS.find(a=>a.id===p.id)?.label??p.id;
  html+=`<circle data-point="${p.id}" cx="${p.x}" cy="${-p.z}" r="${chosen?2.7:2}" fill="${chosen?'#bb8720':'#286d4b'}" stroke="white" stroke-width=".6"/>`;
  if(ANCHORS.some(a=>a.id===p.id)||chosen)html+=`<text x="${p.x}" y="${-p.z-4.5}" text-anchor="middle" font-size="4.2" fill="#254d38">${label} ${p.distanceMeters.toFixed(1)}m</text>`;
 }
 svg.innerHTML=html;
}
let pointDrag=null;
$('plan').onpointerdown=e=>{const id=e.target.getAttribute('data-point');if(!id||e.button!==0||!validation.ok)return;selected=id;pointDrag={id,record:true};$('plan').setPointerCapture(e.pointerId);sync();e.preventDefault();};
$('plan').onpointermove=e=>{if(!pointDrag)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform($('plan').getScreenCTM().inverse()),x=p.x,z=-p.y,
  original=draft.fencePoints.find(p=>p.id===pointDrag.id),anchor=ANCHORS.find(a=>a.id===pointDrag.id),points=[...draft.fencePoints].sort((a,b)=>a.angleDegrees-b.angleDegrees),i=points.findIndex(p=>p.id===original.id);
 let angle=anchor?.angleDegrees??Math.max(points[i-1].angleDegrees+.002,Math.min(points[i+1].angleDegrees-.002,Math.atan2(x,z)*180/Math.PI)),
  distance=anchor?x*Math.sin(angle*Math.PI/180)+z*Math.cos(angle*Math.PI/180):Math.hypot(x,z);
 distance=Math.max(76.2,Math.min(220,distance));pointUpdate(pointDrag.id,{angleDegrees:angle,distanceMeters:distance},{record:pointDrag.record});pointDrag.record=false;};
$('plan').onpointerup=$('plan').onpointercancel=()=>{pointDrag=null;};

sync();const engine=$('engine');engine.onload=async()=>{try{const w=engine.contentWindow;await w.document.fonts.ready;
  const start=performance.now();while(!w.liveMatchPlayback?.inspect().host){if(performance.now()-start>30000)throw Error('描画エンジンの起動に時間がかかっています');await new Promise(r=>setTimeout(r,50));}
  await w.KneekuraBallparkGroundLogoV2.prepare(BALLPARK_LOGO_DATA_URL);renderer=w.KneekuraBallparkRendererV1.install();ready=true;log('ready');schedule();}
 catch(e){failure=e.message;$('render-status').textContent='読み込みエラー';message(e.message);}};
engine.srcdoc=BALLPARK_ENGINE_HTML;
