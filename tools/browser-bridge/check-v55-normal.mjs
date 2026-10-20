import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [htmlArg,evidenceArg]=process.argv.slice(2);if(!htmlArg||!evidenceArg)throw Error('requires normal HTML and NEW evidence directory');
const artifact=resolve(htmlArg),evidence=resolve(evidenceArg),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
await mkdir(evidence,{recursive:false});
const baseline=resolve('docs/demos/releases/v54/game.html'),oldBytes=await readFile(baseline),newBytes=await readFile(artifact),native=await readFile('dist/native-match-core-browser.js'),
 pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
assert.equal(sha(oldBytes),'80c68e3ddb5c961ab6f18b325c6f267f883cd02d27381dfa10a9334bf8afae9f');assert(oldBytes.includes(native)&&newBytes.includes(native));
for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,path);
const report={artifact,sha256:sha(newBytes),sourceCoreSha256:sha(native),sourceInputs:Object.keys(pins.inputs).length,views:[],faults:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
function instrument(page,label){const fault={label,errors:[],requests:[]};report.faults.push(fault);page.on('pageerror',e=>fault.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:)/.test(r.url()))fault.requests.push(r.url());});}
async function setup(page,path){await page.goto(pathToFileURL(path).href);await page.evaluate(()=>document.fonts.ready);await page.locator('details.settings>summary').click();await page.locator('#fixed-seed').check();
 await page.evaluate(()=>{for(let i=0;i<12;i++)document.getElementById('next-pitch').click();window.liveMatchPlayback.stop();const s=window.liveMatchPlayback.inspect();if(s.error)throw Error(s.error);});}
const select=(page,camera)=>page.evaluate(camera=>{document.querySelector('[data-camera="'+camera+'"]').click();document.getElementById('auto-overhead').checked=false;document.getElementById('auto-overhead').dispatchEvent(new Event('change'));},camera);
const seek=(page,pitch,ms)=>page.evaluate(({pitch,ms})=>{window.liveMatchPlayback.seekPitch(pitch);window.liveMatchPlayback.seekPresentationMs(ms);},{pitch,ms});
const read=page=>page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return {camera:s.rendered.camera,eye:s.rendered.cameraEye,yaw:s.rendered.cameraYaw,pitch:s.rendered.cameraPitch,
 view:s.presentation.continuousBatterView,bat:s.currentFrame.bat,ball:s.rendered.ballDotDisplay,held:s.currentFrame.possessedBy,grid:s.rendered.gridAligned,ms:s.presentation.elapsedMs};});
const pose=s=>({camera:s.camera,eye:s.eye,yaw:s.yaw,pitch:s.pitch});
async function hashes(page){return page.evaluate(async()=>{const out=[];for(const r of window.liveMatchPlayback.inspect().host.history){const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(x=>x.toString(16).padStart(2,'0')).join('');
 out.push({core:await digest({frames:r.frames,play:r.play,events:r.events,match:r.match}),bat:await digest(r.frames.filter(f=>f.bat).map(f=>({tick:f.tick,bat:f.bat})))});}return out;});}
try{
 const old=await browser.newPage({viewport:{width:1200,height:860}});instrument(old,'v54-control');await setup(old,baseline);const expected=await hashes(old);
 for(const width of [1200,390]){
  await old.setViewportSize({width,height:860});const page=await browser.newPage({viewport:{width,height:860}});instrument(page,'v55-'+width);await setup(page,artifact);
  assert.deepEqual(await hashes(page),expected,'new camera cannot alter current Core or measured bat');
  const coverage=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect(),out={sides:{},held:null},prep=s.presentation.timing.preparationMs;
   for(const [i,r]of s.host.history.entries()){const d=r.play.diagnostics,ms=t=>prep+(t-r.frames[0].tick)/(d.sourceClockTicksPerSecond??1e6)*1000;
    if(d.swingOffered&&r.frames.some(f=>f.ballKind==='batted'))out.sides[d.battingSide]??={pitch:i,contact:ms(r.frames.find(f=>f.ballKind==='batted').tick),through:ms(d.referenceThroughTick)};
    if(!d.swingOffered){const f=r.frames.find(f=>f.possessedBy);if(f)out.held??={pitch:i,ms:ms(f.tick)+1};}
   }return out;});assert(coverage.sides.R&&coverage.sides.L&&coverage.held,'actual L/R hits and taken held ball');
  const view={width,coverage,swingSamples:[],otherCameras:[],earlierTracking:0};report.views.push(view);
  await select(page,'batter');await select(old,'batter');
  for(const candidate of Object.values(coverage.sides)){
   for(const ms of [0,candidate.contact-100,candidate.contact,candidate.through+60,candidate.through+280]){
    await seek(page,candidate.pitch,ms);await seek(old,candidate.pitch,ms);const a=await read(old),b=await read(page);
    assert.deepEqual(b.eye,a.eye,'one existing embodied eye');assert.deepEqual(b.bat,a.bat,'measured bat unchanged');assert(b.grid,'4px raster');
    if(ms===0)assert.deepEqual(pose(b),pose(a),'ready pose preserved');
    if(b.view.tuning.aimTarget&&a.view.aimWeight>0){const r=await page.evaluate(()=>window.liveMatchPlayback.inspect().lastResult.play.diagnostics),y=r.zoneJudgment.observedForecastPosition.y+r.aimErrorMeters.y;
     assert(Math.abs(b.view.tuning.aimTarget.y-y-.3)<1e-9,'gaze target is above planned contact');}
    if(b.view.aimWeight>0)assert(b.view.regulation.targetPitch<=.3+1e-9,'swing objective does not bow toward ground');
    view.swingSamples.push({ms,oldPitch:a.pitch,newPitch:b.pitch,oldWeight:a.view.aimWeight,newWeight:b.view.aimWeight});
   }
   for(let ms=candidate.contact;ms<=candidate.through+180;ms+=20){await seek(page,candidate.pitch,ms);await seek(old,candidate.pitch,ms);const a=await read(old),b=await read(page);
    if(a.view.aimWeight>0&&b.view.aimWeight===0){view.earlierTracking++;break;}}
  }
  assert(view.earlierTracking>0,'actual hits enter tracking earlier');
  for(const camera of ['mound','catcher','runner','overhead']){await select(page,camera);await select(old,camera);
   for(const ms of [coverage.sides.R.contact+100,coverage.sides.R.through+700]){await seek(page,coverage.sides.R.pitch,ms);await seek(old,coverage.sides.R.pitch,ms);
    const a=await read(old),b=await read(page);assert.deepEqual(pose(b),pose(a),camera+' pose preserved');assert.deepEqual(b.bat,a.bat);view.otherCameras.push({camera,ms});}}
  for(const camera of ['batter','mound','catcher','runner','overhead']){await select(page,camera);await seek(page,coverage.held.pitch,coverage.held.ms);const s=await read(page);assert(s.held);assert.equal(s.ball,null,'held ball hidden');}
  await select(page,'batter');await seek(page,coverage.sides.R.pitch,coverage.sides.R.through+60);await page.locator('#field').screenshot({path:resolve(evidence,'normal-batter-'+width+'.png')});
  assert.equal(await page.locator('footer>span').textContent(),'4px / 中継55ms / オフラインCore');assert.deepEqual(await hashes(page),expected);await page.close();
 }
 for(const fault of report.faults){assert.deepEqual(fault.errors,[]);assert.deepEqual(fault.requests,[]);}report.pass=true;
 console.log(JSON.stringify({pass:true,pitches:expected.length,widths:report.views.map(v=>v.width),sourceInputs:report.sourceInputs,earlierTracking:report.views.map(v=>v.earlierTracking)}));
}catch(error){report.pass=false;report.error=String(error.stack??error);throw error;}
finally{await writeFile(resolve(evidence,'normal-check.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
