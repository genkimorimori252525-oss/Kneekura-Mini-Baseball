import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const normal=resolve(process.argv[2]??'../../outputs/ばせぼーるlv76_TBD_vs_LAD_空中球とゴロの表示分離版.html');
const lab=resolve(process.argv[3]??'../../outputs/カメラワーク調整室_v76.html');
const maker=resolve(process.argv[4]??'../../outputs/にーくら野球メーカー_v76_ボール表示分離版.html');
const evidence=resolve('docs/verification/releases/v76/browser'),sha=x=>createHash('sha256').update(x).digest('hex');
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const defaults={perspective:1,overhead:1,overheadHeightEmphasis:2};
const heights=[0,.0366,.0732,.1098,.3,.5366,1,1.5366,2,20];
const report={pass:false,phase:'load',artifacts:{normal,lab,maker},views:[],faults:[],scope:'Display-only low-ball guard and smooth high-ball response; actual UI, three embedded normal renderers, six-record v75 Source/bat/camera regression, paused lab, settings/session compatibility. No regulation-game rerun.'};
await mkdir(evidence,{recursive:true});let browser;
const close=(a,b,label)=>assert(Math.abs(a-b)<1e-9,label+': '+a+' / '+b);
const target=kind=>kind==='normal'?null:kind==='lab'?'match-engine':'comparison-batter-frame';
function watch(page,label){const faults={label,errors:[],external:[]};report.faults.push(faults);page.on('pageerror',e=>faults.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))faults.external.push(r.url());});}
async function open(page,path,kind){await page.goto(pathToFileURL(path).href,{timeout:60000});await page.waitForFunction(kind=>kind==='lab'?globalThis.KneekuraCameraLab?.inspect().ready:kind==='maker'?globalThis.KneekuraSwingMaker?.inspect().ready:globalThis.liveMatchPlayback,kind,{timeout:60000});if(kind==='maker'){await page.locator('#tab-bat').click();await page.locator('#comparison-run').click();await page.waitForFunction(()=>document.getElementById('comparison-batter-frame')?.contentWindow.KneekuraMakerMatchRenderer?.inspect().ready,undefined,{timeout:60000});}}
async function generate(page){await page.evaluate(()=>{const auto=document.getElementById('auto-overhead');auto.checked=false;auto.dispatchEvent(new Event('change'));for(let i=0;i<6;i++){document.getElementById('next-pitch').click();liveMatchPlayback.stop();if(liveMatchPlayback.inspect().error)throw Error(liveMatchPlayback.inspect().error);}});}
async function history(page,kind='normal'){return page.evaluate(id=>(id?document.getElementById(id).contentWindow:window).liveMatchPlayback.inspect().host.history,target(kind));}
async function configureUI(page,kind,values){
  if(kind==='maker')return page.evaluate(values=>{const w=document.getElementById('comparison-batter-frame').contentWindow;for(const[key,value]of Object.entries(values)){const e=w.document.getElementById('ball-scale-'+key);e.value=String(value);e.dispatchEvent(new w.Event('change'));}return w.liveMatchPlayback.inspect().presentation.ballDisplay;},values);
  if(kind==='normal'){const details=page.locator('#ball-display-controls');if(!await details.evaluate(e=>e.open))await details.locator('summary').click();}
  for(const[key,value]of Object.entries(values)){const input=page.locator('#'+(kind==='lab'?'lab-':'')+'ball-scale-'+key);await input.fill(String(value));await input.dispatchEvent('change');}
  return page.evaluate(id=>(id?document.getElementById(id).contentWindow:window).liveMatchPlayback.inspect().presentation.ballDisplay,target(kind));
}
async function probes(page,kind,cameras=['overhead'],ys=heights){return page.evaluate(async({id,cameras,ys})=>{
  const w=id?document.getElementById(id).contentWindow:window,playback=w.liveMatchPlayback,settings=playback.inspect().presentation.ballDisplay,rows=[];
  const hash=async a=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',a))].map(n=>n.toString(16).padStart(2,'0')).join('');
  for(const camera of cameras)for(const y of ys){
    const projection={camera,eye:{x:0,y:80,z:-100},yaw:0,pitch:.55,f:100,cx:300,cy:216,labelMetres:.3},ball={position:{x:0,y,z:40},orientation:{w:1,x:0,y:0,z:0},visible:true,sourceObservation:true,ballKind:'batted',possessedBy:null};
    for(const key of['futureFrames','trajectory','predictedLanding','velocity'])Object.defineProperty(ball,key,{get(){throw Error('must not read '+key);}});
    const rendered=playback.paintLivePitchBall(ball,projection),canvas=w.document.getElementById('ball-overlay'),rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let alpha=0;for(let i=3;i<rgba.length;i+=4)if(rgba[i])alpha++;
    rows.push({height:y,camera,settings:{...settings},dot:rendered.ballDotDisplay,rgba:await hash(rgba),alpha,width:canvas.width,heightPx:canvas.height});
  }
  return {helperVersion:w.KneekuraBallDisplayControls.version,helperSource:w.KneekuraBallDisplayControls.heightSizingFor.toString(),model:w.KneekuraBallDisplayControls.heightModel,rows};
},{id:target(kind),cameras,ys});}
function compareSamples(actual,baseline,{lowExact=false,highOld=false}={}){
  for(const a of actual){const b=baseline.find(r=>r.height===a.height&&r.camera===a.camera);assert(b);assert(a.dot&&b.dot,'free ball visible');assert(a.alpha>0);close(a.dot.projectedDiameterPx,b.dot.projectedDiameterPx,'optical projection unchanged');
    if(lowExact&&a.height<=.5366||highOld&&a.height>=1.5366){assert.equal(a.dot.displayDiameterPx,b.dot.displayDiameterPx,'exact diameter at '+a.height);assert.equal(a.rgba,b.rgba,'exact RGBA at '+a.height);}
  }
}
async function snapshots(page){return page.evaluate(async()=>{
  const s=liveMatchPlayback.inspect(),prep=s.presentation.timing.preparationMs,scenes=[];
  for(const[pitch,record]of s.host.history.entries()){const f=record.frames[Math.floor(record.frames.length/2)],first=record.frames[0];scenes.push({pitch,ms:prep+(f.tick-first.tick)/record.play.diagnostics.sourceClockTicksPerSecond*1000+.01});}
  const hash=async id=>{const c=document.getElementById(id),a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return[...new Uint8Array(await crypto.subtle.digest('SHA-256',a))].map(x=>x.toString(16).padStart(2,'0')).join('');},out=[];
  for(const camera of['batter','catcher','mound','runner','overhead'])for(const scene of scenes){document.querySelector('[data-camera="'+camera+'"]').click();liveMatchPlayback.seekPitch(scene.pitch);liveMatchPlayback.seekPresentationMs(scene.ms);const v=liveMatchPlayback.inspect();out.push({camera,scene,eye:v.rendered.cameraEye,yaw:v.rendered.cameraYaw,pitch:v.rendered.cameraPitch,projection:v.rendered.cameraProjection,batter:v.presentation.continuousBatterView,field:await hash('field'),bat:await hash('bat-overlay')});}
  return out;
});}
async function held(page,kind){return page.evaluate(async id=>{const w=id?document.getElementById(id).contentWindow:window,out=[];for(const camera of['overhead','batter','catcher','mound','runner']){const v=w.liveMatchPlayback.paintLivePitchBall({position:{x:0,y:2,z:40},orientation:{w:1,x:0,y:0,z:0},visible:true,sourceObservation:true,ballKind:'batted',possessedBy:'C'},{camera,eye:{x:0,y:80,z:-100},yaw:0,pitch:.55,f:100,cx:300,cy:216});const c=w.document.getElementById('ball-overlay'),a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;out.push({camera,dot:v.ballDotDisplay,alpha:a.some((x,i)=>i%4===3&&x>0)});}return out;},target(kind));}

try{
  const pins=[];report.sha256={};
  for(const[kind,path]of Object.entries(report.artifacts)){const bytes=await readFile(path),meta=JSON.parse(await readFile(path+'.build.json','utf8'));report.sha256[kind]=sha(bytes);assert.equal(meta.sha256,sha(bytes),kind+' artifact metadata');if(kind!=='lab'){const pin=JSON.parse(await readFile(path+'.bundle-inputs.json','utf8'));pins.push(pin);for(const[p,h]of Object.entries(pin.inputs))assert.equal(sha(await readFile(p)),h,'source pin '+p);}}
  report.normalSha256=report.sha256.normal;report.workbenchSha256=report.sha256.lab;report.makerSha256=report.sha256.maker;
  const meta=JSON.parse(await readFile(normal+'.build.json','utf8')),oldMeta=JSON.parse(await readFile('docs/demos/releases/v75/game.html.build.json','utf8'));assert.equal(meta.sourceCoreSha256,oldMeta.sourceCoreSha256,'Core and mapper bundle unchanged');report.coreSha256=meta.sourceCoreSha256;
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
  for(const width of[1200,390]){
    const context=await browser.newContext({viewport:{width,height:860},hasTouch:width===390}),row={width,surfaces:[]};report.views.push(row);
    report.phase='v75-baseline-'+width;const old=await context.newPage();watch(old,report.phase);await open(old,resolve('docs/demos/releases/v75/game.html'),'normal');await generate(old);const records=await history(old),recordHash=sha(JSON.stringify(records)),cameraBaseline=await snapshots(old),oldProbes={};
    for(const air of[1,2,8]){await configureUI(old,'normal',{perspective:1,overhead:1,overheadHeightEmphasis:air});oldProbes[air]=(await probes(old,'normal')).rows;}
    row.legacyLowHop={height:.0732,air1:oldProbes[1].find(r=>r.height===.0732).dot.displayDiameterPx,air2:oldProbes[2].find(r=>r.height===.0732).dot.displayDiameterPx,groundInvariantSatisfied:oldProbes[1].find(r=>r.height===.0732).rgba===oldProbes[2].find(r=>r.height===.0732).rgba};assert.equal(row.legacyLowHop.groundInvariantSatisfied,false,'frozen v75 reproduces the reported low-hop defect');await old.close();
    report.phase='normal-'+width;const page=await context.newPage();watch(page,report.phase);await open(page,normal,'normal');await generate(page);assert.equal(sha(JSON.stringify(await history(page))),recordHash,'all six Source/bat/field/rule records exactly frozen v75');assert.deepEqual(await snapshots(page),cameraBaseline,'same Source-time camera, field and bat pixels');row.sourceRegression={records:6,sourceBatRuleSha256:recordHash,cameraFieldBatExact:true};
    const common={};
    for(const kind of['normal','lab','maker']){
      report.phase=kind+'-probes-'+width;
      const p=kind==='normal'?page:await context.newPage();if(kind!=='normal'){watch(p,report.phase);await open(p,kind==='lab'?lab:maker,kind);}
      assert.deepEqual(await p.evaluate(id=>(id?document.getElementById(id).contentWindow:window).liveMatchPlayback.inspect().presentation.ballDisplay,target(kind)),defaults);
      const surface={kind,air:[]};row.surfaces.push(surface);const byAir={};
      for(const air of[1,2,8]){assert.equal((await configureUI(p,kind,{perspective:1,overhead:1,overheadHeightEmphasis:air})).overheadHeightEmphasis,air);const result=await probes(p,kind);byAir[air]=result.rows;surface.air.push({value:air,rows:result.rows});surface.helperVersion=result.helperVersion;surface.heightModel=result.model;surface.helperSha256=sha(result.helperSource);
        if(common.helperSha256)assert.equal(surface.helperSha256,common.helperSha256,'all normal renderers use identical helper source');else common.helperSha256=surface.helperSha256;
        compareSamples(result.rows,air===1?oldProbes[1]:byAir[1],{lowExact:true});if(air>=2)compareSamples(result.rows,oldProbes[air],{highOld:true});
      }
      for(const air of[2,8])for(const high of byAir[air].filter(r=>r.height>=1.5366))assert(high.dot.displayDiameterPx>byAir[1].find(r=>r.height===high.height).dot.displayDiameterPx);
      await configureUI(p,kind,{overheadHeightEmphasis:1});const perspectiveBase=(await probes(p,kind,['batter','catcher','mound','runner'],[.0732,2])).rows;
      await configureUI(p,kind,{overheadHeightEmphasis:8});const perspectiveAfter=(await probes(p,kind,['batter','catcher','mound','runner'],[.0732,2])).rows;
      for(const a of perspectiveAfter){const b=perspectiveBase.find(v=>v.camera===a.camera&&v.height===a.height),withoutCurrentSetting=dot=>Object.fromEntries(Object.entries(dot).filter(([key])=>key!=='overheadHeightEmphasis'));assert.deepEqual(withoutCurrentSetting(a.dot),withoutCurrentSetting(b.dot));assert.equal(a.rgba,b.rgba);}
      await configureUI(p,kind,{overheadHeightEmphasis:2,overhead:2});const global=(await probes(p,kind,['overhead'],[.0732,2])).rows;
      for(const a of global){const b=byAir[2].find(v=>v.height===a.height);close(a.dot.displayDiameterPx,b.dot.displayDiameterPx*2,'independent global overhead multiplier');assert.equal(a.dot.displayScale,2);close(a.dot.projectedDiameterPx,b.dot.projectedDiameterPx,'global scale never changes projection');}
      surface.held=await held(p,kind);for(const v of surface.held){assert.equal(v.dot,null);assert.equal(v.alpha,false);}
      surface.otherFourCamerasExact=true;surface.globalOverheadIndependent=true;
      if(common.rows)assert.deepEqual(byAir[2],common.rows,'same UI settings and fixed projection yield same RGBA on all embedded renderers');else common.rows=byAir[2];
      if(kind==='lab'){
        report.phase='lab-roundtrip-'+width;await configureUI(p,'lab',{overhead:1,overheadHeightEmphasis:2});
        surface.roundTrip=await p.evaluate(async()=>{const a=KneekuraCameraLab,s=a.exportSettings();a.importSettings(s);const modern=JSON.stringify(a.exportSettings())===JSON.stringify(s);const old=structuredClone(s);delete old.ballDisplay.overheadHeightEmphasis;a.importSettings(old);const legacy=a.exportSettings().ballDisplay.overheadHeightEmphasis===1;const missing=structuredClone(s);delete missing.ballDisplay;a.importSettings(missing);const omitted=a.exportSettings().ballDisplay.overheadHeightEmphasis===1;a.importSettings(s);const session=a.exportSession();await a.importSession(session);const sessionExact=JSON.stringify(a.exportSession())===JSON.stringify(session);const oldSession=structuredClone(session);delete oldSession.ballDisplay.overheadHeightEmphasis;await a.importSession(oldSession);return{modern,legacy,omitted,sessionExact,legacySession:a.exportSession().ballDisplay.overheadHeightEmphasis===1};});for(const v of Object.values(surface.roundTrip))assert.equal(v,true);
        await p.locator('#cmd-pitch-choice').selectOption('auto');await p.evaluate(()=>KneekuraCameraLab.generate(6));assert.equal(sha(JSON.stringify(await history(p,'lab'))),recordHash);
        const paused=await p.evaluate(()=>{const a=KneekuraCameraLab,w=document.getElementById('match-engine').contentWindow,s=w.liveMatchPlayback.inspect(),record=s.host.history.find(r=>r.frames.some(f=>f.ball?.visible!==false&&f.ball?.position&&!f.possessedBy)),index=s.host.history.indexOf(record),frame=record.frames.find(f=>f.ball?.visible!==false&&f.ball?.position&&!f.possessedBy),ms=s.presentation.timing.preparationMs+(frame.tick-record.frames[0].tick)/record.play.diagnostics.sourceClockTicksPerSecond*1000+.01;a.setCamera('overhead');a.selectPitch(index);a.seek(ms);const view=a.inspect(),current=w.liveMatchPlayback.inspect().currentFrame,ball={...current.ball,ballKind:current.ballKind,possessedBy:current.possessedBy,sourceObservation:true},expected=w.liveMatchPlayback.paintLivePitchBall(ball,view.B.projection).ballDotDisplay;return{playing:view.playing,actual:view.B.ball,expected};});assert.equal(paused.playing,false);assert.deepEqual(paused.actual,paused.expected);surface.paused=paused;
        await p.screenshot({path:resolve(evidence,'lab-'+width+'.png')});
      }
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,kind+' overflow '+width);if(kind!=='normal')await p.close();
    }
    report.phase='normal-invalid-'+width;row.invalid=await page.evaluate(()=>{const a=liveMatchPlayback,before=JSON.stringify(a.inspect().presentation.ballDisplay),rows=[];let getterCalled=false;const getter={};Object.defineProperty(getter,'overheadHeightEmphasis',{enumerable:true,get(){getterCalled=true;return 2;}});for(const patch of[{overheadHeightEmphasis:0},{overheadHeightEmphasis:8.1},{overheadHeightEmphasis:NaN},{overheadHeightEmphasis:Infinity},{overheadHeightEmphasis:'2'},{perspective:2,overheadHeightEmphasis:0},{unknown:1},getter]){let error=null;try{a.setBallDisplay(patch);}catch(e){error=e.message;}rows.push({error,unchanged:JSON.stringify(a.inspect().presentation.ballDisplay)===before});}return{rows,getterCalled};});for(const v of row.invalid.rows)assert(v.error&&v.unchanged);assert.equal(row.invalid.getterCalled,false);
    assert.equal(sha(JSON.stringify(await history(page))),recordHash,'presentation probes preserve six actual records');await context.close();
  }
  for(const f of report.faults){assert.deepEqual(f.errors,[]);assert.deepEqual(f.external,[]);}
  for(const pin of pins)for(const[p,h]of Object.entries(pin.inputs))assert.equal(sha(await readFile(p)),h,'final source pin '+p);
  for(const[kind,path]of Object.entries(report.artifacts))assert.equal(sha(await readFile(path)),report.sha256[kind]);
  report.pass=true;report.phase='complete';console.log(JSON.stringify({pass:true,sha256:report.sha256,widths:[1200,390]}));
}catch(error){report.error=String(error.stack??error);await writeFile(resolve(evidence,'browser-failure-'+Date.now()+'.json'),JSON.stringify(report,null,2)+'\n');console.error(JSON.stringify({pass:false,phase:report.phase,error:String(error)}));process.exitCode=1;}
finally{if(browser)await browser.close();await writeFile(resolve(evidence,'browser-check.json'),JSON.stringify(report,null,2)+'\n');}
