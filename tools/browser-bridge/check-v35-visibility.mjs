import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [artifactArg,evidenceArg]=process.argv.slice(2);
const registeredField=process.argv.includes('--registered-field');
if(!artifactArg||!evidenceArg)throw new Error('requires artifact and NEW evidence directory');
const artifact=resolve(artifactArg),evidence=resolve(evidenceArg);await mkdir(evidence,{recursive:false});
const sha=b=>createHash('sha256').update(b).digest('hex');
const report={artifact,sha256:sha(await readFile(artifact)),views:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const inputs=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
 assert.equal(sha(await readFile('dist/native-match-core-browser.js')),inputs.entrySha256);
 for(const [path,expected]of Object.entries(inputs.inputs))assert.equal(sha(await readFile(path)),expected,path);
 assert.equal(sha(await readFile('../../outputs/ばせぼーるlv34_TBD_vs_LAD_UI復元版.html')),'1d599cfe1d62278517167c2a7782dd6f4e0d55f946890ba3eaddb187e4978d1c');
 report.sourceInputsUnchanged=Object.keys(inputs.inputs).length;report.nativeBundleSha256=inputs.entrySha256;
 let baselineHashes=null;
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:860}}),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(String(error)));page.on('request',r=>{if(!/^(file:|data:)/.test(r.url()))requests.push(r.url());});
  await page.goto(pathToFileURL(artifact).href);await page.evaluate(()=>document.fonts.ready);
  await page.locator('details.settings > summary').click();await page.locator('#auto-overhead').uncheck();
  await page.locator('[data-camera="overhead"]').click();
  assert.equal(await page.locator('#actor-labels [data-actor="BAT"]').count(),0,'standing batter name must be hidden');
  assert.equal(await page.evaluate(()=>window.liveMatchPlayback.inspect().rendered.ballDotDisplay),null);
  for(let i=0;i<8;i++)await page.locator('#next-pitch').click();
  const originalHashes=await page.evaluate(()=>JSON.stringify(window.liveMatchPlayback.inspect().host.history));
  const cases=await page.evaluate(()=>{
   const h=window.liveMatchPlayback.inspect().host.history,free=[],sides={},holds=[],runnerStarts=[],restingRunners=[];
   for(const [pitch,r]of h.entries()){
    if(!sides[r.play.diagnostics.battingSide]){
     const fieldStart=r.frames.find(f=>f.ballKind==='batted')?.tick??Infinity;
     // At contact there can be both incoming pitch and outgoing field
     // observations at one tick. Inspect the preceding actual pitch sample.
     const frame=r.frames.map((f,index)=>({f,index})).filter(({f})=>f.phase==='pitch'&&f.bat&&f.tick<fieldStart).at(-1)?.index;
     if(frame!==undefined)sides[r.play.diagnostics.battingSide]={pitch,frame};
    }
    const firstRun=r.frames.findIndex(f=>f.actors.some(a=>a.playerId===r.batterPlayerId&&a.role==='runner'&&Math.hypot(a.velocity.x,a.velocity.y,a.velocity.z)>0));
    if(firstRun>=0){
     const lastStopped=r.frames.findIndex((f,index)=>index>firstRun&&f.actors.some(a=>a.playerId===r.batterPlayerId&&a.role==='runner'&&Math.hypot(a.velocity.x,a.velocity.y,a.velocity.z)===0));
     runnerStarts.push({pitch,frame:firstRun,before:Math.max(0,firstRun-1),lastStopped});
    }
    const runner=r.frames[0].actors.find(a=>a.role==='runner');if(runner)restingRunners.push({pitch,playerId:runner.playerId});
    for(const [frame,f]of r.frames.entries()){
     if(f.possessedBy&&holds.length<6)holds.push({pitch,frame});
     if(f.ball&&f.ball.visible!==false&&!f.possessedBy&&f.ballKind==='batted')
      free.push({pitch,frame,distance:Math.hypot(f.ball.position.x,f.ball.position.y,f.ball.position.z)});
    }
   }return {sides,holds,runnerStarts,restingRunners,free:free.sort((a,b)=>b.distance-a.distance).slice(0,60)};
  });
  assert(cases.runnerStarts.length>0);assert(cases.free.length>0);assert(cases.holds.length>0);assert(cases.sides.L&&cases.sides.R);
  const seek=async scene=>page.evaluate(({pitch,frame})=>window.liveMatchPlayback.seekPitch(pitch,frame),scene);
  const runner=cases.runnerStarts[0];await seek({pitch:runner.pitch,frame:runner.before});
  assert.equal(await page.locator('#actor-labels [data-actor="BAT"]').count(),0,'name hidden before actual running');
  await seek(runner);
  assert.equal(await page.locator('#actor-labels [data-actor="BAT"][data-role="runner"]').count(),1);
  assert.equal(await page.locator('#actor-labels [data-actor="BAT"]').evaluate(el=>getComputedStyle(el).color),'rgb(255, 119, 119)');
  if(runner.lastStopped>=0){await seek({pitch:runner.pitch,frame:runner.lastStopped});assert.equal(await page.locator('#actor-labels [data-actor="BAT"]').count(),1);}
  for(const scene of cases.restingRunners.slice(0,1)){
   await seek({pitch:scene.pitch,frame:0});
   assert.equal(await page.locator('#actor-labels [data-actor="RUN:'+scene.playerId+'"]').count(),1,'existing runner stays named');
  }
  const cameras=['overhead','mound','batter','catcher','runner'];
  for(const camera of cameras){
   await seek(cases.holds[0]);await page.locator('[data-camera="'+camera+'"]').click();
   const hidden=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{
    sourceHeld:!!s.currentFrame.possessedBy,dot:s.rendered.ballDotDisplay,
    painted:document.getElementById('ball-overlay').getContext('2d').getImageData(0,0,1200,864).data.some((v,i)=>i%4===3&&v!==0)};});
   assert(hidden.sourceHeld);assert.equal(hidden.dot,null);assert.equal(hidden.painted,false);
  }
  await page.locator('[data-camera="overhead"]').click();let distant=null;
  for(const scene of cases.free){await seek(scene);const dot=await page.evaluate(()=>window.liveMatchPlayback.inspect().rendered.ballDotDisplay);
   if(dot?.visibilityMarker){distant={scene,dot};break;}}
  assert(distant,'tiny overhead marker required on an actual distant free ball');
  assert.equal(distant.dot.displayDiameterPx,1.25);assert(distant.dot.projectedDiameterPx<1.25);assert(distant.dot.opticalDiameterPx<1.25);
  assert.equal(distant.dot.cells.length,1);assert(distant.dot.cells[0].color);
  const pixels=await page.evaluate(()=>{
   const c=document.getElementById('ball-overlay'),v=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   let visible=0,maxAlpha=0;for(let i=0;i<v.length;i+=4)if(v[i+3]>0){visible++;maxAlpha=Math.max(maxAlpha,v[i+3]);if(v[i]<220||v[i+1]<220||v[i+2]<220)throw new Error('not a white marker');}
   return{visible,maxAlpha};
  });assert(pixels.visible>0&&pixels.visible<=16);assert(pixels.maxAlpha>=200);
  await page.screenshot({path:resolve(evidence,'overhead-free-'+width+'.png'),fullPage:true});
  const handChecks=[];
  for(const side of ['L','R']){
   await seek(cases.sides[side]);await page.locator('[data-camera="batter"]').click();
   const observation=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect(),f=s.currentFrame,r=s.lastResult,a=f.actors.find(a=>a.playerId===r.batterPlayerId);return{
    side:r.play.diagnostics.battingSide,batter:a.position,camera:s.rendered.cameraEye,zone:s.rendered.zoneCorners,
    bat:f.bat,frameJson:JSON.stringify(f)};});
   assert.equal(observation.side,side);assert.equal(Math.sign(observation.camera.x),Math.sign(observation.batter.x));
   assert.equal(observation.camera.z,-.95);assert.equal(observation.zone.length,4);
   assert(observation.zone.some(p=>p.x>=0&&p.x<=600&&p.y>=0&&p.y<=432));
   await page.screenshot({path:resolve(evidence,'batter-'+side+'-'+width+'.png'),fullPage:true});
   await page.locator('[data-camera="mound"]').click();
   const rig=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{rig:s.rendered.batterRig,frameJson:JSON.stringify(s.currentFrame)};});
   assert.equal(rig.frameJson,observation.frameJson);assert.equal(rig.rig.hand,side);assert.equal(rig.rig.sourceId,side==='L'?'bat-left':'bat-right');
   assert.equal(rig.rig.includesIllustratedBat,false);assert.equal(await page.locator('#actor-labels [data-actor="BAT"]').count(),0);
   handChecks.push({side,batterX:observation.batter.x,eyeX:observation.camera.x,rig:rig.rig});
  }
  const optical=await page.evaluate(()=>{
   const rows=[];for(const camera of ['batter','catcher','mound','runner','fielder']){
    const diameter=window.matchPreview.probeOpticalDiameter(.000001,camera,'batted');if(diameter!==.000001*.68)throw new Error('first-person optical floor');rows.push({camera,diameter});
   }return rows;
  });
  const hashes=await page.evaluate(async()=>Promise.all(window.liveMatchPlayback.inspect().host.history.map(async r=>{
   const b=new TextEncoder().encode(JSON.stringify({frames:r.frames,play:r.play,events:r.events,match:r.match}));
   return [...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');
  })));
  if(registeredField)assert.equal(await page.evaluate(()=>JSON.stringify(window.liveMatchPlayback.inspect().host.history)),originalHashes);
  else if(!baselineHashes){
   const old=await browser.newPage();await old.goto(pathToFileURL(resolve('../../outputs/ばせぼーるlv34_TBD_vs_LAD_UI復元版.html')).href);
   baselineHashes=await old.evaluate(async()=>{
    for(let i=0;i<8;i++)document.getElementById('next-pitch').click();
    return Promise.all(window.liveMatchPlayback.inspect().host.history.map(async r=>{
     const b=new TextEncoder().encode(JSON.stringify({frames:r.frames,play:r.play,events:r.events,match:r.match}));
     return [...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');
    }));
   });await old.close();
  }
  if(!registeredField)assert.deepEqual(hashes,baselineHashes);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  let handoffs=[];
  if(registeredField){
   handoffs=await page.evaluate(()=>{
    const api=window.liveMatchPlayback,h=api.inspect().host.history,scenes=[];
    for(const [pitch,r]of h.entries())for(const release of r.play.field?.facts.filter(e=>e.kind==='throw_release')??[]){
     let before=null,after=null;
     for(const [frame,f]of r.frames.entries()){
      if(f.tick<release.tick)continue;
      const o=window.KneekuraLiveFieldCamera.observe({record:r,frame:f,bases:window.KneekuraNativeMatchCore.LIVE_MATCH_BASES_V1,defaultObserverPlayerId:f.fieldObserverPlayerId});
      if(o.handoff?.releaseTick!==release.tick)continue;
      if(!o.handoff.switched)before={frame,observation:o};else if(before){after={frame,observation:o};break;}
     }
     if(before&&after)scenes.push({pitch,release,before,after});if(scenes.length>=2)return scenes;
    }return scenes;
   });
   assert(handoffs.length>=2,'two actual throw handoffs required');
   for(const [index,scene]of handoffs.entries())for(const stage of ['before','after']){
    await seek({pitch:scene.pitch,frame:scene[stage].frame});await page.locator('[data-camera="mound"]').click();
    const view=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect(),f=s.currentFrame,c=s.fieldCamera,e=s.rendered.cameraEye,
     a=f.actors.find(a=>a.playerId===c.observerPlayerId),b=f.ball.position;return{observation:c,eye:e,actor:a.position,
      yaw:s.rendered.cameraYaw,pitch:s.rendered.cameraPitch,expectedYaw:Math.atan2(b.x-e.x,b.z-e.z),
      expectedPitch:-Math.atan2(b.y-e.y,Math.hypot(b.x-e.x,b.z-e.z)),ball:b,possessed:f.possessedBy};});
    assert.equal(view.observation.observerPlayerId,stage==='before'?scene.release.playerId:scene.release.receiverPlayerId);
    assert.equal(view.eye.x,view.actor.x);assert.equal(view.eye.z,view.actor.z);assert.equal(view.possessed,null);
    assert.deepEqual(view.observation.target,view.ball);assert(Math.abs(Math.atan2(Math.sin(view.yaw-view.expectedYaw),Math.cos(view.yaw-view.expectedYaw)))<1e-9);
    assert(Math.abs(view.pitch-view.expectedPitch)<1e-9);assert.equal(view.observation.handoff.switched,stage==='after');
    assert(view.observation.handoff.threshold>.48&&view.observation.handoff.threshold<.52);
    if(index===0)await page.screenshot({path:resolve(evidence,'throw-'+stage+'-'+width+'.png'),fullPage:true});
   }
  }
  assert.equal(await page.evaluate(()=>window.liveMatchPlayback.inspect().error),null);
  report.views.push({width,pitches:8,registeredField,handoffs,runner,existingRunnerNames:cases.restingRunners.length>0,heldHiddenIn:cameras,distant,optical,handChecks,
   coreHashes:hashes,pageErrors:errors,networkRequests:requests});await page.close();
 }
 report.status='PASS';await writeFile(resolve(evidence,'visibility-check.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',viewports:report.views.map(v=>v.width),unchangedCorePitches:8}));
}catch(error){report.status='FAIL';report.error=error.stack;await writeFile(resolve(evidence,'visibility-check.json'),JSON.stringify(report,null,2)+'\n');throw error;}
finally{await browser.close();}
