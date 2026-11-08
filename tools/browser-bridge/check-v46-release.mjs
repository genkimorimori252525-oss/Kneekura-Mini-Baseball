import assert from 'node:assert/strict';
import { readFile,writeFile,stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve,dirname } from 'node:path';
const dir='docs/demos/releases/v46',qa='docs/verification/releases/v46',sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(await readFile(dir+'/SHA256.json','utf8'));
for(const [path,hash]of Object.entries(manifest))assert.equal(sha(await readFile(dir+'/'+path)),hash,path);
const pins=JSON.parse(await readFile(dir+'/game.html.bundle-inputs.json','utf8'));
assert.equal(Object.keys(pins.inputs).length,105);
for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,path);
const bundle=await readFile('dist/native-match-core-browser.js');assert.equal(sha(bundle),pins.entrySha256);
assert((await readFile(dir+'/game.html','utf8')).includes(bundle.toString('utf8')));
const game=JSON.parse(await readFile(qa+'/game/game-check.json','utf8')),camera=JSON.parse(await readFile(qa+'/cameras/continuous-view-check.json','utf8')),
 maker=JSON.parse(await readFile(qa+'/maker/public-maker-check.json','utf8'));
assert.equal(game.status,'PASS');assert.equal(camera.pass,true);assert.equal(maker.status,'PASS');
assert.equal(game.sha256,manifest['game.html']);assert.equal(camera.sha256,game.sha256);assert.equal(maker.sha256,manifest['maker.html']);
assert.equal(game.nativeBundleSha256,pins.entrySha256);assert.equal(camera.nativeBundleSha256,pins.entrySha256);
assert.equal(game.views[0].completed.finished,true);assert.equal(game.views[0].completed.pitches,251);
for(const proof of [game,camera,maker])assert.deepEqual(proof.views.map(v=>v.width),[1200,390]);
assert.deepEqual(await readFile(dir+'/game.html'),await readFile('../../outputs/ばせぼーるlv46_TBD_vs_LAD_走塁と守備AI改善版.html'));
assert.deepEqual(await readFile(dir+'/maker.html'),await readFile('../../outputs/にーくら野球メーカー_走塁と守備AI調整版.html'));
const oldBuild=JSON.parse(await readFile('docs/demos/releases/v45/game.html.build.json','utf8')),build=JSON.parse(await readFile(dir+'/game.html.build.json','utf8'));
for(const key of ['continuousViewSha256','takenGazeHelperSha256','batterGazeHelperSha256','chartHelperSha256','fieldCameraHelperSha256','actorAnimationHelperSha256','playDescriptionHelperSha256','approvedPngMasksSha256','approvedFontSha256'])assert.equal(build[key],oldBuild[key],key);
assert.equal(sha(await readFile('docs/demos/releases/v45/game.html')),'f075101ca0ff6c5a154183deab68355fc9bfb1767684417f11fad78a6b769996');
const docs=['README.md','docs/history/README.md','docs/history/TIMELINE.md','docs/history/INCIDENTS.md','docs/handoffs/LATEST.md',
 'docs/reports/2026-10-18-v46-running-and-fielding-ai.md',dir+'/README.md'];let links=0;
for(const path of docs)for(const m of (await readFile(path,'utf8')).matchAll(/\]\(([^)]+)\)/g)){
 const target=m[1].split('#')[0];if(!target||/^[a-z]+:/i.test(target))continue;
 assert(await stat(resolve(dirname(path),decodeURIComponent(target))),path+' -> '+target);links++;
}
const report={pass:true,documents:docs.length,linksChecked:links,coreInputs:105,nativeBundleSha256:pins.entrySha256,
 gameSha256:game.sha256,makerSha256:maker.sha256,regulationCompletedPitches:251,widths:[1200,390],v45HelpersAndArtifactPreserved:true};
await writeFile(qa+'/release-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
