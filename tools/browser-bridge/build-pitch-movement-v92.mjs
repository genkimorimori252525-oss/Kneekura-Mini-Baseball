import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const out=resolve(process.argv[2]??'../../outputs'),sha=value=>createHash('sha256').update(value).digest('hex'),result=spawnSync(process.execPath,['tools/browser-bridge/build-native.mjs'],{stdio:'inherit'});
if(result.error)throw result.error;if(result.status!==0)throw Error('Native build failed');
const basePath='docs/demos/releases/v88/game.html',base=await readFile(basePath,'utf8'),previous=JSON.parse(await readFile(basePath+'.build.json'));assert.equal(sha(base),previous.sha256);
const core=await readFile('dist/native-match-core-browser.js','utf8'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);assert.equal(pins.entrySha256,sha(core));
let replaced=0,game=base.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/g,(all,open,body,close)=>{if(!body.includes('var KneekuraNativeMatchCore ='))return all;replaced++;return open+core+'\n'+close;});assert.equal(replaced,1);
const cssPath='tools/browser-bridge/match-course-theme-v91.css',css=await readFile(cssPath,'utf8');assert(!/<\/style/i.test(css));
game=game.replace('</head>','<style id="v91-match-course-theme">\n'+css+'\n</style>\n</head>').replace('<title>にーくらMINIbaseball v88 空振りとHR見送り</title>','<title>にーくらMINIbaseball v92 球種別変化量</title>').replaceAll('空振りとHR見送り版 88','球種別変化量版 92');
const sourcePath='tools/browser-bridge/build-pitch-movement-v92.mjs',meta={...previous,pitchMovementVersion:92,themeVersion:91,sourceCoreChanged:true,
 basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreSha256:sha(core),sourceInputCount:Object.keys(pins.inputs).length,sourceCoreInputCount:Object.keys(pins.inputs).length,
 frozenSourceManifestSha256:sha(pinsBytes),themeSources:{[cssPath]:sha(css)},pitchMovementSources:{'src/integration/browser/PitchMovementV92.ts':pins.inputs['src/integration/browser/PitchMovementV92.ts'],'src/integration/browser/LivePitchAuthoringV78.ts':pins.inputs['src/integration/browser/LivePitchAuthoringV78.ts']},builderSha256:sha(await readFile(sourcePath))};
const gamePath=resolve(out,'ばせぼーるlv92_TBD_vs_LAD_球種別変化量版.html');Object.assign(meta,{sourceGamePath:gamePath,sourceGameSha256:sha(game)});
const driverPath='tools/browser-bridge/camera-workbench-v84.js',templatePath='tools/browser-bridge/camera-workbench-v81.html',driver=await readFile(driverPath,'utf8');
let template=(await readFile(templatePath,'utf8')).replaceAll('調整室 v81','調整室 v92');const once=(s,m,v)=>{assert.equal(s.split(m).length,2,m);return s.replace(m,()=>v);};
template=once(template,'__V73_METADATA__',JSON.stringify(meta).replaceAll('<','\\u003c'));template=once(template,'__V73_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));const lab=once(template,'__V73_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});for(const[name,html,kind]of[['ばせぼーるlv92_TBD_vs_LAD_球種別変化量版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v92_球種別変化量.html',lab,'CAMERA_WORKBENCH']]){
 const path=resolve(out,name);await writeFile(path,html);await writeFile(path+'.build.json',JSON.stringify({...meta,kind,sha256:sha(html),workbenchDriverSha256:sha(driver)},null,2)+'\n');if(kind==='NORMAL_MATCH')await writeFile(path+'.bundle-inputs.json',pinsBytes);console.log(JSON.stringify({path,sha256:sha(html)}));
}
