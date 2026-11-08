import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [artifactArg,evidenceArg]=process.argv.slice(2);
if(!artifactArg||!evidenceArg)throw Error('requires HTML and NEW evidence directory');
const artifact=resolve(artifactArg),evidence=resolve(evidenceArg),baseline=resolve('docs/demos/releases/v44/game.html'),sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(evidence,{recursive:false});
const report={artifact,sha256:sha(await readFile(artifact)),baseline,baselineSha256:sha(await readFile(baseline)),views:[]};
const pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,path);
const native=await readFile('dist/native-match-core-browser.js','utf8');assert.equal(sha(native),pins.entrySha256);
for(const path of [artifact,baseline])assert((await readFile(path,'utf8')).includes(native));
report.nativeBundleSha256=pins.entrySha256;report.unchangedCoreInputs=Object.keys(pins.inputs).length;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const generate=p=>p.evaluate(()=>{for(let i=0;i<12;i++)document.getElementById('next-pitch').click();window.liveMatchPlayback.stop();const s=window.liveMatchPlayback.inspect();if(s.error)throw Error(s.error);});
const hashes=p=>p.evaluate(async()=>{const out=[];for(const r of window.liveMatchPlayback.inspect().host.history){
 const b=new TextEncoder().encode(JSON.stringify({frames:r.frames,play:r.play,events:r.events,match:r.match}));
 out.push([...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join(''));}return out;});
const setup=async(p,path)=>{await p.goto(pathToFileURL(path).href);await p.evaluate(()=>document.fonts.ready);await p.locator('details.settings > summary').click();};
const select=async(p,name)=>{await p.locator('[data-camera="'+name+'"]').click();await p.locator('#auto-overhead').uncheck();};
const seek=(p,pitch,ms)=>p.evaluate(({pitch,ms})=>{window.liveMatchPlayback.seekPitch(pitch);window.liveMatchPlayback.seekPresentationMs(ms);},{pitch,ms});
const read=p=>p.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return {camera:s.rendered.camera,eye:s.rendered.cameraEye,yaw:s.rendered.cameraYaw,pitch:s.rendered.cameraPitch,
 view:s.presentation.continuousBatterView,phase:s.currentFrame.phase,grid:s.rendered.gridAligned,actors:s.rendered.actors,
 held:!!s.currentFrame.possessedBy,ball:s.rendered.ballDotDisplay};});
const dyaw=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const angular=(a,b)=>Math.hypot(dyaw(a.yaw,b.yaw),a.pitch-b.pitch),distance=(a,b)=>Math.hypot(a.eye.x-b.eye.x,a.eye.y-b.eye.y,a.eye.z-b.eye.z);
try{
 const old=await browser.newPage();await setup(old,baseline);await generate(old);const originalHashes=await hashes(old);
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:860}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:)/.test(r.url()))requests.push(r.url());});
  await setup(page,artifact);await generate(page);assert.deepEqual(await hashes(page),originalHashes);
  const cases=await page.evaluate(()=>{
   const h=window.liveMatchPlayback.inspect().host.history,sides={},takes=[];
   for(const [pitch,r]of h.entries()){
    const d=r.play.diagnostics,first=r.frames[0].tick,tps=d.sourceClockTicksPerSecond,ms=tick=>1540+(tick-first)/tps*1000;
    if(d.swingOffered&&r.play.contactMoment?.ball){
     const run=r.frames.find(f=>f.actors.some(a=>a.playerId===r.batterPlayerId&&a.role==='runner'));
     sides[d.battingSide]??={pitch,side:d.battingSide,start:ms(d.referenceStartTick),contact:ms(r.play.contactMoment.ball.tick),
      end:ms(d.referenceThroughTick),run:run?ms(run.tick):null};
    }else if(!d.swingOffered){const held=r.frames.find(f=>f.possessedBy);if(held)takes.push({pitch,held:ms(held.tick)});}
   }return{sides,takes};
  });assert(cases.sides.L&&cases.sides.R&&cases.takes.length===6);
  await select(page,'batter');await page.locator('#auto-overhead').check();
  const view={width,cases,boundaries:[],curves:[],oldBoundaryJumps:[]};
  for(const c of Object.values(cases.sides)){
   for(const [kind,ms]of Object.entries({start:c.start,contact:c.contact,end:c.end,runner:c.run}).filter(([,v])=>v!==null)){
    await seek(page,c.pitch,ms-.001);const a=await read(page);await seek(page,c.pitch,ms+.001);const b=await read(page);
    assert.equal(a.camera,'batter');assert.equal(b.camera,'batter');
    assert(angular(a,b)<=2.5*.000002+1e-8,kind+' angular continuity');assert(distance(a,b)<=14*.000002+1e-8,kind+' eye continuity');
    for(const s of [a,b]){assert.equal(s.view.f,400);assert.equal(s.view.cx,300);assert.equal(s.view.cy,110);assert(s.grid);
     assert(!s.actors.some(actor=>actor.id==='BAT'),'first person hides own body after runner role');}
    view.boundaries.push({side:c.side,kind,ms,angleDelta:angular(a,b),eyeDelta:distance(a,b)});
    if(['start','end'].includes(kind)){
     await seek(old,c.pitch,ms-.001);await select(old,'batter');const oa=await read(old);
     await seek(old,c.pitch,ms+.001);const ob=await read(old);view.oldBoundaryJumps.push({side:c.side,kind,angleDelta:angular(oa,ob),eyeDelta:distance(oa,ob)});
    }
   }
   const samples=await page.evaluate(({c})=>{
    const api=window.liveMatchPlayback,out=[];api.seekPitch(c.pitch);
    for(let ms=1540;ms<=c.end+500;ms+=55){api.seekPresentationMs(ms);const s=api.inspect(),v=s.presentation.continuousBatterView;
     if(s.currentFrame.phase!=='bench')out.push({ms,yaw:v.yaw,pitch:v.pitch,eye:v.eye,phase:v.phase,aimWeight:v.aimWeight,surprise:v.surprise,model:v.model});}
    return out;
   },{c});
   for(let i=1;i<samples.length;i++){assert(angular(samples[i],samples[i-1])<=2.5*.055+1e-7);assert(distance(samples[i],samples[i-1])<=14*.055+1e-7);}
   assert(samples.some(s=>s.phase==='incoming'));assert(samples.some(s=>s.aimWeight>0));
   view.curves.push({side:c.side,samples});
   await seek(page,c.pitch,c.contact);await page.locator('#field').screenshot({path:resolve(evidence,'swing-'+c.side+'-'+width+'.png')});
   await seek(page,c.pitch,c.end+400);await page.locator('#field').screenshot({path:resolve(evidence,'after-swing-'+c.side+'-'+width+'.png')});
  }
  for(const c of cases.takes){
   await seek(page,c.pitch,c.held+200);const s=await read(page);assert(s.held);assert.equal(s.ball,null);assert.equal(s.camera,'batter');
   assert(s.view.model.sensorDelaySeconds>=.060&&s.view.model.sensorDelaySeconds<=.120);
  }
  const take=cases.takes[0];await seek(page,take.pitch,take.held+1600);const ready=await read(page);
  assert(Math.abs(ready.pitch-.08)<.02,'between pitches, return smoothly to ready rather than cut next pitch');
  const c=cases.sides.R;
  for(const name of ['catcher','mound','runner','overhead']){
   await seek(page,c.pitch,c.contact+100);await select(page,name);const a=await read(page);
   await seek(old,c.pitch,c.contact+100);await select(old,name);const b=await read(old);
   assert.deepEqual({camera:a.camera,eye:a.eye,yaw:a.yaw,pitch:a.pitch},{camera:b.camera,eye:b.eye,yaw:b.yaw,pitch:b.pitch},name+' unchanged');
  }
  await select(page,'batter');await seek(page,c.pitch,1900);const before=await read(page);
  await page.locator('#play').click();await page.waitForFunction(()=>window.liveMatchPlayback.inspect().presentation.elapsedMs>2450,{},{timeout:5000});await page.evaluate(()=>window.liveMatchPlayback.stop());
  await seek(page,c.pitch,1900);assert.deepEqual(await read(page),before,'playback and rewind reconstruct exactly');
  assert.deepEqual(await hashes(page),originalHashes);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  view.coreHashes=originalHashes;view.errors=errors;view.externalRequests=requests;report.views.push(view);await page.close();
 }
 report.pass=true;console.log(JSON.stringify({pass:true,widths:[1200,390],pitches:12,takes:6,boundaryCases:report.views.reduce((n,v)=>n+v.boundaries.length,0),coreInputs:report.unchangedCoreInputs}));
}catch(error){report.pass=false;report.error=String(error.stack??error);throw error;}
finally{await writeFile(resolve(evidence,'continuous-view-check.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
