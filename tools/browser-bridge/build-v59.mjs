import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const outputDir=resolve(process.argv[2]??'../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex');
const basePath='docs/demos/releases/v58/game.html',base=await readFile(basePath);
if(sha(base)!=='89a0ba3c52bd0299e5b9bb3c853cae48185493d48179339e523c25e0dd1b52ed')throw Error('Frozen v58 SHA mismatch');
const core=await readFile('dist/native-match-core-browser.js'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
if(pins.entrySha256!==sha(core)||!base.includes(core))throw Error('Core differs from v58');
for(const [path,hash]of Object.entries(pins.inputs))if(sha(await readFile(path))!==hash)throw Error('Source input differs: '+path);
const helperNames=['live-ball-display-controls-v56.js','live-pitch-ball-cadence-v56.js','live-camera-tuning-batter-view-v59.js','live-pitcher-reaction-view-v58.js'];
const helpers=await Promise.all(helperNames.map(n=>readFile('tools/browser-bridge/'+n,'utf8'))),oldHelper=await readFile('tools/browser-bridge/live-camera-tuning-batter-view-v57.js','utf8');
const driver=await readFile('tools/browser-bridge/camera-workbench-v59.js','utf8'),template=await readFile('tools/browser-bridge/camera-workbench-v59.html','utf8');
if([...helpers,driver].some(s=>s.includes('</script>')))throw Error('Unsafe inline script');
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('v59 marker '+a.slice(0,100));return s.replace(a,()=>b);};
let game=once(base.toString('utf8'),oldHelper,helpers[2]);
for(const [a,b]of [['id="v57-presentation-controls"','id="v59-presentation-controls"'],['presentationVersion:58','presentationVersion:59'],['version:58,authority:','version:59,authority:'],['投手追尾待機短縮版 58</title>','打点注視と微動安定版 59</title>'],['投手追尾待機短縮版 58','打点注視と微動安定版 59']])game=once(game,a,b);
if(!game.includes(core.toString('utf8')))throw Error('Core changed during transform');
const metadata={presentationVersion:59,sourceGamePath:'docs/demos/releases/v54/game.html',sourceGameSha256:'80c68e3ddb5c961ab6f18b325c6f267f883cd02d27381dfa10a9334bf8afae9f',
 basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreSha256:sha(core),sourceInputCount:Object.keys(pins.inputs).length,
 helpers:Object.fromEntries(helperNames.map((n,i)=>[n,sha(helpers[i])])),workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(template),
 builderSha256:sha(await readFile('tools/browser-bridge/build-v59.mjs')),worldAuthority:'UNCHANGED_V54_OFFLINE_HOST_SHARED_CORE',
 displayGridPixels:4,ordinaryCadenceMs:55,pitchBallCadenceMs:22,ballDisplayDefaults:{perspective:1,overhead:1},readOnlyCamera:true,
 pitcherReaction:{minimumDelaySeconds:.1,maximumDelaySeconds:.25,speedScaleMeters:7,blendMs:180},headHold:'REGISTERED_INTENT_ACQUIRE_EXPECTED_IMPACT_STABILIZATION',impactConeRadians:.025,impactSpeedRadPerSecond:.18,preset:{enabled:true,aimLiftMeters:.30,swingMaxDownRadians:.20,hitFollowDelayMs:300,aimReleaseMs:70,pitchTrackingGain:.26,pitchTrackingDeadbandRadians:.02}};
let lab=once(template,'__V59_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V59_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));
lab=once(lab,'__V59_WORKBENCH_DRIVER__',driver);
await mkdir(outputDir,{recursive:true});
const artifacts=[['ばせぼーるlv59_TBD_vs_LAD_打点注視と微動安定版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v59.html',lab,'CAMERA_WORKBENCH']];
for(const [name,html,kind]of artifacts){const path=resolve(outputDir,name);await writeFile(path,html);await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');}
await writeFile(resolve(outputDir,artifacts[0][0]+'.bundle-inputs.json'),pinsBytes);
console.log(JSON.stringify({pass:true,...metadata,artifacts:artifacts.map(([name,html,kind])=>({name,kind,sha256:sha(html)}))}));
