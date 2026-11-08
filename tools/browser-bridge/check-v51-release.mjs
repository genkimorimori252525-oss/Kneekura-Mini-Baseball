import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';

const dir='docs/demos/releases/v51',qa='docs/verification/releases/v51';
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const hashes=await json(dir+'/SHA256.json');
for(const [p,h]of Object.entries(hashes))assert.equal(sha(await readFile(dir+'/'+p)),h,p);
const pins=await json(dir+'/game.html.bundle-inputs.json'),build=await json(dir+'/game.html.build.json');
const old=await json('docs/demos/releases/v50/game.html.build.json');
assert.equal(Object.keys(pins.inputs).length,108);
assert(Object.hasOwn(pins.inputs,'src/core/sim/fielding/LiveFielderAvoidanceV1.ts'));
for(const [p,h]of Object.entries(pins.inputs))assert.equal(sha(await readFile(p)),h,p);
assert.equal(sha(await readFile('dist/native-match-core-browser.js')),pins.entrySha256);
const html=await readFile(dir+'/game.html','utf8');
assert(html.includes(await readFile('dist/native-match-core-browser.js','utf8')));
assert.equal(build.presentationVersion,51);assert.equal(build.bundleInputCount,108);
assert.notEqual(build.nativeBundleSha256,old.nativeBundleSha256,'new Core requires fresh evidence');
for(const key of ['continuousViewSha256','fieldFollowerSha256','physicalRosterSha256','physicalCatalogSha256','measuredReferenceSha256','takenGazeHelperSha256','batterGazeHelperSha256','chartHelperSha256','fieldCameraHelperSha256','actorAnimationHelperSha256','playDescriptionHelperSha256','approvedPngMasksSha256','approvedFontSha256','ordinaryCadenceMs','displayGridPixels'])assert.equal(build[key],old[key],key);
for(const p of ['tools/browser-bridge/live-v27-batter-view.js','tools/browser-bridge/live-batter-braking-view.js'])assert(html.includes(await readFile(p,'utf8')));
assert.equal(sha(await readFile('docs/demos/releases/v50/game.html')),'acc38cf4566438a2a4faadc1a7ef105c7bfd83e512af5b1a46ac75b76c32ee26');
assert.equal(sha(await readFile('docs/demos/assets/approved-v27-baseline.html')),'c613574b377afd19060d89100c1bd7c1fa693efd42361c77ed7ab21943670f1f');
assert.equal(sha(await readFile('docs/demos/releases/v47/maker.html')),'7848228105d598f75c8e1eeb347c2ecbb6f3b749c9b1ea5433f2dcdfc97abd8c');
assert.deepEqual(await readFile(dir+'/game.html'),await readFile('../../outputs/ばせぼーるlv51_TBD_vs_LAD_野手の回避と間隔改善版.html'));
const game=await json(qa+'/game/game-check.json'),camera=await json(qa+'/cameras/v51-batter-view-check.json'),maker=await json(qa+'/maker/public-maker-check.json');
assert.equal(game.status,'PASS');assert.equal(camera.pass,true);assert.equal(maker.status,'PASS');
for(const p of [game,camera]){assert.equal(p.sha256,hashes['game.html']);assert.equal(p.nativeBundleSha256,pins.entrySha256);}
for(const p of [game,camera,maker])assert.deepEqual(p.views.map(v=>v.width),[1200,390]);
for(const v of game.views){assert.deepEqual(v.pageErrors,[]);assert.deepEqual(v.networkRequests,[]);}
assert.equal(game.views[0].completed.finished,true);assert.equal(game.views[0].completed.fallback,false);assert.equal(game.views[0].completed.error,null);assert(game.views[0].completed.match.inning>=9);
const records=await json(qa+'/game/normal-game-records.json');let settled=0,fields=0,minimumCenterDistance=Infinity;
for(const r of records.records)if(r.fieldEnd){
 fields++;const d=r.fieldDiagnostics.fielderSeparation;
 assert(d.planCount>0);assert(d.minimumPlannedStepGapMeters>=.02);assert(d.minimumStoppingGapMeters>=.02);
 const f=r.fieldFinalFrame.fielders;assert.equal(f.length,9);
 for(let i=0;i<f.length;i++)for(let j=i+1;j<f.length;j++){
  const distance=Math.hypot(f[i].position.x-f[j].position.x,f[i].position.z-f[j].position.z);
  assert(distance>=.48);minimumCenterDistance=Math.min(minimumCenterDistance,distance);
 }
 if(r.fieldEnd.reason==='live_action_complete'){
  const c=r.fieldDiagnostics.playClosure;
  assert.equal(c.runnerDecisionPending,false);assert.deepEqual(c.activeRunnerIds,[]);assert.equal(c.pendingCatchBy,null);assert(c.possessedBy);assert(c.lastRunnerEvaluationSeconds<=r.fieldEnd.elapsedSeconds);assert(r.fieldFinalFrame.ball.possessedBy);
  for(const runner of r.fieldFinalFrame.runners)if(!runner.retired&&!runner.scored){assert.equal(runner.targetBase,null);assert(Math.hypot(runner.velocity.x,runner.velocity.y,runner.velocity.z)<1e-8);}
  settled++;
 }
}
assert(fields>0&&settled>0);assert.equal(records.records.length,game.views[0].completed.pitches);
const docs=['README.md','docs/history/README.md','docs/history/TIMELINE.md','docs/history/INCIDENTS.md','docs/handoffs/LATEST.md','docs/reports/2026-10-18-v51-fielder-avoidance.md',dir+'/README.md'];let links=0;
for(const p of docs)for(const m of(await readFile(p,'utf8')).matchAll(/\]\(([^)]+)\)/g)){
 const target=m[1].split('#')[0];if(!target||/^[a-z]+:/i.test(target))continue;
 assert(await stat(resolve(dirname(p),decodeURIComponent(target))),p+' -> '+target);links++;
}
const report={pass:true,gameSha256:hashes['game.html'],nativeBundleSha256:pins.entrySha256,sourceInputs:108,regulationPitches:records.records.length,fieldPlays:fields,settledLivePlays:settled,minimumFinalBodyCenterDistanceMeters:minimumCenterDistance,widths:[1200,390],unchangedV50CameraAndV47Maker:true,linksChecked:links};
await writeFile(qa+'/release-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
