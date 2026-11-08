import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
const sha=b=>createHash('sha256').update(b).digest('hex'),dir='docs/demos/releases/v45',
 proof=JSON.parse(await readFile('docs/verification/releases/v45/continuous-view-check.json','utf8')),
 build=JSON.parse(await readFile(dir+'/game.html.build.json','utf8'));
assert.equal(proof.pass,true);assert.deepEqual(proof.views.map(v=>v.width),[1200,390]);
for(const v of proof.views){assert.equal(v.boundaries.length,8);assert.equal(v.coreHashes.length,12);assert.equal(v.cases.takes.length,6);}
assert.equal(proof.sha256,build.sha256);
assert.deepEqual(await readFile(dir+'/game.html'),await readFile('../../outputs/ばせぼーるlv45_TBD_vs_LAD_連続打者視点版.html'));
const manifest=JSON.parse(await readFile(dir+'/SHA256.json','utf8'));
for(const [path,hash]of Object.entries(manifest))assert.equal(sha(await readFile(dir+'/'+path)),hash);
const docs=['README.md','docs/history/README.md','docs/history/TIMELINE.md','docs/history/INCIDENTS.md','docs/handoffs/LATEST.md',
 'docs/reports/2026-10-18-v45-continuous-batter-view.md',dir+'/README.md'];let links=0;
for(const path of docs){const text=await readFile(path,'utf8');for(const m of text.matchAll(/\]\(([^)]+)\)/g)){
 const target=m[1].split('#')[0];if(!target||/^[a-z]+:/i.test(target))continue;
 assert(await stat(resolve(dirname(path),decodeURIComponent(target))),path+' -> '+target);links++;
}}
assert.equal(sha(await readFile('docs/demos/releases/v44/game.html')),'def5e0c9e4a27ad99422a615c10e58f9f4cf9e3e778b6f58c7336457c383cee5');
const report={pass:true,linksChecked:links,documents:docs.length,htmlSha256:proof.sha256,nativeBundleSha256:proof.nativeBundleSha256,
 oldV44Preserved:true,actualPitchCount:12,actualTakenCount:6,widths:[1200,390]};
await writeFile('docs/verification/releases/v45/release-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
