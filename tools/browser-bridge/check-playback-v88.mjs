import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const file=resolve(process.argv[2]),out=resolve(process.argv[3]),sha=b=>createHash('sha256').update(b).digest('hex'),hash=sha(await readFile(file));await mkdir(out,{recursive:true});
const report={pass:false,file,artifactSha256:hash,cases:[],faults:[],scope:'40 ordinary pitches compared to frozen v87 with only the new replay descriptor removed from diagnostics; no physical/call/frame fields omitted. Sampled whiff tail and HR watch in actual HTML, PC/390px.'};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
async function open(path,width){const page=await browser.newPage({viewport:{width,height:900}}),f={path,width,errors:[],external:[]};report.faults.push(f);page.on('pageerror',e=>f.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))f.external.push(r.url());});await page.goto(pathToFileURL(path).href,{timeout:60000});await page.waitForFunction(()=>globalThis.liveMatchPlayback);return page;}
async function generate(page){for(let i=0;i<5;i++)await page.evaluate(()=>{for(let n=0;n<8;n++){document.getElementById('next-pitch').click();liveMatchPlayback.stop();if(liveMatchPlayback.inspect().error)throw Error(liveMatchPlayback.inspect().error);}});return page.evaluate(async()=>{const hashes=[];for(const record of liveMatchPlayback.inspect().host.history){const copy=structuredClone(record);delete copy.play.diagnostics.batPlaybackV88;hashes.push([...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(copy))))].map(b=>b.toString(16).padStart(2,'0')).join(''));}return hashes;});}
try{
 const old=await open(resolve('docs/demos/releases/v87/game.html'),1200),expected=await generate(old);await old.close();
 for(const width of [1200,390]){
  const page=await open(file,width),actual=await generate(page);assert.deepEqual(actual,expected,'all 40 physical/ruling/frame histories identical');
  const observation=await page.evaluate(()=>{
   const api=liveMatchPlayback,state=api.inspect(),prep=state.presentation.timing.preparationMs,records=state.host.history,before=JSON.stringify(records);
   const row=records.map((r,i)=>({r,i})).find(({r})=>r.play.call==='swinging_strike'&&!r.play.rules.halfChanged&&r.play.diagnostics.referenceThroughTick>r.frames.at(-1).tick);
   if(!row)throw Error('No whiff with a measured tail');const r=row.r,tps=r.play.diagnostics.sourceClockTicksPerSecond,last=r.frames.at(-1),endMs=prep+(last.tick-r.frames[0].tick)/tps*1000;
   document.getElementById('auto-overhead').checked=false;document.querySelector('[data-camera="batter"]').click();api.seekPitch(row.i);api.seekPresentationMs(endMs+55);const first=api.inspect();
   api.seekPresentationMs(endMs);api.seekPresentationMs(endMs+55);const reverse=api.inspect();api.seekPresentationMs(endMs+1600);const completed=api.inspect();
   const swing={pitch:row.i+1,lastTick:last.tick,throughTick:r.play.diagnostics.referenceThroughTick,tipBefore:last.bat.tip,
    follow:first.whiffFollowThrough,reverse:reverse.whiffFollowThrough,completed:completed.whiffFollowThrough,
    ballHidden:first.currentFrame.ball.visible===false,custody:first.currentFrame.possessedBy};
   const hr=records.map((r,i)=>({r,i})).find(({r})=>r.play.classification==='home_run'&&r.play.field?.ruleFacts.overFence);if(!hr)throw Error('No observed HR');
   const f=hr.r.play.field.ruleFacts.overFence,start=prep+(f.tick-hr.r.frames[0].tick)/hr.r.play.diagnostics.sourceClockTicksPerSecond*1000,views=[];
   for(const camera of ['mound']){document.querySelector('[data-camera="'+camera+'"]').click();api.seekPitch(hr.i);api.seekPresentationMs(start+100);const s=api.inspect(),w=s.homeRunWatch;if(!w)throw Error('No watch for '+camera);
    api.seekPresentationMs(w.untilMs-.01);const near=api.inspect();api.seekPresentationMs(w.untilMs);const after=api.inspect();api.seekPresentationMs(start+100);const revisited=api.inspect();
    views.push({selected:camera,camera:s.rendered.camera,watch:w,nearCamera:near.rendered.camera,nearActive:!!near.homeRunWatch,afterWatch:after.homeRunWatch,revisited:revisited.homeRunWatch});}
   const third=records.map((r,i)=>({r,i})).find(({r})=>r.play.call==='swinging_strike'&&r.frames.some(f=>f.phase==='bench'));let bench=null;
   if(third){const frame=third.r.frames.find(f=>f.phase==='bench');api.seekPitch(third.i);api.seekPresentationMs(prep+(frame.tick-third.r.frames[0].tick)/third.r.play.diagnostics.sourceClockTicksPerSecond*1000+20);bench=api.inspect().whiffFollowThrough;}
   if(before!==JSON.stringify(api.inspect().host.history))throw Error('Playback altered canonical history');return {swing,hr:{pitch:hr.i+1,views},bench,historyUnchanged:true};
  });
  const s=observation.swing;assert(s.follow?.bat);assert.equal(s.follow.sampleTick,s.throughTick);assert.deepEqual(s.follow,s.reverse);
  assert(Math.hypot(...['x','y','z'].map(k=>s.follow.bat.tip[k]-s.tipBefore[k]))>.05);assert.equal(s.completed.bat,null);assert(s.ballHidden&&s.custody);
  for(const v of observation.hr.views){assert(v.watch.holdMs>=1500&&v.watch.holdMs<=2000);assert(v.nearActive);assert.equal(v.nearCamera,v.camera);assert.equal(v.afterWatch,null);assert.deepEqual(v.revisited,v.watch);}
  if(observation.bench)assert.equal(observation.bench.bat,null);
  report.cases.push({width,...observation,normalizedHistorySha256:sha(JSON.stringify(actual))});await page.screenshot({path:resolve(out,'playback-'+width+'.png')});await page.close();
 }
 for(const f of report.faults){assert.deepEqual(f.errors,[]);assert.deepEqual(f.external,[]);}assert.equal(sha(await readFile(file)),hash);report.pass=true;
}catch(error){report.error=String(error.stack??error);throw error;}
finally{await browser.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({pass:true,cases:report.cases.length,artifactSha256:hash}));
