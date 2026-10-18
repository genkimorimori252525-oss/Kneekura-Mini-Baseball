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
const baseline=resolve('docs/demos/releases/v43/game.html');
const report={artifact,sha256:sha(await readFile(artifact)),baseline,baselineSha256:sha(await readFile(baseline)),views:[]};
const pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,path);
const native=await readFile('dist/native-match-core-browser.js','utf8');assert.equal(sha(native),pins.entrySha256);
for(const path of [artifact,baseline])assert((await readFile(path,'utf8')).includes(native));
report.nativeBundleSha256=pins.entrySha256;report.unchangedCoreInputs=Object.keys(pins.inputs).length;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const generate=p=>p.evaluate(()=>{for(let i=0;i<12;i++)document.getElementById('next-pitch').click();window.liveMatchPlayback.stop();});
const hashes=p=>p.evaluate(async()=>{const out=[];for(const r of window.liveMatchPlayback.inspect().host.history){
 const b=new TextEncoder().encode(JSON.stringify({frames:r.frames,play:r.play,events:r.events,match:r.match}));
 out.push([...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join(''));}return out;});
const seek=(p,pitch,ms)=>p.evaluate(({pitch,ms})=>{window.liveMatchPlayback.seekPitch(pitch);window.liveMatchPlayback.seekPresentationMs(ms);},{pitch,ms});
const cameraState=p=>p.evaluate(()=>{const r=window.liveMatchPlayback.inspect().rendered;return{camera:r.camera,eye:r.cameraEye,yaw:r.cameraYaw,pitch:r.cameraPitch};});
try{
 const old=await browser.newPage();await old.goto(pathToFileURL(baseline).href);await generate(old);await old.locator('details.settings > summary').click();
 const originalHashes=await hashes(old);assert.equal(originalHashes.length,12);
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:860}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:)/.test(r.url()))requests.push(r.url());});
  await page.goto(pathToFileURL(artifact).href);await page.evaluate(()=>document.fonts.ready);
  await page.locator('details.settings > summary').click();
  await generate(page);assert.deepEqual(await hashes(page),originalHashes);
  await page.locator('[data-camera="batter"]').click();await page.locator('#auto-overhead').uncheck();
  const row=await page.evaluate(()=>{
   const api=window.liveMatchPlayback,s=api.inspect(),pitch=s.host.history.findIndex(r=>!r.play.diagnostics.swingOffered&&r.frames.some(f=>f.possessedBy));
   if(pitch<0)throw Error('actual taken pitch with secure catch required');
   const r=s.host.history[pitch],frames=r.frames.map((f,index)=>({f,index})).filter(({f})=>f.ballKind==='pitch'&&f.ball&&!f.possessedBy),
    held=r.frames.findIndex(f=>f.possessedBy),samples=[];
   for(const {f,index}of [...frames,{f:r.frames[held],index:held}]){
    api.seekPitch(pitch,index);const q=api.inspect();samples.push({frame:index,tick:f.tick,localTick:28+(f.tick-r.frames[0].tick)/55000,
     ballZ:f.ball?.position.z,held:!!f.possessedBy,camera:q.rendered.camera,yaw:q.rendered.cameraYaw,pitch:q.rendered.cameraPitch,
     gaze:q.presentation.takenPitchGaze??null,ballDraw:q.rendered.ballDotDisplay});
   }return{pitch,catchLocal:28+r.play.diagnostics.catcherContactElapsedSeconds/.055,samples};
  });
  report.views.push({width,...row});
  const first=row.samples[0],moved=row.samples.some(s=>Math.abs(s.yaw-first.yaw)>1e-4||Math.abs(s.pitch-first.pitch)>1e-4);
  assert(moved,'taken pitch must change batter gaze before/at the actual catch');
  const held=row.samples.at(-1);
  assert(Math.abs(held.yaw-first.yaw)>1e-4||Math.abs(held.pitch-first.pitch)>1e-4,
   'secure catch must not reset the taken-pitch gaze to the ready angle');
  const cases=await page.evaluate(()=>{
   const a=window.liveMatchPlayback,h=a.inspect().host.history,takes=[],swings={};
   for(const [pitch,r]of h.entries()){
    const d=r.play.diagnostics,release=r.frames[0].tick,tps=d.sourceClockTicksPerSecond,
     ms=tick=>1540+(tick-release)/tps*1000;
    if(!d.swingOffered){const ready=r.frames[0],held=r.frames.find(f=>f.possessedBy);
     if(held)takes.push({pitch,side:d.battingSide,heldMs:ms(held.tick),before:{yaw:Math.atan2((d.battingSide==='R'?1:-1)*.4,19.4),pitch:.08}});
    }else if(r.play.contactMoment?.ball)swings[d.battingSide]??={pitch,mid:ms((r.play.contactMoment.ball.tick+d.referenceThroughTick)/2),end:ms(d.referenceThroughTick)};
   }return{takes,swings};
  });
  const checks=[];
  for(const c of cases.takes){
   await seek(page,c.pitch,c.heldMs+250);
   const s=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect(),g=s.presentation.takenPitchGaze,c=document.getElementById('ball-overlay');
    return{gaze:g,camera:s.rendered.camera,yaw:s.rendered.cameraYaw,pitch:s.rendered.cameraPitch,eye:s.rendered.cameraEye,
     ball:s.rendered.ballDotDisplay,painted:c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)};});
   assert(s.gaze&&s.gaze.progress===1);assert.equal(s.camera,'batter');assert.equal(s.ball,null);assert.equal(s.painted,false);
   assert(Math.abs(s.yaw-c.before.yaw)<=.400001);assert(Math.abs(s.pitch-.08)<=.180001);
   assert(Math.abs(s.yaw-c.before.yaw)>.01||Math.abs(s.pitch-.08)>.01,'finished glance is perceptible');
   const target=s.gaze.target,desiredYaw=Math.atan2(target.x-s.eye.x,target.z-s.eye.z),
    desiredPitch=-Math.atan2(target.y-s.eye.y,Math.max(.05,Math.hypot(target.x-s.eye.x,target.z-s.eye.z))),
    delta=Math.atan2(Math.sin(desiredYaw-c.before.yaw),Math.cos(desiredYaw-c.before.yaw));
   assert(Math.abs(s.yaw-c.before.yaw-Math.max(-.4,Math.min(.4,delta)))<1e-10);
   assert(Math.abs(s.pitch-.08-Math.max(-.18,Math.min(.18,desiredPitch-.08)))<1e-10);
   checks.push({pitch:c.pitch,side:c.side,heldMs:c.heldMs,gaze:s.gaze,yaw:s.yaw,pitchAngle:s.pitch});
   await seek(page,c.pitch,1540);assert.equal(await page.evaluate(()=>window.liveMatchPlayback.inspect().presentation.takenPitchGaze),null,'rewind to release clears');
   await seek(page,c.pitch,0);assert.equal(await page.evaluate(()=>window.liveMatchPlayback.inspect().presentation.takenPitchGaze),null,'preparation clears');
  }
  assert(cases.swings.L&&cases.swings.R);
  for(const c of Object.values(cases.swings))for(const ms of [c.mid,c.end]){
   await seek(page,c.pitch,ms);await seek(old,c.pitch,ms);await old.locator('[data-camera="batter"]').click();await old.locator('#auto-overhead').uncheck();
   assert.deepEqual(await cameraState(page),await cameraState(old),'v43 swing lock and tracking remain');
   assert.equal(await page.evaluate(()=>window.liveMatchPlayback.inspect().presentation.takenPitchGaze),null,'no taken gaze on swing');
  }
  const c=cases.takes[0];
  for(const name of ['catcher','mound','runner','overhead']){
   await seek(page,c.pitch,c.heldMs+100);await seek(old,c.pitch,c.heldMs+100);
   await page.locator('[data-camera="'+name+'"]').click();await old.locator('[data-camera="'+name+'"]').click();
   await page.locator('#auto-overhead').uncheck();await old.locator('#auto-overhead').uncheck();
   assert.deepEqual(await cameraState(page),await cameraState(old),name+' unaffected');
  }
  await page.locator('[data-camera="batter"]').click();await seek(page,c.pitch,c.heldMs+250);
  await page.locator('#field').screenshot({path:resolve(evidence,'taken-after-catch-'+width+'.png')});
  // Real animation clock, not only seeking: keep the glance through catch.
  await seek(page,c.pitch,c.heldMs-100);await page.locator('#play').click();
  await page.waitForFunction(()=>{const s=window.liveMatchPlayback.inspect();return s.presentation.takenPitchGaze?.progress===1&&!!s.currentFrame.possessedBy;},{},{timeout:4000});
  await page.evaluate(()=>window.liveMatchPlayback.stop());
  assert.deepEqual(await hashes(page),originalHashes,'camera never changes the 12 actual plays');
  report.views.at(-1).checks=checks;report.views.at(-1).coreHashes=originalHashes;
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);await page.close();
 }
 report.pass=true;console.log('PASS: taken-pitch batter gaze moves on actual pitch clock at 1200/390');
}catch(error){report.pass=false;report.error=String(error.stack??error);throw error;}
finally{await writeFile(resolve(evidence,'taken-gaze-check.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
