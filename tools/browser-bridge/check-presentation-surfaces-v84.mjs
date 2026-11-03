import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [normal,lab,maker,out]=process.argv.slice(2).map(path=>resolve(path)),sha=b=>createHash('sha256').update(b).digest('hex');await mkdir(out,{recursive:true});
const artifacts={normal,lab,maker},hashes=Object.fromEntries(await Promise.all(Object.entries(artifacts).map(async([kind,path])=>[kind,sha(await readFile(path))]))),report={pass:false,artifacts,hashes,cases:[],faults:[],scope:'Shared Presentation controls, read-only source checks, RAF Canvas submissions and distinct saved Core ticks. Simulated PC/390px and DPR1/2. Actual FPS is bounded by RAF and draw cost; target Hz is not achieved FPS.'};let browser;
function faults(page,label){const f={label,errors:[],external:[]};report.faults.push(f);page.on('pageerror',e=>f.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))f.external.push(r.url());});return f;}
async function open(page,path){await page.goto(pathToFileURL(path).href,{timeout:60000});await page.evaluate(()=>document.fonts.ready);}
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
 for(const width of [1200,390])for(const dpr of [1,2]){
  const p=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:dpr}),f=faults(p,'lab-'+width+'-'+dpr);await open(p,lab);await p.waitForFunction(()=>globalThis.KneekuraCameraLab?.inspect().ready,undefined,{timeout:60000});
  const row=await p.evaluate(async()=>{
   const a=KneekuraCameraLab,w=document.querySelector('iframe').contentWindow,c=KneekuraPresentationControlsV84,digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(n=>n.toString(16).padStart(2,'0')).join(''),pixel=async id=>{const cv=document.getElementById(id);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data))].map(n=>n.toString(16).padStart(2,'0')).join('');};
   if(c!==w.KneekuraPresentationControlsV84)throw Error('lab does not expose the same controls object');a.nextPitch();a.pause();const before=await digest(w.liveMatchPlayback.inspect().host.history),rows=[];
   for(const q of [1.2,1,1.2]){c.configure({frequencyScale:2,qualityScale:q});a.setCamera('mound');a.seek(1660);const s=a.inspect();rows.push({q,A:s.A.sceneMs,B:s.B.sceneMs,hashA:await pixel('view-A'),hashB:await pixel('view-B'),controls:c.inspect()});}
   a.seek(300);const counts=a.inspect().cadence.sceneDraws,start=performance.now();a.play();await new Promise(r=>setTimeout(r,400));const ended=performance.now(),during=a.inspect();a.pause();const elapsed=ended-start;
   if(before!==await digest(w.liveMatchPlayback.inspect().host.history))throw Error('lab observation changed history');
   return {rows,history:before,cadence:during.cadence,submittedPairs:during.cadence.sceneDraws-counts,elapsedMs:elapsed,pairFps:(during.cadence.sceneDraws-counts)*1000/elapsed,A:during.A.sceneMs,B:during.B.sceneMs,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.deepEqual(row.rows[0],row.rows[2]);assert.notEqual(row.rows[0].hashA,row.rows[1].hashA);assert.equal(row.A,row.B);assert(!row.overflow);assert.deepEqual(f.errors,[]);assert.deepEqual(f.external,[]);report.cases.push({kind:'lab',width,dpr,...row});await p.close();console.log(JSON.stringify({kind:'lab',width,dpr}));
  const m=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:dpr}),mf=faults(m,'maker-'+width+'-'+dpr);await open(m,maker);await m.waitForFunction(()=>globalThis.KneekuraBatterComparisonV70?.inspect().ready&&globalThis.KneekuraPitcherMakerV78&&!KneekuraPitcherMakerV78.inspect().loading,undefined,{timeout:60000});
  const mr=await m.evaluate(async()=>{
   const c=KneekuraPresentationControlsV84,hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(n=>n.toString(16).padStart(2,'0')).join(''),pixel=async id=>{const cv=document.getElementById(id);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data))].map(n=>n.toString(16).padStart(2,'0')).join('');},before=await hash(baseballMaker.getLiveRoster());
   document.getElementById('tab-bat').click();await KneekuraBallComparison.run();KneekuraBallComparison.seek(.3);const metrics=await hash(KneekuraBallComparison.inspect().metrics),batter=[];
   for(const q of [1.2,1,1.2]){c.configure({frequencyScale:2,qualityScale:q});KneekuraBallComparison.seek(.3);const s=KneekuraBatterComparisonV70.inspect();if(s.error)throw Error(s.error);batter.push({q,hash:await pixel('comparison-canvas-batter'),hostUnchanged:s.renderer.hostUnchanged,scene:s.renderer.sceneSeconds,ball:s.renderer.ballSeconds,layers:s.renderer.layers.map(l=>l.id)});}
   document.getElementById('tab-pitcher').click();KneekuraPitcherMakerV78.selectPitch('fastball');await KneekuraPitcherMakerV78.run();KneekuraPitcherMakerV78.seek(1.7);const trial=await hash(KneekuraPitcherMakerV78.exportResult()),pitcher=[];
   for(const q of [1.2,1,1.2]){c.configure({frequencyScale:2,qualityScale:q});KneekuraPitcherMakerV78.seek(1.7);const s=KneekuraPitcherMakerV78.inspect();pitcher.push({q,hash:await pixel('pitcher-canvas'),hostUnchanged:s.renderer.hostUnchanged,scene:s.renderer.sceneSeconds,ball:s.renderer.ballSeconds,layers:s.renderer.layers.map(l=>l.id)});}
   const children=[...document.querySelectorAll('iframe')].map(f=>f.contentWindow).filter(w=>w.KneekuraPresentationControlsV84).map(w=>w.KneekuraPresentationControlsV84.inspect());
   if(before!==await hash(baseballMaker.getLiveRoster())||metrics!==await hash(KneekuraBallComparison.inspect().metrics)||trial!==await hash(KneekuraPitcherMakerV78.exportResult()))throw Error('quality observation changed authoring/trial Source');
   return {batter,pitcher,children,roster:before,metrics,trial,clips:KneekuraReferenceBatMotions.clips.length,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  for(const values of [mr.batter,mr.pitcher]){assert.deepEqual(values[0],values[2]);assert.notEqual(values[0].hash,values[1].hash);assert(values.every(v=>v.hostUnchanged));assert(values.every(v=>v.layers.includes('field')&&v.layers.includes('bat-overlay')&&v.layers.includes('ball-overlay')));}
  assert(mr.children.length>=2);assert(mr.children.every(c=>c.frequencyScale===2&&c.qualityScale===1.2));assert.equal(mr.clips,673);assert(!mr.overflow);assert.deepEqual(mf.errors,[]);assert.deepEqual(mf.external,[]);report.cases.push({kind:'maker',width,dpr,...mr});await m.close();console.log(JSON.stringify({kind:'maker',width,dpr}));
 }
 const p=await browser.newPage({viewport:{width:1200,height:900}}),f=faults(p,'normal-cadence');await open(p,normal);await p.waitForFunction(()=>globalThis.liveMatchPlayback,undefined,{timeout:60000});
 const cadence=await p.evaluate(async()=>{
  const api=liveMatchPlayback,c=KneekuraPresentationControlsV84;c.configure({frequencyScale:2,qualityScale:1.2});document.getElementById('next-pitch').click();api.stop();document.querySelector('[data-camera="mound"]').click();
  const before=JSON.stringify(api.inspect().host.history),probe={active:false,current:null,frames:[]},native=requestAnimationFrame,fill=CanvasRenderingContext2D.prototype.fillRect,clear=CanvasRenderingContext2D.prototype.clearRect,animation=KneekuraLiveActorAnimation;
  window.KneekuraLiveActorAnimation={...animation,observe(input){if(probe.active&&probe.current)probe.current.stamp={sceneMs:input.sceneMs,tick:input.frame.tick};return animation.observe(input);}};
  window.requestAnimationFrame=callback=>native(time=>{const row={time,field:0,bat:0,ball:0};probe.current=row;try{return callback(time);}finally{if(probe.active&&(row.field||row.bat||row.ball))probe.frames.push(row);probe.current=null;}});
  CanvasRenderingContext2D.prototype.fillRect=function(x,y,w,h){if(probe.active&&probe.current&&this.canvas.id==='field'&&x===0&&y===0&&w===600&&h===432)probe.current.field++;return fill.call(this,x,y,w,h);};
  CanvasRenderingContext2D.prototype.clearRect=function(...args){if(probe.active&&probe.current){if(this.canvas.id==='bat-overlay')probe.current.bat++;if(this.canvas.id==='ball-overlay')probe.current.ball++;}return clear.apply(this,args);};
  const measures=[];const prep=api.inspect().presentation.timing.preparationMs;
  for(const [phase,ms,duration]of [['preparation',200,400],['freePitch',prep+20,120]]){api.seekPitch(0);api.seekPresentationMs(ms);probe.frames=[];probe.active=true;const started=performance.now();api.play();await new Promise(r=>setTimeout(r,duration));probe.active=false;const ended=performance.now();api.stop();const elapsed=ended-started,frames=probe.frames;measures.push({phase,elapsedMs:elapsed,stopDrawMs:performance.now()-ended,frames,submittedScenes:frames.reduce((n,f)=>n+f.field,0),submittedFps:frames.reduce((n,f)=>n+f.field,0)*1000/elapsed,distinctSavedTicks:new Set(frames.flatMap(f=>f.stamp?[f.stamp.tick]:[])).size,distinctSceneTimes:new Set(frames.flatMap(f=>f.stamp?[f.stamp.sceneMs]:[])).size,ballOnlyRafs:frames.filter(f=>f.ball&&!f.field).length});}
  if(before!==JSON.stringify(api.inspect().host.history))throw Error('live observation changed history');return {configuration:c.inspect(),measures};
 });
 assert(cadence.measures.every(m=>m.submittedScenes>0&&m.ballOnlyRafs===0));assert(cadence.measures.every(m=>m.frames.every(frame=>!frame.field||frame.bat&&frame.ball)));assert.deepEqual(f.errors,[]);assert.deepEqual(f.external,[]);report.cases.push({kind:'normal-cadence',...cadence});await p.close();
 for(const [kind,path]of Object.entries(artifacts))assert.equal(sha(await readFile(path)),hashes[kind]);report.pass=true;
}catch(error){report.error=String(error.stack??error);throw error;}finally{await browser?.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
