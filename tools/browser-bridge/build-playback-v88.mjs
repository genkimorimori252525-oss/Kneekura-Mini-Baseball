import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const sha=v=>createHash('sha256').update(v).digest('hex'),out=resolve(process.argv[2]??'../../outputs');
const once=(s,m,r)=>{if(s.split(m).length!==2)throw Error('v88 boundary differs: '+m.slice(0,100));return s.replace(m,()=>r);};
const result=spawnSync(process.execPath,['tools/browser-bridge/build-native.mjs'],{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw Error('Native build failed');
const basePath='docs/demos/releases/v87/game.html',base=await readFile(basePath),previous=JSON.parse(await readFile(basePath+'.build.json'));
if(sha(base)!==previous.sha256||sha(base)!=='9c31a38c73567acc71792c1f9b18a4ab191a6d0246ae446055d1289fab4b75ee')throw Error('Frozen v87 differs');
const core=await readFile('dist/native-match-core-browser.js','utf8'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
if(pins.entrySha256!==sha(core))throw Error('Core input manifest differs');
const hrPath='tools/browser-bridge/home-run-watch-v88.js',whiffPath='tools/browser-bridge/whiff-follow-through-v88.js',hr=await readFile(hrPath,'utf8'),whiff=await readFile(whiffPath,'utf8');
let coreCount=0,hrCount=0,game=base.toString('utf8').replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/g,(all,open,body,close)=>{
 if(body.includes('var KneekuraNativeMatchCore =')){coreCount++;return open+core+'\n'+close;}
 if(open.includes('id="v83-home-run-watch"')){hrCount++;return open+hr+'\n'+close;}return all;
});
if(coreCount!==1||hrCount!==1||/<\/script/i.test(whiff+hr))throw Error('Script boundary mismatch');
game=once(game,'<script id="v33-offline-core-match">','<script id="v88-whiff-follow-through">'+whiff+'</script>\n<script id="v33-offline-core-match">');
game=once(game,' const homeRunWatchControllerV83=', ' const whiffFollowThroughControllerV88=window.KneekuraWhiffFollowThroughV88.create({core});\n let whiffFollowThroughV88=null;\n const homeRunWatchControllerV83=');
game=once(game,'  const bat=currentFrame.bat?{...currentFrame.bat,sourceObservation:true}:null;',`  whiffFollowThroughV88=whiffFollowThroughControllerV88.observe({record:result,frame:currentFrame,sceneMs,preparationMs:timing.preparationMs,
   measuredClip:measured.clips.find(clip=>clip.id===result?.play.diagnostics.measuredClipId),bodyBatFrame:actorAnimation.batFrame});
  const batSourceV88=whiffFollowThroughV88?whiffFollowThroughV88.bat:currentFrame.bat;
  const bat=batSourceV88?{...batSourceV88,sourceObservation:true}:null;`);
game=once(game,'inspect:()=>({version:87,homeRunWatch:homeRunWatchV83','inspect:()=>({version:88,whiffFollowThrough:whiffFollowThroughV88,homeRunWatch:homeRunWatchV83');
game=game.replace(/<title>[\s\S]*?<\/title>/,'<title>にーくらMINIbaseball v88 空振りとHR見送り</title>').replaceAll('コース認識と打率版 87','空振りとHR見送り版 88');
const driverPath='tools/browser-bridge/camera-workbench-v84.js',templatePath='tools/browser-bridge/camera-workbench-v81.html',driver=await readFile(driverPath,'utf8');
let template=(await readFile(templatePath,'utf8')).replaceAll('調整室 v81','調整室 v88');
const sources=[hrPath,whiffPath,'tools/browser-bridge/build-playback-v88.mjs'];
const meta={...previous,playbackVersion:88,basePresentationPath:basePath,basePresentationSha256:sha(base),sourceGamePath:resolve(out,'ばせぼーるlv88_TBD_vs_LAD_空振りとHR見送り版.html'),sourceGameSha256:sha(game),
 sourceCoreSha256:sha(core),sourceInputCount:Object.keys(pins.inputs).length,sourceCoreInputCount:Object.keys(pins.inputs).length,frozenSourceManifestSha256:sha(pinsBytes),
 homeRunWatchSources:{[hrPath]:sha(hr)},homeRunWatchRangeMs:[1500,2000],
 playbackSources:Object.fromEntries(await Promise.all(sources.map(async p=>[p,sha(await readFile(p))]))),builderSha256:sha(await readFile(sources.at(-1))),workbenchDriverSha256:sha(driver)};
delete meta.sha256;delete meta.kind;
template=once(template,'__V73_METADATA__',JSON.stringify(meta).replaceAll('<','\\u003c'));
template=once(template,'__V73_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));const lab=once(template,'__V73_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});for(const[name,html,kind]of[['ばせぼーるlv88_TBD_vs_LAD_空振りとHR見送り版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v88_空振りとHR見送り.html',lab,'CAMERA_WORKBENCH']]){
 const p=resolve(out,name);await writeFile(p,html);await writeFile(p+'.build.json',JSON.stringify({...meta,kind,sha256:sha(html)},null,2)+'\n');if(kind==='NORMAL_MATCH')await writeFile(p+'.bundle-inputs.json',pinsBytes);console.log(JSON.stringify({path:p,sha256:sha(html)}));
}
