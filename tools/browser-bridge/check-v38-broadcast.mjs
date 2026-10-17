import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [artifactArg,evidenceArg]=process.argv.slice(2);
if(!artifactArg||!evidenceArg)throw new Error('requires HTML and NEW evidence directory');
const artifact=resolve(artifactArg),evidence=resolve(evidenceArg);await mkdir(evidence,{recursive:false});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const baseline=JSON.parse(await readFile('../../outputs/verification-v37-animations-v3/animation-check.json','utf8'));
const report={artifact,sha256:sha(await readFile(artifact)),baselineArtifact:baseline.artifact,views:[]};
let browser;
const seek=(page,{pitch,frame=0,ms})=>page.evaluate(({pitch,frame,ms})=>{
 window.liveMatchPlayback.seekPitch(pitch,frame);if(ms!==undefined)window.liveMatchPlayback.seekPresentationMs(ms);
},{pitch,frame,ms});
const camera=(page,name)=>page.locator('[data-camera="'+name+'"]').click();
const read=page=>page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{
 tick:s.currentFrame.tick,frame:s.currentFrame,rendered:s.rendered,presentation:s.presentation,observed:s.observedMatch,
 headline:document.getElementById('result-text').textContent,list:document.getElementById('pitch-list').textContent,error:s.error};});
const hashes=page=>page.evaluate(async()=>Promise.all(window.liveMatchPlayback.inspect().host.history.slice(0,8).map(async r=>{
 const b=new TextEncoder().encode(JSON.stringify({frames:r.frames,play:r.play,events:r.events,match:r.match}));
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');
})));

try{
 const pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
 assert.equal(Object.keys(pins.inputs).length,97);
 for(const [path,expected]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),expected,path);
 assert.equal(sha(await readFile('dist/native-match-core-browser.js')),pins.entrySha256);
 assert((await readFile(artifact,'utf8')).includes(await readFile('dist/native-match-core-browser.js','utf8')));
 assert.equal(baseline.status,'PASS');assert.equal(sha(await readFile(baseline.artifact)),baseline.sha256);
 assert.equal(baseline.nativeBundleSha256,pins.entrySha256);assert.equal(baseline.unchangedCoreInputs,97);
 report.sourcePins=97;report.nativeBundleSha256=pins.entrySha256;report.baselineSha256=baseline.sha256;
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:860}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:)/.test(r.url()))requests.push(r.url());});
  await page.goto(pathToFileURL(artifact).href);await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>typeof window.KneekuraLivePlayDescription?.describe),'function','missing v38 result description');
  await page.locator('details.settings > summary').click();await page.locator('#auto-overhead').uncheck();await camera(page,'catcher');
  await page.evaluate(()=>{for(let i=0;i<20;i++){
   document.getElementById('next-pitch').click();const s=window.liveMatchPlayback.inspect();if(s.error)throw new Error(s.error);
  }window.liveMatchPlayback.stop();});
  const coreHashes=await hashes(page);assert.deepEqual(coreHashes,baseline.views[0].coreHashes,'v37/v38 identical eight actual Core pitches');
  const sourceBefore=await page.evaluate(()=>JSON.stringify(window.liveMatchPlayback.inspect().host.history));
  const cases=await page.evaluate(()=>{
   const h=window.liveMatchPlayback.inspect().host.history,descriptions=h.map((r,pitch)=>({pitch,description:window.KneekuraLivePlayDescription.describe(r),
    officialMs:1540+(r.play.rules.endedAtTick-r.frames[0].tick)/1000,last:r.frames.length-1}));
   const third=descriptions.find(d=>d.description.thirdOut);
   const field=h.findIndex(r=>{
    const first=r.frames.find(f=>f.ballKind==='batted');if(!first)return false;
    const delay=Math.max(1,Math.min(2,70/Math.max(1,Math.hypot(first.ball.velocity.x,first.ball.velocity.y,first.ball.velocity.z)))),
     middle=r.frames.findLast(f=>f.tick<=first.tick+delay*500000);
    return middle?.ball&&!middle.possessedBy&&middle.ballKind==='batted';
   });
   let marks=null;
   for(const [pitch,r]of h.entries())if(h.slice(0,pitch).some(p=>p.beforeMatch.playId===r.beforeMatch.playId)){
    const flight=r.frames.findIndex(f=>f.phase==='pitch'&&f.ball&&!f.possessedBy),held=r.frames.findIndex(f=>f.possessedBy&&f.phase==='pitch');
    if(flight>=0&&held>=0){marks={pitch,flight,held};break;}
   }
   return{descriptions,third,field,marks};
  });
  assert(cases.third,'actual third-out coverage in twenty issued pitches');assert(cases.field>=0,'actual batted-ball catcher tracking');
  assert(cases.marks,'actual same-appearance history with a preceding mark');
  for(const entry of cases.descriptions){
   assert(!/^\d+アウト$|インプレーの進塁/.test(entry.description.label),'generic result label: '+entry.description.label);
   if(entry.description.classification==='live_ball')assert.equal(entry.description.scoring.officialHit,null,'unscored advancement must not invent a hit');
   if(entry.description.playOuts)assert(entry.description.outReasons.every(r=>r.label&&r.cause),'outs require factual reasons');
  }
  const explicit=await page.evaluate(()=>{
   const original=window.liveMatchPlayback.inspect().host.history[0],rows=[];
   for(const [classification,label]of [['single','ヒット（単打）'],['double','二塁打'],['triple','三塁打']]){
    const fixture=structuredClone(original);fixture.play.classification=classification;fixture.play.rules.outcomes=[];
    const before=JSON.stringify(fixture),description=window.KneekuraLivePlayDescription.describe(fixture);
    if(JSON.stringify(fixture)!==before)throw new Error('description mutated its declared unit fixture');rows.push({classification,label,description});
   }return rows;
  });for(const row of explicit)assert.equal(row.description.label,row.label);

  // Read-only seeks use the existing display clock. No ball/frame is created.
  const fades=[];
  for(const [stage,scene,expected]of [
   ['ready',{pitch:cases.marks.pitch,ms:0},1],['preparation',{pitch:cases.marks.pitch,ms:1500},.06],
   ['flight',{pitch:cases.marks.pitch,frame:cases.marks.flight},.06],['held',{pitch:cases.marks.pitch,frame:cases.marks.held},1]]){
   await seek(page,scene);await camera(page,'catcher');const s=await read(page);
   assert.equal(s.presentation.pitchMarksOpacity,expected,stage+' pitch marks opacity');
   const world=s.rendered.historyMarks??[],chart=s.presentation.chart.chartMarks;
   assert(world.length>0&&chart.length>0,'existing marks remain present at '+stage);
   for(const m of [...world,...chart])assert(m.alpha>0&&m.alpha<=expected,'only mark opacity changes at '+stage);
   assert.equal(s.rendered.zoneCorners.length,4,'strike zone remains visible during an unbatted pitch');
   fades.push({stage,opacity:expected,world:world.map(m=>({pitchId:m.pitchId,alpha:m.alpha})),chart:chart.map(m=>({pitchId:m.pitchId,alpha:m.alpha}))});
  }

  const firstBatted=await page.evaluate(p=>window.liveMatchPlayback.inspect().host.history[p].frames.findIndex(f=>f.ballKind==='batted'),cases.field);
  await seek(page,{pitch:cases.field,frame:firstBatted});await camera(page,'catcher');
  let initial=await read(page),follow=initial.presentation.catcherFollow;
  assert(follow&&Number.isSafeInteger(follow.startTick)&&follow.delaySeconds>0,'causal catcher follow evidence');
  const firstTick=await page.evaluate(p=>window.liveMatchPlayback.inspect().host.history[p].frames[0].tick,cases.field),
   startMs=1540+(follow.startTick-firstTick)/1000,beforeMs=startMs+follow.delaySeconds*500,afterMs=startMs+follow.delaySeconds*1000+55;
  const followChecks=[];
  for(const automatic of [false,true]){
   await seek(page,{pitch:cases.field,ms:beforeMs});await camera(page,'catcher');await page.locator('#auto-overhead').setChecked(automatic);
   const before=await read(page);assert.equal(before.rendered.camera,'catcher');
   const eye=before.rendered.cameraEye,target=before.frame.ball?.position;
   assert(target,'actual ball target during catcher follow');
   assert.deepEqual(before.presentation.catcherFollow.target,target);
   const yaw=Math.atan2(target.x-eye.x,target.z-eye.z),pitch=-Math.atan2(target.y-eye.y,Math.hypot(target.x-eye.x,target.z-eye.z));
   assert(Math.abs(Math.atan2(Math.sin(before.rendered.cameraYaw-yaw),Math.cos(before.rendered.cameraYaw-yaw)))<1e-9);
   assert(Math.abs(before.rendered.cameraPitch-pitch)<1e-9);
   await seek(page,{pitch:cases.field,ms:afterMs});const after=await read(page);assert.equal(after.rendered.camera,automatic?'overhead':'catcher');
   await seek(page,{pitch:cases.field+1,ms:0});const next=await read(page);assert.equal(next.rendered.camera,'catcher','next preparation returns to catcher');
   followChecks.push({automatic,startTick:follow.startTick,delaySeconds:follow.delaySeconds,before:before.rendered.camera,after:after.rendered.camera,next:next.rendered.camera});
  }

  const results=[];
  for(const entry of cases.descriptions){
   await seek(page,{pitch:entry.pitch,ms:entry.officialMs});const s=await read(page),display=s.presentation.resultDisplay;
   assert(display,'resultDisplay evidence');assert.equal(display.playLabel,entry.description.label);
   assert.equal(display.thirdOut,entry.description.thirdOut);assert.equal(display.outsAfter,entry.description.outsAfter);
   assert(s.list.includes(entry.description.label),'pitch list keeps the play description');
   if(entry.description.thirdOut){
    assert.equal(s.headline,entry.description.label,'actual play before change announcement');
    await seek(page,{pitch:entry.pitch,ms:entry.officialMs+1100});const changed=await read(page);
    assert(/3アウト|３アウト|チェンジ/.test(changed.headline),'third-out change follows the actual play');
    assert(changed.list.includes(entry.description.label));results.push({pitch:entry.pitch,play:s.headline,change:changed.headline,display:changed.presentation.resultDisplay});
   }
  }
  // Existing presentation adapters must still be fed the exact current record.
  const retained=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect(),r=s.lastResult,clips=JSON.parse(document.getElementById('v33-measured-bats').textContent).clips;
   return{observed:s.presentation.actorAnimation,expected:window.KneekuraLiveActorAnimation.observe({record:r,frame:s.currentFrame,sceneMs:s.presentation.elapsedMs,
    preparationMs:1540,measuredClip:clips.find(c=>c.id===r.play.diagnostics.measuredClipId)}),near:s.rendered.nearRunnerHiddenActors,
    history:JSON.stringify(s.host.history),error:s.error};});
  assert.deepEqual(retained.observed,retained.expected);assert(Array.isArray(retained.near));assert.equal(retained.history,sourceBefore);
  assert.equal(retained.error,null);assert.deepEqual(await hashes(page),coreHashes);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  await page.screenshot({path:resolve(evidence,'broadcast-'+width+'.png'),fullPage:true});
  report.views.push({width,actualPitches:20,unchangedCoreHashes:coreHashes,descriptions:cases.descriptions,explicit,fades,followChecks,results,pageErrors:errors,networkRequests:requests});
  await page.close();
 }
 report.status='PASS';await writeFile(resolve(evidence,'broadcast-check.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',viewports:report.views.map(v=>v.width),sourcePins:97,unchangedActualPitches:8}));
}catch(error){report.status='FAIL';report.error=error.stack;await writeFile(resolve(evidence,'broadcast-check.json'),JSON.stringify(report,null,2)+'\n');throw error;}
finally{if(browser)await browser.close();}
