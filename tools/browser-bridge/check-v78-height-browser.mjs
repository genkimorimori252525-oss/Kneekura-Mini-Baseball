import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const normal=resolve(process.argv[2]??'../../outputs/ばせぼーるlv78_TBD_vs_LAD_球種と縫い目物理版.html'),
 lab=resolve(process.argv[3]??'../../outputs/カメラワーク調整室_v78.html'),proof=resolve('docs/verification/releases/v78/height'),
 report={pass:false,normalSha256:null,workbenchSha256:null,views:[],faults:[]};
const sha=b=>createHash('sha256').update(b).digest('hex'),close=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
await mkdir(proof,{recursive:true});let browser;
try{
 for(const[key,path]of [['normalSha256',normal],['workbenchSha256',lab]]){const bytes=await readFile(path),m=JSON.parse(await readFile(path+'.build.json'));report[key]=sha(bytes);assert.equal(m.sha256,report[key]);}
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
 for(const width of[1200,390])for(const[kind,path]of[['normal',normal],['lab',lab]]){
  const page=await browser.newPage({viewport:{width,height:900}}),faults={width,kind,errors:[],external:[]};report.faults.push(faults);
  page.on('pageerror',e=>faults.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))faults.external.push(r.url());});
  await page.goto(pathToFileURL(path).href,{timeout:60000});await page.waitForFunction(kind=>kind==='lab'?KneekuraCameraLab.inspect().ready:!!globalThis.liveMatchPlayback,kind,{timeout:60000});
  const row=await page.evaluate(async kind=>{
   const w=kind==='lab'?document.getElementById('match-engine').contentWindow:window,p=w.liveMatchPlayback,
    projection={camera:'overhead',eye:{x:0,y:80,z:-100},yaw:0,pitch:.55,f:100,cx:300,cy:216},rows=[];
   const historyBefore=JSON.stringify(p.inspect().host),settingsBefore=w.KneekuraBallDisplayControls.inspect();
   for(const factor of[1,2,8])for(const h of[0,.1,2,4,10,20,30]){
    p.setBallDisplay({overheadHeightModel:'VIRTUAL_HEIGHT_V1',overheadHeightEmphasis:factor,perspective:1,overhead:1});
    const ball={position:{x:0,y:.0366+h,z:40},orientation:{w:1,x:0,y:0,z:0},visible:true,sourceObservation:true,ballKind:'batted',possessedBy:null};
    for(const name of['futureFrames','trajectory','predictedLanding','velocity'])Object.defineProperty(ball,name,{get(){throw Error('observing future '+name);}});
    const before=JSON.stringify(ball.position),result=p.paintLivePitchBall(ball,projection);
    rows.push({factor,height:h,dot:result.ballDotDisplay,positionUnchanged:before===JSON.stringify(ball.position)});
   }
   const others=[];
   for(const camera of['batter','catcher','mound','fielder','runner','overhead'])for(const ballKind of['pitch','throw','batted'])for(const factor of[1,8]){
    p.setBallDisplay({overheadHeightEmphasis:factor});const result=p.paintLivePitchBall({position:{x:0,y:2.0366,z:40},orientation:{w:1,x:0,y:0,z:0},visible:true,sourceObservation:true,ballKind,possessedBy:null},{...projection,camera});
    others.push({camera,ballKind,factor,dot:result.ballDotDisplay});
   }
   const held=p.paintLivePitchBall({position:{x:0,y:2,z:40},orientation:{w:1,x:0,y:0,z:0},visible:true,sourceObservation:true,ballKind:'batted',possessedBy:'C'},projection).ballDotDisplay;
   const legacy=w.KneekuraBallDisplayControls.normalizeImportedSettings({overheadHeightEmphasis:2});p.setBallDisplay(legacy);
   const oldMode=w.KneekuraBallDisplayControls.inspect().overheadHeightModel;
   const input=w.document.getElementById('ball-scale-overheadHeightEmphasis');input.value='2';input.dispatchEvent(new w.Event('change'));
   const switched=w.KneekuraBallDisplayControls.inspect().overheadHeightModel;
   p.setBallDisplay(settingsBefore);
   return {rows,others,held,oldMode,switched,hostUnchanged:JSON.stringify(p.inspect().host)===historyBefore,
    overflow:document.documentElement.scrollWidth>innerWidth,helperVersion:w.KneekuraBallDisplayControls.version};
  },kind);
  assert.equal(row.helperVersion,5);assert(row.hostUnchanged);assert.equal(row.overflow,false);assert.equal(row.held,null);
  assert.equal(row.oldMode,'LEGACY_DIAMETER_V4');assert.equal(row.switched,'VIRTUAL_HEIGHT_V1');
  const get=(h,f)=>row.rows.find(r=>r.height===h&&r.factor===f);
  close(get(2,2).dot.displayDiameterPx,get(4,1).dot.displayDiameterPx);close(get(10,2).dot.displayDiameterPx,get(20,1).dot.displayDiameterPx);
  for(const r of row.rows){assert(r.positionUnchanged&&r.dot);assert.equal(r.dot.style,'4px-dot-grid');close(r.dot.virtualHeightMeters,r.height*r.factor);assert(r.dot.displayDiameterPx>0);close(r.dot.projectedDiameterPx,get(r.height,1).dot.projectedDiameterPx);}
  for(const f of[1,2,8])close(get(0,f).dot.displayDiameterPx,get(0,1).dot.displayDiameterPx);
  assert(get(2,2).dot.displayDiameterPx<2*get(2,1).dot.displayDiameterPx,'not a literal diameter multiplier');
  for(const a of row.others.filter(r=>r.factor===8&&!(r.camera==='overhead'&&r.ballKind==='batted'))){const b=row.others.find(r=>r.camera===a.camera&&r.ballKind===a.ballKind&&r.factor===1);close(a.dot.displayDiameterPx,b.dot.displayDiameterPx);}
  report.views.push({width,kind,...row});assert.deepEqual(faults.errors,[]);assert.deepEqual(faults.external,[]);await page.close();
 }
 report.pass=true;
}catch(error){report.error=error.stack??String(error);throw error;}
finally{if(browser)await browser.close();await writeFile(resolve(proof,'height-check.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({pass:true,views:report.views.length,projectionRows:report.views.reduce((n,r)=>n+r.rows.length,0),normalSha256:report.normalSha256,workbenchSha256:report.workbenchSha256}));
