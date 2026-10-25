import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {referenceDesign,symmetricDesign,russianDomeDesign,validateDesign,LEGACY_SCHEMA,wallAt} from './model.mjs';
const {chromium}=createRequire(import.meta.url)('playwright-core'),
 label=process.argv[2],out=resolve('docs/ballpark-studio/evidence/dome-'+label),file=resolve('../../outputs/球場設計室_v3_局所密度版.html'),
 original=resolve('../../outputs/ばせぼーるlv114_TBD_vs_LAD_顔写真枠試作版.html'),v1=resolve('../../outputs/球場設計室_v1.html'),sha=x=>createHash('sha256').update(x).digest('hex'),
 report={pass:false,file,sha256:sha(await readFile(file)),errors:[],external:[],cameras:[],widths:[]};
assert(/^[a-z0-9-]+$/.test(label??''));await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
const wait=async()=>{await page.waitForFunction(()=>{const s=globalThis.BallparkStudio?.inspect();return s?.error||(s?.ready&&s.renderedRevision===s.revision);},null,{timeout:60000});
 await page.evaluate(()=>BallparkStudio.setCrowdPlayback({paused:true}));const s=await page.evaluate(()=>BallparkStudio.inspect());assert(!s.error,s.error);return s;},
 pixels=async()=>sha(await page.locator('#preview').evaluate(c=>c.toDataURL('image/png'))),
 settle=async()=>{await page.waitForTimeout(70);return wait();};
try{
 page=await browser.newPage({viewport:{width:1280,height:1100}});page.on('pageerror',e=>report.errors.push(String(e.stack??e)));page.on('request',r=>{if(/^https?:/.test(r.url()))report.external.push(r.url());});
 await page.goto(pathToFileURL(file).href,{timeout:90000});let state=await wait();assert(state.validation.ok);
 const fixed=structuredClone(state.renderedFixed);assert.equal(fixed.baseDistance,27.432);assert.equal(fixed.baseSide,.4572);
 assert(Math.abs(state.rendererGeometry.rf-105)<1e-8);assert.equal(state.rendererGeometry.cf,128);assert.equal(state.architectureRender.capacity,120000);
 assert.equal(state.architectureRender.roof.openingPercent,100);assert(state.architectureRender.triangles>0);report.mesh=state.architectureRender;
 assert.equal(state.design.foul.firstSideMeters,18.288);assert.equal(state.logoRender.mode,'fine');assert.equal(state.logoRender.glyph,'gold_wolf_image_v1');assert(state.logoRender.cells>0);report.logo=state.logoRender;
 assert.equal(state.surfaceDetailRender.raster,'shared_circle_dots');assert(state.surfaceDetailRender.fineGrassPoints>state.surfaceDetailRender.fineLogoPoints);
 assert(state.surfaceDetailRender.transitionPoints>0);report.surface=state.surfaceDetailRender;
 for(const box of state.renderedFixed.coachesBoxes)for(const p of box)assert(wallAt(state.geometry,Math.atan2(p.x,p.z)).distanceMeters-Math.hypot(p.x,p.z)>2,'coach box remains inside the playing boundary');
 report.infieldSeatsAndCoachClearance=true;
 await page.screenshot({path:resolve(out,'open-cutaway.png'),fullPage:true});await page.locator('#preview').screenshot({path:resolve(out,'scene-open.png')});
 const openHash=await pixels();
 await page.locator('#roof-cutaway').uncheck();state=await settle();assert.equal(state.architectureRender.roof.cutaway,false);
 const fullOpen=await pixels();await page.locator('#preview').screenshot({path:resolve(out,'scene-open-full-roof.png')});
 await page.locator('#roof-opening').evaluate(e=>{e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}));});state=await settle();assert.equal(state.architectureRender.roof.openingPercent,0);
 assert.notEqual(await pixels(),fullOpen);assert.deepEqual(state.renderedFixed,fixed);await page.locator('#preview').screenshot({path:resolve(out,'scene-closed.png')});
 const closedPixels=await pixels(),withoutLogo=structuredClone(state.design);withoutLogo.architecture.logo.enabled=false;
 await page.evaluate(d=>BallparkStudio.setDesign(d),withoutLogo);await settle();assert.equal(await pixels(),closedPixels,'closed roof occludes the whole fine-density ground layer');
 await page.evaluate(()=>BallparkStudio.undo());await settle();
 await page.locator('#undo').click();state=await settle();assert.equal(state.design.architecture.roof.openingPercent,100);assert.equal(await pixels(),fullOpen);
 await page.locator('#redo').click();state=await settle();assert.equal(state.design.architecture.roof.openingPercent,0);await page.locator('#undo').click();await settle();
 await page.locator('#roof-cutaway').check();await settle();assert.equal(await pixels(),openHash);report.roofOpenCloseUndo=true;
 await page.locator('.logo-settings').evaluate(e=>e.open=true);await page.locator('#logo-fine').uncheck();state=await settle();assert.equal(state.logoRender.mode,'dots');assert(state.logoRender.cells>0);
 assert.equal(state.surfaceDetailRender.zone,null);
 await page.locator('#logo-enabled').uncheck();state=await settle();assert.equal(state.logoRender,null);await page.locator('#logo-enabled').check();await settle();await page.locator('#logo-fine').check();state=await settle();assert.equal(state.logoRender.mode,'fine');report.logoToggle=true;
 const densityImage=await pixels();await page.locator('#detail-factor').selectOption('4');state=await settle();assert.equal(state.surfaceDetailRender.zone.factor,4);assert.notEqual(await pixels(),densityImage);
 assert.deepEqual(state.renderedFixed,fixed);await page.locator('#detail-factor').selectOption('3');await settle();report.surfaceDensityControls=true;
 await page.locator('#color-red').evaluate(e=>{e.value='#d33c50';e.dispatchEvent(new Event('change',{bubbles:true}));});state=await settle();assert.equal(state.design.architecture.colors.red,'#d33c50');assert.notEqual(await pixels(),openHash);assert.deepEqual(state.renderedFixed,fixed);report.colors=true;
 await page.locator('#capacity').fill('0');state=await settle();assert(!state.validation.ok);assert(await page.locator('#architecture-error').isVisible());assert(await page.locator('#download').isDisabled());assert.equal(state.geometry.architecture.capacity,120000);
 await page.locator('#undo').click();state=await settle();assert(state.validation.ok);report.localErrors=true;
 // Warm the original park cache, then edit twice without changing camera or maximum wall height.
 await page.evaluate(d=>BallparkStudio.setDesign(d),symmetricDesign());await settle();await page.locator('#camera').selectOption('overhead');await settle();
 await page.locator('#people').uncheck();await settle();await page.locator('#people').check();await settle();
 let previous=await pixels();for(const rf of [110,115]){await page.evaluate(n=>BallparkStudio.updatePoint('RF',{distanceMeters:n}),rf);state=await settle();assert(state.validation.ok);assert.notEqual(await pixels(),previous);previous=await pixels();assert.deepEqual(state.renderedFixed,fixed);}report.boundaryCacheInvalidation=true;
 // The architectural extension is opt-in; the old baseline renderer remains exact.
 const reference=referenceDesign();reference.schema=LEGACY_SCHEMA;await page.evaluate(d=>BallparkStudio.setDesign(d),reference);state=await settle();assert.equal(state.architectureRender,null);
 const engineBaseline=await page.locator('#engine').evaluate(f=>f.contentWindow.document.getElementById('field').toDataURL('image/png')),
  plain=await browser.newPage({viewport:{width:1200,height:1100}});await plain.goto(pathToFileURL(original).href,{timeout:90000});await plain.waitForFunction(()=>globalThis.liveMatchPlayback?.inspect().host);await plain.evaluate(()=>document.fonts.ready);
 await plain.addScriptTag({content:await readFile('tools/ballpark-studio/preview-bridge.js','utf8')});
 const plainPixels=await plain.evaluate(g=>{const r=KneekuraBallparkRendererV1.install();r.draw(g,{camera:'overhead',zoom:1,people:true});return document.getElementById('field').toDataURL('image/png');},validateDesign(reference).geometry);
 assert.equal(sha(engineBaseline),sha(plainPixels));report.referencePixelIdentical=true;await plain.close();
 await page.locator('#dome-preset').click();await page.locator('#camera').selectOption('stadium');state=await settle();
 const before=await page.evaluate(()=>BallparkStudio.exportJSON());const downloading=page.waitForEvent('download');await page.locator('#download').click();assert.equal(await readFile(await (await downloading).path(),'utf8'),before);
 await page.locator('#load-file').setInputFiles({name:'dome.json',mimeType:'application/json',buffer:Buffer.from(before)});await settle();
 await page.locator('#browser-save').click();await page.reload();state=await wait();assert.equal(await page.evaluate(()=>BallparkStudio.exportJSON()),before);assert(state.browserSaved);report.saveRoundtrip=true;
 // API validation uses the same contract as the human UI.
 const bad=russianDomeDesign();bad.architecture.roof.openingPercent=200;assert.equal((await page.evaluate(d=>BallparkStudio.setDesign(d),bad)).ok,false);assert.equal(await page.evaluate(()=>BallparkStudio.exportJSON()),before);
 for(const camera of ['stadium','overhead','catcher','mound','batter','fielder']){await page.locator('#camera').selectOption(camera);state=await settle();assert.deepEqual(state.renderedFixed,fixed);assert(Number.isFinite(state.cameraProjection.eye.y));
  report.cameras.push({camera,triangles:state.architectureRender.triangles,candidateCells:state.architectureRender.candidateCells});await page.locator('#preview').screenshot({path:resolve(out,'camera-'+camera+'.png')});}
 await page.locator('#camera').selectOption('stadium');state=await settle();await page.locator('#preview').scrollIntoViewIfNeeded();
 const box=await page.locator('#preview').boundingBox(),beforeCamera=state.cameraProjection;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down({button:'right'});await page.mouse.move(box.x+box.width/2+50,box.y+box.height/2+10,{steps:4});await page.mouse.up({button:'right'});state=await settle();assert.notDeepEqual(state.cameraProjection,beforeCamera);assert.deepEqual(state.renderedFixed,fixed);
 await page.locator('#reset-view').click();state=await settle();const idle=state.renderCount;await page.waitForTimeout(300);assert.equal((await page.evaluate(()=>BallparkStudio.inspect())).renderCount,idle);report.noIdleRedraw=true;
 for(const width of [1280,390,320]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(50);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Overflow '+width);report.widths.push(width);await page.screenshot({path:resolve(out,'layout-'+width+'.png'),fullPage:true});}
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);assert.equal(sha(await readFile(original)),'c6f32e13eb34a3545a178b1d40db92d58ac794732d224af5ad97b37133d77a71');
 assert.equal(sha(await readFile(v1)),'0b97ab18f3639b2f086405e3574ff47cec9954780af58c2aa379aa3ceeb48a20');report.v1AndOriginalUnchanged=true;report.fixedGeometryUnchanged=true;report.pass=true;
}catch(e){report.error=String(e.stack??e);if(page){report.lastState=await page.evaluate(()=>globalThis.BallparkStudio?.inspect()).catch(()=>null);await page.screenshot({path:resolve(out,'failure.png'),fullPage:true}).catch(()=>{});}process.exitCode=1;}
finally{await browser.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({pass:report.pass,error:report.error,out}));
