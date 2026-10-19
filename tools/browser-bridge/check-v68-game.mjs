import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'),
 normal=resolve(process.argv[2]??'../../outputs/ばせぼーるlv68_TBD_vs_LAD_弾道と実測フォーム接続版.html'),
 lab=resolve(process.argv[3]??'../../outputs/カメラワーク調整室_v68.html'),evidence=resolve(process.argv[4]??'docs/verification/releases/v68/game'),
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
 report.phase='frozen-v67';const old=await browser.newPage({viewport:{width:1200,height:860}});instrument(old,'frozen67');await open(old,resolve('docs/demos/releases/v67/game.html'));await generate(old);
 const baseline=await history(old),oldRoster=await old.evaluate(()=>liveMatchPlayback.inspect().physicalRoster.active),oldSettings=await old.evaluate(()=>({ball:liveMatchPlayback.inspect().presentation.ballDisplay,name:liveMatchPlayback.inspect().presentation.nameDisplay,timing:liveMatchPlayback.inspect().presentation.timing}));
 report.baseline={records:baseline.length,sourceSha256:sha(JSON.stringify(baseline))};await old.close();
 const context=await browser.newContext({viewport:{width:1200,height:860}}),page=await context.newPage();instrument(page,'normal68-1200');report.phase='normal-initial';await open(page,normal);await generate(page);
 const records=await history(page);assert.equal(records.length,baseline.length);assert.deepEqual(records,baseline,'default v68 preserves all actual Source/bat/rule records from v67');
 assert.deepEqual(await page.evaluate(()=>({ball:liveMatchPlayback.inspect().presentation.ballDisplay,name:liveMatchPlayback.inspect().presentation.nameDisplay,timing:liveMatchPlayback.inspect().presentation.timing})),oldSettings);
 const initial=await page.evaluate(()=>{const s=liveMatchPlayback.inspect(),data=KneekuraMeasuredBatLibrary.decode(document.getElementById('v68-measured-bat-library').textContent);return{count:data.clips.length,defaults:data.clips.filter(c=>c.defaultSelection).map(c=>c.id),players:s.physicalRoster.players.map(p=>({id:p.playerId,side:p.bats})),pending:s.physicalRoster.pending,lead:s.host.history[0].batterPlayerId,forms:data.clips.map(c=>({id:c.id,side:c.side,defaultSelection:c.defaultSelection})),error:s.error};});
 assert.equal(initial.count,673);assert.equal(initial.defaults.length,12);assert.equal(initial.error,null);assert.deepEqual(initial.pending,oldRoster);
 report.catalog={trials:initial.count,automaticChoices:initial.defaults,expandedChoices:661};
 const lead=initial.players.find(p=>p.id===initial.lead),extra=initial.forms.find(c=>c.side===lead.side&&!c.defaultSelection),opposite=initial.forms.find(c=>c.side!==lead.side);
 const edit=(clipId,afterSeconds=.06)=>{const packet=structuredClone(oldRoster),entry=packet.entries.find(e=>e.playerId===lead.id);entry.physical.clipId=clipId;entry.physical.impactTrajectory={level:3,angleDegreesByLevel:[-10,0,10,20],beforeSeconds:.1,afterSeconds};return packet;};
 report.phase='atomic-import';report.imports=[];
 for(const [name,packet]of [['unknown',edit('obp-no-such-form')],['wrong-handed',edit(opposite.id)],['window',edit(extra.id,.3)]]){
  const before=await page.evaluate(()=>{const s=liveMatchPlayback.inspect();return{pending:s.physicalRoster.pending,active:s.physicalRoster.active,count:s.generatedPitches,match:s.host.match};}),status=await loadRoster(page,packet),after=await page.evaluate(()=>{const s=liveMatchPlayback.inspect();return{pending:s.physicalRoster.pending,active:s.physicalRoster.active,count:s.generatedPitches,match:s.host.match};});
  assert.equal(status.error,'true',name+' rejected');assert.deepEqual(after,before,name+' rejection is atomic');report.imports.push({name,...status,atomic:true});
 }
 const edited=edit(extra.id),validStatus=await loadRoster(page,edited);assert.equal(validStatus.error,'false');await page.evaluate(()=>liveMatchPlayback.newGame());await generate(page,1);
 const editedRecord=(await history(page))[0];assert.equal(editedRecord.play.diagnostics.measuredClipId,extra.id);assert.equal(editedRecord.play.diagnostics.impactTrajectory.level,3);assert.equal(editedRecord.play.diagnostics.unsupportedReason,null);assert.equal(editedRecord.play.diagnostics.sourceBallReanchored,false);
 report.newForm={playerId:lead.id,clipId:extra.id,side:extra.side,level:3,sourceSha256:sha(JSON.stringify(editedRecord)),classification:editedRecord.play.classification,actualPhysicalPitch:true};
 await page.screenshot({path:resolve(evidence,'normal-1200.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal((await loadRoster(page,oldRoster)).error,'false');await page.evaluate(()=>{liveMatchPlayback.newGame();void liveMatchPlayback.finish();});report.phase='regulation';console.log(JSON.stringify({phase:report.phase,sourceCoreSha256:pins.entrySha256}));
 let latest=0;const start=Date.now();
 while(true){const state=await page.evaluate(()=>{const s=liveMatchPlayback.inspect();return{error:s.error,finished:s.host.finished,fast:s.fast,pitches:s.generatedPitches,match:s.host.match};});
  if(state.error)throw Error(state.error);if(state.pitches>=latest+25){latest=state.pitches;console.log(JSON.stringify({phase:'regulation',pitches:state.pitches,inning:state.match.inning,elapsedMs:Date.now()-start}));}
  if(state.finished){report.regulation={...state,elapsedMs:Date.now()-start};break;}assert(Date.now()-start<240000,'normal match exceeded verification timeout');assert(state.pitches<750);await new Promise(r=>setTimeout(r,750));
 }
 assert(report.regulation.match.inning>=9);assert(report.regulation.pitches>54);const complete=await history(page);report.regulation.contacts=complete.filter(r=>r.play.contact).length;assert(report.regulation.contacts>5);assert(complete.filter(r=>r.play.field).every(r=>r.play.field.end.complete));report.regulation.sourceSha256=sha(JSON.stringify(complete));await context.close();
 report.phase='normal-mobile';const mobile=await browser.newPage({viewport:{width:390,height:860}});instrument(mobile,'normal68-390');await open(mobile,normal);await generate(mobile,1);assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await mobile.screenshot({path:resolve(evidence,'normal-390.png'),fullPage:true});report.views.push({width:390,normalReady:true,actualPitch:true,noOverflow:true});await mobile.close();
 report.phase='lab';const labPage=await browser.newPage({viewport:{width:1200,height:860}});instrument(labPage,'lab68');await open(labPage,lab,true);await labPage.evaluate(()=>KneekuraCameraLab.generate(1));const session=await labPage.evaluate(()=>KneekuraCameraLab.exportSession()),beforeSession=JSON.stringify(session),oldSession={...session,sourceCoreSha256:'865078dc9881ce5c37754dbe2c7b502f586206f3ada972cfe2d3368207720c00'};
 const refusal=await labPage.evaluate(async packet=>{try{await KneekuraCameraLab.importSession(packet);return null;}catch(e){return e.message;}},oldSession);assert.match(refusal,/Core/);assert.equal(JSON.stringify(await labPage.evaluate(()=>KneekuraCameraLab.exportSession())),beforeSession);
 await labPage.evaluate(packet=>KneekuraCameraLab.importSession(packet),session);assert.deepEqual(await labPage.evaluate(()=>KneekuraCameraLab.exportSession()),session);report.sessions={oldCoreRejected:refusal,currentRoundTrip:true,oldRejectionAtomic:true};
 await labPage.screenshot({path:resolve(evidence,'lab-1200.png'),fullPage:true});await labPage.setViewportSize({width:390,height:860});assert.equal(await labPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await labPage.screenshot({path:resolve(evidence,'lab-390.png'),fullPage:true});report.views.push({width:1200,normalReady:true,labReady:true},{width:390,labReady:true,noOverflow:true});await labPage.close();
 for(const item of report.faults){assert.deepEqual(item.errors,[],item.label+' errors');assert.deepEqual(item.external,[],item.label+' external requests');}
 for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,'final source pin '+path);
 assert.equal(sha(await readFile(normal)),report.normalSha256);assert.equal(sha(await readFile(lab)),report.workbenchSha256);report.pass=true;report.phase='complete';console.log(JSON.stringify({pass:true,normalSha256:report.normalSha256,workbenchSha256:report.workbenchSha256,pitches:report.regulation.pitches,contacts:report.regulation.contacts}));
}catch(error){report.error=String(error.stack??error);await mkdir(evidence,{recursive:true});await writeFile(resolve(evidence,'game-check-failure-'+Date.now()+'.json'),JSON.stringify(report,null,2)+'\n');throw error;
}finally{await writeFile(resolve(evidence,'game-check.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();}
