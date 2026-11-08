import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const baseline=resolve(process.argv[2]),next=resolve(process.argv[3]),out=resolve(process.argv[4]),sha=b=>createHash('sha256').update(b).digest('hex');await mkdir(out,{recursive:true});
const report={pass:false,baseline,next,baselineSha256:sha(await readFile(baseline)),nextSha256:sha(await readFile(next)),
 scope:'One sequential controlled browser run: v83 then v84 quality 1 then v84 quality 1.2, at the same viewport/camera/seed/windows. Windows headless Chrome, 2D acceleration disabled. Saved Core tick counts, whole-scene Canvas submissions and Presentation scene times are distinct measures. No real-device, display scanout or twofold-achieved-FPS claim.',cases:[],faults:[]};let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
 report.browserVersion=browser.version();
 for(const [label,path,quality]of [['v83',baseline,null],['v84-quality-1',next,1],['v84-quality-1.2',next,1.2]]){
  const p=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1}),fault={label,errors:[],external:[]};report.faults.push(fault);p.on('pageerror',e=>fault.errors.push(String(e)));p.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))fault.external.push(r.url());});
  await p.goto(pathToFileURL(path).href,{timeout:60000});await p.waitForFunction(()=>globalThis.liveMatchPlayback,undefined,{timeout:60000});await p.evaluate(()=>document.fonts.ready);
  const measurements=await p.evaluate(async quality=>{
   const api=liveMatchPlayback;if(quality!==null)KneekuraPresentationControlsV84.configure({frequencyScale:2,qualityScale:quality});
   document.getElementById('auto-overhead').checked=false;document.getElementById('next-pitch').click();api.stop();
   const prep=api.inspect().presentation.timing.preparationMs,history=JSON.stringify(api.inspect().host.history),probe={active:false,current:null,frames:[]},native=requestAnimationFrame,
    fill=CanvasRenderingContext2D.prototype.fillRect,clear=CanvasRenderingContext2D.prototype.clearRect,animation=KneekuraLiveActorAnimation;
   window.KneekuraLiveActorAnimation={...animation,observe(input){if(probe.active&&probe.current)probe.current.stamp={sceneMs:input.sceneMs,tick:input.frame.tick};return animation.observe(input);}};
   window.requestAnimationFrame=callback=>native(time=>{const row={time,field:0,bat:0,ball:0};probe.current=row;try{return callback(time);}finally{if(probe.active&&(row.field||row.bat||row.ball))probe.frames.push(row);probe.current=null;}});
   CanvasRenderingContext2D.prototype.fillRect=function(x,y,w,h){if(probe.active&&probe.current&&this.canvas.id==='field'&&x===0&&y===0&&w===600&&h===432)probe.current.field++;return fill.call(this,x,y,w,h);};
   CanvasRenderingContext2D.prototype.clearRect=function(...args){if(probe.active&&probe.current){if(this.canvas.id==='bat-overlay')probe.current.bat++;if(this.canvas.id==='ball-overlay')probe.current.ball++;}return clear.apply(this,args);};
   const rows=[];
   for(const camera of ['mound','batter'])for(const [phase,ms,duration]of [['preparation',200,900],['freePitch',prep+20,220]]){
    document.querySelector('[data-camera="'+camera+'"]').click();api.seekPitch(0);api.seekPresentationMs(ms);
    // Warm the current renderer and drain pre-existing RAF callbacks before the
    // measured window. The sample still includes ordinary synchronous play cost.
    for(let i=0;i<3;i++)api.seekPresentationMs(ms+i);
    await new Promise(r=>native(()=>native(r)));
    api.seekPresentationMs(ms);probe.frames=[];probe.active=true;const before=api.inspect().presentation.cadence,started=performance.now();api.play();
    await new Promise(r=>setTimeout(r,duration));probe.active=false;const ended=performance.now();api.stop();const elapsed=ended-started,stopDrawMs=performance.now()-ended,after=api.inspect().presentation.cadence,frames=probe.frames;
    const gaps=frames.slice(1).map((frame,i)=>frame.time-frames[i].time).sort((a,b)=>a-b),field=frames.reduce((n,frame)=>n+frame.field,0);
    rows.push({camera,phase,requestedWindowMs:duration,elapsedMs:elapsed,stopDrawMs,wholeSceneRafSubmissions:field,submittedFps:field*1000/elapsed,
     distinctSavedCoreTicks:new Set(frames.flatMap(f=>f.stamp?[f.stamp.tick]:[])).size,distinctPresentationTimes:new Set(frames.flatMap(f=>f.stamp?[f.stamp.sceneMs]:[])).size,
     ballOnlyRafs:frames.filter(f=>f.ball&&!f.field).length,synchronizedLayers:frames.every(f=>!f.field||f.bat&&f.ball),
     continuousPitchSamples:after.pitchBallSamples-before.pitchBallSamples,allDrawCallDelta:after.sceneDraws-before.sceneDraws,
     rafGapMedianMs:gaps.length?gaps[Math.floor(gaps.length/2)]:null,rafGapP95Ms:gaps.length?gaps[Math.min(gaps.length-1,Math.floor(gaps.length*.95))]:null,frames});
   }
   if(history!==JSON.stringify(api.inspect().host.history))throw Error('measurement advanced Core history');
   return {configuration:globalThis.KneekuraPresentationControlsV84?.inspect()??api.inspect().presentation.cadence,rows};
  },quality);
  assert(measurements.rows.every(r=>r.wholeSceneRafSubmissions>0&&r.ballOnlyRafs===0&&r.synchronizedLayers));assert.deepEqual(fault.errors,[]);assert.deepEqual(fault.external,[]);report.cases.push({label,...measurements});await p.close();console.log(JSON.stringify({label,submittedFps:measurements.rows.map(r=>({camera:r.camera,phase:r.phase,fps:r.submittedFps}))}));
 }
 assert.equal(sha(await readFile(baseline)),report.baselineSha256);assert.equal(sha(await readFile(next)),report.nextSha256);report.pass=true;
}catch(error){report.error=String(error.stack??error);throw error;}finally{await browser?.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
