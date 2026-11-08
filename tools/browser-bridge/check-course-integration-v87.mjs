import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [game,lab,out]=process.argv.slice(2).map(p=>resolve(p)),sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:true});
const paths={game,lab},hashes=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([k,p])=>[k,sha(await readFile(p))])));
const report={pass:false,paths,hashes,cases:[],faults:[],scope:'Ordinary offline UI, authored JSON import, all-role read-only diagnostics, separate physical crossing, 13-region actual stats, and embedded camera lab. PC/390px are simulated widths, not real devices.'};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
function observe(page,label){const item={label,errors:[],external:[]};report.faults.push(item);page.on('pageerror',e=>item.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))item.external.push(r.url());});return item;}
try{
 for(const width of [1200,390]){
  const p=await browser.newPage({viewport:{width,height:1000}}),fault=observe(p,'normal-'+width);await p.goto(pathToFileURL(game).href,{timeout:60000});await p.waitForFunction(()=>globalThis.liveMatchPlayback&&globalThis.KneekuraCourseDebugV87);
  const before=await p.evaluate(()=>JSON.stringify(liveMatchPlayback.inspect().physicalRoster.active));
  const authored=await p.evaluate(()=>{
   const core=KneekuraNativeMatchCore,roster=structuredClone(liveMatchPlayback.inspect().physicalRoster.active);
   for(const entry of roster.entries){const profile=structuredClone(core.createNeutralZoneRecognitionV87());for(const role of ['batter','pitcher','catcher'])for(const cell of profile[role].cells)cell.biasXM=.01;
    entry.physical.zoneRecognitionV87=profile;entry.physical.batterCourseProfileV87=core.createNeutralBatterCourseProfileV87();}
   return roster;
  });
  await p.locator('#physical-roster-file').setInputFiles({name:'v87-authoring.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(authored))});
  await p.waitForFunction(()=>document.getElementById('physical-roster-status').dataset.error==='false');
  assert.equal(await p.evaluate(()=>JSON.stringify(liveMatchPlayback.inspect().physicalRoster.active)),before,'import remains pending until new game');
  const result=await p.evaluate(()=>{
   const seasons=liveMatchSeasonsV79;seasons.command({kind:'create',seasonId:'v87-integration',name:'v87 integration'});seasons.command({kind:'select',seasonId:'v87-integration'});
   liveMatchPlayback.newGame();if(liveMatchPlayback.inspect().error)throw Error(liveMatchPlayback.inspect().error);
   document.getElementById('next-pitch').click();liveMatchPlayback.stop();const state=liveMatchPlayback.inspect(),prior=JSON.stringify(state.host.history),log=KneekuraCourseDebugV87.refresh();
   if(prior!==JSON.stringify(liveMatchPlayback.inspect().host.history))throw Error('Read-only debug changed history');
   return {version:state.version,error:state.error,active:state.physicalRoster.active,recognition:log.recognition,actual:log.actualCourse,
    renderedLog:document.getElementById('course-debug-log-v87').textContent,regions:document.querySelectorAll('#season-course-v79 [data-zone-id]').length,
    averages:[...document.querySelectorAll('#season-course-v79 [data-zone-average]')].map(n=>n.textContent),clips:JSON.parse(document.getElementById('v68-measured-bat-library').textContent).clips.length,
    controls:KneekuraPresentationControlsV84.inspect(),overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.equal(result.version,87);assert.equal(result.error,null);assert.deepEqual(result.active,authored);assert.equal(result.regions,13);assert(result.averages.every(v=>v==='—'));assert.equal(result.clips,673);assert(!result.overflow);
  for(const role of ['batter','pitcher','catcher']){const d=result.recognition[role];assert.equal(d.role,role);assert(d.sourceTick<=d.observationTick);assert.equal(d.futureSourceUsed,false);assert.equal(d.edited,true);assert(d.perceivedPosition&&d.predictedPosition);assert(Number.isInteger(d.courseId)||d.courseId===null);}
  assert(result.actual?.position&&result.actual?.provenance);assert(result.renderedLog.includes('READ_ONLY_DEBUG'));assert.equal(result.controls.frequencyScale,2);assert.equal(result.controls.qualityScale,1.2);
  await p.locator('#course-debug-v87').evaluate(n=>n.open=true);await p.locator('#course-debug-v87').screenshot({path:resolve(out,`debug-${width}.png`)});
  report.cases.push({kind:'normal',width,allRoles:true,authoredImport:true,regions:13,clips:result.clips,actualProvenance:result.actual.provenance});assert.deepEqual(fault.errors,[]);assert.deepEqual(fault.external,[]);await p.close();
  const q=await browser.newPage({viewport:{width,height:1000}}),f=observe(q,'lab-'+width);await q.goto(pathToFileURL(lab).href,{timeout:60000});await q.waitForFunction(()=>globalThis.KneekuraCameraLab?.inspect().ready,undefined,{timeout:60000});
  const viewed=await q.evaluate(()=>{const api=KneekuraCameraLab,w=document.querySelector('iframe').contentWindow;api.nextPitch();api.pause();api.seek(1600);const state=api.inspect();return {error:state.error??null,version:w.liveMatchPlayback.inspect().version,recognition:!!w.KneekuraCourseDebugV87.inspect().recognition,A:state.A.sceneMs,B:state.B.sceneMs,controls:KneekuraPresentationControlsV84.inspect(),overflow:document.documentElement.scrollWidth>innerWidth};});
  assert.equal(viewed.version,87);assert(viewed.recognition);assert.equal(viewed.A,viewed.B);assert.equal(viewed.controls.qualityScale,1.2);assert(!viewed.overflow);assert.deepEqual(f.errors,[]);assert.deepEqual(f.external,[]);report.cases.push({kind:'lab',width,...viewed});await q.close();
 }
 for(const[k,p]of Object.entries(paths))assert.equal(sha(await readFile(p)),hashes[k]);report.pass=true;
}catch(error){report.error=String(error.stack??error);throw error;}
finally{await browser.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({pass:true,cases:report.cases.length,hashes}));
