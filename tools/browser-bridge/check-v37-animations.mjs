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
const artifact=resolve(artifactArg),evidence=resolve(evidenceArg),baseline=resolve('../../outputs/ばせぼーるlv36_TBD_vs_LAD_結果表示タイミング修正版.html');
await mkdir(evidence,{recursive:false});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={artifact,sha256:sha(await readFile(artifact)),baseline,views:[]};
let browser;
const hashes=page=>page.evaluate(async()=>Promise.all(window.liveMatchPlayback.inspect().host.history.slice(0,8).map(async r=>{
 const bytes=new TextEncoder().encode(JSON.stringify({frames:r.frames,play:r.play,events:r.events,match:r.match}));
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
})));
const generate=page=>page.evaluate(()=>{for(let i=0;i<8;i++){
 document.getElementById('next-pitch').click();const s=window.liveMatchPlayback.inspect();if(s.error)throw new Error(s.error);
}window.liveMatchPlayback.stop();});
const seek=(page,scene)=>page.evaluate(({pitch,frame=0,ms})=>{
 window.liveMatchPlayback.seekPitch(pitch,frame);if(ms!==undefined)window.liveMatchPlayback.seekPresentationMs(ms);
},scene);
const camera=(page,name)=>page.locator('[data-camera="'+name+'"]').click();
const alpha=page=>page.evaluate(()=>{const c=document.getElementById('bat-overlay');
 return c.getContext('2d').getImageData(0,0,c.width,c.height).data.filter((v,i)=>i%4===3&&v>0).length;});

try{
 // Do these checks before requiring the new presentation helper, including in
 // the intentional v36 regression run. Never bless stale Source inputs.
 const pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
 assert.equal(Object.keys(pins.inputs).length,97,'97 frozen Source inputs required');
 for(const [path,expected]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),expected,path);
 assert.equal(sha(await readFile('dist/native-match-core-browser.js')),pins.entrySha256);
 const html=await readFile(artifact,'utf8');assert(html.includes(await readFile('dist/native-match-core-browser.js','utf8')),'embedded native bundle changed');
 report.unchangedCoreInputs=97;report.nativeBundleSha256=pins.entrySha256;
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 let baselineHashes=null;
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:860}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:)/.test(r.url()))requests.push(r.url());});
  await page.goto(pathToFileURL(artifact).href);await page.evaluate(()=>document.fonts.ready);
  const api=await page.evaluate(()=>({helper:typeof window.KneekuraLiveActorAnimation?.observe,seek:typeof window.liveMatchPlayback?.seekPresentationMs}));
  assert.equal(api.helper,'function','missing v37 KneekuraLiveActorAnimation.observe (expected v36 regression)');
  assert.equal(api.seek,'function','missing read-only seekPresentationMs');
  await page.locator('details.settings > summary').click();await page.locator('#auto-overhead').uncheck();await camera(page,'overhead');
  const ready=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{
   observed:s.presentation.actorAnimation,expected:window.KneekuraLiveActorAnimation.observe({record:null,frame:s.currentFrame,sceneMs:0,preparationMs:1540})};});
  assert.deepEqual(ready.observed,ready.expected);assert.equal(ready.observed.pitchFrame,0);assert.equal(ready.observed.batFrame,0);
  await generate(page);const coreHashes=await hashes(page);
  if(!baselineHashes){const old=await browser.newPage();await old.goto(pathToFileURL(baseline).href);await generate(old);baselineHashes=await hashes(old);await old.close();}
  assert.equal(coreHashes.length,8);assert.deepEqual(coreHashes,baselineHashes,'identical actual pitches in v36 and v37');
  const original=await page.evaluate(()=>JSON.stringify(window.liveMatchPlayback.inspect().host.history));
  const cases=await page.evaluate(()=>{
   const h=window.liveMatchPlayback.inspect().host.history,clips=JSON.parse(document.getElementById('v33-measured-bats').textContent).clips;
   const sides={},bats={},holds=[],free=[];let runner=null;
   for(const [pitch,r]of h.entries())for(const [frame,f]of r.frames.entries()){
    const ms=1540+(f.tick-r.frames[0].tick)/1000,side=r.play.diagnostics.battingSide;
    const a=window.KneekuraLiveActorAnimation.observe({record:r,frame:f,sceneMs:ms,preparationMs:1540,
     measuredClip:clips.find(c=>c.id===r.play.diagnostics.measuredClipId)});
    if(f.phase==='pitch'&&f.bat&&f.tick<(r.frames.find(sample=>sample.ballKind==='batted')?.tick??Infinity)){
     if(!sides[side]||sides[side].pitch===pitch)sides[side]={pitch,frame};
     if(a.actors[r.batterPlayerId]?.action==='bat')bats[a.batFrame]??={pitch,frame};
    }
    if(f.possessedBy)holds.push({pitch,frame});
    if(!runner&&f.actors.some(v=>v.playerId===r.batterPlayerId&&v.role==='runner'&&Math.hypot(v.velocity.x,v.velocity.y,v.velocity.z)>0))runner={pitch,frame};
    if(f.ball&&f.ball.visible!==false&&!f.possessedBy&&f.ballKind==='batted')free.push({pitch,frame,distance:Math.hypot(f.ball.position.x,f.ball.position.y,f.ball.position.z)});
   }
   return {sides,bats,holds:holds.slice(0,1),runner,free:free.sort((a,b)=>b.distance-a.distance).slice(0,60)};
  });
  assert(cases.sides.L&&cases.sides.R&&cases.holds.length&&cases.free.length&&cases.runner,'actual eight-pitch coverage');
  // Source clocks choose physical samples; only the existing display clock
  // supplies preparation/follow poses between/after those samples.
  const checkAnimation=()=>page.evaluate(()=>{
   const s=window.liveMatchPlayback.inspect(),r=s.lastResult,clips=JSON.parse(document.getElementById('v33-measured-bats').textContent).clips,
    expected=window.KneekuraLiveActorAnimation.observe({record:r,frame:s.currentFrame,sceneMs:s.presentation.elapsedMs,
     preparationMs:1540,measuredClip:clips.find(c=>c.id===r?.play.diagnostics.measuredClipId)});
   return {observed:s.presentation.actorAnimation,expected,rendered:s.rendered,pitcherId:r?.pitcherPlayerId,frame:s.currentFrame};
  });
  const batObservations=[];
  // Include the finite follow hold after a swinging pitch whose physical clock
  // can stop at a foul/contact boundary. This still uses that exact Core frame.
  for(const key of [0,1,2,3]){
   let scene=cases.bats[key];
   if(!scene)scene=await page.evaluate(wanted=>{
    const h=window.liveMatchPlayback.inspect().host.history,clips=JSON.parse(document.getElementById('v33-measured-bats').textContent).clips;
    for(const [pitch,r]of h.entries())if(r.play.diagnostics.swingOffered){
     const f=r.frames.findLast(f=>f.phase==='pitch')??r.frames.at(-1),frame=r.frames.indexOf(f);
     for(let after=0;after<=1400;after+=10){const ms=1540+(f.tick-r.frames[0].tick)/1000+after,
      a=window.KneekuraLiveActorAnimation.observe({record:r,frame:f,sceneMs:ms,preparationMs:1540,measuredClip:clips.find(c=>c.id===r.play.diagnostics.measuredClipId)});
      if(a.batFrame===wanted&&a.actors[r.batterPlayerId]?.action==='bat')return{pitch,frame,ms};}
    }return null;
   },key);
   assert(scene,'actual swing pose '+key+' required');
   for(const appearance of ['retro','point']){
    await seek(page,scene);await page.locator('[data-appearance="'+appearance+'"]').click();await camera(page,'mound');
    const s=await checkAnimation();assert.deepEqual(s.observed,s.expected);assert.equal(s.observed.batFrame,key);
    assert.equal(s.rendered.batDisplayMode,'approved-four-frame');assert.equal(s.rendered.batterRig.sourceFrame,key);
    assert.equal(s.rendered.batterRig.includesIllustratedBat,true);assert.equal(await alpha(page),0,'mound physical overlay must be empty');
    batObservations.push({frame:key,appearance,scene,rig:s.rendered.batterRig});
   }
  }
  const handChecks=[],physicalOverlays=[];
  for(const side of ['L','R']){
   await seek(page,cases.sides[side]);await camera(page,'mound');const s=await checkAnimation();
   assert.equal(s.rendered.batterRig.hand,side);assert.equal(s.rendered.batterRig.sourceId,side==='L'?'bat-left':'bat-right');
   handChecks.push({side,rig:s.rendered.batterRig});
   if(width===1200)await page.screenshot({path:resolve(evidence,'mound-'+side+'.png'),fullPage:true});
   for(const name of ['batter','catcher']){
    await camera(page,name);const view=await page.evaluate(()=>window.liveMatchPlayback.inspect().rendered),painted=await alpha(page);
    if(view.batScreen?.length===2&&view.batScreen.some(p=>p.x>=4&&p.x<=596&&p.y>=4&&p.y<=428)){
     assert(painted>0,'projected actual bat must retain physical overlay in '+name);physicalOverlays.push({side,camera:name,painted});
    }
   }
  }
  assert(physicalOverlays.length>0,'at least one actual first-person projected bat');
  await page.locator('[data-appearance="retro"]').click();
  // A commanded take is generated only after the eight-pitch equality check.
  // This guarantees the six pitcher poses are observed without an early hit.
  await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();window.liveMatchPlayback.seekPitch(s.generatedPitches-1,0);
   document.getElementById('managed-team').value=s.host.match.half==='top'?'0':'1';
   document.getElementById('batting-choice').value='take';document.getElementById('next-pitch').click();window.liveMatchPlayback.stop();});
  const take=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{pitch:s.selectedPitch,count:s.generatedPitches,swing:s.lastResult.play.diagnostics.swingOffered};});
  assert.equal(take.count,9,'take must issue a new ninth actual pitch');assert.equal(take.pitch,8);
  assert.equal(take.swing,false,'explicit take must reach actual Core no-swing diagnostics');
  const pitcherFrames=new Map();
  for(const ms of [0,450,950,1500,1655,2150,2500]){
   await seek(page,{pitch:take.pitch,ms});await camera(page,'overhead');const s=await checkAnimation();assert.deepEqual(s.observed,s.expected);
   assert.equal(s.observed.batFrame,0);const p=s.rendered.actors.find(a=>a.id==='P');
   assert(p,'actual pitcher renderer label');assert.equal(p.animationAction,'pitch');assert.equal(p.animationFrame,s.observed.pitchFrame);
   pitcherFrames.set(s.observed.pitchFrame,{ms,frame:p.animationFrame});
  }
  assert.deepEqual([...pitcherFrames.keys()].sort(),[0,1,2,3,4,5]);
  for(const name of ['overhead','mound','batter','catcher','runner']){
   await seek(page,cases.holds[0]);await camera(page,name);
   const held=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect(),c=document.getElementById('ball-overlay');return{
    held:!!s.currentFrame.possessedBy,dot:s.rendered.ballDotDisplay,painted:c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)};});
   assert(held.held);assert.equal(held.dot,null);assert.equal(held.painted,false);
  }
  await camera(page,'overhead');let marker=null;
  for(const scene of cases.free){await seek(page,scene);const dot=await page.evaluate(()=>window.liveMatchPlayback.inspect().rendered.ballDotDisplay);
   if(dot?.visibilityMarker){marker={scene,dot};break;}}
  assert(marker);assert.equal(marker.dot.displayDiameterPx,1.25);assert(marker.dot.projectedDiameterPx<1.25);assert.equal(marker.dot.cells.length,1);
  const whiteMarker=await page.evaluate(()=>{const c=document.getElementById('ball-overlay'),v=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   let count=0,maxAlpha=0;for(let i=0;i<v.length;i+=4)if(v[i+3]){count++;maxAlpha=Math.max(maxAlpha,v[i+3]);if(v[i]<220||v[i+1]<220||v[i+2]<220)throw new Error('tiny marker is not white');}
   return{count,maxAlpha};});assert(whiteMarker.count>0&&whiteMarker.count<=16);assert(whiteMarker.maxAlpha>=200);
  const optical=await page.evaluate(()=>['batter','catcher','mound','runner','fielder'].map(camera=>({camera,value:window.matchPreview.probeOpticalDiameter(.000001,camera,'batted')})));
  for(const row of optical)assert.equal(row.value,.000001*.68);
  // Presentation-only boundary probes clone actual Source positions. They are
  // never submitted to Host, and do not claim to be physical match events.
  await seek(page,cases.runner);await camera(page,'runner');
  const near=await page.evaluate(()=>{
   const s=window.liveMatchPlayback.inspect(),r=s.lastResult,f=s.currentFrame,data=JSON.parse(document.getElementById('match-data').textContent),
    animation=s.presentation.actorAnimation,roles=['P','C','1B','2B','3B','SS','LF','CF','RF'];
   const actors=f.actors.map(a=>({id:a.playerId===r.batterPlayerId?'BAT':roles.includes(a.role)?a.role:'RUN:'+a.playerId,
    sourcePlayerId:a.playerId,role:a.role,player:{...data.players[a.playerId],hand:a.playerId===r.batterPlayerId?r.play.diagnostics.battingSide:data.players[a.playerId].hand},
    position:{...a.position},running:Math.hypot(a.velocity.x,a.velocity.y,a.velocity.z)>0,walking:false,
    presentationAction:animation.actors[a.playerId].action,presentationFrame:animation.actors[a.playerId].frame}));
   const world={liveObservation:true,livePark:s.host.fenceGeometry,liveBattedObservation:true,liveFieldObserverPlayerId:s.fieldCamera?.observerPlayerId,
    liveFieldCameraTarget:s.fieldCamera?.target,tick:f.tick,localTick:28+(f.tick-r.frames[0].tick)/55000,
    batter:{...data.players[r.batterPlayerId],hand:r.play.diagnostics.battingSide},pitcher:{...data.players[r.pitcherPlayerId]},actors,
    ball:f.ball&&!f.possessedBy?{...f.ball,sourceObservation:true,ballKind:f.ballKind}:null,bat:f.bat?{...f.bat,sourceObservation:true}:null,
    liveRunnerDirection:f.actors.find(a=>a.playerId===r.batterPlayerId)?.velocity,liveBatterRunStarted:true,
    p:{contactLocal:null,catchLocal:null,swing:false,outcome:null,actors:[],presentationEvidence:null},batFrame:animation.batFrame,pitchFrame:animation.pitchFrame,
    fair:false,fairKnown:f.fairKnown,custody:f.possessedBy,ballKind:f.ballKind,benchReturn:false,officialKnown:false,phase:f.phase,history:[]};
   const options={camera:'runner',appearance:'retro',labels:true,zone:false,history:false,homeClose:false,zoom:1,autoOverhead:false},
    initial=window.matchPreview.liveDrawWorld(world,options),eye=initial.cameraEye,yaw=initial.cameraYaw,
    target=actors.find(a=>a.role==='2B'),height=target.player.height;
   const observations=[];
   for(const appearance of ['retro','point'])for(const test of ['near','far','vertical','runner','otherCamera']){
    const clone=structuredClone(world),actor=clone.actors.find(a=>a.id===target.id),distance=(test==='far'?.91:.89)*height;
    actor.position={x:eye.x+Math.sin(yaw)*distance,y:test==='vertical'?eye.y+height:eye.y-height/2,z:eye.z+Math.cos(yaw)*distance};
    if(test==='runner')actor.role='runner';const view=window.matchPreview.liveDrawWorld(clone,{...options,appearance,camera:test==='otherCamera'?'overhead':'runner'});
    observations.push({appearance,test,id:actor.id,hidden:view.nearRunnerHiddenActors,anchor:view.actors.some(a=>a.id===actor.id),
     cells:view.actorCells.filter(c=>c.owner===actor.id).length});
   }return{declaredPresentationClone:true,actualSourceTick:f.tick,height,observations};
  });
  for(const row of near.observations){assert.equal(row.hidden.includes(row.id),row.test==='near',JSON.stringify(row));
   if(row.test==='near'){assert(row.anchor,'near defender name retained');assert.equal(row.cells,0,'hidden defender must not write depth cells');}}
  await seek(page,cases.runner);await camera(page,'runner');
  assert.equal(await page.evaluate(()=>JSON.stringify(window.liveMatchPlayback.inspect().host.history.slice(0,8))),original,'presentation cannot mutate original Source records');
  assert.deepEqual(await hashes(page),coreHashes);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  report.views.push({width,actualCorePitches:8,coreHashes,pitcherFrames:[...pitcherFrames.values()],batObservations,handChecks,physicalOverlays,take,marker,whiteMarker,optical,near,pageErrors:errors,networkRequests:requests});
  await page.screenshot({path:resolve(evidence,'runner-'+width+'.png'),fullPage:true});await page.close();
 }
 report.status='PASS';await writeFile(resolve(evidence,'animation-check.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',viewports:report.views.map(v=>v.width),unchangedCorePitches:8,sourcePins:97}));
}catch(error){report.status='FAIL';report.error=error.stack;await writeFile(resolve(evidence,'animation-check.json'),JSON.stringify(report,null,2)+'\n');throw error;}
finally{if(browser)await browser.close();}
