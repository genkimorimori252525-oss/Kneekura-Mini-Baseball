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
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={artifact,sha256:createHash('sha256').update(await readFile(artifact)).digest('hex'),views:[]};
try{
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 const manifest=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
 for(const [path,expected]of Object.entries(manifest.inputs))assert.equal(sha(await readFile(path)),expected,'unchanged browser input '+path);
 assert.equal(sha(await readFile('dist/native-match-core-browser.js')),manifest.entrySha256);
 const frozen=JSON.parse(await readFile('../../work/live-game-audit-v6/manifest.json','utf8'));
 const production=frozen.inputs.filter(entry=>entry.path.startsWith('src/'));
 for(const entry of production)assert.equal(sha(await readFile(entry.path)),entry.sha256,'unchanged audited Core '+entry.path);
 const v31=await readFile('../../outputs/ばせぼーるlv31_TBD_vs_LAD_剛体バット描画版.html','utf8'),v33=await readFile('../../outputs/ばせぼーるlv33_TBD_vs_LAD_Core試合版.html');
 assert.equal(sha(v33),'bb3e7d00390bbce32b070d28cf2076108bb49eedbef29a7d665af88c20a66af9');
 const styles=html=>[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(match=>match[1]);
 assert.deepEqual(styles(await readFile(artifact,'utf8')),styles(v31));
 report.unchangedInputs={browser:Object.keys(manifest.inputs).length,auditedProduction:production.length,nativeBundleSha256:manifest.entrySha256,
  v31Sha256:sha(v31),v33Sha256:sha(v33),v31StylesIdentical:true};
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:860}}),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(String(error)));page.on('request',request=>{if(!/^(file:|data:)/.test(request.url()))requests.push(request.url());});
  await page.goto(pathToFileURL(artifact).href);await page.evaluate(()=>document.fonts.ready);
  const read=()=>page.evaluate(()=>{
   const s=window.liveMatchPlayback.inspect();return {version:s.version,playing:s.playing,count:s.generatedPitches,index:s.selectedPitch,
    tick:s.currentFrame.tick,phase:s.currentFrame.phase,ballKind:s.currentFrame.ballKind,frame:s.frameIndex,stage:s.presentation?.stage,
    elapsed:s.presentation?.elapsedMs,duration:s.presentation?.durationMs,chart:s.presentation?.chart,rendered:s.rendered,
    error:s.error,officialAt:s.lastResult?.play.rules.endedAtTick,lastTick:s.lastResult?.frames.at(-1).tick,
    physicalEndMs:s.lastResult?(s.lastResult.frames.at(-1).tick-s.lastResult.frames[0].tick)/1000:null};
  });
  let s=await read();assert.equal(s.version,34);assert.equal(s.count,0);assert.equal(s.stage,'ready');assert.equal(s.rendered.camera,'catcher');
  assert.equal(await page.locator('#history').isDisabled(),false);assert.equal(await page.locator('#history').isChecked(),true);
  await page.locator('details.settings > summary').click();await page.locator('#auto-overhead').uncheck();
  await page.locator('#managed-team').selectOption('0');await page.locator('#batting-choice').selectOption('take');
  const samples=[];
  for(let pitch=1;pitch<=3;pitch++){
   await page.locator('#next-pitch').click();s=await read();assert.equal(s.count,pitch);assert.equal(s.playing,false);assert.equal(s.stage,'preparation');
   const original=await page.evaluate(()=>JSON.stringify(window.liveMatchPlayback.inspect().lastResult));
   for(const camera of ['catcher','mound','batter']){
    await page.locator('[data-camera="'+camera+'"]').click();
    const corners=(await read()).rendered.zoneCorners;
    assert.equal(corners.length,4,'zone during preparation '+camera+' pitch '+pitch);
    assert(corners.some(p=>p.x>=0&&p.x<=600&&p.y>=0&&p.y<=432),'zone visible '+camera+' pitch '+pitch+': '+JSON.stringify(corners));
   }
   await page.locator('[data-camera="catcher"]').click();
   await page.locator('#play').click();const prepTick=s.tick;await page.waitForTimeout(700);s=await read();
   assert.equal(s.stage,'preparation');assert.equal(s.tick,prepTick);assert.equal(s.count,pitch);
   // A command change during play pauses only at this scene's end. It cannot
   // replace this already-issued physical play or generate another pitch.
   await page.locator('#location-choice').selectOption(pitch%2?'low':'zone');
   await page.waitForFunction(()=>window.liveMatchPlayback.inspect().presentation.stage==='physical',null,{timeout:3000});
   s=await read();assert.equal(s.rendered.zoneCorners.length,4);assert.equal(s.chart.history.length,pitch-1);
   await page.waitForFunction(()=>{const s=window.liveMatchPlayback.inspect();return s.presentation.stage==='result'&&s.currentFrame.tick>=s.lastResult.play.rules.endedAtTick;},null,{timeout:5000});
   s=await read();assert.equal(s.chart.history.length,pitch,JSON.stringify(s));assert.equal(s.chart.history.at(-1).number,pitch);
   assert(s.chart.chartMarks.length>0);assert(s.rendered.historyMarks.length>0);assert(s.elapsed<s.duration);
   const resultHold=s.duration-1540-s.physicalEndMs;assert(resultHold>=1595);
   await page.waitForTimeout(700);assert.equal((await read()).count,pitch);
   await page.waitForFunction(()=>!window.liveMatchPlayback.inspect().playing,null,{timeout:5000});
   assert.equal((await read()).count,pitch);assert.equal(await page.evaluate(()=>JSON.stringify(window.liveMatchPlayback.inspect().lastResult)),original);
   assert.equal(await page.locator('#pitch-list button').count(),pitch);
   samples.push({pitch,preparationMs:1540,resultHoldMs:resultHold,zoneOnEveryPitch:true,numbering:true,marks:s.chart.chartMarks});
  }
  const before=await read();
  await page.locator('#pitch-list button').first().click();let after=await read();assert.equal(after.tick,before.tick);assert.equal(after.index,before.index);
  assert.equal(after.chart.selectedPitchId,'live-pitch-0');
  await page.locator('#pitch-list button').first().press('Enter');after=await read();assert.equal(after.playing,false);assert.equal(after.tick,before.tick);
  const chartPoint=after.chart.chartMarks.at(-1);assert(chartPoint);
  await page.locator('#pitch-chart').click({position:{x:chartPoint.x*(await page.locator('#pitch-chart').boundingBox()).width/320,y:chartPoint.y*(await page.locator('#pitch-chart').boundingBox()).height/304}});
  assert.equal((await read()).tick,before.tick);
  const main=(await read()).rendered.historyMarks.find(mark=>mark.pitchId==='live-pitch-1');
  if(main){const rect=await page.locator('#field').boundingBox();await page.locator('#field').click({position:{x:main.x*rect.width/600,y:main.y*rect.height/432}});
   assert.equal((await read()).chart.selectedPitchId,'live-pitch-1');assert.equal((await read()).tick,before.tick);}
  await page.locator('#history').uncheck();assert.equal((await read()).rendered.historyMarks.length,0);await page.locator('#history').check();
  await page.screenshot({path:resolve(evidence,'pitch-history-'+width+'.png'),fullPage:true});
  // Continuous ordinary play must enter the next preparation stage, while
  // the explicit next button above always remained paused.
  await page.locator('#play').click();await page.waitForFunction(()=>window.liveMatchPlayback.inspect().presentation.stage==='preparation'&&window.liveMatchPlayback.inspect().generatedPitches===4);
  await page.waitForFunction(()=>window.liveMatchPlayback.inspect().generatedPitches===5,null,{timeout:12000});
  await page.evaluate(()=>window.liveMatchPlayback.stop());assert.equal((await read()).playing,false);
  let final=null;
  if(width===1200){
   await page.locator('#batting-choice').selectOption('balanced');await page.locator('#managed-team').selectOption('1');
   await page.locator('#finish-game').click();
   await page.waitForFunction(()=>{const s=window.liveMatchPlayback.inspect();return s.error||(s.host.finished&&!s.fast);},null,{timeout:240000});
   final=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{finished:s.host.finished,match:s.host.match,pitches:s.generatedPitches,error:s.error,
    legacy:s.legacyResultFallback,native:s.nativeSqliteAdmission,classes:s.host.history.reduce((a,r)=>(a[r.play.classification]=(a[r.play.classification]??0)+1,a),{})};});
   assert.equal(final.error,null);assert(final.finished);assert(final.match.inning>=9);assert.equal(final.legacy,false);assert.equal(final.native,false);
   assert.equal(await page.locator('#play').textContent(),'試合を振り返る');assert.equal(await page.locator('#play').isDisabled(),false);
   assert.equal(await page.locator('#manager-hint').textContent(),'試合終了。最終結果を確認できます');
   await page.screenshot({path:resolve(evidence,'nine-innings.png'),fullPage:true});
   const scenes=await page.evaluate(()=>{const h=window.liveMatchPlayback.inspect().host.history;return{
    thirdOut:h.findIndex(r=>r.beforeMatch.outs+r.play.rules.outcomes.length>=3),
    fair:h.findIndex(r=>r.frames.some(f=>f.fairKnown&&f.ballKind==='batted')),foul:h.findIndex(r=>r.play.classification==='foul')};});
   assert(scenes.thirdOut>=0);assert(scenes.fair>=0);
   await page.evaluate(index=>window.liveMatchPlayback.seekPitch(index),scenes.thirdOut);
   const third=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect(),r=s.lastResult;return{
    duration:s.presentation.durationMs,physicalEnd:(r.frames.at(-1).tick-r.frames[0].tick)/1000,official:(r.play.rules.endedAtTick-r.frames[0].tick)/1000};});
   assert.equal(third.duration,1540+Math.max(third.physicalEnd,third.official+3000));
   await page.evaluate(()=>{const api=window.liveMatchPlayback,s=api.inspect();api.seekFrame(s.lastResult.frames.findIndex(frame=>frame.phase==='bench'));api.play();});
   await page.waitForFunction(()=>{const s=window.liveMatchPlayback.inspect(),r=s.lastResult;return s.presentation.elapsedMs>=1540+(r.play.rules.endedAtTick-r.frames[0].tick)/1000+1050;});
   await page.locator('#field').click({position:{x:30,y:30}});
   await page.waitForFunction(index=>window.liveMatchPlayback.inspect().selectedPitch===index+1,scenes.thirdOut,{timeout:1500});
   await page.evaluate(()=>window.liveMatchPlayback.stop());final.thirdOutTapSkip=true;
   await page.evaluate(index=>{const api=window.liveMatchPlayback;api.seekPitch(index);const s=api.inspect();api.seekFrame(s.lastResult.frames.findIndex(f=>f.fairKnown&&f.ballKind==='batted'));},scenes.fair);
   for(const camera of ['batter','catcher','mound','runner']){await page.locator('[data-camera="'+camera+'"]').click();assert.equal((await read()).rendered.zoneCorners.length,0);}
   final.thirdOutTiming=third;final.foulPresent=scenes.foul>=0;
   // Same seed and commands should reproduce identical actual Core frames
   // despite camera, chart, pauses and pacing. Compare first three plays
   // against the retained v33 HTML in a separate page.
   const old=await browser.newPage();await old.goto(pathToFileURL(resolve('../../outputs/ばせぼーるlv33_TBD_vs_LAD_Core試合版.html')).href);
   const sourceEqual=await old.evaluate(async values=>{
    const api=window.liveMatchPlayback;document.getElementById('managed-team').value='0';document.getElementById('batting-choice').value='take';
    const hashes=[];
    for(let i=0;i<3;i++){
     document.getElementById('location-choice').value=i===0?'auto':i%2?'low':'zone';
     document.getElementById('next-pitch').click();api.stop();const r=api.inspect().lastResult;
     const bytes=new TextEncoder().encode(JSON.stringify({frames:r.frames,play:r.play,events:r.events,match:r.match}));
     hashes.push([...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join(''));
    }return hashes;
   });
   const currentHashes=await page.evaluate(async()=>Promise.all(window.liveMatchPlayback.inspect().host.history.slice(0,3).map(async r=>{
    const bytes=new TextEncoder().encode(JSON.stringify({frames:r.frames,play:r.play,events:r.events,match:r.match}));
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
   })));
   assert.deepEqual(currentHashes,sourceEqual);final.threePitchCoreHashes=currentHashes;await old.close();
   // All legacy controls must select an available physical model without
   // changing the retained UI option names or failing Core validation.
   await page.evaluate(()=>window.liveMatchPlayback.newGame());
   await page.locator('#managed-team').selectOption('1');
   const aliases={fork:'splitter',change:'changeup','two-seam':'sinker'};
   for(const [value,expected]of Object.entries(aliases)){
    await page.locator('#pitch-choice').selectOption(value);await page.locator('#next-pitch').click();
    const actual=await page.evaluate(()=>window.liveMatchPlayback.inspect().lastResult.pitchType);assert.equal(actual,expected);
   }
   final.retainedPitchControls=aliases;
  }
  assert.equal((await read()).error,null);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  report.views.push({width,samples,historySelectDoesNotSeek:true,historyToggle:true,continuousNext:true,final,pageErrors:errors,networkRequests:requests});await page.close();
 }
 report.status='PASS';await writeFile(resolve(evidence,'ui-check.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',views:report.views.map(v=>({width:v.width,pitches:v.final?.pitches??5,fullNine:!!v.final}))}));
}catch(error){report.status='FAIL';report.error=error.stack;await writeFile(resolve(evidence,'ui-check.json'),JSON.stringify(report,null,2)+'\n');throw error;}
finally{await browser.close();}
