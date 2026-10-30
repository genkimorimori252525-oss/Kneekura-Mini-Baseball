import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [artifactArg,evidenceArg]=process.argv.slice(2);
if(!artifactArg||!evidenceArg)throw Error('requires HTML and NEW evidence directory');
const artifact=resolve(artifactArg),evidence=resolve(evidenceArg),baseline=resolve('docs/demos/releases/v41/game.html'),sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(evidence,{recursive:false});
const report={artifact,sha256:sha(await readFile(artifact)),baseline,baselineSha256:sha(await readFile(baseline)),views:[]};
const pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,path);
const native=await readFile('dist/native-match-core-browser.js','utf8');assert.equal(sha(native),pins.entrySha256);
for(const path of [artifact,baseline])assert((await readFile(path,'utf8')).includes(native),'same current Core bundle in both HTMLs');
report.nativeBundleSha256=pins.entrySha256;report.unchangedCoreInputs=Object.keys(pins.inputs).length;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const generate=p=>p.evaluate(()=>{for(let i=0;i<12;i++)document.getElementById('next-pitch').click();window.liveMatchPlayback.stop();
 const s=window.liveMatchPlayback.inspect();if(s.error)throw Error(s.error);return s.generatedPitches;});
const hashes=p=>p.evaluate(async()=>{const s=window.liveMatchPlayback.inspect(),out=[];for(const r of s.host.history){
 const bytes=new TextEncoder().encode(JSON.stringify({frames:r.frames,play:r.play,events:r.events,match:r.match}));
 out.push([...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join(''));}return out;});
const setup=async(p,path)=>{await p.goto(pathToFileURL(path).href);await p.evaluate(()=>document.fonts.ready);await p.locator('details.settings > summary').click();};
const seek=async(p,pitch,ms)=>p.evaluate(({pitch,ms})=>{window.liveMatchPlayback.seekPitch(pitch);window.liveMatchPlayback.seekPresentationMs(ms);},{pitch,ms});
const camera=async(p,name,automatic=false)=>{await p.locator('[data-camera="'+name+'"]').click();await p.locator('#auto-overhead').setChecked(automatic);};
const read=p=>p.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{gaze:s.presentation.batterGaze,rendered:s.rendered,frame:s.currentFrame,elapsedMs:s.presentation.elapsedMs};});
const cameraShape=s=>Object.fromEntries(['camera','cameraEye','cameraYaw','cameraPitch'].map(k=>[k,s.rendered[k]]));
try{
 const old=await browser.newPage({viewport:{width:1200,height:860}});await setup(old,baseline);assert.equal(await generate(old),12);
 const baselineHashes=await hashes(old);
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:860}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:)/.test(r.url()))requests.push(r.url());});
  await setup(page,artifact);assert.equal(await generate(page),12);assert.deepEqual(await hashes(page),baselineHashes,'all 12 actual pitches unchanged');
  const cases=await page.evaluate(()=>{
   const h=window.liveMatchPlayback.inspect().host.history,sides={};let miss=null,take=null;
   for(const [pitch,r]of h.entries()){
    const d=r.play.diagnostics,tps=d.sourceClockTicksPerSecond,first=r.frames[0].tick,
     end=1540+(d.referenceThroughTick-first)/tps*1000,start=1540+(d.referenceStartTick-first)/tps*1000,
     impact=r.play.contactMoment?.ball?.tick,contact=impact==null?null:1540+(impact-first)/tps*1000;
    const row={pitch,start,end,contact,side:d.battingSide,target:d.zoneJudgment&&d.aimErrorMeters?
     Object.fromEntries(['x','y','z'].map(a=>[a,d.zoneJudgment.observedForecastPosition[a]+d.aimErrorMeters[a]])):null};
    if(d.swingOffered&&contact!==null&&end>contact+5)sides[d.battingSide]??=row;
    if(d.swingOffered&&contact===null)miss??=row;if(!d.swingOffered)take??=row;
   }return{sides,miss,take};
  });
  assert(cases.sides.R&&cases.sides.L,'actual R/L contact coverage');
  const view={width,cases,checks:[],coreHashes:baselineHashes};
  for(const side of ['R','L']){
   const c=cases.sides[side];
   for(const automatic of [false,true]){
    await camera(page,'batter',automatic);
    const targets=[],balls=[];
    for(const ms of [c.contact+.001,(c.contact+c.end)/2,c.end-.001]){
     await seek(page,c.pitch,ms);const s=await read(page),eye=s.rendered.cameraEye;
     assert(s.gaze,'gaze active after contact until measured end');assert.equal(s.rendered.camera,'batter');
     assert(!s.rendered.actors.some(a=>a.id==='BAT'),'own runner body cannot obscure the held batter gaze');
     for(const actor of s.frame.actors.filter(a=>a.role==='C')){
      const height=1.8,near=Math.hypot(actor.position.x-eye.x,actor.position.z-eye.z)<.9*height;
      if(near)assert(s.rendered.nearRunnerHiddenActors.includes('C'),'near catcher cannot cover the contact point');
     }
     assert.deepEqual(s.gaze.target,c.target,'planned sweet spot, not actual or estimated contact');
     const yaw=Math.atan2(c.target.x-eye.x,c.target.z-eye.z),pitch=-Math.atan2(c.target.y-eye.y,Math.hypot(c.target.x-eye.x,c.target.z-eye.z));
     assert(Math.abs(s.rendered.cameraYaw-yaw)<1e-10);assert(Math.abs(s.rendered.cameraPitch-pitch)<1e-10);
     targets.push(s.gaze.target);balls.push(s.frame.ball?.position??null);
    }
    assert(new Set(balls.map(v=>JSON.stringify(v))).size>1,'ball keeps moving while gaze stays fixed');
    await seek(page,c.pitch,c.end);const after=await read(page);assert.equal(after.gaze,null,'exact end releases gaze');
    await seek(old,c.pitch,c.end);await camera(old,'batter',automatic);assert.deepEqual(cameraShape(after),cameraShape(await read(old)),'existing tracking restored exactly');
    await seek(page,c.pitch,c.start-1);assert.equal((await read(page)).gaze,null,'rewind before swing clears gaze');
    await seek(page,c.pitch,(c.contact+c.end)/2);assert.deepEqual((await read(page)).gaze.target,c.target,'rewind restores fixed target');
    view.checks.push({side,automatic,endMs:c.end,afterCamera:after.rendered.camera,fixedTargets:targets,ballPositions:balls});
   }
  }
  const c=cases.sides.R,mid=(c.contact+c.end)/2;
  for(const name of ['catcher','mound','runner','overhead']){
   await seek(page,c.pitch,mid);await camera(page,name);await seek(old,c.pitch,mid);await camera(old,name);
   assert.deepEqual(cameraShape(await read(page)),cameraShape(await read(old)),name+' camera unchanged');
  }
  // Fielder is an automatic mound handoff, not a selectable UI button.
  const fieldCase=await page.evaluate(()=>{const h=window.liveMatchPlayback.inspect().host.history;
   for(const [pitch,r]of h.entries()){
    const first=r.frames.find(f=>f.ballKind==='batted'),last=r.frames.findLast(f=>['batted','throw'].includes(f.ballKind)&&f.tick>(first?.tick??Infinity)+2e6);
    if(last)return{pitch,ms:1540+(last.tick-r.frames[0].tick)/1000};
   }return null;});
  assert(fieldCase,'actual live field coverage');
  await seek(page,fieldCase.pitch,fieldCase.ms);await camera(page,'mound');
  await seek(old,fieldCase.pitch,fieldCase.ms);await camera(old,'mound');
  assert.deepEqual(cameraShape(await read(page)),cameraShape(await read(old)),'automatic field handoff unchanged');
  for(const name of ['take','miss'])if(cases[name]){
   const c=cases[name];await seek(page,c.pitch,Math.max(1540,c.end+1));await camera(page,'batter');
   assert.equal((await read(page)).gaze,null,name+' must not retain gaze');
   await seek(old,c.pitch,Math.max(1540,c.end+1));await camera(old,'batter');
   assert.deepEqual(cameraShape(await read(page)),cameraShape(await read(old)));
  }
  await seek(page,c.pitch,0);assert.equal((await read(page)).gaze,null,'next-pitch preparation reset');
  assert.deepEqual(await hashes(page),baselineHashes,'seek and camera never mutate Source');
  await seek(page,c.pitch,mid);await camera(page,'batter');
  await page.locator('#field').screenshot({path:resolve(evidence,'contact-gaze-'+width+'.png')});
  await seek(page,c.pitch,c.end+55);await page.locator('#field').screenshot({path:resolve(evidence,'tracking-restored-'+width+'.png')});
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);view.errors=errors;view.externalRequests=requests;
  report.views.push(view);await page.close();
 }
 report.pass=true;console.log(JSON.stringify({pass:true,widths:report.views.map(v=>v.width),pitches:12,coreInputs:report.unchangedCoreInputs,nativeBundleSha256:report.nativeBundleSha256}));
}catch(error){report.pass=false;report.error=String(error.stack??error);throw error;}
finally{await writeFile(resolve(evidence,'batter-gaze-check.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
