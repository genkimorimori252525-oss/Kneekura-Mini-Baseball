import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {referenceDesign,symmetricDesign,validateDesign} from './model.mjs';
const {chromium}=createRequire(import.meta.url)('playwright-core'),
 label=process.argv[2],out=resolve('docs/ballpark-studio/evidence/browser-'+label),file=resolve('../../outputs/球場設計室_v3_局所密度版.html'),
 original=resolve('../../outputs/ばせぼーるlv114_TBD_vs_LAD_顔写真枠試作版.html'),sha=x=>createHash('sha256').update(x).digest('hex'),
 report={pass:false,file,sha256:sha(await readFile(file)),errors:[],external:[],widths:[]};
assert(/^[a-z0-9-]+$/.test(label??''));await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
const wait=async()=>{await page.waitForFunction(()=>{const s=globalThis.BallparkStudio?.inspect();return s?.error||(s?.ready&&s.renderedRevision===s.revision);},null,{timeout:60000});
 await page.evaluate(()=>BallparkStudio.setCrowdPlayback({paused:true}));const s=await page.evaluate(()=>BallparkStudio.inspect());assert(!s.error,s.error);return s;},
 pixels=async()=>sha(await page.locator('#preview').evaluate(c=>c.toDataURL('image/png')));
try{
 page=await browser.newPage({viewport:{width:1280,height:1100}});page.on('pageerror',e=>report.errors.push(String(e.stack??e)));page.on('request',r=>{if(/^https?:/.test(r.url()))report.external.push(r.url());});
 await page.goto(pathToFileURL(file).href,{timeout:90000});let state=await wait();
 await page.evaluate(d=>BallparkStudio.setDesign(d),referenceDesign());await page.locator('#camera').selectOption('overhead');await page.waitForTimeout(80);state=await wait();
 assert.equal(state.validation.ok,true);assert.equal(state.renderedFixed.baseDistance,27.432);assert.equal(state.renderedFixed.baseSide,.4572);
 const fixed=structuredClone(state.renderedFixed),baselineImage=await pixels();
 await page.screenshot({path:resolve(out,'desktop-reference.png'),fullPage:true});
 const engineBaseline=await page.locator('#engine').evaluate(f=>f.contentWindow.document.getElementById('field').toDataURL('image/png'));
 const plain=await browser.newPage({viewport:{width:1200,height:1100}});await plain.goto(pathToFileURL(original).href,{timeout:90000});
 await plain.waitForFunction(()=>globalThis.liveMatchPlayback?.inspect().host);await plain.evaluate(()=>document.fonts.ready);
 await plain.addScriptTag({content:await readFile('tools/ballpark-studio/preview-bridge.js','utf8')});
 const plainPixels=await plain.evaluate(g=>{const r=KneekuraBallparkRendererV1.install();r.draw(g,{camera:'overhead',zoom:1,people:true});return document.getElementById('field').toDataURL('image/png');},validateDesign(referenceDesign()).geometry);
 assert.equal(sha(engineBaseline),sha(plainPixels),'Default engine canvas is pixel-identical to the frozen original renderer');
 report.referencePixelsSha256=sha(plainPixels);report.referencePixelIdentical=true;await plain.close();
 await page.evaluate(d=>BallparkStudio.setDesign(d),symmetricDesign());state=await wait();assert.equal(state.rendererGeometry.cf,122);
 assert(Math.abs(state.rendererGeometry.lf-100)<1e-8);assert.deepEqual(state.renderedFixed,fixed);assert.notEqual(await pixels(),baselineImage);
 const design=symmetricDesign();design.name='壁高の確認';design.fencePoints[0].heightMeters=12;design.fencePoints[4].distanceMeters=104;
 await page.evaluate(d=>BallparkStudio.setDesign(d),design);state=await wait();assert.deepEqual(state.renderedFixed,fixed);
 assert.equal(state.geometry.maximumHeightMeters,12);assert(Math.abs(state.rendererGeometry.rf-104)<1e-8);
 await page.locator('#camera').selectOption('mound');await page.waitForTimeout(80);state=await wait();
 const firstCamera=state.cameraProjection;assert(firstCamera.eye&&Number.isFinite(firstCamera.eye.y));
 await page.screenshot({path:resolve(out,'desktop-tall-wall.png'),fullPage:true});
 await page.locator('#distance-LF').fill('60');state=await wait();assert(!state.validation.ok);assert(await page.locator('#error-LF').isVisible());assert(await page.locator('#download').isDisabled());
 assert.equal(await page.locator('#distance-LF').inputValue(),'60');assert.equal(state.geometry.fencePoints[0].heightMeters,12);
 await page.locator('#undo').click();state=await wait();assert(state.validation.ok);assert.equal(state.design.fencePoints[0].distanceMeters,100);
 await page.locator('#redo').click();state=await wait();assert(!state.validation.ok);await page.locator('#undo').click();await wait();
 await page.locator('#extra-points').evaluate(e=>e.open=true);await page.locator('#add-point').click();state=await wait();assert.equal(state.design.fencePoints.length,6);
 await page.locator('#remove-point').click();state=await wait();assert.equal(state.design.fencePoints.length,5);
 await page.locator('#undo').click();state=await wait();assert.equal(state.design.fencePoints.length,6);await page.locator('#redo').click();await wait();
 await page.locator('#plan [data-point="CF"]').scrollIntoViewIfNeeded();
 const cf=await page.locator('#plan [data-point="CF"]').boundingBox(),oldCf=state.design.fencePoints.find(p=>p.id==='CF').distanceMeters;
 await page.mouse.move(cf.x+cf.width/2,cf.y+cf.height/2);await page.mouse.down();await page.mouse.move(cf.x+cf.width/2,cf.y+cf.height/2-12,{steps:3});await page.mouse.up();
 state=await wait();assert(state.validation.ok);assert(state.design.fencePoints.find(p=>p.id==='CF').distanceMeters>oldCf);assert.deepEqual(state.renderedFixed,fixed);
 await page.locator('#undo').click();state=await wait();assert.equal(state.design.fencePoints.find(p=>p.id==='CF').distanceMeters,oldCf);
 const downloading=page.waitForEvent('download');await page.locator('#download').click();const download=await downloading;
 const downloaded=await readFile(await download.path(),'utf8');assert.equal(downloaded,await page.evaluate(()=>BallparkStudio.exportJSON()));
 await page.locator('#ai-mode').click();const before=await page.evaluate(()=>BallparkStudio.exportJSON());
 const illegal=JSON.parse(before);illegal.bases={first:{x:0,z:0}};await page.locator('#design-json').fill(JSON.stringify(illegal));await page.locator('#apply-json').click();
 assert((await page.locator('#json-error').innerText()).includes('共通固定'));assert.equal(await page.evaluate(()=>BallparkStudio.exportJSON()),before);
 await page.locator('#cancel-json').click();await page.locator('#human-mode').click();
 await page.locator('#load-file').setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:Buffer.from(before)});await wait();
 await page.locator('#browser-save').click();assert(await page.evaluate(()=>BallparkStudio.inspect().browserSaved));
 await page.reload();state=await wait();assert.equal(await page.evaluate(()=>BallparkStudio.exportJSON()),before);assert(state.browserSaved);
 const box=await page.locator('#preview').boundingBox(),beforeView=state.cameraProjection;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down({button:'right'});await page.mouse.move(box.x+box.width/2+60,box.y+box.height/2+10,{steps:5});await page.mouse.up({button:'right'});
 await page.waitForTimeout(100);state=await wait();assert.notDeepEqual(state.cameraProjection,beforeView);assert.deepEqual(state.renderedFixed,fixed);
 await page.locator('#reset-view').click();await page.waitForTimeout(60);await wait();
 for(const camera of ['catcher','mound','batter','fielder','overhead']){await page.locator('#camera').selectOption(camera);await page.waitForTimeout(60);state=await wait();assert(Number.isFinite(state.cameraProjection.eye.y));}
 const idle=state.renderCount;await page.waitForTimeout(300);assert.equal((await page.evaluate(()=>BallparkStudio.inspect())).renderCount,idle,'No idle redraw loop');
 for(const width of [1280,390,320]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(50);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow at '+width);
   const s=await page.evaluate(()=>BallparkStudio.inspect());assert.deepEqual(s.renderedFixed,fixed);report.widths.push({width,fixedUnchanged:true});
   await page.screenshot({path:resolve(out,'design-'+width+'.png'),fullPage:true});}
 report.readiness=true;report.fixedGeometryUnchanged=true;report.invalidInputRetained=true;report.undoRedo=true;report.addDeletePoints=true;
 report.jsonRoundtrip=true;report.fixedJsonRejected=true;report.browserSaveReload=true;report.rightDragCamera=true;report.noIdleRedraw=true;
 report.planPointDrag=true;report.jsonDownload=true;
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);assert.equal(sha(await readFile(original)),'c6f32e13eb34a3545a178b1d40db92d58ac794732d224af5ad97b37133d77a71');
 report.pass=true;
}catch(e){report.error=String(e.stack??e);if(page){report.lastState=await page.evaluate(()=>globalThis.BallparkStudio?.inspect()).catch(()=>null);await page.screenshot({path:resolve(out,'failure.png'),fullPage:true}).catch(()=>{});}process.exitCode=1;}
finally{await browser.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({pass:report.pass,error:report.error,out}));
