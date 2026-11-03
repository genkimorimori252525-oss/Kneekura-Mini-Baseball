import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import vm from 'node:vm';

const out=resolve(process.argv[2]??'../../outputs'),sha=bytes=>createHash('sha256').update(bytes).digest('hex'),
 basePath='docs/demos/releases/v75/game.html',base=await readFile(basePath),
 previous=JSON.parse(await readFile(basePath+'.build.json','utf8')),
 pinsBytes=await readFile(basePath+'.bundle-inputs.json'),pins=JSON.parse(pinsBytes),
 core=await readFile('dist/native-match-core-browser.js');
if(sha(base)!=='2482dbaa0ae61d91ec50d8dedac1a391c031498c89b26b970fc370d23ae2b365')throw Error('Frozen v75 game differs');
if(sha(core)!==previous.sourceCoreSha256||sha(core)!==pins.entrySha256)throw Error('Display-only fix requires unchanged v75 Core');
for(const [path,expected]of Object.entries(pins.inputs))if(sha(await readFile(path))!==expected)throw Error('v75 Source changed: '+path);
const once=(text,before,after)=>{
 if(text.split(before).length!==2)throw Error('v76 marker differs: '+before.slice(0,90));
 return text.replace(before,()=>after);
};
let game=base.toString('utf8');
const oldName='live-ball-display-controls-v67.js',newName='live-ball-display-controls-v76.js',
 replacement=await readFile('tools/browser-bridge/'+newName,'utf8'),helpers={...previous.helpers};
for(const [name,expected]of Object.entries(helpers)){
 const bytes=await readFile('tools/browser-bridge/'+name);
 if(sha(bytes)!==expected||!game.includes(bytes.toString('utf8')))throw Error('Inherited presentation helper differs: '+name);
 if(name===oldName)game=once(game,bytes.toString('utf8'),replacement);
}
if(!Object.hasOwn(helpers,oldName)||replacement.includes('</script>'))throw Error('Ball helper replacement invalid');
delete helpers[oldName];helpers[newName]=sha(replacement);
const displayRealm={};vm.runInNewContext(replacement,displayRealm);
const oldHelp='初期値2：空中の球の基準サイズ自体を2倍に描きます。地面の球は従来のまま、接地付近だけ滑らかにつなぎます。1で従来表示。物理は変わりません。',
 newHelp='空中用の倍率は、地面付近の球やゴロの浅い跳ねにはかかりません。球の下端が地上0.5mまでは元のサイズ、0.5〜1.5mで空中用の表示へ滑らかにつなぎます。初期値2。1で従来表示、1〜2では最小表示サイズとの連続性を保つため基準サイズも補間します。2以上では高い球へ指定倍率をかけます。物理は変わりません。';
for(const [before,after]of[
 ['id="v75-presentation-controls"','id="v76-presentation-controls"'],
 ['presentationVersion:75','presentationVersion:76'],['version:75,authority:','version:76,authority:'],
 ['技術得能接続版 75</title>','空中球とゴロの表示分離版 76</title>'],
 ['技術得能接続版 75','空中球とゴロの表示分離版 76'],[oldHelp,newHelp],
])game=once(game,before,after);
const driverPath='tools/browser-bridge/camera-workbench-v73.js',templatePath='tools/browser-bridge/camera-workbench-v73.html',
 driver=await readFile(driverPath,'utf8'),template=await readFile(templatePath,'utf8'),
 metadata={...previous,presentationVersion:76,basePresentationPath:basePath,basePresentationSha256:sha(base),helpers,
  sourceCoreChanged:false,ballDynamicsRulesAiChanged:false,ballDynamicsChanged:false,rulesChanged:false,
  techniqueExecutionChanged:false,batTrajectoryAuthoringChanged:false,ballDisplayOnlyChanged:true,
  workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(template),builderSha256:sha(await readFile('tools/browser-bridge/build-v76.mjs')),
  overheadHeightCue:{...displayRealm.KneekuraBallDisplayControls.heightModel,default:2,minimum:1,maximum:8},
  airBallDisplay:{groundProtectedClearanceMeters:.5,airFullClearanceMeters:1.5,
   multiplierOneContinuous:true,defaultAndHighAirAtTwoAndAbovePreserved:true,physicsChanged:false}};
delete metadata.sha256;delete metadata.kind;
let lab=once(once(template.replace(/v73/g,'v76'),oldHelp,newHelp),'__V73_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V73_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));
lab=once(lab,'__V73_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});
for(const [name,html,kind]of[
 ['ばせぼーるlv76_TBD_vs_LAD_空中球とゴロの表示分離版.html',game,'NORMAL_MATCH'],
 ['カメラワーク調整室_v76.html',lab,'CAMERA_WORKBENCH'],
]){
 if(Buffer.byteLength(html)>=100_000_000)throw Error('HTML exceeds single-file limit');
 const path=resolve(out,name);
 await writeFile(path,html);await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');
 if(kind==='NORMAL_MATCH')await writeFile(path+'.bundle-inputs.json',pinsBytes);
 console.log(JSON.stringify({kind,path,sha256:sha(html),bytes:Buffer.byteLength(html),sourceCoreChanged:false}));
}
