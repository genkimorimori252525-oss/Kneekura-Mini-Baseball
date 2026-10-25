import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
const {chromium}=createRequire(import.meta.url)('playwright-core'),label=process.argv[2],
 sha=x=>createHash('sha256').update(x).digest('hex'),out='docs/ballpark-studio/evidence/attendance-'+label,file=resolve('../../outputs/球場設計室_v3_局所密度版.html'),report={pass:false,errors:[],sha256:sha(await readFile(file))};
assert(/^[a-z0-9-]+$/.test(label??''));await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
const ready=async p=>{await p.waitForFunction(()=>{const s=BallparkStudio.inspect();return s.error||(s.ready&&s.revision===s.renderedRevision);},null,{timeout:60000});const s=await p.evaluate(()=>BallparkStudio.inspect());assert(!s.error,s.error);return s;},
 pixels=p=>p.locator('#preview').evaluate(c=>c.toDataURL()),logo=p=>p.locator('#preview').evaluate(c=>Array.from(c.getContext('2d').getImageData(500,240,200,120).data));
try{
 page=await browser.newPage({viewport:{width:1280,height:1100}});page.on('pageerror',e=>report.errors.push(String(e.stack??e)));await page.goto(pathToFileURL(file).href);let s=await ready(page);
 await page.evaluate(()=>BallparkStudio.setCrowdPlayback({paused:true}));await page.locator('#camera').selectOption('overhead');await page.waitForFunction(()=>BallparkStudio.inspect().cameraProjection.eye.y===100);s=await ready(page);
 const full=await pixels(page),approvedLogo=await logo(page),fixed=s.renderedFixed,common=s.design;assert.equal(s.architectureRender.crowd.attendance,'full');await page.locator('#preview').screenshot({path:out+'/full.png'});
 await page.locator('#crowd-attendance').selectOption('empty');s=await ready(page);assert.equal(s.design.architecture.crowd.attendance,'empty');assert.equal(s.architectureRender.crowd.groups,0);assert.equal(s.architectureRender.crowd.visibleLedCells,0);assert.equal(s.crowd.active,false);assert.equal(s.crowd.cachedFrames,1);
 const seats=await pixels(page);assert.notEqual(seats,full);assert.deepEqual(await logo(page),approvedLogo);assert.deepEqual(s.renderedFixed,fixed);await page.locator('#preview').screenshot({path:out+'/empty-original-seats.png'});
 const blits=s.crowd.blits;await page.waitForTimeout(400);assert.equal((await page.evaluate(()=>BallparkStudio.inspect())).crowd.blits,blits);report.emptyStopsAnimation=true;
 // Architecture intentionally changed; compare the saved empty mode with the same renderer's original seat-material path.
 const emptyDesign=s.design;
 assert((await page.evaluate(d=>BallparkStudio.setDesign(d),common)).ok);await ready(page);await page.evaluate(()=>BallparkStudio.setCrowdPlayback({paused:true,visible:false}));await page.waitForTimeout(150);await ready(page);
 assert.equal(await pixels(page),seats,'empty mode uses the original seat material without crowd tint');report.sameRendererSeatPixelsIdentical=true;
 assert((await page.evaluate(d=>BallparkStudio.setDesign(d),emptyDesign)).ok);await ready(page);
 await page.locator('#undo').click();s=await ready(page);assert.equal(s.architectureRender.crowd.attendance,'full');assert.equal(await pixels(page),full);
 await page.locator('#redo').click();s=await ready(page);assert.equal(s.architectureRender.crowd.attendance,'empty');assert.equal(await pixels(page),seats);report.undoRedo=true;
 const color=s.design;color.architecture.colors.red='#ee2244';assert((await page.evaluate(d=>BallparkStudio.setDesign(d),color)).ok);await ready(page);assert.notEqual(await pixels(page),seats);await page.locator('#undo').click();await ready(page);assert.equal(await pixels(page),seats);report.emptySeatsFollowTheme=true;
 const json=await page.evaluate(()=>BallparkStudio.exportJSON());assert.equal(JSON.parse(json).architecture.crowd.attendance,'empty');await page.locator('#browser-save').click();await page.reload();s=await ready(page);assert.equal(await page.evaluate(()=>BallparkStudio.exportJSON()),json);assert.equal(s.crowd.visible,false);assert.equal(s.architectureRender.crowd.attendance,'empty');assert.equal(await page.locator('#crowd-attendance').inputValue(),'empty');assert(await page.locator('#crowd-hit').isDisabled());report.saveReload=true;
 await page.locator('#crowd-attendance').selectOption('full');s=await ready(page);assert.equal(s.crowd.visible,true);assert.equal(s.architectureRender.crowd.groups,1920);assert.equal(s.design.architecture.crowd.attendance,'full');report.fullRestored=true;
 for(const width of [390,320]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}report.mobile=true;
 const legacy=s.design;delete legacy.architecture.crowd.attendance;assert((await page.evaluate(d=>BallparkStudio.setDesign(d),legacy)).ok);s=await ready(page);assert.equal(s.architectureRender.crowd.attendance,'full');assert(!Object.hasOwn(s.design.architecture.crowd,'attendance'));report.legacyWithoutMutation=true;
 assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.error=String(e.stack??e);process.exitCode=1;if(page)await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});}
finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify(report));
