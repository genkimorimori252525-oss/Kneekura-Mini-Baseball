import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const carryFixture=process.argv.includes('--carry-fixture'),
 proof=resolve('docs/verification/2026-10-20-held-base-control'),sha=b=>createHash('sha256').update(b).digest('hex'),
 report={pass:false,carryFixture,scope:'Read-only audit of ordinary HTML: possession, physical carry, controlled base contact and rule out. No product changes.',cases:[]},
 reportPath=resolve(proof,carryFixture?'fixture-browser-check.json':'browser-check.json');
await mkdir(proof,{recursive:true});let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
 for(const version of [73,76]){
  const path=resolve(`docs/demos/releases/v${version}/game.html`),bytes=await readFile(path),
   metadata=JSON.parse(await readFile(path+'.build.json','utf8'));
  assert.equal(sha(bytes),metadata.sha256);
  const page=await browser.newPage({viewport:{width:1200,height:860}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(pathToFileURL(path).href,{timeout:60000});
  await page.waitForFunction(()=>globalThis.liveMatchPlayback,undefined,{timeout:60000});
  if(carryFixture){
   // A local test roster makes carrying rational; no default player is edited.
   const roster=JSON.parse(await readFile('docs/demos/live-game-roster-v62.json','utf8'));
   for(const entry of roster.entries){
    if(entry.playerId.startsWith('0-'))entry.physical.topSpeedMps=1;
    if(entry.playerId.startsWith('1-'))entry.physical.throwSpeedMps=.5;
   }
   await page.locator('#physical-roster-status').evaluate(e=>delete e.dataset.error);
   await page.locator('#physical-roster-file').setInputFiles({name:'carry-audit-only.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(roster))});
   await page.waitForFunction(()=>document.getElementById('physical-roster-status').dataset.error!==undefined);
   const load=await page.locator('#physical-roster-status').evaluate(e=>({error:e.dataset.error,message:e.textContent}));
   assert.equal(load.error,'false',load.message);
   await page.evaluate(()=>liveMatchPlayback.newGame());
  }
  const observed=await page.evaluate(limit=>{
   const auto=document.getElementById('auto-overhead');auto.checked=false;auto.dispatchEvent(new Event('change'));
   const controls=[],carries=[];let pitches=0;
   for(;pitches<limit&&!carries.length;pitches++){
    document.getElementById('next-pitch').click();liveMatchPlayback.stop();
    const state=liveMatchPlayback.inspect();if(state.error)throw Error(state.error);
    const record=state.host.history.at(-1);if(!record?.play?.field)continue;
    for(const contact of record.play.field.facts.filter(f=>f.kind==='controlled_base_contact')){
     const catches=record.play.field.facts.filter(f=>f.kind==='catch_secured'&&f.playerId===contact.playerId&&f.tick<=contact.tick),caught=catches.at(-1),
      releases=caught?record.play.field.facts.filter(f=>f.kind==='throw_release'&&f.tick>caught.tick&&f.tick<=contact.tick):[],
      outcome=record.play.rules.outcomes.find(o=>o.cause==='base_control'&&o.tick===contact.tick&&o.defenderId===contact.playerId),
      decisions=record.play.field.diagnostics.aiTelemetry.holderDecisions.filter(d=>d.state==='carry_to_base'&&d.playerId===contact.playerId
       &&d.base===contact.base&&caught&&d.elapsedSeconds>=caught.elapsedSeconds&&d.elapsedSeconds<=contact.elapsedSeconds),
      row={pitch:pitches+1,inning:record.beforeMatch.inning,half:record.beforeMatch.half,contact,caught,releasesAfterCatch:releases,
       outcome,carryDecision:decisions[0],lastCarryDecision:decisions.at(-1),totalThrows:record.play.field.facts.filter(f=>f.kind==='throw_release').length};
     controls.push(row);
     if(caught&&outcome&&!releases.length&&decisions.length)carries.push(row);
    }
   }
   return {pitches,controls,carries,host:liveMatchPlayback.inspect().host.match};
  },carryFixture?6:48);
  assert.equal(errors.length,0);
  report.cases.push({version,htmlSha256:sha(bytes),coreSha256:metadata.sourceCoreSha256,...observed,errors});
  await page.close();
 }
 // A lack of a carry in a short normal-game prefix would not prove absence.
 // Preserve that observation; use the separate deterministic Core tests too.
 assert(report.cases.every(c=>c.controls.length>0),'probe must actually inspect field facts');
 if(carryFixture)assert(report.cases.every(c=>c.carries.length>0),'each ordinary renderer must execute the carry fixture');
 report.pass=true;report.ordinaryCarryObserved=report.cases.some(c=>c.carries.length>0);
 await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({pass:true,ordinaryCarryObserved:report.ordinaryCarryObserved,cases:report.cases.map(c=>({version:c.version,pitches:c.pitches,controls:c.controls.length,carries:c.carries.length}))}));
}catch(error){report.error=String(error?.stack??error);await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');throw error;}
finally{await browser?.close();}
