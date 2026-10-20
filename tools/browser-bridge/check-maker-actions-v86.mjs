import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'),
 file=resolve(process.argv[2]),out=resolve(process.argv[3]),sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:true});const report={pass:false,sha256:sha(await readFile(file)),cases:[],faults:[]};let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),faults={width,errors:[],external:[]};report.faults.push(faults);
  page.on('pageerror',e=>faults.errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))faults.external.push(r.url());});
  await page.goto(pathToFileURL(file).href);await page.waitForFunction(()=>globalThis.KneekuraPitcherMakerV78);
  await page.locator('#tab-pitcher').click();await page.locator('#pitcher-library-tab').click();
  const rpm=page.locator('#pitcher-library-rpm');await rpm.fill('');await page.locator('#pitcher-library-save').click();
  assert.equal(await rpm.getAttribute('aria-invalid'),'true');assert(await rpm.locator('..').locator('[data-maker-local-message].error').isVisible());
  await page.screenshot({path:resolve(out,'library-error-'+width+'.png')});
  await page.locator('#pitcher-library-discard').click();assert.equal(await rpm.getAttribute('aria-invalid'),'false');assert.notEqual(await rpm.inputValue(),'');
  await rpm.fill('');await page.locator('#pitcher-library-save').click();await rpm.fill('2300.123456');await page.locator('#pitcher-library-save').click();
  assert.equal(await rpm.getAttribute('aria-invalid'),'false');assert.equal(await page.evaluate(()=>KneekuraPitcherMakerV78.inspect().libraryDirty),false);
  assert.equal(await page.locator('#pitcher-library-status').getAttribute('class').then(s=>s.includes('error')),false);
  await page.locator('#pitcher-tuning-tab').click();const seed=page.locator('#pitcher-seed');await seed.fill('');await page.locator('#pitcher-next').click();
  assert.equal(await seed.getAttribute('aria-invalid'),'true');await seed.fill('20261021');assert.equal(await seed.getAttribute('aria-invalid'),'false');
  await page.locator('#tab-course-v79').click();
  await page.locator('#course-season-id-v79').fill('v86-season');await page.locator('#course-season-name-v79').fill('v86検証');
  await page.locator('#course-value-v79').fill('0.31');await page.locator('#course-apply-v79').click();
  let pending=await page.evaluate(()=>KneekuraBatterMakerV79.inspect().pending.map(x=>x.id));assert(pending.includes('course-season-id-v79'));assert(!pending.includes('course-value-v79'));
  assert.equal(await page.locator('#course-season-name-v79').inputValue(),'v86検証');
  await page.locator('#course-season-create-v79').click();assert.equal(await page.evaluate(()=>KneekuraBatterMakerV79.inspect().pending.length),0);
  assert.equal(await page.evaluate(()=>KneekuraBatterMakerV79.inspect().seasonId),'v86-season');
  const attempts=page.locator('#course-trial-attempts-v79');await attempts.fill('0');await page.locator('#course-trial-v79').click();
  assert.equal(await attempts.getAttribute('aria-invalid'),'true');await attempts.fill('20');assert.equal(await attempts.getAttribute('aria-invalid'),'false');
  assert.equal(await page.evaluate(()=>KneekuraBatterMakerV79.inspect().error),'');
  assert.deepEqual(faults.errors,[]);assert.deepEqual(faults.external,[]);report.cases.push({width,libraryDiscard:true,librarySaveRecovery:true,seedRecovery:true,independentCourseGroups:true,courseNumericRecovery:true});
  await page.close();
 }
 assert.equal(sha(await readFile(file)),report.sha256);report.pass=true;console.log(JSON.stringify({pass:true,viewports:2,actionPaths:10}));
}catch(error){report.error=String(error.stack??error);throw error;}finally{await browser?.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
