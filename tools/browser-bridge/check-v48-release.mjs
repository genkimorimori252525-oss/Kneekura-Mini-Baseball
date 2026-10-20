import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
const dir='docs/demos/releases/v48',qa='docs/verification/releases/v48',sha=b=>createHash('sha256').update(b).digest('hex');
const hashes=JSON.parse(await readFile(dir+'/SHA256.json','utf8'));
for(const [p,h]of Object.entries(hashes))assert.equal(sha(await readFile(dir+'/'+p)),h,p);
const build=JSON.parse(await readFile(dir+'/game.html.build.json','utf8')),old=JSON.parse(await readFile('docs/demos/releases/v47/game.html.build.json','utf8'));
const pins=JSON.parse(await readFile(dir+'/game.html.bundle-inputs.json','utf8'));
assert.equal(Object.keys(pins.inputs).length,107);assert.equal(pins.entrySha256,old.nativeBundleSha256);
for(const [p,h]of Object.entries(pins.inputs))assert.equal(sha(await readFile(p)),h,p);
const html=await readFile(dir+'/game.html','utf8'),helper=await readFile('tools/browser-bridge/live-batter-braking-view.js','utf8');
assert.equal(build.continuousViewSha256,sha(Buffer.from(helper)));assert(html.includes(helper));
assert.equal(sha(await readFile('tools/browser-bridge/live-continuous-batter-view.js')),old.continuousViewSha256);
assert(html.includes(await readFile('dist/native-match-core-browser.js','utf8')));
assert.deepEqual(await readFile(dir+'/game.html'),await readFile('../../outputs/ばせぼーるlv48_TBD_vs_LAD_打者視点の制動調整版.html'));
for(const key of ['nativeBundleSha256','physicalRosterSha256','physicalCatalogSha256','measuredReferenceSha256','takenGazeHelperSha256','batterGazeHelperSha256','chartHelperSha256','fieldCameraHelperSha256','actorAnimationHelperSha256','playDescriptionHelperSha256','approvedPngMasksSha256','approvedFontSha256','ordinaryCadenceMs','displayGridPixels'])assert.equal(build[key],old[key],key);
assert.equal(sha(await readFile('docs/demos/releases/v47/game.html')),'81cdc7c402f2a8461ef07cac8d6d541cf304208fe97f23ba9bc02915ba880747');
const browser=JSON.parse(await readFile(qa+'/continuous-view-check.json','utf8'));
assert.equal(browser.pass,true);assert.equal(browser.sha256,hashes['game.html']);assert.equal(browser.nativeBundleSha256,pins.entrySha256);
assert.deepEqual(browser.views.map(v=>v.width),[1200,390]);
for(const v of browser.views){assert.equal(v.coreHashes.length,12);assert.equal(v.takeBraking.length,6);assert.equal(v.swingSettling.length,2);assert.deepEqual(v.errors,[]);assert.deepEqual(v.externalRequests,[]);}
const docs=['README.md','docs/handoffs/LATEST.md','docs/history/README.md','docs/history/TIMELINE.md','docs/history/INCIDENTS.md','docs/reports/2026-10-18-v48-batter-braking.md',dir+'/README.md'];let links=0;
for(const p of docs)for(const m of (await readFile(p,'utf8')).matchAll(/\]\(([^)]+)\)/g)){
 const target=m[1].split('#')[0];if(!target||/^[a-z]+:/i.test(target))continue;
 assert(await stat(resolve(dirname(p),decodeURIComponent(target))),p+' -> '+target);links++;
}
const report={pass:true,gameSha256:hashes['game.html'],helperSha256:build.continuousViewSha256,coreInputs:107,coreUnchangedFromV47:true,oldObserverAndV47ArtifactPreserved:true,widths:[1200,390],matchedPhysicalPitchRecords:12,linksChecked:links};
await writeFile(qa+'/release-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
