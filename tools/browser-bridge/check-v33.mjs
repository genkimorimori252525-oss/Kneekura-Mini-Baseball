import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.V33_PLAYWRIGHT_CORE??'C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [artifactArg,evidenceArg]=process.argv.slice(2);
const prefixOnly=process.argv.includes('--prefix-only');
if(!artifactArg||!evidenceArg)throw new Error('requires final live HTML and NEW evidence directory');
const artifact=resolve(artifactArg),evidence=resolve(evidenceArg);await mkdir(evidence,{recursive:false});
const browser=await chromium.launch({executablePath:process.env.V33_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={artifact,artifactSha256:createHash('sha256').update(await readFile(artifact)).digest('hex'),prefixOnly,viewports:[],
 boundary:'Shared Core offline Host in ordinary primary canvas; Native SQLite authentication and real-phone verification are separate'};
try{
 for(const viewport of [{width:1200,height:860},{width:390,height:844}]){
  const page=await browser.newPage({viewport}),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(String(error)));page.on('request',request=>{if(!request.url().startsWith('file:')&&!request.url().startsWith('data:'))requests.push(request.url());});
  try{
   await page.goto(pathToFileURL(artifact).href);await page.evaluate(()=>document.fonts.ready);
   const initial=await page.evaluate(()=>{const api=window.liveMatchPlayback,s=api.inspect();return{version:s.version,authority:s.authority,
    generated:s.generatedPitches,frame:s.currentFrame,match:s.host.match,legacy:window.matchPreview.recording.pitches.length};});
   assert.equal(initial.version,33);assert.equal(initial.generated,0);assert.equal(initial.frame.phase,'ready');
   assert.equal(initial.match.inning,1);assert.equal(initial.match.half,'top');
   const geometry=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{source:s.host.fenceGeometry,rendered:s.rendered.fieldGeometry};});
   assert.deepEqual(geometry.rendered.fenceCenter,geometry.source.center);
   assert.equal(geometry.rendered.fenceRadiusMeters,geometry.source.radiusMeters);
   assert.equal(geometry.rendered.wallHeight,geometry.source.heightMeters);
   assert.equal(await page.locator('#native-proof-panel').isVisible(),false);
   const optical=await page.evaluate(()=>{
    const check=[];
    for(const view of ['batter','catcher','runner','mound','fielder'])for(const diameter of [.001,.000001]){
     const displayed=window.matchPreview.probeOpticalDiameter(diameter,view,'batted');
     if(displayed!==diameter*.68)throw new Error('Batted ball diameter floor: '+view);check.push({view,diameter,displayed});
    }
    if(window.matchPreview.probeOpticalDiameter(.000001,'overhead','batted')!==.000001)throw new Error('Overhead diameter changed');
    for(const view of ['runner','mound','fielder'])if(window.matchPreview.probeOpticalDiameter(.000001,view,'pitch')!==.000001)
     throw new Error('Pitch diameter floor: '+view);
    return check;
   });
   await page.locator('#managed-team').selectOption('0');await page.locator('#batting-choice').selectOption('take');
   assert.equal(await page.evaluate(()=>window.liveMatchPlayback.inspect().generatedPitches),0);
   await page.locator('#next-pitch').click();await page.evaluate(()=>window.liveMatchPlayback.stop());
   const first=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{frames:s.lastResult.frames.length,
    original:JSON.stringify(s.lastResult),count:s.generatedPitches,field:s.lastResult.play.field!==null};});
   assert(first.frames>1);assert.equal(first.count,1);
   assert.equal(await page.locator('#pitch-list button').first().locator(':scope > span').count(),3);
   await page.locator('details.settings > summary').click();
   await page.locator('#auto-overhead').uncheck();
   await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();window.liveMatchPlayback.seekFrame(Math.floor(s.lastResult.frames.length/2));});
   const observed=await page.evaluate(()=>window.liveMatchPlayback.inspect().currentFrame),cameras=[];
   for(const camera of ['overhead','mound','batter','catcher','runner']){
    await page.locator('[data-camera="'+camera+'"]').click();
    const state=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{frame:s.currentFrame,rendered:s.rendered};});
    assert.deepEqual(state.frame,observed);
    const eyeActor=state.frame.actors.find(actor=>camera==='mound'?actor.role==='P':camera==='catcher'?actor.role==='C':actor.playerId===state.frame.batterPlayerId);
    if(camera!=='overhead'){
     assert.equal(state.rendered.cameraEye.x,eyeActor.position.x);
     assert.equal(state.rendered.cameraEye.z,eyeActor.position.z+(camera==='catcher'?.5:0));
    }
    if(state.rendered.ballDotDisplay)assert.equal(state.rendered.ballDotDisplay.style,'4px-dot-grid');
    cameras.push({camera,sourceFrameUnchanged:true,ballStyle:state.rendered.ballDotDisplay?.style??'outside_view'});
    if(camera==='overhead'||camera==='mound')await page.screenshot({path:resolve(evidence,camera+'-'+viewport.width+'.png'),fullPage:true});
   }
   await page.locator('#batting-choice').selectOption('power');
   assert.equal(await page.evaluate(()=>JSON.stringify(window.liveMatchPlayback.inspect().lastResult)),first.original);
   await page.locator('#next-pitch').click();await page.evaluate(()=>window.liveMatchPlayback.stop());
   assert.equal(await page.evaluate(()=>window.liveMatchPlayback.inspect().generatedPitches),2);
   assert.equal(await page.evaluate(()=>window.matchPreview.recording.pitches.length),initial.legacy);
   let final=null;
   if(viewport.width===1200&&!prefixOnly){
    await page.locator('#batting-choice').selectOption('balanced');await page.locator('#managed-team').selectOption('1');
    await page.locator('#finish-game').click();
    await page.waitForFunction(()=>{const s=window.liveMatchPlayback.inspect();return s.error||(s.host.finished&&!s.fast);},null,{timeout:240000});
    final=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{match:s.host.match,pitchCount:s.host.pitchCount,
     generated:s.generatedPitches,finished:s.host.finished,observedMatch:s.observedMatch,legacy:window.matchPreview.recording.pitches.length,
     line:s.host.line,classifications:s.host.history.reduce((counts,pitch)=>{counts[pitch.play.classification]=(counts[pitch.play.classification]??0)+1;return counts;},{}),
     physicalContacts:s.host.history.filter(pitch=>pitch.play.contact!==null).length,
     actualFieldPlays:s.host.history.filter(pitch=>pitch.play.field!==null).length,
     legacyFallback:s.legacyResultFallback,nativeSqliteAdmission:s.nativeSqliteAdmission,error:s.error};});
    assert.equal(final.error,null,final.error??undefined);assert(final.finished);assert(final.match.inning>=9);assert.equal(final.generated,final.pitchCount);
    assert.equal(final.legacy,initial.legacy);assert.equal(final.legacyFallback,false);assert.equal(final.nativeSqliteAdmission,false);
    assert.deepEqual(final.observedMatch,final.match);assert(final.actualFieldPlays>0);assert(final.physicalContacts>0);
    await page.screenshot({path:resolve(evidence,'finished-9innings-'+viewport.width+'.png'),fullPage:true});
    const fieldScene=await page.evaluate(()=>{
     const api=window.liveMatchPlayback,s=api.inspect();
     for(const [index,pitch]of s.host.history.entries()){
      const at=pitch.frames.findIndex(frame=>frame.ballKind==='batted'&&frame.actors.some(actor=>actor.role==='runner'));
      if(at>=0)return{pitch:index,frame:at};
     }return null;
    });
    assert(fieldScene,'Actual batted-runner scene required');
    await page.evaluate(scene=>window.liveMatchPlayback.seekPitch(scene.pitch,scene.frame),fieldScene);
    await page.locator('[data-camera="overhead"]').click();
    const labelCheck=await page.evaluate(()=>{
     const s=window.liveMatchPlayback.inspect(),labels=s.rendered.actors.filter(actor=>actor.labelBox);
     const elements=[...document.querySelectorAll('#actor-labels span')],firstRunner=elements.findIndex(element=>element.dataset.role==='runner');
     return{anchorsUnchanged:labels.every(actor=>Math.abs(actor.labelBox.x+actor.labelBox.w/2-actor.nameAnchor.x)<1e-8),
      runnersAbove:firstRunner>=0&&elements.slice(firstRunner).every(element=>element.dataset.role==='runner'&&element.style.zIndex==='3')};
    });
    assert(labelCheck.anchorsUnchanged);assert(labelCheck.runnersAbove);
    await page.locator('[data-camera="mound"]').click();
    assert.equal(await page.evaluate(()=>window.liveMatchPlayback.inspect().rendered.zoneCorners.length),0);
    await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();window.liveMatchPlayback.seekPitch(s.host.history.length-1,s.host.history.at(-1).frames.length-1);});
    final.fieldPresentation={...labelCheck,battedMoundZoneHidden:true};
   }
   assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
   report.viewports.push({width:viewport.width,readyBeforeFirstCommand:true,optical,sourceFenceGeometry:geometry.source,firstFrames:first.frames,nextPitchCount:2,
    managerDoesNotRewriteRecordedPitch:true,cameras,final,pageErrors:0,networkRequests:0});
  }catch(error){
   const coreDiagnostic=await page.evaluate(()=>{
    try{const s=window.liveMatchPlayback.inspect();return{error:s.error,errorDetails:s.errorDetails,currentFrame:s.currentFrame,
     lastResult:s.lastResult,match:s.host.match,generatedPitches:s.generatedPitches,
     last10Events:s.host.history.flatMap(pitch=>pitch.events).slice(-10)};}catch(readError){return{readError:String(readError)};}
   }).catch(readError=>({readError:String(readError)}));
   const diagnostic={error:String(error),pageErrors:errors,requests,
    core:coreDiagnostic,visibleResult:await page.locator('#result-text').textContent(),visibleHint:await page.locator('#manager-hint').textContent()};
   await writeFile(resolve(evidence,'failure-'+viewport.width+'.json'),JSON.stringify(diagnostic,null,2)+'\n');
   await page.screenshot({path:resolve(evidence,'failure-'+viewport.width+'.png'),fullPage:true});throw error;
  }finally{await page.close();}
 }
 await writeFile(resolve(evidence,'browser-check.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({result:'PASS',artifactSha256:report.artifactSha256,
  viewports:report.viewports.map(v=>({width:v.width,cameras:v.cameras.length,nineInningsFinished:v.final?.finished??false,
    pitchCount:v.final?.pitchCount??2,actualFieldPlays:v.final?.actualFieldPlays??null})),evidence},null,2));
}finally{await browser.close();}
