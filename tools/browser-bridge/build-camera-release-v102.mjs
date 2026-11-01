import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {Script} from 'node:vm';

// Deliberately patch the frozen standalone files. Do not rebuild Match Core,
// refresh helpers, or regenerate any audio/physics/source-input bundle here.
assert.equal(process.argv.length,3,'Usage: node tools/browser-bridge/build-camera-release-v102.mjs <new-candidate-directory>');
const out=resolve(process.argv[2]),sourceRoot=resolve('../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(dirname(out),sourceRoot,'The new candidate directory must be a direct child of outputs');
const coreSha256='ef81b4e074b35bbde102359efd3e84f66bdb8b20be38fdf3d653a129e5311585',
 oldGazeSha256='a774d7b36c512b4c6bf65178b3a890ccc50cbca75aa2cc6fd1566f9a41866aa7',
 controlsSuffixSha256='cd018494d3682ec6ab64fd709f1e68b3c529ed2410c10815418a9fb8fe3e80e8',
 helperSha256='11bc1872a99db3574d370a2d3b60500eea67d9c7f3313ecc19b22156308b8981',
 sourcePaths=['tools/browser-bridge/build-camera-release-v102.mjs','tools/browser-bridge/live-field-gaze-v99.js'],
 sourceBytes=await Promise.all(sourcePaths.map(p=>readFile(p))),v102Sources=Object.fromEntries(sourcePaths.map((p,i)=>[p,sha(sourceBytes[i])])),
 gaze=sourceBytes[1].toString('utf8');
assert(gaze.includes('root.KneekuraLiveFieldGazeV99=Object.freeze'),'Expected the live gaze implementation');
assert(!/<\/script\b/i.test(gaze),'Gaze source must be safe to embed as an inline script');
assert.notEqual(sha(gaze),oldGazeSha256,'The v102 gaze must differ from the frozen v101 implementation');
new Script(gaze,{filename:sourcePaths[1]});
assert.equal(sha(await readFile('tools/browser-bridge/live-field-camera.js')),helperSha256,'The camera helper must remain frozen');

const definitions=[
 {role:'game',source:'ばせぼーるlv101_TBD_vs_LAD_捕球動作と地面減速版.html',name:'ばせぼーるlv102_TBD_vs_LAD_送球視線版.html',sha256:'362a3b703d0359742db91f781ba8993d715579c73a2bd95e9ce4d6eac5079037'},
 {role:'maker',source:'にーくら野球メーカー_v101_編集復帰と守備調整版.html',name:'にーくら野球メーカー_v102_送球視線版.html',sha256:'e9fa2e4137159247d7717efac2c2b0197c4236814228e2f320ea95d835099344'},
 {role:'lab',source:'カメラワーク調整室_v101_捕球視線版.html',name:'カメラワーク調整室_v102_送球視線版.html',sha256:'b1f732329243cdf48607d069bec1981752236ba9070830933f843d1cbdbd97d3'}
];
function once(s,from,to,label){
 const at=s.indexOf(from);assert(at>=0,label+' missing');assert.equal(s.indexOf(from,at+from.length),-1,label+' must be unique');
 return s.slice(0,at)+to+s.slice(at+from.length);
}
function scripts(s){return [...s.matchAll(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi)].map(m=>({tag:m[1],body:m[2],close:m[3]}));}
function encode(value){return JSON.stringify(value).replaceAll('<','\\u003c');}
function jsonSpan(s,lead,label){
 const at=s.indexOf(lead);assert(at>=0,label+' missing');assert.equal(s.indexOf(lead,at+lead.length),-1,label+' must be unique');
 const from=at+lead.length;assert.equal(s[from],'"',label+' JSON string');let to=from+1;
 for(;to<s.length;to++){if(s[to]==='\\')to++;else if(s[to]==='"')break;}
 assert(to<s.length,label+' unterminated JSON string');const raw=s.slice(from,to+1),value=JSON.parse(raw);
 assert.equal(encode(value),raw,label+' must retain its original JSON encoding');return {raw,value};
}
function reverse(s,changes){for(const change of [...changes].reverse())s=once(s,change.to,change.from,'reverse '+change.label);return s;}

// Check every script in each document, including the three decoded games.
// A changed script must be precisely explained by the recorded substitutions.
function scanScripts(before,after,changes,label,expectCore){
 const a=scripts(before),b=scripts(after),changed=[],protectedScripts=[];
 assert.equal(a.length,b.length,label+' script count');let coreCount=0;
 for(let i=0;i<a.length;i++){
  const old=a[i],next=b[i],filename=label+' script '+i;assert.equal(next.tag,old.tag,filename+' tag');assert.equal(next.close,old.close,filename+' close');
  if(old.body.startsWith('// Native physical and aerodynamic rigid pitch bridge')){
   coreCount++;assert.equal(sha(old.body.slice(0,-1)),coreSha256,filename+' frozen core');assert.equal(next.body,old.body,filename+' core bytes');
  }
  if(old.tag.includes('id="v36-field-camera"')){
   assert.equal(sha(old.body.slice(0,-1)),helperSha256,filename+' frozen camera helper');assert.equal(next.body,old.body,filename+' helper bytes');
  }
  if(next.body!==old.body){
   let expected=old.body;const allowed=[];
   for(const change of changes)if(expected.includes(change.from)){expected=once(expected,change.from,change.to,filename+' '+change.label);allowed.push(change.label);}
   assert(allowed.length>0,filename+' has no allowed replacement');assert.equal(next.body,expected,filename+' contains an unapproved change');
   changed.push({index:i,tag:old.tag,replacements:allowed,beforeSha256:sha(old.body),afterSha256:sha(next.body)});
  }else if(/audio-bank-v100|audio-runtime-v100/.test(old.tag)||/KneekuraAudioPackV100=|root\.KneekuraAudioV100=|KneekuraLiveFieldCamera=Object\.freeze/.test(old.body)||old.body.startsWith('// Native physical and aerodynamic rigid pitch bridge')){
   protectedScripts.push({index:i,tag:old.tag,sha256:sha(old.body),bytes:Buffer.byteLength(old.body)});
  }
  if(!/\btype\s*=\s*["']application\/json["']/i.test(next.tag))new Script(next.body,{filename});
 }
 if(expectCore)assert.equal(coreCount,1,label+' must contain exactly one frozen core');
 let outside=before.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,'$1$3');
 for(const change of changes)if(outside.includes(change.from))outside=once(outside,change.from,change.to,label+' outside '+change.label);
 assert.equal(after.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,'$1$3'),outside,label+' unapproved non-script change');
 return {scriptCount:a.length,parsedJavaScript:true,onlyAllowedChanges:true,frozenCoreCount:coreCount,changedScripts:changed,protectedScripts};
}
function patchDocument(original,label,{game=false,role=null}={}){
 let html=original;const changes=[],embedded=[];
 function replace(from,to,name){html=once(html,from,to,label+' '+name);changes.push({from,to,label:name});}
 function embed(lead,name){
  const span=jsonSpan(html,lead,label+' '+name),patched=patchDocument(span.value,label+'/'+name,{game:true});
  replace(span.raw,encode(patched.html),name+' JSON');embedded.push({name,...patched.proof});
 }
 if(game){
  const matches=scripts(html).filter(s=>s.tag==='<script id="field-gaze-v99">');assert.equal(matches.length,1,label+' gaze script');
  const body=matches[0].body,marker=body.indexOf("const key='kneekura.field-head.settings.v99'"),controlsStart=body.lastIndexOf('(function(root){',marker);
  assert(marker>=0&&controlsStart>0,label+' frozen controls seam');const oldPrefix=body.slice(0,controlsStart),suffix=body.slice(controlsStart);
  assert(oldPrefix.endsWith('\n'),label+' gaze separator');assert.equal(sha(oldPrefix.slice(0,-1)),oldGazeSha256,label+' frozen gaze source');
  assert.equal(sha(suffix),controlsSuffixSha256,label+' frozen control suffix');
  replace(body,gaze+'\n'+suffix,'gaze prefix');
  replace('<title>にーくらMINIbaseball v101 編集復帰と捕球動作</title>','<title>にーくらMINIbaseball v102 送球視線</title>','game title');
  replace('TBD対LAD 編集復帰と捕球動作版 101','TBD対LAD 送球視線版 102','game edition label');
 }else if(role==='maker'){
  embed('globalThis.KneekuraMakerMatchHtmlV70=','KneekuraMakerMatchHtmlV70');
  embed('globalThis.KneekuraMakerPitcherMatchHtmlV77=','KneekuraMakerPitcherMatchHtmlV77');
  replace('<title>にーくら野球メーカー v101 編集復帰と守備調整</title>','<title>にーくら野球メーカー v102 送球視線</title>','maker title');
 }else if(role==='lab'){
  embed('const CAMERA_LAB_GAME_HTML=','CAMERA_LAB_GAME_HTML');
  replace('<title>にーくら カメラワーク調整室 v101</title>','<title>にーくら カメラワーク調整室 v102 送球視線</title>','lab title');
  replace('<h1>カメラワーク調整室 <small>v101</small></h1>','<h1>カメラワーク調整室 <small>v102</small></h1>','lab edition label');
 }else assert.fail(label+' unknown document');
 const restored=reverse(html,changes);assert.equal(restored,original,label+' exact reverse reconstruction');
 const scriptProof=scanScripts(original,html,changes,label,game);
 return {html,proof:{beforeSha256:sha(original),afterSha256:sha(html),reverseSha256:sha(restored),exactReverseMatch:true,
  replacements:changes.map(({label,from,to})=>({label,beforeSha256:sha(from),afterSha256:sha(to)})),...scriptProof,embedded}};
}

const artifacts=[];
for(const definition of definitions){
 const path=resolve(sourceRoot,definition.source),bytes=await readFile(path),original=bytes.toString('utf8'),prior=JSON.parse(await readFile(path+'.build.json','utf8'));
 assert.equal(sha(bytes),definition.sha256,definition.role+' frozen v101 file');assert.equal(Buffer.byteLength(original),bytes.length,definition.role+' UTF-8 round trip');
 assert.equal(prior.sha256,definition.sha256,definition.role+' frozen metadata');assert.equal(prior.sourceCoreSha256,coreSha256,definition.role+' core pin');
 assert.equal(prior.sourceCoreInputCount,149,definition.role+' core input count');assert.equal(prior.sourceInputCount,149,definition.role+' source input count');
 const patched=patchDocument(original,definition.role,{game:definition.role==='game',role:definition.role});
 artifacts.push({...definition,path,prior,...patched});
}
const game=artifacts[0],pinBytes=await readFile(game.path+'.bundle-inputs.json'),pins=JSON.parse(pinBytes),audioManifestBytes=await readFile(game.path+'.audio-manifest.json');
assert.equal(sha(pinBytes),game.prior.frozenSourceManifestSha256,'Frozen core input manifest bytes');
assert.equal(pins.entrySha256,coreSha256,'Frozen core manifest entry');assert.equal(Object.keys(pins.inputs).length,149,'Frozen core input manifest count');
assert.equal(sha(audioManifestBytes),game.prior.audioPackManifestSha256,'Frozen audio manifest bytes');
for(const artifact of artifacts){assert.equal(artifact.prior.frozenSourceManifestSha256,sha(pinBytes));assert.equal(artifact.prior.audioPackManifestSha256,sha(audioManifestBytes));}
const report={releaseVersion:102,cameraOnly:true,sourceRoot,outputDirectory:out,v102Sources,
 preserved:{sourceCoreSha256:coreSha256,sourceCoreInputCount:149,frozenSourceManifestSha256:sha(pinBytes),audioPackManifestSha256:sha(audioManifestBytes),
  liveFieldCameraSourceSha256:helperSha256,frozenControlsSuffixSha256:controlsSuffixSha256,originalGazeSourceSha256:oldGazeSha256},
 artifacts:artifacts.map(a=>({role:a.role,source:a.path,output:resolve(out,a.name),...a.proof}))};

// mkdir without recursive and every wx write make candidate reuse fail closed.
// All input/proof/syntax checks finish before the first output is created.
await mkdir(out);
for(const artifact of artifacts){
 const path=resolve(out,artifact.name),metadata={...artifact.prior,releaseVersion:102,fieldPresentationVersion:102,cameraPresentationVersion:102,v102Sources,
  basePresentationPath:artifact.path,basePresentationSha256:artifact.sha256,sourceGamePath:resolve(out,game.name),sourceGameSha256:sha(game.html),
  cameraOnlyV102:true,releaseArtifactRole:artifact.role,sha256:sha(artifact.html),bytes:Buffer.byteLength(artifact.html)};
 await writeFile(path,artifact.html,{flag:'wx'});await writeFile(path+'.build.json',JSON.stringify(metadata,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({output:path,sha256:metadata.sha256,exactReverseMatch:artifact.proof.exactReverseMatch}));
}
await writeFile(resolve(out,game.name)+'.bundle-inputs.json',pinBytes,{flag:'wx'});
await writeFile(resolve(out,game.name)+'.audio-manifest.json',audioManifestBytes,{flag:'wx'});
await writeFile(resolve(out,'build-report-v102.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({report:resolve(out,'build-report-v102.json'),sourceCoreSha256:coreSha256,sourceCoreInputCount:149}));
