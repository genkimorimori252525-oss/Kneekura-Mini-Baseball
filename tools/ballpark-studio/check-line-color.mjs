import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=createRequire(import.meta.url)('playwright-core');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),errors=[];
const ready=p=>p.waitForFunction(()=>{const s=globalThis.BallparkStudio?.inspect();return s?.ready&&s.revision===s.renderedRevision;});
try{
 const canvases=[],fixed=[];
 for(const name of ['球場設計室_v3_局所密度版_金線変更前.html','球場設計室_v3_局所密度版.html']){
  const p=await browser.newPage({viewport:{width:1280,height:1100}});p.on('pageerror',e=>errors.push(String(e)));
  await p.goto(pathToFileURL(resolve('../../outputs/'+name)).href);await ready(p);await p.locator('#camera').selectOption('overhead');await p.waitForTimeout(100);await ready(p);
  fixed.push(await p.evaluate(()=>BallparkStudio.inspect().renderedFixed));
  canvases.push(await p.locator('#preview').evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data)));
  if(canvases.length===2){
   await p.locator('#preview').screenshot({path:'docs/ballpark-studio/evidence/gold-lines-overhead.png'});
   const before=await p.locator('#preview').evaluate(c=>c.toDataURL()),d=await p.evaluate(()=>BallparkStudio.inspect().design);
   d.architecture.colors.gold='#6a8050';await p.evaluate(d=>BallparkStudio.setDesign(d),d);await ready(p);
   assert.notEqual(await p.locator('#preview').evaluate(c=>c.toDataURL()),before,'theme edit invalidates cached line colors');
   d.architecture.colors.gold='#d6ae4d';await p.evaluate(d=>BallparkStudio.setDesign(d),d);await ready(p);
   assert.equal(await p.locator('#preview').evaluate(c=>c.toDataURL()),before,'theme restoration restores the exact image');
  }
 }
 assert.deepEqual(fixed[0],fixed[1]);let changed=0,gold=0;
 const [a,b]=canvases;assert.equal(a.length,b.length);
 for(let i=0;i<a.length;i+=4){
  assert.equal(a[i+3],b[i+3]);
  assert.equal(a[i]+a[i+1]+a[i+2]>0,b[i]+b[i+1]+b[i+2]>0,'no point is added, moved, widened or removed');
  if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]){
   changed++;const dr=a[i]-b[i],dg=a[i+1]-b[i+1],db=a[i+2]-b[i+2];
   assert(dr>=0&&dg>=dr-1&&db>=dg-1,'only white-to-gold tint may change');
  }
  if(b[i]===222&&b[i+1]===190&&b[i+2]===113)gold++;
 }
 assert(changed>100);assert(gold>10);assert.deepEqual(errors,[]);
 const sha256=createHash('sha256').update(await readFile('../../outputs/球場設計室_v3_局所密度版.html')).digest('hex');
 const report={pass:true,changedPixels:changed,brightGoldPixels:gold,lineColor:'#debe71',fixedGeometryUnchanged:true,pointFootprintIdentical:true,themeCacheRoundtrip:true,errors,sha256};
 await writeFile('docs/ballpark-studio/evidence/gold-lines.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
}finally{await browser.close();}
