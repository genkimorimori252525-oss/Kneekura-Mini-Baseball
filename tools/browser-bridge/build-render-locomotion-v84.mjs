import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {applyPresentationCadenceV84} from './presentation-cadence-v84.mjs';
import {applyPresentationRenderControlsV84} from './presentation-render-controls-v84.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex'),out=resolve(process.argv[2]??'../../outputs');
const run=args=>{const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw Error('Build failed: '+args[0]);};
run(['tools/browser-bridge/build-native.mjs']);
const basePath='docs/demos/releases/v83/game.html',base=await readFile(basePath),previous=JSON.parse(await readFile(basePath+'.build.json'));
if(sha(base)!==previous.sha256||sha(base)!=='de87fdc68cf91cb4a4d2454e9336e67cfbb646b8a6786759c113c1a619ef345a')throw Error('Frozen v83 base differs');
const core=await readFile('dist/native-match-core-browser.js','utf8'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
if(pins.entrySha256!==sha(core))throw Error('Native bundle/manifest differ');
let coreReplacements=0,game=base.toString('utf8').replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/g,(all,open,body,close)=>{
 if(!body.includes('var KneekuraNativeMatchCore ='))return all;coreReplacements++;return open+core+'\n'+close;
});
if(coreReplacements!==1)throw Error('Exactly one Native Core script required');
game=applyPresentationRenderControlsV84(applyPresentationCadenceV84(game));
const stridePath='tools/browser-bridge/live-actor-stride-v84.js',stride=await readFile(stridePath,'utf8'),marker='<script id="v33-offline-core-match">';
if(game.split(marker).length!==2||/<\/script/i.test(stride))throw Error('Stride insertion boundary differs');
game=game.replace(marker,()=>'<script id="v84-live-actor-stride">'+stride+'</script>\n'+marker);
game=game.replace(/<title>[\s\S]*?<\/title>/,'<title>にーくらMINIbaseball v84 描画と接地移動</title>')
 .replaceAll('ホームラン見送り延長版 83','描画と接地移動版 84');
const driverPath='tools/browser-bridge/camera-workbench-v84.js',templatePath='tools/browser-bridge/camera-workbench-v81.html',
 driver=await readFile(driverPath,'utf8'),template=(await readFile(templatePath,'utf8')).replaceAll('調整室 v81','調整室 v84');
const paths=['tools/browser-bridge/presentation-cadence-v84.mjs','tools/browser-bridge/presentation-render-controls-v84.mjs',stridePath,driverPath,
 'tools/browser-bridge/build-render-locomotion-v84.mjs'];
const metadata={...previous,presentationVersion:84,basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreChanged:true,
 sourceCoreSha256:sha(core),sourceInputCount:Object.keys(pins.inputs).length,sourceCoreInputCount:Object.keys(pins.inputs).length,frozenSourceManifestSha256:sha(pinsBytes),
 presentationControlsVersion:84,frequencyScale:2,qualityScale:1.2,pitchFrequencyMultiplier:2.5,battedFrequencyMultiplier:2,
 logicalGridStep:4/1.2,wholeSceneClock:true,playerMovementChanged:true,renderCadenceChanged:true,renderQualityChanged:true,
 locomotionBasis:'AVERAGED_ALTERNATING_SUPPORT_UNCALIBRATED_V84',nativeDefenderMotionChanged:false,
 renderLocomotionSources:Object.fromEntries(await Promise.all(paths.map(async path=>[path,sha(await readFile(path))]))),
 workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(await readFile(templatePath)),builderSha256:sha(await readFile(paths.at(-1)))};
delete metadata.kind;delete metadata.sha256;
const once=(source,marker,replacement)=>{if(source.split(marker).length!==2)throw Error('Lab marker differs: '+marker);return source.replace(marker,()=>replacement);};
let lab=once(template,'__V73_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V73_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));lab=once(lab,'__V73_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});
const gamePath=resolve(out,'ばせぼーるlv84_TBD_vs_LAD_描画と接地移動版.html');
for(const [path,html,kind]of[[gamePath,game,'NORMAL_MATCH'],[resolve(out,'カメラワーク調整室_v84_描画と接地移動.html'),lab,'CAMERA_WORKBENCH']]){
 await writeFile(path,html);await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');
 if(kind==='NORMAL_MATCH')await writeFile(path+'.bundle-inputs.json',pinsBytes);
 console.log(JSON.stringify({path,sha256:sha(html),sourceCoreSha256:sha(core)}));
}
run(['tools/browser-bridge/build-maker.mjs',resolve(out,'にーくら野球メーカー_v84_描画と接地移動版.html'),
 '--executable-traits','--measured-library','--ball-comparison','--batter-comparison','--bat-orbit','--player-swing-preview',
 '--whole-arc','--equipment-preview','--technical-traits','--ball-display-fix','--pitcher-workbench','--pitch-library',
 '--pitch-views','--course-seasons','--pitch-menu','--lossless-performance','--maker-recovery','--presentation-v84',
 '--roster=docs/demos/live-game-roster-v62.json','--catalog=docs/demos/live-game-roster-catalog-v77.json','--match-renderer='+gamePath]);
