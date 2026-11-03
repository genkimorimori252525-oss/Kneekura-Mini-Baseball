import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const folder=resolve(process.argv[2]),root=resolve('docs/verification/swing-pitch-v121-2026-10-26'),
 sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p,'utf8')),
 build=await json(folder+'/build-report-v121.json'),snapshot=await json(folder+'/build-sources-v121.json');
assert.equal(build.releaseVersion,121);assert.equal(build.sourceCoreInputCount,183);
assert.equal(sha(await readFile(folder+'/build-sources-v121.json')),build.sourceSnapshotSha256);
for(const [path,hash]of Object.entries(snapshot.inputs))assert.equal(sha(await readFile(path)),hash,'captured source '+path);
assert.equal(sha(await readFile('dist/native-match-core-browser.js')),build.sourceCoreSha256);
const artifacts=[];
for(const row of build.artifacts){const path=row.path,meta=await json(path+'.build.json'),bytes=await readFile(path);
 assert.equal(meta.sha256,sha(bytes));assert.equal(meta.releaseVersion,121);assert.equal(meta.sourceCoreSha256,build.sourceCoreSha256);
 artifacts.push({path,sha256:meta.sha256,bytes:bytes.length});}
const browser=await json(root+'/browser-final-10/browser.json'),movement=await json(root+'/movement-final-10/report.json'),
 nine=await json(root+'/nine-control/report.json'),priorNine=await json(root+'/nine-v3/report.json');
assert(browser.pass&&browser.normalHtmlImportedPolicy&&browser.normalImportProofUsesAuthoredForcedSwing);
assert.deepEqual(browser.cases.map(c=>c.width),[1200,390]);assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.requests,[]);
assert.equal(browser.makerSha256,artifacts.find(a=>a.path.includes('メーカー')).sha256);
assert(movement.pass);assert.equal(movement.makerSha256,browser.makerSha256);assert.equal(movement.cases.length,3);
assert(nine.pass&&nine.finished&&nine.match.inning>=9&&nine.halfChanges>=16);
assert.equal(nine.contacts,nine.fieldPlays);assert.equal(nine.sourceCoreSha256,build.sourceCoreSha256);
assert(priorNine.pass&&priorNine.finished);assert.equal(priorNine.contacts,priorNine.fieldPlays);
const receiptPath=id=>'docs/ai-continuity/verification-receipts/MB-20261026-SWING-VISION-PITCH-V121_'+id+'.json';
const unit=await json(receiptPath('46c22e68aa624d5a851d99c99bb60fe0')),type=await json(receiptPath('fd741d40774d42ea8d6f745c037f1b37'));
for(const r of [unit,type]){assert.equal(r.task_id,'MB-20261026-SWING-VISION-PITCH-V121');assert.equal(r.result,'PASS');assert.equal(r.exit_code,0);assert.equal(sha(await readFile(r.output_path)),r.output_sha256);}
assert.match(await readFile(unit.output_path,'utf8'),/Tests\s+227 passed/);
const sourceManifest=await json(root+'/upstream/source-manifest.json');
for(const row of sourceManifest.files){const b=await readFile(root+'/upstream/'+row.name),blob=createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');assert.equal(blob,row.gitBlobSha);}
const library=await readFile('docs/demos/measured-bat-library-v1.json');
assert.equal(sha(library),'b53a8d687f663a5578315120445de1407fb82efec594cde27cc313c1ea5b106a');
const decode=new Function(await readFile('tools/browser-bridge/measured-bat-library-v1.js','utf8')+';return KneekuraMeasuredBatLibrary.decode;')(),clips=decode(library.toString('utf8')).clips;
assert.equal(clips.length,673);assert.equal(new Set(clips.map(c=>c.id)).size,673);
assert.deepEqual(await readFile(root+'/regenerated-builder-v121.mjs'),await readFile('tools/browser-bridge/build-field-release-v121.mjs'));
const baseline=await json(root+'/baseline-v120-native-inputs.json'),pins=await json(artifacts.find(a=>a.path.includes('ばせぼーる')).path+'.bundle-inputs.json');
assert.equal(Object.keys(baseline.inputs).length,175);assert(Object.keys(baseline.inputs).every(p=>Object.hasOwn(pins.inputs,p)));
const report={pass:true,version:121,sourceCoreSha256:build.sourceCoreSha256,sourceCoreInputCount:183,capturedInputs:Object.keys(snapshot.inputs).length,
 artifacts,tests:227,typecheck:true,pcMobileAndNormalImport:true,allPitchMovementPresets:true,rawGitBlobsExact:5,measuredTrials:673,measuredLibraryUnchanged:true,
 nineFinal:{pitches:nine.pitches,fieldPlays:nine.fieldPlays,finished:nine.finished,syntheticControlFixture:nine.syntheticControlFixture},
 ninePrior:{pitches:priorNine.pitches,fieldPlays:priorNine.fieldPlays,finished:priorNine.finished,sourceCoreSha256:priorNine.sourceCoreSha256},
 limitations:['FULL_HOST_SUITE_300_SECOND_TIMEOUT','EXPLICIT_BAT_BASELINE_CALIBRATION_REQUIRED','PHASE_CLOCK_NOT_ANATOMICAL_TORQUE_CALIBRATION',
  'FULL_BAT_DIR_CATCH_PSYCHOLOGY_FATIGUE_NOT_COMPLETE','V120_ONE_PERFORMANCE_SCENE_OPEN','CROSS_RUNTIME_NUMERIC_PARITY_NOT_ESTABLISHED','100_GAME_CALIBRATION_NOT_RUN'],
 rawFailureReceiptsRetained:true,sourcePushMergeDeploy:false};
await writeFile(root+'/integrity.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,tests:report.tests,inputs:report.sourceCoreInputCount,artifacts:artifacts.length,sourceCoreSha256:report.sourceCoreSha256}));
