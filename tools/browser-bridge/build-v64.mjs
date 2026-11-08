import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]??'../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex'),
 basePath='docs/demos/releases/v63/game.html',base=await readFile(basePath),
 core=await readFile('dist/native-match-core-browser.js'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
if(sha(base)!=='0cb5d9ae43aab96e4edf389136b15fc5cb28fb7d855ebf1d4f43bcdcde93542a')throw Error('Frozen v63 SHA mismatch');
if(sha(core)!=='865078dc9881ce5c37754dbe2c7b502f586206f3ada972cfe2d3368207720c00'||pins.entrySha256!==sha(core))throw Error('v64 must preserve v62/v63 Core');
for(const [p,h]of Object.entries(pins.inputs))if(sha(await readFile(p))!==h)throw Error('Source changed after bundle: '+p);
let game=base.toString('utf8');if(!game.includes(core.toString('utf8')))throw Error('Frozen Core not embedded');
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('v64 marker '+a.slice(0,100));return s.replace(a,()=>b);};
const names=['live-ball-display-controls-v64.js','live-pitch-ball-cadence-v56.js','live-camera-tuning-batter-view-v63.js',
 'live-pitcher-reaction-view-v62.js','live-name-display-controls-v60.js','live-pitcher-body-head-view-v62.js'],
 helpers=await Promise.all(names.map(n=>readFile('tools/browser-bridge/'+n,'utf8')));
game=once(game,await readFile('tools/browser-bridge/live-ball-display-controls-v56.js','utf8'),helpers[0]);
game=once(game,'const displayD=unscaledDisplayDiameterPx*displayScale,r=displayD/2;',
 'const heightMultiplier=window.KneekuraBallDisplayControls.heightMultiplierFor(ballCamera,ball.position.y),baseDisplayDiameterPx=unscaledDisplayDiameterPx*displayScale,\n   displayD=heightMultiplier===1?baseDisplayDiameterPx:baseDisplayDiameterPx*heightMultiplier,r=displayD/2;');
game=once(game,'ballDotDisplay={camera:ballCamera,displayScale,unscaledDisplayDiameterPx,',
 'ballDotDisplay={camera:ballCamera,observedHeightMeters:ball.position.y,overheadHeightEmphasis:window.KneekuraBallDisplayControls.inspect().overheadHeightEmphasis,heightMultiplier,baseDisplayDiameterPx,displayScale,unscaledDisplayDiameterPx,');
const oldKeys="for(const key of ['perspective','overhead'])";
if(game.split(oldKeys).length!==3)throw Error('v64 normal ball display bindings mismatch');
game=game.replaceAll(oldKeys,"for(const key of ['perspective','overhead','overheadHeightEmphasis'])");
game=once(game,'<button id="ball-scale-reset">倍率を1に戻す</button>',
 '<label>俯瞰：高さによる拡大 <input id="ball-scale-overheadHeightEmphasis" type="number" min="1" max="8" step="0.1" value="1"></label><button id="ball-scale-reset">表示を初期値へ</button><p>高さによる拡大は初期値1で従来表示です。1.5にすると、地面は同じ大きさ、20m以上の高い球は最大1.5倍になります。球の物理は変わりません。</p>');
for(const [a,b]of [['id="v63-presentation-controls"','id="v64-presentation-controls"'],['presentationVersion:63','presentationVersion:64'],['version:63,authority:','version:64,authority:'],['打者の身体連動版 63</title>','俯瞰の高さ表示調整版 64</title>'],['打者の身体連動版 63','俯瞰の高さ表示調整版 64']])game=once(game,a,b);
const driver=await readFile('tools/browser-bridge/camera-workbench-v64.js','utf8'),template=await readFile('tools/browser-bridge/camera-workbench-v64.html','utf8'),
 inherited=JSON.parse(await readFile('docs/demos/releases/v63/game.html.build.json','utf8'));
if([...helpers,driver].some(s=>s.includes('</script>')))throw Error('Unsafe inline script');
const metadata={...inherited,presentationVersion:64,basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreSha256:sha(core),
 sessionMigration:'SAME_V62_SOURCE_CORE_AND_MISSING_HEIGHT_EMPHASIS_DEFAULTS_TO_ONE',
 helpers:Object.fromEntries(names.map((n,i)=>[n,sha(helpers[i])])),workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(template),builderSha256:sha(await readFile('tools/browser-bridge/build-v64.mjs')),
 ballDisplayDefaults:{perspective:1,overhead:1,overheadHeightEmphasis:1},
 overheadHeightCue:{basis:'OBSERVED_HEIGHT_DISPLAY_CUE',groundCenterMeters:.0366,fullEmphasisHeightMeters:20,default:1,minimum:1,maximum:8,sourcePhysicsChanged:false}};
delete metadata.sha256;delete metadata.kind;
let lab=once(template,'__V64_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V64_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));lab=once(lab,'__V64_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});
for(const [name,html,kind]of [['ばせぼーるlv64_TBD_vs_LAD_俯瞰の高さ表示調整版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v64.html',lab,'CAMERA_WORKBENCH']]){
 const path=resolve(out,name);await writeFile(path,html);await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');
 if(kind==='NORMAL_MATCH')await writeFile(path+'.bundle-inputs.json',pinsBytes);
 console.log(JSON.stringify({kind,path,sha256:sha(html),sourceInputs:Object.keys(pins.inputs).length}));
}
