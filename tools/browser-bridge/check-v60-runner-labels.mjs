import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [normalArg,labArg,evidenceArg]=process.argv.slice(2),normal=resolve(normalArg),workbench=resolve(labArg),evidence=resolve(evidenceArg),sha=v=>createHash('sha256').update(v).digest('hex');
const report={pass:false,normalSha256:sha(await readFile(normal)),workbenchSha256:sha(await readFile(workbench)),views:[]};let browser;
try{
 await mkdir(evidence,{recursive:true});browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 for(const width of [1200,390]){const p=await browser.newPage({viewport:{width,height:860}}),faults=[];p.on('pageerror',e=>faults.push(String(e)));await p.goto(pathToFileURL(normal).href);await p.waitForFunction(()=>window.liveMatchPlayback);
  const result=await p.evaluate(async()=>{
   const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(n=>n.toString(16).padStart(2,'0')).join('');
   document.getElementById('auto-overhead').checked=false;document.getElementById('auto-overhead').dispatchEvent(new Event('change'));document.getElementById('next-pitch').click();liveMatchPlayback.stop();
   const initial=liveMatchPlayback.inspect(),record=initial.host.history[0],sourceBefore=await hash(record),firstRun=record.frames.find(f=>f.actors.some(a=>a.role==='runner'));if(!firstRun)throw Error('fixture needs actual Core runner frame');
   document.querySelector('[data-camera="overhead"]').click();liveMatchPlayback.seekPitch(0);const ms=initial.presentation.timing.preparationMs+(firstRun.tick-record.frames[0].tick)/record.play.diagnostics.sourceClockTicksPerSecond*1000+500;liveMatchPlayback.seekPresentationMs(ms);
   const labels=[...document.getElementById('actor-labels').children].map(el=>({id:el.dataset.actor,role:el.dataset.role,color:getComputedStyle(el).color,z:Number(getComputedStyle(el).zIndex),name:el.textContent}));
   return{ms,labels,sourceBefore,sourceAfter:await hash(liveMatchPlayback.inspect().host.history[0]),sourceTick:liveMatchPlayback.inspect().currentFrame.tick};
  });
  const runners=result.labels.filter(el=>el.role==='runner'),fielders=result.labels.filter(el=>el.role!=='runner');assert(runners.length>0,'actual moving runner label must be present');assert(fielders.length>0,'defensive labels must also be present');
  for(const runner of runners){assert.equal(runner.color,'rgb(255, 119, 119)');assert.equal(runner.z,3);assert(result.labels.indexOf(runner)>Math.max(...fielders.map(f=>result.labels.indexOf(f))),'runner is appended after defenders');assert(fielders.every(f=>f.z<runner.z),'runner name stacking priority exceeds all defenders');}
  assert(runners.some(r=>r.id==='BAT'),'batter becomes a named red runner after running starts');assert.equal(result.sourceBefore,result.sourceAfter);assert.deepEqual(faults,[]);report.views.push({width,...result});await p.close();
 }
 assert.equal(sha(await readFile(normal)),report.normalSha256);assert.equal(sha(await readFile(workbench)),report.workbenchSha256);report.pass=true;console.log(JSON.stringify({pass:true,normalSha256:report.normalSha256,workbenchSha256:report.workbenchSha256,widths:[1200,390],actualRunnerLabels:report.views.map(v=>v.labels.filter(l=>l.role==='runner').length)}));
}catch(error){report.error=String(error.stack??error);throw error;}
finally{await writeFile(resolve(evidence,'runner-labels-check.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();}
