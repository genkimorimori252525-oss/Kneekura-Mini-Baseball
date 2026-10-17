import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [artifactArg,evidenceArg]=process.argv.slice(2);
if(!artifactArg||!evidenceArg)throw new Error('requires HTML and NEW evidence directory');
const artifact=resolve(artifactArg),evidence=resolve(evidenceArg),sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(evidence,{recursive:false});
const pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
const baseline=JSON.parse(await readFile('../../outputs/verification-v37-animations-v3/animation-check.json','utf8'));
const report={artifact,sha256:sha(await readFile(artifact)),views:[],nativeBundleSha256:pins.entrySha256};
const verifyPins=async()=>{assert.equal(Object.keys(pins.inputs).length,97);for(const [p,h]of Object.entries(pins.inputs))assert.equal(sha(await readFile(p)),h,p);
 assert.equal(sha(await readFile('dist/native-match-core-browser.js')),pins.entrySha256);};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const seek=(page,pitch,ms)=>page.evaluate(({pitch,ms})=>{window.liveMatchPlayback.seekPitch(pitch);window.liveMatchPlayback.seekPresentationMs(ms);},{pitch,ms});
const inspect=page=>page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{tick:s.currentFrame.tick,presentation:s.presentation,camera:s.rendered.camera,error:s.error};});
try{
 await verifyPins();assert.equal(baseline.status,'PASS');assert.equal(sha(await readFile(baseline.artifact)),baseline.sha256);
 assert.equal(baseline.nativeBundleSha256,pins.entrySha256);assert((await readFile(artifact,'utf8')).includes(await readFile('dist/native-match-core-browser.js','utf8')));
 const auditPath=resolve('../../work/v39-foul-source-audit-50.json'),audit=JSON.parse(await readFile(auditPath,'utf8'));
 const auditHtml=await readFile(audit.artifact,'utf8'),auditCore=[...auditHtml.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var KneekuraNativeMatchCore'));
 assert.equal(sha(auditHtml),audit.artifactSha256);assert.equal(sha(auditCore),audit.embeddedCoreSha256);
 assert.equal(auditCore,(await readFile('dist/native-match-core-browser.js','utf8'))+'\n','audit contains same bundle plus HTML separator newline');assert.equal(audit.records,50);
 const foulOut=audit.cases.find(c=>c.classification==='foul_out');assert(foulOut,'actual fifty-record foul-out audit');
 assert.equal(foulOut.deadAtTick,null);assert(foulOut.facts.some(f=>f.kind==='catch_secured'));
 report.sourceAudit={path:auditPath,sha256:sha(await readFile(auditPath)),records:50,foulOutAuditOnly:foulOut};
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:860}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:)/.test(r.url()))requests.push(r.url());});
  await page.goto(pathToFileURL(artifact).href);await page.evaluate(()=>document.fonts.ready);
  await page.locator('details.settings > summary').click();await page.locator('[data-camera="catcher"]').click();
  await page.locator('#auto-overhead').check();
  await page.evaluate(()=>{for(let i=0;i<20;i++){document.getElementById('next-pitch').click();const s=window.liveMatchPlayback.inspect();if(s.error)throw new Error(s.error);}window.liveMatchPlayback.stop();});
  const sourceBefore=await page.evaluate(()=>JSON.stringify(window.liveMatchPlayback.inspect().host.history));
  const hashes=await page.evaluate(async()=>Promise.all(window.liveMatchPlayback.inspect().host.history.slice(0,8).map(async r=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({frames:r.frames,play:r.play,events:r.events,match:r.match}))))].map(v=>v.toString(16).padStart(2,'0')).join(''))));
  assert.deepEqual(hashes,baseline.views[0].coreHashes,'eight actual Core records equal v37');
  const cases=await page.evaluate(()=>window.liveMatchPlayback.inspect().host.history.flatMap((r,pitch)=>{
   const dead=r.events.find(f=>f.kind==='play_end'&&f.reason==='foul_dead_ball');if(!dead)return[];
   return[{pitch,classification:r.play.classification,first:r.frames[0].tick,last:r.frames.at(-1).tick,dead,overFence:r.play.field?.ruleFacts.overFence,
    actualFieldFacts:r.play.field?.facts,previous:r.frames.findLast(f=>f.tick<dead.tick)?.tick}];}));
  assert(cases.length>0,'actual foul dead ball in twenty pitches');const checks=[];
  for(const c of cases){
   assert.equal(c.classification,'foul');assert(c.previous!==undefined);
   const deadMs=1540+(c.dead.tick-c.first)/1000,expected=1540+Math.max((c.last-c.first)/1000,(c.dead.tick-c.first)/1000+1500);
   await seek(page,c.pitch,1540+(c.previous-c.first)/1000);const before=await inspect(page);assert(before.tick<c.dead.tick);assert.equal(before.presentation.foulStop,null);
   await seek(page,c.pitch,deadMs);const at=await inspect(page);assert.equal(at.tick,c.dead.tick);assert.deepEqual(at.presentation.foulStop,{deadTick:c.dead.tick,holdMs:1500,source:'CORE_FOUL_DEAD_BALL'});
   assert.equal(at.presentation.durationMs,expected,'exact dead+1500ms presentation hold');
   await seek(page,c.pitch,expected-1);const near=await inspect(page);assert.equal(near.presentation.elapsedMs,expected-1);
   await seek(page,c.pitch,expected+100);const end=await inspect(page);assert.equal(end.presentation.elapsedMs,expected);assert.equal(end.camera,'overhead');
   const follow=end.presentation.catcherFollow;assert(follow.cutoverAtMs<=expected-330,'bounded catcher cut before foul end');
   await page.evaluate(()=>{window.liveMatchPlayback.play();window.liveMatchPlayback.stop();});
   const next=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{pitch:s.selectedPitch,camera:s.rendered.camera,stage:s.presentation.stage,foulStop:s.presentation.foulStop};});
   assert.equal(next.pitch,c.pitch+1);assert.equal(next.camera,'catcher');assert.equal(next.stage,'preparation');assert.equal(next.foulStop,null);
   checks.push({...c,deadMs,expectedDurationMs:expected,before,at,end,next});
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(window.liveMatchPlayback.inspect().host.history)),sourceBefore,'seeks/camera/play do not mutate Source');
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);assert.equal((await inspect(page)).error,null);
  await seek(page,cases[0].pitch,1540+(cases[0].dead.tick-cases[0].first)/1000+1000);
  await page.screenshot({path:resolve(evidence,'foul-'+width+'.png'),fullPage:true});
  report.views.push({width,actualPitches:20,coreHashes:hashes,checks,pageErrors:errors,networkRequests:requests});await page.close();
 }
 await verifyPins();report.unchangedSourceInputs=97;report.status='PASS';
 await writeFile(resolve(evidence,'foul-check.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',views:report.views.map(v=>v.width),actualFoulsPerView:report.views.map(v=>v.checks.length),unchangedSourceInputs:97,foulOut:'actual fifty-record Source audit only'}));
}catch(error){report.status='FAIL';report.error=error.stack;await writeFile(resolve(evidence,'foul-check.json'),JSON.stringify(report,null,2)+'\n');throw error;}
finally{await browser.close();}
