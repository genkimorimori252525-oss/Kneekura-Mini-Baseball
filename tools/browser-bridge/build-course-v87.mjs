import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const sha=value=>createHash('sha256').update(value).digest('hex'),out=resolve(process.argv[2]??'../../outputs');
const run=args=>{const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw Error('Build failed: '+args[0]);};
const once=(source,marker,replacement)=>{if(source.split(marker).length!==2)throw Error('Expected one marker: '+marker);return source.replace(marker,()=>replacement);};
run(['tools/browser-bridge/build-native.mjs']);
const basePath='docs/demos/releases/v84/game.html',base=await readFile(basePath),previous=JSON.parse(await readFile(basePath+'.build.json'));
if(sha(base)!==previous.sha256||sha(base)!=='b68c954154e7ce4b3af9f9d493329bc213fb7752789394cd11d74250dba2fb1a')throw Error('Frozen v84 base differs');
const core=await readFile('dist/native-match-core-browser.js','utf8'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
if(pins.entrySha256!==sha(core))throw Error('Native bundle/manifest differ');
const helperPaths=['tools/browser-bridge/live-season-client-v79.js','tools/browser-bridge/course-charts-v87.js','tools/browser-bridge/live-season-match-v87.js'];
const referencePath='docs/demos/mlb-2025-course-reference-v87.json',reference=await readFile(referencePath,'utf8');
JSON.parse(reference);
const freezeReference=`globalThis.KneekuraMlbCourseReferenceV87=(function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;})(${reference.trim()});\n`;
const helpers=freezeReference+(await Promise.all(helperPaths.map(path=>readFile(path,'utf8')))).join('\n');
const debugPath='tools/browser-bridge/course-debug-panel-v87.js',debug=await readFile(debugPath,'utf8'),cssPath='docs/demos/baseball-maker-course-v87.css',css=await readFile(cssPath,'utf8');
if(/<\/script/i.test(helpers+debug)||/<\/style/i.test(css))throw Error('Unsafe script/style boundary');
let coreReplacements=0,helperReplacements=0,game=base.toString('utf8').replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/g,(all,open,body,close)=>{
 if(body.includes('var KneekuraNativeMatchCore =')){coreReplacements++;return open+core+'\n'+close;}
 if(open.includes('id="v79-course-season-helpers"')){helperReplacements++;return open+helpers+'\n'+close;}
 return all;
});
if(coreReplacements!==1||helperReplacements!==1)throw Error('Expected one Core and one season helper script');
game=once(game,'</head>','<style id="v87-course-charts">'+css+'</style>\n</head>');
game=once(game,'</body>','<script id="v87-course-debug">'+debug+'</script>\n</body>');
game=once(game,'inspect:()=>({version:83','inspect:()=>({version:87');
game=game.replace(/<title>[\s\S]*?<\/title>/,'<title>にーくらMINIbaseball v87 コース認識と打率</title>').replaceAll('描画と接地移動版 84','コース認識と打率版 87');
const driverPath='tools/browser-bridge/camera-workbench-v84.js',templatePath='tools/browser-bridge/camera-workbench-v81.html';
const driver=await readFile(driverPath,'utf8'),template=(await readFile(templatePath,'utf8')).replaceAll('調整室 v81','調整室 v87');
const sources=[...helperPaths,referencePath,debugPath,cssPath,'tools/browser-bridge/build-course-v87.mjs'];
const helpersMetadata={...previous.helpers};delete helpersMetadata['course-charts-v79.js'];delete helpersMetadata['live-season-match-v79.js'];
for(const path of helperPaths)helpersMetadata[path.split('/').at(-1)]=sha(await readFile(path));
const metadata={...previous,courseVersion:87,basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreChanged:true,
 helpers:helpersMetadata,publicCourse9ZoneOnly:false,publicCourse13Regions:true,courseChartCssSha256:sha(css),
 sourceGamePath:resolve(out,'ばせぼーるlv87_TBD_vs_LAD_コース認識と打率版.html'),sourceGameSha256:sha(game),
 sourceCoreSha256:sha(core),sourceInputCount:Object.keys(pins.inputs).length,sourceCoreInputCount:Object.keys(pins.inputs).length,frozenSourceManifestSha256:sha(pinsBytes),
 courseSources:Object.fromEntries(await Promise.all(sources.map(async path=>[path,sha(await readFile(path))]))),
 workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(await readFile(templatePath)),builderSha256:sha(await readFile('tools/browser-bridge/build-course-v87.mjs'))};
delete metadata.kind;delete metadata.sha256;
let lab=once(template,'__V73_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V73_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));lab=once(lab,'__V73_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});
for(const[name,html,kind]of[['ばせぼーるlv87_TBD_vs_LAD_コース認識と打率版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v87_コース認識.html',lab,'CAMERA_WORKBENCH']]){
 const path=resolve(out,name);await writeFile(path,html);await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');
 if(kind==='NORMAL_MATCH')await writeFile(path+'.bundle-inputs.json',pinsBytes);
 console.log(JSON.stringify({path,sha256:sha(html),sourceCoreSha256:sha(core)}));
}
