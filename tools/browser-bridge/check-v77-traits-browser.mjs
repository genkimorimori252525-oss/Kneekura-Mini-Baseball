import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const path=resolve(process.argv[2]??'../../outputs/にーくら野球メーカー_v77_投手調整と独立得能版.html'),
 proof=resolve(process.argv[3]??'docs/verification/releases/v77/traits'),report={pass:false,path,cases:[],faults:[]};
await mkdir(proof,{recursive:true});let browser;
try{
 report.sha256=createHash('sha256').update(await readFile(path)).digest('hex');
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
 for(const width of[1200,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),faults=[];page.on('pageerror',e=>faults.push(String(e)));
  await page.goto(pathToFileURL(path).href,{timeout:60000});await page.waitForFunction(()=>globalThis.baseballMaker?.getLiveRoster(),undefined,{timeout:60000});
  await page.locator('#live-roster-player').selectOption('0-b0');
  const initial=await page.evaluate(()=>({roster:baseballMaker.getLiveRoster(),values:[...document.querySelectorAll('[data-public-ability]')].map(e=>[e.dataset.publicAbility,e.value])}));
  await page.locator('#live-trait-throw_accuracy').selectOption('A');
  const after=await page.evaluate(()=>({roster:baseballMaker.getLiveRoster(),values:[...document.querySelectorAll('[data-public-ability]')].map(e=>[e.dataset.publicAbility,e.value])}));
  assert.deepEqual(after.values,initial.values,'a trait must not alter any public ability');
  assert.deepEqual(after.roster.entries.map(e=>e.physical),initial.roster.entries.map(e=>e.physical),'a trait must not alter base SI');
  assert.equal(after.roster.entries.find(e=>e.playerId==='0-b0').traitProfile.version,'live_trait_profile_v2');
  for(const value of['0','2','1']){
   await page.locator('#live-trait-effect-throw_accuracy').fill(value);await page.locator('#live-trait-effect-throw_accuracy').dispatchEvent('input');
   assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('[data-public-ability]')].map(e=>[e.dataset.publicAbility,e.value])),initial.values);
  }
  assert.equal(await page.locator('[data-trait-family]').count(),17);
  for(const id of['inside_command','high_zone_hitting','low_zone_hitting','pitcher_field_reaction'])assert.equal(await page.locator('#live-trait-'+id).count(),1);
  assert.equal(await page.locator('#live-trait-unsupported').count(),0,'irrelevant and unimplemented catalogue is absent from the human editor');
  await page.locator('#live-trait-throw_accuracy').selectOption('');
  const cleared=await page.evaluate(()=>baseballMaker.getLiveRoster());
  assert.equal(cleared.entries.find(e=>e.playerId==='0-b0').traitProfile.selections.find(s=>s.familyId==='throw_accuracy').stateId,null);
  assert.deepEqual(cleared.entries.map(e=>e.physical),initial.roster.entries.map(e=>e.physical));
  const exported=await page.evaluate(()=>baseballMaker.getLiveRoster());
  await page.evaluate(packet=>baseballMaker.importLiveRoster(packet),exported);
  assert.deepEqual(await page.evaluate(()=>baseballMaker.getLiveRoster()),exported);
  await page.locator('#live-trait-bad_ball_hitting').selectOption('LEARNED');
  const badBase=await page.evaluate(()=>baseballMaker.getLiveRoster().entries.find(e=>e.playerId==='0-b0').physical);
  await page.locator('#live-roster-internals').evaluate(e=>e.open=true);
  await page.locator('#live-ability-badBallControl').fill('0.7');await page.locator('#live-ability-badBallControl').dispatchEvent('input');
  const bad=await page.evaluate(()=>baseballMaker.getLiveRoster().entries.find(e=>e.playerId==='0-b0'));
  assert.deepEqual(bad.physical,badBase,'a technical detail must edit the technique, never base SI');
  assert.equal(bad.traitProfile.selections.find(s=>s.familyId==='bad_ball_hitting').source.badBallControl,.7);
  report.cases.push({width,traits:17,publicAndPhysicalUnchanged:true,independentThrowOffAndScaleRoundtrip:true});report.faults.push({width,errors:faults});assert.equal(faults.length,0);
  await page.close();
 }
 report.pass=true;await writeFile(resolve(proof,'traits-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,cases:report.cases}));
}catch(error){report.error=String(error.stack??error);await writeFile(resolve(proof,'traits-check.json'),JSON.stringify(report,null,2)+'\n');throw error;}
finally{await browser?.close();}
