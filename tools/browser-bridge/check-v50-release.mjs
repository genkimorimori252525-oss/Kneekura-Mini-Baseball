import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';import {createHash} from 'node:crypto';import {resolve,dirname} from 'node:path';
const dir='docs/demos/releases/v50',qa='docs/verification/releases/v50',sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p,'utf8'));
const hashes=await json(dir+'/SHA256.json');for(const [p,h]of Object.entries(hashes))assert.equal(sha(await readFile(dir+'/'+p)),h,p);
const build=await json(dir+'/game.html.build.json'),old=await json('docs/demos/releases/v49/game.html.build.json'),pins=await json(dir+'/game.html.bundle-inputs.json');
assert.equal(build.presentationVersion,50);assert.equal(Object.keys(pins.inputs).length,107);assert.equal(pins.entrySha256,old.nativeBundleSha256);
for(const [p,h]of Object.entries(pins.inputs))assert.equal(sha(await readFile(p)),h,p);
const html=await readFile(dir+'/game.html','utf8'),newHelper=await readFile('tools/browser-bridge/live-v27-batter-view.js'),follower=await readFile('tools/browser-bridge/live-batter-braking-view.js');
assert.equal(build.continuousViewSha256,sha(newHelper));assert.equal(build.fieldFollowerSha256,sha(follower));assert.equal(build.fieldFollowerSha256,old.continuousViewSha256);
assert(html.includes(newHelper.toString()));assert(html.includes(follower.toString()));assert(html.includes(await readFile('dist/native-match-core-browser.js','utf8')));
for(const key of ['nativeBundleSha256','physicalRosterSha256','physicalCatalogSha256','measuredReferenceSha256','takenGazeHelperSha256','batterGazeHelperSha256','chartHelperSha256','fieldCameraHelperSha256','actorAnimationHelperSha256','playDescriptionHelperSha256','approvedPngMasksSha256','approvedFontSha256','ordinaryCadenceMs','displayGridPixels'])assert.equal(build[key],old[key],key);
assert.equal(sha(await readFile('docs/demos/releases/v49/game.html')),'b4903f219e81c0efa77c560b7961afb8eafaa85843be90fc9460a2db9a23428a');
assert.equal(sha(await readFile('docs/demos/assets/approved-v27-baseline.html')),'c613574b377afd19060d89100c1bd7c1fa693efd42361c77ed7ab21943670f1f');
assert.deepEqual(await readFile(dir+'/game.html'),await readFile('../../outputs/ばせぼーるlv50_TBD_vs_LAD_lv27打者カメラ復元版.html'));
const browser=await json(qa+'/v50-batter-view-check.json');assert.equal(browser.pass,true);assert.equal(browser.sha256,hashes['game.html']);assert.equal(browser.nativeBundleSha256,pins.entrySha256);assert.deepEqual(browser.views.map(v=>v.width),[1200,390]);
for(const f of browser.browserFaults){assert.deepEqual(f.errors,[]);assert.deepEqual(f.requests,[]);}
const docs=['README.md','docs/history/README.md','docs/history/TIMELINE.md','docs/history/INCIDENTS.md','docs/handoffs/LATEST.md','docs/reports/2026-10-18-v50-v27-batter-camera.md',dir+'/README.md'];let links=0;
for(const p of docs)for(const m of(await readFile(p,'utf8')).matchAll(/\]\(([^)]+)\)/g)){const target=m[1].split('#')[0];if(!target||/^[a-z]+:/i.test(target))continue;assert(await stat(resolve(dirname(p),decodeURIComponent(target))),p+' -> '+target);links++;}
const report={pass:true,gameSha256:hashes['game.html'],newHelperSha256:sha(newHelper),fieldFollowerSha256:sha(follower),coreUnchangedFromV49:true,coreInputs:107,widths:[1200,390],linksChecked:links};await writeFile(qa+'/release-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
