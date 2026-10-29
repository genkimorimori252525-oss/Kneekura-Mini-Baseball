import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve,relative,isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
const {chromium}=createRequire(import.meta.url)(process.env.BASEBALL_PLAYWRIGHT_CORE_PATH??resolve(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'));
const [outputArg,htmlArg,envelopeArg,legacyArg]=process.argv.slice(2),root=process.cwd(),out=resolve(outputArg??''),rel=relative(root,out);
assert(process.argv.length===6&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'new output, candidate HTML, actual envelope and legacy report required');
await mkdir(out,{recursive:false});const save=(n,v)=>writeFile(resolve(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'}),sha=b=>createHash('sha256').update(b).digest('hex');
const inputs=[htmlArg,htmlArg+'.manifest.json',envelopeArg,legacyArg,'docs/demos/baseball-maker-ui-v94.mjs','src/integration/browser/workbench-index.ts',
 'src/integration/traits/ContactDescriptorEnvelopeV229.ts','tools/browser-bridge/prepare-maker-contact-envelope-v229.mjs','tools/browser-bridge/check-maker-contact-envelope-v229.mjs'];
const report={pass:false,boundary:'LOCAL_EXTERNAL_CONTACT_ENVELOPE_VIEW_ONLY',errors:[],requests:[],cases:[],physicsEffects:'NONE'};let browser;
try{
 const pins=Object.fromEntries(await Promise.all(inputs.map(async p=>[p,sha(await readFile(resolve(p)))])));report.inputPins=pins;
 const html=await readFile(resolve(htmlArg),'utf8'),manifest=JSON.parse(await readFile(resolve(htmlArg+'.manifest.json'),'utf8')),
  envelope=JSON.parse(await readFile(resolve(envelopeArg),'utf8')),legacy=JSON.parse(await readFile(resolve(legacyArg),'utf8'));
 assert.equal(sha(html),manifest.outputSha256);assert(manifest.reconstructsBaseBytes&&manifest.existingWorkbenchAndPracticeBuildUnchanged);
 assert.deepEqual(envelope.report,legacy);assert(envelope.identity?.source?.revision===2);
 const marker='globalThis.baseballMaker = Object.freeze({';assert.equal(html.split(marker).length,2);
 const hooked=html.replace(marker,'globalThis.__envelopePhysics=()=>structuredClone(physicsResult());globalThis.__envelopeRerun=()=>simulate();\n'+marker),instrumented=resolve(out,'maker-hook.html');
 await writeFile(instrumented,hooked,{flag:'wx'});report.instrumentedSha256=sha(hooked);
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});report.browserVersion=browser.version();
 {
  const width=1200;const page=await browser.newPage({viewport:{width,height:1050}});page.on('pageerror',e=>report.errors.push(String(e)));
  page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))report.requests.push(r.url())});
  await page.goto(pathToFileURL(instrumented).href,{timeout:120000});await page.waitForFunction(()=>globalThis.baseballMaker&&globalThis.__envelopePhysics()!=null,null,{timeout:90000});
  await page.locator('#tab-player').click();assert.deepEqual(await page.evaluate(()=>baseballMaker.getContactObservationReportV191()),legacy);
  assert.deepEqual(await page.evaluate(()=>baseballMaker.getContactObservationIdentityV229()),envelope.identity);
  const before=await page.evaluate(()=>({physics:__envelopePhysics(),state:baseballMaker.getState(),sources:baseballMaker.exportSources()}));
  const invalid=await page.evaluate(({e})=>{const test=raw=>{try{baseballMaker.setContactObservationReportV191(raw,e.report.scope);return false}catch{return true}};
   return {wrongScope:test({...e,identity:{...e.identity,scope:{...e.identity.scope,playerId:'other'}}}),wrongHash:test({...e,identity:{...e.identity,currentInventoryHash:'b'.repeat(64)}}),
    report:baseballMaker.getContactObservationReportV191(),identity:baseballMaker.getContactObservationIdentityV229()};},{e:envelope});
  assert(invalid.wrongScope&&invalid.wrongHash);assert.deepEqual(invalid.report,legacy);assert.deepEqual(invalid.identity,envelope.identity);
  await page.evaluate(({legacy})=>baseballMaker.setContactObservationReportV191(legacy,legacy.scope),{legacy});
  assert.equal(await page.evaluate(()=>baseballMaker.getContactObservationIdentityV229()),null);
  await page.locator('#contact-observation-report-file-v191').setInputFiles(resolve(envelopeArg));
  await page.waitForFunction(()=>baseballMaker.getContactObservationIdentityV229()!==null,null,{timeout:30000});
  assert.deepEqual(await page.evaluate(()=>baseballMaker.getContactObservationIdentityV229()),envelope.identity);
  const after=await page.evaluate(()=>({physics:__envelopePhysics(),state:baseballMaker.getState(),sources:baseballMaker.exportSources()}));assert.deepEqual(after,before,'physical, player state or roster source changed');
  const text=await page.locator('#contact-observation-report-v191').innerText();assert(text.includes('外部記録')&&text.includes('最終登録接触時点')&&text.includes('未校正')&&text.includes('未評価'));
  const directions=await page.locator('#comparison-direction option').evaluateAll(xs=>xs.map(x=>x.value));assert.deepEqual(directions,['AUTO','PULL','CENTER','OPPOSITE']);
  assert(await page.evaluate(()=>typeof globalThis.KneekuraBattingPractice?.next==='function'&&globalThis.KneekuraObservedRegionEnabledV222===true));
  const panel=page.locator('#contact-observation-report-v191');await panel.scrollIntoViewIfNeeded();const box=await panel.boundingBox();assert(box&&box.x+box.width<=width+2);
  await page.screenshot({path:resolve(out,'maker-'+width+'.png')});report.cases.push({width,legacyAndEnvelopeImported:true,wrongScopeAndHashRejected:true,oldStatePreserved:true,directions,box});
  await page.setViewportSize({width:390,height:1050});await panel.scrollIntoViewIfNeeded();const narrow=await panel.boundingBox();assert(narrow&&narrow.x+narrow.width<=392);
  assert.deepEqual(await page.evaluate(()=>baseballMaker.getContactObservationIdentityV229()),envelope.identity);
  assert.deepEqual(await page.evaluate(()=>({physics:__envelopePhysics(),state:baseballMaker.getState(),sources:baseballMaker.exportSources()})),before,'state changed on resize');
  await page.screenshot({path:resolve(out,'maker-390.png')});report.cases.push({width:390,resizedSamePage:true,identityAndStatePreserved:true,box:narrow});await page.close();
 }
 for(const [path,pin] of Object.entries(pins))assert.equal(sha(await readFile(resolve(path))),pin,'source or artifact changed: '+path);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);report.endPins=true;report.pass=true;
}catch(e){report.error=String(e.stack??e);report.pass=false;process.exitCode=1}
finally{if(browser)await browser.close();await save('report.json',report)}
console.log(JSON.stringify({pass:report.pass,error:report.error??null}));
