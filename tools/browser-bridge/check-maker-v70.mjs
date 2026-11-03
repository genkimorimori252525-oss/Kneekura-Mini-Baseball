import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const artifact=resolve(process.argv[2]??'../../outputs/にーくら野球メーカー_v70_打者視点比較版.html'),
 evidence=resolve(process.argv[3]??'docs/verification/releases/v70/maker'),sha=x=>createHash('sha256').update(x).digest('hex'),
 {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
await mkdir(evidence,{recursive:true});
const report={pass:false,phase:'load',artifact,views:[],faults:[],scope:'v70 ordinary-game renderer/controller reuse with same-pitch v69 results, common clock, canvas-copy identity, reversible observer-only view and offline desktop/narrow integration'};
let browser;
const resultHash=page=>page.evaluate(()=>JSON.stringify(KneekuraBallComparison.getResult()));
const waitRendered=page=>page.waitForFunction(()=>{const a=KneekuraBallComparison.inspect(),b=KneekuraBatterComparisonV70.inspect();return b.ready&&b.rendered&&b.rendered.level===Number(document.getElementById('comparison-level').value)&&Math.abs(b.rendered.clockSeconds-a.clockSeconds)<1e-9;},null,{timeout:15000});
async function run(page){await page.evaluate(()=>KneekuraBallComparison.run());await waitRendered(page);}
async function seek(page,level,seconds){await page.evaluate(({level,seconds})=>{const select=document.getElementById('comparison-level');select.value=String(level);select.dispatchEvent(new Event('change'));KneekuraBallComparison.seek(seconds);},{level,seconds});await waitRendered(page);}
async function snapshot(page){return page.evaluate(async()=>{
 const ui=KneekuraBatterComparisonV70.inspect(),frame=document.getElementById('comparison-batter-frame'),w=frame.contentWindow,
  renderer=w.KneekuraMakerMatchRenderer,temp=w.document.createElement('canvas');renderer.copyToCanvas(temp);
 const details=renderer.inspect({includeRecord:true}),hostBefore=JSON.stringify(w.liveMatchPlayback.inspect().host),
  normalController=w.KneekuraCameraTuningBatterView.create(),normalSettings=normalController.inspectSettings(),
  ordinaryCamera=normalController.observe({record:details.record,frame:details.record.frames.find(f=>f.tick===details.frameTick),
   sceneMs:w.liveMatchPlayback.inspect().presentation.timing.preparationMs+details.sceneSeconds*1000,
   preparationMs:w.liveMatchPlayback.inspect().presentation.timing.preparationMs,batter:details.world.batter,previousRecord:null});
 const independent=w.document.createElement('canvas');independent.width=1200;independent.height=864;const context=independent.getContext('2d');
 context.drawImage(w.document.getElementById('field'),0,0);context.drawImage(w.document.getElementById('bat-overlay'),0,0);
 const labels=w.KneekuraNameDisplayControls.paintToCanvas(context,independent.width,independent.height);
 context.drawImage(w.document.getElementById('ball-overlay'),0,0);
 const hash=async canvas=>{const bytes=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');},
  canvas=document.getElementById('comparison-canvas-batter'),layers={};
 for(const id of ['field','bat-overlay','ball-overlay']){const layer=w.document.getElementById(id),data=layer.getContext('2d').getImageData(0,0,layer.width,layer.height).data;let alphaPixels=0;for(let i=3;i<data.length;i+=4)if(data[i])alphaPixels++;layers[id]={width:layer.width,height:layer.height,alphaPixels,sha256:await hash(layer)};}
 const actual=await hash(canvas),gameCopy=await hash(temp),independentComposite=await hash(independent);
 w.matchPreview.liveDrawWorld(details.world,details.readOnlyOptions);
 const redraw=w.document.createElement('canvas');redraw.width=1200;redraw.height=864;const redrawContext=redraw.getContext('2d');
 redrawContext.drawImage(w.document.getElementById('field'),0,0);redrawContext.drawImage(w.document.getElementById('bat-overlay'),0,0);
 const redrawLabels=w.KneekuraNameDisplayControls.paintToCanvas(redrawContext,1200,864);redrawContext.drawImage(w.document.getElementById('ball-overlay'),0,0);
 const redrawLayers={};for(const id of ['field','bat-overlay','ball-overlay'])redrawLayers[id]=await hash(w.document.getElementById(id));
 return {ui,actual,gameCopy,independentComposite,ordinaryRedraw:await hash(redraw),normalSettings,normalDefaults:w.KneekuraCameraTuningBatterView.defaults,ordinaryCamera,
  hostStable:hostBefore===JSON.stringify(w.liveMatchPlayback.inspect().host),labelCount:labels.count,labelRects:labels.rects,redrawLabelRects:redrawLabels.rects,redrawLayers,size:{width:canvas.width,height:canvas.height},layers};
 });}
function pixelEqual(s){assert.equal(s.ui.error,null);assert.equal(s.actual,s.gameCopy,'visible batter canvas must equal the ordinary-game layer copy');assert.equal(s.actual,s.independentComposite,'independent field/bat/DOM-name/ball compositing must preserve every normal layer');assert.equal(s.actual,s.ordinaryRedraw,'the ordinary game renderer must redraw the same observed world');assert.deepEqual(s.ui.renderer.cameraBase,s.ordinaryCamera,'normal controller observes the same record and clock');assert.deepEqual(s.normalSettings,s.normalDefaults,'use the ordinary batter controller default settings');assert.equal(s.hostStable,true);assert.equal(s.ui.renderer.hostUnchanged,true);assert.equal(s.ui.renderer.hostPitchCount,0);assert.equal(s.size.width,1200);assert.equal(s.size.height,864);}
try{
 const metadata=JSON.parse(await readFile(artifact+'.build.json','utf8')),pins=JSON.parse(await readFile(artifact+'.bundle-inputs.json','utf8')),
  initialRoster=JSON.parse(await readFile('docs/demos/live-game-roster-v62.json','utf8')),
  catalog=JSON.parse(await readFile('docs/demos/live-game-roster-catalog-v62.json','utf8')),
  baseline=JSON.parse(await readFile('docs/verification/releases/v69/maker/comparison-record-1200.json','utf8')),
  oldReport=JSON.parse(await readFile('docs/verification/releases/v69/maker/maker-check.json','utf8'));
 report.sha256=sha(await readFile(artifact));report.coreSha256=metadata.coreSha256;
 assert.equal(report.sha256,metadata.sha256);assert.equal(metadata.matchRendererSourceSha256,sha(await readFile('docs/demos/releases/v68/game.html')));
 assert.equal(metadata.matchRendererSourceSha256,'8b709ab3c69fc8bdc5f9980a8b66912e0b9b86f73c67970cc1bf9b37cfa6ccbc');
 assert.equal(metadata.batterComparison,true);assert.equal(metadata.coreSha256,oldReport.coreSha256,'v70 adds no new physical Core');
 for(const[path,expected]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),expected,'source pin '+path);
 report.matchRendererSourceSha256=metadata.matchRendererSourceSha256;
 // Keep readback from promoting a canvas to a different raster backend mid-check.
 // Product canvases and QA composites still pass independent exact-pixel checks.
 report.canvasBackend='software 2D from launch, --disable-accelerated-2d-canvas';
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
 for(const width of[1200,390]){
  report.phase='startup-'+width;const context=await browser.newContext({viewport:{width,height:900},hasTouch:width===390,acceptDownloads:true}),
   page=await context.newPage(),row={width,samples:[]},faults={width,errors:[],external:[]};report.views.push(row);report.faults.push(faults);
  page.setDefaultTimeout(8000);page.on('pageerror',e=>faults.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))faults.external.push(r.url());});
  await page.goto(pathToFileURL(artifact).href);await page.waitForFunction(()=>!!globalThis.KneekuraBatterComparisonV70);
  assert.deepEqual(await page.evaluate(()=>baseballMaker.getLiveRoster()),initialRoster);
  await page.locator('#comparison-jump').click();await run(page);
  const actual=await page.evaluate(()=>({input:KneekuraBallComparison.getInput(),cases:KneekuraBallComparison.getResult().cases.map(c=>({level:c.level,contact:c.pitch.contact,metrics:c.metrics,call:c.pitch.call})),invariants:KneekuraBallComparison.inspect().invariants}));
  assert.deepEqual(actual.input,baseline.input,'same default physical comparison input as v69');assert.deepEqual(actual.invariants,baseline.invariants);
  for(const c of actual.cases){const old=baseline.cases.find(x=>x.level===c.level);assert.deepEqual(c.contact,old.contact);assert.deepEqual(c.metrics,old.metrics);assert.equal(c.call,old.call);}
  const fixed=await resultHash(page);row.defaultCases=actual.cases.map(c=>({level:c.level,call:c.call,contactTick:c.contact?.tick??null}));
  report.phase='pixel-clock-'+width;
  await seek(page,2,.15);const early=await snapshot(page);pixelEqual(early);assert(early.layers['ball-overlay'].alphaPixels>0,'incoming pitch must be visibly drawn');row.samples.push({kind:'pitch',clock:.15,level:2,pixel:early.actual,layers:early.layers});
  const contact=actual.cases.find(c=>c.level===1).contact;assert(contact,'the retained default case1 must actually contact');
  const after=(contact.tick-actual.input.originTick)/1e6+.04;
  await seek(page,1,after-.06);const swing=await snapshot(page);pixelEqual(swing);assert(swing.layers['bat-overlay'].alphaPixels>0,'the pre-contact swing bat must not lose its layer');row.samples.push({kind:'swing',clock:after-.06,level:1,pixel:swing.actual,layers:swing.layers});
  await seek(page,1,after);const hit=await snapshot(page);pixelEqual(hit);row.samples.push({kind:'contact',clock:after,level:1,pixel:hit.actual,layers:hit.layers});
  await seek(page,4,.55);const miss=await snapshot(page);pixelEqual(miss);assert.equal(actual.cases[3].call,'swinging_strike');row.samples.push({kind:'miss',clock:.55,level:4,pixel:miss.actual,layers:miss.layers});
  const catchSeconds=await page.evaluate(()=>{const result=KneekuraBallComparison.getResult();return(result.cases[3].pitch.endedAtTick-result.fixedInput.originTick)/1e6+.05;});
  await seek(page,4,catchSeconds);const held=await snapshot(page);pixelEqual(held);assert.equal(held.layers['ball-overlay'].alphaPixels,0,'a secured catcher ball must remain invisible');row.samples.push({kind:'held',clock:catchSeconds,level:4,pixel:held.actual,layers:held.layers});
  await seek(page,2,.15);const rewind=await snapshot(page);pixelEqual(rewind);assert.equal(rewind.actual,early.actual,'switching levels and seeking backwards exactly reproduces ordinary-game pixels');
  assert.equal(await resultHash(page),fixed,'rendering and backseek cannot alter the four physical results');
  if(width===1200){
   const boundaries=await page.evaluate(()=>{
    const w=document.getElementById('comparison-batter-frame').contentWindow,renderer=w.KneekuraMakerMatchRenderer;
    function transition(level,test){renderer.render({level,seconds:0,playing:false});const record=renderer.inspect({includeRecord:true}).record,
      index=record.frames.findIndex(test),target=record.frames[index],previous=record.frames[index-1],origin=record.frames[0].tick,
      before=(previous.tick-origin)/1e6,after=(target.tick-origin)/1e6;
     renderer.render({level,seconds:before,playing:false});const wall=w.performance.now(),next=renderer.render({level,seconds:after,playing:true}),elapsedMs=w.performance.now()-wall,
      data=w.document.getElementById('ball-overlay').getContext('2d').getImageData(0,0,1200,864).data;let alphaPixels=0;for(let i=3;i<data.length;i+=4)if(data[i])alphaPixels++;
     return{level,before,after,elapsedMs,sceneSeconds:next.sceneSeconds,ballSeconds:next.ballSeconds,ballKind:next.ball?.ballKind??null,alphaPixels,hostUnchanged:next.hostUnchanged};}
    // Freeze only the renderer's cadence clock for these synchronous calls.
    // Physical time remains the explicit Source seconds. Even a slow software
    // redraw cannot accidentally satisfy the normal 55 ms wall-time interval.
    const descriptor=Object.getOwnPropertyDescriptor(w.performance,'now');
    try{Object.defineProperty(w.performance,'now',{value:()=>1000,configurable:true});
     return{cadenceClockFrozen:true,catch:transition(4,f=>!!f.possessedBy&&f.ball?.visible===false),contact:transition(1,f=>f.ballKind==='batted'&&f.ball?.visible===true)};
    }finally{if(descriptor)Object.defineProperty(w.performance,'now',descriptor);else delete w.performance.now;}
   });
   assert.equal(boundaries.catch.sceneSeconds,boundaries.catch.after);assert.equal(boundaries.catch.ballSeconds,boundaries.catch.after);assert.equal(boundaries.catch.alphaPixels,0);
   assert.equal(boundaries.contact.sceneSeconds,boundaries.contact.after);assert.equal(boundaries.contact.ballKind,'batted');assert.equal(boundaries.contact.hostUnchanged,true);
   assert.equal(await resultHash(page),fixed);row.playingBoundaries=boundaries;
   await seek(page,2,.15);
  }
  report.phase='observer-view-'+width;await page.evaluate(()=>KneekuraMakerHelp.hide());
  await page.locator('#comparison-batter-surface').scrollIntoViewIfNeeded();await page.waitForTimeout(60);
  const surface=page.locator('#comparison-batter-surface'),box=await surface.boundingBox();
  await page.mouse.move(box.x+box.width*.45,box.y+box.height*.45);await page.mouse.down({button:'right'});
  await page.mouse.move(box.x+box.width*.45+35,box.y+box.height*.45+20);await page.mouse.up({button:'right'});await waitRendered(page);
  const turned=await snapshot(page);pixelEqual(turned);assert(Math.abs(turned.ui.view.yawDegrees)>0);assert(Math.abs(turned.ui.view.pitchDegrees)>0);
  assert.notEqual(turned.actual,early.actual,'right drag changes the observer image');assert.equal(await resultHash(page),fixed);
  await page.locator('#comparison-batter-reset').click();await waitRendered(page);const reset=await snapshot(page);pixelEqual(reset);
  assert.deepEqual(reset.ui.view,{yawDegrees:0,pitchDegrees:0,zoom:1,panX:0,panY:0});assert.equal(reset.actual,early.actual,'reset returns the same normal batter-camera image');
  const menu=await page.evaluate(()=>{const target=document.getElementById('comparison-batter-surface'),event=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});target.dispatchEvent(event);return event.defaultPrevented;});assert.equal(menu,true);
  row.rightDragReset={rightDrag:true,surfaceContextMenuSuppressed:true,physicalResultUnchanged:true};
  if(width===1200){
   report.phase='right-curve';const right=catalog.players.find(p=>p.bats==='R'&&p.role!=='P');await page.locator('#live-roster-player').selectOption(right.playerId);
   await page.locator('#comparison-pitch-type').selectOption('curve');await run(page);await seek(page,2,.15);const rightImage=await snapshot(page);pixelEqual(rightImage);
   const rightInput=await page.evaluate(()=>KneekuraBallComparison.getInput());assert.equal(rightInput.batter.bats,'R');assert.equal(rightInput.pitchType,'curve');
   row.rightCurve={clipId:rightInput.batter.clipId,pixel:rightImage.actual};
   report.phase='take';await page.locator('#live-ability-swingDecision-approach').evaluate(element=>{for(let node=element.parentElement;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;});await page.locator('#live-ability-swingDecision-approach').selectOption('TAKE');await page.locator('#comparison-force-swing').uncheck();await run(page);
   const takes=await page.evaluate(()=>KneekuraBallComparison.getResult().cases.map(c=>({call:c.pitch.call,contact:c.pitch.contact})));assert(takes.every(c=>c.contact===null&&['ball','called_strike'].includes(c.call)));
   await seek(page,2,.55);const take=await snapshot(page);pixelEqual(take);row.take={cases:takes,pixel:take.actual};
   await page.evaluate(roster=>baseballMaker.importLiveRoster(roster),initialRoster);await page.locator('#comparison-force-swing').check();
  }
  assert.deepEqual(await page.evaluate(()=>baseballMaker.getLiveRoster()),initialRoster,'new observers never edit any of the20 player settings');
  if(width===1200){await page.locator('#live-roster-player').selectOption(catalog.players[0].playerId);await page.locator('#comparison-pitch-type').selectOption('fastball');await run(page);}
  await seek(page,1,after);await page.evaluate(()=>KneekuraBatterComparisonV70.setView({yawDegrees:0,pitchDegrees:0,zoom:2}));await waitRendered(page);
  assert.deepEqual(await page.evaluate(()=>baseballMaker.getLiveRoster()),initialRoster);
  await page.locator('#comparison-batter-panel').screenshot({path:resolve(evidence,'batter-'+width+'.png')});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no page overflow');
  const[download]=await Promise.all([page.waitForEvent('download'),page.locator('#comparison-export').click()]),packet=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.deepEqual(packet.input,baseline.input);for(const c of packet.cases)assert.deepEqual(c.metrics,baseline.cases[c.level-1].metrics);
  row.comparisonJsonUnchanged=true;assert.deepEqual(faults.errors,[]);assert.deepEqual(faults.external,[]);await context.close();
 }
 assert.equal(sha(await readFile(artifact)),report.sha256);for(const[path,expected]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),expected);
 report.pass=true;report.phase='complete';console.log(JSON.stringify({pass:true,sha256:report.sha256,coreSha256:report.coreSha256,widths:[1200,390]}));
}catch(error){report.error=String(error.stack??error);await writeFile(resolve(evidence,'maker-v70-failure-'+Date.now()+'.json'),JSON.stringify(report,null,2)+'\n');console.error(JSON.stringify({pass:false,phase:report.phase,error:String(error)}));process.exitCode=1;
}finally{if(browser)await browser.close();await writeFile(resolve(evidence,'maker-check.json'),JSON.stringify(report,null,2)+'\n');}
