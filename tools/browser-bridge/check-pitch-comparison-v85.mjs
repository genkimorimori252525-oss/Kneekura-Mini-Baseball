import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const file=resolve(process.argv[2]??'../../outputs/にーくら野球メーカー_v85_設定解説と比較切替版.html'),
 directory=resolve(process.argv[3]??'docs/verification/releases/v85/comparison-browser');
const sha=value=>createHash('sha256').update(value).digest('hex'),artifactSha256=sha(await readFile(file)),meta=JSON.parse(await readFile(file+'.build.json'));
assert.equal(artifactSha256,meta.sha256);assert.equal(meta.makerGuidesVersion,85);assert.equal(meta.unspunComparisonDefault,false);
for(const [path,key]of [['docs/demos/baseball-maker-pitcher-v85.js','pitcherUiSha256'],['docs/demos/baseball-maker-pitcher-views-v85.js','pitchViewsUiSha256']])assert.equal(sha(await readFile(path)),meta[key],path);
await mkdir(directory,{recursive:true});
const report={pass:false,file,artifactSha256,sourceHashes:{pitcher:meta.pitcherUiSha256,views:meta.pitchViewsUiSha256},
 scope:'Headless Chrome, viewport widths 1200/390, R/L fastball and curve trials; six trajectory canvases plus plate-position canvas.',cases:[],lifecycle:[],faults:[]};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});

async function installDrawingObserver(page){
 await page.addInitScript(()=>{
  const wanted=new Set(['pitcher-plot-side','pitcher-plot-top','pitcher-plot-behind','pitcher-plot-catcher','pitcher-plot-batter-right','pitcher-plot-batter-left','pitcher-zone']);
  const paths=new WeakMap(),draws=new Map();globalThis.__pitchComparisonDraws=draws;
  for(const method of ['beginPath','moveTo','lineTo','arc','rect','fillRect','strokeRect','stroke','fill','fillText']){
   const original=CanvasRenderingContext2D.prototype[method];
   CanvasRenderingContext2D.prototype[method]=function(...args){
    const id=this.canvas.id;if(wanted.has(id)){
     if(method==='beginPath')paths.set(this,[]);
     else if(['moveTo','lineTo','arc','rect'].includes(method)){const path=paths.get(this)??[];path.push([method,...args]);paths.set(this,path);}
     else{
      if(method==='fillRect'&&args[0]===0&&args[1]===0&&args[2]===this.canvas.width&&args[3]===this.canvas.height)draws.set(id,[]);
      const entries=draws.get(id)??[];
      entries.push({method,style:['stroke','strokeRect'].includes(method)?this.strokeStyle:this.fillStyle,
       lineWidth:['stroke','strokeRect'].includes(method)?this.lineWidth:null,args,
       path:['stroke','fill'].includes(method)?structuredClone(paths.get(this)??[]):null});draws.set(id,entries);
     }
    }
    return original.apply(this,args);
   };
  }
 });
}
async function state(page,remember=false){
 return page.evaluate(remember=>{
  const api=KneekuraPitcherMakerV78,trial=api.getResult();if(remember)globalThis.__comparisonTrial=trial;
  return {sameTrial:trial===globalThis.__comparisonTrial,ready:!!trial,
   snapshot:JSON.stringify({input:api.getInput(),result:api.exportResult(),metrics:trial?.metrics,
    source:trial?.pitch.diagnostics.sourceDescriptor,roster:baseballMaker.getLiveRoster(),views:KneekuraPitcherTrajectoryViewsV78.inspect()}),
   off:document.getElementById('pitcher-comparison-off').getAttribute('aria-pressed'),on:document.getElementById('pitcher-comparison-on').getAttribute('aria-pressed')};
 },remember);
}
async function canvases(page){
 const rows=await page.evaluate(()=>[...document.querySelectorAll('#pitcher-trajectory-details canvas,#pitcher-zone')].map(canvas=>{
  const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let grayPixels=0,greenPixels=0;
  for(let n=0;n<rgba.length;n+=4){
   if(rgba[n]===137&&rgba[n+1]===150&&rgba[n+2]===142)grayPixels++;
   if((rgba[n]===24&&rgba[n+1]===130&&rgba[n+2]===77)||(rgba[n]===21&&rgba[n+1]===123&&rgba[n+2]===72))greenPixels++;
  }
  const drawing=globalThis.__pitchComparisonDraws.get(canvas.id)??[];
  const composite=document.createElement('canvas');composite.width=canvas.width;composite.height=canvas.height;
  const context=composite.getContext('2d');context.fillStyle=getComputedStyle(canvas).backgroundColor;context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(canvas,0,0);
  return {id:canvas.id,grayPixels,greenPixels,cssWidth:canvas.getBoundingClientRect().width,png:canvas.toDataURL(),visual:composite.toDataURL(),
   gray:drawing.filter(row=>row.style==='#89968e'),actual:drawing.filter(row=>['#18824d','#157b48'].includes(row.style)),drawing};
 }));
 return rows.map(({png,visual,drawing,...row})=>({...row,pngSha256:sha(png),visualSha256:sha(visual),drawingSha256:sha(JSON.stringify(drawing)),actualSha256:sha(JSON.stringify(row.actual)),grayCount:row.gray.length}));
}
async function toggle(page,visible){
 await page.locator(visible?'#pitcher-comparison-on':'#pitcher-comparison-off').click();
 const current=await state(page);assert.equal(current.on,String(visible));assert.equal(current.off,String(!visible));return current;
}
async function run(page){
 await page.evaluate(async()=>{await KneekuraPitcherMakerV78.run();KneekuraPitcherMakerV78.seek(0);KneekuraPitcherTrajectoryViewsV78.refresh();});
 await page.waitForFunction(()=>KneekuraPitcherTrajectoryViewsV78.inspect().ready);
}
const summarized=rows=>rows.map(({gray,actual,...row})=>row);
function unchanged(reference,current,message){assert(current.sameTrial,message+' trial identity');assert.equal(current.snapshot,reference.snapshot,message+' input/result/metrics/source/roster/model');}

try{
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),faults={width,errors:[],external:[]};report.faults.push(faults);
  page.on('pageerror',error=>faults.errors.push(String(error)));page.on('request',request=>{if(!/^(file:|data:|blob:|about:)/.test(request.url()))faults.external.push(request.url());});
  await installDrawingObserver(page);await page.goto(pathToFileURL(file).href,{timeout:60000});
  await page.waitForFunction(()=>globalThis.KneekuraPitcherTrajectoryViewsV78?.inspect&&globalThis.KneekuraPitcherMakerV78);
  await page.locator('#tab-pitcher').click();await page.locator('#pitcher-trajectory-details > summary').click();
  assert.equal(await page.locator('[aria-label="無回転の比較線"]').count(),1);
  assert.equal(await page.locator('#pitcher-comparison-off').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#pitcher-comparison-on').getAttribute('aria-pressed'),'false');
  const emptyBefore=await state(page,true),emptyPixels=await canvases(page);assert.equal(emptyBefore.ready,false);
  await toggle(page,true);unchanged(emptyBefore,await state(page),'empty ON');await toggle(page,false);unchanged(emptyBefore,await state(page),'empty OFF');
  const emptyRestored=await canvases(page);assert.deepEqual(emptyRestored.map(row=>row.visualSha256),emptyPixels.map(row=>row.visualSha256),'empty toggle restores visible pixels including CSS background');
  report.lifecycle.push({width,kind:'emptyTrial',initialOff:true,onOffWithoutErrors:true,sourceAndRosterUnchanged:true,visiblePixelsRestored:true,
   rawAlphaRepainted:emptyRestored.filter((row,n)=>row.pngSha256!==emptyPixels[n].pngSha256).map(row=>row.id)});
  const originalPlayer=await page.evaluate(()=>KneekuraPitcherMakerV78.inspect().pitcherId);
  for(const hand of ['R','L']){
   await page.locator('#pitcher-hand').selectOption(hand);await page.evaluate(()=>KneekuraPitcherMakerV78.selectPitch('fastball'));await run(page);
   const reference=await state(page,true),off=await canvases(page);assert.equal(off.length,7);assert.equal(reference.on,'false');
   assert(off.every(row=>row.grayCount===0&&row.grayPixels===0&&row.actual.length>0),JSON.stringify(summarized(off)));
   assert(off.every(row=>row.cssWidth>100),'all seven charts remain visible at '+width);
   await page.locator('#pitcher-trajectory-details').screenshot({path:resolve(directory,`comparison-${width}-${hand}-off.png`)});
   await page.locator('#pitcher-zone').screenshot({path:resolve(directory,`plate-${width}-${hand}-off.png`)});
   const onState=await toggle(page,true),on=await canvases(page);unchanged(reference,onState,'ON');
   for(let n=0;n<off.length;n++){
    assert.equal(on[n].id,off[n].id);assert(on[n].grayCount>0,on[n].id+' has gray drawing');assert(on[n].grayPixels>0,on[n].id+' has gray pixels');
    assert.equal(on[n].actualSha256,off[n].actualSha256,on[n].id+' actual coordinates and scale');assert.notEqual(on[n].pngSha256,off[n].pngSha256,on[n].id+' overlay changes pixels');
   }
   await page.locator('#pitcher-trajectory-details').screenshot({path:resolve(directory,`comparison-${width}-${hand}-on.png`)});
   await page.locator('#pitcher-zone').screenshot({path:resolve(directory,`plate-${width}-${hand}-on.png`)});
   const restoredState=await toggle(page,false),restored=await canvases(page);unchanged(reference,restoredState,'OFF restoration');
   assert.deepEqual(restored.map(row=>row.pngSha256),off.map(row=>row.pngSha256),'all seven OFF pixel hashes restored');
   assert.deepEqual(restored.map(row=>row.drawingSha256),off.map(row=>row.drawingSha256),'all seven OFF drawing logs restored');
   await page.locator('#pitcher-views-fit').uncheck();const fitOff=await canvases(page);await toggle(page,true);const fitOn=await canvases(page);
   assert.deepEqual(fitOn.map(row=>row.actualSha256),fitOff.map(row=>row.actualSha256),'unfit actual coordinates and scale unchanged');
   await toggle(page,false);assert.deepEqual((await canvases(page)).map(row=>row.pngSha256),fitOff.map(row=>row.pngSha256),'unfit OFF pixel hashes restored');
   await page.locator('#pitcher-views-fit').check();unchanged(reference,await state(page),'fit changes');
   report.cases.push({width,hand,pitch:'fastball',initialOff:true,grayAddedToAllSeven:true,actualCoordinatesAndScaleUnchanged:true,
    trialIdentityInputMetricsSourceRosterModelUnchanged:true,offPixelsAndCommandsRestored:true,fitEnabledAndDisabled:true,off:summarized(off),on:summarized(on)});
   await toggle(page,true);await page.evaluate(()=>KneekuraPitcherMakerV78.selectPitch('curve'));
   assert.equal((await state(page)).ready,false);assert.equal((await state(page)).on,'true');
   await run(page);const curve=await canvases(page);assert(curve.every(row=>row.grayCount>0),'ON retained after pitch selection and a new trial');
   const curveState=await state(page,true);await toggle(page,false);unchanged(curveState,await state(page),'new curve OFF');
   assert((await canvases(page)).every(row=>row.grayCount===0));
   report.lifecycle.push({width,hand,kind:'pitchSelection',pitch:'curve',invalidatesTrial:true,retainsUiState:true,newTrialUsesState:true});
  }
  await toggle(page,true);
  const other=await page.evaluate(original=>KneekuraLiveGameRosterCatalog.players.find(player=>player.playerId!==original&&player.role==='P').playerId,originalPlayer);
  await page.evaluate(id=>KneekuraPitcherMakerV78.selectPlayer(id),other);assert.equal((await state(page)).ready,false);assert.equal((await state(page)).on,'true');
  await page.evaluate(()=>KneekuraPitcherMakerV78.selectPitch('fastball'));await run(page);assert((await canvases(page)).every(row=>row.grayCount>0));
  const otherState=await state(page,true);await toggle(page,false);unchanged(otherState,await state(page),'new player OFF');assert((await canvases(page)).every(row=>row.grayCount===0));
  report.lifecycle.push({width,kind:'playerSelection',playerId:other,invalidatesTrial:true,retainsUiState:true,newTrialUsesState:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(faults.errors,[]);assert.deepEqual(faults.external,[]);await page.close();
 }
 assert.equal(sha(await readFile(file)),artifactSha256,'product HTML unchanged during checks');report.pass=true;
 console.log(JSON.stringify({pass:true,artifactSha256,cases:report.cases.length,lifecycle:report.lifecycle.length,canvases:7,errors:report.faults.flatMap(row=>row.errors).length,output:directory}));
}catch(error){report.error=String(error.stack??error);throw error;}
finally{await browser.close();await writeFile(resolve(directory,'report.json'),JSON.stringify(report,null,2)+'\n');}
