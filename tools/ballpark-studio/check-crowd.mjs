import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {referenceDesign} from './model.mjs';
const {chromium}=createRequire(import.meta.url)('playwright-core'),
 label=process.argv[2],sha=x=>createHash('sha256').update(x).digest('hex'),out='docs/ballpark-studio/evidence/crowd-'+label,
 file=resolve('../../outputs/球場設計室_v3_局所密度版.html'),report={pass:false,errors:[],external:[],sha256:sha(await readFile(file))};
assert(/^[a-z0-9-]+$/.test(label??''));await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
try{
 page=await browser.newPage({viewport:{width:1280,height:1100}});page.on('pageerror',e=>report.errors.push(String(e.stack??e)));page.on('request',r=>{if(/^https?:/.test(r.url()))report.external.push(r.url());});
 await page.goto(pathToFileURL(file).href);await page.waitForFunction(()=>BallparkStudio?.inspect().ready&&BallparkStudio.inspect().crowd.cachedFrames===3,null,{timeout:60000});
 const state=()=>page.evaluate(()=>BallparkStudio.inspect()),png=()=>page.locator('#preview').evaluate(c=>c.toDataURL());let s=await state();assert(!s.error,s.error);
 assert.equal(s.crowd.active,true);assert.equal(s.architectureRender.crowd.groups,1920);assert.equal(s.architectureRender.crowd.mode,'tiled_clusters');assert.equal(s.architectureRender.crowd.coverage,1);assert.equal(s.architectureRender.crowd.individualWorldObjects,0);assert(s.architectureRender.crowd.visibleLedCells>0);assert.equal(s.architectureRender.crowd.penLengthMeters,.07);assert.equal(s.crowd.pattern,'223');assert.deepEqual(s.architectureRender.crowd.palette,['#b72e3d','#254f9a']);
 const fixed=s.renderedFixed,sceneRenders=s.crowd.sceneRenders,frames=new Map();
 for(let i=0;i<20;i++){const sample=await page.locator('#preview').evaluate(c=>({frame:BallparkStudio.inspect().crowd.shownFrame,png:c.toDataURL()}));frames.set(sample.frame,sha(sample.png));
  if(i<3)await page.locator('#preview').screenshot({path:out+'/moving-'+i+'.png'});await page.waitForTimeout(150);}
 assert.equal(frames.size,3);assert.equal(new Set(frames.values()).size,3);assert.equal((await state()).crowd.sceneRenders,sceneRenders,'playback blits do not rerender the world');report.frames=Object.fromEntries(frames);
 await page.locator('#crowd-play').uncheck();const paused=await state(),p0=await png();await page.waitForTimeout(550);assert.equal((await state()).crowd.blits,paused.crowd.blits);assert.equal(await png(),p0);report.pause=true;
 await page.locator('#crowd-play').check();const a=await state();await page.waitForTimeout(650);const normal=(await state()).crowd.blits-a.crowd.blits;
 assert((await page.evaluate(()=>BallparkStudio.reactCrowd({type:'hit',id:'hit-1'}))).accepted);const b=await state();await page.waitForTimeout(650);s=await state();const cheering=s.crowd.blits-b.crowd.blits;
 assert(cheering>normal+2,{normal,cheering});assert.equal(s.crowd.sceneRenders,sceneRenders);assert.equal(s.crowd.intervalMs,95);assert(!(await page.evaluate(()=>BallparkStudio.reactCrowd({type:'hit',id:'hit-1'}))).accepted);report.rates={normal,cheering,windowMs:650};
 await page.locator('#crowd-home_run').click();assert.equal((await state()).crowd.reaction,'home_run');assert.equal((await state()).crowd.intervalMs,80);
 await page.evaluate(()=>BallparkStudio.setCrowdPlayback({hidden:true}));const hidden=(await state()).crowd;await page.waitForTimeout(300);assert.equal((await state()).crowd.blits,hidden.blits);assert.equal((await state()).crowd.elapsedMs,hidden.elapsedMs);report.hiddenStopsTimer=true;
 await page.evaluate(()=>BallparkStudio.setCrowdPlayback({hidden:false,paused:true}));await page.locator('#crowd-frames').selectOption('2');await page.waitForFunction(()=>BallparkStudio.inspect().crowd.cachedFrames===2);
 s=await state();assert.equal(s.crowd.frames,2);assert.equal(s.crowd.cacheBytes,2*1200*864*4);report.twoFrames=true;report.cacheBytes=s.crowd.cacheBytes;
 const previous=s.crowd.sceneRenders,d=s.design;d.architecture.colors.red='#dd4488';assert((await page.evaluate(d=>BallparkStudio.setDesign(d),d)).ok);
 await page.waitForFunction(n=>BallparkStudio.inspect().crowd.sceneRenders>n,previous);s=await state();assert.equal(s.architectureRender.crowd.palette[0],'#dd4488');assert.deepEqual(s.renderedFixed,fixed);report.paletteInvalidatesFrames=true;
 await page.locator('#crowd-attendance').selectOption('empty');await page.waitForFunction(()=>BallparkStudio.inspect().crowd.cachedFrames===1);s=await state();assert.equal(s.architectureRender.crowd.groups,0);assert.equal(s.crowd.active,false);report.hideCrowd=true;
 await page.evaluate(d=>BallparkStudio.setDesign(d),referenceDesign());await page.waitForFunction(()=>BallparkStudio.inspect().geometry.kind==='reference_circle'&&BallparkStudio.inspect().revision===BallparkStudio.inspect().renderedRevision);
 const old=await state();await page.waitForTimeout(450);assert.equal((await state()).crowd.blits,old.crowd.blits);assert.deepEqual(old.renderedFixed,fixed);report.oldParkStopsTimer=true;
 for(const width of [390,320]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}report.mobile=true;
 const reduced=await browser.newPage({reducedMotion:'reduce'});await reduced.goto(pathToFileURL(file).href);await reduced.waitForFunction(()=>BallparkStudio?.inspect().ready);assert.equal((await reduced.evaluate(()=>BallparkStudio.inspect())).crowd.paused,true);await reduced.close();report.reducedMotion=true;
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);report.pass=true;
}catch(e){report.error=String(e.stack??e);process.exitCode=1;if(page)await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});}
finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify(report));
