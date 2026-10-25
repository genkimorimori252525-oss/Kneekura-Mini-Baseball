import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
const {chromium}=createRequire(import.meta.url)('playwright-core'),label=process.argv[2],
 sha=x=>createHash('sha256').update(x).digest('hex'),out='docs/ballpark-studio/evidence/visual-tuning-'+label,file=resolve('../../outputs/球場設計室_v3_局所密度版.html'),report={pass:false,errors:[],sha256:sha(await readFile(file))};
assert(/^[a-z0-9-]+$/.test(label??''));await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
try{
 page=await browser.newPage({viewport:{width:1280,height:1100}});page.on('pageerror',e=>report.errors.push(String(e.stack??e)));await page.goto(pathToFileURL(file).href);
 const wait=async()=>{await page.waitForFunction(()=>{const s=BallparkStudio.inspect();return s.error||(s.ready&&s.revision===s.renderedRevision);},null,{timeout:60000});const s=await page.evaluate(()=>BallparkStudio.inspect());assert(!s.error,s.error);return s;},
  pixels=async()=>sha(await page.locator('#preview').evaluate(c=>c.toDataURL())),input=async(id,value)=>{await page.locator('#'+id).evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));},value);return wait();};
 let s=await wait();await page.evaluate(()=>BallparkStudio.setCrowdPlayback({paused:true}));await page.locator('#camera').selectOption('overhead');await page.waitForTimeout(100);s=await wait();const fixed=s.renderedFixed;
 assert.equal(s.crowd.pattern,'223');assert.equal(s.crowd.loopFrames,7);assert.equal(s.architectureRender.crowd.penLengthMeters,.07);assert.equal(s.architectureRender.crowd.appearance.detail,'simple');report.defaultGroups=s.architectureRender.crowd.groups;
 await page.locator('#preview').screenshot({path:out+'/default.png'});await page.locator('.logo-settings > summary').click();
 report.factors=[];for(const factor of [5,6,7,8]){await page.locator('#detail-factor').selectOption(String(factor));s=await wait();assert.equal(s.surfaceDetailRender.zone.factor,factor);assert.deepEqual(s.renderedFixed,fixed);report.factors.push({factor,points:s.surfaceDetailRender.finePoints});}
 const dark=(await input('logo-brightness',.5),await pixels());s=await input('logo-brightness',3);assert.equal(s.logoRender.brightness,3);assert.notEqual(await pixels(),dark);report.brightnessChangesImage=true;
 await input('logo-glow',0);const unlit=await pixels();s=await input('logo-glow',1);assert.equal(s.logoRender.glow,1);assert.notEqual(await pixels(),unlit);report.glowChangesImage=true;
 await page.locator('#preview').screenshot({path:out+'/logo-8-bright-glow.png'});
 await page.locator('#camera').selectOption('stadium');await page.waitForFunction(()=>BallparkStudio.inspect().cameraProjection.eye.y>200);
 await page.locator('#roof-cutaway').uncheck();await page.waitForTimeout(80);s=await input('roof-opening',0);assert(s.cameraProjection.eye.y>s.architectureRender.roof.y);
 const closed=await pixels(),d=await page.evaluate(()=>BallparkStudio.inspect().design);
 d.architecture.logo.enabled=false;assert((await page.evaluate(d=>BallparkStudio.setDesign(d),d)).ok);await wait();assert.equal(await pixels(),closed,'closed roof hides even maximum brightness/glow');report.roofHidesMaximumGlow=true;
 await page.locator('#undo').click();await wait();await input('roof-opening',100);await page.locator('#roof-cutaway').check();await page.locator('#camera').selectOption('overhead');await page.waitForTimeout(100);await wait();
 await page.locator('#crowd-density').evaluate(e=>e.closest('details').open=true);
 s=await input('crowd-density',5);const sparse=s.architectureRender.crowd.candidateLedCells,groups=s.architectureRender.crowd.groups;assert.equal(s.architectureRender.crowd.coverage,1);
 s=await input('crowd-density',100);assert.equal(s.architectureRender.crowd.groups,groups);assert.equal(s.architectureRender.crowd.coverage,1);assert(s.architectureRender.crowd.candidateLedCells>sparse);report.ledCells={fivePercent:sparse,full:s.architectureRender.crowd.candidateLedCells,groups};
 await input('crowd-density',25);report.details=[];
 for(const detail of ['lights','simple','full']){await page.locator('#crowd-detail').selectOption(detail);s=await wait();assert.equal(s.architectureRender.crowd.appearance.detail,detail);report.details.push(await pixels());}
 assert(new Set(report.details).size>1);const big=await input('crowd-size',180);assert.equal(big.architectureRender.crowd.penLengthMeters,.07);assert.equal(big.architectureRender.crowd.appearance.size,1.8);
 await input('crowd-size',50);assert.equal((await wait()).architectureRender.crowd.penLengthMeters,.07);await input('crowd-brightness',20);const dim=await pixels();await input('crowd-brightness',150);assert.notEqual(await pixels(),dim);report.ledBrightness=true;
 const json=await page.evaluate(()=>BallparkStudio.exportJSON());await page.locator('#browser-save').click();await page.reload();s=await wait();await page.evaluate(()=>BallparkStudio.setCrowdPlayback({paused:true}));assert.equal(await page.evaluate(()=>BallparkStudio.exportJSON()),json);assert.equal(s.design.architecture.crowd.size,.5);assert.equal(s.design.architecture.logo.glow,1);report.saveRoundtrip=true;
 const old=s.design;delete old.architecture.crowd;delete old.architecture.logo.brightness;delete old.architecture.logo.glow;old.architecture.surfaceDetail.factor=3;
 assert((await page.evaluate(d=>BallparkStudio.setDesign(d),old)).ok);s=await wait();assert.equal(s.logoRender.brightness,1);assert.equal(s.logoRender.glow,0);assert(!Object.hasOwn(s.design.architecture,'crowd'));report.oldJsonPreserved=true;
 await page.locator('#dome-preset').click();await wait();for(const width of [390,320]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/layout-'+width+'.png',fullPage:true});}report.mobile=true;
 assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.error=String(e.stack??e);process.exitCode=1;if(page)await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});}
finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify(report));
