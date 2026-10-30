import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const require=createRequire(import.meta.url),{chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [artifactArg,evidenceArg]=process.argv.slice(2);
if(!artifactArg||!evidenceArg)throw Error('requires HTML and NEW evidence directory');
const artifact=resolve(artifactArg),evidence=resolve(evidenceArg),baseline=resolve(evidenceArg,'v50-camera-current-core-reference.html');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
await mkdir(evidence,{recursive:false});
const oldArtifact=resolve('docs/demos/releases/v50/game.html'),oldBytes=await readFile(oldArtifact);
const report={artifact,sha256:sha(await readFile(artifact)),baseline,referenceOriginal:oldArtifact,referenceOriginalSha256:sha(oldBytes),referenceScope:'V50_RENDERER_AND_CAMERA_WITH_SAME_CURRENT_CORE_REPLACEMENT_ONLY',views:[]};
const pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,path);
const native=await readFile('dist/native-match-core-browser.js','utf8');
assert.equal(sha(Buffer.from(native)),pins.entrySha256);
const oldSource=oldBytes.toString('utf8'),nativeHeader='// Native physical and aerodynamic rigid pitch bridge compiled directly from src/core and src/presentation; no browser result simulator.',nativeStart=oldSource.indexOf(nativeHeader),nativeEnd=oldSource.indexOf('</script>',nativeStart);
assert(nativeStart>=0&&nativeEnd>nativeStart,'v50 embedded Core boundary');
assert.equal(oldSource.indexOf(nativeHeader,nativeStart+1),-1,'only one embedded Core');
const reference=oldSource.slice(0,nativeStart)+native+'\n'+oldSource.slice(nativeEnd);
await writeFile(baseline,reference);report.baselineSha256=sha(Buffer.from(reference));
report.referenceNativeBundleSha256=pins.entrySha256;
for(const path of [artifact,baseline])assert((await readFile(path,'utf8')).includes(native),'same current Core bundle: '+path);
report.nativeBundleSha256=pins.entrySha256;report.currentSourceInputs=Object.keys(pins.inputs).length;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const faults=[];
const instrument=(page,label)=>{
 const errors=[],requests=[];faults.push({label,errors,requests});
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('request',request=>{if(!/^(file:|data:)/.test(request.url()))requests.push(request.url());});
 return{errors,requests};
};
const setup=async(page,path)=>{
 await page.goto(pathToFileURL(path).href);await page.evaluate(()=>document.fonts.ready);
 await page.locator('details.settings > summary').click();
};
const generate=page=>page.evaluate(()=>{
 for(let index=0;index<12;index++)document.getElementById('next-pitch').click();
 window.liveMatchPlayback.stop();const state=window.liveMatchPlayback.inspect();
 if(state.error)throw Error(state.error);
 if(state.generatedPitches!==12)throw Error('exactly 12 issued pitches are required');
});
const hashes=page=>page.evaluate(async()=>{
 const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))]
  .map(byte=>byte.toString(16).padStart(2,'0')).join('');
 const records=[];
 for(const record of window.liveMatchPlayback.inspect().host.history){
  const bats=record.frames.filter(frame=>frame.bat).map(frame=>({tick:frame.tick,grip:frame.bat.grip,tip:frame.bat.tip,radiusProfile:frame.bat.radiusProfile}));
  records.push({core:await digest({frames:record.frames,play:record.play,events:record.events,match:record.match}),
   batEndpoints:await digest(bats),batFrames:bats.length});
 }
 return records;
});
const select=async(page,name)=>{await page.locator('[data-camera="'+name+'"]').click();await page.locator('#auto-overhead').uncheck();};
const seek=(page,pitch,ms)=>page.evaluate(({pitch,ms})=>{
 window.liveMatchPlayback.seekPitch(pitch);window.liveMatchPlayback.seekPresentationMs(ms);
},{pitch,ms});
const read=page=>page.evaluate(()=>{
 const state=window.liveMatchPlayback.inspect();return{camera:state.rendered.camera,eye:state.rendered.cameraEye,
  yaw:state.rendered.cameraYaw,pitch:state.rendered.cameraPitch,view:state.presentation.continuousBatterView,
  elapsedMs:state.presentation.elapsedMs,durationMs:state.presentation.durationMs,phase:state.currentFrame.phase,
  grid:state.rendered.gridAligned,actors:state.rendered.actors,held:!!state.currentFrame.possessedBy,
  ball:state.rendered.ballDotDisplay,bat:state.currentFrame.bat};
});
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const angular=(a,b)=>Math.hypot(angleDelta(a.yaw,b.yaw),a.pitch-b.pitch);
const pose=sample=>({camera:sample.camera,eye:sample.eye,yaw:sample.yaw,pitch:sample.pitch});
const optics=sample=>({f:sample.view.f,cx:sample.view.cx,cy:sample.view.cy,labelMetres:sample.view.labelMetres});
const plannedAngle=(target,eye)=>({yaw:Math.atan2(target.x-eye.x,target.z-eye.z),
 pitch:-Math.atan2(target.y-eye.y,Math.max(.05,Math.hypot(target.x-eye.x,target.z-eye.z)))});
const close=(actual,expected,label)=>assert(Math.abs(actual-expected)<=1e-8,label+': '+actual+' vs '+expected);
const checkVisibleWorld=sample=>{
 assert(sample.grid,'world raster remains aligned');
 if(sample.camera==='batter')assert(!sample.actors.some(actor=>actor.id==='BAT'),'first person hides own body after runner role');
 if(sample.held)assert.equal(sample.ball,null,'possessed ball remains hidden');
};
try{
 const old=await browser.newPage({viewport:{width:1200,height:860}});instrument(old,'v50-current-core-reference');
 await setup(old,baseline);await generate(old);const deterministicHashes=await hashes(old);
 assert(deterministicHashes.some(record=>record.batFrames>0),'actual Core bat observations are exercised');
 for(const width of [1200,390]){
  await old.setViewportSize({width,height:860});
  const page=await browser.newPage({viewport:{width,height:860}}),observedFaults=instrument(page,'v51-'+width);
  await setup(page,artifact);await generate(page);assert.deepEqual(await hashes(page),deterministicHashes,'12 exact Core records and bat endpoint timelines');
  const cases=await page.evaluate(()=>{
   const state=window.liveMatchPlayback.inspect(),history=state.host.history,preparationMs=state.presentation.timing.preparationMs,
    sides={},takes=[];
   for(const [pitch,record]of history.entries()){
    const diagnostic=record.play.diagnostics,first=record.frames[0].tick,tps=diagnostic.sourceClockTicksPerSecond,
     ms=tick=>preparationMs+(tick-first)/tps*1000;
    if(diagnostic.swingOffered&&record.play.contactMoment?.ball){
     const forecast=diagnostic.zoneJudgment.observedForecastPosition,error=diagnostic.aimErrorMeters;
     sides[diagnostic.battingSide]??={pitch,side:diagnostic.battingSide,start:ms(diagnostic.referenceStartTick),
      contact:ms(record.play.contactMoment.ball.tick),end:ms(diagnostic.referenceThroughTick),
      target:{x:forecast.x+error.x,y:forecast.y+error.y,z:forecast.z+error.z}};
    }else if(!diagnostic.swingOffered){
     const held=record.frames.find(frame=>frame.possessedBy),glance=record.frames.find(frame=>frame.ballKind==='pitch'
      &&frame.ball&&frame.ball.visible!==false&&!frame.possessedBy&&frame.ball.position.z<=1);
     if(held&&glance)takes.push({pitch,side:diagnostic.battingSide,held:ms(held.tick),glance:ms(glance.tick)});
    }
   }
   return{sides,takes,preparationMs};
  });
  assert(cases.sides.L&&cases.sides.R,'both measured batting sides are exercised');
  assert.equal(cases.takes.length,6,'all six actual taken pitches are exercised');
  await select(page,'batter');await page.locator('#auto-overhead').check();
  const view={width,cases,swings:[],takes:[],otherCameras:[],coreHashes:deterministicHashes};report.views.push(view);
  for(const swing of Object.values(cases.sides)){
   const followAt=swing.end+700,samples=[];
   for(const [label,ms]of [['contact',swing.contact],['through',swing.end-.001],['hold-start',swing.end+.001],
    ['hold-last',followAt-1],['follow-start',followAt],['follow-middle',followAt+247.5],['follow-complete',followAt+595]]){
    await seek(page,swing.pitch,ms);const sample=await read(page);
    close(sample.elapsedMs,ms,'requested clock is inside the actual presentation');
    assert.equal(sample.camera,'batter');checkVisibleWorld(sample);
    close(sample.view.swingEndAtMs,swing.end,'finite measured swing end');close(sample.view.followAtMs,followAt,'700ms look delay');
    if(ms<followAt){
     assert.equal(sample.view.phase,ms<swing.end?'swing-aim':'post-swing-hold');
     assert.deepEqual(sample.view.target,swing.target,'only planned sweet spot is used before field follow');
     close(angular(sample,plannedAngle(swing.target,sample.eye)),0,'planned aim angle');
     assert.deepEqual(optics(sample),{f:400,cx:300,cy:110,labelMetres:.55},'lv27 swing optics');
    }else{
     assert.equal(sample.view.phase,'field-follow');
     if(ms===followAt){close(sample.view.followProgress,0,'field follow begins at zero blend');
      close(angular(sample,plannedAngle(swing.target,sample.eye)),0,'700ms boundary retains planned orientation');}
     else if(ms<followAt+495)assert(sample.view.followProgress>0&&sample.view.followProgress<1,'finite 495ms field-follow acquisition');
     else close(sample.view.followProgress,1,'field-follow acquisition completes');
    }
    await seek(old,swing.pitch,ms);await select(old,'batter');const previous=await read(old);
    assert.deepEqual(sample.eye,previous.eye,'existing embodied eye motion is retained');
    assert.deepEqual(sample.bat,previous.bat,'same Source bat at every checked display time');
    if(ms>=followAt+495)assert.deepEqual(pose(sample),pose(previous),'same-current-Core reference field tracking resumes exactly');
    samples.push({label,ms,...pose(sample),phase:sample.view.phase,followProgress:sample.view.followProgress,target:sample.view.target});
   }
   await seek(page,swing.pitch,swing.end+699);await page.locator('#field').screenshot({path:resolve(evidence,'swing-hold-'+swing.side+'-'+width+'.png')});
   await seek(page,swing.pitch,followAt+595);await page.locator('#field').screenshot({path:resolve(evidence,'field-follow-'+swing.side+'-'+width+'.png')});
   view.swings.push({side:swing.side,followAtMs:followAt,samples});
  }
  for(const take of cases.takes){
   const completed=Math.max(take.held,take.glance+165),samples=[];
   for(const offset of [1,110,330,880]){
    const ms=completed+offset;await seek(page,take.pitch,ms);const sample=await read(page);
    close(sample.elapsedMs,ms,'take observation is inside the actual presentation');
    assert.equal(sample.camera,'batter');assert(sample.held);checkVisibleWorld(sample);
    assert.equal(sample.view.phase,'take-held');
    close(sample.view.f,376,'lv27 take focal length');close(sample.view.cx,300,'lv27 take cx');close(sample.view.cy,172,'lv27 take cy');
    close(sample.view.labelMetres,.55*.97,'lv27 take label scale');
    const baseYaw=Math.atan2(.4*(take.side==='L'?-1:1),19.4);
    assert(Math.abs(angleDelta(sample.yaw,baseYaw))<=.40+1e-10,'lv27 take yaw limit');
    assert(Math.abs(sample.pitch-.08)<=.18+1e-10,'lv27 take pitch limit');
    samples.push({ms,...pose(sample),optics:optics(sample),target:sample.view.target,phase:sample.view.phase});
   }
   for(const sample of samples.slice(1))assert.deepEqual({pose:pose(sample),optics:sample.optics,target:sample.target},
    {pose:pose(samples[0]),optics:samples[0].optics,target:samples[0].target},'no post-catch drift or return-ready motion');
   view.takes.push({pitch:take.pitch,completedAtMs:completed,samples});
  }
  const swing=cases.sides.R;
  for(const name of ['catcher','mound','runner','overhead']){
   for(const ms of [swing.contact+100,swing.end+700,swing.end+1295]){
    await seek(page,swing.pitch,ms);await select(page,name);const actual=await read(page);checkVisibleWorld(actual);
    await seek(old,swing.pitch,ms);await select(old,name);const previous=await read(old);
    assert.deepEqual(pose(actual),pose(previous),name+' camera remains unchanged');
    assert.deepEqual(actual.bat,previous.bat,name+' preserves exact Core bat');
    view.otherCameras.push({name,ms,...pose(actual)});
   }
  }
  await select(page,'batter');await seek(page,swing.pitch,1900);const before=await read(page);
  await page.locator('#play').click();
  await page.waitForFunction(()=>window.liveMatchPlayback.inspect().presentation.elapsedMs>2150,{},{timeout:5000});
  await page.evaluate(()=>window.liveMatchPlayback.stop());
  await seek(page,swing.pitch,1900);assert.deepEqual(await read(page),before,'actual playback and rewind reconstruct the same view');
  for(const ms of [swing.end+699,swing.end+700,swing.end+1000]){
   await seek(page,swing.pitch,ms);const forward=await read(page);
   await seek(page,swing.pitch,cases.preparationMs);await seek(page,swing.pitch,ms);
   assert.deepEqual(await read(page),forward,'repeated hold/follow boundary seek is deterministic');
  }
  assert.deepEqual(await hashes(page),deterministicHashes,'all view operations preserve exact Core and bat records');
  assert.deepEqual(observedFaults.errors,[]);assert.deepEqual(observedFaults.requests,[]);
  await seek(page,cases.takes[0].pitch,Math.max(cases.takes[0].held,cases.takes[0].glance+165)+330);
  await page.locator('#field').screenshot({path:resolve(evidence,'taken-held-'+width+'.png')});
  await page.close();
 }
 for(const fault of faults){assert.deepEqual(fault.errors,[],fault.label+' browser errors');assert.deepEqual(fault.requests,[],fault.label+' external requests');}
 report.pass=true;console.log(JSON.stringify({pass:true,widths:[1200,390],pitches:12,takes:6,
  swingSides:['L','R'],otherCameraSamples:report.views.reduce((sum,view)=>sum+view.otherCameras.length,0),currentSourceInputs:report.currentSourceInputs}));
}catch(error){report.pass=false;report.error=String(error.stack??error);throw error;}
finally{report.browserFaults=faults;await writeFile(resolve(evidence,'v51-batter-view-check.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
