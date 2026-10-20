import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.V32_PLAYWRIGHT_CORE??'C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [artifactArg,recordingArg,evidenceArg]=process.argv.slice(2);
if(!artifactArg||!recordingArg||!evidenceArg)throw new Error('requires final HTML, Native execution JSON and NEW evidence directory');
const artifact=resolve(artifactArg),execution=JSON.parse(await readFile(recordingArg,'utf8')),evidence=resolve(evidenceArg);
await mkdir(evidence,{recursive:false});
const browser=await chromium.launch({executablePath:process.env.V32_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={artifact,artifactSha256:createHash('sha256').update(await readFile(artifact)).digest('hex'),viewports:[],
 boundary:'Native executed finite prefix observed in the primary ordinary canvas; no full-game, real-phone or named-player calibration proof'};
try{
 for(const viewport of [{width:1200,height:860},{width:390,height:844}]){
  const page=await browser.newPage({viewport}),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(String(error)));page.on('request',request=>{if(!request.url().startsWith('file:')&&!request.url().startsWith('data:'))requests.push(request.url());});
  await page.goto(pathToFileURL(artifact).href);await page.evaluate(()=>document.fonts.ready);
  const initial=await page.evaluate(()=>({native:window.nativeFieldPlayback.inspect(),legacyGeneratedPitches:window.matchPreview.recording.pitches.length}));
  assert.equal(initial.native.version,32);assert.equal(initial.native.primitiveCount,execution.root.response.world.actors.length);
  assert.equal(initial.native.playerCount,10);assert.equal(initial.native.heldBatCount,1);
  assert.deepEqual(initial.native.observedMoment,execution.root.cursor.moment);
  assert.equal(initial.native.legacyFallback,false);assert.equal(initial.native.canIssueMotion,false);
  assert.equal(initial.native.officialResult,null);assert.equal(initial.native.provenance,'HOST_EXPORTED_EXECUTION_NOT_BROWSER_AUTHENTICATION');
  assert.equal(await page.locator('#native-proof-panel').isVisible(),false);
  assert.equal(await page.locator('#finish-game').isDisabled(),true);
  assert.equal(await page.locator('#score-body tr').count(),0);
  await page.locator('#next-pitch').click();
  const advanced=await page.evaluate(()=>window.nativeFieldPlayback.inspect().observedMoment.elapsedSeconds);
  assert(advanced>initial.native.fromElapsedSeconds);
  await page.locator('#previous-pitch').click();
  assert.equal(await page.evaluate(()=>window.nativeFieldPlayback.inspect().observedMoment.elapsedSeconds),initial.native.fromElapsedSeconds);
  assert.equal(await page.locator('#pa-select').textContent(),'後続動作');
  assert.equal(await page.locator('#managed-team').textContent(),'実行済み記録');
  const pitcherId=execution.root.response.world.actors.find(actor=>actor.primitive.role==='body'
   &&!execution.root.heldBats.some(bat=>bat.holderPlayerId===actor.playerId)).playerId;
  await page.locator('[data-camera="mound"]').click();
  const pitcherCameraStart=await page.evaluate(()=>window.nativeFieldPlayback.inspect());
  const pitcherStart=initial.native.actors.find(actor=>actor.playerId===pitcherId);
  assert.equal(pitcherCameraStart.rendered.cameraEye.x,pitcherStart.anchor.x);
  assert.equal(pitcherCameraStart.rendered.cameraEye.z,pitcherStart.anchor.z);
  assert.deepEqual(pitcherCameraStart.observedMoment,initial.native.observedMoment);
  const middle=(initial.native.fromElapsedSeconds+initial.native.throughElapsedSeconds)/2;
  await page.evaluate(elapsed=>window.nativeFieldPlayback.seek(elapsed),middle);
  const middleFrame=await page.evaluate(()=>window.nativeFieldPlayback.inspect());
  assert(middleFrame.observedMoment.elapsedSeconds<=middle);
  assert(middle-middleFrame.observedMoment.elapsedSeconds<=.055000000001);
  assert(middleFrame.actors.some((actor,i)=>actor.bodyPosition.x!==initial.native.actors[i].bodyPosition.x||actor.bodyPosition.z!==initial.native.actors[i].bodyPosition.z));
  const cameras=[];
  for(const camera of ['overhead','mound','batter','catcher','runner']){
   await page.locator('[data-camera="'+camera+'"]').click();
   const observed=await page.evaluate(()=>window.nativeFieldPlayback.inspect());
   assert.deepEqual(observed.observedMoment,middleFrame.observedMoment);assert.deepEqual(observed.ball,middleFrame.ball);assert.deepEqual(observed.actors,middleFrame.actors);
   assert.equal(observed.rendered.zoneCorners.length,0);
   if(observed.rendered.ballDotDisplay)assert.equal(observed.rendered.ballDotDisplay.style,'4px-dot-grid');
   cameras.push({camera,exactSourceStateUnchanged:true,zoneHidden:true,ballStyle:observed.rendered.ballDotDisplay?.style??'outside_view'});
   if(camera==='overhead'||camera==='mound')await page.screenshot({path:resolve(evidence,camera+'-'+viewport.width+'.png'),fullPage:true});
  }
  await page.locator('#restart').click();await page.locator('#play').click();
  await page.waitForFunction(()=>window.nativeFieldPlayback.inspect().atCoverageEnd&&!window.nativeFieldPlayback.inspect().playing,null,{timeout:10000});
  const final=await page.evaluate(()=>({native:window.nativeFieldPlayback.inspect(),legacyGeneratedPitches:window.matchPreview.recording.pitches.length,
    result:document.getElementById('result-text').textContent,scoreRows:document.querySelectorAll('#score-body tr').length}));
  assert.deepEqual(final.native.observedMoment,execution.executedThroughMoment);
  assert.equal(final.legacyGeneratedPitches,initial.legacyGeneratedPitches);assert.equal(final.scoreRows,0);
  assert.equal(final.native.officialResult,null);assert.equal(final.result,'後続の承認済み動作待ち');
  assert.deepEqual(final.native.ball.orientation,execution.steps.at(-1).state.orientation);
  await page.locator('[data-camera="mound"]').click();
  const pitcherCameraEnd=await page.evaluate(()=>window.nativeFieldPlayback.inspect());
  const pitcherEnd=final.native.actors.find(actor=>actor.playerId===pitcherId);
  assert.equal(pitcherCameraEnd.rendered.cameraEye.x,pitcherEnd.anchor.x);
  assert.equal(pitcherCameraEnd.rendered.cameraEye.z,pitcherEnd.anchor.z);
  assert(pitcherCameraStart.rendered.cameraEye.x!==pitcherCameraEnd.rendered.cameraEye.x
   ||pitcherCameraStart.rendered.cameraEye.z!==pitcherCameraEnd.rendered.cameraEye.z);
  assert.deepEqual(pitcherCameraEnd.observedMoment,execution.executedThroughMoment);
  await page.setViewportSize({width:viewport.width,height:viewport.height+1});await page.waitForTimeout(60);
  assert.deepEqual(await page.evaluate(()=>window.nativeFieldPlayback.inspect().observedMoment),execution.executedThroughMoment);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  report.viewports.push({width:viewport.width,playerCount:initial.native.playerCount,primitiveCount:initial.native.primitiveCount,storedFrameCount:initial.native.frameCount,
   initialExactMoment:initial.native.observedMoment,finalExactMoment:final.native.observedMoment,actualDefenderMotionObserved:true,cameras,
   actualPitcherCameraTracking:{start:pitcherCameraStart.rendered.cameraEye,end:pitcherCameraEnd.rendered.cameraEye},
   primaryCanvas:true,coverageEndStops:true,legacyGeneratedPitchesUnchanged:true,networkRequests:0,pageErrors:0});
  await page.close();
 }
 await writeFile(resolve(evidence,'browser-check.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({result:'PASS',artifactSha256:report.artifactSha256,viewports:report.viewports.map(v=>({width:v.width,playerCount:v.playerCount,
  primitiveCount:v.primitiveCount,storedFrameCount:v.storedFrameCount,cameras:v.cameras.length,coverageEndStops:v.coverageEndStops})),evidence},null,2));
}finally{await browser.close();}
