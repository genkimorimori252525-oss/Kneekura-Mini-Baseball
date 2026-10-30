import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [artifactArg,evidenceArg]=process.argv.slice(2);
if(!artifactArg||!evidenceArg)throw Error('requires maker HTML and NEW evidence directory');
const artifact=resolve(artifactArg),evidence=resolve(evidenceArg),sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(evidence,{recursive:false});
const packetBytes=await readFile('docs/demos/live-game-roster-v1.json'),catalogBytes=await readFile('docs/demos/live-game-roster-catalog-v1.json');
const packet=JSON.parse(packetBytes),catalog=JSON.parse(catalogBytes),report={artifact,sha256:sha(await readFile(artifact)),packetSha256:sha(packetBytes),catalogSha256:sha(catalogBytes),views:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 assert.equal(packet.entries.length,20);assert.equal(catalog.players.length,20);
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:860},acceptDownloads:true}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:)/.test(r.url()))requests.push(r.url());});
  await page.goto(pathToFileURL(artifact).href);await page.waitForFunction(()=>window.baseballMaker?.getLiveRoster()?.entries.length===20);
  const initial=await page.evaluate(()=>({state:window.baseballMaker.getState(),result:window.baseballMaker.getResult(),revision:window.baseballMaker.getRevision()}));
  assert.deepEqual(initial.state.livePhysicalRoster,packet);assert(initial.result.pitchFrames.length>0&&initial.result.batFrames.length>0);
  await page.locator('#tab-player').click();assert.equal(await page.locator('#live-roster-player option').count(),20);
  assert.equal(await page.locator('#live-roster-list p').count(),20);assert.equal(await page.locator('#standalone-player-editor').getAttribute('open'),null);
  const coverage=[];
  for(const identity of catalog.players){
   await page.locator('#live-roster-player').selectOption(identity.playerId);
   const fields=await page.locator('[data-roster-path]').evaluateAll(inputs=>inputs.map(i=>({path:i.dataset.rosterPath,value:i.value})));
   assert.equal(fields.length,catalog.fields.length);assert.equal(new Set(fields.map(f=>f.path)).size,fields.length);
   const entry=packet.entries.find(e=>e.playerId===identity.playerId);
   for(const spec of catalog.fields){const expected=spec.path.split('.').reduce((v,k)=>v?.[k],spec.entryPath?entry:entry.physical);
    assert.equal(fields.find(f=>f.path===spec.path).value,expected===undefined?'':String(expected),identity.playerId+'/'+spec.path);}
   coverage.push({playerId:identity.playerId,name:identity.name,teamName:identity.teamName,role:identity.role,fieldCount:fields.length});
  }
  // The catalog must expose every scalar/vector/decision value in each full profile exactly once.
  const leaves=(value,prefix='')=>Object.entries(value).flatMap(([k,v])=>v&&typeof v==='object'?leaves(v,prefix+k+'.'):[prefix+k]);
  for(const entry of packet.entries)for(const path of leaves(entry.physical).filter(p=>p!=='basis'))
   assert(catalog.fields.some(f=>!f.entryPath&&f.path===path),'missing editable physical ability '+path);
  const selected=catalog.players[0].playerId;await page.locator('#live-roster-player').selectOption(selected);
  const entryBefore=packet.entries.find(e=>e.playerId===selected),edits=[];
  for(const [path,value]of [['topSpeedMps',7.123],['spinRadPerSecond.x',-123.25],['swingDecision.threshold',.321]]){
   const field=page.locator('[data-roster-path="'+path+'"]');await field.fill(String(value));
   const state=await page.evaluate(()=>window.baseballMaker.getState());
   const actual=path.split('.').reduce((v,k)=>v[k],state.livePhysicalRoster.entries.find(e=>e.playerId===selected).physical);
   assert.equal(actual,value);assert.equal(await field.evaluate(e=>e.validationMessage),'');edits.push({path,value});
  }
  await page.locator('[data-roster-path="swingDecision.approach"]').selectOption('TAKE');
  const heightSpec=catalog.fields.find(f=>f.entryPath&&f.path==='heightMeters');
  if(heightSpec){await page.locator('[data-roster-path="heightMeters"]').fill('1.91');assert.equal(await page.evaluate(id=>window.baseballMaker.getLiveRoster().entries.find(e=>e.playerId===id).heightMeters,selected),1.91);}
  const edited=await page.evaluate(()=>({state:window.baseballMaker.getState(),result:window.baseballMaker.getResult(),revision:window.baseballMaker.getRevision()}));
  assert.deepEqual(edited.state.player,initial.state.player);assert.deepEqual(edited.result,initial.result);assert.equal(edited.revision,initial.revision);
  const editedEntry=edited.state.livePhysicalRoster.entries.find(e=>e.playerId===selected);
  assert.equal(editedEntry.sourceId,entryBefore.sourceId+':maker-edited');assert.match(edited.state.livePhysicalRoster.sourceId,/:maker-edited-r\d+$/);
  for(const e of edited.state.livePhysicalRoster.entries.filter(e=>e.playerId!==selected))assert.deepEqual(e,packet.entries.find(p=>p.playerId===e.playerId));
  // An invalid field cannot silently become an exported previous value, even after switching players.
  await page.locator('[data-roster-path="topSpeedMps"]').fill('-1');
  assert.deepEqual(await page.evaluate(()=>window.baseballMaker.getState()),edited.state);
  await page.locator('#live-roster-player').selectOption(catalog.players[1].playerId);
  await page.locator('#export-live-roster').click();assert.match(await page.locator('#error-status').innerText(),/未確定/);
  await page.locator('#save-json').click();assert.match(await page.locator('#error-status').innerText(),/未確定/);
  await page.locator('#live-roster-player').selectOption(selected);assert.equal(await page.locator('[data-roster-path="topSpeedMps"]').inputValue(),'-1');
  await page.locator('[data-roster-path="topSpeedMps"]').fill('7.123');
  const rejection=await page.evaluate(()=>{
   const api=window.baseballMaker,original=api.getState(),result=api.getResult(),revision=api.getRevision(),checks=[];
   for(const kind of ['duplicate','partial','mixed','nonfinite','overspeed','unknown']){
    const next=structuredClone(original),r=next.livePhysicalRoster;
    if(kind==='duplicate')r.entries[1].playerId=r.entries[0].playerId;
    if(kind==='partial')r.entries.pop();
    if(kind==='mixed')r.entries[0].workbenchPlayer=structuredClone(original.player);
    if(kind==='nonfinite')r.entries[0].physical.spinRadPerSecond.x=Infinity;
    if(kind==='overspeed')r.entries[0].physical.targetSweetSpotSpeedMps=91;
    if(kind==='unknown')r.entries[0].physical.madeUpBonus=10;
    next.scenario.timingOffsetMs=123;
    let error=null;try{api.importState(next);}catch(e){error=e.message;}
    if(!error||JSON.stringify(api.getState())!==JSON.stringify(original)||JSON.stringify(api.getResult())!==JSON.stringify(result)||api.getRevision()!==revision)
     throw Error('non-atomic rejected import '+kind);
    checks.push({kind,error});
   }
   const old=structuredClone(original);delete old.livePhysicalRoster;api.importState(old);
   if(JSON.stringify(api.getLiveRoster())!==JSON.stringify(original.livePhysicalRoster))throw Error('legacy JSON replaced game roster');
   return checks;
  });
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export-live-roster').click()]);
  assert.equal(download.suggestedFilename(),'試合用能力.json');const exported=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.deepEqual(exported,await page.evaluate(()=>window.baseballMaker.getLiveRoster()));
  const beforeImport=await page.evaluate(()=>window.baseballMaker.getState()),imported=structuredClone(exported);
  imported.entries[1].physical.spinRadPerSecond.z=41.25;imported.sourceId='maker-qa-explicit-import-v1';
  await page.locator('#live-roster-file').setInputFiles({name:'game-abilities.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
  await page.waitForFunction(sourceId=>window.baseballMaker.getLiveRoster().sourceId===sourceId,imported.sourceId);
  assert.deepEqual(await page.evaluate(()=>window.baseballMaker.getLiveRoster()),imported);
  assert.deepEqual(await page.evaluate(()=>window.baseballMaker.getState().player),beforeImport.player);
  const [fullDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#save-json').click()]);
  const full=JSON.parse(await readFile(await fullDownload.path(),'utf8'));assert.deepEqual(full,await page.evaluate(()=>window.baseballMaker.getState()));
  await page.evaluate(state=>window.baseballMaker.importState(state),full);assert.deepEqual(await page.evaluate(()=>window.baseballMaker.getState()),full);
  const proof=await page.evaluate(()=>window.KneekuraBaseballWorkbench.applyLivePhysicalRosterV1({players:window.KneekuraLiveGameRosterCatalog.players,roster:window.baseballMaker.getLiveRoster()}));
  assert.equal(proof.audit.nativeAuthentication,false);assert.equal(proof.audit.projectionOnly,true);assert.equal(proof.players.length,20);
  await page.locator('#live-roster-player').selectOption(selected);await page.screenshot({path:resolve(evidence,'maker-roster-'+width+'.png'),fullPage:true});
  await page.locator('#tab-bat').click();assert.equal(await page.locator('#bat-panel').isVisible(),true);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  report.views.push({width,coverage,edits,rejection,completeStateRoundTrip:true,standaloneSimulationUnchangedByRosterEdit:true,pageErrors:errors,networkRequests:requests});await page.close();
 }
 assert.equal(sha(await readFile('docs/demos/live-game-roster-v1.json')),report.packetSha256);assert.equal(sha(await readFile('docs/demos/live-game-roster-catalog-v1.json')),report.catalogSha256);
 report.status='PASS';await writeFile(resolve(evidence,'maker-roster-check.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',widths:report.views.map(v=>v.width),players:20,fields:catalog.fields.length,authority:'UI editing/validation/JSON only; no match execution claim'}));
}catch(error){report.status='FAIL';report.error=error.stack;await writeFile(resolve(evidence,'maker-roster-check.json'),JSON.stringify(report,null,2)+'\n');throw error;}
finally{await browser.close();}
