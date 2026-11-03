import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]??'../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex'),
 gamePath='docs/demos/releases/v57/game.html',labPath='docs/demos/releases/v57/camera-workbench.html',
 base=await readFile(gamePath,'utf8'),baseLab=await readFile(labPath,'utf8');
if(sha(base)!=='238fce33e1e7087ecc5b08f1a8a1487c1f65d92e6a6dbd718dbf8ddb6d068d0f'||sha(baseLab)!=='82532cb37e4420785913686633d0d5e37e8ea4d80a0119566f99066dc222fd90')throw Error('Frozen v57 SHA mismatch');
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('v58 marker '+a.slice(0,100));return s.replace(a,()=>b);},
 oldHelper=await readFile('tools/browser-bridge/live-pitcher-reaction-view.js','utf8'),helperPath='tools/browser-bridge/live-pitcher-reaction-view-v58.js',helper=await readFile(helperPath,'utf8'),
 core=await readFile('dist/native-match-core-browser.js'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
if(!base.includes(core.toString('utf8'))||sha(core)!==pins.entrySha256)throw Error('Core differs from v57');
for(const [p,h]of Object.entries(pins.inputs))if(sha(await readFile(p))!==h)throw Error('Source input differs: '+p);
if(helper.includes('</script>'))throw Error('Unsafe inline script');
let game=once(base,oldHelper,helper);
for(const [a,b]of [['presentationVersion:57','presentationVersion:58'],['version:57,authority:','version:58,authority:'],['スイング時の頭固定版 57</title>','投手追尾待機短縮版 58</title>'],['スイング時の頭固定版 57','投手追尾待機短縮版 58']])game=once(game,a,b);
const metaMatch=baseLab.match(/<script id="camera-workbench-source" type="application\/json">([^<]+)<\/script>/);
if(!metaMatch)throw Error('Workbench metadata missing');
const previous=JSON.parse(metaMatch[1]),metadata={...previous,presentationVersion:58,basePresentationPath:gamePath,basePresentationSha256:sha(base),
 baseWorkbenchPath:labPath,baseWorkbenchSha256:sha(baseLab),builderSha256:sha(await readFile('tools/browser-bridge/build-v58.mjs')),
 helpers:{...previous.helpers,'live-pitcher-reaction-view-v58.js':sha(helper)},pitcherReaction:{minimumDelaySeconds:.1,maximumDelaySeconds:.25,speedScaleMeters:7,blendMs:180}};
const encode=s=>JSON.stringify(s).replaceAll('<','\\u003c');
let lab=once(baseLab,encode(base),encode(game));lab=once(lab,metaMatch[1],JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'カメラワーク調整室 v57</title>','カメラワーク調整室 v58</title>');lab=once(lab,'<small>v57</small>','<small>v58</small>');
await mkdir(out,{recursive:true});
const files=[['ばせぼーるlv58_TBD_vs_LAD_投手追尾待機短縮版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v58.html',lab,'CAMERA_WORKBENCH']];
for(const [name,html,kind]of files){await writeFile(resolve(out,name),html);await writeFile(resolve(out,name+'.build.json'),JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');}
await writeFile(resolve(out,files[0][0]+'.bundle-inputs.json'),pinsBytes);
console.log(JSON.stringify({pass:true,presentationVersion:58,sourceInputs:Object.keys(pins.inputs).length,pitcherReaction:metadata.pitcherReaction,artifacts:files.map(([name,html])=>({name,sha256:sha(html)}))}));
