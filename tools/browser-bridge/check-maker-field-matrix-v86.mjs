import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [fileArg,outArg]=process.argv.slice(2),file=resolve(fileArg),out=resolve(outArg),sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:true});const report={pass:false,sha256:sha(await readFile(file)),cases:[],faults:[]};let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:width===390?2:1}),faults={width,errors:[],external:[]};report.faults.push(faults);
  page.on('pageerror',e=>faults.errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))faults.external.push(r.url());});
  await page.goto(pathToFileURL(file).href);await page.waitForFunction(()=>globalThis.KneekuraPitcherMakerV78);
  const ids=await page.evaluate(()=>{const c=KneekuraLiveGameRosterCatalog.players;return [c.find(p=>p.role==='P').playerId,c.find(p=>p.role==='DH').playerId];});
  for(const id of ids){
   await page.locator('#tab-player').click();await page.locator('#live-roster-player').selectOption(id);
   const rows=await page.evaluate(()=>{
    const results=[],nodes=[...document.querySelectorAll('#live-roster-fields input[type=number],input[data-public-ability],input[data-trait-effect-scale]')].filter(e=>!e.disabled);
    for(const original of nodes){
     const input=document.getElementById(original.id);if(!input||input.disabled)continue;
     for(let p=input.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;
     const key=input.id,path=input.dataset.rosterPath??input.dataset.publicAbility??input.dataset.traitEffectScale,raw=input.value,before=JSON.stringify(baseballMaker.getLiveRoster());
     input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));
     const error={unchanged:JSON.stringify(baseballMaker.getLiveRoster())===before,invalid:input.validity.customError,near:!!input.closest('label,.control')?.querySelector('[data-maker-local-message].error'),aria:input.getAttribute('aria-invalid')};
     input.value=raw;input.dispatchEvent(new Event('input',{bubbles:true}));
     const current=(key&&document.getElementById(key))??[...document.querySelectorAll('input[data-trait-effect-scale]')].find(e=>e.dataset.traitEffectScale===path),pending=baseballMaker.getRecoveryStateV82().pendingFields;
     const success={valid:!current.validity.customError,aria:current.getAttribute('aria-invalid'),nearError:!!current.closest('label,.control')?.querySelector('[data-maker-local-message].error:not([hidden])'),pending:pending.length};
     results.push({key,path,raw,error,success,pass:error.unchanged&&error.invalid&&error.near&&error.aria==='true'&&success.valid&&success.aria==='false'&&!success.nearError&&!success.pending});
    }
    return results;
   });
   report.cases.push({width,playerId:id,fields:rows});
  }
  assert.deepEqual(faults.errors,[]);assert.deepEqual(faults.external,[]);await page.close();
 }
 const fields=report.cases.flatMap(c=>c.fields),failed=fields.filter(r=>!r.pass);assert(fields.length>100,'numeric/public/trait matrix must cover both roles');assert.deepEqual(failed,[]);
 assert.equal(sha(await readFile(file)),report.sha256);report.pass=true;console.log(JSON.stringify({pass:true,fieldRoundTrips:fields.length,viewports:2,roles:2}));
}catch(error){report.error=String(error.stack??error);throw error;}finally{await browser?.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
