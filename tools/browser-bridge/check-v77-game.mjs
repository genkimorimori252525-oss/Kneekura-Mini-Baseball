import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const normal=resolve('../../outputs/ばせぼーるlv77_TBD_vs_LAD_投手調整と独立得能版.html'),lab=resolve('../../outputs/カメラワーク調整室_v77.html'),
 proof=resolve('docs/verification/releases/v77/game'),sha=b=>createHash('sha256').update(b).digest('hex'),report={pass:false,phase:'load',faults:[]};
let browser;await mkdir(proof,{recursive:true});
function watch(page,label){const f={label,errors:[],external:[]};report.faults.push(f);page.on('pageerror',e=>f.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))f.external.push(r.url());});}
async function open(page,path,workbench=false){await page.goto(pathToFileURL(path).href,{timeout:60000});await page.waitForFunction(w=>w?globalThis.KneekuraCameraLab?.inspect().ready:globalThis.liveMatchPlayback,workbench,{timeout:60000});}
async function generate(page,count){await page.evaluate(n=>{document.getElementById('auto-overhead').checked=false;for(let i=0;i<n;i++){document.getElementById('next-pitch').click();liveMatchPlayback.stop();const s=liveMatchPlayback.inspect();if(s.error)throw Error(s.error);}},count);}
try{
 const pins=JSON.parse(await readFile(normal+'.bundle-inputs.json','utf8'));
 for(const[p,h]of Object.entries(pins.inputs))assert.equal(sha(await readFile(p)),h,'current Source pin '+p);
 report.normalSha256=sha(await readFile(normal));report.workbenchSha256=sha(await readFile(lab));report.coreSha256=pins.entrySha256;
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
 const old=await browser.newPage({viewport:{width:1200,height:860}});watch(old,'v76');await open(old,resolve('docs/demos/releases/v76/game.html'));await generate(old,6);
 const baseline=await old.evaluate(()=>liveMatchPlayback.inspect().host.history);await old.close();
 const page=await browser.newPage({viewport:{width:1200,height:860}});watch(page,'v77-normal');await open(page,normal);await generate(page,6);
 assert.deepEqual(await page.evaluate(()=>liveMatchPlayback.inspect().host.history),baseline,'default six-pitch complete Source/bat/field/rules v76 exact');
 report.baseline={records:6,sourceSha256:sha(JSON.stringify(baseline)),exact:true};
 report.phase='independent-roster';
 const packet=await page.evaluate(()=>{
  const core=KneekuraNativeMatchCore,catalog=JSON.parse(document.getElementById('v40-roster-catalog').textContent);
  let roster=structuredClone(liveMatchPlayback.inspect().physicalRoster.active);
  const physicalBefore=JSON.stringify(roster.entries.map(e=>e.physical));
  for(const id of roster.entries.map(e=>e.playerId))for(const definition of core.getLiveTraitCatalogV77()){
   const state=definition.states.at(-1).stateId;
   roster=core.setLiveTraitProfileV77({roster,playerId:id,familyId:definition.familyId,stateId:state}).roster;
  }
  if(JSON.stringify(roster.entries.map(e=>e.physical))!==physicalBefore)throw Error('trait setting mutated base SI');
  const ids=catalog.players.filter(p=>p.role==='P').map(p=>p.playerId);
  roster=structuredClone(roster);
  for(const entry of roster.entries.filter(e=>ids.includes(e.playerId))){
   const p=entry.physical;
   p.pitchRepertoire=core.resolvePitcherRepertoireV77({releaseSpeedMps:p.releaseSpeedMps,maximumPitchSpeedMps:p.maximumPitchSpeedMps,spinRadPerSecond:p.spinRadPerSecond})
    .map((r,i)=>({pitchType:r.pitchType,releaseSpeedMps:r.releaseSpeedMps,spinRadPerSecond:{...r.spinRadPerSecond,z:r.spinRadPerSecond.z+(i===0?15:0)}}));
   p.pitchingMotion={preparationMs:980,headMotionScale:.6};
  }
  return roster;
 });
 await page.locator('#physical-roster-status').evaluate(e=>delete e.dataset.error);
 await page.locator('#physical-roster-file').setInputFiles({name:'v77-integration.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(packet))});
 await page.waitForFunction(()=>document.getElementById('physical-roster-status').dataset.error!==undefined);
 assert.equal(await page.locator('#physical-roster-status').getAttribute('data-error'),'false',await page.locator('#physical-roster-status').textContent());
 await page.evaluate(()=>liveMatchPlayback.newGame());await generate(page,1);
 const motion=await page.evaluate(()=>{liveMatchPlayback.seekPresentationMs(800);const s=liveMatchPlayback.inspect();return {diagnostic:s.host.history[0].play.diagnostics.pitchingMotion,timing:s.presentation.timing.preparationMs,stage:s.presentation.stage,head:s.presentation.pitcherBodyHeadView};});
 assert.equal(motion.timing,980);assert.equal(motion.diagnostic.headMotionScale,.6);assert.equal(motion.stage,'preparation');report.authoredMotion=motion;
 report.phase='nine-innings';
 const started=Date.now();
 report.game=await page.evaluate(()=>{
  let s=liveMatchPlayback.inspect();
  for(let i=0;i<700&&!s.host.finished;i++){document.getElementById('next-pitch').click();liveMatchPlayback.stop();s=liveMatchPlayback.inspect();if(s.error)throw Error(s.error);}
  const records=s.host.history,fields=records.filter(r=>r.play.field);
  return {finished:s.host.finished,match:s.host.match,pitches:records.length,contacts:records.filter(r=>r.play.contact).length,
   fields:fields.length,allFieldComplete:fields.every(r=>r.play.field.end.complete),families:s.physicalRoster.active.entries.map(e=>e.traitProfile.selections.length),
   settingsPreserved:JSON.stringify(s.physicalRoster.active),fallback:s.legacyResultFallback};
 });
 report.game.elapsedMs=Date.now()-started;assert(report.game.finished&&report.game.allFieldComplete);assert.equal(report.game.fallback,false);assert(report.game.families.every(n=>n===17));
 assert.equal(report.game.settingsPreserved,JSON.stringify(packet));delete report.game.settingsPreserved;
 report.phase='width-and-lab';
 for(const width of[1200,390]){
  const p=await browser.newPage({viewport:{width,height:860}});watch(p,'lab-'+width);await open(p,lab,true);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.close();
 }
 for(const f of report.faults){assert.equal(f.errors.length,0);assert.equal(f.external.length,0);}
 for(const[p,h]of Object.entries(pins.inputs))assert.equal(sha(await readFile(p)),h,'Source changed during browser verification');
 report.pass=true;report.phase='complete';await writeFile(resolve(proof,'game-check.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({pass:true,baseline:report.baseline,game:report.game}));
}catch(error){report.error=String(error.stack??error);await writeFile(resolve(proof,'game-check.json'),JSON.stringify(report,null,2)+'\n');throw error;}
finally{await browser?.close();}
