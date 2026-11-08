import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile,stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
const task='MB-20261025-CONTACT-COORDINATION-V119',base='docs/verification/releases/v119/',root=resolve('../../outputs'),
 sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p,'utf8')),
 config=await json(process.argv[2]),candidate=resolve(config.candidate),build=await json(candidate+'/build-report-v119.json'),
 snapshot=await json(candidate+'/build-sources-v119.json'),baseline=await json(base+'baseline.json'),
 reports=Object.fromEntries(await Promise.all(Object.entries(config.reports).map(async([key,path])=>[key,await json(path+'/report.json')])));
assert.equal(dirname(candidate),root);assert.equal(build.releaseVersion,119);assert.equal(build.sourceCoreInputCount,169);
assert.equal(sha(await readFile(candidate+'/build-sources-v119.json')),build.sourceSnapshotSha256);
assert(build.allCapturedInputsUnchanged&&build.backgroundRuntimePatchVerifiedV116);
for(const [key,r]of Object.entries(reports))assert.equal(r.pass,true,key);
const {browser,authoring,contact,nine,context,contextExtra,background}=reports;
assert.equal(browser.version,119);assert.equal(browser.cases.length,12);assert(browser.viewportIndependentSource);
assert.equal(authoring.widths.length,2);assert(authoring.legacyUserJsonImportAndBodyEdit);
assert.equal(authoring.makerSha256,browser.sha256.maker);
for(const r of [contact,nine,context,contextExtra])assert.equal(r.sourceCoreSha256,build.sourceCoreSha256);
assert.equal(contact.cases.length,3);assert(contact.cases.every(c=>c.end.complete));
assert.equal(context.cases.length,12);assert.equal(contextExtra.cases.length,7);
assert(nine.finished&&nine.match.inning>=9&&nine.halfChanges>=16);assert.equal(nine.contacts,nine.fieldPlays);
assert.equal(background.gameSha256,browser.sha256.game);assert.equal(background.cases.length,2);
for(const r of [browser,authoring,background])assert.deepEqual(r.errors,[]);
assert.deepEqual(browser.externalRequests,[]);assert.deepEqual(background.requests,[]);
const receipts=[];
for(const path of config.receipts){const r=await json(path);assert.equal(r.task_id,task);assert.equal(r.result,'PASS');
 assert.equal(sha(await readFile(r.output_path)),r.output_sha256);receipts.push({path,sha256:sha(await readFile(path)),receiptId:r.receipt_id});}
assert(receipts.length>=10,'Need build/unit/type/contact/context/browser/authoring/background/nine evidence');
for(const [path,hash]of Object.entries(snapshot.inputs))assert.equal(sha(await readFile(path)),hash,'Captured input changed: '+path);
const pins=await json(candidate+'/'+browser.files.game+'.bundle-inputs.json');assert.equal(pins.entrySha256,build.sourceCoreSha256);
const changed=Object.keys(pins.inputs).filter(p=>pins.inputs[p]!==baseline.nativeInputs[p]).sort();
assert.deepEqual(changed,['src/core/sim/fielding/LiveFieldDecisionV1.ts','src/integration/browser/LiveBaseballMatchV1.ts']);
for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,path);
for(const row of baseline.oldPublished)assert.equal(sha(await readFile(row.destination)),row.sha256,'Old V118 changed');
assert.equal(sha(await readFile(baseline.userInput.path)),baseline.userInput.sha256,'Original user JSON changed');
assert.equal(sha(await readFile(baseline.fixture.path)),baseline.fixture.sha256,'Fixed regression input changed');
const names=[browser.files.game,browser.files.maker,browser.files.lab],artifacts=[];
for(const name of names)for(const suffix of ['', '.build.json',name===browser.files.lab?null:'.bundle-inputs.json',name===browser.files.game?'.audio-manifest.json':null]){
 if(suffix===null)continue;const source=resolve(candidate,name+suffix),destination=resolve(root,basename(source));
 assert.equal(dirname(destination),root);assert(basename(destination).includes('119_'));assert((await stat(source)).isFile());
 artifacts.push({source,destination,sha256:sha(await readFile(source))});
}
assert.equal(artifacts.length,9);
// COPYFILE_EXCL protects every previously published version, including V119.
for(const row of artifacts){await copyFile(row.source,row.destination,constants.COPYFILE_EXCL);
 assert.equal(sha(await readFile(row.destination)),row.sha256);}
const result={pass:true,task,releaseVersion:119,sourceCoreSha256:build.sourceCoreSha256,nativeInputCount:169,
 capturedInputs:Object.keys(snapshot.inputs).length,changedNativePaths:changed,oldPublishedPreserved:9,
 originalJsonUnchanged:true,fixtureUnchanged:true,receipts,artifacts,reports:config.reports,sourceCommitPushed:false,
 limits:['not-an-MLB-frequency-calibration','not-all-seeds-or-parks','unresolved-physical-contact-guard-retained','bench-paths-not-whole-body-continuous-proofs']};
await writeFile(base+'publish.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({pass:true,artifacts:artifacts.length,sourceCoreSha256:result.sourceCoreSha256,capturedInputs:result.capturedInputs}));
