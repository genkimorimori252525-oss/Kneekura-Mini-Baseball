import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'),
 normal=resolve(process.argv[2]??'../../outputs/ばせぼーるlv74_TBD_vs_LAD_用具と能力上限拡張版.html'),
 lab=resolve(process.argv[3]??'../../outputs/カメラワーク調整室_v74.html'),evidence=resolve(process.argv[4]??'docs/verification/releases/v74/default-prefix'),
 sha=x=>createHash('sha256').update(x).digest('hex'),report={pass:false,phase:'load',faults:[],views:[]};
let browser;
const instrument=(page,label)=>{const item={label,errors:[],external:[]};report.faults.push(item);page.on('pageerror',e=>item.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))item.external.push(r.url());});};
const open=async(page,path,workbench=false)=>{await page.goto(pathToFileURL(path).href,{timeout:60000});await page.waitForFunction(workbench=>workbench?window.KneekuraCameraLab?.inspect().ready:window.liveMatchPlayback,workbench,{timeout:60000});};
const history=page=>page.evaluate(()=>liveMatchPlayback.inspect().host.history);
const generate=async(page,count=6)=>page.evaluate(count=>{const a=document.getElementById('auto-overhead');a.checked=false;a.dispatchEvent(new Event('change'));for(let i=0;i<count;i++){document.getElementById('next-pitch').click();liveMatchPlayback.stop();const s=liveMatchPlayback.inspect();if(s.error)throw Error(s.error);}},count);
const loadRoster=async(page,roster)=>{await page.locator('#physical-roster-status').evaluate(e=>delete e.dataset.error);await page.locator('#physical-roster-file').setInputFiles({name:'v68-roster.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(roster))});await page.waitForFunction(()=>document.getElementById('physical-roster-status').dataset.error!==undefined);return page.locator('#physical-roster-status').evaluate(e=>({error:e.dataset.error,message:e.textContent}));};
try{
 await mkdir(evidence,{recursive:true});report.normalSha256=sha(await readFile(normal));report.workbenchSha256=sha(await readFile(lab));
 const metadata=JSON.parse(await readFile(normal+'.build.json','utf8')),pins=JSON.parse(await readFile(normal+'.bundle-inputs.json','utf8'));
 assert.equal(metadata.sha256,report.normalSha256);assert.equal(metadata.sourceCoreSha256,pins.entrySha256);assert.notEqual(pins.entrySha256,'865078dc9881ce5c37754dbe2c7b502f586206f3ada972cfe2d3368207720c00');
 for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,'pinned source '+path);
 assert.equal(metadata.measuredBatLibrary.trials,673);assert.deepEqual(metadata.compatibleSessionCoreSha256,[]);assert.equal(metadata.ordinaryCadenceMs,55);assert.equal(metadata.pitchBallCadenceMs,22);
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-accelerated-2d-canvas']});
 report.phase='frozen-v67';const old=await browser.newPage({viewport:{width:1200,height:860}});instrument(old,'frozen67');await open(old,resolve('docs/demos/releases/v73/game.html'));await generate(old);
 const baseline=await history(old),oldRoster=await old.evaluate(()=>liveMatchPlayback.inspect().physicalRoster.active),oldSettings=await old.evaluate(()=>({ball:liveMatchPlayback.inspect().presentation.ballDisplay,name:liveMatchPlayback.inspect().presentation.nameDisplay,timing:liveMatchPlayback.inspect().presentation.timing}));
 report.baseline={records:baseline.length,sourceSha256:sha(JSON.stringify(baseline))};await old.close();
 const context=await browser.newContext({viewport:{width:1200,height:860}}),page=await context.newPage();instrument(page,'normal68-1200');report.phase='normal-initial';await open(page,normal);await generate(page);
 const records=await history(page);assert.equal(records.length,baseline.length);assert.deepEqual(records,baseline,'default v68 preserves all actual Source/bat/rule records from v67');
 assert.deepEqual(await page.evaluate(()=>({ball:liveMatchPlayback.inspect().presentation.ballDisplay,name:liveMatchPlayback.inspect().presentation.nameDisplay,timing:liveMatchPlayback.inspect().presentation.timing})),oldSettings);
 const initial=await page.evaluate(()=>{const s=liveMatchPlayback.inspect(),data=KneekuraMeasuredBatLibrary.decode(document.getElementById('v68-measured-bat-library').textContent);return{count:data.clips.length,defaults:data.clips.filter(c=>c.defaultSelection).map(c=>c.id),players:s.physicalRoster.players.map(p=>({id:p.playerId,side:p.bats})),pending:s.physicalRoster.pending,lead:s.host.history[0].batterPlayerId,forms:data.clips.map(c=>({id:c.id,side:c.side,defaultSelection:c.defaultSelection})),error:s.error};});
 assert.equal(initial.count,673);assert.equal(initial.defaults.length,12);assert.equal(initial.error,null);assert.deepEqual(initial.pending,oldRoster);
 report.catalog={trials:initial.count,automaticChoices:initial.defaults,expandedChoices:661};
 for(const f of report.faults){assert.deepEqual(f.errors,[]);assert.deepEqual(f.external,[]);}
 report.defaultPrefix={actualRecords:records.length,sourceBatRulesExact:true,initialRosterSame:true,presentationSame:true};report.pass=true;report.phase='complete';console.log(JSON.stringify({pass:true,records:records.length}));
}catch(error){report.error=String(error.stack??error);await writeFile(resolve(evidence,'failure-'+Date.now()+'.json'),JSON.stringify(report,null,2)+'\n');console.error(String(error));process.exitCode=1;}finally{if(browser)await browser.close();await writeFile(resolve(evidence,'default-check.json'),JSON.stringify(report,null,2)+'\n');}
