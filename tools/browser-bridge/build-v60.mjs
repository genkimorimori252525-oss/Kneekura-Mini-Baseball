import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {applyNamePresentationV60} from './name-presentation-v60.mjs';
const outputDir=resolve(process.argv[2]??'../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex');
const basePath='docs/demos/releases/v59/game.html',base=await readFile(basePath);
if(sha(base)!=='41d7f56a4e30b4a0f41706e67512f8745d6bace5244fe4e7f4eb032132134d9e')throw Error('Frozen v59 SHA mismatch');
const core=await readFile('dist/native-match-core-browser.js'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
if(pins.entrySha256!==sha(core)||!base.includes(core))throw Error('Core differs from v59');
for(const [path,hash]of Object.entries(pins.inputs))if(sha(await readFile(path))!==hash)throw Error('Source input differs: '+path);
const helperNames=['live-ball-display-controls-v56.js','live-pitch-ball-cadence-v56.js','live-camera-tuning-batter-view-v60.js','live-pitcher-reaction-view-v58.js','live-name-display-controls-v60.js'];
const helpers=await Promise.all(helperNames.map(n=>readFile('tools/browser-bridge/'+n,'utf8'))),oldHelper=await readFile('tools/browser-bridge/live-camera-tuning-batter-view-v59.js','utf8');
const driver=await readFile('tools/browser-bridge/camera-workbench-v60.js','utf8'),template=await readFile('tools/browser-bridge/camera-workbench-v60.html','utf8');
if([...helpers,driver].some(s=>s.includes('</script>')))throw Error('Unsafe inline script');
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('v60 marker '+a.slice(0,100));return s.replace(a,()=>b);};
let game=applyNamePresentationV60(once(base.toString('utf8'),oldHelper,helpers[2]+'\n'+helpers[4]));
for(const [a,b]of [['id="v59-presentation-controls"','id="v60-presentation-controls"'],['presentationVersion:59','presentationVersion:60'],['version:59,authority:','version:60,authority:'],['打点注視と微動安定版 59</title>','視線と名前調整版 60</title>'],['打点注視と微動安定版 59','視線と名前調整版 60']])game=once(game,a,b);
if(!game.includes(core.toString('utf8')))throw Error('Core changed during transform');
const metadata={presentationVersion:60,sourceGamePath:'docs/demos/releases/v54/game.html',sourceGameSha256:'80c68e3ddb5c961ab6f18b325c6f267f883cd02d27381dfa10a9334bf8afae9f',
 basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreSha256:sha(core),sourceInputCount:Object.keys(pins.inputs).length,
 helpers:Object.fromEntries(helperNames.map((n,i)=>[n,sha(helpers[i])])),workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(template),
 nameTransformSha256:sha(await readFile('tools/browser-bridge/name-presentation-v60.mjs')),builderSha256:sha(await readFile('tools/browser-bridge/build-v60.mjs')),
 worldAuthority:'UNCHANGED_V54_OFFLINE_HOST_SHARED_CORE',displayGridPixels:4,ordinaryCadenceMs:55,pitchBallCadenceMs:22,
 ballDisplayDefaults:{perspective:1,overhead:1},nameDisplayDefaults:{scale:1},readOnlyCamera:true,
 pitcherReaction:{minimumDelaySeconds:.1,maximumDelaySeconds:.25,speedScaleMeters:7,blendMs:180},
 headHold:'REGISTERED_INTENT_ACQUIRE_ADJUSTABLE_EXPECTED_IMPACT_STABILIZATION',
 preset:{enabled:true,aimLiftMeters:.30,swingMaxDownRadians:.20,hitFollowDelayMs:300,aimReleaseMs:70,pitchTrackingGain:.26,pitchTrackingDeadbandRadians:.02,
 impactStabilizeOffsetMs:0,impactMaxMotionRadians:.025,impactMaxSpeedRadPerSecond:.18}};
let lab=once(template,'__V60_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V60_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));
lab=once(lab,'__V60_WORKBENCH_DRIVER__',driver);
await mkdir(outputDir,{recursive:true});
for(const [name,html,kind]of [['ばせぼーるlv60_TBD_vs_LAD_視線と名前調整版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v60.html',lab,'CAMERA_WORKBENCH']]){
 const path=resolve(outputDir,name);await writeFile(path,html);await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');
 if(kind==='NORMAL_MATCH')await writeFile(path+'.bundle-inputs.json',pinsBytes);
 console.log(JSON.stringify({kind,path,sha256:sha(html),sourceInputs:Object.keys(pins.inputs).length}));
}
