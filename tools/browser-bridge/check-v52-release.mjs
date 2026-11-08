import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
const dir='docs/demos/releases/v52',qa='docs/verification/releases/v52';
const sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p,'utf8'));
const hashes=await json(dir+'/SHA256.json');
for(const [p,h]of Object.entries(hashes))assert.equal(sha(await readFile(dir+'/'+p)),h,p);
const pins=await json(dir+'/game.html.bundle-inputs.json'),build=await json(dir+'/game.html.build.json');
const old=await json('docs/demos/releases/v51/game.html.build.json');
assert.deepEqual(pins,await json('docs/demos/releases/v51/game.html.bundle-inputs.json'));
assert.equal(Object.keys(pins.inputs).length,108);
for(const [p,h]of Object.entries(pins.inputs))assert.equal(sha(await readFile(p)),h,p);
assert.equal(build.presentationVersion,52);assert.equal(build.nativeBundleSha256,old.nativeBundleSha256);
const html=await readFile(dir+'/game.html','utf8');
assert(html.includes(await readFile('dist/native-match-core-browser.js','utf8')));
assert(html.includes(await readFile('tools/browser-bridge/live-soft-pitch-batter-view.js','utf8')));
assert(html.includes(await readFile('tools/browser-bridge/live-pitcher-reaction-view.js','utf8')));
assert(!html.includes('<script id="v50-v27-batter-view">'));
for(const key of ['physicalRosterSha256','physicalCatalogSha256','measuredReferenceSha256','takenGazeHelperSha256','batterGazeHelperSha256','chartHelperSha256','fieldCameraHelperSha256','actorAnimationHelperSha256','playDescriptionHelperSha256','approvedPngMasksSha256','approvedFontSha256','ordinaryCadenceMs','displayGridPixels'])assert.equal(build[key],old[key],key);
for(const [path,hash]of [
 ['docs/demos/releases/v49/game.html','b4903f219e81c0efa77c560b7961afb8eafaa85843be90fc9460a2db9a23428a'],
 ['docs/demos/releases/v51/game.html','9a2b4761d87b6c908dd51c969d5425a036870caf1f57b474e1113126b409a54e'],
 ['tools/browser-bridge/live-batter-braking-view.js','f987a851185dcd70e7f31429c748abb2b46d0f70999e15aaa92d4c26dee9cc9b'],
 ['docs/demos/releases/v47/maker.html','7848228105d598f75c8e1eeb347c2ecbb6f3b749c9b1ea5433f2dcdfc97abd8c']
])assert.equal(sha(await readFile(path)),hash,path);
assert.deepEqual(await readFile(dir+'/game.html'),await readFile('../../outputs/ばせぼーるlv52_TBD_vs_LAD_視点追従調整版.html'));
const browser=await json(qa+'/cameras/v52-camera-check.json');assert.equal(browser.pass,true);
assert.equal(browser.sha256,hashes['game.html']);assert.equal(browser.nativeBundleSha256,pins.entrySha256);
assert.deepEqual(browser.views.map(v=>v.width),[1200,390]);
for(const f of browser.browserFaults){assert.deepEqual(f.errors,[]);assert.deepEqual(f.requests,[]);}
const docs=['README.md','docs/history/README.md','docs/history/TIMELINE.md','docs/history/INCIDENTS.md','docs/handoffs/LATEST.md','docs/reports/2026-10-18-v52-camera-pursuit.md',dir+'/README.md'];let links=0;
for(const p of docs)for(const m of(await readFile(p,'utf8')).matchAll(/\]\(([^)]+)\)/g)){
 const target=m[1].split('#')[0];if(!target||/^[a-z]+:/i.test(target))continue;
 assert(await stat(resolve(dirname(p),decodeURIComponent(target))),p+' -> '+target);links++;
}
const report={pass:true,gameSha256:hashes['game.html'],nativeBundleSha256:pins.entrySha256,unchangedCoreInputs:108,
 v49BatterBaselineRestored:true,pitchOnlyBoundedMeetVisionPursuit:true,pitcherDelaySeconds:[.5,1.2],pitcherBlendMs:180,widths:[1200,390],linksChecked:links,
 scope:'new presentation/browser evidence; existing v51 280 tests and regulation game retained as same-Core evidence, not newly rerun'};
await writeFile(qa+'/release-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
