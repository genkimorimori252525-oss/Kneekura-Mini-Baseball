import {defaultPaypayScoreboard} from './paypay-scoreboard.mjs';
import {defaultNiikuraScoreboard} from './niikura-scoreboard.mjs';
import {CAMERA_VIEWS,cameraParkKey,cameraPresetErrors,cameraFromProjection,cameraOverride,parseCameraLibrary,encodeCameraLibrary} from './camera-presets.mjs';
import {defaultScoreboard} from './scoreboard.mjs';
import {DEFENDER_ROLES,defaultFieldDiagram,scoreboardCapabilities,scoreboardFieldDiagram,projectFieldDiagramPoint,SCOREBOARD_BASES} from './scoreboard-field.mjs';
import {ANCHORS,FIXED,SCHEMA,referenceDesign,symmetricDesign,russianDomeDesign,dodgerStadiumDesign,koshienDesign,niikuraDomeDesign,fukuokaDomeDesign,validateDesign,wallAt,outline,editableCopy,inspection} from './model.mjs';
import {russianArchitecture} from './architecture.mjs';
import {DEFAULT_DODGER_ATMOSPHERE} from './dodger-landscape.mjs';
import {detailZone,DEFAULT_SURFACE_DETAIL} from './surface-layers.mjs';
import {createCrowdPlayback,DEFAULT_CROWD_APPEARANCE} from './crowd.mjs';
import {koshienFanPalettes} from './koshien-fans.mjs';
import {KOSHIEN_BACKSTOP_METERS} from './koshien-home.mjs';
import {HOME_TEAMS,homeThemeTrack} from './homerun-theme.mjs';
import {defaultEffects,createFireworksPlayback,sampleFireworks} from './stadium-effects.mjs';
import {defaultEnvironment,defaultWind,flagFrameDuration} from './stadium-atmosphere.mjs';
const $=id=>document.getElementById(id),clone=v=>structuredClone(v),token=v=>JSON.stringify(v),windVersion=BALLPARK_BUILD_INFO.version>=8,themeVersion=BALLPARK_BUILD_INFO.version>=26,atmosphereVersion=BALLPARK_BUILD_INFO.version>=7,effectsVersion=BALLPARK_BUILD_INFO.version>=6,niikuraDefault=typeof BALLPARK_DEFAULT_PRESET!=='undefined'&&BALLPARK_DEFAULT_PRESET==='niikura',dodgerDefault=typeof BALLPARK_DEFAULT_PRESET!=='undefined'&&BALLPARK_DEFAULT_PRESET==='dodger',koshienDefault=typeof BALLPARK_DEFAULT_PRESET!=='undefined'&&BALLPARK_DEFAULT_PRESET==='koshien',fukuokaDefault=typeof BALLPARK_DEFAULT_PRESET!=='undefined'&&BALLPARK_DEFAULT_PRESET==='fukuoka',storageKey=BALLPARK_BUILD_INFO.version>=26?'kneekura_ballpark_studio_v26':BALLPARK_BUILD_INFO.version>=25?'kneekura_ballpark_studio_v25':BALLPARK_BUILD_INFO.version>=24?'kneekura_ballpark_studio_v24':BALLPARK_BUILD_INFO.version>=23?'kneekura_ballpark_studio_v23':BALLPARK_BUILD_INFO.version>=22?'kneekura_ballpark_studio_v22':BALLPARK_BUILD_INFO.version>=21?'kneekura_ballpark_studio_v21':BALLPARK_BUILD_INFO.version>=19?'kneekura_ballpark_studio_v19':BALLPARK_BUILD_INFO.version>=18?'kneekura_ballpark_studio_v18':BALLPARK_BUILD_INFO.version>=17?'kneekura_ballpark_studio_v17':BALLPARK_BUILD_INFO.version>=16?'kneekura_ballpark_studio_v16':BALLPARK_BUILD_INFO.version>=15?'kneekura_ballpark_studio_v15':BALLPARK_BUILD_INFO.version>=14?'kneekura_ballpark_studio_v14':BALLPARK_BUILD_INFO.version>=13?'kneekura_ballpark_studio_v13':BALLPARK_BUILD_INFO.version>=12?'kneekura_ballpark_studio_v12':BALLPARK_BUILD_INFO.version>=11?'kneekura_ballpark_studio_v11':BALLPARK_BUILD_INFO.version>=10?'kneekura_ballpark_studio_v10':BALLPARK_BUILD_INFO.version>=9?'kneekura_ballpark_studio_v9':windVersion?'kneekura_ballpark_studio_v8':atmosphereVersion?'kneekura_ballpark_studio_v7':effectsVersion?'kneekura_ballpark_studio_v6':koshienDefault?'kneekura_ballpark_studio_v5':dodgerDefault?'kneekura_ballpark_studio_v4':'kneekura_ballpark_studio_v3';
function environmentPreset(d){if(atmosphereVersion&&d.architecture){d.architecture.effects=defaultEffects(d.architecture);d.architecture.effects.environment=defaultEnvironment();if(windVersion)d.architecture.effects.environment.wind=defaultWind();}return d;}
let draft=environmentPreset(fukuokaDefault?fukuokaDomeDesign():niikuraDefault?niikuraDomeDesign():koshienDefault?koshienDesign():dodgerDefault?dodgerStadiumDesign():russianDomeDesign()),savedToken='',validation=validateDesign(draft),geometry=validation.geometry,renderer=null,ready=false,failure=null,
 selected='CF',undoStack=[],redoStack=[],revision=0,renderedRevision=-1,raf=0,jsonDirty=false,
 view={camera:fukuokaDefault||niikuraDefault||BALLPARK_BUILD_INFO.version>=19&&dodgerDefault?'interior':effectsVersion?'effects':dodgerDefault||koshienDefault?'interior':'stadium',zoom:1,orbit:null,people:true,roofCutaway:!effectsVersion},renderCount=0,fixedProof=null;
const logs=[],crowd=createCrowdPlayback({paused:matchMedia('(prefers-reduced-motion: reduce)').matches});
crowd.configure({hidden:document.hidden});
const fireworks=createFireworksPlayback();fireworks.configure({hidden:document.hidden});
let fireworkTimer=0,fireworkEvent=0,effectFrames=0,fireworkReport={input:0,visible:0,occluded:0,clipped:0};
let flagCache=[],flagTimer=0,flagElapsed=0,flagLast=performance.now(),flagFrame=0,flagReport=null;
let crowdCache=[],crowdTimer=0,crowdFill=0,firstFrames=0,themeContext=null,themeVoice=null,themeTrack=null,crowdBlits=0,crowdSceneRenders=0,crowdShownFrame=0,manualCrowdEvent=0;
function log(action){logs.push({action,revision,valid:validation.ok});if(logs.length>80)logs.shift();}
function message(text){$('message').textContent=text;}
const cameraLibraryKey='kneekura_ballpark_camera_views_v1',cameraPending=new Map();let cameraLibrary=new Map(),cameraInputError='';
try{const raw=localStorage.getItem(cameraLibraryKey);if(raw)cameraLibrary=parseCameraLibrary(raw);}catch{message('カメラ登録を読めません。元の登録データは上書きせず、標準視点を表示します。');}
function withRegisteredCameras(d){const cameras=cameraLibrary.get(cameraParkKey(d));return d.cameraViews===undefined&&cameras?{...d,cameraViews:clone(cameras)}:d;}
try{const saved=localStorage.getItem(storageKey);if(saved){const p=JSON.parse(saved),v=validateDesign(p);if(v.ok){draft=p;validation=v;geometry=v.geometry;savedToken=token(p);}else message('保存データにエラーがあります。現行球場を表示しています。保存済みデータは上書きしていません。');}}
catch{message('ブラウザの保存データを読めません。JSON保存も利用できます。');}
draft=withRegisteredCameras(draft);validation=validateDesign(draft);geometry=validation.geometry;activateCamera(view.camera);
const attendance=g=>g.architecture?.crowd?.attendance??'full';
crowd.configure({visible:attendance(geometry)==='full'});
function pushUndo(){undoStack.push(clone(draft));if(undoStack.length>80)undoStack.shift();redoStack=[];}
function commit(next,{record=true,action='edit'}={}){if(token(next)===token(draft))return inspect();const previousKey=cameraParkKey(draft),previousCameras=token(draft.cameraViews??{});fireworks.stop();clearTimeout(fireworkTimer);fireworkTimer=0;if(record)pushUndo();draft=clone(next);revision++;
  validation=validateDesign(draft);if(validation.ok){const oldMode=attendance(geometry);geometry=validation.geometry;if(attendance(geometry)!==oldMode)crowd.configure({visible:attendance(geometry)==='full'});const keyChanged=previousKey!==cameraParkKey(draft);if(!keyChanged&&previousCameras!==token(draft.cameraViews??{})){cameraPending.delete(cameraEditKey());activateCamera(view.camera);rememberCameras();}else if(keyChanged&&action!=='edit'||action==='apply_json')activateCamera(view.camera);}log(action);sync();schedule();return inspect();}
function inspect(){return {version:3,ready,error:failure,revision,renderedRevision,renderCount,design:clone(draft),view:clone(view),
  validation:{ok:validation.ok,errors:clone(validation.errors),warnings:clone(validation.warnings),fairMinimumDistanceMeters:validation.fairMinimumDistanceMeters},
  geometry:clone(geometry),fixed:FIXED,renderedFixed:fixedProof,
  rendererGeometry:clone(renderer?.inspect()?.rendered.fieldGeometry??null),cameraProjection:clone(renderer?.inspect()?.rendered.cameraProjection??null),architectureRender:clone(renderer?.inspect()?.architecture??null),logoRender:clone(renderer?.inspect()?.logo??null),surfaceDetailRender:clone(renderer?.inspect()?.surface??null),
  firstFrames,homerunTheme:{team:geometry.architecture?.homeTeam??null,track:themeTrack},crowd:{...crowd.inspect(),shownFrame:crowdShownFrame,cachedFrames:crowdCache.length,blits:crowdBlits,sceneRenders:crowdSceneRenders,cacheBytes:crowdCache.reduce((n,c)=>n+c.width*c.height*4,0)},
  effects:{...fireworks.inspect(),timerActive:fireworkTimer!==0,frames:effectFrames,flags:{frame:flagFrame,timerActive:!!flagTimer,render:clone(flagReport)},render:clone(fireworkReport),settings:clone(geometry.architecture?.effects??defaultEffects(geometry.architecture))},
  selectedPoint:selected,canUndo:undoStack.length>0,canRedo:redoStack.length>0,
  cameraRegistration:{parkKey:cameraParkKey(draft),registered:!!draft.cameraViews?.[view.camera],pending:cameraPending.has(cameraEditKey()),error:cameraInputError},
  browserSaved:token(draft)===savedToken,simulationIntegration:'DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED',logs:clone(logs),build:BALLPARK_BUILD_INFO};}
function apply(raw){const v=validateDesign(raw);if(!v.ok)return {ok:false,errors:v.errors};commit(withRegisteredCameras(v.design),{action:'apply_json'});if(v.design.cameraViews!==undefined)rememberCameras();return {ok:true};}
function exportJSON(){if(!validation.ok)throw Error('入力エラーを直してから保存してください');return JSON.stringify(draft,null,2)+'\n';}
function download(){try{const url=URL.createObjectURL(new Blob([exportJSON()],{type:'application/json'})),a=document.createElement('a');a.href=url;
  a.download=(draft.name||'球場設計')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('設計JSONを書き出しました。');}catch(e){message(e.message);}}
function save(){if(!validation.ok)return false;try{localStorage.setItem(storageKey,exportJSON());if(!rememberCameras())return false;savedToken=token(draft);sync();message('このブラウザに保存しました。');return true;}
  catch{message('ブラウザに保存できませんでした。JSON保存で書き出してください。');return false;}}
function undo(){if(!undoStack.length)return inspect();redoStack.push(clone(draft));const next=undoStack.pop();return commit(next,{record:false,action:'undo'});}
function redo(){if(!redoStack.length)return inspect();undoStack.push(clone(draft));const next=redoStack.pop();return commit(next,{record:false,action:'redo'});}
function reset(){selected='CF';return commit(referenceDesign(),{action:'reset'});}
function cameraEditKey(){return cameraParkKey(draft)+'|'+view.camera;}
function currentCamera(){if(view.cameraPose){const p=cameraFromProjection(view.cameraPose,1,view.roofCutaway);p.zoom=view.zoom;return p;}const r=renderer?.inspect();if(!r||r.options.camera!==view.camera)return null;const p=cameraFromProjection(r.rendered.cameraProjection,r.options.zoom,view.roofCutaway);p.zoom=view.zoom;return p;}
function activateCamera(camera){view.camera=camera;const p=cameraPending.get(cameraEditKey())??draft.cameraViews?.[camera];view.orbit=null;view.cameraPose=p?cameraOverride(p):null;view.zoom=p?.zoom??1;if(p)view.roofCutaway=p.roofCutaway;else if(['exterior','outfield','entrance'].includes(camera))view.roofCutaway=false;cameraInputError='';}
function rememberCameras(){const key=cameraParkKey(draft);if(draft.cameraViews&&Object.keys(draft.cameraViews).length)cameraLibrary.set(key,clone(draft.cameraViews));else cameraLibrary.delete(key);try{localStorage.setItem(cameraLibraryKey,encodeCameraLibrary(cameraLibrary));if(cameraInputError.startsWith('ブラウザにカメラ登録を保存できません'))cameraInputError='';return true;}catch{cameraInputError='ブラウザにカメラ登録を保存できません。JSON保存で登録値を書き出してください。';$('camera-error').textContent=cameraInputError;return false;}}
function syncCameraEditor(){const p=currentCamera(),registered=!!draft.cameraViews?.[view.camera],pending=cameraPending.has(cameraEditKey());$('camera-registration').textContent=cameraInputError?'入力を確認':pending?'未登録の調整':registered?'登録済み':'初期値';$('camera-context').textContent=draft.name+' ／ '+$('camera').selectedOptions[0]?.textContent+' — 高さ・向き・倍率・屋根省略を登録';$('camera-error').textContent=cameraInputError;$('camera-register').disabled=!p||!!cameraInputError||!!raf||!validation.ok;
 if(p&&!cameraInputError){for(const [id,value]of [['camera-height',p.eye.y],['camera-x',p.eye.x],['camera-z',p.eye.z],['camera-yaw',p.yawDegrees],['camera-pitch',p.pitchDegrees]])numberValue(id,value);}$('zoom').value=String(view.zoom);$('zoom-value').textContent=view.zoom.toFixed(2)+'×';for(const id of ['camera-height','camera-x','camera-z','camera-yaw','camera-pitch'])$(id).setAttribute('aria-invalid',cameraInputError?'true':'false');}
function previewCamera(p){const errors=cameraPresetErrors(p);cameraInputError=errors.map(e=>e.message).join('\n');if(errors.length){syncCameraEditor();return false;}view.orbit=null;view.cameraPose=cameraOverride(p);view.zoom=p.zoom;view.roofCutaway=p.roofCutaway;cameraPending.set(cameraEditKey(),clone(p));$('roof-cutaway').checked=view.roofCutaway;syncCameraEditor();schedule();return true;}
function registerCamera(){if(raf||cameraInputError||!validation.ok)return false;const p=currentCamera();if(!p||cameraPresetErrors(p).length)return false;cameraPending.delete(cameraEditKey());const d=clone(draft);d.cameraViews={...d.cameraViews,[view.camera]:p};commit(d,{action:'camera_register'});syncCameraEditor();if(!cameraInputError)message('この球場の「'+$('camera').selectedOptions[0].textContent+'」を登録しました。JSON保存にも含まれます。');schedule();return !cameraInputError;}
function revertCamera(){cameraPending.delete(cameraEditKey());activateCamera(view.camera);sync();schedule();return inspect();}
function resetCamera(){cameraPending.delete(cameraEditKey());const d=clone(draft);if(d.cameraViews){delete d.cameraViews[view.camera];if(!Object.keys(d.cameraViews).length)delete d.cameraViews;}const changed=token(d)!==token(draft);commit(d,{action:'camera_default'});if(!changed)activateCamera(view.camera);sync();schedule();message('この球場の選択中の視点を初期値に戻しました。「取り消す」で登録を復元できます。');return inspect();}
function pointUpdate(id,values,{record=true}={}){if(!values||Object.keys(values).some(k=>!['angleDegrees','distanceMeters','heightMeters'].includes(k)))throw Error('点の角度・距離・壁高だけを編集できます');
  const d=editableCopy(draft),p=d.fencePoints.find(p=>p.id===id);if(!p)throw Error('編集する点が見つかりません');Object.assign(p,values);return commit(d,{record,action:'point'});}
globalThis.BallparkStudio=Object.freeze({inspect,setDesign:apply,updatePoint:pointUpdate,exportJSON,downloadJSON:download,save,undo,redo,reset,
  registerCameraView:registerCamera,revertCameraView:revertCamera,resetCameraView:resetCamera,
  setCrowdPlayback,reactCrowd,triggerFireworks:launchFireworks,setFireworkPlayback,stopFireworks,
  measure:angleDegrees=>{if(!Number.isFinite(angleDegrees))throw Error('有限の角度が必要です');return wallAt(geometry,angleDegrees*Math.PI/180);}});

function errorText(paths){return validation.errors.filter(e=>paths.some(p=>e.path===p||e.path.startsWith(p+'.'))).map(e=>e.message).join('\n');}
function setError(id,paths,inputs=[]){const text=errorText(paths);$(id).textContent=text;for(const input of inputs)$(input).setAttribute('aria-invalid',text?'true':'false');}
function numberValue(id,value){if(document.activeElement!==$(id))$(id).value=typeof value==='number'?String(Number(value.toFixed(2))):'';}
function sync(){
  syncEffectsControls();
  $('camera').value=view.camera;
  $('roof-cutaway').checked=view.roofCutaway;syncCameraEditor();
  if(document.activeElement!==$('park-name'))$('park-name').value=draft.name;
  setError('name-error',['name'],['park-name']);$('shape-error').textContent=validation.errors.filter(e=>e.path==='fencePoints').map(e=>e.message).join('\n');
  $('architecture-settings').hidden=!draft.architecture;
  const isDodger=draft.architecture?.style==='dodger_stadium',isKoshien=draft.architecture?.style==='koshien',isNiikura=draft.architecture?.style==='niikura_dome',isOutdoor=isDodger||isKoshien||isNiikura;
  const isFukuoka=draft.architecture?.style==='fukuoka_dome';
  $('landscape-controls').hidden=!isDodger;for(const id of ['first-side','third-side'])$(id).min=isNiikura?'8':'18.288';
  if(isDodger){const atmosphere=draft.architecture.atmosphere??DEFAULT_DODGER_ATMOSPHERE;$('landscape-period').value=atmosphere.period;numberValue('landscape-strength',atmosphere.strength*100);$('landscape-strength-value').textContent=Math.round(atmosphere.strength*100)+'%';setError('landscape-error',['architecture.atmosphere']);}
  $('roof-opening').disabled=isOutdoor;$('logo-section').hidden=isOutdoor||isFukuoka;
  $('koshien-backstop-standard').hidden=!isKoshien;$('koshien-backstop-standard').disabled=draft.foul.backstopMeters===KOSHIEN_BACKSTOP_METERS;
  $('park-note').textContent=isFukuoka?'公式施設概要：両翼約100m・中堅約122m。テラス・屋根・座席は写真を基にした表示近似。':isNiikura?'両翼94.5m・中堅142m。内野席の近さはファウル側の外周で調整。壁高3m・定員76,000人は暫定値。':isKoshien?'両翼95m・中堅118m。銀傘は写真の内野部分を再現。中間距離・壁高・建築は近似です。':isDodger?'公式記載の距離を使用。客席・照明・ファウル側の形状と一部壁高は写真からの近似です。':'左翼105m・フェンス高1.3mは仮設定です。';
  $('roof-title').textContent=isFukuoka?'3枚の屋根の開き具合':isNiikura?'中央開口の固定膜屋根':isKoshien?'銀傘（固定屋根）':isDodger?'屋外球場':'屋根の開き具合';
  $('color-red-label').textContent=isFukuoka?'黄（ホークス）':isNiikura?'緑':isKoshien?'阪神の主色':isOutdoor?'観客の副色':'赤';$('color-blue-label').textContent=isFukuoka?'濃い黄':isNiikura?'黄色':isKoshien?'阪神の副色':'青';$('color-gold-label').textContent=isNiikura?'クリーム':isOutdoor?'線と縁':'金';$('visitor-colors').hidden=!isKoshien;
  syncCrowdControls();
  if(draft.architecture){const a=draft.architecture;numberValue('capacity',a.capacity);numberValue('roof-opening',a.roof.openingPercent);
    $('roof-value').textContent=isNiikura?'中央を開放':isKoshien?'内野席を覆う':isDodger?'開放型':String(a.roof.openingPercent)+'%';for(const k of ['red','blue','gold'])$('color-'+k).value=a.colors[k];
    if(isFukuoka){const p=koshienFanPalettes(a);$('color-red').value=p.home[0];$('color-blue').value=p.home[1];}
    if(isKoshien){const p=koshienFanPalettes(a);$('color-red').value=p.home[0];$('color-blue').value=p.home[1];for(let i=0;i<2;i++)$('visitor-color-'+i).value=p.visitor[i];}
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
  syncScoreField();syncNiikuraScoreboard();syncPaypayScoreboard();
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
function composeEffects(){const s=crowd.inspect();if(!crowdCache.length)return;crowdShownFrame=s.frame%crowdCache.length;const target=$('preview');target.getContext('2d').drawImage(crowdCache[crowdShownFrame],0,0);crowdBlits++;
 const f=fireworks.inspect(),settings=geometry.architecture?.effects??defaultEffects(geometry.architecture);fireworkReport=f.playing?renderer.paintEffects(target,sampleFireworks(settings.fireworks,f.elapsedMs,f.seed)):{input:0,visible:0,occluded:0,clipped:0};
 if(flagCache.length)flagReport=renderer.paintEffects(target,flagCache[flagFrame%flagCache.length]);else flagReport=null;
 if(f.playing)effectFrames++;syncFireworkState();}
function flagTick(){clearTimeout(flagTimer);flagTimer=0;const env=geometry.architecture?.effects?.environment,interval=flagFrameDuration(env?.wind),now=performance.now(),active=!!flagCache.length&&env?.flags&&Number.isFinite(interval)&&!fireworks.inspect().hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches;if(active){flagElapsed+=Math.max(0,now-flagLast);flagFrame=Math.floor(flagElapsed/interval)%3;}else if(!Number.isFinite(interval)||!env?.flags)flagFrame=0;flagLast=now;composeEffects();if(active)flagTimer=setTimeout(flagTick,interval);}
function crowdTick(){clearTimeout(crowdTimer);crowdTimer=0;const s=crowd.inspect();
 if(!geometry.architecture||!crowdCache.length){$('crowd-status').textContent='ドームで応援を確認できます';return;}
 composeEffects();
 $('crowd-status').textContent=!s.visible?'無観客 · 元の座席色':s.reaction?({hit:'安打',home_run:'本塁打',out:'アウト',error:'失策'}[s.reaction]+'の反応'):s.paused?'停止中':'通常の応援';
 if(s.active)crowdTimer=setTimeout(crowdTick,s.nextInMs+1);
}
function syncCrowdControls(){const s=crowd.inspect();$('home-team').value=geometry.architecture?.homeTeam??'';$('home-team').disabled=!geometry.architecture;$('crowd-attendance').value=s.visible?'full':'empty';$('crowd-attendance').disabled=!geometry.architecture;
 $('crowd-play').checked=!s.paused;$('crowd-frames').value=s.pattern==='223'?'223':String(s.frames);
 for(const id of ['crowd-play','crowd-frames','crowd-hit','crowd-home_run','crowd-out','crowd-error'])$(id).disabled=!geometry.architecture||!s.visible;
}
function setCrowdPlayback(options){const before=crowd.inspect(),s=crowd.configure(attendance(geometry)==='empty'?{...options,visible:false}:options);syncCrowdControls();
 if(before.visible!==s.visible||before.frames!==s.frames)schedule();else crowdTick();return inspect();}
function stopTheme(){try{themeVoice?.stop();}catch{}themeVoice=null;themeTrack=null;}
async function playHomerunTheme(){stopTheme();const team=geometry.architecture?.homeTeam,walkoff=$('homerun-walkoff').checked,track=homeThemeTrack(team,{inning:Number($('homerun-inning').value),walkoff});
 $('homerun-theme-status').textContent=track?HOME_TEAMS[team].name+' · '+(walkoff?'サヨナラ':$('homerun-inning').value<=6?'6回まで':'7回以降'):'この球場のホームチームに本塁打曲はありません';if(!track)return null;
 themeContext??=new AudioContext();await themeContext.resume();const binary=atob(BALLPARK_HOMERUN_AUDIO[track]),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)),buffer=await themeContext.decodeAudioData(bytes.buffer),source=themeContext.createBufferSource(),gain=themeContext.createGain();
 gain.gain.value=.455;source.buffer=buffer;source.connect(gain);gain.connect(themeContext.destination);source.onended=()=>{if(themeVoice===source){themeVoice=null;themeTrack=null;}};themeVoice=source;themeTrack=track;source.start();return track;}
function reactCrowd(event){const result=crowd.react(event);if(result.accepted&&event.type==='home_run'){launchFireworks({type:'home_run',id:event.id});if(event.id?.startsWith('preview-')&&themeVersion)playHomerunTheme().catch(e=>message(e.message));}crowdTick();return result;}
function syncFireworkState(){const s=fireworks.inspect(),text=!s.playing?'停止中':s.paused?'一時停止中':s.hidden?'画面の復帰を待機中':'打上げ中';if($('firework-status').textContent!==text)$('firework-status').textContent=text;$('firework-pause').textContent=s.paused?'再生':'一時停止';$('firework-pause').disabled=!s.playing;$('firework-stop').disabled=!s.playing;}
function fireworkTick(){clearTimeout(fireworkTimer);fireworkTimer=0;composeEffects();if(fireworks.inspect().active)fireworkTimer=setTimeout(fireworkTick,33);}
function launchFireworks(event){const f=(geometry.architecture?.effects??defaultEffects(geometry.architecture)).fireworks;if(!effectsVersion||!ready||!geometry.architecture||!validation.ok||!f.enabled)return{accepted:false,reason:'disabled'};if(event?.type==='home_run'&&!f.autoHomeRun)return{accepted:false,reason:'auto_disabled'};
 const result=fireworks.start(event,{reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});fireworkTick();return result;}
function setFireworkPlayback(options){const r=fireworks.configure(options);fireworkTick();return r;}
function stopFireworks(){const r=fireworks.stop();fireworkTick();return r;}
function syncEffectsControls(){const a=draft.architecture,e=a?.effects??defaultEffects(a);$('effects-settings').hidden=!effectsVersion||!a;$('effects-camera-option').hidden=!effectsVersion;
 const env=e.environment??defaultEnvironment(),day=!!e.environment&&env.period==='day';$('environment-controls').hidden=!atmosphereVersion;$('environment-period').value=env.period;$('environment-weather').value=env.weather;$('flag-motion').checked=env.flags;const wind=env.wind??defaultWind();$('wind-controls').hidden=!windVersion;numberValue('wind-direction',wind.directionDegrees);numberValue('wind-speed',wind.speedMps);$('wind-direction-value').textContent=wind.directionDegrees+'°';$('wind-speed-value').textContent=wind.speedMps===0?'無風':wind.speedMps.toFixed(1)+' m/s';$('light-enabled').disabled=day;$('light-enabled').checked=!day&&e.lighting.enabled;numberValue('light-brightness',e.lighting.brightness*100);$('light-brightness-value').textContent=Math.round(e.lighting.brightness*100)+'%';$('light-color').value=e.lighting.color;
 $('firework-enabled').checked=e.fireworks.enabled;$('firework-auto').checked=e.fireworks.autoHomeRun;for(let i=0;i<2;i++)$('firework-color-'+i).value=e.fireworks.colors[i];for(const k of ['x','z','height','size'])numberValue('firework-'+k,e.fireworks[k]);numberValue('firework-variation',(e.fireworks.variation??0)*100);$('firework-variation-value').textContent=Math.round((e.fireworks.variation??0)*100)+'%';
 $('firework-launch').disabled=!ready||!validation.ok||!a||!e.fireworks.enabled;$('effects-reset').disabled=!a?.effects;setError('effects-error',['architecture.effects'],['wind-direction','wind-speed','light-brightness','firework-x','firework-z','firework-height','firework-size']);syncFireworkState();}
function crowdFrameCanvas(frame,s){const r=renderer.draw(geometry,{...view,crowdFrame:frame,crowdFrames:s.frames,crowdVisible:s.visible});crowdSceneRenders++;
 const canvas=document.createElement('canvas');renderer.copyTo(canvas);return {r,canvas};}
// The first crowd frame answers the edit at once; the others follow between input events.
function fillCrowd(frame,count,s){crowdFill=0;if(frame>=count){renderCount++;renderedRevision=revision;return;}
 try{crowdCache.push(crowdFrameCanvas(frame,s).canvas);crowdFill=setTimeout(fillCrowd,20,frame+1,count,s);}catch(e){failure=e.message;$('render-status').textContent='描画エラー';message(e.message);}}
function schedule(){if(!renderer||raf)return;clearTimeout(crowdTimer);clearTimeout(flagTimer);clearTimeout(crowdFill);flagTimer=0;crowdTimer=0;crowdFill=0;raf=requestAnimationFrame(()=>{raf=0;try{
 const s=crowd.inspect(),count=geometry.architecture&&s.visible?s.frames:1,{r,canvas}=crowdFrameCanvas(0,s);
 crowdCache=[canvas];firstFrames++;flagCache=(geometry.architecture?.effects?.environment?.flags||geometry.architecture?.effects?.environment?.wind)?[0,1,2].map(frame=>renderer.flagPoints(geometry,frame)):[];if(!flagCache[0]?.length)flagCache=[];flagLast=performance.now();renderer.copyTo($('preview'));fixedProof=clone(r.fixed);crowdTick();fireworkTick();flagTick();
    failure=null;crowdFill=setTimeout(fillCrowd,20,1,count,s);if(view.orbit&&cameraPending.has(cameraEditKey()))cameraPending.set(cameraEditKey(),currentCamera());syncCameraEditor();$('render-status').textContent='既存描画 · '+(geometry.architecture?.style==='fukuoka_dome'?'みずほPayPayドーム福岡':geometry.architecture?.style==='niikura_dome'?'にーくらドーム':geometry.architecture?.style==='koshien'?'阪神甲子園球場':geometry.architecture?.style==='dodger_stadium'?'ドジャースタジアム':geometry.architecture?(view.roofCutaway?'ドーム · 屋根の手前を省略':'ドーム · 屋根全体'):(geometry.kind==='reference_circle'?'現行基準':'設計形状'));drawPlan();}
    catch(e){failure=e.message;$('render-status').textContent='描画エラー';message(e.message);}});}
function numeric(id,change){const el=$(id);el.addEventListener('focus',()=>el.dataset.group='');el.addEventListener('input',()=>{
  const record=!el.dataset.group;el.dataset.group='yes';const value=el.value===''?null:Number(el.value);change(value,record);});}
for(const a of ANCHORS){const row=document.createElement('div');row.className='anchor-row';
 row.innerHTML=`<div class="anchor-heading"><strong>${a.label}</strong><button type="button" data-select="${a.id}">図で選択</button></div><div class="numeric-pair"><label>距離（m）<input id="distance-${a.id}" type="number" step="0.1" aria-describedby="error-${a.id}"></label><label>壁高（m）<input id="height-${a.id}" type="number" step="0.1" aria-describedby="error-${a.id}"></label></div><p id="error-${a.id}" class="error" aria-live="polite"></p>`;
 $('anchor-inputs').append(row);row.querySelector('button').onclick=()=>{selected=a.id;sync();};
 numeric('distance-'+a.id,(n,record)=>pointUpdate(a.id,{distanceMeters:n},{record}));numeric('height-'+a.id,(n,record)=>pointUpdate(a.id,{heightMeters:n},{record}));}
function changeValue(path,value,record){const d=editableCopy(draft),keys=path.split('.');let o=d;for(const k of keys.slice(0,-1))o=o[k];o[keys.at(-1)]=value;commit(d,{record});}
for(const [id,path]of [['backstop','foul.backstopMeters'],['first-side','foul.firstSideMeters'],['third-side','foul.thirdSideMeters'],['foul-height','foul.heightMeters'],['track-width','trackWidthMeters']])numeric(id,(n,record)=>changeValue(path,n,record));
$('koshien-backstop-standard').onclick=()=>changeValue('foul.backstopMeters',KOSHIEN_BACKSTOP_METERS);
for(const [id,key]of [['point-angle','angleDegrees'],['point-distance','distanceMeters'],['point-height','heightMeters']])numeric(id,(n,record)=>pointUpdate(selected,{[key]:n},{record}));
$('park-name').onfocus=()=>$('park-name').dataset.group='';$('park-name').oninput=()=>{const record=!$('park-name').dataset.group;$('park-name').dataset.group='yes';commit({...draft,name:$('park-name').value},{record});};
$('ruleset').onchange=()=>commit({...draft,ruleset:$('ruleset').value});
$('point-select').onchange=()=>{selected=$('point-select').value;sync();};
$('symmetric').onclick=()=>commit(symmetricDesign(),{action:'example'});$('reset').onclick=reset;$('undo').onclick=undo;$('redo').onclick=redo;
$('fukuoka-preset').hidden=BALLPARK_BUILD_INFO.version<21;$('fukuoka-preset').onclick=()=>{view.camera='interior';view.roofCutaway=false;commit(withRegisteredCameras(environmentPreset(fukuokaDomeDesign())),{action:'fukuoka_preset'});activateCamera('interior');sync();schedule();};
$('dome-preset').onclick=()=>commit(withRegisteredCameras(environmentPreset(russianDomeDesign())),{action:'dome_preset'});
$('dodger-preset').onclick=()=>commit(withRegisteredCameras(environmentPreset(dodgerStadiumDesign())),{action:'dodger_preset'});
$('niikura-preset').hidden=BALLPARK_BUILD_INFO.version<11;$('niikura-preset').onclick=()=>{view.camera='interior';commit(withRegisteredCameras(environmentPreset(niikuraDomeDesign())),{action:'niikura_preset'});activateCamera('interior');sync();schedule();};
$('koshien-preset').onclick=()=>commit(withRegisteredCameras(environmentPreset(koshienDesign())),{action:'koshien_preset'});
function architectureValue(path,value,record=true){const d=clone(draft);if(!d.architecture)return;d.schema=SCHEMA;const keys=path.split('.');let o=d.architecture;
 if(keys[0]==='scoreboard'&&!d.architecture.scoreboard)d.architecture.scoreboard=defaultScoreboard();
 if(keys[0]==='atmosphere'&&!d.architecture.atmosphere)d.architecture.atmosphere={...DEFAULT_DODGER_ATMOSPHERE};
 if(keys[0]==='details'&&!d.architecture.details)d.architecture.details={factor:6,logos:true,ornaments:true};
 if(keys[0]==='logo'&&!d.architecture.logo)d.architecture.logo=russianArchitecture().logo;
 if(keys[0]==='surfaceDetail'&&!d.architecture.surfaceDetail)d.architecture.surfaceDetail={...DEFAULT_SURFACE_DETAIL};
 if(keys[0]==='crowd'&&!d.architecture.crowd)d.architecture.crowd={...DEFAULT_CROWD_APPEARANCE};
 if(keys[0]==='effects'){if(!d.architecture.effects)d.architecture.effects=defaultEffects(d.architecture);if(atmosphereVersion&&!d.architecture.effects.environment)d.architecture.effects.environment=defaultEnvironment();if(keys[1]==='environment'&&keys[2]==='wind'&&!d.architecture.effects.environment.wind)d.architecture.effects.environment.wind=defaultWind();}
 for(const k of keys.slice(0,-1))o=o[k];o[keys.at(-1)]=value;commit(d,{record,action:'architecture'});}
const scoreFields=$('scoreboard-teams');
let selectedScoreDefender='P';
const scoreField=document.createElement('details');scoreField.id='score-field-settings';scoreField.className='score-field-controls';scoreField.hidden=true;
scoreField.innerHTML=`<summary>守備位置・走者</summary><label class="check"><input id="score-field-enabled" type="checkbox">守備・走者の図を表示</label><div class="score-field-bases">${[['first','一塁'],['second','二塁'],['third','三塁']].map(([id,label])=>`<label class="check"><input id="score-runner-${id}" type="checkbox">${label}走者</label>`).join('')}</div><canvas id="score-field-map" width="280" height="210" aria-label="守備位置と走者の表示見本"></canvas><label>守備位置<select id="score-defender">${DEFENDER_ROLES.map(d=>`<option value="${d.role}">${d.label}</option>`).join('')}</select></label><label>表示名<input id="score-field-label" maxlength="12"></label><div class="numeric-pair"><label>一塁側＋／三塁側−（m）<input id="score-field-x" type="number" min="-300" max="300" step="1"></label><label>本塁から奥へ（m）<input id="score-field-z" type="number" min="-300" max="300" step="1"></label></div><button id="score-field-reset" type="button">配置だけ戻す</button><p id="score-field-error" class="error" aria-live="polite"></p>`;
document.querySelector('.scoreboard-settings').append(scoreField);
function editScoreField(change,record=true){if(!scoreboardCapabilities(draft.architecture?.style).fieldDiagram)return;const d=clone(draft);d.architecture.scoreboard??=defaultScoreboard();d.architecture.scoreboard.fieldDiagram??=defaultFieldDiagram();change(d.architecture.scoreboard.fieldDiagram);commit(d,{record,action:'scoreboard_field'});}
function syncScoreField(){const field=scoreboardFieldDiagram(draft.architecture);scoreField.hidden=!field;if(!field)return;
 $('score-field-enabled').checked=field.enabled;for(const k of ['first','second','third'])$('score-runner-'+k).checked=field.runners[k];$('score-defender').value=selectedScoreDefender;
 const d=field.defenders.find(d=>d.role===selectedScoreDefender);if(document.activeElement!==$('score-field-label'))$('score-field-label').value=d.label;for(const k of ['x','z'])numberValue('score-field-'+k,d[k]);
 setError('score-field-error',['architecture.scoreboard.fieldDiagram'],['score-field-label','score-field-x','score-field-z']);
 const canvas=$('score-field-map'),ctx=canvas.getContext('2d'),point=p=>{const q=projectFieldDiagramPoint(p);return q?{x:q.u*280,y:q.v*210}:null;};ctx.fillStyle='#112c23';ctx.fillRect(0,0,280,210);ctx.globalAlpha=field.enabled?1:.4;
 const home=point({x:0,z:0});ctx.strokeStyle='#718c76';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(home.x,home.y);for(const b of SCOREBOARD_BASES){const q=point(b);ctx.lineTo(q.x,q.y);}ctx.closePath();ctx.stroke();
 for(const b of SCOREBOARD_BASES){const q=point(b);ctx.fillStyle=field.runners[b.id]?'#a4e38a':'#3f5b47';ctx.beginPath();ctx.moveTo(q.x,q.y-5);ctx.lineTo(q.x+5,q.y);ctx.lineTo(q.x,q.y+5);ctx.lineTo(q.x-5,q.y);ctx.closePath();ctx.fill();}
 for(const d of field.defenders){const q=point(d);if(!q)continue;ctx.fillStyle=d.role===selectedScoreDefender?'#ead083':'#e0e8d5';ctx.beginPath();ctx.arc(q.x,q.y,2.5,0,Math.PI*2);ctx.fill();ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillText(d.label,q.x,q.y-6,64);}ctx.globalAlpha=1;
}
$('score-defender').onchange=()=>{selectedScoreDefender=$('score-defender').value;syncScoreField();};
$('score-field-enabled').onchange=()=>editScoreField(f=>f.enabled=$('score-field-enabled').checked);
for(const k of ['first','second','third'])$('score-runner-'+k).onchange=()=>editScoreField(f=>f.runners[k]=$('score-runner-'+k).checked);
$('score-field-label').onfocus=()=>$('score-field-label').dataset.group='';$('score-field-label').oninput=()=>{const el=$('score-field-label'),record=!el.dataset.group;el.dataset.group='yes';editScoreField(f=>f.defenders.find(d=>d.role===selectedScoreDefender).label=el.value,record);};
for(const k of ['x','z'])numeric('score-field-'+k,(value,record)=>editScoreField(f=>f.defenders.find(d=>d.role===selectedScoreDefender)[k]=value,record));
$('score-field-reset').onclick=()=>editScoreField(f=>{for(const d of f.defenders){const p=DEFENDER_ROLES.find(p=>p.role===d.role);d.x=p.x;d.z=p.z;}});
for(let row=0;row<2;row++){
 const wrap=document.createElement('div');wrap.className='score-team-editor';wrap.innerHTML=`<label>チーム<input id="score-name-${row}" maxlength="12"></label><div class="score-innings">${Array.from({length:9},(_,i)=>`<label>${i+1}<input id="score-${row}-${i}" type="number" min="0" max="99" step="1" aria-label="チーム${row+1} ${i+1}回"></label>`).join('')}</div><div class="numeric-pair"><label>安打 H<input id="score-hits-${row}" type="number" min="0" max="999"></label><label>失策 E<input id="score-errors-${row}" type="number" min="0" max="99"></label></div>`;scoreFields.append(wrap);
 const el=$('score-name-'+row);el.onchange=()=>architectureValue('scoreboard.teams.'+row+'.name',el.value);
 for(let i=0;i<9;i++)numeric('score-'+row+'-'+i,(n,record)=>architectureValue('scoreboard.teams.'+row+'.innings.'+i,n,record));
 for(const k of ['hits','errors'])numeric('score-'+k+'-'+row,(n,record)=>architectureValue('scoreboard.teams.'+row+'.'+k,n,record));
}
$('scoreboard-enabled').onchange=()=>architectureValue('scoreboard.enabled',$('scoreboard-enabled').checked);
for(const k of ['balls','strikes','outs','speedKmh'])numeric('score-'+k,(n,record)=>architectureValue('scoreboard.'+k,n,record));
const niikuraBoardPanel=document.createElement('details');niikuraBoardPanel.id='niikura-board-settings';niikuraBoardPanel.hidden=true;
niikuraBoardPanel.innerHTML=`<summary>年俸・選手成績・打順</summary><div class="numeric-pair"><label>回<input id="niikura-inning" type="number" min="1" max="99" step="1"></label><label>表・裏<select id="niikura-half"><option value="top">表</option><option value="bottom">裏</option></select></label></div><label>選手名<input id="niikura-name" maxlength="12"></label><div class="numeric-pair"><label>背番号<input id="niikura-number" type="number" min="0" max="999" step="1"></label><label>打率<input id="niikura-average" type="number" min="0" max="1" step="0.001"></label></div><div class="numeric-pair"><label>本塁打<input id="niikura-homeRuns" type="number" min="0" max="999" step="1"></label><label>打点<input id="niikura-rbis" type="number" min="0" max="999" step="1"></label></div><label>年俸（万円）<input id="niikura-salaryManYen" type="number" min="0" max="999999999" step="1"></label><div class="numeric-pair"><label>投球数<input id="niikura-pitchCount" type="number" min="0" max="999" step="1"></label><label>防御率<input id="niikura-era" type="number" min="0" max="99.99" step="0.01"></label></div><label class="check"><input id="niikura-portrait" type="checkbox">見本の顔写真</label><label class="check"><input id="niikura-monitors" type="checkbox">4基の映像モニター</label><div id="niikura-lineups"></div><button id="niikura-board-reset" type="button">この欄を見本に戻す</button><p id="niikura-board-error" class="error" aria-live="polite"></p>`;
document.querySelector('.scoreboard-settings').append(niikuraBoardPanel);
function editNiikuraScoreboard(change,record=true){if(draft.architecture?.style!=='niikura_dome')return;const d=clone(draft);d.architecture.scoreboard??=defaultScoreboard();d.architecture.scoreboard.niikura??=defaultNiikuraScoreboard();change(d.architecture.scoreboard.niikura);commit(d,{record,action:'niikura_scoreboard'});}
function syncNiikuraScoreboard(){niikuraBoardPanel.hidden=draft.architecture?.style!=='niikura_dome';if(niikuraBoardPanel.hidden)return;const s=draft.architecture.scoreboard?.niikura??defaultNiikuraScoreboard();numberValue('niikura-inning',s.inning);$('niikura-half').value=s.half;$('niikura-portrait').checked=s.portrait;$('niikura-monitors').checked=s.monitors??true;if(document.activeElement!==$('niikura-name'))$('niikura-name').value=s.batter.name;
 for(const k of ['number','average','homeRuns','rbis','salaryManYen'])numberValue('niikura-'+k,s.batter[k]);for(const k of ['pitchCount','era'])numberValue('niikura-'+k,s.pitcher[k]);
 for(let team=0;team<2;team++)for(let row=0;row<9;row++){const p=s.lineups[team][row],id='niikura-lineup-'+team+'-'+row;if(document.activeElement!==$(id+'-name'))$(id+'-name').value=p.name;$(id+'-position').value=p.position;}
 setError('niikura-board-error',['architecture.scoreboard.niikura'],['niikura-name','niikura-inning',...['number','average','homeRuns','rbis','salaryManYen','pitchCount','era'].map(k=>'niikura-'+k)]);
}
for(const [id,path]of [['inning','inning'],['number','batter.number'],['average','batter.average'],['homeRuns','batter.homeRuns'],['rbis','batter.rbis'],['salaryManYen','batter.salaryManYen'],['pitchCount','pitcher.pitchCount'],['era','pitcher.era']])numeric('niikura-'+id,(value,record)=>editNiikuraScoreboard(s=>{const keys=path.split('.');if(keys.length===1)s[keys[0]]=value;else s[keys[0]][keys[1]]=value;},record));
$('niikura-monitors').onchange=()=>editNiikuraScoreboard(s=>s.monitors=$('niikura-monitors').checked);
$('niikura-half').onchange=()=>editNiikuraScoreboard(s=>s.half=$('niikura-half').value);$('niikura-portrait').onchange=()=>editNiikuraScoreboard(s=>s.portrait=$('niikura-portrait').checked);$('niikura-name').onchange=()=>editNiikuraScoreboard(s=>s.batter.name=$('niikura-name').value);
for(let team=0;team<2;team++){const panel=document.createElement('details');panel.innerHTML=`<summary>チーム${team+1}の打順</summary>`;for(let row=0;row<9;row++){const id='niikura-lineup-'+team+'-'+row,div=document.createElement('div');div.className='niikura-lineup-row';div.innerHTML=`<span>${row+1}</span><input id="${id}-name" maxlength="12" aria-label="チーム${team+1} 打順${row+1} 選手名"><select id="${id}-position" aria-label="チーム${team+1} 打順${row+1} 守備">${['1','2','3','4','5','6','7','8','9','D'].map(p=>`<option value="${p}">${p}</option>`).join('')}</select>`;panel.append(div);div.querySelector('input').onchange=e=>editNiikuraScoreboard(s=>s.lineups[team][row].name=e.target.value);div.querySelector('select').onchange=e=>editNiikuraScoreboard(s=>s.lineups[team][row].position=e.target.value);}$('niikura-lineups').append(panel);}
$('niikura-board-reset').onclick=()=>editNiikuraScoreboard(s=>Object.assign(s,defaultNiikuraScoreboard()));

const paypayBoardPanel=document.createElement('details');paypayBoardPanel.id='paypay-board-settings';paypayBoardPanel.hidden=true;
paypayBoardPanel.innerHTML=`<summary>福岡の中央スコアボード</summary><div class="numeric-pair"><label>回<input id="paypay-inning" type="number" min="1" max="99" step="1"></label><label>表・裏<select id="paypay-half"><option value="top">表</option><option value="bottom">裏</option></select></label></div><label>投球数<input id="paypay-pitchCount" type="number" min="0" max="999" step="1"></label><div id="paypay-lineups"></div><button id="paypay-board-reset" type="button">この欄を見本に戻す</button><p id="paypay-board-error" class="error" aria-live="polite"></p>`;
document.querySelector('.scoreboard-settings').append(paypayBoardPanel);
function editPaypayScoreboard(change,record=true){if(draft.architecture?.style!=='fukuoka_dome')return;const d=clone(draft);d.architecture.scoreboard??=defaultScoreboard();d.architecture.scoreboard.paypay??=defaultPaypayScoreboard();change(d.architecture.scoreboard.paypay);commit(d,{record,action:'paypay_scoreboard'});}
function syncPaypayScoreboard(){paypayBoardPanel.hidden=draft.architecture?.style!=='fukuoka_dome';if(paypayBoardPanel.hidden)return;const s=draft.architecture.scoreboard?.paypay??defaultPaypayScoreboard();numberValue('paypay-inning',s.inning);numberValue('paypay-pitchCount',s.pitchCount);$('paypay-half').value=s.half;
 for(let team=0;team<2;team++)for(let row=0;row<9;row++){const p=s.lineups[team][row],id='paypay-lineup-'+team+'-'+row;if(document.activeElement!==$(id+'-name'))$(id+'-name').value=p.name;$(id+'-position').value=p.position;}
 setError('paypay-board-error',['architecture.scoreboard.paypay'],['paypay-inning','paypay-pitchCount',...Array.from({length:18},(_,i)=>'paypay-lineup-'+Math.floor(i/9)+'-'+i%9+'-name')]);
}
for(const k of ['inning','pitchCount'])numeric('paypay-'+k,(value,record)=>editPaypayScoreboard(s=>s[k]=value,record));
$('paypay-half').onchange=()=>editPaypayScoreboard(s=>s.half=$('paypay-half').value);
for(let team=0;team<2;team++){const panel=document.createElement('details');panel.innerHTML=`<summary>チーム${team+1}の打順</summary>`;for(let row=0;row<9;row++){const id='paypay-lineup-'+team+'-'+row,div=document.createElement('div');div.className='niikura-lineup-row';div.innerHTML=`<span>${row+1}</span><input id="${id}-name" maxlength="12" aria-label="福岡 チーム${team+1} 打順${row+1} 選手名"><select id="${id}-position" aria-label="福岡 チーム${team+1} 打順${row+1} 守備">${['1','2','3','4','5','6','7','8','9','D'].map(p=>`<option value="${p}">${p}</option>`).join('')}</select>`;panel.append(div);div.querySelector('input').onchange=e=>editPaypayScoreboard(s=>s.lineups[team][row].name=e.target.value);div.querySelector('select').onchange=e=>editPaypayScoreboard(s=>s.lineups[team][row].position=e.target.value);}$('paypay-lineups').append(panel);}
$('paypay-board-reset').onclick=()=>editPaypayScoreboard(s=>Object.assign(s,defaultPaypayScoreboard()));

numeric('capacity',(n,record)=>architectureValue('capacity',n,record));numeric('roof-opening',(n,record)=>architectureValue('roof.openingPercent',n,record));
$('landscape-period').onchange=()=>architectureValue('atmosphere.period',$('landscape-period').value);
numeric('landscape-strength',(n,record)=>architectureValue('atmosphere.strength',n===null?null:n/100,record));
for(const k of ['red','blue','gold'])$('color-'+k).onchange=()=>{if(['koshien','fukuoka_dome'].includes(draft.architecture?.style)&&k!=='gold'){const p=[...koshienFanPalettes(draft.architecture).home];p[k==='red'?0:1]=$('color-'+k).value;architectureValue('crowd.homeColors',p);}else architectureValue('colors.'+k,$('color-'+k).value);};
for(let i=0;i<2;i++)$('visitor-color-'+i).onchange=()=>{const p=[...koshienFanPalettes(draft.architecture).visitor];p[i]=$('visitor-color-'+i).value;architectureValue('crowd.visitorColors',p);};
$('building-factor').onchange=()=>architectureValue('details.factor',Number($('building-factor').value));
for(const k of ['logos','ornaments'])$('building-'+k).onchange=()=>architectureValue('details.'+k,$('building-'+k).checked);
$('logo-enabled').onchange=()=>architectureValue('logo.enabled',$('logo-enabled').checked);$('logo-fine').onchange=()=>architectureValue('logo.detail',$('logo-fine').checked?'fine':'dots');
numeric('logo-width',(n,record)=>architectureValue('logo.widthMeters',n,record));numeric('logo-center',(n,record)=>architectureValue('logo.centerZ',n,record));
numeric('logo-brightness',(n,record)=>architectureValue('logo.brightness',n,record));numeric('logo-glow',(n,record)=>architectureValue('logo.glow',n,record));
for(const [id,key]of [['crowd-density','density'],['crowd-size','size'],['crowd-brightness','brightness'],['crowd-glow','glow']])numeric(id,(n,record)=>architectureValue('crowd.'+key,n===null?null:n/100,record));
$('crowd-detail').onchange=()=>architectureValue('crowd.detail',$('crowd-detail').value);
for(const key of ['period','weather'])$('environment-'+key).onchange=()=>architectureValue('effects.environment.'+key,$('environment-'+key).value);$('flag-motion').onchange=()=>architectureValue('effects.environment.flags',$('flag-motion').checked);
for(const [id,key] of [['wind-direction','directionDegrees'],['wind-speed','speedMps']])numeric(id,(n,record)=>architectureValue('effects.environment.wind.'+key,n,record));
numeric('firework-variation',(n,record)=>architectureValue('effects.fireworks.variation',n===null?null:n/100,record));
$('light-enabled').onchange=()=>architectureValue('effects.lighting.enabled',$('light-enabled').checked);
numeric('light-brightness',(n,record)=>architectureValue('effects.lighting.brightness',n===null?null:n/100,record));$('light-color').onchange=()=>architectureValue('effects.lighting.color',$('light-color').value);
for(const key of ['enabled','autoHomeRun']){const id=key==='enabled'?'firework-enabled':'firework-auto';$(id).onchange=()=>architectureValue('effects.fireworks.'+key,$(id).checked);}
for(let i=0;i<2;i++)$('firework-color-'+i).onchange=()=>architectureValue('effects.fireworks.colors.'+i,$('firework-color-'+i).value);
for(const key of ['x','z','height','size'])numeric('firework-'+key,(n,record)=>architectureValue('effects.fireworks.'+key,n,record));
$('firework-launch').onclick=()=>launchFireworks({type:'manual',id:'manual-'+(++fireworkEvent)});$('firework-pause').onclick=()=>setFireworkPlayback({paused:!fireworks.inspect().paused});$('firework-stop').onclick=stopFireworks;
$('effects-overview').onclick=()=>{activateCamera('effects');if(!view.cameraPose)view.roofCutaway=false;sync();schedule();};
$('effects-reset').onclick=()=>{const d=clone(draft);delete d.architecture.effects;commit(d,{action:'reset_effects'});};
$('detail-factor').onchange=()=>architectureValue('surfaceDetail.factor',Number($('detail-factor').value));
numeric('detail-margin',(n,record)=>architectureValue('surfaceDetail.marginMeters',n,record));numeric('detail-feather',(n,record)=>architectureValue('surfaceDetail.featherMeters',n,record));
$('detail-debug').onchange=drawPlan;
$('crowd-attendance').onchange=()=>{const mode=$('crowd-attendance').value;architectureValue('crowd.attendance',mode);setCrowdPlayback({visible:mode==='full'});};$('crowd-play').onchange=()=>setCrowdPlayback({paused:!$('crowd-play').checked});
$('crowd-play').checked=!crowd.inspect().paused;$('crowd-frames').onchange=()=>setCrowdPlayback($('crowd-frames').value==='223'?{frames:3,pattern:'223'}:{frames:Number($('crowd-frames').value),pattern:'uniform'});
for(const type of ['hit','home_run','out','error'])$('crowd-'+type).onclick=()=>reactCrowd({type,id:'preview-'+(++manualCrowdEvent)});
document.addEventListener('visibilitychange',()=>{setCrowdPlayback({hidden:document.hidden});setFireworkPlayback({hidden:document.hidden});flagLast=performance.now();flagTick();});
addEventListener('pagehide',()=>{stopTheme();clearTimeout(crowdFill);clearTimeout(crowdTimer);clearTimeout(fireworkTimer);clearTimeout(flagTimer);flagTimer=0;flagLast=performance.now();fireworkTimer=0;crowd.configure({hidden:true});fireworks.configure({hidden:true});});
addEventListener('pageshow',()=>{setCrowdPlayback({hidden:document.hidden});setFireworkPlayback({hidden:document.hidden});flagLast=performance.now();flagTick();});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{flagLast=performance.now();flagTick();});
$('add-point').onclick=()=>{const d=editableCopy(draft),points=[...d.fencePoints].sort((a,b)=>a.angleDegrees-b.angleDegrees),index=points.findIndex(p=>p.id===selected),
  a=points[Math.min(index,points.length-2)],b=points[Math.min(index+1,points.length-1)],angle=(a.angleDegrees+b.angleDegrees)/2;
  if(b.angleDegrees-a.angleDegrees<.004){message('点が近すぎます。別の区間を選んでください。');return;}
  let n=1;while(points.some(p=>p.id==='POINT_'+n))n++;const w=wallAt(geometry,angle*Math.PI/180),id='POINT_'+n;
  d.fencePoints.push({id,angleDegrees:angle,distanceMeters:w.distanceMeters,heightMeters:w.heightMeters});selected=id;commit(d,{action:'add_point'});};
$('remove-point').onclick=()=>{if(ANCHORS.some(a=>a.id===selected))return;const d=editableCopy(draft);d.fencePoints=d.fencePoints.filter(p=>p.id!==selected);selected='CF';commit(d,{action:'remove_point'});};
$('homerun-theme').hidden=!themeVersion;$('home-team').onchange=()=>{const value=$('home-team').value,d=editableCopy(draft);if(value)d.architecture.homeTeam=value;else delete d.architecture.homeTeam;commit(d);};
$('download').onclick=download;$('browser-save').onclick=save;
$('load-file').onchange=async()=>{const file=$('load-file').files[0];if(!file)return;try{if(file.size>1024*1024)throw Error('設計JSONは1MB以内にしてください');
  const raw=JSON.parse((await file.text()).replace(/^\uFEFF/,'')),r=apply(raw);if(!r.ok)throw Error(r.errors.map(e=>e.path+'：'+e.message).join('\n'));
  jsonDirty=false;sync();message('設計JSONを読み込みました。');}catch(e){message('読み込めません：'+e.message);}finally{$('load-file').value='';}};
function mode(ai){$('human-panel').hidden=ai;$('ai-panel').hidden=!ai;$('human-mode').setAttribute('aria-pressed',String(!ai));$('ai-mode').setAttribute('aria-pressed',String(ai));sync();}
$('human-mode').onclick=()=>mode(false);$('ai-mode').onclick=()=>mode(true);$('design-json').oninput=()=>{jsonDirty=true;$('json-error').textContent='未適用のJSONです。';};
$('apply-json').onclick=()=>{try{const r=apply(JSON.parse($('design-json').value));if(!r.ok)throw Error(r.errors.map(e=>e.path+'：'+e.message).join('\n'));jsonDirty=false;$('json-error').textContent='';sync();}
  catch(e){$('json-error').textContent=e.message;}};
$('cancel-json').onclick=()=>{jsonDirty=false;$('design-json').value=JSON.stringify(draft,null,2);$('json-error').textContent='';};
$('camera').onchange=()=>{activateCamera($('camera').value);sync();schedule();};
for(const id of ['camera-height','camera-x','camera-z','camera-yaw','camera-pitch'])$(id).oninput=()=>{const p=currentCamera();if(!p)return;const value=$(id).value===''?null:Number($(id).value);if(id==='camera-height')p.eye.y=value;else if(id==='camera-x')p.eye.x=value;else if(id==='camera-z')p.eye.z=value;else if(id==='camera-yaw')p.yawDegrees=value;else p.pitchDegrees=value;previewCamera(p);};
$('camera-register').onclick=registerCamera;$('camera-revert').onclick=revertCamera;$('camera-default').onclick=resetCamera;
$('zoom').oninput=()=>{const p=currentCamera();if(p)previewCamera({...p,zoom:Number($('zoom').value)});};
$('people').onchange=()=>{view.people=$('people').checked;schedule();};
$('roof-cutaway').onchange=()=>{const p=currentCamera();if(p)previewCamera({...p,roofCutaway:$('roof-cutaway').checked});};
$('reset-view').onclick=revertCamera;
let orbitDrag=null;$('preview').oncontextmenu=e=>e.preventDefault();$('preview').onpointerdown=e=>{if(e.button!==2)return;e.preventDefault();orbitDrag={x:e.clientX,y:e.clientY,orbit:view.orbit??{yaw:0,elevation:1.05}};$('preview').setPointerCapture(e.pointerId);};
$('preview').onpointermove=e=>{if(!orbitDrag)return;cameraInputError='';const p=currentCamera();if(p)cameraPending.set(cameraEditKey(),p);view.cameraPose=null;view.orbit={yaw:orbitDrag.orbit.yaw-(e.clientX-orbitDrag.x)*.006,elevation:Math.max(.12,Math.min(1.55,orbitDrag.orbit.elevation+(e.clientY-orbitDrag.y)*.004))};syncCameraEditor();schedule();};
$('preview').onpointerup=$('preview').onpointercancel=()=>{orbitDrag=null;};$('preview').addEventListener('wheel',e=>{e.preventDefault();const p=currentCamera();if(p)previewCamera({...p,zoom:Math.max(.4,Math.min(2.5,view.zoom*(e.deltaY>0?.95:1.05)))});},{passive:false});

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
  await w.KneekuraBallparkGroundLogoV2.prepare(BALLPARK_LOGO_DATA_URL);if(typeof BALLPARK_BOARD_IMAGE_DATA_URL==='string')await w.KneekuraBallparkNiikuraScoreboardV14.prepare(BALLPARK_BOARD_IMAGE_DATA_URL);if(typeof BALLPARK_PAYPAY_AD_DATA_URL==='string')await w.KneekuraBallparkSurfaceV3.preparePaypayAdvertisements(BALLPARK_PAYPAY_AD_DATA_URL);renderer=w.KneekuraBallparkRendererV1.install();ready=true;syncEffectsControls();log('ready');schedule();}
 catch(e){failure=e.message;$('render-status').textContent='読み込みエラー';message(e.message);}};
engine.srcdoc=BALLPARK_ENGINE_HTML;
