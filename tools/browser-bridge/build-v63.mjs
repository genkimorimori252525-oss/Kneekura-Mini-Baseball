import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]??'../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex'),
 basePath='docs/demos/releases/v62/game.html',base=await readFile(basePath),
 core=await readFile('dist/native-match-core-browser.js'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
if(sha(base)!=='e035ca5fa575ee3528c3f029353419a4a92fe0d2e94e96417494a083cf02a8fc')throw Error('Frozen v62 SHA mismatch');
if(sha(core)!=='865078dc9881ce5c37754dbe2c7b502f586206f3ada972cfe2d3368207720c00'||pins.entrySha256!==sha(core))throw Error('v63 must preserve v62 Core');
for(const [p,h]of Object.entries(pins.inputs))if(sha(await readFile(p))!==h)throw Error('Source changed after bundle: '+p);
let game=base.toString('utf8');if(!game.includes(core.toString('utf8')))throw Error('Frozen Core not embedded');
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('v63 marker '+a.slice(0,100));return s.replace(a,()=>b);};
const names=['live-ball-display-controls-v56.js','live-pitch-ball-cadence-v56.js','live-camera-tuning-batter-view-v63.js',
 'live-pitcher-reaction-view-v62.js','live-name-display-controls-v60.js','live-pitcher-body-head-view-v62.js'],
 helpers=await Promise.all(names.map(n=>readFile('tools/browser-bridge/'+n,'utf8')));
game=once(game,await readFile('tools/browser-bridge/live-camera-tuning-batter-view-v61.js','utf8'),helpers[2]);
for(const [a,b]of [['id="v62-presentation-controls"','id="v63-presentation-controls"'],['presentationVersion:62','presentationVersion:63'],['version:62,authority:','version:63,authority:'],['投手視点とリリース版 62</title>','打者の身体連動版 63</title>'],['投手視点とリリース版 62','打者の身体連動版 63']])game=once(game,a,b);
const driver=await readFile('tools/browser-bridge/camera-workbench-v63.js','utf8'),template=await readFile('tools/browser-bridge/camera-workbench-v63.html','utf8'),
 inherited=JSON.parse(await readFile('docs/demos/releases/v62/game.html.build.json','utf8'));
if([...helpers,driver].some(s=>s.includes('</script>')))throw Error('Unsafe inline script');
const metadata={...inherited,presentationVersion:63,basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreSha256:sha(core),
 compatibleSessionCoreSha256:[],sessionMigration:'SAME_V62_SOURCE_CORE_AND_OLD_SETTINGS_EXPLICIT_ABSOLUTE_SWING_ZERO_COUPLING',
 helpers:Object.fromEntries(names.map((n,i)=>[n,sha(helpers[i])])),workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(template),builderSha256:sha(await readFile('tools/browser-bridge/build-v63.mjs')),
 worldPhysicsRulesAiChanged:false,batHeadCoupling:{basis:'CURRENT_OBSERVED_RIGID_BAT_AXIS_ROTATION',measuredHeadMotion:false,maximumOffsetRadians:.06},
 swingViewDefault:'V59_BEFORE_DECISION_AND_SWING_ACQUISITION_PLUS_AUTHORED_BAT_HEAD_RESPONSE',
 preset:{enabled:true,aimLiftMeters:.30,swingMaxDownRadians:.20,hitFollowDelayMs:300,aimReleaseMs:70,pitchTrackingGain:.26,pitchTrackingDeadbandRadians:.02,impactStabilizeOffsetMs:0,impactMaxMotionRadians:.04,impactMaxSpeedRadPerSecond:.35,swingUsesAbsoluteVision:false,swingHeadCoupling:.025}};
delete metadata.sha256;delete metadata.kind;
let lab=once(template,'__V63_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V63_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));lab=once(lab,'__V63_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});
for(const [name,html,kind]of [['ばせぼーるlv63_TBD_vs_LAD_打者の身体連動版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v63.html',lab,'CAMERA_WORKBENCH']]){
 const path=resolve(out,name);await writeFile(path,html);await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');
 if(kind==='NORMAL_MATCH')await writeFile(path+'.bundle-inputs.json',pinsBytes);
 console.log(JSON.stringify({kind,path,sha256:sha(html),sourceInputs:Object.keys(pins.inputs).length}));
}
