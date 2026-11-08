import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const artifact=resolve(process.argv[2]),out=resolve(process.argv[3]),baseline=process.argv[4]?JSON.parse(await readFile(process.argv[4])):null,sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:true});const report={pass:false,artifact,sha256:sha(await readFile(artifact)),cases:[],faults:[]};let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),fault={width,errors:[],external:[]};report.faults.push(fault);page.on('pageerror',e=>fault.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))fault.external.push(r.url());});
  await page.goto(pathToFileURL(artifact).href,{timeout:60000});await page.waitForFunction(()=>globalThis.KneekuraCameraLab?.inspect().ready,undefined,{timeout:60000});
  const observations=await page.evaluate(async()=>{
   const api=KneekuraCameraLab,w=document.querySelector('iframe').contentWindow,digest=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join(''),json=async v=>digest(new TextEncoder().encode(JSON.stringify(v)));
   api.nextPitch();api.pause();const history=await json(w.liveMatchPlayback.inspect().host.history),captures=[];
   for(const camera of ['batter','mound','catcher','runner','overhead']){api.setCamera(camera);for(const ms of [0,1100,1620,1740,1880,2400]){api.seek(ms);const s=api.inspect(),hashes={};for(const id of ['view-A','view-B','pitch-view-A','pitch-view-B']){const c=document.getElementById(id);hashes[id]=await digest(c.getContext('2d').getImageData(0,0,c.width,c.height).data);}captures.push({camera,ms,A:{sceneMs:s.A.sceneMs,tick:s.A.tick,pitch:s.A.pitch,yaw:s.A.yaw},B:{sceneMs:s.B.sceneMs,tick:s.B.tick,pitch:s.B.pitch,yaw:s.B.yaw},hashes});}}
   const settings=api.exportSettings(),session=api.exportSession();api.importSettings(settings);await api.importSession(session);if(JSON.stringify(settings)!==JSON.stringify(api.exportSettings()))throw Error('settings roundtrip differs');if(history!==await json(w.liveMatchPlayback.inspect().host.history))throw Error('session history differs');if(w.liveMatchSeasonsV79.inspect().recordingEnabled)throw Error('lab records seasons');
   return {history,captures,overflow:document.documentElement.scrollWidth>innerWidth,settingsRoundTrip:true,sessionRoundTrip:true,seasonRecordingDisabled:true};
  });
  if(baseline)assert.deepEqual(observations,baseline.cases.find(c=>c.width===width).observations,'lab pixels/source '+width);assert(!observations.overflow);
  const cadence=await page.evaluate(async()=>{const a=KneekuraCameraLab;a.seek(1200);a.play();await new Promise(r=>setTimeout(r,500));const s=a.inspect();a.pause();return {cadence:s.cadence,A:s.A.sceneMs,B:s.B.sceneMs};});assert.equal(cadence.A,cadence.B);
  report.cases.push({width,observations,cadence});assert.deepEqual(fault.errors,[]);assert.deepEqual(fault.external,[]);await page.screenshot({path:resolve(out,'lab-'+width+'.png')});await page.close();console.log(JSON.stringify({width,captures:observations.captures.length,compared:!!baseline}));
 }
 assert.equal(sha(await readFile(artifact)),report.sha256);report.pass=true;
}catch(e){report.error=String(e.stack??e);throw e;}finally{await browser?.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
