import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {applyPresentationCadenceV84} from './presentation-cadence-v84.mjs';
import {applyPresentationRenderControlsV84} from './presentation-render-controls-v84.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const artifact=resolve(process.argv[2]),out=resolve(process.argv[3]),baseline=resolve('docs/demos/releases/v83/game.html'),sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:true});
const original=await readFile(baseline,'utf8'),fixture=applyPresentationRenderControlsV84(applyPresentationCadenceV84(original)),fixturePath=resolve(out,'v83-core-v84-display-only-fixture.html');
await writeFile(fixturePath,fixture);
const core=s=>[...s.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var KneekuraNativeMatchCore ='));
assert.equal(sha(core(fixture)),sha(core(original)),'isolated comparison must retain the old v83 Core exactly');
const report={pass:false,artifact,artifactSha256:sha(await readFile(artifact)),baselineSha256:sha(original),fixtureSha256:sha(fixture),
 isolatedFixtureCoreSha256:sha(core(fixture)),scope:'RGBA equivalence at quality 1 uses only the old v83 Core and identical history. The final v84 movement Core is tested separately for read-only observation. Simulated viewport/DPR; no real-device FPS claim.',cases:[],faults:[]};
let browser;
function fault(page,label){const row={label,errors:[],external:[]};report.faults.push(row);page.on('pageerror',e=>row.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))row.external.push(r.url());});return row;}
async function open(page,path){await page.goto(pathToFileURL(path).href,{timeout:60000});await page.waitForFunction(()=>globalThis.liveMatchPlayback,undefined,{timeout:60000});await page.evaluate(()=>document.fonts.ready);}
async function generate(page){return page.evaluate(()=>{document.getElementById('auto-overhead').checked=false;for(let i=0;i<2;i++){document.getElementById('next-pitch').click();liveMatchPlayback.stop();if(liveMatchPlayback.inspect().error)throw Error(liveMatchPlayback.inspect().error);}return liveMatchPlayback.inspect().generatedPitches;});}
async function history(page){return page.evaluate(async()=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(liveMatchPlayback.inspect().host.history))))].map(n=>n.toString(16).padStart(2,'0')).join(''));}
async function captures(page){return page.evaluate(async()=>{
 const api=liveMatchPlayback,digest=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join(''),rows=[];
 for(let pitch=0;pitch<2;pitch++)for(const camera of ['catcher','batter','runner','mound','overhead']){
  api.seekPitch(pitch);document.querySelector('[data-camera="'+camera+'"]').click();const s=api.inspect(),prep=s.presentation.timing.preparationMs,duration=s.presentation.durationMs;
  for(const ms of [0,prep*.7,prep+80,prep+300,Math.min(duration,prep+(duration-prep)*.7),prep+80]){
   api.seekPresentationMs(ms);const current=api.inspect(),hashes={};
   for(const id of ['field','bat-overlay','ball-overlay','pitch-chart']){const c=document.getElementById(id);hashes[id]=await digest(c.getContext('2d').getImageData(0,0,c.width,c.height).data);}
   rows.push({pitch,camera,ms,tick:current.currentFrame.tick,observedCamera:current.rendered.camera,hashes,
    labels:[...document.querySelectorAll('#actor-labels span')].map(e=>({text:e.textContent,actor:e.dataset.actor,role:e.dataset.role,left:e.style.left,top:e.style.top,font:e.style.fontSize,color:e.style.color,z:e.style.zIndex})),
    caption:document.getElementById('camera-caption').textContent,result:document.getElementById('result-text').textContent});
  }
 }return rows;
});}
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas','--enable-precise-memory-info']});
 for(const width of [1200,390])for(const dpr of [1,2]){
  const oldPage=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:dpr}),newPage=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:dpr});
  const oldFault=fault(oldPage,'old-'+width+'-'+dpr),newFault=fault(newPage,'fixture-'+width+'-'+dpr);
  await open(oldPage,baseline);await open(newPage,fixturePath);await newPage.evaluate(()=>KneekuraPresentationControlsV84.configure({qualityScale:1}));
  await generate(oldPage);await generate(newPage);const oldHistory=await history(oldPage),newHistory=await history(newPage);assert.equal(newHistory,oldHistory,'display-only fixture history');
  const expected=await captures(oldPage),actual=await captures(newPage);assert.deepEqual(actual,expected,'quality 1 full RGBA, labels and states '+width+'/'+dpr);
  assert.equal(await history(newPage),newHistory,'paused captures do not mutate history');
  for(const f of [oldFault,newFault]){assert.deepEqual(f.errors,[]);assert.deepEqual(f.external,[]);}
  report.cases.push({width,dpr,qualityOneExact:true,rgbaScenes:actual.length,historySha256:oldHistory,captures:actual});
  await oldPage.close();await newPage.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({phase:'quality-one',width,dpr,scenes:actual.length}));
 }
 for(const width of [1200,390])for(const dpr of [1,2]){
  const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:dpr}),errors=fault(page,'final-'+width+'-'+dpr);await open(page,artifact);await generate(page);const before=await history(page);
  const observations=await page.evaluate(async()=>{
   const api=liveMatchPlayback,c=KneekuraPresentationControlsV84,sha=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');
   const rows=[];api.seekPitch(0);document.querySelector('[data-camera="overhead"]').click();const prep=api.inspect().presentation.timing.preparationMs;
   for(const q of [1.2,1,1.2]){
    c.configure({frequencyScale:2,qualityScale:q});api.seekPresentationMs(prep+80);const s=api.inspect(),hashes={};
    for(const id of ['field','bat-overlay','ball-overlay']){const cv=document.getElementById(id);hashes[id]=await sha(cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data);}
    if(!s.rendered.gridAligned)throw Error('unaligned world lattice');
    for(const cell of [...s.rendered.actorCells,...s.rendered.fieldMarkCells,...(s.rendered.ballDotDisplay?.cells??[])])if(!c.grid.aligned(cell.x)||!c.grid.aligned(cell.y))throw Error('unaligned layer cell');
    rows.push({q,gridStep:c.grid.step(),groundCells:s.rendered.groundCells??null,hashes,ball:s.rendered.ballDotDisplay?{projected:s.rendered.ballDotDisplay.projectedDiameterPx,optical:s.rendered.ballDotDisplay.opticalDiameterPx,display:s.rendered.ballDotDisplay.displayDiameterPx}:null});
   }
   const boundaries=[];
   for(const [pitch,r]of api.inspect().host.history.entries())for(let i=1;i<r.frames.length;i++){
    const f=r.frames[i],previous=r.frames[i-1];if(f.phase===previous.phase&&f.possessedBy===previous.possessedBy&&f.ballKind===previous.ballKind)continue;
    const ms=prep+(f.tick-r.frames[0].tick)/r.play.diagnostics.sourceClockTicksPerSecond*1000;
    for(const value of [ms-.01,ms,ms+.01,ms-.01]){api.seekPitch(pitch);api.seekPresentationMs(value);const s=api.inspect();boundaries.push({pitch,ms:value,tick:s.currentFrame.tick,phase:s.currentFrame.phase,custody:s.currentFrame.possessedBy,renderedCustody:s.rendered.custody});}
    if(boundaries.length>=48)break;
   }
   return {controls:c.inspect(),rows,boundaries,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.deepEqual(observations.rows[0],observations.rows[2],'quality round trip must be deterministic');assert.notDeepEqual(observations.rows[0].hashes.field,observations.rows[1].hashes.field,'quality increases spatial samples');
  assert.deepEqual(observations.rows[0].ball,observations.rows[1].ball,'ball SI/optical/display size unchanged');assert(observations.boundaries.every(b=>b.custody===b.renderedCustody));assert(!observations.overflow);
  assert.equal(await history(page),before,'quality/boundary observations retain final v84 history');assert.deepEqual(errors.errors,[]);assert.deepEqual(errors.external,[]);
  report.cases.push({width,dpr,finalV84:true,historySha256:before,...observations});await page.screenshot({path:resolve(out,'quality-'+width+'-dpr'+dpr+'.png')});await page.close();
  console.log(JSON.stringify({phase:'final-quality',width,dpr,boundaries:observations.boundaries.length}));
 }
 assert.equal(sha(await readFile(artifact)),report.artifactSha256);report.pass=true;
}catch(error){report.error=String(error.stack??error);throw error;}finally{await browser?.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
