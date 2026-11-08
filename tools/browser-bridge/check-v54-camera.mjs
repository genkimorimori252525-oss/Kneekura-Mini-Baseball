import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [artifactArg,evidenceArg]=process.argv.slice(2);
if(!artifactArg||!evidenceArg)throw Error('requires HTML and NEW evidence directory');
const artifact=resolve(artifactArg),evidence=resolve(evidenceArg),sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(evidence,{recursive:false});
const pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
const sourceInputCount=Object.keys(pins.inputs).length;assert(sourceInputCount>=110);
for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,path);
const native=await readFile('dist/native-match-core-browser.js','utf8');assert.equal(sha(Buffer.from(native)),pins.entrySha256);
const reference=resolve(evidence,'v49-current-core-reference.html'),oldPath=resolve('docs/demos/releases/v49/game.html'),old=await readFile(oldPath,'utf8'),
 header='// Native physical and aerodynamic rigid pitch bridge compiled directly from src/core and src/presentation; no browser result simulator.',start=old.indexOf(header),end=old.indexOf('</script>',start);
assert(start>=0&&end>start);assert.equal(old.indexOf(header,start+1),-1);
await writeFile(reference,old.slice(0,start)+native+'\n'+old.slice(end));
const v51=resolve(evidence,'v52-current-core-reference.html'),v52Path=resolve('docs/demos/releases/v52/game.html'),v52Old=await readFile(v52Path,'utf8'),v52Start=v52Old.indexOf(header),v52End=v52Old.indexOf('</script>',v52Start);
assert(v52Start>=0&&v52End>v52Start&&v52Old.indexOf(header,v52Start+1)===-1);
await writeFile(v51,v52Old.slice(0,v52Start)+native+'\n'+v52Old.slice(v52End));
for(const path of [artifact,reference,v51])assert((await readFile(path,'utf8')).includes(native),'same current v53 Core '+path);
const report={artifact,sha256:sha(await readFile(artifact)),nativeBundleSha256:pins.entrySha256,currentSourceInputs:sourceInputCount,
 reference:{original:oldPath,originalSha256:sha(Buffer.from(old)),path:reference,sha256:sha(await readFile(reference)),scope:'V49_RENDERER_AND_CAMERA_WITH_CURRENT_V54_CORE_ONLY'},views:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),faults=[];
const instrument=(page,label)=>{const errors=[],requests=[];faults.push({label,errors,requests});page.on('pageerror',e=>errors.push(String(e)));
 page.on('request',r=>{if(!/^(file:|data:|blob:)/.test(r.url()))requests.push(r.url());});};
const setup=async(page,path)=>{await page.goto(pathToFileURL(path).href);await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>{const select=document.getElementById('batting-choice');if(![...select.options].some(o=>o.value==='auto')){const option=document.createElement('option');option.value='auto';option.textContent='QA command alignment';select.append(option);}select.value='auto';});await page.locator('details.settings > summary').click();await page.locator('#fixed-seed').check();};
const generate=(page,count)=>page.evaluate(count=>{for(let i=0;i<count;i++)document.getElementById('next-pitch').click();window.liveMatchPlayback.stop();if(window.liveMatchPlayback.inspect().error)throw Error(window.liveMatchPlayback.inspect().error);},count);
const hashes=page=>page.evaluate(async()=>{const h=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(x=>x.toString(16).padStart(2,'0')).join(''),out=[];
 for(const r of window.liveMatchPlayback.inspect().host.history)out.push({core:await h({frames:r.frames,play:r.play,events:r.events,match:r.match}),
  bat:await h(r.frames.filter(f=>f.bat).map(f=>({tick:f.tick,grip:f.bat.grip,tip:f.bat.tip,radiusProfile:f.bat.radiusProfile})))});return out;});
const select=async(page,name)=>{await page.locator('[data-camera="'+name+'"]').click();await page.locator('#auto-overhead').uncheck();};
const seek=(page,pitch,ms)=>page.evaluate(({pitch,ms})=>{window.liveMatchPlayback.seekPitch(pitch);window.liveMatchPlayback.seekPresentationMs(ms);},{pitch,ms});
const read=page=>page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{camera:s.rendered.camera,eye:s.rendered.cameraEye,yaw:s.rendered.cameraYaw,pitch:s.rendered.cameraPitch,
 view:s.presentation.continuousBatterView,pitcher:s.presentation.pitcherReactionView,field:s.presentation.fieldCamera,elapsedMs:s.presentation.elapsedMs,durationMs:s.presentation.durationMs,
 frame:s.currentFrame,grid:s.rendered.gridAligned,actors:s.rendered.actors,ball:s.rendered.ballDotDisplay,bat:s.currentFrame.bat};});
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),pose=s=>({camera:s.camera,eye:s.eye,yaw:s.yaw,pitch:s.pitch}),
 optics=s=>({f:s.view.f,cx:s.view.cx,cy:s.view.cy,labelMetres:s.view.labelMetres}),close=(a,b,label)=>assert(Math.abs(a-b)<1e-8,label+': '+a+' vs '+b);
const visible=s=>{assert(s.grid,'4px raster alignment');if(s.frame.possessedBy)assert.equal(s.ball,null,'held ball hidden');};
const coverage=page=>page.evaluate(()=>{const s=window.liveMatchPlayback.inspect(),h=s.host.history,prep=s.presentation.timing.preparationMs,sides={},takes=[],field=[];
 for(const [pitch,r]of h.entries()){const d=r.play.diagnostics,tps=d.sourceClockTicksPerSecond,ms=t=>prep+(t-r.frames[0].tick)/tps*1000;
  if(d.swingOffered&&r.play.contactMoment?.ball)sides[d.battingSide]??={pitch,side:d.battingSide,contact:ms(r.play.contactMoment.ball.tick),through:ms(d.referenceThroughTick)};
  if(!d.swingOffered){const held=r.frames.find(f=>f.possessedBy);if(held)takes.push({pitch,held:ms(held.tick)});}
  const batted=r.frames.find(f=>f.ballKind==='batted');if(batted)field.push({pitch,contact:ms(batted.tick),speed:Math.hypot(batted.ball.velocity.x,batted.ball.velocity.y,batted.ball.velocity.z)});
 }const marks=h.findIndex((r,p)=>r.play.classification==='count'&&h.slice(0,p).some(previous=>previous.beforeMatch.playId===r.beforeMatch.playId));
 return{prep,sides,takes,field,marks,count:h.length};});
try{
 const oldPage=await browser.newPage({viewport:{width:1200,height:860}}),v51Page=await browser.newPage({viewport:{width:1200,height:860}});
 instrument(oldPage,'v49-current-core-reference');instrument(v51Page,'v51-Core-control');await setup(oldPage,reference);await setup(v51Page,v51);
 await generate(oldPage,12);await generate(v51Page,12);let expected=await hashes(oldPage);assert.deepEqual(await hashes(v51Page),expected);await v51Page.close();
 for(const width of [1200,390]){
  await oldPage.setViewportSize({width,height:860});const page=await browser.newPage({viewport:{width,height:860}});instrument(page,'v52-'+width);await setup(page,artifact);await generate(page,expected.length);
  let cases=await coverage(page);
  while((!cases.sides.L||!cases.sides.R||!cases.takes.length||!cases.field.length||cases.marks<0)&&cases.count<60){await generate(page,4);await generate(oldPage,4);expected=await hashes(oldPage);cases=await coverage(page);}
  assert(cases.sides.L&&cases.sides.R&&cases.takes.length&&cases.field.length&&cases.marks>=0,'bounded actual swing/take/hit/chart coverage');assert.deepEqual(await hashes(page),expected,'identical current Core and measured bat prefix');
  assert.equal(await page.evaluate(()=>typeof window.KneekuraV27BatterView),'undefined','v50 wrapper is removed');assert.equal(await page.locator('#v50-v27-batter-view').count(),0);
  const view={width,cases,coreHashes:expected,batter:[],pitchers:[],otherCameras:[]};report.views.push(view);await select(page,'batter');await select(oldPage,'batter');
  for(const swing of Object.values(cases.sides))for(const ms of [0,swing.contact,swing.through-1,swing.through+80,swing.through+280]){
   await seek(page,swing.pitch,ms);await seek(oldPage,swing.pitch,ms);const s=await read(page),baseline=await read(oldPage);visible(s);
   assert.deepEqual(s.eye,baseline.eye,'v49 embodied eye');assert.deepEqual(optics(s),optics(baseline),'v49 optics');assert.deepEqual(s.bat,baseline.bat,'actual bat placement is unchanged');
   assert(!['post-swing-hold','take-glance','take-held'].includes(s.view.phase),'no lv27 or 700ms phase');assert.equal(s.view.model.afterSwingHoldMs,undefined);
   if(s.view.regulation?.mode==='swing-brace'){assert.equal(s.view.regulation.pitchPursuit,null);assert.equal(s.view.regulation.targetYaw,baseline.view.regulation.targetYaw);assert.equal(s.view.regulation.targetPitch,baseline.view.regulation.targetPitch);}
   if(ms===0)assert.deepEqual(pose(s),pose(baseline),'v49 ready stance');
   view.batter.push({side:swing.side,ms,phase:s.view.phase,eye:s.eye,mode:s.view.regulation?.mode});
  }
  const pursuit=await page.evaluate(({pitch,prep})=>{
   const state=window.liveMatchPlayback.inspect(),record=state.host.history[pitch],player=state.physicalRoster.players.find(p=>p.playerId===record.batterPlayerId),d=record.play.diagnostics,
    original=JSON.stringify(state.host.history),batter={...player,height:player.heightMeters,hand:d.battingSide},origin=record.frames[0].tick,tps=d.sourceClockTicksPerSecond,outputs=[];
   for(const [label,physical]of [['high',{...player.physical,aimStdMeters:.001,timingStdSeconds:.001,zoneJudgmentStdMeters:.001}],['low',{...player.physical,aimStdMeters:.15,timingStdSeconds:.06,zoneJudgmentStdMeters:.4}]]){
    const samples=[];for(let t=.008;t<.55;t+=.008){const frame=record.frames.findLast(f=>f.tick<=origin+t*tps);if(!frame)continue;
     const value=window.KneekuraContinuousBatterView.observe({record,frame,sceneMs:prep+t*1000,preparationMs:prep,batter:{...batter,physical},previousRecord:pitch?state.host.history[pitch-1]:null});
     samples.push({t,yaw:value.yaw,pitch:value.pitch,pursuit:value.regulation?.pitchPursuit??null,model:value.model});}outputs.push({label,samples});
   }return{outputs,historyUnchanged:JSON.stringify(state.host.history)===original};
  },{pitch:cases.takes[0].pitch,prep:cases.prep});
  view.pursuit=pursuit;assert(pursuit.historyUnchanged);const models=[];
  for(const result of pursuit.outputs){const active=result.samples.filter(s=>s.pursuit&&s.pursuit.rawErrorRadians>1e-8);assert(active.length>=4,'actual pitch policy coverage '+result.label);const model=active[0].model;models.push(model);
   assert(model.pitchTrackingGain>=.55&&model.pitchTrackingGain<=.92);assert(model.pitchTrackingGain<1);assert(model.pitchTrackingDeadbandRadians>=.006&&model.pitchTrackingDeadbandRadians<=.026);
   assert(active.some(s=>s.pursuit.rawErrorRadians>s.pursuit.deadbandRadians),'broad real pitch motion remains pursued '+result.label);
   for(const s of active){if(s.pursuit.rawErrorRadians<=s.pursuit.deadbandRadians)assert.equal(s.pursuit.relaxedErrorRadians,0,'small-motion slack');
    else assert(s.pursuit.relaxedErrorRadians>0&&s.pursuit.relaxedErrorRadians<s.pursuit.rawErrorRadians,'positive compressed broad-motion response');assert(s.pursuit.relaxedErrorRadians<=s.pursuit.rawErrorRadians*s.pursuit.gain);}
   const velocities=[];for(let i=1;i<result.samples.length;i++){const a=result.samples[i-1],b=result.samples[i],dt=b.t-a.t,v={y:delta(b.yaw,a.yaw)/dt,p:(b.pitch-a.pitch)/dt};assert(Math.hypot(v.y,v.p)<=2.5+1e-7);velocities.push(v);
    if(velocities.length>1){const prev=velocities.at(-2);assert(Math.hypot(v.y-prev.y,v.p-prev.p)/dt<=20+1e-5,'bounded angular acceleration');}}
  }
  assert(models[0].contactQuality>models[1].contactQuality);assert(models[0].visionQuality>models[1].visionQuality);assert(models[0].pitchTrackingGain>models[1].pitchTrackingGain);assert(models[0].pitchTrackingDeadbandRadians<models[1].pitchTrackingDeadbandRadians);
  assert.equal(await page.locator('footer>span').textContent(),'4px / 中継55ms / オフラインCore');
  await select(page,'catcher');const markFrames=await page.evaluate(pitch=>{const r=window.liveMatchPlayback.inspect().host.history[pitch];return{
   flight:r.frames.findIndex(f=>f.phase==='pitch'&&f.ball&&!f.possessedBy),held:r.frames.findIndex(f=>f.possessedBy)};},cases.marks);view.pitchMarks=[];
  for(const [stage,ms,index,opacity]of [['ready',0,null,1],['release',1500,null,.06],['flight',null,markFrames.flight,.06],['held',null,markFrames.held,1]]){
   if(ms!==null)await seek(page,cases.marks,ms);else await page.evaluate(({pitch,index})=>window.liveMatchPlayback.seekPitch(pitch,index),{pitch:cases.marks,index});
   const s=await page.evaluate(()=>{const state=window.liveMatchPlayback.inspect();return{opacity:state.presentation.pitchMarksOpacity,corners:state.rendered.zoneCorners,
    marks:[...state.presentation.chart.chartMarks,...state.rendered.historyMarks]};});
   assert.equal(s.opacity,opacity);assert.equal(s.corners.length,4);assert(s.marks.length>0);assert(s.marks.every(m=>m.alpha>0&&m.alpha<=opacity));view.pitchMarks.push({stage,opacity});
  }
  for(const name of ['catcher','runner','overhead'])for(const ms of [cases.sides.R.contact+100,cases.sides.R.through+700]){
   await select(page,name);await select(oldPage,name);await seek(page,cases.sides.R.pitch,ms);await seek(oldPage,cases.sides.R.pitch,ms);const a=await read(page),b=await read(oldPage);visible(a);assert.deepEqual(pose(a),pose(b),name+' unchanged');assert.deepEqual(a.bat,b.bat);view.otherCameras.push({name,ms,...pose(a)});
  }
  await select(page,'mound');
  for(const candidate of cases.field){
   await seek(page,candidate.pitch,candidate.contact+1);let s=await read(page),p=s.pitcher;if(!p||p.phase==='unavailable')continue;
   assert(p.delaySeconds>=.5&&p.delaySeconds<=1.2);close(p.trackingAtMs-p.contactAtMs,p.delaySeconds*1000,'reaction delay');close(p.handoffAtMs-p.trackingAtMs,180,'finite tracking blend');
   const samples=[];for(const [label,ms]of [['hold',p.trackingAtMs-1],['blend',p.trackingAtMs+90],['tracked',p.handoffAtMs+1]]){
    await seek(page,candidate.pitch,ms);s=await read(page);p=s.pitcher;visible(s);assert(p);close(s.elapsedMs,ms,'presentation continues through reaction');
    if(label==='hold'){assert.equal(p.phase,'reaction-hold');assert.equal(p.trackingAllowed,false);assert.equal(p.handoffAllowed,false);assert.equal(s.camera,'mound');assert.deepEqual(s.eye,p.view.eye);close(s.yaw,p.view.yaw,'hold yaw');close(s.pitch,p.view.pitch,'hold pitch');}
    if(label==='blend'){assert.equal(p.phase,'tracking-blend');assert(p.trackingProgress>0&&p.trackingProgress<1);assert.equal(p.handoffAllowed,false);assert.equal(s.camera,'mound');}
    if(label==='tracked'){assert.equal(p.trackingAllowed,true);assert.equal(p.handoffAllowed,true);}
    samples.push({label,ms,camera:s.camera,reaction:p});
   }
   const handoffMs=Math.max(p.handoffAtMs,candidate.contact+Math.min(2,Math.max(.35,70/Math.max(1,candidate.speed)))*1000)+1;
   await seek(page,candidate.pitch,handoffMs);const handed=await read(page);
   if(handed.camera!=='fielder')continue;
   assert(handed.pitcher.handoffAllowed);samples.push({label:'actual-fielder-handoff',ms:handoffMs,camera:handed.camera,reaction:handed.pitcher});
   view.pitchers.push({pitch:candidate.pitch,samples});break;
  }
  assert(view.pitchers.length,'actual pitcher reaction hold/blend exercised');
  const nextPitch=view.pitchers[0].pitch+1;assert(nextPitch<cases.count);await seek(page,nextPitch,0);assert.equal((await read(page)).camera,'mound','next pitch restores mound');
  const heldCase=cases.takes[0];for(const name of ['overhead','mound','batter','catcher','runner']){await select(page,name);await seek(page,heldCase.pitch,heldCase.held+1);visible(await read(page));}
  await select(page,'batter');await seek(page,cases.sides.R.pitch,1900);const before=await read(page);await page.locator('#play').click();await page.waitForFunction(()=>window.liveMatchPlayback.inspect().presentation.elapsedMs>2150,{},{timeout:5000});await page.evaluate(()=>window.liveMatchPlayback.stop());await seek(page,cases.sides.R.pitch,1900);assert.deepEqual(await read(page),before,'actual playback and rewind');
  await page.locator('#field').screenshot({path:resolve(evidence,'batter-'+width+'.png')});await select(page,'mound');await seek(page,view.pitchers[0].pitch,view.pitchers[0].samples[0].ms);await page.locator('#field').screenshot({path:resolve(evidence,'pitcher-hold-'+width+'.png')});
  assert.deepEqual(await hashes(page),expected,'camera and observer ability probes cannot mutate physical history');await page.close();
 }
 for(const fault of faults){assert.deepEqual(fault.errors,[]);assert.deepEqual(fault.requests,[]);}report.pass=true;
 console.log(JSON.stringify({pass:true,pitches:expected.length,widths:report.views.map(v=>v.width),coreInputs:sourceInputCount}));
}catch(error){report.pass=false;report.error=String(error.stack??error);throw error;}
finally{report.browserFaults=faults;await writeFile(resolve(evidence,'v54-camera-check.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
