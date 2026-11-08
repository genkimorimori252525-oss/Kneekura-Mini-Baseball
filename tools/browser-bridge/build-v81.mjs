import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {applyBroadcastRendererPerformanceV81} from './broadcast-renderer-performance-v81.mjs';
import {applyPresentationUiPerformanceV81} from './presentation-ui-performance-v81.mjs';
import {applyPresentationCadencePerformanceV81} from './presentation-cadence-performance-v81.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),out=resolve(process.argv[2]??'../../outputs'),
 basePath='docs/demos/releases/v79/game.html',base=await readFile(basePath),previous=JSON.parse(await readFile(basePath+'.build.json')),
 core=await readFile('dist/native-match-core-browser.js'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
if(sha(base)!=='4b5089187fd868317b2c0a7b4399e56f4ee057231962b687a56a5d6cfb8d2340')throw Error('Frozen V79 differs');
if(pins.entrySha256!==sha(core))throw Error('Compile current Core first');
for(const[path,expected]of Object.entries(pins.inputs))if(sha(await readFile(path))!==expected)throw Error('Source changed after bundle: '+path);
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('V81 marker differs: '+a.slice(0,120));return s.replace(a,()=>b);};
let game=base.toString('utf8');const oldCore=[...game.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var KneekuraNativeMatchCore ='))?.slice(0,-1);
if(!oldCore||sha(oldCore)!==previous.sourceCoreSha256||core.includes(Buffer.from('</script>')))throw Error('Core boundary differs');
game=once(game,oldCore,core.toString('utf8'));
for(const[name,expected]of Object.entries(previous.helpers)){
 const bytes=await readFile('tools/browser-bridge/'+name);if(sha(bytes)!==expected||!game.includes(bytes.toString('utf8')))throw Error('Inherited helper differs: '+name);
}
game=applyBroadcastRendererPerformanceV81(game);
game=applyPresentationUiPerformanceV81(game);
game=applyPresentationCadencePerformanceV81(game);
game=once(game,"inspect:()=>({version:79,authority:'OFFLINE_HOST_SHARED_CORE'","inspect:()=>({version:81,authority:'OFFLINE_HOST_SHARED_CORE'");
game=game.replaceAll('63コースとシーズン成績版 79','無劣化性能改善版 81');
const driverPath='tools/browser-bridge/camera-workbench-v81.js',templatePath='tools/browser-bridge/camera-workbench-v81.html',
 driver=await readFile(driverPath,'utf8'),template=await readFile(templatePath,'utf8'),
 patchPaths=['broadcast-renderer-performance-v81.mjs','presentation-ui-performance-v81.mjs','presentation-cadence-performance-v81.mjs'],
 performanceSources=Object.fromEntries(await Promise.all(patchPaths.map(async p=>[p,sha(await readFile('tools/browser-bridge/'+p))]))),
 metadata={...previous,presentationVersion:81,basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreSha256:sha(core),sourceInputCount:Object.keys(pins.inputs).length,
  losslessPerformanceVersion:81,performanceSources,fullMeasuredCatalogPreserved:true,fullSceneCadence:true,ordinaryCadenceMs:55/3,pitchBallCadenceMs:22/3,ballDynamicsChanged:false,battingMotorChanged:false,
  compatibleSessionCoreSha256:[],sessionMigration:'V81_REPLAY_REQUIRES_IDENTICAL_START_ROSTER_AND_NO_SEASON_RECORDING',
  workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(template),builderSha256:sha(await readFile('tools/browser-bridge/build-v81.mjs'))};
delete metadata.kind;delete metadata.sha256;
let lab=once(template,'__V73_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V73_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));lab=once(lab,'__V73_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});
for(const[name,html,kind]of[['ばせぼーるlv81_TBD_vs_LAD_無劣化性能改善版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v81.html',lab,'CAMERA_WORKBENCH']]){
 if(Buffer.byteLength(html)>=100_000_000)throw Error('HTML exceeds GitHub limit');const path=resolve(out,name);await writeFile(path,html);
 await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');if(kind==='NORMAL_MATCH')await writeFile(path+'.bundle-inputs.json',pinsBytes);
 console.log(JSON.stringify({path,kind,sha256:sha(html),sourceInputs:Object.keys(pins.inputs).length}));
}
