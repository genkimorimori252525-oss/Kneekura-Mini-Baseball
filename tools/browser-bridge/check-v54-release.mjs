import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
const dir='docs/demos/releases/v54',qa='docs/verification/releases/v54';
const sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p,'utf8'));
const hashes=await json(dir+'/SHA256.json');
for(const [p,h]of Object.entries(hashes))assert.equal(sha(await readFile(dir+'/'+p)),h,p);
const game=await json(dir+'/game.html.build.json'),maker=await json(dir+'/maker.html.build.json');
const pins=await json(dir+'/game.html.bundle-inputs.json'),makerPins=await json(dir+'/maker.html.bundle-inputs.json');
assert.equal(game.presentationVersion,54);assert(maker.traitProfiles&&maker.publicAbilities);
for(const manifest of [pins,makerPins])for(const [p,h]of Object.entries(manifest.inputs))assert.equal(sha(await readFile(p)),h,p);
assert.equal(game.bundleInputCount,Object.keys(pins.inputs).length);assert(game.bundleInputCount>=113);
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
const actualGame=await json(qa+'/game/game-check.json'),actualMaker=await json(qa+'/maker/trait-maker-check.json'),cameras=await json(qa+'/cameras/v54-camera-check.json');
assert.equal(actualGame.status,'PASS');assert.equal(actualMaker.status,'PASS');assert(cameras.pass);
assert.equal(actualGame.sha256,game.sha256);assert.equal(actualMaker.sha256,maker.sha256);assert.equal(cameras.sha256,game.sha256);
assert.equal(actualGame.nativeBundleSha256,pins.entrySha256);assert.equal(cameras.nativeBundleSha256,pins.entrySha256);
assert(actualGame.views[0].completed.finished);assert(actualGame.views[0].completed.match.inning>=9);
assert.equal(actualGame.views[0].airborneRunning.pendingLiveRetouchesAtClosure,0);
const roster=await json(dir+'/live-game-roster-v3.json');assert.equal(roster.entries.length,20);assert.equal(roster.entries.filter(e=>e.traitProfile).length,10);
assert.equal(sha(await readFile(dir+'/live-game-roster-v3.json')),game.physicalRosterSha256);assert.equal(game.physicalRosterSha256,maker.liveRosterSha256);
const availability=await json(dir+'/live-trait-availability-v54.json');
assert.equal(availability.entries.length,119);assert.equal(availability.supportedFamilyIds.length,7);
assert.equal(sha(await readFile(dir+'/live-trait-availability-v54.json')),maker.traitAvailabilitySha256);
assert.equal(sha(await readFile('docs/demos/baseball-maker-ui.mjs')),maker.uiSha256);
assert(makerHtml.includes(await readFile('docs/demos/baseball-maker-ui.mjs','utf8')));
for(const view of actualMaker.views){assert.equal(view.catalogFamilyCount,7);assert.equal(view.availabilityCount,119);assert.equal(view.unsupportedCount,112);assert(view.gameChecks.length>0);}
const prior53=await json('docs/demos/releases/v53/SHA256.json');
for(const [path,expected]of Object.entries(prior53))assert.equal(sha(await readFile('docs/demos/releases/v53/'+path)),expected,'preserved v53 '+path);
const checkedLinks=[];
for(const path of [dir+'/README.md','docs/reports/2026-10-19-v54-executable-traits.md','docs/reports/2026-10-18-v53-trait-source-audit.md']){
 const source=await readFile(path,'utf8');
 for(const m of source.matchAll(/\]\(([^)]+)\)/g)){
  const link=m[1];if(/^(https?:|#)/.test(link))continue;
  await readFile(resolve(dirname(path),decodeURIComponent(link.split('#')[0])));checkedLinks.push({path,link});
 }
}
const report={pass:true,gameSha256:game.sha256,makerSha256:maker.sha256,nativeBundleSha256:pins.entrySha256,sourceInputs:game.bundleInputCount,
 makerSourceInputs:Object.keys(makerPins.inputs).length,preservedV52Cameras:true,preservedV53RulesAndRunning:true,checkedLinks:checkedLinks.length,
 allTraitsConnected:false,allApprovedExecutableFamiliesConnected:true,executableFamilies:7,availabilityFamilies:119,unimplementedOrOutOfScope:112,pendingTraitScope:null,statisticsCalibrated:false,nativeSqliteAdmission:false};
await writeFile(qa+'/release-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
