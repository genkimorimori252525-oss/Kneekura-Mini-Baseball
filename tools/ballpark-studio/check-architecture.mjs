import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {stadiumMesh} from './stadium-mesh.mjs';
const {chromium}=createRequire(import.meta.url)('playwright-core'),label=process.argv[2];
assert(/^[a-z0-9-]+$/.test(label??''));
const dir=resolve('docs/ballpark-studio/evidence/architecture-'+label),file=resolve('../../outputs/球場設計室_v3_局所密度版.html'),sha=x=>createHash('sha256').update(x).digest('hex'),report={pass:false,sha256:sha(await readFile(file)),errors:[],external:[],views:[],fineDepth:[]};
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
const wait=async()=>{await page.waitForFunction(()=>{const s=BallparkStudio.inspect();return s.error||(s.ready&&s.revision===s.renderedRevision);},null,{timeout:90000});let s=await page.evaluate(()=>BallparkStudio.inspect());assert(!s.error,s.error);await page.evaluate(()=>BallparkStudio.setCrowdPlayback({paused:true}));return s;},
 settle=async()=>{await page.waitForTimeout(80);return wait();},pixels=async()=>sha(await page.locator('#preview').evaluate(c=>c.toDataURL())),
 crop=p=>p.locator('#preview').evaluate(c=>Array.from(c.getContext('2d').getImageData(500,240,200,120).data));
async function checkFineDepth(name){
 const data=await page.evaluate(()=>{const s=BallparkStudio.inspect(),w=document.getElementById('engine').contentWindow,cam=s.cameraProjection,grid=w.KneekuraPresentationControlsV84.grid,fine=[],
  sy=Math.sin(cam.yaw),cy=Math.cos(cam.yaw),sp=Math.sin(cam.pitch),cp=Math.cos(cam.pitch),project=p=>{const dx=p.x-cam.eye.x,dy=p.y-cam.eye.y,dz=p.z-cam.eye.z,side=cy*dx-sy*dz,ahead=sy*dx+cy*dz,up=cp*dy+sp*ahead,depth=-sp*dy+cp*ahead;return depth<.12?null:{x:cam.cx+cam.f*side/depth,y:cam.cy-cam.f*up/depth,depth};};
  const result=w.KneekuraBallparkArchitectureV2.render({geometry:s.geometry,cam,grid,project,paint:(x,y,depth,color,alpha,owner,glow,density)=>{if(density>1)fine.push({x,y,depth});},cutaway:false});
  const stride=Math.max(1,Math.floor(fine.length/700));return{cam,geometry:s.geometry,candidates:fine.length,fine:fine.filter((_,i)=>i%stride===0),result};
 });
 const triangles=stadiumMesh(data.geometry).surfaces.flatMap(s=>s.points.slice(1,-1).map((_,i)=>[s.points[0],s.points[i+1],s.points[i+2]])),cam=data.cam,
  sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x}),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,
  hit=(dir,a,b,c)=>{const e1=sub(b,a),e2=sub(c,a),p=cross(dir,e2),det=dot(e1,p);if(Math.abs(det)<1e-8)return null;const v=sub(cam.eye,a),u=dot(v,p)/det;if(u< -1e-7||u>1+1e-7)return null;const q=cross(v,e1),v0=dot(dir,q)/det;if(v0< -1e-7||v0+u>1+1e-7)return null;const t=dot(e2,q)/det;return t>.12?t:null;};
 const leaks=[];for(const cell of data.fine){const side=(cell.x-cam.cx)/cam.f,up=(cam.cy-cell.y)/cam.f,ahead=Math.sin(cam.pitch)*up+Math.cos(cam.pitch),dir={x:Math.cos(cam.yaw)*side+Math.sin(cam.yaw)*ahead,y:Math.cos(cam.pitch)*up-Math.sin(cam.pitch),z:-Math.sin(cam.yaw)*side+Math.cos(cam.yaw)*ahead};
  let nearest=Infinity;for(const t of triangles){const h=hit(dir,...t);if(h!==null)nearest=Math.min(nearest,h);}if(nearest<cell.depth-.05)leaks.push({...cell,nearest});
 }
 report.fineDepth.push({name,candidates:data.candidates,samples:data.fine.length,leaks:leaks.length,rejectedByTriangleDepth:data.result.detail.fineGeometryOccluded,examples:leaks.slice(0,4)});
 assert(data.fine.length>0);assert.equal(leaks.length,0,'independent world ray/triangle depth '+name);
}
try{
 page=await browser.newPage({viewport:{width:1480,height:1100}});page.on('pageerror',e=>report.errors.push(String(e.stack??e)));page.on('request',r=>{if(/^https?:/.test(r.url()))report.external.push(r.url());});await page.goto(pathToFileURL(file).href,{timeout:90000});let s=await wait();const fixed=s.renderedFixed,base=s.design;
 for(const camera of ['stadium','exterior','interior','scoreboard','overhead','catcher','mound','batter','fielder']){const start=Date.now();await page.selectOption('#camera',camera);s=await settle();assert.deepEqual(s.renderedFixed,fixed);assert(s.architectureRender.triangles>0);report.views.push({camera,editToThreeCachedFramesMs:Date.now()-start,detail:s.architectureRender.detail});await page.locator('#preview').screenshot({path:dir+'/'+camera+'.png'});}
 await page.selectOption('#camera','exterior');await settle();await checkFineDepth('open-exterior');
 await page.locator('#roof-opening').evaluate(e=>{e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}));});await settle();await checkFineDepth('closed-exterior');await page.locator('#preview').screenshot({path:dir+'/closed-exterior.png'});
 await page.evaluate(d=>BallparkStudio.setDesign(d),base);await settle();await page.selectOption('#camera','interior');s=await settle();assert(s.architectureRender.detail.emblemCells>0);await checkFineDepth('open-interior');
 const withLogo=await pixels();await page.locator('.building-details').evaluate(e=>e.open=true);await page.locator('#building-logos').uncheck();s=await wait();assert.equal(s.architectureRender.detail.emblemCells,0);assert.notEqual(await pixels(),withLogo);await page.locator('#undo').click();await wait();assert.equal(await pixels(),withLogo);report.imageMaterialToggle=true;
 const factors=[];for(const factor of [2,8]){await page.selectOption('#building-factor',String(factor));s=await wait();factors.push(s.architectureRender.detail.fineCells);assert.deepEqual(s.renderedFixed,fixed);assert.equal(s.design.architecture.surfaceDetail.factor,base.architecture.surfaceDetail.factor);}assert(factors[1]>factors[0]);report.independentDensity={factors};
 await page.selectOption('#camera','exterior');await settle();const decorated=await pixels();await page.locator('#building-ornaments').uncheck();await wait();assert.notEqual(await pixels(),decorated);await page.locator('#undo').click();await wait();assert.equal(await pixels(),decorated);report.ornamentsToggle=true;
 await page.selectOption('#camera','overhead');await settle();const grass=await crop(page),common=(await page.evaluate(()=>BallparkStudio.inspect())).design;
 const old=await browser.newPage({viewport:{width:1480,height:1100}});await old.goto(pathToFileURL(resolve('../../outputs/球場設計室_v3_立体構造改修前.html')).href,{timeout:90000});await old.waitForFunction(()=>BallparkStudio?.inspect().ready);delete common.architecture.details;delete common.architecture.scoreboard;
 assert((await old.evaluate(d=>BallparkStudio.setDesign(d),common)).ok);await old.evaluate(()=>BallparkStudio.setCrowdPlayback({paused:true}));await old.selectOption('#camera','overhead');await old.waitForTimeout(250);assert.deepEqual(await crop(old),grass,'approved grass image region is pixel-identical to pre-architecture product');await old.close();report.approvedGrassPixelsIdentical=true;
 const full=await pixels();await page.selectOption('#crowd-attendance','empty');s=await wait();assert.equal(s.architectureRender.crowd.visibleLedCells,0);assert.equal(s.crowd.cachedFrames,1);assert.equal(s.crowd.active,false);assert.deepEqual(await crop(page),grass);const empty=await pixels();assert.notEqual(full,empty);
 const without=s.design;delete without.architecture.crowd.attendance;await page.evaluate(d=>BallparkStudio.setDesign(d),without);await wait();await page.evaluate(()=>BallparkStudio.setCrowdPlayback({visible:false,paused:true}));await settle();assert.equal(await pixels(),empty,'persisted empty and original seat-material API have identical pixels');
 await page.selectOption('#crowd-attendance','full');await wait();assert.equal(await pixels(),full);report.attendanceAndSeatMaterials=true;
 await page.selectOption('#camera','exterior');await settle();const rect=await page.locator('#preview').boundingBox();await page.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.5);await page.mouse.down({button:'right'});await page.mouse.move(rect.x+rect.width*.8,rect.y+rect.height*.35,{steps:4});await page.mouse.up({button:'right'});s=await settle();assert(s.view.orbit);assert.deepEqual(s.renderedFixed,fixed);await page.locator('#preview').screenshot({path:dir+'/orbit.png'});await checkFineDepth('orbit');report.worldOrbit=true;
 const json=await page.evaluate(()=>BallparkStudio.exportJSON());assert.equal(JSON.parse(json).architecture.details.factor,8);await page.locator('#browser-save').click();await page.reload();s=await wait();assert.equal(await page.evaluate(()=>BallparkStudio.exportJSON()),json);report.detailsSaveReload=true;
 const legacy=s.design;delete legacy.architecture.details;assert((await page.evaluate(d=>BallparkStudio.setDesign(d),legacy)).ok);s=await wait();assert(!Object.hasOwn(s.design.architecture,'details'));assert.equal(s.architectureRender.detail.factor,6);report.legacyNoMutation=true;
 const count=s.crowd.sceneRenders;await page.waitForTimeout(850);assert.equal((await page.evaluate(()=>BallparkStudio.inspect())).crowd.sceneRenders,count);report.noIdleSceneRebuild=true;
 for(const width of [390,320]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:dir+'/mobile-'+width+'.png',fullPage:true});}report.mobile=true;
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);report.pass=true;
}catch(e){report.error=String(e.stack??e);process.exitCode=1;if(page)await page.screenshot({path:dir+'/failure.png',fullPage:true}).catch(()=>{});}
finally{await browser.close();await writeFile(dir+'/report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});}console.log(JSON.stringify(report));
