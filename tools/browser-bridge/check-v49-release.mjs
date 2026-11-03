import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {resolve,dirname} from 'node:path';
const dir='docs/demos/releases/v49',qa='docs/verification/releases/v49',sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p,'utf8'));
const hashes=await json(dir+'/SHA256.json');
for(const [p,h]of Object.entries(hashes))assert.equal(sha(await readFile(dir+'/'+p)),h,p);
const pins=await json(dir+'/game.html.bundle-inputs.json'),build=await json(dir+'/game.html.build.json'),old=await json('docs/demos/releases/v48/game.html.build.json');
assert.equal(Object.keys(pins.inputs).length,107);for(const [p,h]of Object.entries(pins.inputs))assert.equal(sha(await readFile(p)),h,p);
assert.equal(sha(await readFile('dist/native-match-core-browser.js')),pins.entrySha256);
assert((await readFile(dir+'/game.html','utf8')).includes(await readFile('dist/native-match-core-browser.js','utf8')));
assert.equal(build.presentationVersion,49);assert.equal(build.bundleInputCount,107);
for(const key of ['continuousViewSha256','physicalRosterSha256','physicalCatalogSha256','measuredReferenceSha256','takenGazeHelperSha256','batterGazeHelperSha256','chartHelperSha256','fieldCameraHelperSha256','actorAnimationHelperSha256','playDescriptionHelperSha256','approvedPngMasksSha256','approvedFontSha256','ordinaryCadenceMs','displayGridPixels'])assert.equal(build[key],old[key],key);
assert.equal(sha(await readFile('docs/demos/releases/v48/game.html')),'a529f2f0e3a99ce256ad1e136a6b7d5642048d27f32ccc83c1453cd78b8821b5');
assert.equal(sha(await readFile('docs/demos/releases/v47/maker.html')),'7848228105d598f75c8e1eeb347c2ecbb6f3b749c9b1ea5433f2dcdfc97abd8c');
assert.deepEqual(await readFile(dir+'/game.html'),await readFile('../../outputs/ばせぼーるlv49_TBD_vs_LAD_守備責任と走塁裁定修正版.html'));
const game=await json(qa+'/game/game-check.json'),camera=await json(qa+'/cameras/continuous-view-check.json'),maker=await json(qa+'/maker/public-maker-check.json');
assert.equal(game.status,'PASS');assert.equal(camera.pass,true);assert.equal(maker.status,'PASS');
for(const p of [game,camera]){assert.equal(p.sha256,hashes['game.html']);assert.equal(p.nativeBundleSha256,pins.entrySha256);}
for(const p of [game,camera,maker])assert.deepEqual(p.views.map(v=>v.width),[1200,390]);
for(const v of game.views){assert.deepEqual(v.pageErrors,[]);assert.deepEqual(v.networkRequests,[]);}
assert.equal(game.views[0].completed.finished,true);assert.equal(game.views[0].completed.fallback,false);assert.equal(game.views[0].completed.error,null);assert(game.views[0].completed.match.inning>=9);
const records=await json(qa+'/game/normal-game-records.json');let settled=0;
for(const r of records.records)if(r.fieldEnd?.reason==='live_action_complete'){
 const c=r.fieldDiagnostics.playClosure;assert.equal(c.runnerDecisionPending,false);assert.deepEqual(c.activeRunnerIds,[]);assert.equal(c.pendingCatchBy,null);assert(c.possessedBy);assert(c.lastRunnerEvaluationSeconds<=r.fieldEnd.elapsedSeconds);assert(r.fieldFinalFrame.ball.possessedBy);
 for(const runner of r.fieldFinalFrame.runners)if(!runner.retired&&!runner.scored){assert.equal(runner.targetBase,null);assert(Math.hypot(runner.velocity.x,runner.velocity.y,runner.velocity.z)<1e-8);}
 settled++;
}
assert(settled>0);assert.equal(records.records.length,game.views[0].completed.pitches);
const docs=['README.md','docs/history/README.md','docs/history/TIMELINE.md','docs/history/INCIDENTS.md','docs/handoffs/LATEST.md','docs/reports/2026-10-18-v49-positional-defense.md',dir+'/README.md'];let links=0;
for(const p of docs)for(const m of(await readFile(p,'utf8')).matchAll(/\]\(([^)]+)\)/g)){const target=m[1].split('#')[0];if(!target||/^[a-z]+:/i.test(target))continue;assert(await stat(resolve(dirname(p),decodeURIComponent(target))),p+' -> '+target);links++;}
const report={pass:true,gameSha256:hashes['game.html'],nativeBundleSha256:pins.entrySha256,sourceInputs:107,regulationPitches:records.records.length,settledLivePlays: settled,widths:[1200,390],unchangedV48CameraAndV47Maker:true,linksChecked:links};
await writeFile(qa+'/release-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
