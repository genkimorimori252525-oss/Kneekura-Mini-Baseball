import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const artifact=resolve(process.argv[2]),out=resolve(process.argv[3]),sha=v=>createHash('sha256').update(v).digest('hex');
const bytes=await readFile(artifact),meta=JSON.parse(await readFile(artifact+'.build.json')),
 old=JSON.parse(await readFile('docs/demos/releases/v84/maker.html.build.json'));
assert.equal(sha(bytes),meta.sha256);assert.equal(meta.makerGuidesVersion,85);assert.equal(meta.unspunComparisonDefault,false);
for(const key of ['coreSha256','referenceSha256','liveRosterSha256','liveRosterCatalogSha256','matchRendererSourceSha256','embeddedMatchRendererSha256','embeddedPitcherRendererSha256'])assert.equal(meta[key],old[key],key+' retained');
for(const [path,expected]of Object.entries(meta.makerGuideSources))assert.equal(sha(await readFile(path)),expected,path);
await mkdir(out,{recursive:true});
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'),
 report={pass:false,artifact,sha256:sha(bytes),coreSha256:meta.coreSha256,normalRendererUnchanged:true,cases:[],faults:[]};let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
 for(const [width,dpr]of [[1200,1],[390,2]]){
  const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:dpr}),faults={width,errors:[],external:[]};report.faults.push(faults);
  page.on('pageerror',e=>faults.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))faults.external.push(r.url());});
  await page.goto(pathToFileURL(artifact).href,{timeout:60000});await page.waitForFunction(()=>globalThis.KneekuraMakerGuidesV85?.inspect().installed);
  const before=await page.evaluate(()=>({roster:JSON.stringify(baseballMaker.getLiveRoster()),trial:JSON.stringify(KneekuraPitcherMakerV78.getResult())})),row={width,dpr,topics:[]};
  assert.equal(await page.locator('.maker-guide-card-v85').count(),4);
  await page.evaluate(()=>KneekuraMakerGuidesV85.install());assert.equal(await page.locator('.maker-guide-card-v85').count(),4,'idempotent help install');
  for(const [tab,kind]of [['tab-player','player'],['tab-bat','bat'],['tab-pitcher','pitcher']]){
   await page.locator('#'+tab).click();
   const guide=page.locator('#maker-guide-'+kind+'-v85');
   const visibility=await page.evaluate(()=>({editor:document.getElementById('live-public-editor').hidden,player:document.getElementById('player-panel').hidden,bat:document.getElementById('bat-panel').hidden}));
   assert(await guide.isVisible(),kind+' guide visible: '+JSON.stringify({visibility,ancestors:await guide.evaluate(e=>{const rows=[];while(e){rows.push({id:e.id,tag:e.tagName,hidden:e.hidden,display:getComputedStyle(e).display,box:e.getBoundingClientRect().toJSON()});e=e.parentElement;}return rows;})}));
   for(const topic of await guide.locator('[role=tab]').all()){
    await topic.click();const id=await topic.getAttribute('id'),text=await guide.locator('[role=tabpanel]').innerText();
    assert(text.length>80);assert.equal(await topic.getAttribute('aria-selected'),'true');assert.equal(await guide.locator('[role=tabpanel]').getAttribute('aria-labelledby'),id);row.topics.push(id);
   }
   const first=guide.locator('[role=tab]').first();await first.click();await first.focus();await page.keyboard.press('ArrowRight');assert.equal(await guide.locator('[role=tab]').nth(1).getAttribute('aria-selected'),'true');
   await page.keyboard.press('End');assert.equal(await guide.locator('[role=tab]').last().getAttribute('aria-selected'),'true');
  }
  await page.locator('#pitcher-library-tab').click();const library=page.locator('#maker-guide-library-v85');assert(await library.isVisible());
  for(const topic of await library.locator('[role=tab]').all()){await topic.click();assert((await library.locator('[role=tabpanel]').innerText()).length>80);}
  await page.locator('#pitcher-tuning-tab').click();
  assert.deepEqual(await page.evaluate(()=>({roster:JSON.stringify(baseballMaker.getLiveRoster()),trial:JSON.stringify(KneekuraPitcherMakerV78.getResult())})),before,'help must not edit source or generate a trial');
  await page.locator('#pitcher-pitch-details').evaluate(e=>e.open=true);
  for(const [id,value]of [['pitcher-pitch-rpm','2400.123456789'],['pitcher-pitch-gyro','-0.0319468845395']]){
   const input=page.locator('#'+id);await input.fill(value);await input.dispatchEvent('input');await input.focus();assert.equal(await input.inputValue(),value,'full draft precision');
  }
  await page.waitForFunction(()=>document.querySelector('#maker-guide-pitcher-v85 output')?.textContent.includes('2400.1rpm'));
  const guideText=await page.locator('#maker-guide-pitcher-v85 [role=tabpanel]').innerText();assert(guideText.includes('3.2%')&&guideText.includes('設定時の目安'));
  assert.equal((await page.evaluate(()=>KneekuraMakerGuidesV85.inspect())).topics.pitcher,'gyro');
  await page.locator('#pitcher-pitch-apply').click();
  row.saved=await page.evaluate(()=>{const api=KneekuraPitcherMakerV78,s=api.inspect(),entry=baseballMaker.getLiveRoster().entries.find(e=>e.playerId===s.pitcherId),
   r=KneekuraBaseballWorkbench.resolvePitcherRepertoireV78(entry.physical).find(r=>r.pitchId===s.pitchId);return {controls:KneekuraBaseballWorkbench.pitchSpinToControlsV77(r.spinRadPerSecond),pending:s.pending,error:s.error};});
  assert.equal(row.saved.error,null);assert.equal(row.saved.pending.length,0);assert(Math.abs(row.saved.controls.spinRpm-2400.123456789)<1e-8);assert(Math.abs(row.saved.controls.gyroFraction+.0319468845395)<1e-12);
  await page.locator('#pitcher-pitch-gyro').focus();await page.locator('#maker-guide-pitcher-v85').scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(out,'pitcher-guide-'+width+'.png')});
   await page.locator('#pitcher-seam-enabled').evaluate(e=>{for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});
   await page.locator('#pitcher-seam-enabled').focus();assert.equal((await page.evaluate(()=>KneekuraMakerGuidesV85.inspect())).topics.pitcher,'seams');
  await page.locator('#tab-player').click();await page.locator('#maker-guide-player-v85').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'player-guide-'+width+'.png')});
  row.layout=await page.evaluate(()=>({inner:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,controls:KneekuraPresentationControlsV84.inspect()}));
  assert(row.layout.scroll<=row.layout.client+1,'no horizontal overflow');assert.equal(row.layout.controls.qualityScale,1.2);assert.equal(row.layout.controls.frequencyScale,2);
  assert.deepEqual(faults.errors,[]);assert.deepEqual(faults.external,[]);report.cases.push(row);await page.close();
 }
 assert.equal(sha(await readFile(artifact)),report.sha256);report.pass=true;console.log(JSON.stringify({pass:true,cases:report.cases.length,precisionPreserved:true}));
}catch(error){report.error=String(error.stack??error);throw error;}finally{await browser?.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
