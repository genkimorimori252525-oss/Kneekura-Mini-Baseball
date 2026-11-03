import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {Script} from 'node:vm';

// Patch published v103 documents directly. There is no compiler, Core rebuild,
// helper refresh, audio generation, or authoring-data conversion in this step.
assert.equal(process.argv.length,3,'Usage: node tools/browser-bridge/build-camera-release-v104.mjs <new-candidate-directory>');
const out=resolve(process.argv[2]),sourceRoot=resolve('../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(dirname(out),sourceRoot,'The new candidate directory must be a direct child of outputs');
const coreSha256='35a50ab7730b1f4a78390cbca0506774269ec3f6c67dbd7b90a9abe7e8686052',
 makerBundleSha256='5c837e5d8893cf38fe195a3b75fd4c639fc84ada49376a6af48e827073e92779',
 oldGazeSha256='ce6df1ffdf622edf60f2435533a62bdeaefb6a71c6a5c1576445f4757ecba81d',
 controlsSuffixSha256='cd018494d3682ec6ab64fd709f1e68b3c529ed2410c10815418a9fb8fe3e80e8',
 helperSha256='11bc1872a99db3574d370a2d3b60500eea67d9c7f3313ecc19b22156308b8981',
 sourcePaths=['tools/browser-bridge/build-camera-release-v104.mjs','tools/browser-bridge/live-field-gaze-v99.js'],
 sourceBytes=await Promise.all(sourcePaths.map(path=>readFile(path))),v104Sources=Object.fromEntries(sourcePaths.map((path,i)=>[path,sha(sourceBytes[i])])),
 gaze=sourceBytes[1].toString('utf8'),frozenInputs=new Map();
assert(gaze.includes('root.KneekuraLiveFieldGazeV99=Object.freeze'),'Expected the live gaze implementation');
assert(!/<\/script\b/i.test(gaze),'Gaze source must be safe to embed as an inline script');
assert.notEqual(sha(gaze),oldGazeSha256,'The v104 gaze must differ from the frozen v103 implementation');
new Script(gaze,{filename:sourcePaths[1]});
async function frozen(path,expected){
 const bytes=await readFile(path);if(expected)assert.equal(sha(bytes),expected,'Frozen source '+path);
 frozenInputs.set(path,sha(bytes));return bytes;
}
assert.equal(sha(await frozen('tools/browser-bridge/live-field-camera.js')),helperSha256,'Frozen camera helper source');
const publicationPath='docs/verification/releases/v103/publish.json',publicationBytes=await frozen(publicationPath),publication=JSON.parse(publicationBytes);
assert.equal(publication.pass,true);assert.equal(publication.releaseVersion,103);assert.equal(publication.sourceCoreSha256,coreSha256);assert.equal(publication.sourceCoreInputCount,150);

const definitions=[
 {role:'game',source:'ばせぼーるlv103_TBD_vs_LAD_力込め送球版.html',name:'ばせぼーるlv104_TBD_vs_LAD_捕球視線版.html',sha256:'b9c0583da988e3232bd9a9fa3417dc5394fca70c2f036d440234dc63fa6ed199',metadataSha256:'4034a981463cfaf771aac493af36d42b5d5ebaed77ac5dcea6c967be2e40a69b'},
 {role:'maker',source:'にーくら野球メーカー_v103_力込め送球版.html',name:'にーくら野球メーカー_v104_捕球視線版.html',sha256:'c123601efcf66214ff9d90436a4c4e04d5362d46ab870093eeda62ae4e88016d',metadataSha256:'00e2ee675a61eeac9df73af716b7d392e7f5cfb9de312d49cfd12baa8ab93f33'},
 {role:'lab',source:'カメラワーク調整室_v103_力込め送球版.html',name:'カメラワーク調整室_v104_捕球視線版.html',sha256:'33c132742be6668c58cdf0d26528925b05b858b206641f3ddae25b7680cad8a3',metadataSha256:'b77c59c3eb38093f36eb82119f2af5c957a70d83618196e4d22a4bc7aebcf9fb'}
];
function publishedPin(path,hash){
 const rows=publication.rows.filter(row=>resolve(row.destination)===resolve(path));assert.equal(rows.length,1,'Published input '+path);assert.equal(rows[0].sha256,hash,'Publication receipt '+path);
}
function once(text,before,after,label){
 const at=text.indexOf(before);assert(at>=0,label+' missing');assert.equal(text.indexOf(before,at+before.length),-1,label+' must be unique');
 return text.slice(0,at)+after+text.slice(at+before.length);
}
const scripts=html=>[...html.matchAll(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi)].map(m=>({tag:m[1],body:m[2],close:m[3]}));
const encode=value=>JSON.stringify(value).replaceAll('<','\\u003c');
function jsonSpan(text,lead,label){
 const at=text.indexOf(lead);assert(at>=0,label+' missing');assert.equal(text.indexOf(lead,at+lead.length),-1,label+' must be unique');
 const start=at+lead.length;assert.equal(text[start],'"',label+' JSON string');let end=start+1;
 for(;end<text.length;end++){if(text[end]==='\\')end++;else if(text[end]==='"')break;}
 assert(end<text.length,label+' unterminated JSON string');const raw=text.slice(start,end+1),value=JSON.parse(raw);
 assert.equal(encode(value),raw,label+' original JSON encoding');return {raw,value};
}
function reverse(text,changes){for(const change of [...changes].reverse())text=once(text,change.to,change.from,'reverse '+change.label);return text;}
function scanScripts(before,after,changes,label,expectCore,expectMakerBundle){
 const a=scripts(before),b=scripts(after),changed=[],protectedScripts=[];assert.equal(a.length,b.length,label+' script count');let coreCount=0,makerBundleCount=0;
 for(let i=0;i<a.length;i++){
  const old=a[i],next=b[i],filename=label+' script '+i;assert.equal(next.tag,old.tag,filename+' tag');assert.equal(next.close,old.close,filename+' close');
  if(old.body.startsWith('// Native physical and aerodynamic rigid pitch bridge')){
   coreCount++;assert.equal(sha(old.body.slice(0,-1)),coreSha256,filename+' frozen native Core');assert.equal(next.body,old.body,filename+' Core bytes');
  }
  if(old.body.includes('var KneekuraBaseballWorkbench =')){
   makerBundleCount++;assert.equal(sha(old.body.trimStart().replace(/\n$/,'')),makerBundleSha256,filename+' frozen maker bundle');assert.equal(next.body,old.body,filename+' maker bundle bytes');
  }
  if(old.tag.includes('id="v36-field-camera"')){
   assert.equal(sha(old.body.slice(0,-1)),helperSha256,filename+' frozen camera helper');assert.equal(next.body,old.body,filename+' helper bytes');
  }
  if(next.body!==old.body){
   let expected=old.body;const allowed=[];
   for(const change of changes)if(expected.includes(change.from)){expected=once(expected,change.from,change.to,filename+' '+change.label);allowed.push(change.label);}
   assert(allowed.length>0,filename+' has no allowed replacement');assert.equal(next.body,expected,filename+' contains an unapproved change');
   changed.push({index:i,tag:old.tag,replacements:allowed,beforeSha256:sha(old.body),afterSha256:sha(next.body)});
  }else protectedScripts.push({index:i,tag:old.tag,sha256:sha(old.body),bytes:Buffer.byteLength(old.body)});
  if(!/\btype\s*=\s*["']application\/json["']/i.test(next.tag))new Script(next.body,{filename});
 }
 assert.equal(coreCount,expectCore?1:0,label+' frozen native Core count');assert.equal(makerBundleCount,expectMakerBundle?1:0,label+' frozen maker bundle count');
 let outside=before.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,'$1$3');
 for(const change of changes)if(outside.includes(change.from))outside=once(outside,change.from,change.to,label+' outside '+change.label);
 assert.equal(after.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,'$1$3'),outside,label+' unapproved non-script change');
 return {scriptCount:a.length,parsedJavaScript:true,onlyAllowedChanges:true,frozenCoreCount:coreCount,frozenMakerBundleCount:makerBundleCount,changedScripts:changed,protectedScripts};
}
function patchDocument(original,label,{game=false,role=null}={}){
 let html=original;const changes=[],embedded=[];
 function replace(from,to,name){html=once(html,from,to,label+' '+name);changes.push({from,to,label:name});}
 function embed(lead,name){
  const span=jsonSpan(html,lead,label+' '+name),patched=patchDocument(span.value,label+'/'+name,{game:true});
  replace(span.raw,encode(patched.html),name+' JSON');embedded.push({name,...patched.proof});
 }
 if(game){
  const found=scripts(html).filter(row=>row.tag==='<script id="field-gaze-v99">');assert.equal(found.length,1,label+' gaze script');
  const body=found[0].body,marker=body.indexOf("const key='kneekura.field-head.settings.v99'"),controlsStart=body.lastIndexOf('(function(root){',marker);
  assert(marker>=0&&controlsStart>0,label+' frozen controls seam');const oldPrefix=body.slice(0,controlsStart),suffix=body.slice(controlsStart);
  assert(oldPrefix.endsWith('\n'),label+' gaze separator');assert.equal(sha(oldPrefix.slice(0,-1)),oldGazeSha256,label+' frozen v103 gaze source');
  assert.equal(sha(suffix),controlsSuffixSha256,label+' frozen controls');replace(body,gaze+'\n'+suffix,'gaze prefix');
  replace('<title>にーくらMINIbaseball v103 力込め送球</title>','<title>にーくらMINIbaseball v104 捕球視線</title>','game title');
  replace('TBD対LAD 力込め送球版 103','TBD対LAD 捕球視線版 104','game edition label');
 }else if(role==='maker'){
  embed('globalThis.KneekuraMakerMatchHtmlV70=','KneekuraMakerMatchHtmlV70');embed('globalThis.KneekuraMakerPitcherMatchHtmlV77=','KneekuraMakerPitcherMatchHtmlV77');
  replace('<title>にーくら野球メーカー v103 力込め送球</title>','<title>にーくら野球メーカー v104 捕球視線</title>','maker title');
 }else if(role==='lab'){
  embed('const CAMERA_LAB_GAME_HTML=','CAMERA_LAB_GAME_HTML');
  replace('<title>にーくら カメラワーク調整室 v103 力込め送球</title>','<title>にーくら カメラワーク調整室 v104 捕球視線</title>','lab title');
  replace('<h1>カメラワーク調整室 <small>v103</small></h1>','<h1>カメラワーク調整室 <small>v104</small></h1>','lab edition label');
 }else assert.fail(label+' unknown document');
 const restored=reverse(html,changes);assert.equal(restored,original,label+' exact reverse reconstruction');
 return {html,proof:{beforeSha256:sha(original),afterSha256:sha(html),reverseSha256:sha(restored),exactReverseMatch:true,
  replacements:changes.map(({label,from,to})=>({label,beforeSha256:sha(from),afterSha256:sha(to)})),
  ...scanScripts(original,html,changes,label,game,role==='maker'),embedded}};
}

const artifacts=[];
for(const definition of definitions){
 const path=resolve(sourceRoot,definition.source);publishedPin(path,definition.sha256);publishedPin(path+'.build.json',definition.metadataSha256);
 const bytes=await frozen(path,definition.sha256),original=bytes.toString('utf8'),prior=JSON.parse(await frozen(path+'.build.json',definition.metadataSha256));
 assert.equal(Buffer.byteLength(original),bytes.length,definition.role+' UTF-8 round trip');assert.equal(prior.sha256,definition.sha256);assert.equal(prior.releaseVersion,103);
 assert.equal(prior.sourceCoreSha256,coreSha256);assert.equal(prior.sourceCoreInputCount,150);assert.equal(prior.sourceInputCount,150);
 const patched=patchDocument(original,definition.role,{game:definition.role==='game',role:definition.role});artifacts.push({...definition,path,prior,...patched});
}
const game=artifacts[0],maker=artifacts[1],sidecarDefinitions=[
 {artifact:game,suffix:'.bundle-inputs.json',sha256:'67fb2b38dd0214ea25e36381708609f1aea3979687e0f8534126d7941cb9cfbc'},
 {artifact:game,suffix:'.audio-manifest.json',sha256:'19141396315660ed39b2444f2ca818274dc5508643a7a6ca345283e501c9e93a'},
 {artifact:maker,suffix:'.bundle-inputs.json',sha256:'86db383ded6638ed1d4e325e0a9c0eb9467e5287ba0818dcf983e9911dcaa423'}
],sidecars=[];
for(const row of sidecarDefinitions){
 const path=row.artifact.path+row.suffix;publishedPin(path,row.sha256);const bytes=await frozen(path,row.sha256);
 sidecars.push({role:row.artifact.role,suffix:row.suffix,source:path,output:resolve(out,row.artifact.name)+row.suffix,sha256:sha(bytes),bytes:bytes.length,content:bytes});
}
const nativePins=JSON.parse(sidecars[0].content),makerPins=JSON.parse(sidecars[2].content);
assert.equal(nativePins.entrySha256,coreSha256);assert.equal(Object.keys(nativePins.inputs).length,150);
assert.equal(makerPins.entrySha256,makerBundleSha256);assert.equal(Object.keys(makerPins.inputs).length,118);
assert.equal(maker.prior.coreSha256,makerBundleSha256);assert.equal(maker.prior.bundleInputCount,118);assert.equal(maker.prior.bundleInputManifestSha256,sidecars[2].sha256);
for(const artifact of artifacts){assert.equal(artifact.prior.frozenSourceManifestSha256,sidecars[0].sha256);assert.equal(artifact.prior.audioPackManifestSha256,sidecars[1].sha256);}
const preserved={sourceCoreSha256:coreSha256,sourceCoreInputCount:150,frozenSourceManifestSha256:sidecars[0].sha256,audioPackManifestSha256:sidecars[1].sha256,
 makerBundleSha256,makerBundleInputCount:118,makerBundleInputManifestSha256:sidecars[2].sha256,
 liveFieldCameraSourceSha256:helperSha256,frozenControlsSuffixSha256:controlsSuffixSha256,originalGazeSourceSha256:oldGazeSha256};
async function verifyInputs(){
 for(const [path,hash]of frozenInputs)assert.equal(sha(await readFile(path)),hash,'Frozen input changed '+path);
 for(const [path,hash]of Object.entries(v104Sources))assert.equal(sha(await readFile(path)),hash,'v104 source changed '+path);
}
await verifyInputs();

// All source/proof/syntax checks finish before creating this new candidate.
// Existing candidates and every published v103 artifact remain untouched.
await mkdir(out);
for(const artifact of artifacts){
 const path=resolve(out,artifact.name),metadata={...artifact.prior,releaseVersion:104,fieldPresentationVersion:104,cameraPresentationVersion:104,
  v104Sources,cameraOnlyEffectiveSourcesV104:v104Sources,sourceReleaseMetadataV103:artifact.prior,
  sourceProvenancePolicyV104:'V103_SOURCE_MAPS_ARE_RETAINED_HISTORICAL_PROVENANCE; V104SOURCES_IS_THE_EFFECTIVE_GAZE_AND_BUILDER_OVERRIDE; NATIVE_AND_MAKER_BUNDLE_INPUTS_ARE_UNCHANGED',
  sourceV103BuildMetadataSha256:artifact.metadataSha256,sourceV103PublicationSha256:sha(publicationBytes),
  basePresentationPath:artifact.path,basePresentationSha256:artifact.sha256,sourceGamePath:resolve(out,game.name),sourceGameSha256:sha(game.html),
  sourceCoreChanged:false,worldPhysicsRulesAiChanged:false,worldBehaviorChanged:false,throwCommandTimingAndOutputChanged:false,
  ballPhysicsKernelChanged:false,adjudicationRulesChanged:false,cameraOnlyV104:true,releaseArtifactRole:artifact.role,
  v104GazeSourceSha256:sha(gaze),preservedV103:preserved,embeddedMetadataFrozenFromV103:true,
  ...(artifact.role==='maker'?{embeddedMatchRendererSha256:artifact.proof.embedded[0].afterSha256,embeddedPitcherRendererSha256:artifact.proof.embedded[1].afterSha256}:{}),
  sha256:sha(artifact.html),bytes:Buffer.byteLength(artifact.html)};
 const metadataBytes=JSON.stringify(metadata,null,2)+'\n';artifact.outputMetadataSha256=sha(metadataBytes);
 await writeFile(path,artifact.html,{flag:'wx'});await writeFile(path+'.build.json',metadataBytes,{flag:'wx'});
 console.log(JSON.stringify({output:path,sha256:metadata.sha256,exactReverseMatch:artifact.proof.exactReverseMatch}));
}
for(const row of sidecars)await writeFile(row.output,row.content,{flag:'wx'});
await verifyInputs();
const report={releaseVersion:104,cameraOnly:true,sourceRoot,outputDirectory:out,v104Sources,sourcePublicationPath:publicationPath,sourcePublicationSha256:sha(publicationBytes),preserved,
 frozenInputs:Object.fromEntries(frozenInputs),allCapturedInputsUnchanged:true,
 copiedSidecars:sidecars.map(({content,...row})=>row),
 artifacts:artifacts.map(artifact=>({role:artifact.role,source:artifact.path,output:resolve(out,artifact.name),sourceMetadataSha256:artifact.metadataSha256,
  outputMetadataSha256:artifact.outputMetadataSha256,...artifact.proof}))};
await writeFile(resolve(out,'build-report-v104.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({report:resolve(out,'build-report-v104.json'),sourceCoreSha256:coreSha256,sourceCoreInputCount:150,makerBundleSha256}));
