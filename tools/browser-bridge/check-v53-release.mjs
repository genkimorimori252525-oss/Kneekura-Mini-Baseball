import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
const dir='docs/demos/releases/v53',qa='docs/verification/releases/v53';
const sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p,'utf8'));
const hashes=await json(dir+'/SHA256.json');
for(const [p,h]of Object.entries(hashes))assert.equal(sha(await readFile(dir+'/'+p)),h,p);
const game=await json(dir+'/game.html.build.json'),maker=await json(dir+'/maker.html.build.json');
const pins=await json(dir+'/game.html.bundle-inputs.json'),makerPins=await json(dir+'/maker.html.bundle-inputs.json');
assert.equal(game.presentationVersion,53);assert(maker.traitProfiles&&maker.publicAbilities);
for(const manifest of [pins,makerPins])for(const [p,h]of Object.entries(manifest.inputs))assert.equal(sha(await readFile(p)),h,p);
assert.equal(game.bundleInputCount,Object.keys(pins.inputs).length);assert(game.bundleInputCount>=110);
const native=await readFile('dist/native-match-core-browser.js'),workbench=await readFile('dist/batting-workbench-core.js');
assert.equal(sha(native),pins.entrySha256);assert.equal(sha(workbench),makerPins.entrySha256);
const html=await readFile(dir+'/game.html','utf8'),makerHtml=await readFile(dir+'/maker.html','utf8');
assert(html.includes(native.toString('utf8')));assert(makerHtml.includes(workbench.toString('utf8')));
const prior=await json('docs/demos/releases/v52/game.html.build.json');
for(const [key,name]of [['continuousViewSha256','live-soft-pitch-batter-view.js'],['pitcherReactionViewSha256','live-pitcher-reaction-view.js']]){
 assert.equal(game[key],prior[key]);assert.equal(sha(await readFile('tools/browser-bridge/'+name)),game[key]);
 assert(html.includes(await readFile('tools/browser-bridge/'+name,'utf8')));
}
assert.equal(sha(await readFile('docs/demos/releases/v52/game.html')),prior.sha256,'prior release bytes remain preserved');
const actualGame=await json(qa+'/game/game-check.json'),actualMaker=await json(qa+'/maker/trait-maker-check.json'),cameras=await json(qa+'/cameras/v53-camera-check.json');
assert.equal(actualGame.status,'PASS');assert.equal(actualMaker.status,'PASS');assert(cameras.pass);
assert.equal(actualGame.sha256,game.sha256);assert.equal(actualMaker.sha256,maker.sha256);assert.equal(cameras.sha256,game.sha256);
assert.equal(actualGame.nativeBundleSha256,pins.entrySha256);assert.equal(cameras.nativeBundleSha256,pins.entrySha256);
assert(actualGame.views[0].completed.finished);assert(actualGame.views[0].completed.match.inning>=9);
assert.equal(actualGame.views[0].airborneRunning.pendingLiveRetouchesAtClosure,0);
const roster=await json(dir+'/live-game-roster-v3.json');assert.equal(roster.entries.length,20);assert.equal(roster.entries.filter(e=>e.traitProfile).length,10);
assert.equal(sha(await readFile(dir+'/live-game-roster-v3.json')),game.physicalRosterSha256);assert.equal(game.physicalRosterSha256,maker.liveRosterSha256);
const checkedLinks=[];
for(const path of [dir+'/README.md','docs/reports/2026-10-18-v53-airborne-running.md','docs/reports/2026-10-18-v53-trait-source-audit.md']){
 const source=await readFile(path,'utf8');
 for(const m of source.matchAll(/\]\(([^)]+)\)/g)){
  const link=m[1];if(/^(https?:|#)/.test(link))continue;
  await readFile(resolve(dirname(path),decodeURIComponent(link.split('#')[0])));checkedLinks.push({path,link});
 }
}
const report={pass:true,gameSha256:game.sha256,makerSha256:maker.sha256,nativeBundleSha256:pins.entrySha256,sourceInputs:game.bundleInputCount,
 makerSourceInputs:Object.keys(makerPins.inputs).length,preservedV52Cameras:true,checkedLinks:checkedLinks.length,
 allTraitsConnected:false,pendingTraitScope:'UNANSWERED_HUMAN_SCOPE_QUESTION',statisticsCalibrated:false,nativeSqliteAdmission:false};
await writeFile(qa+'/release-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
