import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [htmlArg,outArg]=process.argv.slice(2),html=resolve(htmlArg),out=resolve(outArg),sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:true});
const report={pass:false,normalSha256:sha(await readFile(html)),views:[],errors:[],requests:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-accelerated-2d-canvas']});
try{
 let prefix;
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:860},acceptDownloads:true});
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))report.requests.push(r.url());});
  await page.goto(pathToFileURL(html).href);await page.waitForFunction(()=>window.liveMatchPlayback);
  assert.equal(await page.evaluate(()=>liveMatchPlayback.inspect().legacyResultFallback),false);
  await page.evaluate(()=>{for(let i=0;i<8;i++){document.getElementById('next-pitch').click();liveMatchPlayback.stop();}});
  const signatures=await page.evaluate(async()=>{const rows=[];for(const r of liveMatchPlayback.inspect().host.history){const bytes=new TextEncoder().encode(JSON.stringify({frames:r.frames,play:r.play,events:r.events}));rows.push([...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join(''));}return rows;});
  if(prefix)assert.deepEqual(signatures,prefix,'desktop/mobile same actual simulation');else prefix=signatures;
  const row={width,prefixHashes:signatures};report.views.push(row);
  if(width===1200){
   await page.exposeFunction('v62Progress',n=>console.log(JSON.stringify({phase:'nine-inning-match',pitches:n})));
   const result=await page.evaluate(async()=>{const timer=setInterval(()=>window.v62Progress(liveMatchPlayback.inspect().generatedPitches),15000);try{await liveMatchPlayback.finish();const s=liveMatchPlayback.inspect();return{error:s.error,finished:s.host.finished,match:s.host.match,pitches:s.generatedPitches,legacyResultFallback:s.legacyResultFallback};}finally{clearInterval(timer);}});
   row.completed=result;assert.equal(result.error,null);assert.equal(result.finished,true);assert(result.match.inning>=9);assert.equal(result.legacyResultFallback,false);
   row.audit=await page.evaluate(()=>{const s=liveMatchPlayback.inspect(),rows=s.host.history.map((r,index)=>({index,classification:r.play.classification,before:r.beforeMatch,after:r.afterMatch,
    release:r.frames[0]?.ball?.position,releaseGeometry:r.play.diagnostics.releaseGeometry,
    rules:r.play.rules,field:r.play.field?{end:r.play.field.end,diagnostics:r.play.field.diagnostics}:null,
    opportunities:r.frames.filter(f=>f.defensiveOpportunity).map(f=>({tick:f.tick,cue:f.defensiveOpportunity,official:!!f.homeRunConfirmed})),
    frameCount:r.frames.length}));return{rows,players:s.physicalRoster.players.length,roster:s.physicalRoster.active,finished:s.host.finished};});
   assert.equal(row.audit.players,20);assert.equal(row.audit.rows.length,result.pitches);
   assert(row.audit.rows.some(r=>r.field),'real batted field play required');
   for(const r of row.audit.rows){assert(r.frameCount>0);for(const c of r.opportunities){assert(c.cue.observationTick<=c.cue.availableAtTick);assert(c.cue.availableAtTick<=c.tick);}}
   // Exercise the actual export path after regulation completion.
   const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export-game').click()]);
   const exported=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(exported.pitches.length,result.pitches);
   row.exportedPitches=exported.pitches.length;await writeFile(resolve(out,'normal-game-export.json'),JSON.stringify(exported)+'\n');
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:resolve(out,'game-'+width+'.png'),fullPage:true});await page.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);report.pass=true;
 console.log(JSON.stringify({pass:true,normalSha256:report.normalSha256,pitches:report.views[0].completed.pitches,match:report.views[0].completed.match,viewports:[1200,390]}));
}catch(error){report.error=String(error.stack??error);throw error;}
finally{await writeFile(resolve(out,'game-check.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
