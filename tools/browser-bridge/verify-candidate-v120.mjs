import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const task='MB-20261025-COOPERATIVE-DEFENSE-V120',sha=b=>createHash('sha256').update(b).digest('hex'),
 json=async p=>JSON.parse(await readFile(p,'utf8')),config=await json(process.argv[2]),folder=resolve(config.candidate),
 build=await json(folder+'/build-report-v120.json'),snapshot=await json(folder+'/build-sources-v120.json'),
 reports=Object.fromEntries(await Promise.all(Object.entries(config.reports).map(async([key,path])=>[key,await json(path)])));
assert.equal(dirname(folder),resolve('../../outputs'));assert.equal(build.releaseVersion,120);assert.equal(build.sourceCoreInputCount,175);
assert.equal(sha(await readFile(folder+'/build-sources-v120.json')),build.sourceSnapshotSha256);
assert(build.allCapturedInputsUnchanged&&build.backgroundRuntimePatchVerifiedV116);
for(const [path,hash]of Object.entries(snapshot.inputs))assert.equal(sha(await readFile(path)),hash,'captured input: '+path);
for(const [key,r]of Object.entries(reports))if(key!=='performance')assert.equal(r.pass,true,key);
const {browser,authoring,context,contextExtra,background,athletic,nine,buffer,exactAir,performance}=reports;
assert.equal(browser.version,120);assert.equal(browser.cases.length,12);assert(browser.viewportIndependentSource);
assert.equal(authoring.widths.length,2);assert(authoring.legacyUserJsonImportAndBodyEdit);
assert.equal(authoring.makerSha256,browser.sha256.maker);assert.equal(background.gameSha256,browser.sha256.game);
assert.equal(background.cases.length,2);assert.equal(context.cases.length,12);assert.equal(contextExtra.cases.length,7);
for(const r of [context,contextExtra,nine,exactAir,performance])assert.equal(r.sourceCoreSha256,build.sourceCoreSha256);
assert(nine.finished&&nine.match.inning>=9&&nine.halfChanges>=16);assert.equal(nine.contacts,nine.fieldPlays);
assert(buffer.pitches>=17);assert.equal(buffer.generation.underflows,0);assert(buffer.generation.maximumQueue<=12);assert(buffer.heartbeat.maxGap<1000);
assert.equal(buffer.gameSha256,browser.sha256.game);assert.equal(athletic.makerSha256,browser.sha256.maker);
assert(athletic.cases.length>=2);
for(const r of [browser,authoring,background,athletic,buffer])assert.deepEqual(r.errors,[]);
assert.deepEqual(browser.externalRequests,[]);assert.deepEqual(background.requests,[]);assert.deepEqual(buffer.requests,[]);
assert.equal(performance.total,6);assert(performance.budgetUnchanged);assert(performance.rows.every(r=>r.checks.complete&&r.checks.retainedHeap));
const pins=await json(folder+'/'+browser.files.game+'.bundle-inputs.json');assert.equal(pins.entrySha256,build.sourceCoreSha256);
for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,'native input: '+path);
assert.equal(sha(await readFile('dist/native-match-core-browser.js')),build.sourceCoreSha256);
const baseline=await json('docs/verification/cooperative-defense-v120/performance/configuration.json'),
 before119=await json('docs/verification/releases/v119/baseline.json');
for(const row of [...baseline.protectedArtifacts,...before119.oldPublished])assert.equal(sha(await readFile(row.destination)),row.sha256,'old artifact');
for(const p of [before119.userInput,before119.fixture])assert.equal(sha(await readFile(p.path)),p.sha256,'protected input');
assert.equal(nine.inputSha256,before119.userInput.sha256);
const receipts=[];
for(const row of config.receipts){const r=await json(row.path);assert.equal(r.task_id,task);assert.equal(r.result,row.expected);
 assert.equal(sha(await readFile(r.output_path)),r.output_sha256);
 receipts.push({path:row.path,result:r.result,sha256:sha(await readFile(row.path)),receiptId:r.receipt_id});}
assert(receipts.length>=13);
const artifacts=[];
for(const [kind,name]of Object.entries(browser.files))for(const suffix of ['', '.build.json',kind==='lab'?null:'.bundle-inputs.json',kind==='game'?'.audio-manifest.json':null]){
 if(suffix===null)continue;const path=resolve(folder,name+suffix);assert((await stat(path)).isFile());artifacts.push({path,sha256:sha(await readFile(path))});
}
assert.equal(artifacts.length,9);
const result={integrityPass:true,validationScope:'candidate-artifact-integrity-and-reported-gates; not an unconditional product PASS',
 task,releaseVersion:120,status:performance.pass?'STAGE_ONE_VALIDATED':'PERFORMANCE_GOAL_OPEN',
 sourceCoreSha256:build.sourceCoreSha256,nativeInputCount:175,capturedInputCount:Object.keys(snapshot.inputs).length,
 functionalReportsPass:true,performanceGoalMet:performance.pass,performancePassedCases:performance.passed,performanceTotalCases:performance.total,
 firstStageComplete:performance.pass,psychologyConnection:'NOT_CONNECTED',secondStageComplete:false,oldPublishedPreserved:18,
 originalJsonUnchanged:true,sourceCommitPushed:false,artifacts,receipts,reports:config.reports,
 limits:['not-an-MLB-frequency-calibration','not-all-seeds-parks-or-devices','whole-body-proof-limited-to-declared-envelopes',
  'peak-heap-unmeasured','psychology-source-calibration-and-mark-effect-timing-not-connected']};
await writeFile('docs/verification/releases/v120/candidate-integrity.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({integrityPass:result.integrityPass,status:result.status,performanceGoalMet:result.performanceGoalMet,
 artifacts:artifacts.length,sourceCoreSha256:result.sourceCoreSha256}));
