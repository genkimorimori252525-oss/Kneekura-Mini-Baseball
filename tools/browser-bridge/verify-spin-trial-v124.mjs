import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
const root='docs/verification/spin-trial-v124',folder=resolve(process.argv[2]),sha=v=>createHash('sha256').update(v).digest('hex'),json=async p=>JSON.parse(await readFile(p,'utf8')),
 build=await json(folder+'/build-report-v124.json'),snapshot=await json(folder+'/build-sources-v124.json'),previous=await json('docs/verification/traits-spin-continuation-v123/integrity.json');
assert.equal(build.releaseVersion,124);assert.equal(build.sourceCoreInputCount,195);assert(build.allCapturedInputsUnchanged);
assert.equal(sha(await readFile(folder+'/build-sources-v124.json')),build.sourceSnapshotSha256);
for(const [path,hash]of Object.entries(snapshot.inputs))assert.equal(sha(await readFile(path)),hash,'captured input '+path);
assert.equal(sha(await readFile('dist/native-match-core-browser.js')),build.sourceCoreSha256);
const artifacts=[];for(const row of build.artifacts){const meta=await json(row.path+'.build.json'),bytes=await readFile(row.path);
 assert.equal(meta.releaseVersion,124);assert.equal(meta.sourceCoreSha256,build.sourceCoreSha256);assert.equal(meta.sha256,sha(bytes));artifacts.push({path:row.path,bytes:bytes.length,sha256:meta.sha256});}
for(const row of [...previous.artifacts,...previous.delivery,...(await json('docs/verification/swing-remainder-v122/integrity.json')).artifacts])
 assert.equal(sha(await readFile(row.path)),row.sha256,'protected artifact');
const priorPins=await json(previous.artifacts.find(a=>a.path.includes('ばせぼーる')).path+'.bundle-inputs.json'),pins=await json(artifacts.find(a=>a.path.includes('ばせぼーる')).path+'.bundle-inputs.json'),
 permitted=new Set(['src/integration/browser/LiveBaseballMatchV1.ts','src/integration/browser/LivePitchV1.ts','src/integration/browser/LiveSpinControlV123.ts']);
assert.deepEqual(Object.keys(pins.inputs).sort(),Object.keys(priorPins.inputs).sort());
for(const [path,hash]of Object.entries(pins.inputs))if(hash!==priorPins.inputs[path])assert(permitted.has(path),'undeclared runtime change '+path);
const browser=await json('../../outputs/playwright/v124-03/browser.json'),nine=await json(root+'/nine-final/report.json'),library=await json(root+'/library-final/report.json'),parity=await json(root+'/ordinary-parity/report.json');
assert(browser.pass&&browser.worker.fullRecordExact);assert.deepEqual(browser.cases.map(c=>c.width),[1200,390]);assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.requests,[]);
assert.equal(browser.sha256,artifacts.find(a=>a.path.includes('メーカー')).sha256);assert.equal(browser.normalHtml.intent.selectedIntent,'BACKSPIN');
assert(nine.pass&&nine.finished&&nine.match.inning>=9);assert.equal(nine.pitches,259);assert.equal(nine.fieldPlays,50);assert.equal(nine.contacts,nine.fieldPlays);
assert(library.pass&&library.trials===673&&library.keyChecks===92201);assert.equal(library.measuredLibrarySha256,sha(await readFile('docs/demos/measured-bat-library-v1.json')));
assert(parity.pass&&parity.pitches===5);assert.equal(parity.previousCoreSha256,previous.sourceCoreSha256);
for(const evidence of [nine,library,parity])assert.equal(evidence.sourceCoreSha256,build.sourceCoreSha256);
const receipts={units:'0b046fae6864451db00f9a0e52618334',host:'029b95ee8f4a499a9e84b67b3a04e2d3',type:'e1744cee68c44c6b82c66dcae8a236ed',build:'99f7190ac60e44f9aec2ef4038f6d9dd',
 browser:'e64f797052ec40ecbee823a5c5786aee',nine:'914fafb4a1494f3d804b6110368301b4',library:'63b3c938a565461c8313c8c7a0176021',ordinaryParity:'5b73dd1302314f41800e931809539634'};
for(const [name,id]of Object.entries(receipts)){const r=await json('docs/ai-continuity/verification-receipts/MB-20261026-TRAITS-SPIN-CONTINUATION-V123_'+id+'.json');assert.equal(r.result,'PASS',name);assert.equal(r.exit_code,0);assert.equal(sha(await readFile(r.output_path)),r.output_sha256);}
const delivery=[];for(const a of artifacts){const target=resolve('../../outputs',basename(a.path));try{await copyFile(a.path,target,constants.COPYFILE_EXCL);}catch(e){if(e.code!=='EEXIST')throw e;assert.equal(sha(await readFile(target)),a.sha256);}
 assert.equal(sha(await readFile(target)),a.sha256);delivery.push({...a,path:target});}
const report={pass:true,boundary:'V124_SPIN_TRIAL_MILESTONE_NOT_ALL_PLANS_COMPLETE',version:124,sourceCoreSha256:build.sourceCoreSha256,sourceCoreInputCount:195,artifacts,delivery,receipts,
 units:249,hostTests:3,typecheck:true,ordinaryFullRecordParityPitches:5,realWorkerFullRecordPitches:1,pcMobileAndUnsavedTrial:true,
 measuredTrials:673,originalKeys:92201,nine:{pitches:259,fieldPlays:50,finished:true},priorArtifactsPreserved:true,
 limitations:previous.limitations.filter(v=>v!=='INITIAL_NATIVE_JOINT_SPIN_NOT_CONNECTED').concat('INITIAL_NATIVE_SPIN_CODE_CONNECTED_NOT_INTEGRATION_VERIFIED'),
 goal:'ACTIVE',sourcePushMergeDeploy:false};
await writeFile(root+'/integrity.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,boundary:report.boundary,units:249,hostTests:3,artifacts:3,goal:'ACTIVE'}));
