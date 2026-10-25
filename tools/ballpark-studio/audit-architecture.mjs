import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {validateDesign} from './model.mjs';
const root='docs/ballpark-studio/',sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(root+p,'utf8')),
 build=await json('evidence/build-architecture-a8.json'),previous=await json('evidence/build-architecture-a7.json');
assert.equal(sha(await readFile(build.output)),build.sha256);assert.equal(build.sourceCoreChanged,false);assert.equal(build.sharedNormalMatchChanged,false);assert(build.exactRendererReverse);
assert.equal(sha(await readFile('../../outputs/球場設計室_v3_立体構造改修前.html')),'82f83110a3b09a33ce637795045a29ee1d092e76b048dff88b7f3d553dc82344');
const changed=Object.keys(build.sourceInputs).filter(p=>build.sourceInputs[p]!==previous.sourceInputs[p]);assert.deepEqual(changed,['tools/ballpark-studio/preview-bridge.js']);
const reports=['evidence/architecture-architecture-a8/report.json','evidence/attendance-architecture-a8/report.json','evidence/crowd-blocks-architecture-a8/report.json','evidence/dome-architecture-a7/report.json','evidence/browser-architecture-a7/report.json','evidence/crowd-architecture-a7/report.json','evidence/visual-tuning-architecture-a7/report.json'];
for(const p of reports)assert.equal((await json(p)).pass,true,p);
const receiptIndex=await json('evidence/architecture-receipts.json');for(const r of receiptIndex)assert.equal(sha(await readFile(r.output_path)),r.output_sha256);
assert.equal(receiptIndex.filter(r=>r.result==='FAIL').length,3,'original FAIL logs remain indexed');
const example=await json('examples/russian-dome-v3-architecture.json');assert(validateDesign(example).ok);assert.equal(example.architecture.details.factor,6);
const local=await readFile(root+'github-decision-v3.md','utf8'),remote=JSON.parse(execFileSync('gh',['api','repos/genkimorimori252525-oss/Kneekura-Mini-Baseball/issues/comments/6375221684'],{encoding:'utf8'}));assert.equal(local.trim(),remote.body.trim());
const report={pass:true,sha256:build.sha256,bytes:build.bytes,regressionDeltaSinceA7:changed,regressionReports:reports,originalFailLogsPreserved:3,exampleValid:true,github:{url:remote.html_url,updatedAt:remote.updated_at,localAndRemoteBodyEqual:true,bodySha256:sha(local)},scope:'DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED'};
await writeFile(root+'evidence/architecture-final-audit.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
