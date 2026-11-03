import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]??'../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex'),
 basePath='docs/demos/releases/v64/game.html',base=await readFile(basePath),
 core=await readFile('dist/native-match-core-browser.js'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
if(sha(base)!=='0c1b76a49dd0b06b2472a5206d6ef14b69374017f6bf3ac61da9d4bddb2c420b')throw Error('Frozen v64 SHA mismatch');
if(sha(core)!=='865078dc9881ce5c37754dbe2c7b502f586206f3ada972cfe2d3368207720c00'||pins.entrySha256!==sha(core))throw Error('v65 must preserve v62/v64 Core');
for(const [p,h]of Object.entries(pins.inputs))if(sha(await readFile(p))!==h)throw Error('Source changed after bundle: '+p);
let game=base.toString('utf8');if(!game.includes(core.toString('utf8')))throw Error('Frozen Core not embedded');
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('v65 marker '+a.slice(0,100));return s.replace(a,()=>b);};
const names=['live-ball-display-controls-v65.js','live-pitch-ball-cadence-v56.js','live-camera-tuning-batter-view-v63.js',
 'live-pitcher-reaction-view-v62.js','live-name-display-controls-v60.js','live-pitcher-body-head-view-v62.js'],
 helpers=await Promise.all(names.map(n=>readFile('tools/browser-bridge/'+n,'utf8')));
game=once(game,await readFile('tools/browser-bridge/live-ball-display-controls-v64.js','utf8'),helpers[0]);
game=once(game,'const heightMultiplier=window.KneekuraBallDisplayControls.heightMultiplierFor(ballCamera,ball.position.y),baseDisplayDiameterPx=unscaledDisplayDiameterPx*displayScale,\n   displayD=heightMultiplier===1?baseDisplayDiameterPx:baseDisplayDiameterPx*heightMultiplier,r=displayD/2;',
 `const baseDisplayDiameterPx=unscaledDisplayDiameterPx*displayScale,
   heightEnabled=ballCamera==='overhead'&&window.KneekuraBallDisplayControls.inspect().overheadHeightEmphasis>1,
   groundPoint=heightEnabled?projectBallView({x:ball.position.x,y:window.KneekuraBallDisplayControls.heightModel.groundCenterMeters,z:ball.position.z},ballCam):null,
   groundProjectedDiameterPx=groundPoint?2*.0366*groundPoint.scale:realD,
   groundOpticalDiameterPx=groundPoint?visualBallDiameter(groundProjectedDiameterPx,ballCamera,kind):opticalD,
   groundDisplayDiameterPx=groundPoint?(ball.sourceObservation?Math.max(1.25,groundOpticalDiameterPx):groundOpticalDiameterPx):unscaledDisplayDiameterPx,
   heightSizing=heightEnabled&&groundPoint?window.KneekuraBallDisplayControls.heightSizingFor(ballCamera,realD,groundProjectedDiameterPx,groundDisplayDiameterPx,unscaledDisplayDiameterPx):{diameterPx:unscaledDisplayDiameterPx,physicalHeightRatio:1},
   displayD=heightEnabled&&groundPoint?heightSizing.diameterPx*displayScale:baseDisplayDiameterPx,
   heightMultiplier=displayD/baseDisplayDiameterPx,r=displayD/2;`);
game=once(game,'heightMultiplier,baseDisplayDiameterPx,displayScale,unscaledDisplayDiameterPx,',
 'heightMultiplier,baseDisplayDiameterPx,groundProjectedDiameterPx,groundDisplayDiameterPx,physicalHeightRatio:heightSizing.physicalHeightRatio,displayScale,unscaledDisplayDiameterPx,');
game=once(game,'高さによる拡大は初期値1で従来表示です。1.5にすると、地面は同じ大きさ、20m以上の高い球は最大1.5倍になります。球の物理は変わりません。',
 '1は従来表示です。1より大きい値では、地面の球を基準に、実際のカメラ投影による高さの遠近差を強調します。1.5はその変化量の1.5倍です。球の物理は変わりません。');
for(const [a,b]of [['id="v64-presentation-controls"','id="v65-presentation-controls"'],['presentationVersion:64','presentationVersion:65'],['version:64,authority:','version:65,authority:'],['俯瞰の高さ表示調整版 64</title>','俯瞰の実遠近差調整版 65</title>'],['俯瞰の高さ表示調整版 64','俯瞰の実遠近差調整版 65']])game=once(game,a,b);
const driver=await readFile('tools/browser-bridge/camera-workbench-v65.js','utf8'),template=await readFile('tools/browser-bridge/camera-workbench-v65.html','utf8'),
 inherited=JSON.parse(await readFile('docs/demos/releases/v64/game.html.build.json','utf8'));
if([...helpers,driver].some(s=>s.includes('</script>')))throw Error('Unsafe inline script');
const metadata={...inherited,presentationVersion:65,basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreSha256:sha(core),
 sessionMigration:'SAME_V62_SOURCE_CORE_MISSING_HEIGHT_EMPHASIS_DEFAULTS_ONE_EXPLICIT_FACTOR_NOW_PHYSICAL_CONTRAST',
 helpers:Object.fromEntries(names.map((n,i)=>[n,sha(helpers[i])])),workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(template),builderSha256:sha(await readFile('tools/browser-bridge/build-v65.mjs')),
 ballDisplayDefaults:{perspective:1,overhead:1,overheadHeightEmphasis:1},
 overheadHeightCue:{basis:'GROUND_REFERENCED_CAMERA_PROJECTION',groundCenterMeters:.0366,legacyAtOne:true,formula:'groundDisplayDiameterPx*(1+factor*(max(1,currentProjectedDiameterPx/groundProjectedDiameterPx)-1))',default:1,minimum:1,maximum:8,sourcePhysicsChanged:false}};
delete metadata.sha256;delete metadata.kind;
let lab=once(template,'__V65_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V65_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));lab=once(lab,'__V65_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});
for(const [name,html,kind]of [['ばせぼーるlv65_TBD_vs_LAD_俯瞰の実遠近差調整版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v65.html',lab,'CAMERA_WORKBENCH']]){
 const path=resolve(out,name);await writeFile(path,html);await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');
 if(kind==='NORMAL_MATCH')await writeFile(path+'.bundle-inputs.json',pinsBytes);
 console.log(JSON.stringify({kind,path,sha256:sha(html),sourceInputs:Object.keys(pins.inputs).length}));
}
