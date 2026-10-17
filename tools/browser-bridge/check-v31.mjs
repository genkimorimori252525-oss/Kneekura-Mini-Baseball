import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.V31_PLAYWRIGHT_CORE??'C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const artifact=resolve('dist/ばせぼーるlv31_TBD_vs_LAD_剛体バット描画版.html');
const baseline='C:/Users/genki/Downloads/ばせぼーるlv27_TBD_vs_LAD_描画視認性先行版.html',evidence=resolve('dist/v31-evidence');
await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.V31_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={artifact,artifactSha256:createHash('sha256').update(await readFile(artifact)).digest('hex'),regression:[],viewports:[],
 boundary:'Legacy approximation and formal-Core maker/observer are separate; this check does not prove actual nine-inning Native baseball'};
try{
 const old=await browser.newPage(),changed=await browser.newPage();
 await old.goto(pathToFileURL(baseline).href);await changed.goto(pathToFileURL(artifact).href);
 for(const seed of ['TBD-LAD-2025','v31-rigid-0','v31-rigid-1']){
  const facts=page=>page.evaluate(async seed=>{
   const game=window.KneekuraBrowserMatch.makeEngine(JSON.parse(document.getElementById('match-data').textContent),{seed,innings:9,managedTeam:1});
   const final=game.finishAll({batting:'balanced',pitchType:'auto',location:'auto'});
   const source={final,log:game.log,pa:game.rec.plateAppearances,pitches:game.rec.pitches.map(p=>{const copy={...p};delete copy.presentationEvidence;return copy;})};
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(source)));
   return{finished:final.finished,pitches:game.rec.pitches.length,sha256:[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('')};
  },seed);
  const [before,after]=await Promise.all([facts(old),facts(changed)]);assert.deepEqual(after,before);assert(after.finished);
  report.regression.push({seed,...after,result:'PASS'});
 }
 await old.close();await changed.close();
 for(const viewport of [{width:1200,height:860},{width:390,height:844}]){
  const page=await browser.newPage({viewport}),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(String(error)));page.on('request',r=>{if(!r.url().startsWith('file:'))requests.push(r.url());});
  await page.goto(pathToFileURL(artifact).href);await page.evaluate(()=>document.fonts.ready);
  const checked=await page.evaluate(()=>{
   const api=window.matchPreview,checks=[];
   const check=(name,ok,data=null)=>{if(!ok)throw new Error(name+': '+JSON.stringify(data));checks.push({name,result:'PASS',data});};
   check('v31 version',api.presentationVersion===31);
   const templates=api.engine.base.animationTemplates,points=templates['L/L/side/1'][39][1],next=templates['L/L/side/1'][40][1];
   const length=a=>Math.hypot(a[3]-a[0],a[4]-a[1],a[5]-a[2]),poseLength=p=>Math.hypot(p.tip.x-p.grip.x,p.tip.y-p.grip.y,p.tip.z-p.grip.z);
   const previous=points.map((n,i)=>(n+next[i])/2),fixed=window.rigidBatPoints(points,next,.5,length(templates['L/L/side/1'][0][1]));
   check('known Cartesian shrink reproduced',length(previous)/length(points)<.95);
   check('sphere interpolation removes shrink',Math.abs(length(fixed)-length(templates['L/L/side/1'][0][1]))<1e-12,{previousLength:length(previous),rigidLength:length(fixed)});
   check('same source grip pivot',fixed.slice(0,3).every((n,i)=>Math.abs(n-previous[i])<1e-12));
   const anti=window.rigidBatPoints([0,0,0,1,0,0],[2,3,4,1,3,4],.5,.84);
   check('opposite unit axes remain finite rigid pose',anti.every(Number.isFinite)&&Math.abs(length(anti)-.84)<1e-12);
   const first=api.recording.pitches[0],sourceLength=length(first.motion[0][2]);let maxError=0;
   for(let tick=0;tick<54;tick+=.125){const pose=api.sampleRigidBat(0,tick);if(pose)maxError=Math.max(maxError,Math.abs(poseLength(pose)-sourceLength));}
   check('all fractional legacy bat lengths fixed',maxError<1e-12,{maxError,sourceLength});
   api.seek(32);api.setOptions({cameraChoice:'catcher',autoOverhead:false});
   const catcher=api.sampleRigidBat(0,32.5);api.setOptions({cameraChoice:'batter',autoOverhead:false});
   const batter=api.sampleRigidBat(0,32.5);check('cameras observe identical rigid pose',JSON.stringify(catcher)===JSON.stringify(batter));
   const rendered=api.paintRigidBatProbe(0,32.5);check('hand and bat use one grip object',rendered.handGrip===rendered.bat.grip);
   const cadence=api.inspect();check('source cadence untouched',cadence.cadenceMs===55&&Math.abs(cadence.pitchCadenceMs-27.5/1.2)<1e-12&&cadence.battedCadenceMs===27.5);
   api.fastFinish();const pitches=api.recording.pitches;
   const safe=pitches.find(p=>p.outcome==='1B'&&api.recording.plateAppearances[p.pa].after.outs<3);
   api.setOptions({cameraChoice:'overhead',autoOverhead:false});api.seek(safe.start+safe.physicalPlayEnd);
   const labels=api.inspect().actors.filter(a=>a.labelBox),elements=[...document.querySelectorAll('#actor-labels span')];
   check('v30 overhead anchor preserved',labels.every(a=>Math.abs(a.labelBox.x+a.labelBox.w/2-a.nameAnchor.x)<1e-8));
   const runner=elements.findIndex(e=>e.dataset.role==='runner');check('v30 runners last/top priority',runner>=0&&elements.slice(runner).every(e=>e.dataset.role==='runner'&&e.style.zIndex==='3'));
   const fair=pitches.find(p=>p.fair&&p.presentationEvidence?.capture?.frame>5);api.seek(fair.start+39);
   check('v30 overhead ball actual projection',api.probeOpticalDiameter(.1,'overhead')===.1);
   check('v30 batted POV has no hard minimum',Math.abs(api.probeOpticalDiameter(.001,'mound')-.00068)<1e-12);
   const early=pitches.find(p=>p.presentationEvidence?.fairKnownLocal!=null&&p.presentationEvidence.fairKnownLocal<=p.contactLocal+20);
   api.setOptions({cameraChoice:'mound',autoOverhead:false});api.seek(early.start+early.presentationEvidence.fairKnownLocal);
   check('v30 known fair hides mound zone',api.inspect().autoCamera==='mound'&&api.inspect().zoneCorners.length===0);
   api.seek(32);api.setOptions({cameraChoice:'catcher',autoOverhead:false});
   api.nativePaintBall({position:{x:0,y:1.03,z:-.75},orientation:{w:1,x:0,y:0,z:0},nativeObservation:true,ballKind:'pitch'});
   check('v30 coarse dot ball retained',api.inspect().ballDotDisplay.style==='4px-dot-grid');
   return{checks,sourceLength,maxError};
  });
  for(const camera of ['catcher','batter']){
   await page.evaluate(camera=>{const api=window.matchPreview;api.seek(32);api.setOptions({cameraChoice:camera,autoOverhead:false});api.paintRigidBatProbe(0,32.5);},camera);
   await page.screenshot({path:resolve(evidence,'rigid-bat-'+camera+'-'+viewport.width+'.png'),fullPage:true});
  }
  await page.locator('#native-proof-panel').evaluate(el=>el.open=true);await page.locator('#native-enter').click();await page.locator('#native-issue').click();
  await page.waitForFunction(()=>window.nativeV25Bridge.inspect().samples>0&&!window.nativeV25Bridge.inspect().playing,null,{timeout:8000});
  const native=await page.evaluate(()=>window.nativeV25Bridge.inspect());
  assert(native.acceptedEvents.includes('PitchAdjudicated'));assert.equal(native.spinSource,'PRESENTATION_ONLY_NATIVE_SPIN');assert.equal(native.continuationAuthority,null);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  report.viewports.push({width:viewport.width,...checked,native,pageErrors:0,networkRequests:0});await page.close();
 }
 await writeFile(resolve(evidence,'browser-check.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({result:'PASS',artifactSha256:report.artifactSha256,regression:report.regression,
  viewports:report.viewports.map(v=>({width:v.width,checks:v.checks.length,maxRigidLengthError:v.maxError,nativeShortBridge:'PASS'})),evidence},null,2));
}finally{await browser.close();}
