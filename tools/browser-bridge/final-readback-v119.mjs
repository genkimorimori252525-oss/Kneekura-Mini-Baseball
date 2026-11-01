import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='docs/verification/releases/v119/',json=async p=>JSON.parse(await readFile(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),
 published=await json(base+'publish.json'),baseline=await json(base+'baseline.json'),pub=await json(base+'public-readback.json');
assert(published.pass&&pub.readbackExact&&!pub.sourcePushed&&!pub.rawInputPublished);
assert.equal(pub.body.trimEnd(),(await readFile(base+'public-summary.md','utf8')).trimEnd());
for(const row of published.artifacts){assert.equal(sha(await readFile(row.destination)),row.sha256);assert.equal(sha(await readFile(row.source)),row.sha256);}
for(const row of baseline.oldPublished)assert.equal(sha(await readFile(row.destination)),row.sha256);
assert.equal(sha(await readFile(baseline.userInput.path)),baseline.userInput.sha256);
assert.equal(sha(await readFile(baseline.fixture.path)),baseline.fixture.sha256);
const pins=await json(published.artifacts.find(row=>row.destination.endsWith('.bundle-inputs.json')&&row.destination.includes('ばせぼーる')).destination);
for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,path);
for(const row of published.receipts){const r=await json(row.path);assert.equal(r.result,'PASS');assert.equal(sha(await readFile(row.path)),row.sha256);
 assert.equal(sha(await readFile(r.output_path)),r.output_sha256);}
const publishReceipt=await json('docs/ai-continuity/verification-receipts/MB-20261025-CONTACT-COORDINATION-V119_6dd7f54c178d4c50ae4e395c359b4e4b.json');
assert.equal(publishReceipt.result,'PASS');assert.equal(sha(await readFile(publishReceipt.output_path)),publishReceipt.output_sha256);
const prior=await json('docs/verification/defense-willingness-plan-2026-10-25/baseline.json');
for(const [path,hash]of Object.entries(prior.protected))assert.equal(sha(await readFile(path)),hash,path);
const docs=[base+'RESULTS.md','docs/agent-decisions/2026-10-25-contact-coordination-v119.md',base+'publish.json',base+'public-readback.json'],documentHashes={};
for(const path of docs)documentHashes[path]=sha(await readFile(path));
const result={pass:true,task:published.task,sourceCoreSha256:published.sourceCoreSha256,nativeInputCount:Object.keys(pins.inputs).length,
 capturedInputsVerifiedAtPublish:published.capturedInputs,publishedFiles:published.artifacts.length,oldPublishedFiles:baseline.oldPublished.length,
 originalInputAndFixtureUnchanged:true,protectedPriorDocuments:Object.keys(prior.protected).length,passReceipts:published.receipts.length+1,
 publicSummaryReadback:pub.url,sourceCommitPushed:false,documentHashes,limits:published.limits};
await writeFile(base+'final-integrity.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
