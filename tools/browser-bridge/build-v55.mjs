import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const outputDir=resolve(process.argv[2]??'../../outputs'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourcePath='docs/demos/releases/v54/game.html',source=await readFile(sourcePath),sourceGameSha256=sha(source);
if(sourceGameSha256!=='80c68e3ddb5c961ab6f18b325c6f267f883cd02d27381dfa10a9334bf8afae9f')throw Error('Frozen v54 match SHA mismatch');
const coreBytes=await readFile('dist/native-match-core-browser.js'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
if(pins.entrySha256!==sha(coreBytes)||!source.includes(coreBytes))throw Error('Current Core differs from frozen v54');
for(const [path,hash]of Object.entries(pins.inputs))if(sha(await readFile(path))!==hash)throw Error('Source input differs: '+path);
const helper=await readFile('tools/browser-bridge/live-camera-tuning-batter-view.js','utf8'),driver=await readFile('tools/browser-bridge/camera-workbench-v55.js','utf8'),template=await readFile('tools/browser-bridge/camera-workbench-v55.html','utf8');
if(helper.includes('</script>')||driver.includes('</script>'))throw Error('Unsafe inline script');
function once(text,from,to){if(text.split(from).length!==2)throw Error('v55 build marker: '+from);return text.replace(from,()=>to);}
const installation='<script id="v55-camera-tuning">\n'+helper+'\nwindow.KneekuraCameraLabLegacyObserver=window.KneekuraContinuousBatterView;\nwindow.KneekuraContinuousBatterView=window.KneekuraCameraTuningBatterView.create();\n</script>\n';
let game=once(source.toString('utf8'),'<script id="v43-batter-gaze">',installation+'<script id="v43-batter-gaze">');
game=once(game,'<title>Kneekura Mini Baseball — TBD対LAD 剛体バット描画版 31</title>','<title>Kneekura Mini Baseball — TBD対LAD カメラ追尾調整版 55</title>');
game=once(game,'presentationVersion:54','presentationVersion:55');
game=once(game,'得能と個人采配接続版 54','打球追尾調整版 55');
game=once(game,'version:54,authority:', 'version:55,authority:');
const metadata={presentationVersion:55,workbenchRevision:1,sourceGamePath:sourcePath,sourceGameSha256,sourceCoreSha256:sha(coreBytes),sourceInputCount:Object.keys(pins.inputs).length,
 cameraHelperSha256:sha(helper),workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(template),worldAuthority:'UNCHANGED_V54_OFFLINE_HOST_SHARED_CORE',
 displayGridPixels:4,ordinaryCadenceMs:55,readOnlyCamera:true};
let lab=once(template,'__V55_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V55_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));
lab=once(lab,'__V55_WORKBENCH_DRIVER__',driver);
await mkdir(outputDir,{recursive:true});
const artifacts=[['ばせぼーるlv55_TBD_vs_LAD_打球追尾調整版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v55.html',lab,'CAMERA_WORKBENCH'],['カメラワーク調整室_v55_1.html',lab,'CAMERA_WORKBENCH']];
for(const [name,html,kind]of artifacts){const path=resolve(outputDir,name);await writeFile(path,html);await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');}
await writeFile(resolve(outputDir,'ばせぼーるlv55_TBD_vs_LAD_打球追尾調整版.html.bundle-inputs.json'),pinsBytes);
console.log(JSON.stringify({pass:true,...metadata,artifacts:artifacts.map(([name,html,kind])=>({name,kind,sha256:sha(html)}))}));
