import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,basename} from 'node:path';
const folder=resolve(process.argv[2]),root='docs/verification/traits-spin-continuation-v123',
 sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p,'utf8')),
 build=await json(folder+'/build-report-v123.json'),snapshot=await json(folder+'/build-sources-v123.json');
assert.equal(build.releaseVersion,123);assert.equal(build.sourceCoreInputCount,195);assert(build.allCapturedInputsUnchanged);
assert.equal(sha(await readFile(folder+'/build-sources-v123.json')),build.sourceSnapshotSha256);
for(const [path,hash]of Object.entries(snapshot.inputs))assert.equal(sha(await readFile(path)),hash,'captured input '+path);
assert.equal(sha(await readFile('dist/native-match-core-browser.js')),build.sourceCoreSha256);
const artifacts=[];
for(const row of build.artifacts){const meta=await json(row.path+'.build.json'),bytes=await readFile(row.path);
 assert.equal(meta.releaseVersion,123);assert.equal(meta.sourceCoreSha256,build.sourceCoreSha256);assert.equal(meta.sha256,sha(bytes));
 artifacts.push({path:row.path,sha256:meta.sha256,bytes:bytes.length});}
for(const row of (await json('docs/verification/swing-remainder-v122/integrity.json')).artifacts)
 assert.equal(sha(await readFile(row.path)),row.sha256,'protected V122 artifact');
const prior=await json(root+'/baseline-v122-native-inputs.json'),pins=await json(artifacts.find(a=>a.path.includes('ばせぼーる')).path+'.bundle-inputs.json');
assert.equal(Object.keys(prior.inputs).length,192);assert(Object.keys(prior.inputs).every(p=>Object.hasOwn(pins.inputs,p)));
const browser=await json('../../outputs/playwright/v123-04/browser.json'),nine=await json(root+'/nine-final/report.json'),library=await json(root+'/library-final/report.json');
assert(browser.pass&&browser.worker.fullRecordExact&&browser.worker.consumed===1);assert.deepEqual(browser.cases.map(c=>c.width),[1200,390]);
assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.requests,[]);assert.equal(browser.sha256,artifacts.find(a=>a.path.includes('メーカー')).sha256);
assert.equal(browser.normalHtml.intent.selectedIntent,'BACKSPIN');assert.equal(browser.normalHtml.intent.nativeAdmission,false);
assert(nine.pass&&nine.finished&&nine.match.inning>=9&&nine.halfChanges>=16);assert.equal(nine.contacts,nine.fieldPlays);assert.equal(nine.sourceCoreSha256,build.sourceCoreSha256);
assert(library.pass&&library.trials===673&&library.players===98&&library.keyChecks===92201);assert.equal(library.sourceCoreSha256,build.sourceCoreSha256);
assert.equal(sha(await readFile('docs/demos/measured-bat-library-v1.json')),library.measuredLibrarySha256);
const receipts={unit:'e51237d159ae47e8a622806fac724d02',nativePractice:'ea86f477ef424e8399b28c4b323ccd9b',type:'4ce19bf26d6146d181f0af93c4b041f6',
 build:'58571c029bc84dc8b3816d7df0f3b609',browser:'87cf44700b3f491e9eb7a1ea2e03229d',nine:'2f45f215b5b24632883aa7582b4ab358',library:'104fa7a23fc04cd090c85dadd6a377c7'};
for(const [name,id]of Object.entries(receipts)){const r=await json('docs/ai-continuity/verification-receipts/MB-20261026-TRAITS-SPIN-CONTINUATION-V123_'+id+'.json');
 assert.equal(r.result,'PASS',name);assert.equal(r.exit_code,0);assert.equal(sha(await readFile(r.output_path)),r.output_sha256);}
const manifest=await json(root+'/source-manifest.json');
for(const row of manifest.files){const b=await readFile(root+'/upstream/'+basename(row.path));assert.equal(sha(b),row.sha256);
 assert.equal(createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),row.git_blob);}
const report={pass:true,boundary:'V123_SPIN_MILESTONE_NOT_ALL_PLANS_COMPLETE',version:123,sourceCoreSha256:build.sourceCoreSha256,sourceCoreInputCount:195,
 capturedInputs:Object.keys(snapshot.inputs).length,artifacts,receipts,unitTests:211,nativePracticeTests:13,typecheck:true,pcMobileAndNormalImport:true,
 realWorkerFullRecordPitches:1,measuredTrials:673,rawMeasuredKeys:92201,previousArtifactsPreserved:true,
 nine:{pitches:nine.pitches,fieldPlays:nine.fieldPlays,finished:true,syntheticControlFixture:nine.syntheticControlFixture},
 limitations:['LOCAL_AUTHORING_IS_NOT_NATIVE_QUALIFICATION','NATIVE_QUALIFIED_SKILL_MATCH_ADOPTION_NOT_VERIFIED','NATIVE_INFLIGHT_FULL_PATH_TIMEOUT_RETAINED',
  'INITIAL_NATIVE_JOINT_SPIN_NOT_CONNECTED','NATIVE_MULTIPLE_SKILL_GOLD_NOT_VERIFIED','SIGN_NAMING_SCOPE_AWAITING_USER','LONG_COHORT_NOT_RUN',
  'V122_REMAINDERS_RETAINED','POLE_OWNER_NOT_CONNECTED','ORIGINAL_PERFORMANCE_AND_CROSS_RUNTIME_GAPS_RETAINED'],goal:'ACTIVE',sourcePushMergeDeploy:false};
if(process.argv.includes('--publish-aliases')){
 report.delivery=[];
 for(const a of artifacts){const target=resolve('../../outputs',basename(a.path));
  try{await copyFile(a.path,target,constants.COPYFILE_EXCL);}catch(e){if(e.code!=='EEXIST')throw e;assert.equal(sha(await readFile(target)),a.sha256,'existing delivery differs');}
  assert.equal(sha(await readFile(target)),a.sha256);report.delivery.push({...a,path:target});}
}
await writeFile(root+'/integrity.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:true,boundary:report.boundary,artifacts:3,unitTests:211,nativePracticeTests:13,nine:report.nine,goal:report.goal}));
