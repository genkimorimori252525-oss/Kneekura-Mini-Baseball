import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]??'../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex');
const basePath='docs/demos/releases/v60/game.html',base=await readFile(basePath);
if(sha(base)!=='c4f50e430fbf04d2c1ef355d59fc8584583337221ffe03b43786cc40bd3c086f')throw Error('Frozen v60 SHA mismatch');
const core=await readFile('dist/native-match-core-browser.js'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
if(pins.entrySha256!==sha(core))throw Error('Current Core manifest mismatch');
for(const [p,h]of Object.entries(pins.inputs))if(sha(await readFile(p))!==h)throw Error('Source changed after bundle: '+p);
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('v61 marker '+a.slice(0,110));return s.replace(a,()=>b);};
let game=base.toString('utf8');
const body=[...game.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(m=>m[1].startsWith('// Native physical'))?.[1];
const oldCore=[body,body?.slice(0,-1)].find(b=>b&&sha(b)==='4a581b262a71530ef67503ba76e71849d52c394a2b7c113852a461b423486279');
if(!oldCore)throw Error('Frozen Core in v60 missing');
game=once(game,oldCore,core.toString('utf8'));
const names=['live-ball-display-controls-v56.js','live-pitch-ball-cadence-v56.js','live-camera-tuning-batter-view-v61.js','live-pitcher-reaction-view-v58.js','live-name-display-controls-v60.js'];
const helpers=await Promise.all(names.map(n=>readFile('tools/browser-bridge/'+n,'utf8')));
game=once(game,await readFile('tools/browser-bridge/live-camera-tuning-batter-view-v60.js','utf8'),helpers[2]);
const roster=await readFile('docs/demos/live-game-roster-v61.json'),catalog=await readFile('docs/demos/live-game-roster-catalog-v61.json'),reference=await readFile('docs/demos/live-public-ability-reference-v1.json');
const escaped=b=>JSON.stringify(JSON.parse(b)).replaceAll('<','\\u003c');
for(const [id,data]of [['v40-physical-roster',roster],['v40-roster-catalog',catalog]]){
 const marker='<script id="'+id+'" type="application/json">',start=game.indexOf(marker)+marker.length,end=game.indexOf('</script>',start);
 if(start<marker.length||end<start)throw Error('Missing '+id);
 game=once(game,game.slice(start,end),escaped(data));
}
game=once(game,'<script id="v33-offline-core-match">','<script id="v61-public-ability-reference" type="application/json">'+escaped(reference)+'</script>\n<script id="v33-offline-core-match">');
game=once(game,"const defaultRoster=JSON.parse($('v40-physical-roster').textContent),rosterCatalog=JSON.parse($('v40-roster-catalog').textContent);",
 "const defaultRoster=JSON.parse($('v40-physical-roster').textContent),rosterCatalog=JSON.parse($('v40-roster-catalog').textContent),publicReference=JSON.parse($('v61-public-ability-reference').textContent);");
game=once(game,'core.applyLivePhysicalRosterV1({players:basePlayers,roster:packet});pendingRoster=structuredClone(packet);',
 'const migrated=core.materializeLivePlateVisionV1({roster:packet,reference:publicReference}).roster;\n   core.applyLivePhysicalRosterV1({players:basePlayers,roster:migrated});pendingRoster=structuredClone(migrated);');
for(const [a,b]of [['id="v60-presentation-controls"','id="v61-presentation-controls"'],['presentationVersion:60','presentationVersion:61'],['version:60,authority:','version:61,authority:'],['視線と名前調整版 60</title>','見逃し同期と選球眼版 61</title>'],['視線と名前調整版 60','見逃し同期と選球眼版 61']])game=once(game,a,b);
if(!game.includes(core.toString('utf8')))throw Error('Current Core missing from normal');
const driver=await readFile('tools/browser-bridge/camera-workbench-v61.js','utf8'),template=await readFile('tools/browser-bridge/camera-workbench-v61.html','utf8');
if([...helpers,driver].some(s=>s.includes('</script>')))throw Error('Unsafe inline script');
const metadata={presentationVersion:61,sourceGamePath:'docs/demos/releases/v54/game.html',sourceGameSha256:'80c68e3ddb5c961ab6f18b325c6f267f883cd02d27381dfa10a9334bf8afae9f',
 basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreSha256:sha(core),sourceInputCount:Object.keys(pins.inputs).length,
 compatibleSessionCoreSha256:['4a581b262a71530ef67503ba76e71849d52c394a2b7c113852a461b423486279'],
 sessionMigration:'V54_TO_V60_CORE_REPLAY_WITH_UNCHANGED_SI_AND_ABSOLUTE_VISION_METADATA',
 helpers:Object.fromEntries(names.map((n,i)=>[n,sha(helpers[i])])),workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(template),builderSha256:sha(await readFile('tools/browser-bridge/build-v61.mjs')),
 rosterSha256:sha(roster),catalogSha256:sha(catalog),publicReferenceSha256:sha(reference),
 worldAuthority:'OFFLINE_HOST_SHARED_CORE_ABSOLUTE_VISION_METADATA_NO_PHYSICS_CHANGE',displayGridPixels:4,ordinaryCadenceMs:55,pitchBallCadenceMs:22,
 ballDisplayDefaults:{perspective:1,overhead:1},nameDisplayDefaults:{scale:1},readOnlyCamera:true,
 pitcherReaction:{minimumDelaySeconds:.1,maximumDelaySeconds:.25,speedScaleMeters:7,blendMs:180},
 absoluteVision:{min:1,max:100,baseline:45,maximumTrackingGain:.70,minimumDeadbandRadians:0,leagueRelative:false},
 takeGaze:'CURRENT_OBSERVED_PITCH_PREFIX_AND_CAUSAL_CATCH_POSE_HOLD',
 preset:{enabled:true,aimLiftMeters:.30,swingMaxDownRadians:.20,hitFollowDelayMs:300,aimReleaseMs:70,pitchTrackingGain:.26,pitchTrackingDeadbandRadians:.02,impactStabilizeOffsetMs:0,impactMaxMotionRadians:.025,impactMaxSpeedRadPerSecond:.18}};
let lab=once(template,'__V61_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V61_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));lab=once(lab,'__V61_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});
for(const [name,html,kind]of [['ばせぼーるlv61_TBD_vs_LAD_見逃し同期と選球眼版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v61.html',lab,'CAMERA_WORKBENCH']]){
 const path=resolve(out,name);await writeFile(path,html);await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');
 if(kind==='NORMAL_MATCH')await writeFile(path+'.bundle-inputs.json',pinsBytes);
 console.log(JSON.stringify({kind,path,sha256:sha(html),sourceInputs:Object.keys(pins.inputs).length}));
}
