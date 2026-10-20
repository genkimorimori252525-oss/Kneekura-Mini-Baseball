import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const path=resolve(process.argv[2]??'../../outputs/にーくら野球メーカー_v78_1_投球の多方向比較版.html'),dir='docs/verification/releases/v78.1';
const sha=b=>createHash('sha256').update(b).digest('hex'),bytes=await readFile(path),meta=JSON.parse(await readFile(path+'.build.json')),
 pins=JSON.parse(await readFile(path+'.bundle-inputs.json')),old=JSON.parse(await readFile('docs/demos/releases/v78/maker.html.build.json'));
assert.equal(sha(bytes),meta.sha256);assert(meta.pitchViews);assert.equal(sha(await readFile('docs/demos/baseball-maker-pitcher-views-v78.js')),meta.pitchViewsUiSha256);
for(const key of ['coreSha256','pitcherUiSha256','pitcherCssSha256','embeddedMatchRendererSha256','embeddedPitcherRendererSha256','liveRosterSha256','referenceSha256'])assert.equal(meta[key],old[key],key);
for(const [file,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(file)),hash,file);
await mkdir(dir,{recursive:true});const report={pass:false,sha256:meta.sha256,coreSha256:meta.coreSha256,sourceCount:Object.keys(pins.inputs).length,oldUiAndCoreUnchanged:true,cases:[],faults:[]};
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),faults={width,errors:[],external:[]};report.faults.push(faults);
  page.on('pageerror',e=>faults.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))faults.external.push(r.url());});
  await page.goto(pathToFileURL(path).href);await page.waitForFunction(()=>globalThis.KneekuraPitcherTrajectoryViewsV78?.inspect);
  await page.locator('#tab-pitcher').click();await page.locator('#pitcher-trajectory-details > summary').click();
  assert.equal(await page.locator('#pitcher-perspective-plots canvas').count(),4);
  const roster=await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster()));
  for(const pitch of ['fastball','curve']){
   await page.evaluate(p=>KneekuraPitcherMakerV78.selectPitch(p),pitch);
   await page.locator('#pitcher-run').click();await page.waitForFunction(()=>KneekuraPitcherTrajectoryViewsV78.inspect().ready||KneekuraPitcherTrajectoryViewsV78.inspect().error);
   const first=await page.evaluate(()=>({views:KneekuraPitcherTrajectoryViewsV78.inspect(),result:JSON.stringify(KneekuraPitcherMakerV78.exportResult())}));
   assert(first.views.ready,first.views.error);assert.equal(first.views.views.length,4);
   const pixels=await page.locator('#pitcher-perspective-plots canvas').evaluateAll(canvases=>canvases.map(canvas=>{
    const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let green=0,gray=0;
    for(let i=0;i<data.length;i+=4){if(data[i]<60&&data[i+1]>90&&data[i+1]<160&&data[i+2]<110)green++;if(Math.abs(data[i]-137)<8&&Math.abs(data[i+1]-150)<8&&Math.abs(data[i+2]-142)<8)gray++;}
    return {id:canvas.id,green,gray,width:canvas.getBoundingClientRect().width,png:canvas.toDataURL()};
   }));
   assert(pixels.every(p=>p.green>40&&p.gray>20&&p.width>150),JSON.stringify(pixels.map(({png,...p})=>p)));
   assert.notEqual(pixels[2].png,pixels[3].png);await page.locator('#pitcher-views-fit').uncheck();
   assert.equal(await page.evaluate(()=>JSON.stringify(KneekuraPitcherMakerV78.exportResult())),first.result);
   await page.locator('#pitcher-views-fit').check();
   assert.equal(await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster())),roster);
   const final=await page.evaluate(()=>KneekuraPitcherTrajectoryViewsV78.inspect());
   assert.equal(JSON.stringify(final.actual),JSON.stringify(first.views.actual));assert.equal(JSON.stringify(final.baseline),JSON.stringify(first.views.baseline));
   report.cases.push({width,pitch,points:first.views.actual.length,viewNames:first.views.views.map(v=>v.name),pixels:pixels.map(({png,...p})=>p),sourceAndRosterUnchanged:true});
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#pitcher-perspective-plots').screenshot({path:dir+'/views-'+width+'.png'});
  await page.evaluate(()=>KneekuraPitcherMakerV78.selectPitch('slider'));
  await page.waitForFunction(()=>!KneekuraPitcherTrajectoryViewsV78.inspect().ready);
  assert.equal(await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster())),roster);
  assert.deepEqual(faults.errors,[]);assert.deepEqual(faults.external,[]);await page.close();
 }
 assert.equal(sha(await readFile(path)),meta.sha256);report.pass=true;
}catch(error){report.error=String(error.stack??error);throw error;}
finally{await writeFile(dir+'/pitch-views-check.json',JSON.stringify(report,null,2)+'\n');await browser?.close();}
console.log(JSON.stringify({pass:true,cases:report.cases.length,sha256:meta.sha256,coreUnchanged:true}));
