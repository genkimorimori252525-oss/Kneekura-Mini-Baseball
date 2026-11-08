import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.V29_PLAYWRIGHT_CORE ??
  'C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');

const output = resolve(process.argv[2] ?? 'dist/ばせぼーるlv29_TBD_vs_LAD_捕球と視点修正版.html');
const baseline = process.env.V29_BASELINE_HTML ?? 'C:/Users/genki/Downloads/ばせぼーるlv27_TBD_vs_LAD_描画視認性先行版.html';
const evidence = resolve('dist/v29-evidence');
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.V29_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, args: ['--no-first-run'] });
const report = { regression: [], viewports: [], limitations: ['390px desktop Chromium is not a mobile physical-device test',
  'Legacy game result authority remains separate from Native observer; no Native nine-inning mixed-play claim'] };
try {
  const sourcePage = await browser.newPage();
  const changedPage = await browser.newPage();
  await sourcePage.goto(pathToFileURL(baseline).href);
  await changedPage.goto(pathToFileURL(output).href);
  const seeds = ['TBD-LAD-2025', ...Array.from({length:100},(_,i)=>'v29-regression-'+i)];
  for (const seed of seeds) {
    const run = page => page.evaluate(async seed => {
      const game = window.KneekuraBrowserMatch.makeEngine(JSON.parse(document.getElementById('match-data').textContent),
        { seed, innings: 9, managedTeam: 1 });
      const final = game.finishAll({ batting: 'balanced', pitchType: 'auto', location: 'auto' });
      const facts={ final, log: game.log, plateAppearances: game.rec.plateAppearances,
        pitches: game.rec.pitches.map(p => {const copy = {...p};delete copy.presentationEvidence;return copy;}) };
      const bytes=new TextEncoder().encode(JSON.stringify(facts));
      const digest=await crypto.subtle.digest('SHA-256',bytes);
      return {finished:final.finished,pitches:game.rec.pitches.length,score:final.score,
        sha256:Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('')};
    }, seed);
    const [before,after]=await Promise.all([run(sourcePage),run(changedPage)]);
    assert.deepEqual(after,before,'Game results, trajectories, actors or timing changed: '+seed);
    assert.equal(after.finished,true);
    report.regression.push({seed,...after,result:'PASS'});
    if(report.regression.length%20===0)console.log('Legacy baseline regression '+report.regression.length+'/'+seeds.length+' PASS');
  }
  await sourcePage.close();await changedPage.close();
  for (const viewport of [{ width: 1200, height: 860 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('request', request => {if (!request.url().startsWith('file:')) requests.push(request.url());});
    await page.goto(pathToFileURL(output).href);
    await page.waitForFunction(() => !!window.matchPreview && !!window.nativeV25Bridge);
    const checked = await page.evaluate(() => {
      const api = window.matchPreview;
      api.fastFinish();
      const pitches = api.recording.pitches;
      const pa = p => api.recording.plateAppearances[p.pa];
      const seek = (p, local, camera = 'overhead') => {
        api.setOptions({ cameraChoice: camera, autoOverhead: false });api.seek(p.start + local);return api.getFrame();
      };
      const alphaPixels = () => {
        const data = document.getElementById('ball-overlay').getContext('2d').getImageData(0,0,1200,864).data;
        let count = 0;for (let i=3;i<data.length;i+=4) if(data[i])count++;return count;
      };
      const checks = [];
      const check = (name, condition, details = null) => {if(!condition)throw new Error(name + ': ' + JSON.stringify(details));checks.push({ name, result:'PASS', details });};
      const caughtPitch = pitches.find(p => p.contactLocal===null);
      for (const camera of ['catcher','batter','runner','mound','overhead']) {
        const frame = seek(caughtPitch,caughtPitch.catchLocal,camera);
        check('catcher custody hidden '+camera,frame.custody==='C'&&frame.ball===null&&alphaPixels()===0);
      }
      const captured = pitches.find(p=>p.presentationEvidence?.capture&&p.throwPlan);
      check('actual field capture fixture',!!captured);
      const capture=captured.presentationEvidence.capture,start=39+capture.frame;
      const hold=Math.max(1,Math.ceil((captured.throwPlan.releaseSec-capture.time)/.055));
      const arrival=start+hold+Math.max(1,Math.ceil((captured.throwPlan.arrivalSec-captured.throwPlan.releaseSec)/.055));
      for(const camera of ['catcher','batter','runner','mound','overhead']){
        const secured=seek(captured,start,camera);
        check('fielder custody hidden '+camera,secured.custody===capture.role&&secured.ball===null&&alphaPixels()===0);
        const thrown=seek(captured,start+hold+1,camera);
        check('released ball restores '+camera,thrown.custody===null&&!!thrown.ball);
        const received=seek(captured,arrival,camera);
        check('receiver custody hidden '+camera,received.custody===captured.throwPlan.receiver&&received.ball===null&&alphaPixels()===0);
      }
      const out=pitches.find(p=>p.terminal&&['K','GO','FO','SF'].includes(p.outcome)&&pa(p).after.outs<3);
      check('individual out fixture',!!out);
      const outTick=out.officialAt-out.start;
      const actorBefore=seek(out,outTick).actors.find(a=>a.id==='BAT');
      const actorAfter=seek(out,outTick+1).actors.find(a=>a.id==='BAT');
      check('batter departs immediately after official OUT',actorBefore.walking&&actorAfter.walking&&
        Math.hypot(actorAfter.position.x-actorBefore.position.x,actorAfter.position.z-actorBefore.position.z)>0);
      const third=pitches.find(p=>p.terminal&&pa(p).after.outs===3);
      check('third out fixture',!!third);
      const thirdTick=third.officialAt-third.start;
      const thirdAt=seek(third,thirdTick),thirdAfter=seek(third,thirdTick+1);
      check('third OUT immediate departure',thirdAt.benchReturn&&thirdAfter.actors.every(a=>a.walking));
      check('departure independent from UI hold',thirdTick<third.freezeStartLocal,{thirdTick,freezeStart:third.freezeStartLocal});
      const fair=pitches.find(p=>p.fair&&p.presentationEvidence?.capture?.role!=='P'&&p.presentationEvidence?.capture);
      const watch=Math.ceil(Math.min(2,Math.max(.35,70/Math.max(1,
        Math.hypot(...fair.motion[40][0].map((n,i)=>n-fair.motion[39][0][i]))/.055)))/.055);
      seek(fair,39,'mound');check('pitcher watches initial batted ball',api.inspect().autoCamera==='mound');
      seek(fair,Math.min(fair.motion.length-1,39+fair.presentationEvidence.capture.frame),'mound');
      if(fair.presentationEvidence.capture.frame>=watch)check('actual fielder viewpoint',api.inspect().autoCamera==='fielder'&&api.inspect().fieldObserver===fair.presentationEvidence.capture.role,api.inspect().fieldObserver);
      let hr=pitches.find(p=>p.outcome==='HR');
      if(!hr){
        document.getElementById('fixed-seed').checked=true;
        document.getElementById('batting-choice').value='power';
        for(let i=0;i<30&&!hr;i++){
          document.getElementById('match-seed').value='v29-hr-'+i;
          document.getElementById('new-game').click();api.fastFinish();
          hr=api.recording.pitches.find(p=>p.outcome==='HR');
        }
      }
      check('generated home run fixture',!!hr);
      const hrFrame=seek(hr,hr.officialAt-hr.start,'runner'),runner=hrFrame.actors.find(a=>a.id==='BAT');
      const next=hr.actors.find(a=>a.id==='BAT').track.find(k=>k[0]>hrFrame.localTick);
      const track=hr.actors.find(a=>a.id==='BAT').track;
      const expected=next?Math.atan2(next[1]-runner.position.x,next[3]-runner.position.z):
        Math.atan2(track.at(-1)[1]-track.at(-2)[1],track.at(-1)[3]-track.at(-2)[3]);
      check('confirmed HR runner faces forward',Math.abs(api.inspect().cameraYaw-expected)<1e-8);
      seek(api.recording.pitches[0],32,'catcher');
      const bat=api.getFrame().bat;
      check('bat source projection remains same grip and tip',!!bat);
      const raw=api.getFrame().p.motion[32][2];
      check('hand rig preserves single rigid axis',Math.abs(bat.tip.x-bat.grip.x-(raw[3]-raw[0]))<1e-10&&
        Math.abs(bat.tip.y-bat.grip.y-(raw[4]-raw[1]))<1e-10&&Math.abs(bat.tip.z-bat.grip.z-(raw[5]-raw[2]))<1e-10);
      const catcherBat=JSON.stringify(bat);api.setOptions({cameraChoice:'batter'});
      check('batter and catcher use identical 3D bat',JSON.stringify(api.getFrame().bat)===catcherBat);
      seek(api.recording.pitches[0],0,'catcher');const setFrame=api.getFrame(),handBat=setFrame.bat;
      const body=setFrame.actors.find(a=>a.id==='BAT');
      check('bat pivots at body hand anchor',Math.abs(handBat.grip.z-(body.position.z-.22))<1e-10&&
        Math.abs(handBat.grip.y-body.player.height*.60)<1e-10);
      const sizes=[1,.5,.1,.01].map(d=>api.probeOpticalDiameter(d,'mound'));
      check('continuous distance scale without hard minimum',sizes.every((n,i)=>i===0||n<sizes[i-1]),sizes);
      const opticalCapture=api.recording.pitches.find(p=>p.fair&&p.presentationEvidence?.capture);
      seek(opticalCapture,32,'overhead');const pitchOptics=api.probeOpticalDiameter(.1,'overhead');
      check('overhead pitch visibility preserved',Math.abs(pitchOptics-(1.30*.1+3.70*(-Math.expm1(-.6)))*1.12)<1e-10);
      seek(opticalCapture,39,'overhead');check('overhead batted ball shrinks',api.probeOpticalDiameter(.1,'overhead')<pitchOptics);
      seek(api.recording.pitches[0],32,'catcher');
      const opticalProof=orientation=>{
        api.nativePaintBall({position:{x:0,y:1,z:0},orientation,nativeObservation:true});
        const data=document.getElementById('ball-overlay').getContext('2d').getImageData(0,0,1200,864).data;
        let hash=2166136261;for(let i=0;i<data.length;i++)hash=Math.imul(hash^data[i],16777619);return hash;
      };
      check('sphere seam follows 3D quaternion',opticalProof({w:1,x:0,y:0,z:0})!==opticalProof({w:Math.SQRT1_2,x:Math.SQRT1_2,y:0,z:0}));
      return { checks, officialSource:api.inspect().matchSource, generatedPitches:pitches.length };
    });
    const thirdCut = await page.evaluate(() => {
      const api=window.matchPreview;
      const p=api.recording.pitches.find(p=>p.terminal&&api.recording.plateAppearances[p.pa].after.outs===3);
      api.seek(p.officialAt+Math.ceil(1000/55)-1);
      if(api.tapScene()!==false)throw new Error('Third-out tap skipped before 1s');
      api.seek(p.officialAt+Math.ceil(1000/55));
      if(api.tapScene()!==true||api.getFrame().p.id===p.id)throw new Error('Third-out tap did not shorten at 1s');
      api.seek(p.officialAt);
      document.getElementById('speed').value='16';
      document.getElementById('speed').dispatchEvent(new Event('change'));
      document.getElementById('play').click();
      return {pitch:p.id,startedAt:performance.now()};
    });
    await page.waitForFunction(pitch=>window.matchPreview.getFrame().p.id!==pitch,thirdCut.pitch,{timeout:3000});
    const cutElapsed=await page.evaluate(start=>performance.now()-start,thirdCut.startedAt);
    const cut=await page.evaluate(()=>window.matchPreview.inspect().lastSceneCut);
    assert.equal(cut.kind,'third-out');
    assert.equal(cut.atTick-cut.officialTick,Math.ceil(3000/55));
    await page.evaluate(()=>window.matchPreview.seek(window.matchPreview.inspect().tick));
    checked.checks.push({name:'third-out scene tap at 1s and automatic cut at 3s',result:'PASS',elapsedAt16xMs:cutElapsed});
    await page.locator('#native-proof-panel').evaluate(element=>element.open=true);
    await page.locator('#native-enter').click();
    await page.locator('#native-issue').click();
    await page.waitForFunction(() => window.nativeV25Bridge.inspect().samples>0&&!window.nativeV25Bridge.inspect().playing);
    const native = await page.evaluate(() => window.nativeV25Bridge.inspect());
    assert(native.spinFrames > 0, 'Native spinFrames missing');
    assert.equal(native.spinSource, 'PRESENTATION_ONLY_NATIVE_SPIN');
    await page.screenshot({ path: resolve(evidence, 'native-'+viewport.width+'.png'), fullPage: true });
    await page.locator('#native-target').selectOption('inside');
    await page.locator('#native-height').selectOption('middle');
    await page.locator('#native-approach').selectOption('aggressive');
    await page.locator('#native-issue').click();
    await page.waitForFunction(()=>window.nativeV25Bridge.inspect().continuationSamples>0&&!window.nativeV25Bridge.inspect().playing,null,{timeout:15000});
    const contacted=await page.evaluate(()=>window.nativeV25Bridge.inspect());
    assert.equal(contacted.continuationAuthority,'NATIVE_CORE_FREE_BALL_CONTINUATION');
    assert.equal(contacted.unresolved,true);assert.equal(contacted.officialFreeBallResult,null);
    assert(contacted.acceptedEvents.includes('BatBallContact'));
    assert(contacted.groundContactCount>0);assert(contacted.continuationSamples>290);
    assert(contacted.contactSegmentT>=.64&&contacted.contactSegmentT<=.79);
    assert(contacted.continuationPhases.includes('airborne'));
    assert(contacted.continuationPhases.some(phase=>phase==='sliding'||phase==='rolling'));
    const nativeView=await page.evaluate(()=>{
      const data=document.getElementById('ball-overlay').getContext('2d').getImageData(0,0,1200,864).data;
      let ballPixels=0;for(let i=3;i<data.length;i+=4)if(data[i])ballPixels++;
      return {camera:window.matchPreview.inspect().autoCamera,ballPixels};
    });
    assert.equal(nativeView.camera,'overhead');assert(nativeView.ballPixels>0,'Actual Native resting ball was offscreen');
    contacted.finalView=nativeView;
    await page.screenshot({path:resolve(evidence,'native-ground-'+viewport.width+'.png'),fullPage:true});
    await page.locator('#native-exit').click();
    await page.evaluate(() => {window.matchPreview.seek(32);window.matchPreview.setOptions({cameraChoice:'catcher',autoOverhead:false});});
    await page.screenshot({ path: resolve(evidence, 'catcher-'+viewport.width+'.png'), fullPage: true });
    assert.deepEqual(errors, []);assert.deepEqual(requests, []);
    report.viewports.push({ width: viewport.width, ...checked, native, contacted, pageErrors:0, networkRequests:0 });
    await page.close();
  }
  await writeFile(resolve(evidence, 'browser-check.json'), JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({result:'PASS',fixedSeedRegressionGames:report.regression.length,
    totalRegressionPitches:report.regression.reduce((total,r)=>total+r.pitches,0),
    viewports:report.viewports.map(v=>({width:v.width,checks:v.checks.length,pageErrors:v.pageErrors,networkRequests:v.networkRequests})),
    evidence:resolve(evidence,'browser-check.json')},null,2));
} finally {await browser.close();}
