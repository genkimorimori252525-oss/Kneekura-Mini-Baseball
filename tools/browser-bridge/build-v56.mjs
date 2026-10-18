import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {patchV56Game} from './v56-live-presentation.mjs';
const outputDir=resolve(process.argv[2]??'../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex');
const basePath='docs/demos/releases/v55/game.html',base=await readFile(basePath);
if(sha(base)!=='02644793d8c6e41b66d5330fe37cc0ce8d2fa7756ad6bc139b045fbef38d3b17')throw Error('Frozen v55 SHA mismatch');
const core=await readFile('dist/native-match-core-browser.js'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
if(pins.entrySha256!==sha(core)||!base.includes(core))throw Error('Core differs from v55');
for(const [path,hash]of Object.entries(pins.inputs))if(sha(await readFile(path))!==hash)throw Error('Source input differs: '+path);
const helperNames=['live-ball-display-controls-v56.js','live-pitch-ball-cadence-v56.js','live-camera-tuning-batter-view-v56.js'];
const helpers=await Promise.all(helperNames.map(n=>readFile('tools/browser-bridge/'+n,'utf8')));
const driver=await readFile('tools/browser-bridge/camera-workbench-v56.js','utf8'),template=await readFile('tools/browser-bridge/camera-workbench-v56.html','utf8');
if([...helpers,driver].some(s=>s.includes('</script>')))throw Error('Unsafe inline script');
let game=base.toString('utf8');
const start=game.indexOf('<script id="v55-camera-tuning">'),end=game.indexOf('</script>',start)+9;
if(start<0||end<start||game.indexOf('<script id="v55-camera-tuning">',start+1)>=0)throw Error('Camera installation marker');
game=game.slice(0,start)+'<script id="v56-presentation-controls">\n'+helpers.join('\n')+
 '\nwindow.KneekuraContinuousBatterView=window.KneekuraCameraTuningBatterView.create();\n</script>'+game.slice(end);
game=patchV56Game(game);
if(!game.includes(core.toString('utf8')))throw Error('Core changed during transform');
const metadata={presentationVersion:56,sourceGamePath:'docs/demos/releases/v54/game.html',sourceGameSha256:'80c68e3ddb5c961ab6f18b325c6f267f883cd02d27381dfa10a9334bf8afae9f',
 basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreSha256:sha(core),sourceInputCount:Object.keys(pins.inputs).length,
 helpers:Object.fromEntries(helperNames.map((n,i)=>[n,sha(helpers[i])])),workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(template),
 transformSha256:sha(await readFile('tools/browser-bridge/v56-live-presentation.mjs')),worldAuthority:'UNCHANGED_V54_OFFLINE_HOST_SHARED_CORE',
 displayGridPixels:4,ordinaryCadenceMs:55,pitchBallCadenceMs:22,ballDisplayDefaults:{perspective:1,overhead:1},readOnlyCamera:true};
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Template marker '+a);return s.replace(a,()=>b);};
let lab=once(template,'__V56_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V56_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));
lab=once(lab,'__V56_WORKBENCH_DRIVER__',driver);
await mkdir(outputDir,{recursive:true});
const artifacts=[['ばせぼーるlv56_TBD_vs_LAD_投球描画と追従調整版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v56.html',lab,'CAMERA_WORKBENCH']];
for(const [name,html,kind]of artifacts){const path=resolve(outputDir,name);await writeFile(path,html);await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');}
await writeFile(resolve(outputDir,artifacts[0][0]+'.bundle-inputs.json'),pinsBytes);
console.log(JSON.stringify({pass:true,...metadata,artifacts:artifacts.map(([name,html,kind])=>({name,kind,sha256:sha(html)}))}));
