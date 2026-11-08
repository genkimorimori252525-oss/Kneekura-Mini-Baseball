import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {applyHomeRunWatchV83} from './home-run-watch-patch-v83.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex'),out=resolve(process.argv[2]??'../../outputs');
const basePath='docs/demos/releases/v81/game.html',base=await readFile(basePath),previous=JSON.parse(await readFile(basePath+'.build.json')),
 pinsBytes=await readFile(basePath+'.bundle-inputs.json'),pins=JSON.parse(pinsBytes),helper=await readFile('tools/browser-bridge/home-run-watch-v83.js','utf8');
if(sha(base)!==previous.sha256||sha(base)!=='b87445d9fdb0bc569d3ed2d6bd0fb9d02198e923323712887c524e9d7335e02c')throw Error('Frozen v81 base differs');
const core=[...base.toString('utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1]).find(source=>source.includes('var KneekuraNativeMatchCore ='))?.slice(0,-1);
if(!core||sha(core)!==previous.sourceCoreSha256||pins.entrySha256!==previous.sourceCoreSha256)throw Error('Frozen Native Core boundary differs');
const game=applyHomeRunWatchV83(base.toString('utf8'),helper),driverPath='tools/browser-bridge/camera-workbench-v81.js',templatePath='tools/browser-bridge/camera-workbench-v81.html',
 driver=await readFile(driverPath,'utf8'),template=(await readFile(templatePath,'utf8')).replaceAll('調整室 v81','調整室 v83');
const paths=['tools/browser-bridge/home-run-watch-v83.js','tools/browser-bridge/home-run-watch-patch-v83.mjs','tools/browser-bridge/build-home-run-watch-v83.mjs'];
const metadata={...previous,presentationVersion:83,basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreChanged:false,
 homeRunWatchMs:1750,homeRunWatchSources:Object.fromEntries(await Promise.all(paths.map(async path=>[path,sha(await readFile(path))]))),
 ballDynamicsChanged:false,battingMotorChanged:false,playerMovementChanged:false,renderCadenceChanged:false,renderQualityChanged:false,
 frozenSourceManifestSha256:sha(pinsBytes),workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(await readFile(templatePath)),builderSha256:sha(await readFile(paths[2]))};
delete metadata.kind;delete metadata.sha256;
const once=(source,marker,replacement)=>{if(source.split(marker).length!==2)throw Error('Lab marker differs: '+marker);return source.replace(marker,()=>replacement);};
let lab=once(template,'__V73_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V73_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));lab=once(lab,'__V73_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});
for(const [name,html,kind]of[['ばせぼーるlv83_TBD_vs_LAD_HR見送り延長版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v83_HR見送り.html',lab,'CAMERA_WORKBENCH']]){
 const path=resolve(out,name);await writeFile(path,html);await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');
 if(kind==='NORMAL_MATCH')await writeFile(path+'.bundle-inputs.json',pinsBytes);
 console.log(JSON.stringify({path,sha256:sha(html),sourceCoreSha256:previous.sourceCoreSha256,homeRunWatchMs:1750}));
}
