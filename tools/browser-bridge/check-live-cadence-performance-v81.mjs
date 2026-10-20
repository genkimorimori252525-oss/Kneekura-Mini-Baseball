import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const old=resolve(process.argv[2]),next=resolve(process.argv[3]),out=resolve(process.argv[4]);await mkdir(out,{recursive:true});
const report={pass:false,scope:'Animation-RAF Canvas submissions on this headless Chrome. Not display scanout or real phone FPS.',cases:[]};let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
 for(const [version,path]of [['baseline',old],['v81',next]]){
  const page=await browser.newPage({viewport:{width:1200,height:900}});await page.addInitScript(()=>{
   let inRaf=0,serial=0;const nativeRaf=requestAnimationFrame,fill=CanvasRenderingContext2D.prototype.fillRect,clear=CanvasRenderingContext2D.prototype.clearRect;
   window.__cadenceProbeV81={active:false,frames:[]};
   window.requestAnimationFrame=callback=>nativeRaf(time=>{const row={time,field:0,ball:0,bat:0};inRaf++;const before=serial;serial++;window.__cadenceProbeV81.current=row;try{return callback(time);}finally{if(__cadenceProbeV81.active&&(row.field||row.ball||row.bat))__cadenceProbeV81.frames.push(row);inRaf--;if(!inRaf)delete __cadenceProbeV81.current;serial=before;}});
   CanvasRenderingContext2D.prototype.fillRect=function(x,y,w,h){if(inRaf&&__cadenceProbeV81.active&&this.canvas.id==='field'&&x===0&&y===0&&w===600&&h===432)__cadenceProbeV81.current.field++;return fill.call(this,x,y,w,h);};
   CanvasRenderingContext2D.prototype.clearRect=function(...args){if(inRaf&&__cadenceProbeV81.active){const key=this.canvas.id==='ball-overlay'?'ball':this.canvas.id==='bat-overlay'?'bat':null;if(key)__cadenceProbeV81.current[key]++;}return clear.apply(this,args);};
  });
  await page.goto(pathToFileURL(path).href);await page.waitForFunction(()=>globalThis.liveMatchPlayback);
  const setup=await page.evaluate(()=>{document.getElementById('auto-overhead').checked=false;document.querySelector('[data-camera="batter"]').click();document.getElementById('next-pitch').click();liveMatchPlayback.stop();return liveMatchPlayback.inspect().presentation.timing;});
  const measures=[];for(const [phase,ms,duration]of [['preparation',200,650],['freePitch',setup.preparationMs+30,250]]){
   const measured=await page.evaluate(async({ms,duration})=>{const a=liveMatchPlayback,p=__cadenceProbeV81;a.seekPresentationMs(ms);const history=JSON.stringify(a.inspect().host.history),before=a.inspect().presentation.cadence;p.frames=[];p.active=true;const start=performance.now();a.play();await new Promise(r=>setTimeout(r,duration));const elapsed=performance.now()-start;p.active=false;a.stop();const after=a.inspect();if(history!==JSON.stringify(after.host.history))throw Error('playback mutated Core history');return {elapsedMs:elapsed,frames:p.frames,fullSceneDraws:p.frames.reduce((n,r)=>n+r.field,0),ballOnlyRafs:p.frames.filter(r=>r.ball&&!r.field).length,ballOnlyPaintDelta:after.presentation.cadence.pitchBallPaints-before.pitchBallPaints,configuration:after.presentation.cadence};},{ms,duration});
   measured.submittedFps=measured.fullSceneDraws*1000/measured.elapsedMs;measures.push({phase,...measured});
  }
  if(version==='v81'){assert(measures.every(m=>m.ballOnlyRafs===0&&m.ballOnlyPaintDelta===0),'no independent ball-only submission');assert(measures.every(m=>m.frames.every(f=>!f.field||f.ball&&f.bat)),'full scene carries bat and ball layers');}
  report.cases.push({version,measures});await page.close();
 }
 report.pass=true;
}catch(e){report.error=String(e.stack??e);throw e;}finally{await browser?.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
