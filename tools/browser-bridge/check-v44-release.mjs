import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
const sha=b=>createHash('sha256').update(b).digest('hex');
const outputs=resolve('../../outputs'),proof=JSON.parse(await readFile('docs/verification/releases/v44/taken-gaze-check.json','utf8'));
assert.equal(proof.pass,true);assert.deepEqual(proof.views.map(v=>v.width),[1200,390]);
for(const view of proof.views){assert.equal(view.checks.length,6);assert.equal(view.coreHashes.length,12);}
for(const [version,name]of [['v43','ばせぼーるlv43_TBD_vs_LAD_打者の打点注視版.html'],['v44','ばせぼーるlv44_TBD_vs_LAD_見送り視線修正版.html']]){
 const dir='docs/demos/releases/'+version,bytes=await readFile(dir+'/game.html'),build=JSON.parse(await readFile(dir+'/game.html.build.json','utf8'));
 assert.deepEqual(bytes,await readFile(resolve(outputs,name)));assert.equal(sha(bytes),build.sha256);
 assert.equal(build.nativeBundleSha256,proof.nativeBundleSha256);assert.equal(build.bundleInputCount,103);
 const manifest=JSON.parse(await readFile(dir+'/SHA256.json','utf8'));
 for(const [path,hash]of Object.entries(manifest))assert.equal(sha(await readFile(dir+'/'+path)),hash);
}
const docs=['README.md','HANDOFF.md','docs/handoffs/LATEST.md','docs/handoffs/2026-10-17-LATEST.md',
 'docs/history/README.md','docs/history/TIMELINE.md','docs/history/INCIDENTS.md',
 'docs/reports/2026-10-18-v43-batter-contact-gaze.md','docs/reports/2026-10-18-v44-taken-gaze-and-history.md',
 'docs/demos/releases/v43/README.md','docs/demos/releases/v44/README.md',
 'docs/handoffs/2026-10-15-mini-baseball/00-START-HERE.md','docs/handoffs/2026-10-15-mini-baseball/05-CODEX-START-PROMPT.md'];
let links=0;
for(const path of docs){
 const text=await readFile(path,'utf8');
 for(const match of text.matchAll(/\]\(([^)]+)\)/g)){
  const target=match[1].split('#')[0];if(!target||/^[a-z]+:/i.test(target))continue;
  assert(await stat(resolve(dirname(path),decodeURIComponent(target))),path+' -> '+target);links++;
 }
}
const report={pass:true,linksChecked:links,documents:docs.length,htmlSha256:proof.sha256,nativeBundleSha256:proof.nativeBundleSha256,
 preservedV41Sha256:sha(await readFile('docs/demos/releases/v41/game.html')),widths:[1200,390],actualTakenCases:6,unchangedPitches:12};
assert.equal(report.preservedV41Sha256,'bd1802d52a01920ef47e149555a7605c3d0cb83c7c15ba2e2288004c9bef7061');
await writeFile('docs/verification/releases/v44/release-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
