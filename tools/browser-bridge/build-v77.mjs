import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]??'../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex'),
 basePath='docs/demos/releases/v76/game.html',base=await readFile(basePath),previous=JSON.parse(await readFile(basePath+'.build.json','utf8')),
 core=await readFile('dist/native-match-core-browser.js'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
if(sha(base)!=='b21d25b7811fba44f8e5d09cbedb39099cc9454d9ebf0366c0ed9799fb66efcd')throw Error('Frozen v76 differs');
if(pins.entrySha256!==sha(core)||sha(core)===previous.sourceCoreSha256)throw Error('Compile the V77 Core first');
for(const[path,expected]of Object.entries(pins.inputs))if(sha(await readFile(path))!==expected)throw Error('Source changed after bundle: '+path);
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('V77 marker differs: '+a.slice(0,100));return s.replace(a,()=>b);};
let game=base.toString('utf8');
const oldCore=[...game.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var KneekuraNativeMatchCore ='))?.slice(0,-1);
if(!oldCore||sha(oldCore)!==previous.sourceCoreSha256||core.includes(Buffer.from('</script>')))throw Error('Core replacement boundary differs');
game=once(game,oldCore,core.toString('utf8'));
const helpers={...previous.helpers},oldName='live-pitcher-body-head-view-v62.js',newName='live-pitcher-body-head-view-v77.js';
for(const[name,expected]of Object.entries(helpers)){
 const bytes=await readFile('tools/browser-bridge/'+name);
 if(sha(bytes)!==expected||!game.includes(bytes.toString('utf8')))throw Error('Inherited helper differs: '+name);
 if(name===oldName){const next=await readFile('tools/browser-bridge/'+newName,'utf8');game=once(game,bytes.toString('utf8'),next);delete helpers[oldName];helpers[newName]=sha(next);}
}
game=once(game,'const timing=Object.freeze({preparationMs:28*55,', 'const timingDefaults=Object.freeze({preparationMs:28*55,');
game=once(game,'thirdOutMs:3000,foulMs:5000});', 'thirdOutMs:3000,foulMs:5000});\n const timing=Object.freeze({...timingDefaults,get preparationMs(){return activeResult()?.play.diagnostics.pitchingMotion?.preparationMs??timingDefaults.preparationMs;}});');
game=once(game,'height:players.find(configured=>configured.playerId===player.id)?.heightMeters??player.height}]))',
 'height:players.find(configured=>configured.playerId===player.id)?.heightMeters??player.height,throws:players.find(configured=>configured.playerId===player.id)?.throws??player.throws}]))');
for(const[a,b]of[
 ['id="v76-presentation-controls"','id="v77-presentation-controls"'],['presentationVersion:76','presentationVersion:77'],['version:76,authority:','version:77,authority:'],
 ['空中球とゴロの表示分離版 76</title>','投手調整と独立得能版 77</title>'],['空中球とゴロの表示分離版 76','投手調整と独立得能版 77'],
])game=once(game,a,b);
const driverPath='tools/browser-bridge/camera-workbench-v73.js',templatePath='tools/browser-bridge/camera-workbench-v73.html',
 driver=await readFile(driverPath,'utf8'),template=await readFile(templatePath,'utf8'),
 metadata={...previous,presentationVersion:77,basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreSha256:sha(core),
  sourceInputCount:Object.keys(pins.inputs).length,helpers,sourceCoreChanged:true,ballDynamicsRulesAiChanged:true,ballDynamicsChanged:false,rulesChanged:false,
  techniqueExecutionChanged:true,batTrajectoryAuthoringChanged:false,independentTraitsConnected:true,pitcherWorkbenchConnected:true,
  ballDisplayOnlyChanged:false,compatibleSessionCoreSha256:[],sessionMigration:'V77_CORE_REJECT_OLDER_REPLAY_SESSIONS',
  workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(template),builderSha256:sha(await readFile('tools/browser-bridge/build-v77.mjs')),
  independentTraits:{profileVersion:2,publicAndBasePhysicalUnchanged:true,legacyV1ReaderPreserved:true,legacyThrowNotInferred:true,effectScale:[0,2]},
  pitcherWorkbench:{pitchTypes:7,optionalRepertoire:true,spinSource:'SI_VECTOR',breakReference:'SAME_INITIAL_STATE_NO_SPIN_AT_PLATE',motionSource:'AUTHORED_NOT_MEASURED'},
 };
delete metadata.kind;delete metadata.sha256;
const oldHelp='初期値2：空中の球の基準サイズ自体を2倍に描きます。地面の球は従来のまま、接地付近だけ滑らかにつなぎます。1で従来表示。物理は変わりません。',
 newHelp='空中用の倍率は地面付近の球にかかりません。球の下端が地上0.5mまでは元のサイズ、0.5〜1.5mで空中表示へつなぎます。初期値2。1は従来表示、1〜2では基準サイズも補間します。物理は変わりません。';
let lab=once(once(template.replace(/v73/g,'v77'),oldHelp,newHelp),'__V73_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V73_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));lab=once(lab,'__V73_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});
for(const[name,html,kind]of[['ばせぼーるlv77_TBD_vs_LAD_投手調整と独立得能版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v77.html',lab,'CAMERA_WORKBENCH']]){
 if(Buffer.byteLength(html)>=100_000_000)throw Error('HTML exceeds GitHub limit');
 const path=resolve(out,name);await writeFile(path,html);await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');
 if(kind==='NORMAL_MATCH')await writeFile(path+'.bundle-inputs.json',pinsBytes);
 console.log(JSON.stringify({path,kind,sha256:sha(html),sourceInputs:Object.keys(pins.inputs).length}));
}
