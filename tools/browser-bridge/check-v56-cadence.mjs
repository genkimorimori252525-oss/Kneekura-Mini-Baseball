import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'),
 [normalArg='../../outputs/ばせぼーるlv56_TBD_vs_LAD_投球描画と追従調整版.html',labArg='../../outputs/カメラワーク調整室_v56.html',evidenceArg='../../outputs/verification-v56-cadence']=process.argv.slice(2),
 normal=resolve(normalArg),lab=resolve(labArg),evidence=resolve(evidenceArg),sha=b=>createHash('sha256').update(b).digest('hex'),
 normalBytes=await readFile(normal),labBytes=await readFile(lab),native=await readFile('dist/native-match-core-browser.js'),
 pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
assert.equal(sha(native),pins.entrySha256);assert(normalBytes.includes(native),'normal embeds unchanged native Core');
for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,path);
await mkdir(evidence,{recursive:true});
try{const prior=await readFile(resolve(evidence,'cadence-check.json'));await writeFile(resolve(evidence,'cadence-check-prior-'+sha(prior).slice(0,16)+'.json'),prior,{flag:'wx'});}
catch(error){if(!['ENOENT','EEXIST'].includes(error.code))throw error;}
const report={pass:false,normalSha256:sha(normalBytes),workbenchSha256:sha(labBytes),sourceCoreSha256:sha(native),sourceInputs:Object.keys(pins.inputs).length,
 actual:null,mockmetrics:{},loop:[],faults:[]},browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
function instrument(page,label){const fault={label,errors:[],requests:[]};report.faults.push(fault);
 page.on('pageerror',e=>fault.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:)/.test(r.url()))fault.requests.push(r.url());});}
async function mockClock(page){await page.addInitScript(()=>{
 let now=0,next=1;const queued=new Map();
 Object.defineProperty(performance,'now',{value:()=>now,configurable:true});
 window.requestAnimationFrame=callback=>{const id=next++;queued.set(id,callback);return id;};window.cancelAnimationFrame=id=>queued.delete(id);
 window.__cadenceClock={advance(value){if(!Number.isFinite(value)||value<now)throw Error('nonmonotonic test clock');now=value;
  const callbacks=[...queued.values()];queued.clear();for(const callback of callbacks)callback(now);return queued.size;},now:()=>now};
 });}
const delta=(after,before)=>Object.fromEntries(['sceneDraws','pitchBallSamples','pitchBallPaints','nonPitchFastPaints'].map(k=>[k,after[k]-before[k]]));
async function setupNormal(page){await page.goto(pathToFileURL(normal).href);await page.waitForFunction(()=>{
 const c=window.liveMatchPlayback?.inspect().presentation?.cadence;return c?.sceneMs===55&&c.pitchBallMs===22;});
 return page.evaluate(()=>{document.getElementById('match-seed').value='v56-cadence';document.getElementById('fixed-seed').checked=true;
  document.getElementById('batting-choice').value='take';window.liveMatchPlayback.newGame();document.getElementById('next-pitch').click();window.liveMatchPlayback.stop();
  const s=window.liveMatchPlayback.inspect();if(s.error)throw Error(s.error);return {prep:s.presentation.timing.preparationMs,cut:s.lastResult.play.diagnostics.catcherContactElapsedSeconds};});}
async function setupLab(page){await page.goto(pathToFileURL(lab).href);await page.waitForFunction(()=>window.KneekuraCameraLab?.inspect().ready);
 return page.evaluate(()=>{const api=window.KneekuraCameraLab;api.newGame({seed:'v56-cadence',innings:9});document.getElementById('cmd-batting-choice').value='take';api.nextPitch();api.setPlayMode('pause');
  const w=document.getElementById('match-engine').contentWindow,s=w.liveMatchPlayback.inspect();if(s.error)throw Error(s.error);
  return {prep:s.presentation.timing.preparationMs,cut:s.lastResult.play.diagnostics.catcherContactElapsedSeconds};});}
function assertCadence(c,label){assert.equal(c.sceneDraws,18,label+' carries 55 ms deadlines across 60 Hz frames');
 assert.equal(c.pitchBallSamples,45,label+' carries 22 ms deadlines across 60 Hz frames');assert.equal(c.pitchBallSamples/c.sceneDraws,2.5,label+' average schedule ratio');
 assert.equal(c.nonPitchFastPaints,0);assert(c.pitchBallPaints>0);}
try{
 const normalPage=await browser.newPage({viewport:{width:1200,height:860}});instrument(normalPage,'normal-mock-60Hz');await mockClock(normalPage);
 const layout=await setupNormal(normalPage);assert(layout.cut>.30,'one second at quarter speed fits within free pitch');
 const measured=await normalPage.evaluate(({prep})=>{const api=window.liveMatchPlayback;api.seekPresentationMs(prep+25);document.getElementById('speed').value='0.25';api.play();
  const before=api.inspect().presentation.cadence;for(let i=1;i<=60;i++)window.__cadenceClock.advance(i*1000/60);
  const s=api.inspect();return {before,after:s.presentation.cadence,ms:s.presentation.elapsedMs,eligible:s.presentation.fastPitchEligible,error:s.error};},layout);
 assert.equal(measured.error,null);assert(measured.eligible);report.mockmetrics.normal={...delta(measured.after,measured.before),frames:60,wallMs:1000,physicalElapsedMs:measured.ms-layout.prep};
 assertCadence(report.mockmetrics.normal,'normal');
 const normalQuiet=await normalPage.evaluate(({prep,cut})=>{const api=window.liveMatchPlayback;api.stop();api.seekPresentationMs(prep+cut*1000+100);
  document.getElementById('speed').value='1';api.play();const before=api.inspect().presentation.cadence,start=window.__cadenceClock.now();
  for(let i=1;i<=12;i++)window.__cadenceClock.advance(start+i*1000/60);const s=api.inspect();api.stop();
  return {before,after:s.presentation.cadence,eligible:s.presentation.fastPitchEligible,error:s.error};},layout);
 assert.equal(normalQuiet.error,null);assert.equal(normalQuiet.eligible,false);assert.equal(delta(normalQuiet.after,normalQuiet.before).pitchBallSamples,0,'normal glove retention/held uses ordinary cadence');
 report.mockmetrics.normalNonPitch=delta(normalQuiet.after,normalQuiet.before);assert.equal(report.mockmetrics.normalNonPitch.nonPitchFastPaints,0);

 const labPage=await browser.newPage({viewport:{width:1200,height:860}});instrument(labPage,'lab-mock-60Hz');await mockClock(labPage);const labLayout=await setupLab(labPage);
 const labMeasured=await labPage.evaluate(({prep})=>{const api=window.KneekuraCameraLab;api.setSpeed(.25);api.seek(prep+25);api.play();const before=api.inspect().cadence;
  for(let i=1;i<=60;i++)window.__cadenceClock.advance(i*1000/60);const s=api.inspect();return {before,after:s.cadence,error:s.error};},labLayout);
 assert.equal(labMeasured.error,null);report.mockmetrics.lab={...delta(labMeasured.after,labMeasured.before),frames:60,wallMs:1000};assertCadence(report.mockmetrics.lab,'lab');
 const loop=await labPage.evaluate(async({prep,cut})=>{const api=window.KneekuraCameraLab,w=document.getElementById('match-engine').contentWindow,rows=[];
  api.pause();api.setSpeed(1);api.setPlayMode('loop');const start=prep+Math.min(250,cut*1000-160),end=start+100;api.setLoop(start,end);api.seek(start);api.play();
  const wall=window.__cadenceClock.now();let lastMs=api.inspect().sceneMs;
  const digest=async canvas=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data))].map(x=>x.toString(16).padStart(2,'0')).join('');
  for(let i=1;i<=22;i++){window.__cadenceClock.advance(wall+i*1000/60);const s=api.inspect();
   if(s.sceneMs<lastMs){const physical=w.liveMatchPlayback.observePitchBallAtPresentationMs(start);if(!physical)throw Error('loop start is not a free pitch');
    const row={at:s.sceneMs,start,end,A:{},B:{}};
    for(const side of ['A','B']){const actual=s[side].fastBall,expected=w.liveMatchPlayback.paintLivePitchBall(physical,s[side].projection).ballDotDisplay;
     row[side]={actual,expected,actualLayer:await digest(document.getElementById('pitch-view-'+side)),expectedLayer:await digest(w.document.getElementById('ball-overlay'))};}
    rows.push(row);
   }lastMs=s.sceneMs;
  }api.pause();return rows;},labLayout);
 assert(loop.length>=2,'short interval actually rewound at least twice');
 for(const row of loop){assert.equal(row.at,row.start,'inspect sees exact loop start');for(const side of ['A','B']){
  assert(row[side].actual&&row[side].expected,'visible ball on each loop observer');assert.deepEqual(row[side].actual,row[side].expected,'loop start uses its own Source ball and camera projection');
  assert.equal(row[side].actualLayer,row[side].expectedLayer,'loop start layer has no prior endpoint ghost');
 }}report.loop=loop;
 const labQuiet=await labPage.evaluate(({prep,cut})=>{const api=window.KneekuraCameraLab;api.setPlayMode('pause');api.seek(prep+cut*1000+100);api.play();
  const before=api.inspect().cadence,wall=window.__cadenceClock.now();for(let i=1;i<=12;i++)window.__cadenceClock.advance(wall+i*1000/60);
  const s=api.inspect(),nonempty=['A','B'].some(side=>{const c=document.getElementById('pitch-view-'+side),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   for(let i=3;i<d.length;i+=4)if(d[i])return true;return false;});api.pause();return {before,after:s.cadence,error:s.error,nonempty};},labLayout);
 assert.equal(labQuiet.error,null);assert.equal(labQuiet.nonempty,false,'no fast pitch layer after glove contact');report.mockmetrics.labNonPitch=delta(labQuiet.after,labQuiet.before);
 assert.equal(report.mockmetrics.labNonPitch.pitchBallSamples,0);assert.equal(report.mockmetrics.labNonPitch.nonPitchFastPaints,0);

 // Native rAF is observational evidence only; device scheduling is not an
 // assertion that every display can sustain the configured target cadence.
 const actualPage=await browser.newPage({viewport:{width:1200,height:860}});instrument(actualPage,'normal-native-rAF');const actualLayout=await setupNormal(actualPage);
 const actualBefore=await actualPage.evaluate(({prep})=>{const api=window.liveMatchPlayback;api.seekPresentationMs(prep+10);document.getElementById('speed').value='0.25';api.play();
  return {wall:performance.now(),cadence:api.inspect().presentation.cadence};},actualLayout);
 await actualPage.waitForTimeout(800);
 const actualAfter=await actualPage.evaluate(()=>{const api=window.liveMatchPlayback,s=api.inspect();api.stop();return {wall:performance.now(),cadence:s.presentation.cadence,error:s.error};});
 assert.equal(actualAfter.error,null);report.actual={...delta(actualAfter.cadence,actualBefore.cadence),wallMs:actualAfter.wall-actualBefore.wall,
  interpretation:'native device sample; strict deadline ratio is proven by the separate mock 60 Hz test'};assert.equal(report.actual.nonPitchFastPaints,0);
 for(const fault of report.faults){assert.deepEqual(fault.errors,[]);assert.deepEqual(fault.requests,[]);}report.pass=true;
 console.log(JSON.stringify({pass:true,normalSha256:report.normalSha256,workbenchSha256:report.workbenchSha256,mockmetrics:report.mockmetrics,loopRewinds:loop.length,actual:report.actual}));
}catch(error){report.error=String(error.stack??error);throw error;}
finally{await writeFile(resolve(evidence,'cadence-check.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
