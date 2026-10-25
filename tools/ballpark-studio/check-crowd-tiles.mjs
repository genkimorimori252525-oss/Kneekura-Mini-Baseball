import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
const {chromium}=createRequire(import.meta.url)('playwright-core'),label=process.argv[2],
 sha=x=>createHash('sha256').update(x).digest('hex'),out='docs/ballpark-studio/evidence/crowd-blocks-'+label,file=resolve('../../outputs/球場設計室_v3_局所密度版.html'),report={pass:false,errors:[],sha256:sha(await readFile(file))};
assert(/^[a-z0-9-]+$/.test(label??''));await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
const ready=async p=>{await p.waitForFunction(()=>{const s=BallparkStudio.inspect();return s.error||(s.ready&&s.revision===s.renderedRevision);},null,{timeout:60000});const s=await p.evaluate(()=>BallparkStudio.inspect());assert(!s.error,s.error);return s;},
 pixels=p=>p.locator('#preview').evaluate(c=>c.toDataURL()),logoPixels=p=>p.locator('#preview').evaluate(c=>Array.from(c.getContext('2d').getImageData(500,240,200,120).data));
async function setting(p,d){assert((await p.evaluate(d=>BallparkStudio.setDesign(d),d)).ok);return ready(p);}
try{
 page=await browser.newPage({viewport:{width:1280,height:1100}});page.on('pageerror',e=>report.errors.push(String(e.stack??e)));await page.goto(pathToFileURL(file).href);let s=await ready(page);
 await page.evaluate(()=>BallparkStudio.setCrowdPlayback({paused:true}));await page.locator('#camera').selectOption('overhead');await page.waitForFunction(()=>BallparkStudio.inspect().cameraProjection.eye.y===100);s=await ready(page);
 assert.equal(s.architectureRender.crowd.mode,'tiled_clusters');assert.equal(s.architectureRender.crowd.groups,1920);assert.equal(s.architectureRender.crowd.coverage,1);assert.equal(s.architectureRender.crowd.individualWorldObjects,0);assert(s.architectureRender.crowd.visibleLedCells>50);
 report.crowd=s.architectureRender.crowd;await page.locator('#preview').screenshot({path:out+'/packed-glowing.png'});
 const d=s.design;d.architecture.crowd.glow=0;await setting(page,d);const dark=await pixels(page);d.architecture.crowd.glow=1;await setting(page,d);assert.notEqual(await pixels(page),dark);report.actualGlowChangesPixels=true;
 d.architecture.crowd.density=.05;s=await setting(page,d);const dim=s.architectureRender.crowd.candidateLedCells;assert.equal(s.architectureRender.crowd.coverage,1);
 d.architecture.crowd.density=1;s=await setting(page,d);assert.equal(s.architectureRender.crowd.groups,1920);assert.equal(s.architectureRender.crowd.coverage,1);assert(s.architectureRender.crowd.candidateLedCells>dim);report.densityDoesNotEmptyStands=true;
 // The requested architecture change invalidates old whole-building equality; approved ground pixels remain exact.
 const old=await browser.newPage({viewport:{width:1280,height:1100}});await old.goto(pathToFileURL(resolve('../../outputs/球場設計室_v3_群衆タイル変更前.html')).href);await ready(old);
 delete d.architecture.details;delete d.architecture.scoreboard;delete d.architecture.crowd.glow;delete d.architecture.crowd.attendance;await setting(page,d);await setting(old,d);
 for(const p of [page,old]){await p.evaluate(()=>BallparkStudio.setCrowdPlayback({paused:true,visible:false}));await p.locator('#camera').selectOption('overhead');await p.waitForTimeout(150);await ready(p);}
 assert.notEqual(sha(await pixels(page)),sha(await pixels(old)),'new world architecture intentionally changes the whole-building image');
 assert.deepEqual(await logoPixels(page),await logoPixels(old),'approved ground region stays identical with crowd off');report.approvedGroundIdenticalWithCrowdOff=true;report.requestedArchitectureChangesPixels=true;
 for(const p of [page,old]){await p.evaluate(()=>BallparkStudio.setCrowdPlayback({visible:true}));await p.waitForTimeout(150);await ready(p);}
 assert.deepEqual(await logoPixels(page),await logoPixels(old),'the user-approved logo is untouched');report.logoPixelsUnchanged=true;await old.close();
 await page.locator('#camera').selectOption('stadium');await page.waitForFunction(()=>BallparkStudio.inspect().cameraProjection.eye.y>200);await page.locator('#roof-cutaway').uncheck();await page.waitForTimeout(100);
 d.architecture.roof.openingPercent=0;d.architecture.crowd.glow=1;s=await setting(page,d);assert.equal(s.architectureRender.crowd.visibleLedCells,0);
 const roof=await pixels(page);await page.evaluate(()=>BallparkStudio.setCrowdPlayback({visible:false}));await page.waitForTimeout(150);await ready(page);assert.equal(await pixels(page),roof);report.closedRoofHidesCrowdGlow=true;
 d.architecture.roof.openingPercent=100;d.architecture.crowd.glow=.4;await setting(page,d);await page.locator('#browser-save').click();const json=await page.evaluate(()=>BallparkStudio.exportJSON());await page.reload();s=await ready(page);assert.equal(await page.evaluate(()=>BallparkStudio.exportJSON()),json);assert.equal(s.design.architecture.crowd.glow,.4);report.glowSaved=true;
 for(const width of [390,320]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}report.mobile=true;
 assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.error=String(e.stack??e);process.exitCode=1;if(page)await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});}
finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify(report));
