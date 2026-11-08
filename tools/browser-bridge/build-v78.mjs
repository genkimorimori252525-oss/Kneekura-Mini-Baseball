import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const out=resolve(process.argv[2]??'../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex'),
 basePath='docs/demos/releases/v77/game.html',base=await readFile(basePath),previous=JSON.parse(await readFile(basePath+'.build.json','utf8')),
 core=await readFile('dist/native-match-core-browser.js'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
if(sha(base)!=='58319352d3fd31465c0ada0dd48a60ebcc9431c9aba86783e48523b591248c21')throw Error('Frozen V77 differs');
if(pins.entrySha256!==sha(core)||sha(core)===previous.sourceCoreSha256)throw Error('Compile V78 Core first');
for(const[path,expected]of Object.entries(pins.inputs))if(sha(await readFile(path))!==expected)throw Error('Source changed after bundle: '+path);
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('V78 marker differs: '+a.slice(0,110));return s.replace(a,()=>b);};
let game=base.toString('utf8');
const oldCore=[...game.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var KneekuraNativeMatchCore ='))?.slice(0,-1);
if(!oldCore||sha(oldCore)!==previous.sourceCoreSha256||core.includes(Buffer.from('</script>')))throw Error('Core boundary differs');
game=once(game,oldCore,core.toString('utf8'));
const helpers={...previous.helpers};
for(const[name,expected]of Object.entries(helpers)){
 const bytes=await readFile('tools/browser-bridge/'+name);
 if(sha(bytes)!==expected||!game.includes(bytes.toString('utf8')))throw Error('Inherited helper differs: '+name);
 if(name==='live-ball-display-controls-v76.js'){
  const next=await readFile('tools/browser-bridge/live-ball-display-controls-v78.js','utf8');
  game=once(game,bytes.toString('utf8'),next);delete helpers[name];helpers['live-ball-display-controls-v78.js']=sha(next);
 }
}
const oldChart=await readFile('tools/browser-bridge/v38-live-pitch-chart.js','utf8'),chart=await readFile('tools/browser-bridge/live-pitch-chart-v78.js','utf8');
game=once(game,oldChart,chart);helpers['live-pitch-chart-v78.js']=sha(chart);
const oldSizing=/const baseDisplayDiameterPx=unscaledDisplayDiameterPx\*displayScale,[\s\S]*?heightMultiplier=displayD\/baseDisplayDiameterPx,r=displayD\/2;/g;
if([...game.matchAll(oldSizing)].length!==1)throw Error('Ball projection owner differs');
game=game.replace(oldSizing,()=>`const baseDisplayDiameterPx=unscaledDisplayDiameterPx*displayScale,
   heightSettings=window.KneekuraBallDisplayControls.inspect(),
   heightEnabled=ballCamera==='overhead'&&(heightSettings.overheadHeightModel==='VIRTUAL_HEIGHT_V1'?kind==='batted':heightSettings.overheadHeightEmphasis>1),
   groundPoint=heightEnabled?projectBallView({x:ball.position.x,y:window.KneekuraBallDisplayControls.heightModel.groundCenterMeters,z:ball.position.z},ballCam):null,
   groundProjectedDiameterPx=groundPoint?2*.0366*groundPoint.scale:realD,
   groundOpticalDiameterPx=groundPoint?visualBallDiameter(groundProjectedDiameterPx,ballCamera,kind):opticalD,
   groundDisplayDiameterPx=groundPoint?(ball.sourceObservation?Math.max(1.25,groundOpticalDiameterPx):groundOpticalDiameterPx):unscaledDisplayDiameterPx,
   heightSizing=heightEnabled&&groundPoint?window.KneekuraBallDisplayControls.heightSizingForProjection({camera:ballCamera,kind,position:ball.position,projection:ballCam,groundDisplayDiameterPx,legacyDisplayDiameterPx:unscaledDisplayDiameterPx}):{diameterPx:unscaledDisplayDiameterPx,physicalHeightRatio:1},
   displayD=heightEnabled&&groundPoint?heightSizing.diameterPx*displayScale:baseDisplayDiameterPx,
   heightMultiplier=displayD/baseDisplayDiameterPx,r=displayD/2;`);
game=once(game,'heightMultiplier,baseDisplayDiameterPx','heightMultiplier,heightModel:heightSettings.overheadHeightModel,virtualHeightMeters:heightSizing.virtualHeightMeters??null,virtualProjectionRatio:heightSizing.virtualProjectionRatio??null,heightClamped:heightSizing.clamped??false,baseDisplayDiameterPx');
game=once(game,"function setBallDisplay(patch){const s=", "function setBallDisplay(patch){if(Object.hasOwn(patch,'overheadHeightEmphasis')&&!Object.hasOwn(patch,'overheadHeightModel'))patch={...patch,overheadHeightModel:'VIRTUAL_HEIGHT_V1'};const s=");
game=once(game,'俯瞰：空中のボールの倍率','俯瞰：高さの遠近感');
game=once(game,'id="ball-scale-reset">表示を初期値へ</button><p>','id="ball-scale-reset">表示を初期値へ</button><p id="ball-height-model-status" aria-live="polite"></p><p>');
game=once(game,"function syncBallDisplay(){const s=window.KneekuraBallDisplayControls.inspect();", "function syncBallDisplay(){const s=window.KneekuraBallDisplayControls.inspect();const status=$('ball-height-model-status');if(status)status.textContent=s.overheadHeightModel==='LEGACY_DIAMETER_V4'?'読み込んだ設定は旧方式（直径倍率）です。高さの値を変更すると新方式へ切り替わります。':'高さの遠近感：地面からの高さを指定倍にしてサイズを投影しています。';");
game=once(game,'空中用の倍率は、地面付近の球やゴロの浅い跳ねにはかかりません。球の下端が地上0.5mまでは元のサイズ、0.5〜1.5mで空中用の表示へ滑らかにつなぎます。初期値2。1で従来表示、1〜2では最小表示サイズとの連続性を保つため基準サイズも補間します。2以上では高い球へ指定倍率をかけます。物理は変わりません。',
 '地面からの高さを、サイズ計算時だけ指定倍として投影します。2mの球は設定2で4m相当のサイズ。表示位置・物理は変えず、接地球・投球・送球・他視点は維持します。旧方式の設定は数値を変更すると新方式に切り替わります。初期2。');
// Keep the selected pitch's identity apart from its classification. Old UI aliases stay intact.
game=once(game,"const command=()=>({batting:$('batting-choice').value,pitchType:pitchModels[$('pitch-choice').value]??$('pitch-choice').value,\r\n  location:$('location-choice').value,managedTeam:Number($('managed-team').value),baserunning:$('baserunning-choice').value});",
 `const legacyPitchMenu=[...$('pitch-choice').options].map(o=>({value:o.value,label:o.textContent}));let pitchMenuIdentity=null;
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
  return {batting:$('batting-choice').value,pitchType:row?.pitchType??pitchModels[selected]??selected,...(row?{pitchId:row.pitchId}:{}),
   location:$('location-choice').value,managedTeam:Number($('managed-team').value),baserunning:$('baserunning-choice').value};};`);
game=once(game,'function draw(){\r\n  const result=activeResult(),state=host.inspect();','function draw(){\r\n  syncPitchMenuV78();const result=activeResult(),state=host.inspect();');
game=once(game,'(pitchNames[result.pitchType]??result.pitchType)','(result.pitchName??pitchNames[result.pitchType]??result.pitchType)');
for(const[a,b]of[
 ['id="v77-presentation-controls"','id="v78-presentation-controls"'],['presentationVersion:77','presentationVersion:78'],['version:77,authority:','version:78,authority:'],
 ['投手調整と独立得能版 77</title>','球種と縫い目物理版 78</title>'],['投手調整と独立得能版 77','球種と縫い目物理版 78'],
])game=once(game,a,b);
const driverPath='tools/browser-bridge/camera-workbench-v78.js',templatePath='tools/browser-bridge/camera-workbench-v78.html',
 driver=await readFile(driverPath,'utf8'),template=await readFile(templatePath,'utf8'),metadata={...previous,
 presentationVersion:78,basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreSha256:sha(core),sourceInputCount:Object.keys(pins.inputs).length,
 helpers,ballDynamicsChanged:true,pitchCatalogConnected:true,pitchLibraryConnected:true,spinRepeatabilityConnected:true,seamForceConnected:true,
 ballDisplayOnlyChanged:false,overheadProjectionOnlyChanged:true,compatibleSessionCoreSha256:[],sessionMigration:'V78_CORE_REJECT_OLDER_REPLAY_SESSIONS_KEEP_SETTINGS_MODEL',
 ballDisplayDefaults:{perspective:1,overhead:1,overheadHeightEmphasis:2,overheadHeightModel:'VIRTUAL_HEIGHT_V1'},
 overheadHeightCue:{basis:'VIRTUAL_VERTICAL_WORLD_HEIGHT',groundCenterMeters:.0366,maximumProjectionRatio:16,camera:'overhead',ballKind:'batted',sourcePhysicsChanged:false},
 pitcherWorkbench:{...previous.pitcherWorkbench,pitchTypes:15,pitchIdentitySeparateFromType:true,spinRatioScope:'ACTUAL_RELEASE_AFTER_NOMINAL_AIM'},
 workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(template),builderSha256:sha(await readFile('tools/browser-bridge/build-v78.mjs'))};
delete metadata.kind;delete metadata.sha256;delete metadata.airBallDisplay;
let lab=once(template,'__V73_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V73_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));lab=once(lab,'__V73_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});
for(const[name,html,kind]of[['ばせぼーるlv78_TBD_vs_LAD_球種と縫い目物理版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v78.html',lab,'CAMERA_WORKBENCH']]){
 if(Buffer.byteLength(html)>=100_000_000)throw Error('HTML exceeds GitHub limit');const path=resolve(out,name);
 await writeFile(path,html);await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');
 if(kind==='NORMAL_MATCH')await writeFile(path+'.bundle-inputs.json',pinsBytes);
 console.log(JSON.stringify({path,kind,sha256:sha(html),sourceInputs:Object.keys(pins.inputs).length}));
}
