import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {applyPitcherPresentationV62} from './pitcher-presentation-v62.mjs';
const out=resolve(process.argv[2]??'../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex');
const basePath='docs/demos/releases/v61/game.html',base=await readFile(basePath);
if(sha(base)!=='a97893a7c6206b2cd7b7dc6aa1478e6d65afb26893df25bd4b01efca072df5bd')throw Error('Frozen v61 SHA mismatch');
const core=await readFile('dist/native-match-core-browser.js'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
if(pins.entrySha256!==sha(core))throw Error('Current Core manifest mismatch');
for(const [p,h]of Object.entries(pins.inputs))if(sha(await readFile(p))!==h)throw Error('Source changed after bundle: '+p);
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('v62 marker '+a.slice(0,100));return s.replace(a,()=>b);};
let game=base.toString('utf8');
const body=[...game.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(m=>m[1].startsWith('// Native physical'))?.[1];
const oldCore=[body,body?.slice(0,-1)].find(b=>b&&sha(b)==='390eb00f118ef6fae5fbdde9ea8bdd66d497ed39c9a2a3f6cbf36f917b39af7a');
if(!oldCore)throw Error('Frozen Core in v61 missing');
game=once(game,oldCore,core.toString('utf8'));
const names=['live-ball-display-controls-v56.js','live-pitch-ball-cadence-v56.js','live-camera-tuning-batter-view-v61.js',
 'live-pitcher-reaction-view-v62.js','live-name-display-controls-v60.js','live-pitcher-body-head-view-v62.js'];
const helpers=await Promise.all(names.map(n=>readFile('tools/browser-bridge/'+n,'utf8')));
game=once(game,await readFile('tools/browser-bridge/live-pitcher-reaction-view-v58.js','utf8'),helpers[3]);
game=once(game,'<script id="v33-offline-core-match">','<script>\n'+helpers[5]+'\n</script>\n<script id="v33-offline-core-match">');
const roster=await readFile('docs/demos/live-game-roster-v62.json'),catalog=await readFile('docs/demos/live-game-roster-catalog-v62.json'),reference=await readFile('docs/demos/live-public-ability-reference-v1.json');
const escaped=b=>JSON.stringify(JSON.parse(b)).replaceAll('<','\\u003c');
for(const [id,data]of [['v40-physical-roster',roster],['v40-roster-catalog',catalog]]){
 const marker='<script id="'+id+'" type="application/json">',start=game.indexOf(marker)+marker.length,end=game.indexOf('</script>',start);
 if(start<marker.length||end<start)throw Error('Missing '+id);
 game=once(game,game.slice(start,end),escaped(data));
}
game=applyPitcherPresentationV62(game);
for(const [a,b]of [['id="v61-presentation-controls"','id="v62-presentation-controls"'],['presentationVersion:61','presentationVersion:62'],['version:61,authority:','version:62,authority:'],['見逃し同期と選球眼版 61</title>','投手視点とリリース版 62</title>'],['見逃し同期と選球眼版 61','投手視点とリリース版 62']])game=once(game,a,b);
const driver=await readFile('tools/browser-bridge/camera-workbench-v62.js','utf8'),template=await readFile('tools/browser-bridge/camera-workbench-v62.html','utf8');
if([...helpers,driver].some(s=>s.includes('</script>')))throw Error('Unsafe inline script');
const metadata={presentationVersion:62,sourceGamePath:'docs/demos/releases/v54/game.html',sourceGameSha256:'80c68e3ddb5c961ab6f18b325c6f267f883cd02d27381dfa10a9334bf8afae9f',
 basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreSha256:sha(core),sourceInputCount:Object.keys(pins.inputs).length,
 compatibleSessionCoreSha256:[],sessionMigration:'EXACT_V62_CORE_ONLY_CHANGED_PHYSICAL_RELEASE_AND_DEFENSIVE_POLICY',
 helpers:Object.fromEntries(names.map((n,i)=>[n,sha(helpers[i])])),workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(template),
 builderSha256:sha(await readFile('tools/browser-bridge/build-v62.mjs')),pitcherTransformSha256:sha(await readFile('tools/browser-bridge/pitcher-presentation-v62.mjs')),
 rosterSha256:sha(roster),catalogSha256:sha(catalog),publicReferenceSha256:sha(reference),
 worldAuthority:'OFFLINE_HOST_SHARED_CORE_HANDED_SI_RELEASE_AND_CAUSAL_DEFENSIVE_OPPORTUNITY',displayGridPixels:4,ordinaryCadenceMs:55,pitchBallCadenceMs:22,
 ballDisplayDefaults:{perspective:1,overhead:1},nameDisplayDefaults:{scale:1},readOnlyCamera:true,
 pitcherReaction:{minimumDelaySeconds:.1,maximumDelaySeconds:.25,speedScaleMeters:7,blendMs:180},
 pitcherBodyHead:{enabled:true,scale:1,basis:'AUTHORED_HEAD_JOINT_ON_EXISTING_DELIVERY_CLOCK',moundSurface:{x:0,y:.254,z:18.44}},
 decisiveHomeRun:'CURRENT_OBSERVATION_FORECAST_AND_ALL_NINE_REACH_ENVELOPE_EXCLUDED_NOT_OFFICIAL_RULING',
 absoluteVision:{min:1,max:100,baseline:45,maximumTrackingGain:.70,minimumDeadbandRadians:0,leagueRelative:false},
 takeGaze:'CURRENT_OBSERVED_PITCH_PREFIX_AND_CAUSAL_CATCH_POSE_HOLD',
 preset:{enabled:true,aimLiftMeters:.30,swingMaxDownRadians:.20,hitFollowDelayMs:300,aimReleaseMs:70,pitchTrackingGain:.26,pitchTrackingDeadbandRadians:.02,impactStabilizeOffsetMs:0,impactMaxMotionRadians:.025,impactMaxSpeedRadPerSecond:.18}};
let lab=once(template,'__V62_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V62_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));lab=once(lab,'__V62_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});
for(const [name,html,kind]of [['ばせぼーるlv62_TBD_vs_LAD_投手視点とリリース版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v62.html',lab,'CAMERA_WORKBENCH']]){
 const path=resolve(out,name);await writeFile(path,html);await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');
 if(kind==='NORMAL_MATCH')await writeFile(path+'.bundle-inputs.json',pinsBytes);
 console.log(JSON.stringify({kind,path,sha256:sha(html),sourceInputs:Object.keys(pins.inputs).length}));
}
