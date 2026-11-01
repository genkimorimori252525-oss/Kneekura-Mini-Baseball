import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {applyRulesPresentationV94} from './rules-presentation-v94.mjs';
const out=resolve(process.argv[2]??'../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex'),build=spawnSync(process.execPath,['tools/browser-bridge/build-native.mjs'],{stdio:'inherit'});assert.equal(build.status,0);
const basePath=resolve('../../outputs/ばせぼーるlv92_TBD_vs_LAD_球種別変化量版.html'),base=await readFile(basePath,'utf8'),prior=JSON.parse(await readFile(basePath+'.build.json'));assert.equal(sha(base),prior.sha256);
const core=await readFile('dist/native-match-core-browser.js','utf8'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);assert.equal(sha(core),pins.entrySha256);
let count=0,game=base.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/g,(all,start,body,end)=>{if(!body.includes('var KneekuraNativeMatchCore ='))return all;count++;return start+core+'\n'+end;});assert.equal(count,1);
game=await applyRulesPresentationV94(game);
const oldDebug=await readFile('tools/browser-bridge/course-debug-panel-v87.js','utf8'),debug=await readFile('tools/browser-bridge/course-debug-panel-v94.js','utf8');assert.equal(game.split(oldDebug).length,2);game=game.replace(oldDebug,()=>debug);
game=game.replace('<title>にーくらMINIbaseball v92 球種別変化量</title>','<title>にーくらMINIbaseball v94 立体ゾーンと打席位置</title>').replaceAll('球種別変化量版 92','立体ゾーンと打席位置版 94');
const sourceFiles=['tools/browser-bridge/build-rules-v94.mjs','tools/browser-bridge/rules-presentation-v94.mjs','tools/browser-bridge/live-batting-setup-view-v94.js','tools/browser-bridge/live-camera-tuning-batter-view-v94.js','tools/browser-bridge/live-pitch-chart-v94.js','tools/browser-bridge/course-debug-panel-v94.js'],rulesSources=Object.fromEntries(await Promise.all(sourceFiles.map(async p=>[p,sha(await readFile(p))]))),
 meta={...prior,rulesVersion:94,battingSetupVersion:94,basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreChanged:true,sourceCoreSha256:sha(core),sourceInputCount:Object.keys(pins.inputs).length,sourceCoreInputCount:Object.keys(pins.inputs).length,frozenSourceManifestSha256:sha(pinsBytes),rulesSources};
const path=resolve(out,'ばせぼーるlv94_TBD_vs_LAD_立体ゾーンと打席位置版.html');Object.assign(meta,{sourceGamePath:path,sourceGameSha256:sha(game)});
const driverPath='tools/browser-bridge/camera-workbench-v84.js',driver=await readFile(driverPath,'utf8');let lab=await readFile('tools/browser-bridge/camera-workbench-v81.html','utf8');lab=lab.replaceAll('調整室 v81','調整室 v94');
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,a);return s.replace(a,()=>b);};lab=once(lab,'__V73_METADATA__',JSON.stringify(meta).replaceAll('<','\\u003c'));lab=once(lab,'__V73_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));lab=once(lab,'__V73_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});for(const[name,html,kind]of[['ばせぼーるlv94_TBD_vs_LAD_立体ゾーンと打席位置版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v94_立体ゾーンと打席位置.html',lab,'CAMERA_WORKBENCH']]){const output=resolve(out,name);await writeFile(output,html);await writeFile(output+'.build.json',JSON.stringify({...meta,kind,sha256:sha(html),workbenchDriverSha256:sha(driver)},null,2)+'\n');if(kind==='NORMAL_MATCH')await writeFile(output+'.bundle-inputs.json',pinsBytes);console.log(JSON.stringify({output,sha256:sha(html)}));}
