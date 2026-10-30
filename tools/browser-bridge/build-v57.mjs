import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const outputDir=resolve(process.argv[2]??'../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex');
const basePath='docs/demos/releases/v56/game.html',base=await readFile(basePath);
if(sha(base)!=='331f5f9a3bafb78ba2ae5009ba25fb795eeb08d5f42c85db3844c2d186ec32c5')throw Error('Frozen v56 SHA mismatch');
const core=await readFile('dist/native-match-core-browser.js'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
if(pins.entrySha256!==sha(core)||!base.includes(core))throw Error('Core differs from v56');
for(const [path,hash]of Object.entries(pins.inputs))if(sha(await readFile(path))!==hash)throw Error('Source input differs: '+path);
const helperNames=['live-ball-display-controls-v56.js','live-pitch-ball-cadence-v56.js','live-camera-tuning-batter-view-v57.js'];
const helpers=await Promise.all(helperNames.map(n=>readFile('tools/browser-bridge/'+n,'utf8'))),oldHelper=await readFile('tools/browser-bridge/live-camera-tuning-batter-view-v56.js','utf8');
const driver=await readFile('tools/browser-bridge/camera-workbench-v57.js','utf8'),template=await readFile('tools/browser-bridge/camera-workbench-v57.html','utf8');
if([...helpers,driver].some(s=>s.includes('</script>')))throw Error('Unsafe inline script');
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('v57 marker '+a.slice(0,100));return s.replace(a,()=>b);};
let game=once(base.toString('utf8'),oldHelper,helpers[2]);
for(const [a,b]of [['id="v56-presentation-controls"','id="v57-presentation-controls"'],['presentationVersion:56','presentationVersion:57'],['version:56,authority:','version:57,authority:'],['投球描画と追従調整版 56</title>','スイング時の頭固定版 57</title>'],['投球描画と追従調整版 56','スイング時の頭固定版 57']])game=once(game,a,b);
if(!game.includes(core.toString('utf8')))throw Error('Core changed during transform');
const metadata={presentationVersion:57,sourceGamePath:'docs/demos/releases/v54/game.html',sourceGameSha256:'80c68e3ddb5c961ab6f18b325c6f267f883cd02d27381dfa10a9334bf8afae9f',
 basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreSha256:sha(core),sourceInputCount:Object.keys(pins.inputs).length,
 helpers:Object.fromEntries(helperNames.map((n,i)=>[n,sha(helpers[i])])),workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(template),
 builderSha256:sha(await readFile('tools/browser-bridge/build-v57.mjs')),worldAuthority:'UNCHANGED_V54_OFFLINE_HOST_SHARED_CORE',
 displayGridPixels:4,ordinaryCadenceMs:55,pitchBallCadenceMs:22,ballDisplayDefaults:{perspective:1,overhead:1},readOnlyCamera:true,
 headHold:'REGISTERED_MEASURED_BAT_ONSET_TO_THROUGH_WITH_OBSERVED_HIT_WAIT',preset:{enabled:true,aimLiftMeters:.30,swingMaxDownRadians:.20,hitFollowDelayMs:300,aimReleaseMs:70,pitchTrackingGain:.26,pitchTrackingDeadbandRadians:.02}};
let lab=once(template,'__V57_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V57_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));
lab=once(lab,'__V57_WORKBENCH_DRIVER__',driver);
await mkdir(outputDir,{recursive:true});
const artifacts=[['ばせぼーるlv57_TBD_vs_LAD_スイング時の頭固定版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v57.html',lab,'CAMERA_WORKBENCH']];
for(const [name,html,kind]of artifacts){const path=resolve(outputDir,name);await writeFile(path,html);await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');}
await writeFile(resolve(outputDir,artifacts[0][0]+'.bundle-inputs.json'),pinsBytes);
console.log(JSON.stringify({pass:true,...metadata,artifacts:artifacts.map(([name,html,kind])=>({name,kind,sha256:sha(html)}))}));
