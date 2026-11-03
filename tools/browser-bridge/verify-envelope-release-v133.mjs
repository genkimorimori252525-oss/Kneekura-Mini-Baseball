import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';

const root='docs/verification/swing-envelope-v133',folder=resolve(process.argv[2]);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),json=async path=>JSON.parse(await readFile(path,'utf8'));
const build=await json(folder+'/build-report-v133.json'),snapshot=await json(folder+'/build-sources-v133.json');
assert.equal(build.releaseVersion,133);assert.equal(build.sourceCoreInputCount,197);assert(build.allCapturedInputsUnchanged);
assert.equal(sha(await readFile(folder+'/build-sources-v133.json')),build.sourceSnapshotSha256);
for(const [path,hash] of Object.entries(snapshot.inputs))assert.equal(sha(await readFile(path)),hash,'captured input '+path);
assert.equal(sha(await readFile('dist/native-match-core-browser.js')),build.sourceCoreSha256);
const artifacts=[];
for(const row of build.artifacts){
 const bytes=await readFile(row.path),meta=await json(row.path+'.build.json');
 assert.equal(meta.releaseVersion,133);assert.equal(meta.sourceCoreSha256,build.sourceCoreSha256);assert.equal(meta.sha256,sha(bytes));
 artifacts.push({path:row.path,bytes:bytes.length,sha256:meta.sha256});
}
assert.equal(artifacts.length,3);
const previous=await json('docs/verification/spin-trial-v124/integrity.json');
const oldPins=await json(previous.artifacts.find(row=>row.path.includes('ばせぼーる')).path+'.bundle-inputs.json');
const pins=await json(artifacts.find(row=>row.path.includes('ばせぼーる')).path+'.bundle-inputs.json');
const added=['src/core/sim/contact/ReferenceBatEnvelopeV133.ts','src/integration/browser/LiveSwingEnvelopeV133.ts'];
assert.deepEqual(Object.keys(pins.inputs).sort(),[...Object.keys(oldPins.inputs),...added].sort());
const permitted=new Set([...added,'src/core/sim/contact/ReferenceBatC1V122.ts','src/core/sim/contact/ReferenceBatMotorV121.ts',
 'src/core/sim/contact/ReferenceBatKinematicsV1.ts','src/integration/browser/LivePitchV1.ts',
 'src/integration/browser/LivePhysicalRosterV1.ts','src/integration/browser/LiveBatPlaybackV88.ts']);
for(const [path,hash] of Object.entries(pins.inputs))if(hash!==oldPins.inputs[path])assert(permitted.has(path),'undeclared browser Source '+path);
let protectedCount=0;
for(const manifest of ['docs/verification/spin-trial-v124/integrity.json','docs/verification/traits-spin-continuation-v123/integrity.json',
 'docs/verification/swing-remainder-v122/integrity.json']){
 const prior=await json(manifest);
 for(const row of [...prior.artifacts,...(prior.delivery??[])]){
  assert.equal(sha(await readFile(row.path)),row.sha256,'protected prior artifact');protectedCount++;
 }
}
const evidence=await json(root+'/DELIVERY-EVIDENCE.json');
assert.equal(evidence.taskId,'MB-20261026-TRAITS-SPIN-CONTINUATION-V123');
for(const key of ['core','integration','type','library','build','browser','parity','nine']){
 const id=evidence.receipts[key];assert.match(id,/^[a-f0-9]{32}$/);
 const receipt=await json('docs/ai-continuity/verification-receipts/'+evidence.taskId+'_'+id+'.json');
 assert.equal(receipt.task_id,evidence.taskId,key+' task');assert.equal(receipt.result,'PASS',key);assert.equal(receipt.exit_code,0,key);
 assert.equal(sha(await readFile(receipt.output_path)),receipt.output_sha256,key+' log');
}
const library=await json(root+'/library-clock-final/report.json'),browser=await json(evidence.browserReport),
 parity=await json(root+'/ordinary-parity/report.json'),nine=await json(root+'/nine-functional-final/report.json');
assert(library.pass&&library.trials===673&&library.keyChecks===92201);assert.deepEqual(library.errors,[]);
assert.equal(library.compiledHelperSha,'8da75570d9941bbb7885d82710454759e7a61fa934c297006983b7007c5232d2');
assert.equal(library.sourceSha,sha(await readFile('docs/demos/measured-bat-library-v1.json')));
assert(browser.pass&&browser.worker.fullRecordExact);assert(browser.worker.createdWorkers>0);assert.equal(browser.worker.consumed,1);
assert.equal(browser.worker.envelope.status,'APPLIED');assert.equal(browser.worker.envelope.finalEnvelopeCertificateChecked,true);
assert.deepEqual(browser.cases.map(row=>row.width),[1200,390]);assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.requests,[]);
assert.equal(browser.makerSha256,artifacts.find(row=>row.path.includes('メーカー')).sha256);
assert(parity.pass&&parity.pitches===5);assert.equal(parity.previousCoreSha256,previous.sourceCoreSha256);
assert(nine.pass&&nine.finished&&nine.match.inning>=9);assert.equal(nine.pitches,259);assert.equal(nine.fieldPlays,50);assert.equal(nine.contacts,nine.fieldPlays);
assert.deepEqual(nine.syntheticControlFixture,{timingStdSeconds:.04,aimStdMeters:.1});
for(const report of [nine,parity])assert.equal(report.sourceCoreSha256,build.sourceCoreSha256);
const delivery=[];
for(const artifact of artifacts){
 const target=resolve('../../outputs',basename(artifact.path));
 try{await copyFile(artifact.path,target,constants.COPYFILE_EXCL);}catch(error){
  if(error.code!=='EEXIST')throw error;assert.equal(sha(await readFile(target)),artifact.sha256,'existing delivery differs');
 }
 assert.equal(sha(await readFile(target)),artifact.sha256);delivery.push({...artifact,path:target});
}
const report={pass:true,boundary:'V133_OPTIONAL_SWING_ENVELOPE_MILESTONE_NOT_WHOLE_GOAL_COMPLETION',version:133,
 sourceCoreSha256:build.sourceCoreSha256,sourceCoreInputCount:197,artifacts,delivery,receipts:evidence.receipts,
 coreTests:43,integrationTests:95,originalMeasuredTrials:673,originalKeys:92201,protectedArtifacts:protectedCount,
 ordinaryFullRecordParityPitches:5,realWorkerFullRecordPitches:1,pcMobileAuthorEditor:true,
 nine:{pitches:nine.pitches,fieldPlays:nine.fieldPlays,finished:nine.finished,functionalBudgetSeconds:300,performance180SecondsPassed:false},
 limitations:['BOUNDARY_POSES_AND_LIMITS_EXPLICIT_AUTHOR_SOURCE_NOT_HUMAN_MEASUREMENTS','NATIVE_BODY_REACH_TORQUE_NOT_CERTIFIED',
 'ABORT_OFFERED_AT_AND_OTHER_TASK5_ITEMS_STILL_PENDING','NATIVE_FIRST_PITCH_AND_NATURAL_SPIN_CALIBRATION_NOT_PROVEN_BY_THIS_GATE',
 'LEGACY_FULL_CLIP_CLOCK_CONSERVATIVE_REJECTION_RETAINED','NINE_INNINGS_180_SECOND_TIME_LIMIT_NOT_MET_FUNCTIONAL_GATE_SEPARATE',
 'POST_GOAL_MAKER_USABILITY_SPRAY_AND_PITCH_COMPARISON_FIXES_QUEUED'],
 goal:'ACTIVE',signatureAutomaticNaming:'DEFERRED_UNTIL_PENNANT',sourcePushMergeDeploy:false};
await writeFile(root+'/integrity.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:true,version:133,artifacts:artifacts.length,protectedArtifacts:protectedCount,goal:'ACTIVE'}));
