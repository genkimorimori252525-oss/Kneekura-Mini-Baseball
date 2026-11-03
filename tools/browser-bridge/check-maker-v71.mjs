import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const artifact=resolve(process.argv[2]??'../../outputs/にーくら野球メーカー_v71_バット軌道の角度調整版.html'),
 baseline=resolve('../../outputs/にーくら野球メーカー_v70_打者視点比較版.html'),evidence=resolve('docs/verification/releases/v71/maker'),
 sha=value=>createHash('sha256').update(value).digest('hex'),
 {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
await mkdir(evidence,{recursive:true});
const report={pass:false,phase:'load',artifact,views:[],faults:[],scope:'v71 display-only orbit of black measured-bat preview and three white trajectory views; v70 zero-angle equality, real pointer controls, source/physics/roster/revision invariance and offline desktop/narrow integration'};
let browser;
async function pixels(page,id){return page.evaluate(async id=>{const c=document.getElementById(id),b=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');},id);}
async function stable(page){return page.evaluate(()=>{const{previewDisplay,...state}=baseballMaker.getState(),s=KneekuraSwingMaker.inspect();return JSON.stringify({state,frame:baseballMaker.getFrame(),physics:baseballMaker.getPhysicsResult(),revision:baseballMaker.getRevision(),roster:baseballMaker.getLiveRoster(),swing:{playerId:s.playerId,clipId:s.clipId,settings:s.settings,clockMs:s.clockMs,sourceTick:s.sourceTick,samples:s.samples}});});}
async function setup(page,path){await page.goto(pathToFileURL(path).href);await page.waitForFunction(()=>globalThis.baseballMaker&&globalThis.KneekuraSwingMaker?.inspect().ready);await page.locator('#tab-bat').click();await page.evaluate(()=>{baseballMaker.seek(.18);baseballMaker.setCamera('side');KneekuraSwingMaker.seek(-20);});}
async function drag(page,id,button,dx,dy){const target=page.locator('#'+id);await target.scrollIntoViewIfNeeded();await page.evaluate(()=>KneekuraMakerHelp.hide());const r=await target.boundingBox();await page.mouse.move(r.x+r.width*.47,r.y+r.height*.45);await page.mouse.down({button});await page.mouse.move(r.x+r.width*.47+dx,r.y+r.height*.45+dy);await page.mouse.up({button});}
function commonProjection(inspect,view,pivot){const v=inspect.views[view],{a,b,depth,depthSign,scale,cx,cy}=v.projection,yaw=v.yawDegrees*Math.PI/180,pitch=v.pitchDegrees*Math.PI/180;
 const project=p=>{const u=p[a]-pivot[a],h=p[b]-pivot[b],d=(p[depth]-pivot[depth])*depthSign,
  horizontal=u*Math.cos(yaw)+d*Math.sin(yaw),back=-u*Math.sin(yaw)+d*Math.cos(yaw);
  return{x:360+(pivot[a]+horizontal-cx)*scale,y:185-(pivot[b]+h*Math.cos(pitch)-back*Math.sin(pitch)-cy)*scale};};
 assert.equal(v.samples.length,5);for(const sample of inspect.samples){const actual=v.samples.find(s=>s.level===sample.level);for(const key of ['grip','tip','sweetSpot']){const expected=project(key==='sweetSpot'?sample.sweetSpot:sample.state.pose[key]);for(const axis of ['x','y'])assert(Math.abs(actual[key][axis]-expected[axis])<1e-9,'every trajectory uses the same rotation and fit');}}
}
try{
 const metadata=JSON.parse(await readFile(artifact+'.build.json','utf8')),oldMetadata=JSON.parse(await readFile(baseline+'.build.json','utf8')),pins=JSON.parse(await readFile(artifact+'.bundle-inputs.json','utf8'));
 report.sha256=sha(await readFile(artifact));report.coreSha256=metadata.coreSha256;assert.equal(report.sha256,metadata.sha256);
 for(const field of ['coreSha256','matchRendererSourceSha256','matchRendererAdapterSha256','batterUiSha256','batterCssSha256'])assert.equal(metadata[field],oldMetadata[field],'v70 game comparison stays unchanged '+field);
 for(const[path,expected]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),expected,'source pin '+path);
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
 for(const width of [1200,390]){
  report.phase='startup-'+width;const context=await browser.newContext({viewport:{width,height:900},hasTouch:width===390}),old=await context.newPage(),page=await context.newPage(),row={width},faults={width,errors:[],external:[]};report.views.push(row);report.faults.push(faults);
  page.on('pageerror',error=>faults.errors.push(String(error)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))faults.external.push(r.url());});
  await setup(old,baseline);await setup(page,artifact);
  const oldMain=await pixels(old,'maker-scene'),initial=await pixels(page,'maker-scene');assert.equal(initial,oldMain,'zero orbit preserves the v70 black canvas exactly');
  assert.deepEqual(await page.evaluate(()=>baseballMaker.getProjection()),await old.evaluate(()=>baseballMaker.getProjection()),'zero orbit preserves old projected positions');
  const saved=await stable(page),defaultDisplay=await page.evaluate(()=>baseballMaker.getPreviewDisplay()),defaultOrbit=await page.evaluate(()=>baseballMaker.getPreviewOrbit()),jsonBefore=await page.evaluate(()=>JSON.stringify(baseballMaker.getState()));
  report.phase='black-controls-'+width;await drag(page,'maker-scene','right',36,22);const rotatedOrbit=await page.evaluate(()=>baseballMaker.getPreviewOrbit());
  assert.notDeepEqual(rotatedOrbit,defaultOrbit);assert.deepEqual(await page.evaluate(()=>baseballMaker.getPreviewDisplay()),defaultDisplay);assert.notEqual(await pixels(page,'maker-scene'),initial);assert.equal(await stable(page),saved,'orbit never edits Source or authored values');assert.equal(await page.evaluate(()=>JSON.stringify(baseballMaker.getState())),jsonBefore,'session-only orbit never appears in authored JSON');
  const contextMenu=await page.evaluate(()=>{const event=new MouseEvent('contextmenu',{cancelable:true,bubbles:true});document.getElementById('maker-scene').dispatchEvent(event);return event.defaultPrevented;});assert.equal(contextMenu,true);
  await drag(page,'maker-scene','left',22,-15);const panned=await page.evaluate(()=>baseballMaker.getPreviewDisplay());assert.notEqual(panned.panX,defaultDisplay.panX);assert.notEqual(panned.panY,defaultDisplay.panY);assert.deepEqual(await page.evaluate(()=>baseballMaker.getPreviewOrbit()),rotatedOrbit);
  await page.locator('#maker-scene').hover();await page.mouse.wheel(0,-110);const zoomed=await page.evaluate(()=>baseballMaker.getPreviewDisplay());assert(zoomed.zoom>panned.zoom);assert.equal(await stable(page),saved);
  await page.locator('#preview-zoom-reset').click();assert.deepEqual(await page.evaluate(()=>baseballMaker.getPreviewDisplay()),defaultDisplay);assert.deepEqual(await page.evaluate(()=>baseballMaker.getPreviewOrbit()),defaultOrbit);assert.equal(await pixels(page,'maker-scene'),initial,'black reset is pixel exact');assert.equal(await page.evaluate(()=>JSON.stringify(baseballMaker.getState())),jsonBefore);
  row.black={defaultPixel:initial,rightDrag:true,leftPan:true,wheelZoom:true,contextMenuSuppressed:true,resetExact:true};
  report.phase='white-controls-'+width;await page.locator('#tab-player').click();await old.locator('#tab-player').click();
  const pivot=await page.evaluate(()=>{const time=KneekuraSwingMaker.inspect().clockMs;KneekuraSwingMaker.seek(0);const p=KneekuraSwingMaker.inspect().samples[0].sweetSpot;KneekuraSwingMaker.seek(time);return p;});
  row.white=[];for(const view of ['front','side','top']){
   const id='swing-preview-'+view,zero=await pixels(page,id);assert.equal(zero,await pixels(old,id),'zero orbit preserves v70 white '+view);
   const before=await page.evaluate(()=>KneekuraSwingMaker.inspect());await drag(page,id,'right',29,17);const after=await page.evaluate(()=>KneekuraSwingMaker.inspect());
   assert.notDeepEqual(after.views[view],before.views[view]);assert.notEqual(await pixels(page,id),zero);assert.equal(await stable(page),saved,'white orbit never changes actual bat samples');
   commonProjection(after,view,pivot);
   for(const other of ['front','side','top'].filter(x=>x!==view))assert.deepEqual(after.views[other],before.views[other],'only the dragged white view rotates');
   row.white.push({view,initialPixel:zero,rightDrag:true,projection:after.views[view]});
   await page.locator('#swing-preview-reset-views').click();assert.equal(await pixels(page,id),zero,'white reset '+view+' is exact');
  }
  assert.equal(await stable(page),saved);assert.equal(await page.evaluate(()=>JSON.stringify(baseballMaker.getState())),jsonBefore);await page.locator('#player-swing-editor').screenshot({path:resolve(evidence,'white-'+width+'.png')});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');assert.deepEqual(faults.errors,[]);assert.deepEqual(faults.external,[]);await context.close();
 }
 assert.equal(sha(await readFile(artifact)),report.sha256);for(const[path,expected]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),expected,'final source pin '+path);
 report.pass=true;report.phase='complete';console.log(JSON.stringify({pass:true,sha256:report.sha256,coreSha256:report.coreSha256,widths:[1200,390]}));
}catch(error){report.error=String(error.stack??error);await writeFile(resolve(evidence,'maker-v71-failure-'+Date.now()+'.json'),JSON.stringify(report,null,2)+'\n');console.error(JSON.stringify({pass:false,phase:report.phase,error:String(error)}));process.exitCode=1;
}finally{if(browser)await browser.close();await writeFile(resolve(evidence,'maker-check.json'),JSON.stringify(report,null,2)+'\n');}
