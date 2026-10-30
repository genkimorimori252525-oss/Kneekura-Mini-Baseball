import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.V30_PLAYWRIGHT_CORE??'C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const artifact=resolve('dist/ばせぼーるlv30_TBD_vs_LAD_ドット球と名前修正版.html');
const evidence=resolve('dist/v30-evidence'),nativeEnabled=process.argv.includes('--native');
await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.V30_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={viewports:[],nativeEnabled,source:'RENDERER_ONLY_FIXTURE_CHECKS_PLUS_ACTUAL_NATIVE_IF_ENABLED'};
try{
 for(const viewport of [{width:1200,height:860},{width:390,height:844}]){
  const page=await browser.newPage({viewport}),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('request',request=>{if(!request.url().startsWith('file:'))requests.push(request.url());});
  await page.goto(pathToFileURL(artifact).href);
  await page.waitForFunction(()=>!!window.matchPreview);
  await page.evaluate(()=>document.fonts.ready);
  const initial=await page.evaluate(()=>{
   const api=window.matchPreview,checks=[];
   const check=(name,ok,data=null)=>{if(!ok)throw new Error(name+': '+JSON.stringify(data));checks.push({name,result:'PASS',data});};
   check('presentation version30',api.presentationVersion===30);
   const before=api.inspect();api.fastFinish();
   const pitches=api.recording.pitches;
   const seek=(p,t,camera)=>{api.setOptions({cameraChoice:camera,autoOverhead:false});api.seek(p.start+t);};
   const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
   const safe=pitches.find(p=>p.outcome==='1B'&&api.recording.plateAppearances[p.pa].after.outs<3);
   seek(safe,safe.physicalPlayEnd,'overhead');
   const labels=api.inspect().actors.filter(a=>a.labelBox);
   check('overhead labels keep actual name anchor',labels.every(a=>Math.abs(a.labelBox.x+a.labelBox.w/2-a.nameAnchor.x)<1e-8));
   const elements=[...document.querySelectorAll('#actor-labels span')],runners=elements.filter(e=>e.dataset.role==='runner');
   check('runner label fixture',runners.length>0);
   const firstRunner=elements.findIndex(e=>e.dataset.role==='runner');
   check('runner labels drawn last',elements.slice(firstRunner).every(e=>e.dataset.role==='runner'));
   check('runner labels top priority',runners.every(e=>e.style.zIndex==='3'&&getComputedStyle(e).color==='rgb(255, 119, 119)'));
   check('labels never wrap',elements.every(e=>getComputedStyle(e).whiteSpace==='nowrap'));
   check('actual overlapping labels allowed',labels.some(a=>a.role==='runner'&&labels.some(b=>b.role!=='runner'&&overlap(a.labelBox,b.labelBox))));
   const labelPitch=safe.id,labelTick=safe.start+safe.physicalPlayEnd;
   seek(pitches[0],32,'catcher');
   const pitchesOnly=['mound','fielder','runner','overhead'];
   for(const camera of pitchesOnly)check('unamplified '+camera,[.001,.01,.1,1,10].every(d=>api.probeOpticalDiameter(d,camera)===d));
   check('batter/catcher pitch readability',api.probeOpticalDiameter(.1,'batter')>.1&&api.probeOpticalDiameter(.1,'catcher')>.1);
   const batted=pitches.find(p=>p.fair&&p.presentationEvidence?.capture?.frame>5);
   seek(batted,39,'overhead');
   check('actual source batted phase',api.getFrame().ballKind==='batted');
   for(const camera of ['mound','fielder','runner','batter','catcher'])check('batted POV actual projection '+camera,
    [.001,.01,.1,1,10].every(d=>Math.abs(api.probeOpticalDiameter(d,camera)-.68*d)<1e-12));
   check('overhead batted projection unchanged',[.001,.01,.1,1,10].every(d=>api.probeOpticalDiameter(d,'overhead')===d));
   seek(pitches[0],32,'catcher');
   const q1={w:1,x:0,y:0,z:0},q2={w:Math.SQRT1_2,x:Math.SQRT1_2,y:0,z:0};
   const glyph=orientation=>{api.nativePaintBall({position:{x:0,y:1.03,z:-.75},orientation,nativeObservation:true,ballKind:'pitch'});return api.inspect().ballDotDisplay;};
   const one=glyph(q1),two=glyph(q2);
   check('dot ball on same4px lattice',one.style==='4px-dot-grid'&&one.cells.every(c=>c.x%4===0&&c.y%4===0));
   check('dot glyph fixed art palette',one.cells.every(c=>['#fffdf7','#e8eceb','#dd5459'].includes(c.color)));
   check('source quaternion changes dot seam',JSON.stringify(one.cells.map(c=>c.color))!==JSON.stringify(two.cells.map(c=>c.color)));
   seek(pitches[0],32,'mound');
   const inspect=api.inspect();
   check('55ms world cadence untouched',inspect.cadenceMs===before.cadenceMs&&inspect.pitchCadenceMs===before.pitchCadenceMs&&inspect.battedCadenceMs===before.battedCadenceMs);
   const fair=pitches.find(p=>p.presentationEvidence?.fairKnownLocal!=null&&p.presentationEvidence.fairKnownLocal<=p.contactLocal+20);
   check('early confirmed fair fixture',!!fair);
   seek(fair,fair.presentationEvidence.fairKnownLocal-1,'mound');const preFair=api.getFrame();
   check('fair not revealed from future landing',!preFair.fairKnown);
   seek(fair,fair.presentationEvidence.fairKnownLocal,'mound');
   check('source fair geometry observable before OUT',api.getFrame().fairKnown&&fair.start+fair.presentationEvidence.fairKnownLocal<=fair.officialAt);
   check('mound camera active at known-source tick',api.inspect().autoCamera==='mound');
   check('mound zone hidden after fair source',api.inspect().zoneCorners.length===0);
   return{checks,labelPitch,labelTick,legacyPitchCount:pitches.length};
  });
  await page.evaluate(tick=>{window.matchPreview.setOptions({cameraChoice:'overhead',autoOverhead:false});window.matchPreview.seek(tick);},initial.labelTick);
  await page.screenshot({path:resolve(evidence,'runner-overlap-'+viewport.width+'.png'),fullPage:true});
  const distances=[];
  for(const distance of [2,10,50]){
   const observed=await page.evaluate(distance=>{
    const api=window.matchPreview;api.setOptions({cameraChoice:'mound',autoOverhead:false});api.seek(32);
    const view=api.inspect(),yaw=view.cameraYaw,pitch=view.cameraPitch,eye=view.cameraEye;
    const position={x:eye.x+Math.sin(yaw)*Math.cos(pitch)*distance,y:eye.y-Math.sin(pitch)*distance,
     z:eye.z+Math.cos(yaw)*Math.cos(pitch)*distance};
    api.nativePaintBall({position,orientation:{w:1,x:0,y:0,z:0},nativeObservation:true,ballKind:'batted'});
    return api.inspect().ballDotDisplay;
   },distance);
   assert.equal(observed.style,'4px-dot-grid');assert(Math.abs(observed.displayDiameterPx/observed.projectedDiameterPx-.68)<1e-10);
   distances.push({distanceM:distance,projectedDiameterPx:observed.projectedDiameterPx,displayDiameterPx:observed.displayDiameterPx,cells:observed.cells.length});
   await page.screenshot({path:resolve(evidence,'mound-batted-'+distance+'m-'+viewport.width+'.png'),fullPage:true});
  }
  assert(distances[0].displayDiameterPx>distances[1].displayDiameterPx&&distances[1].displayDiameterPx>distances[2].displayDiameterPx);
  assert(Math.abs(distances[0].displayDiameterPx/distances[1].displayDiameterPx-5)<1e-9);
  let native=null;
  if(nativeEnabled){
   await page.locator('#native-proof-panel').evaluate(el=>el.open=true);
   await page.locator('#native-enter').click();
   await page.locator('#native-target').selectOption('inside');await page.locator('#native-height').selectOption('middle');
   await page.locator('#native-approach').selectOption('aggressive');await page.locator('#native-issue').click();
   await page.waitForFunction(()=>window.nativeV25Bridge.inspect().continuationSamples>0&&!window.nativeV25Bridge.inspect().playing,null,{timeout:15000});
   native=await page.evaluate(()=>({bridge:window.nativeV25Bridge.inspect(),glyph:window.matchPreview.inspect().ballDotDisplay}));
   assert.equal(native.bridge.phase,'batted_ball_pending');assert.equal(native.bridge.officialFreeBallResult,null);
   assert.equal(native.bridge.referenceProfileSpinDecay,true);
   assert(native.bridge.sourceSpinSpeedAtContact<native.bridge.sourceSpinSpeedAtRelease,'Actual source spin did not decay');
   assert.equal(native.bridge.continuationAuthority,'NATIVE_CORE_FREE_BALL_CONTINUATION');assert(native.bridge.groundContactCount>0);
   assert.equal(native.glyph.style,'4px-dot-grid');assert.equal(native.glyph.ballKind,'batted');assert.equal(native.glyph.camera,'overhead');
   assert(Math.abs(native.glyph.displayDiameterPx-native.glyph.projectedDiameterPx)<1e-10);
   await page.screenshot({path:resolve(evidence,'native-ground-'+viewport.width+'.png'),fullPage:true});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  report.viewports.push({width:viewport.width,...initial,projectionFixtures:distances,native,pageErrors:0,networkRequests:0});
  await page.close();
 }
 await writeFile(resolve(evidence,'browser-check.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({result:'PASS',nativeEnabled,viewports:report.viewports.map(v=>({width:v.width,checks:v.checks.length,projectionFixtures:v.projectionFixtures})),evidence},null,2));
}finally{await browser.close();}
