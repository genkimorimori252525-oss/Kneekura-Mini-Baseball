import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const artifact=resolve(process.argv[2]),out=resolve(process.argv[3]),sha=value=>createHash('sha256').update(value).digest('hex');
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
await mkdir(out,{recursive:true});const bytes=await readFile(artifact),meta=JSON.parse(await readFile(artifact+'.build.json')),
 report={pass:false,artifact,sha256:sha(bytes),coreSha256:meta.sourceCoreSha256,cases:[],faults:[]};
assert.equal(meta.sha256,report.sha256);let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),fault={width,errors:[],external:[]};report.faults.push(fault);
  page.on('pageerror',error=>fault.errors.push(String(error)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))fault.external.push(r.url());});
  await page.goto(pathToFileURL(artifact).href,{timeout:60000});await page.waitForFunction(()=>globalThis.liveMatchPlayback);
  const found=await page.evaluate(()=>{
   const api=liveMatchPlayback;document.getElementById('auto-overhead').checked=false;document.querySelector('[data-camera="mound"]').click();
   const tried=[];
   for(let i=0;i<80;i++){
    document.getElementById('next-pitch').click();api.stop();const state=api.inspect();if(state.error)throw Error(state.error);
    const record=state.host.history.at(-1),fence=record.play.field?.ruleFacts.overFence;
    if(record.play.classification==='home_run'&&fence){
     const start=state.presentation.timing.preparationMs+(fence.tick-record.frames[0].tick)/record.play.diagnostics.sourceClockTicksPerSecond*1000;
     api.seekPitch(state.generatedPitches-1);api.seekPresentationMs(start+100);const view=api.inspect();
     tried.push({pitch:state.generatedPitches-1,camera:view.rendered.camera,watch:view.homeRunWatch,classification:record.play.classification});
     if(view.homeRunWatch?.active)return {pitch:state.generatedPitches-1,start,tried};
    }
    if(state.host.finished)break;
   }
   return {pitch:null,tried,generated:api.inspect().generatedPitches};
  });
  assert.notEqual(found.pitch,null,'an actual mound-to-fielder home run is required: '+JSON.stringify(found));
  const row={width,...found,observations:[]};report.cases.push(row);
  const before=await page.evaluate(()=>JSON.stringify(liveMatchPlayback.inspect().host.history));
  for(const offset of [-100,0,100,500,1000,1499,1749,1750,2000,500]){
   const observation=await page.evaluate(({pitch,start,offset})=>{
    const api=liveMatchPlayback;api.seekPitch(pitch);api.seekPresentationMs(start+offset);const state=api.inspect();
    return {offset,camera:state.rendered.camera,watch:state.homeRunWatch,eye:state.rendered.cameraEye,
     tick:state.currentFrame.tick,elapsed:state.presentation.elapsedMs,generated:state.generatedPitches,
     sourceBall:state.currentFrame.ball,
     ballVisible:state.rendered.ballDotDisplay??state.rendered.ballDot??null,headline:document.getElementById('result-text').textContent};
   },{pitch:found.pitch,start:found.start,offset});
   if(offset>=100&&offset<1750){assert(observation.watch?.active);assert.equal(observation.camera,'fielder');assert.equal(observation.watch.holdMs,1750);
    if(observation.sourceBall){assert.deepEqual(observation.watch.target,observation.sourceBall.position);
     if(observation.sourceBall.phase==='dead'&&observation.sourceBall.visible===false){assert.equal(observation.watch.displayBall?.visible,true);assert.equal(observation.sourceBall.visible,false);}
    }
   }
   if(offset<0||offset>=1750)assert.equal(observation.watch,null);
   row.observations.push(observation);
  }
  assert.deepEqual(row.observations.at(-1).watch,row.observations.find(value=>value.offset===500)?.watch??row.observations.at(-1).watch);
  await page.screenshot({path:resolve(out,'hr-watch-'+width+'.png')});
  for(const camera of ['catcher','batter','runner','overhead']){
   const observation=await page.evaluate(({camera,start})=>{document.querySelector('[data-camera="'+camera+'"]').click();liveMatchPlayback.seekPresentationMs(start+500);return liveMatchPlayback.inspect().homeRunWatch;},{camera,start:found.start});
   assert.equal(observation,null,'other POV '+camera);
  }
  const after=await page.evaluate(()=>JSON.stringify(liveMatchPlayback.inspect().host.history));assert.equal(after,before,'seeking and watch never alter canonical history');
  const ordinary=await page.evaluate(()=>{const api=liveMatchPlayback,index=api.inspect().host.history.findIndex(record=>record.play.classification!=='home_run');api.seekPitch(index);api.seekPresentationMs(api.inspect().presentation.durationMs);return {index,watch:api.inspect().homeRunWatch};});
  assert.equal(ordinary.watch,null);row.ordinary=ordinary;row.historySha256=sha(before);
  assert.deepEqual(fault.errors,[]);assert.deepEqual(fault.external,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.close();
 }
 assert.equal(sha(await readFile(artifact)),report.sha256);report.pass=true;
}catch(error){report.error=String(error.stack??error);throw error;}
finally{await browser?.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({pass:true,cases:report.cases.length,sha256:report.sha256}));
