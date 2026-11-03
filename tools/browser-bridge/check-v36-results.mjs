import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [artifactArg,evidenceArg]=process.argv.slice(2);if(!artifactArg||!evidenceArg)throw new Error('requires HTML and NEW evidence directory');
const registeredField=process.argv.includes('--registered-field');
const artifact=resolve(artifactArg),evidence=resolve(evidenceArg);await mkdir(evidence,{recursive:false});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={artifact,sha256:sha(await readFile(artifact)),views:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
 for(const [path,expected]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),expected,path);
 assert.equal(sha(await readFile('dist/native-match-core-browser.js')),pins.entrySha256);
 assert.equal(sha(await readFile('../../outputs/ばせぼーるlv35_TBD_vs_LAD_俯瞰と左右スイング修正版.html')),'9ace35d886d7436cbd24ccf8e225ccd18acef31609e23125df6b2f12fd4eb266');
 report.unchangedCoreInputs=Object.keys(pins.inputs).length;report.nativeBundleSha256=pins.entrySha256;
 let baseline=null;
 const hashes=page=>page.evaluate(async()=>Promise.all(window.liveMatchPlayback.inspect().host.history.map(async r=>{
  const bytes=new TextEncoder().encode(JSON.stringify({frames:r.frames,play:r.play,events:r.events,match:r.match}));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
 })));
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:860}}),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(String(error)));page.on('request',r=>{if(!/^(file:|data:)/.test(r.url()))requests.push(r.url());});
  await page.goto(pathToFileURL(artifact).href);await page.evaluate(()=>document.fonts.ready);
  const generated=await page.evaluate(registered=>{
   for(let i=0;i<60;i++){
    document.getElementById('next-pitch').click();
    const s=window.liveMatchPlayback.inspect();if(s.error)throw new Error(s.error);
    if(i>=19&&(!registered||s.host.history.some(r=>r.play.classification==='home_run')&&s.host.history.some(r=>r.play.classification==='fly_out')))return s.generatedPitches;
   }return window.liveMatchPlayback.inspect().generatedPitches;
  },registeredField);
  const beforeHashes=await hashes(page);
  const cases=await page.evaluate(registered=>{
   const h=window.liveMatchPlayback.inspect().host.history,data=JSON.parse(document.getElementById('match-data').textContent);
   const describe=(r,pitch,kind)=>{
    const at=kind==='hr'?r.play.field.ruleFacts.overFence.tick:r.play.field.ruleFacts.flyCatch.secureCatchTick;
    const before=r.frames.findLastIndex(f=>f.tick<at),after=r.frames.findIndex(f=>f.tick>=at),
     mid=r.frames.findIndex(f=>f.tick>at+500000&&f.tick<r.play.rules.endedAtTick);
    return {pitch,kind,name:data.players[r.batterPlayerId].name,at,before,after,mid,end:r.play.rules.endedAtTick,
     homeTouches:r.play.field.ruleFacts.runnerTouches.filter(t=>t.base===4),beforeMatch:r.beforeMatch,finalMatch:r.match,
     number:r.frames.length,speed:r.speedKmh};
   };
   let hr=h.findIndex(r=>r.beforeMatch.inning===1&&/FANZAWA/i.test(data.players[r.batterPlayerId].name)&&r.play.classification==='home_run');
   if(hr<0&&registered)hr=h.findIndex(r=>r.play.classification==='home_run');
   const fly=h.findIndex(r=>r.play.classification==='fly_out'&&r.play.field?.ruleFacts.flyCatch);
   const ground=h.findIndex(r=>r.play.classification==='live_ball'&&r.frames.some(f=>f.possessedBy&&f.tick<r.play.rules.endedAtTick));
   return{hr:hr<0?null:describe(h[hr],hr,'hr'),fly:fly<0?null:describe(h[fly],fly,'fly'),ground};
  },registeredField);
  assert(cases.hr&&cases.fly,'actual FANZAWA first-inning HR and fly required');
  const observations=[];
  const read=()=>page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{
   tick:s.currentFrame.tick,observed:s.observedMatch,headline:document.getElementById('result-text').textContent,
   meta:document.getElementById('pitch-meta').textContent,color:getComputedStyle(document.getElementById('pitch-number')).color,
   announcement:document.getElementById('announcement').textContent,playing:s.playing,count:s.generatedPitches,observation:s.resultObservation??null,
   frameJson:JSON.stringify(s.currentFrame)};});
  const seek=(pitch,frame)=>page.evaluate(({pitch,frame})=>window.liveMatchPlayback.seekPitch(pitch,frame),{pitch,frame});
  for(const scene of [cases.hr,cases.fly]){
   assert(scene.before>=0&&scene.after>=0&&scene.at<scene.end);
   await seek(scene.pitch,scene.before);let s=await read();assert(s.tick<scene.at);assert(!/ホームラン|フライアウト/.test(s.headline));
   assert.deepEqual(s.observed,scene.beforeMatch);
   await seek(scene.pitch,scene.after);s=await read();assert(s.tick>=scene.at&&s.tick<scene.end);
   const label=scene.kind==='hr'?'ホームラン':'フライアウト';assert.equal(s.headline,label);
   assert.equal(s.color,scene.kind==='hr'?'rgb(118, 188, 235)':'rgb(237, 101, 95)');
   assert.equal(s.observation.atTick,scene.at);assert(s.meta.includes('km/h'));assert(s.announcement.includes(label));
   assert.deepEqual(s.observed,scene.beforeMatch,'early headline must not apply final score/count/inning');
   if(scene.kind==='hr'){assert(scene.homeTouches.length>0);assert(s.tick<Math.min(...scene.homeTouches.map(t=>t.tick)));}
   if(scene.mid>=0){await seek(scene.pitch,scene.mid);assert.equal((await read()).headline,label);}
   await seek(scene.pitch,scene.number-1);assert.deepEqual((await read()).observed,scene.finalMatch);
   // Replay must not leave the result or screen-reader announcement visible
   // before the actual confirmation event.
   await seek(scene.pitch,scene.before);s=await read();assert(!s.headline.includes(label));assert.equal(s.announcement,'');
   await page.evaluate(()=>window.liveMatchPlayback.play());
   await page.waitForFunction(label=>document.getElementById('result-text').textContent===label,label,{timeout:2500});
   s=await read();assert(s.playing);assert.equal(s.count,generated);assert(s.tick>=scene.at&&s.tick<scene.end);
   await page.evaluate(()=>window.liveMatchPlayback.stop());
   await page.screenshot({path:resolve(evidence,scene.kind+'-confirmed-'+width+'.png'),fullPage:true});
   observations.push({...scene,observedAtTick:s.tick,savedDelaySeconds:(scene.end-scene.at)/1e6});
  }
  if(cases.ground>=0){
   const at=await page.evaluate(index=>{const r=window.liveMatchPlayback.inspect().host.history[index];return r.frames.findIndex(f=>f.possessedBy&&f.tick<r.play.rules.endedAtTick);},cases.ground);
   await seek(cases.ground,at);assert(!/ホームラン|フライアウト/.test((await read()).headline),'ground-ball possession is not a fly catch');
  }
  const actual=await hashes(page);
  if(registeredField)assert.deepEqual(actual,beforeHashes,'UI may not mutate the newly registered Core record');
  else if(!baseline){const old=await browser.newPage();await old.goto(pathToFileURL(resolve('../../outputs/ばせぼーるlv35_TBD_vs_LAD_俯瞰と左右スイング修正版.html')).href);
   await old.evaluate(()=>{for(let i=0;i<20;i++)document.getElementById('next-pitch').click();});baseline=await hashes(old);await old.close();}
  if(!registeredField)assert.deepEqual(actual,baseline);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  assert.equal(await page.evaluate(()=>window.liveMatchPlayback.inspect().error),null);
  report.views.push({width,generated,registeredField,observations,groundDoesNotAnnounceFly:cases.ground>=0,unchangedCoreHashes:actual,pageErrors:errors,networkRequests:requests});await page.close();
 }
 report.status='PASS';await writeFile(resolve(evidence,'result-check.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',viewports:report.views.map(v=>v.width),unchangedCorePitches:20}));
}catch(error){report.status='FAIL';report.error=error.stack;await writeFile(resolve(evidence,'result-check.json'),JSON.stringify(report,null,2)+'\n');throw error;}
finally{await browser.close();}
