import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [artifactArg,evidenceArg,gameArg]=process.argv.slice(2);
if(!artifactArg||!evidenceArg)throw Error('requires NEW public maker HTML, NEW evidence directory, optional current game HTML');
const artifact=resolve(artifactArg),evidence=resolve(evidenceArg),sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(evidence,{recursive:false});
const sourcePaths=['docs/demos/live-game-roster-v2.json','docs/demos/live-game-roster-catalog-v2.json','docs/demos/live-public-ability-reference-v1.json'];
const sourceBytes=await Promise.all(sourcePaths.map(p=>readFile(p))),[packet,catalog,reference]=sourceBytes.map(b=>JSON.parse(b));
const oldPacket=JSON.parse(await readFile('docs/demos/live-game-roster-v1.json','utf8'));
const report={artifact,sha256:sha(await readFile(artifact)),inputs:sourcePaths.map((path,i)=>({path,sha256:sha(sourceBytes[i])})),views:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const close=(a,b,label)=>assert(Math.abs(a-b)<1e-8,label+': '+a+' / '+b);
const revealAbility=async(page,id)=>{const input=page.locator('[data-public-ability="'+id+'"]');
 if(!await input.isVisible())await page.locator('#live-public-secondary > summary').click();return input;};
try{
 assert.equal(packet.entries.length,20);assert.equal(catalog.fields.length,40);
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:860},acceptDownloads:true}),errors=[],network=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:)/.test(r.url()))network.push(r.url());});
  await page.goto(pathToFileURL(artifact).href);await page.waitForFunction(()=>window.baseballMaker?.getPublicProjection()?.abilities.length===11);
  assert.equal(await page.locator('#tab-player').getAttribute('aria-selected'),'true','public edition opens directly in player editing');
  assert.equal(await page.locator('#maker-preview-column').isVisible(),false);assert.equal(await page.locator('#player-panel').isVisible(),true);
  const initialLayout=await page.evaluate(()=>{const panel=document.getElementById('player-panel').getBoundingClientRect(),layout=document.getElementById('maker-layout').getBoundingClientRect(),first=document.querySelector('[data-public-ability]').getBoundingClientRect();
   return{panelWidth:panel.width,layoutWidth:layout.width,firstAbilityTop:first.top,viewportHeight:innerHeight,scrollY};});
  close(initialLayout.panelWidth,initialLayout.layoutWidth,'player editor occupies full layout width');
  assert.equal(initialLayout.scrollY,0);assert(initialLayout.firstAbilityTop<initialLayout.viewportHeight,'public ability editing is available in the first viewport');
  const beforeTabs=await page.evaluate(()=>JSON.stringify(window.baseballMaker.getState()));
  await page.locator('#tab-bat').click();assert.equal(await page.locator('#maker-preview-column').isVisible(),true);assert.equal(await page.locator('#bat-panel').isVisible(),true);
  assert.equal(await page.locator('#maker-layout').evaluate(e=>e.classList.contains('public-player-editor')),false);
  await page.locator('#tab-player').click();assert.equal(await page.locator('#maker-preview-column').isVisible(),false);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.baseballMaker.getState())),beforeTabs,'tab changes only presentation');
  assert.equal(await page.locator('#live-roster-player option').count(),20);
  assert.equal(await page.locator('#live-roster-internals').getAttribute('open'),null);
  assert.equal(await page.locator('#live-roster-fields').isVisible(),false);assert.equal(await page.locator('[data-roster-path]').count(),40);
  const original=await page.evaluate(()=>({state:window.baseballMaker.getState(),result:window.baseballMaker.getResult(),revision:window.baseballMaker.getRevision()}));
  assert.deepEqual(original.state.livePhysicalRoster,packet);assert(!Object.hasOwn(original.state,'publicAbilities'),'public values have no second stored authority');
  const approved=[];
  for(const anchor of reference.anchors){
   await page.locator('#live-roster-player').selectOption(anchor.playerId);
   const pitcher=catalog.players.find(p=>p.playerId===anchor.playerId).role==='P';
   assert.equal(await page.locator('#live-public-secondary').getAttribute('open'),null);
   assert.equal(await page.locator('#live-public-secondary > summary').innerText(),pitcher?'投手の打撃能力':'野手の投球能力');
   assert.equal(await page.locator('[data-public-ability]:visible').count(),pitcher?7:9,'role-specific abilities are the primary editor');
   const shown=await page.locator('[data-public-ability]').evaluateAll(inputs=>inputs.map(i=>({id:i.dataset.publicAbility,value:Number(i.value),label:document.querySelector('label[for="'+i.id+'"]').textContent})));
   assert.equal(shown.length,11);assert.equal(new Set(shown.map(a=>a.id)).size,11);
   for(const ability of shown){const expected=ability.id==='maxSpeedKmh'?anchor.entry.physical.maximumPitchSpeedMps*3.6
     :ability.id==='badBallControl'?anchor.entry.physical.badBallControl*100:anchor.ratings[ability.id];
    close(ability.value,expected,anchor.playerId+'/'+ability.id);}
   approved.push({playerId:anchor.playerId,abilities:shown});
  }
  const selected=reference.anchors[0].playerId;await page.locator('#live-roster-player').selectOption(selected);
  const initialProjection=await page.evaluate(()=>window.baseballMaker.getPublicProjection()),editChecks=[];
  for(const ability of initialProjection.abilities){
   await page.evaluate(p=>window.baseballMaker.importLiveRoster(p),packet);
   const value=ability.value+2<=ability.max?ability.value+2:ability.value-2;
   const expected=await page.evaluate(({playerId,abilityId,value})=>window.KneekuraBaseballWorkbench.editLivePublicAbilityV1({
    roster:window.baseballMaker.getLiveRoster(),reference:window.KneekuraLivePublicAbilityReference,playerId,abilityId,value}),{playerId:selected,abilityId:ability.id,value});
   await(await revealAbility(page,ability.id)).fill(String(value));
   assert.equal(await page.locator('[data-public-ability="'+ability.id+'"]').evaluate(i=>i.validationMessage),'');
   const actual=await page.evaluate(()=>window.baseballMaker.getLiveRoster());assert.deepEqual(actual,expected.roster);
   close(Number(await page.locator('[data-public-ability="'+ability.id+'"]').inputValue()),value,'public edit round trip '+ability.id);
   for(const row of actual.entries.filter(e=>e.playerId!==selected))assert.deepEqual(row,packet.entries.find(e=>e.playerId===row.playerId),'other player remains unchanged');
   const before=packet.entries.find(e=>e.playerId===selected),after=actual.entries.find(e=>e.playerId===selected),changed=new Set(expected.changes.map(c=>c.path));
   assert(changed.size>0);for(const [path,oldValue]of Object.entries(before.physical))if(!changed.has(path))assert.deepEqual(after.physical[path],oldValue,'individuality preserved '+ability.id+'/'+path);
   if(ability.id==='power')close(after.physical.targetSweetSpotSpeedMps/after.physical.maximumSweetSpotSpeedMps,before.physical.targetSweetSpotSpeedMps/before.physical.maximumSweetSpotSpeedMps,'power keeps motor/target ratio');
   if(ability.id==='contact')close((after.physical.aimStdMeters+.001)/(before.physical.aimStdMeters+.001),(after.physical.timingStdSeconds+.001)/(before.physical.timingStdSeconds+.001),'contact keeps shifted precision ratio');
   editChecks.push({abilityId:ability.id,value,changes:expected.changes});
  }
  assert(editChecks.some(c=>c.changes.length>1),'at least one public control drives multiple actual SI inputs');
  const physicalAfterEdits=await page.evaluate(()=>({result:window.baseballMaker.getResult(),revision:window.baseballMaker.getRevision(),player:window.baseballMaker.getState().player}));
  assert.deepEqual(physicalAfterEdits,{result:original.result,revision:original.revision,player:original.state.player},'public editing does not run or rewrite standalone simulation');
  await page.evaluate(p=>window.baseballMaker.importLiveRoster(p),packet);
  await page.locator('#live-roster-internals > summary').click();
  await page.locator('[data-roster-path="topSpeedMps"]').fill('0.1');
  const range=await page.evaluate(()=>({packet:window.baseballMaker.getLiveRoster(),projection:window.baseballMaker.getPublicProjection()}));
  const running=range.projection.abilities.find(a=>a.id==='run');assert(running.value<0,'an extreme internal value remains outside the public authoring range');
  close(Number(await page.locator('[data-public-ability="run"]').inputValue()),running.value,'details reproject public value');
  assert.match(await page.locator('[data-public-range-note="run"]').innerText(),/詳細設定から算出・範囲外/);
  const [rangeDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#export-live-roster').click()]);
  assert.deepEqual(JSON.parse(await readFile(await rangeDownload.path(),'utf8')),range.packet,'out-of-range projection does not clip SI or block valid JSON');
  await page.evaluate(p=>window.baseballMaker.importLiveRoster(p),packet);
  for(let i=0;i<12;i++){
   await page.locator('[data-public-ability="power"]').fill(String(initialProjection.abilities.find(a=>a.id==='power').value+(i%2?0:-1)));
   await page.locator('[data-roster-path="topSpeedMps"]').fill(String(7+(i%2)*.1));
  }
  const alternating=await page.evaluate(()=>window.baseballMaker.getLiveRoster());
  assert(alternating.sourceId.length<packet.sourceId.length+60,'alternating authoring does not append an unbounded source-id chain');
  assert(alternating.entries.find(e=>e.playerId===selected).sourceId.length<packet.entries.find(e=>e.playerId===selected).sourceId.length+40);
  await page.evaluate(p=>window.baseballMaker.importLiveRoster(p),packet);
  const validState=await page.evaluate(()=>window.baseballMaker.getState());
  await page.locator('[data-public-ability="power"]').fill('101');assert.deepEqual(await page.evaluate(()=>window.baseballMaker.getState()),validState);
  await page.locator('#live-roster-player').selectOption(reference.anchors[1].playerId);await page.locator('#save-json').click();
  assert.match(await page.locator('#error-status').innerText(),/未確定/);
  await page.locator('#live-roster-player').selectOption(selected);assert.equal(await page.locator('[data-public-ability="power"]').inputValue(),'101');
  await page.evaluate(p=>window.baseballMaker.importLiveRoster(p),packet);
  await page.locator('#live-public-editor > details > summary').click();const leagueBefore=await page.evaluate(()=>JSON.stringify(window.baseballMaker.getState())),leagues=[];
  for(const leagueId of ['MLB','NLB','NPB','KBO','CUSTOM']){
   await page.locator('#live-public-league').selectOption(leagueId);
   const expected=await page.evaluate(leagueId=>window.KneekuraBaseballWorkbench.previewLivePublicLeagueV1({roster:window.baseballMaker.getLiveRoster(),reference:window.KneekuraLivePublicAbilityReference,playerId:document.getElementById('live-roster-player').value,leagueId}),leagueId);
   assert((await page.locator('#live-public-league-status').innerText()).includes(expected.sampleCount+'人'));
   const displayed=await page.locator('#live-public-league-preview strong').allTextContents();assert.equal(displayed.length,expected.metrics.length);
   expected.metrics.forEach((m,i)=>{if(m.value===null)assert.equal(displayed[i],'未算出');else close(Number(displayed[i].replaceAll(',','')),Number(m.value.toFixed(1)),'league reference display');});
   assert.equal(await page.evaluate(()=>JSON.stringify(window.baseballMaker.getState())),leagueBefore,'league display never changes stored SI/commands');
   leagues.push(expected);
  }
  assert(leagues.some(l=>l.sampleCount===0&&l.metrics.every(m=>m.value===null)),'unregistered league is explicitly uncomputed');
  // A v40 packet keeps the new omitted zone-judgment field omitted; only projection reads the compatibility default.
  await page.evaluate(p=>window.baseballMaker.importLiveRoster(p),oldPacket);
  assert.deepEqual(await page.evaluate(()=>window.baseballMaker.getLiveRoster()),oldPacket);
  assert.equal(await page.locator('[data-public-ability]').count(),11);
  await page.evaluate(p=>window.baseballMaker.importLiveRoster(p),packet);
  const atomic=await page.evaluate(()=>{
   const api=window.baseballMaker,before=api.getState(),result=api.getResult(),revision=api.getRevision(),bad=structuredClone(before);
   bad.livePhysicalRoster.entries[1].playerId=bad.livePhysicalRoster.entries[0].playerId;bad.scenario.timingOffsetMs=99;
   let rejected=false;try{api.importState(bad);}catch{rejected=true;}
   return{rejected,stateUnchanged:JSON.stringify(api.getState())===JSON.stringify(before),resultUnchanged:JSON.stringify(api.getResult())===JSON.stringify(result),revisionUnchanged:api.getRevision()===revision};
  });assert.deepEqual(atomic,{rejected:true,stateUnchanged:true,resultUnchanged:true,revisionUnchanged:true});
  await page.locator('[data-public-ability="power"]').fill(String(initialProjection.abilities.find(a=>a.id==='power').value-2));
  const [fullDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#save-json').click()]);
  const saved=JSON.parse(await readFile(await fullDownload.path(),'utf8'));await page.evaluate(s=>window.baseballMaker.importState(s),saved);
  assert.deepEqual(await page.evaluate(()=>window.baseballMaker.getState()),saved);
  await page.locator('#live-roster-internals > summary').click();assert.equal(await page.locator('#live-roster-internals').getAttribute('open'),null);
  await page.locator('#live-public-editor > details > summary').click();
  await page.screenshot({path:resolve(evidence,'public-maker-'+width+'.png'),fullPage:true});
  let game=null;
  if(gameArg){const gamePage=await browser.newPage({viewport:{width,height:860}});
   await gamePage.goto(pathToFileURL(resolve(gameArg)).href);await gamePage.waitForFunction(()=>window.liveMatchPlayback?.inspect().physicalRoster);
   await gamePage.locator('#physical-roster-file').setInputFiles({name:'public-edited.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
   await gamePage.waitForFunction(()=>document.getElementById('physical-roster-status').dataset.error==='false');
   await gamePage.evaluate(()=>{window.liveMatchPlayback.newGame();document.getElementById('next-pitch').click();window.liveMatchPlayback.stop();});
   game=await gamePage.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{error:s.error,packet:s.physicalRoster.active,players:s.physicalRoster.players,generatedPitches:s.generatedPitches,frames:s.lastResult.frames.length,version:s.version};});
   assert.equal(game.error,null);assert.deepEqual(game.packet,saved.livePhysicalRoster);assert.equal(game.generatedPitches,1);assert(game.frames>1);
   assert.deepEqual(game.players.find(p=>p.playerId===selected).physical,saved.livePhysicalRoster.entries.find(p=>p.playerId===selected).physical);await gamePage.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  report.views.push({width,initialLayout,tabPreviewRestored:true,roleSpecificPrimary:true,approved,editChecks,rangeProjection:running,leagues,oldPacketPreserved:true,atomic,completeStateRoundTrip:true,game,errors,network});await page.close();
 }
 for(const input of report.inputs)assert.equal(sha(await readFile(input.path)),input.sha256);
 report.status='PASS';await writeFile(resolve(evidence,'public-maker-check.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',widths:report.views.map(v=>v.width),players:20,publicAbilities:11,internalFields:40,gameImportChecked:!!gameArg}));
}catch(error){report.status='FAIL';report.error=error.stack;await writeFile(resolve(evidence,'public-maker-check.json'),JSON.stringify(report,null,2)+'\n');throw error;}
finally{await browser.close();}
