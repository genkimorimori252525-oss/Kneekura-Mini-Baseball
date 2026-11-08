import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]??'../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex'),
 basePath='docs/demos/releases/v66/game.html',base=await readFile(basePath),
 core=await readFile('dist/native-match-core-browser.js'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
if(sha(base)!=='e6ff4a3924872ecbe3b0a5044cf102a5ac02ac45cb63cd771f122f3f04f34a3d')throw Error('Frozen v66 SHA mismatch');
if(sha(core)!=='865078dc9881ce5c37754dbe2c7b502f586206f3ada972cfe2d3368207720c00'||pins.entrySha256!==sha(core))throw Error('v67 must preserve v62/v64 Core');
for(const [p,h]of Object.entries(pins.inputs))if(sha(await readFile(p))!==h)throw Error('Source changed after bundle: '+p);
let game=base.toString('utf8');if(!game.includes(core.toString('utf8')))throw Error('Frozen Core not embedded');
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('v67 marker '+a.slice(0,100));return s.replace(a,()=>b);};
const names=['live-ball-display-controls-v67.js','live-pitch-ball-cadence-v56.js','live-camera-tuning-batter-view-v66.js',
 'live-pitcher-reaction-view-v62.js','live-name-display-controls-v60.js','live-pitcher-body-head-view-v62.js'],
 helpers=await Promise.all(names.map(n=>readFile('tools/browser-bridge/'+n,'utf8')));
game=once(game,await readFile('tools/browser-bridge/live-ball-display-controls-v65.js','utf8'),helpers[0]);
game=once(game,'heightSizingFor(ballCamera,realD,groundProjectedDiameterPx,groundDisplayDiameterPx,unscaledDisplayDiameterPx)',
 'heightSizingFor(ballCamera,realD,groundProjectedDiameterPx,groundDisplayDiameterPx,unscaledDisplayDiameterPx,ball.position.y)');
game=once(game,'俯瞰：高さによる拡大','俯瞰：空中のボールの倍率');
game=once(game,'id="ball-scale-overheadHeightEmphasis" type="number" min="1" max="8" step="0.1" value="1"',
 'id="ball-scale-overheadHeightEmphasis" type="number" min="1" max="8" step="0.1" value="2"');
game=once(game,'1は従来表示です。1より大きい値では、地面の球を基準に、実際のカメラ投影による高さの遠近差を強調します。1.5はその変化量の1.5倍です。球の物理は変わりません。',
 '初期値2：空中の球の基準サイズ自体を2倍に描きます。地面の球は従来のまま、接地付近だけ滑らかにつなぎます。1で従来表示。物理は変わりません。');
for(const [a,b]of [['id="v66-presentation-controls"','id="v67-presentation-controls"'],['presentationVersion:66','presentationVersion:67'],['version:66,authority:','version:67,authority:'],['スイングと走者視点の分離版 66</title>','俯瞰の空中球2倍版 67</title>'],['スイングと走者視点の分離版 66','俯瞰の空中球2倍版 67']])game=once(game,a,b);
const driver=await readFile('tools/browser-bridge/camera-workbench-v67.js','utf8'),template=await readFile('tools/browser-bridge/camera-workbench-v67.html','utf8'),
 inherited=JSON.parse(await readFile('docs/demos/releases/v66/game.html.build.json','utf8'));
if([...helpers,driver].some(s=>s.includes('</script>')))throw Error('Unsafe inline script');
const metadata={...inherited,presentationVersion:67,basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreSha256:sha(core),
 sessionMigration:'SAME_V62_SOURCE_CORE_LEGACY_MISSING_ONE_NEW_DEFAULT_TWO_LITERAL_FACTOR',
 helpers:Object.fromEntries(names.map((n,i)=>[n,sha(helpers[i])])),workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(template),builderSha256:sha(await readFile('tools/browser-bridge/build-v67.mjs')),
 ballDisplayDefaults:{perspective:1,overhead:1,overheadHeightEmphasis:2},
 overheadHeightCue:{basis:'GROUND_REFERENCED_LITERAL_AIR_DIAMETER_FACTOR',groundCenterMeters:.0366,groundBlendHeightMeters:.0732,legacyAtOne:true,default:2,minimum:1,maximum:8,sourcePhysicsChanged:false}};
delete metadata.sha256;delete metadata.kind;
let lab=once(template,'__V67_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V67_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));lab=once(lab,'__V67_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});
for(const [name,html,kind]of [['ばせぼーるlv67_TBD_vs_LAD_俯瞰の空中球2倍版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v67.html',lab,'CAMERA_WORKBENCH']]){
 const path=resolve(out,name);await writeFile(path,html);await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');
 if(kind==='NORMAL_MATCH')await writeFile(path+'.bundle-inputs.json',pinsBytes);
 console.log(JSON.stringify({kind,path,sha256:sha(html),sourceInputs:Object.keys(pins.inputs).length}));
}
