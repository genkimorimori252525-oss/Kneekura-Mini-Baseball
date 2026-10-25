import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const root='docs/ballpark-studio/',sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(root+p,'utf8')),build=await json('evidence/build-logo-lod-a2.json'),before=await json('evidence/build-architecture-a8.json');
assert.equal(sha(await readFile(build.output)),build.sha256);assert.equal(sha(await readFile('../../outputs/球場設計室_v3_ロゴ遠近調整前.html')),before.sha256);
assert.equal(build.sourceCoreChanged,false);assert.equal(build.sharedNormalMatchChanged,false);assert(build.exactRendererReverse);
for(const name of ['model.mjs','architecture.mjs','renderer-patch.mjs','preview-bridge.js','assets/wolf-gold-cutout-v1.png'])assert.equal(build.sourceInputs['tools/ballpark-studio/'+name],before.sourceInputs['tools/ballpark-studio/'+name],name+' unchanged');
for(const [file,hash]of Object.entries(build.sourceInputs))assert.equal(sha(await readFile(file)),hash);
const reports=['evidence/logo-lod-logo-lod-a2/report.json','evidence/architecture-logo-lod-a2/report.json','evidence/dome-logo-lod-a2/report.json','evidence/crowd-blocks-logo-lod-a2/report.json'];
for(const p of reports){const r=await json(p);assert(r.pass,p);assert.equal(r.sha256,build.sha256,p);}
const receipts=await json('evidence/logo-lod-receipts.json');for(const r of receipts){assert.equal(sha(await readFile(r.output_path)),r.output_sha256);assert.equal(r.task_id,'MB-20261024-BALLPARK-LOGO-LOD');}
const unit=receipts.find(r=>r.receipt_id.endsWith('b527bf82980d4c38bc273ad5d49ef02f'));assert(unit);assert.equal(unit.result,'PASS');assert((await readFile(unit.output_path,'utf8')).includes('tests 40'));
const authoring=await readFile(root+'STADIUM-AUTHORING.md','utf8');for(const key of ['自己改善','暫定','視点','負荷','mipmap'])assert(authoring.includes(key));
for(const file of ['tools/ballpark-studio/AGENTS.md',root+'RENDERING-POLICY.md',root+'README-architecture.md',root+'README-v3.md'])assert((await readFile(file,'utf8')).includes('STADIUM-AUTHORING.md'));
const local=await readFile(root+'github-decision-v3.md','utf8'),remote=JSON.parse(execFileSync('gh',['api','repos/genkimorimori252525-oss/Kneekura-Mini-Baseball/issues/comments/6375221684'],{encoding:'utf8'}));assert.equal(local.trim(),remote.body.trim());
const report={pass:true,sha256:build.sha256,bytes:build.bytes,frozenGeometryCameraCoreAndPng:true,sourcePins:Object.keys(build.sourceInputs).length,unitTests:40,reports,receiptLogHashesVerified:receipts.length,authoring:{path:root+'STADIUM-AUTHORING.md',sha256:sha(authoring),linkedFromEnvironment:true,provisionalAndSelfImproving:true},github:{url:remote.html_url,bodyEqual:true,bodySha256:sha(local)},boundary:'DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED'};
await writeFile(root+'evidence/logo-lod-final-audit.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
