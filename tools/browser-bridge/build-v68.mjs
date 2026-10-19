import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const out=resolve(process.argv[2]??'../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex'),
 basePath='docs/demos/releases/v67/game.html',base=await readFile(basePath),
 core=await readFile('dist/native-match-core-browser.js'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes),
 library=await readFile('docs/demos/measured-bat-library-v1.json'),decoder=await readFile('tools/browser-bridge/measured-bat-library-v1.js','utf8');
if(sha(base)!=='afa1fcf344acf5ba801ac486b28779a9ed9fb71912c65c092d3263ecae5f25e9')throw Error('Frozen v67 SHA mismatch');
if(pins.entrySha256!==sha(core)||pins.entrySha256==='865078dc9881ce5c37754dbe2c7b502f586206f3ada972cfe2d3368207720c00')throw Error('v68 needs the newly compiled impact-trajectory Core');
for(const [path,hash]of Object.entries(pins.inputs))if(sha(await readFile(path))!==hash)throw Error('Source changed after bundle: '+path);
if(sha(library)!=='b53a8d687f663a5578315120445de1407fb82efec594cde27cc313c1ea5b106a')throw Error('Pinned 673-trial measured library differs');
const compact=JSON.parse(library);if(compact.clips.length!==673)throw Error('Expected 673 measured trials');
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('v68 marker '+a.slice(0,100));return s.replace(a,()=>b);};
let game=base.toString('utf8');
const originalCore=[...game.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var KneekuraNativeMatchCore ='))?.slice(0,-1);
if(!originalCore||sha(originalCore)!=='865078dc9881ce5c37754dbe2c7b502f586206f3ada972cfe2d3368207720c00')throw Error('Exact frozen v62 Core not found');
if([core.toString('utf8'),decoder].some(s=>s.includes('</script>')))throw Error('Unsafe inline source');
game=once(game,originalCore,core.toString('utf8'));
const oldData=game.match(/<script id="v33-measured-bats" type="application\/json">[\s\S]*?<\/script>/)?.[0];
if(!oldData)throw Error('Old 12-clip data script missing');
game=once(game,oldData,'<script id="v68-measured-bat-library" type="application/json">'+library.toString('utf8').replaceAll('<','\\u003c')+'</script>\n<script id="v68-measured-bat-library-decoder">'+decoder+'</script>');
game=once(game,"measured=JSON.parse($('v33-measured-bats').textContent)","measured=window.KneekuraMeasuredBatLibrary.decode($('v68-measured-bat-library').textContent)");
// Validate the candidate Host before replacing any running game state. A bad
// form ID, wrong handedness or unsupported window leaves the old game intact.
const oldCreate=game.match(/ function createGame\(randomize=false\)\{[\s\S]*?\r?\n \}\r?\n visual\.seek\(0\);/)?.[0];
if(!oldCreate)throw Error('Frozen createGame marker missing');
const create=` function createGame(randomize=false){
  const configured=core.applyLivePhysicalRosterV1({players:basePlayers,roster:pendingRoster});
  let seedText=$('match-seed').value;
  if(randomize&&!$('fixed-seed').checked){const random=new Uint32Array(1);crypto.getRandomValues(random);seedText='TBD-LAD-'+random[0];}
  const nextConfiguration={seedText,seed:hashSeed(seedText),innings:Number($('inning-limit').value)||9},
   nextHost=core.createLiveBaseballMatchV1({seed:nextConfiguration.seed,innings:nextConfiguration.innings,
    teams,players:configured.players,park,measuredClips:measured.clips});
  stop();fast=false;gameToken++;records=[];selected=-1;frameIndex=0;sceneMs=0;skipAtMs=null;selectedMark=null;pauseAfterPitch=false;lastFailure=null;lastFailureDetails=null;
  $('match-seed').value=seedText;activeConfiguration=nextConfiguration;
  players=configured.players;physicalRosterAudit=configured.audit;activeRoster=structuredClone(pendingRoster);
  playerById=Object.fromEntries(Object.values(data.players).map(player=>[player.id,{...player,
   height:players.find(configured=>configured.playerId===player.id)?.heightMeters??player.height}]));
  host=nextHost;draw();
 }
 visual.seek(0);`;
game=once(game,oldCreate,create);
game=once(game,'core.applyLivePhysicalRosterV1({players:basePlayers,roster:migrated});pendingRoster=structuredClone(migrated);',
 `const candidate=core.applyLivePhysicalRosterV1({players:basePlayers,roster:migrated});
   core.createLiveBaseballMatchV1({seed:hashSeed($('match-seed').value),innings:Number($('inning-limit').value)||9,
    teams,players:candidate.players,park,measuredClips:measured.clips});pendingRoster=structuredClone(migrated);`);
for(const [a,b]of [['id="v67-presentation-controls"','id="v68-presentation-controls"'],['presentationVersion:67','presentationVersion:68'],
 ['version:67,authority:','version:68,authority:'],['俯瞰の空中球2倍版 67</title>','弾道と実測フォーム接続版 68</title>'],['俯瞰の空中球2倍版 67','弾道と実測フォーム接続版 68']])game=once(game,a,b);
const names=['live-ball-display-controls-v67.js','live-pitch-ball-cadence-v56.js','live-camera-tuning-batter-view-v66.js',
 'live-pitcher-reaction-view-v62.js','live-name-display-controls-v60.js','live-pitcher-body-head-view-v62.js'],
 helpers=await Promise.all(names.map(n=>readFile('tools/browser-bridge/'+n,'utf8')));
for(const helper of helpers)if(!game.includes(helper))throw Error('Inherited presentation helper changed');
const embedded=id=>game.match(new RegExp('<script id="'+id+'" type="application/json">([\\s\\S]*?)<\\/script>'))?.[1];
for(const id of ['v40-physical-roster','v40-roster-catalog','v61-public-ability-reference']){
 const old=base.toString('utf8').match(new RegExp('<script id="'+id+'" type="application/json">([\\s\\S]*?)<\\/script>'))?.[1];
 if(!old||embedded(id)!==old)throw Error('Default player data changed: '+id);
}
const driver=await readFile('tools/browser-bridge/camera-workbench-v68.js','utf8'),template=await readFile('tools/browser-bridge/camera-workbench-v68.html','utf8'),
 inherited=JSON.parse(await readFile('docs/demos/releases/v67/game.html.build.json','utf8'));
if(driver.includes('</script>'))throw Error('Unsafe driver');
const metadata={...inherited,presentationVersion:68,basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreSha256:sha(core),
 sourceInputCount:Object.keys(pins.inputs).length,compatibleSessionCoreSha256:[],sessionMigration:'SOURCE_CORE_CHANGED_V68_REJECT_OLDER_CORE_SESSIONS',
 helpers:Object.fromEntries(names.map((n,i)=>[n,sha(helpers[i])])),workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(template),builderSha256:sha(await readFile('tools/browser-bridge/build-v68.mjs')),
 sourceCoreChanged:true,worldPhysicsRulesAiChanged:false,optionalImpactTrajectoryConnected:true,
 measuredBatLibrary:{path:'docs/demos/measured-bat-library-v1.json',sha256:sha(library),decoderPath:'tools/browser-bridge/measured-bat-library-v1.js',decoderSha256:sha(decoder),
  trials:673,athletes:98,rightHanded:495,leftHanded:178,legacyDefaultChoices:12,automaticSelection:'LEGACY_DEFAULT_SELECTION_TRUE_IN_ORIGINAL_ORDER',originalMeasuredSourcePreserved:true},
 hostCatalog:{maximumClips:1000,maximumFrames:150000,inertSnapshot:'EACH_CLIP_WITH_UNCHANGED_CLONEINERT_BOUND',perPitch:'HANDED_LEGACY_DEFAULT_CHOICES_OR_ONE_EXPLICIT_CLIP',atomicImportValidation:true},
 impactTrajectory:{optional:true,defaultPlayerRosterChanged:false,levels:[1,2,3,4],angleDegreesByLevel:[-10,0,10,20],beforeSourceSeconds:.1,afterSourceSeconds:.06,
  sourceWindowFitRequired:true,model:'COMPACT_C2_RIGID_CONTACT_PIVOT',collisionAndRenderingSameReference:true,directLaunchOrSpinOverride:false}};
delete metadata.sha256;delete metadata.kind;
let lab=once(template,'__V68_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V68_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));lab=once(lab,'__V68_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});
for(const [name,html,kind]of [['ばせぼーるlv68_TBD_vs_LAD_弾道と実測フォーム接続版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v68.html',lab,'CAMERA_WORKBENCH']]){
 if(Buffer.byteLength(html)>=100_000_000)throw Error('HTML exceeds GitHub single-file limit');
 const path=resolve(out,name);await writeFile(path,html);await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');
 if(kind==='NORMAL_MATCH')await writeFile(path+'.bundle-inputs.json',pinsBytes);
 console.log(JSON.stringify({kind,path,sha256:sha(html),bytes:Buffer.byteLength(html),sourceInputs:Object.keys(pins.inputs).length}));
}
