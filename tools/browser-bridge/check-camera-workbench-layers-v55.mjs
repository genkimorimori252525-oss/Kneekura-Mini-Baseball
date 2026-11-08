import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [artifactArg,evidenceArg,mode='green']=process.argv.slice(2);
if(!artifactArg||!evidenceArg||!['red','green'].includes(mode))throw Error('requires workbench HTML, NEW evidence directory, and red|green');
const artifact=resolve(artifactArg),evidence=resolve(evidenceArg),sha=value=>createHash('sha256').update(value).digest('hex');
await mkdir(evidence,{recursive:false});
const report={artifact,mode,pass:false,views:[],mismatches:[],phase:'source-pins'};let browser,page;
const call=(page,name,...args)=>page.evaluate(({name,args})=>window.KneekuraCameraLab[name](...args),{name,args});
const hashes=page=>page.evaluate(async()=>{const s=document.getElementById('match-engine').contentWindow.liveMatchPlayback.inspect(),hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(x=>x.toString(16).padStart(2,'0')).join(''),out=[];
 for(const r of s.host.history)out.push({core:await hash({frames:r.frames,play:r.play,events:r.events,match:r.match}),bat:await hash(r.frames.filter(f=>f.bat).map(f=>({tick:f.tick,grip:f.bat.grip,tip:f.bat.tip,radiusProfile:f.bat.radiusProfile})))});return out;});
// Capture all source layers synchronously at the start of each A/B canvas copy.
// This observes the actual side's renderer, without recreating its camera or advancing Core.
const installCapture=page=>page.evaluate(()=>{const w=document.getElementById('match-engine').contentWindow,original=CanvasRenderingContext2D.prototype.clearRect,ids=['field','bat-overlay','ball-overlay'];window.cameraLayerCaptures={};
 CanvasRenderingContext2D.prototype.clearRect=function(...args){const side=this.canvas.id==='view-A'?'A':this.canvas.id==='view-B'?'B':null;
  if(side){const s=w.liveMatchPlayback.inspect(),canvas=document.createElement('canvas');canvas.width=this.canvas.width;canvas.height=this.canvas.height;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.globalCompositeOperation='source-over';
   const layers=ids.map(id=>{const c=w.document.getElementById(id);if(!c)throw Error('missing Source layer '+id);const rgba=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let alphaPixels=0;for(let i=3;i<rgba.length;i+=4)if(rgba[i])alphaPixels++;ctx.drawImage(c,0,0,canvas.width,canvas.height);return{id,width:c.width,height:c.height,opacity:w.getComputedStyle(c).opacity,alphaPixels,rgba};});
   const raw=ctx.getImageData(0,0,canvas.width,canvas.height).data,view=s.presentation.continuousBatterView,scaleX=canvas.width/600,scaleY=canvas.height/432,guideOn=document.getElementById('guides').checked,guide=guideOn&&s.rendered.camera==='batter',cx=(view?.cx??300)*scaleX,cy=(view?.cy??216)*scaleY;
   if(guide){ctx.strokeStyle=side==='A'?'#70c8ff':'#ffdc69';ctx.lineWidth=scaleX;ctx.beginPath();ctx.moveTo(cx-8*scaleX,cy);ctx.lineTo(cx+8*scaleX,cy);ctx.moveTo(cx,cy-8*scaleY);ctx.lineTo(cx,cy+8*scaleY);ctx.stroke();}
   window.cameraLayerCaptures[side]={layers,raw,expected:ctx.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height,sceneMs:s.presentation.elapsedMs,tick:s.currentFrame.tick,selectedPitch:s.selectedPitch,camera:s.rendered.camera,ballKind:s.currentFrame.ballKind,possessedBy:s.currentFrame.possessedBy??null,guideOn,guide,cx,cy,scaleX,scaleY};
  }return original.apply(this,args);
 };
});
const compare=page=>page.evaluate(async()=>{const lab=window.KneekuraCameraLab.inspect(),hex=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join(''),out=[];
 for(const side of ['A','B']){const c=window.cameraLayerCaptures[side];if(!c)throw Error('side copy was not observed: '+side);const canvas=document.getElementById('view-'+side),actual=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  let differentPixels=0,firstDifference=null,guideChangedPixels=0,minX=Infinity,minY=Infinity,maxX=-1,maxY=-1;
  for(let i=0;i<actual.length;i+=4){const differs=(a,b)=>a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3];if(differs(actual,c.expected)){differentPixels++;firstDifference??={x:(i/4)%c.width,y:Math.floor(i/4/c.width),actual:Array.from(actual.slice(i,i+4)),expected:Array.from(c.expected.slice(i,i+4))};}
   if(differs(actual,c.raw)){guideChangedPixels++;const x=(i/4)%c.width,y=Math.floor(i/4/c.width);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}
  const layers=[];for(const l of c.layers)layers.push({id:l.id,width:l.width,height:l.height,opacity:l.opacity,alphaPixels:l.alphaPixels,sha256:await hex(l.rgba)});
  const center=(Math.floor(c.cy)*c.width+Math.floor(c.cx))*4;out.push({side,width:c.width,height:c.height,sceneMs:c.sceneMs,tick:c.tick,selectedPitch:c.selectedPitch,camera:c.camera,ballKind:c.ballKind,possessedBy:c.possessedBy,layers,fieldSha256:layers[0].sha256,compositeSha256:await hex(c.raw),expectedSha256:await hex(c.expected),actualSha256:await hex(actual),differentPixels,firstDifference,guide:{enabled:c.guideOn,applied:c.guide,cx:c.cx,cy:c.cy,scaleX:c.scaleX,scaleY:c.scaleY,changedPixels:guideChangedPixels,bounds:guideChangedPixels?{minX,minY,maxX,maxY}:null,centerPixel:Array.from(actual.slice(center,center+4))},snapshot:{sceneMs:lab[side].sceneMs,tick:lab[side].tick,camera:lab[side].camera}});
 }return{sceneMs:lab.sceneMs,A:lab.A.tick,B:lab.B.tick,sides:out};
});
try{
 const bytes=await readFile(artifact),meta=JSON.parse(bytes.toString('utf8').match(/<script id="camera-workbench-source" type="application\/json">([^<]*)<\/script>/)[1]),pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
 report.sha256=sha(bytes);report.metadata=meta;report.sourceInputCount=Object.keys(pins.inputs).length;if(mode==='red')assert.equal(report.sha256,'ad40f7832a1621b09cd5efa3804d6cbfa6ef2534c73242ec6e6a9e0a41e05016','preserved v55 RED artifact');assert.equal(report.sourceInputCount,113);assert.equal(meta.sourceInputCount,113);assert.equal(meta.sourceCoreSha256,pins.entrySha256);assert.equal(sha(await readFile('dist/native-match-core-browser.js')),pins.entrySha256);
 for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,path);assert.equal(meta.cameraHelperSha256,sha(await readFile('tools/browser-bridge/live-camera-tuning-batter-view.js')));
 report.currentDriverSha256=sha(await readFile('tools/browser-bridge/camera-workbench-v55.js'));if(mode==='green')assert.equal(meta.workbenchDriverSha256,report.currentDriverSha256,'GREEN uses the current driver');
 // Repeated readback can migrate the persistent target to CPU while a fresh
 // reference still uses GPU, whose alpha rounding differs. Use one raster backend.
 report.browserArgs=['--disable-accelerated-2d-canvas'];
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:report.browserArgs});let referenceHashes;
 for(const width of [1200,390]){report.phase='layers-'+width;const context=await browser.newContext({viewport:{width,height:860}});page=await context.newPage();const view={width,errors:[],externalRequests:[],samples:[]};report.views.push(view);page.on('pageerror',error=>view.errors.push(String(error)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))view.externalRequests.push(r.url());});
  await page.goto(pathToFileURL(artifact).href);await page.waitForFunction(()=>window.KneekuraCameraLab?.inspect().ready,{},{timeout:20000});await call(page,'generate',12);const before=await hashes(page);assert.equal(before.length,12);if(referenceHashes)assert.deepEqual(before,referenceHashes,'viewport preserves Core/bat');else referenceHashes=before;view.sourceHashes=before;
  const cases=await page.evaluate(()=>{const s=document.getElementById('match-engine').contentWindow.liveMatchPlayback.inspect(),prep=s.presentation.timing.preparationMs,out={};
   for(const [pitch,r]of s.host.history.entries()){const d=r.play.diagnostics,tps=d.sourceClockTicksPerSecond??1e6,ms=tick=>prep+(tick-r.frames[0].tick)/tps*1000+.01;
    if(d.swingOffered&&r.play.contactMoment?.ball)out['swing-'+d.battingSide]??={kind:'swing-'+d.battingSide,pitch,ms:ms(r.play.contactMoment.ball.tick)};
    const flight=r.frames.filter(f=>f.ballKind==='pitch'&&f.ball&&f.ball.visible!==false&&!f.possessedBy);if(!d.swingOffered&&flight.length)out.pitch??={kind:'pitch',pitch,ms:ms(flight[Math.floor(flight.length/2)].tick)};
    const batted=r.frames.filter(f=>f.ballKind==='batted'&&f.ball&&f.ball.visible!==false&&!f.possessedBy);if(batted.length)out.batted??={kind:'batted',pitch,ms:ms(batted[Math.min(2,batted.length-1)].tick)};
    const held=r.frames.find(f=>f.possessedBy);if(held)out.held??={kind:'held',pitch,ms:ms(held.tick)};
   }return out;
  });view.cases=cases;for(const kind of ['swing-L','swing-R','pitch','batted','held'])assert(cases[kind],'actual 12-pitch case '+kind);
  await installCapture(page);const visible={A:new Set(),B:new Set()};
  const sample=async(camera,candidate,guides=false)=>{await call(page,'selectPitch',candidate.pitch);await call(page,'setCamera',camera);await page.locator('#guides').setChecked(guides);await call(page,'seek',candidate.ms);const result=await compare(page);assert.equal(result.A,result.B,'same A/B tick');
   const row={camera,kind:candidate.kind,guides,...result};view.samples.push(row);
   for(const side of result.sides){assert.equal(side.width,1200);assert.equal(side.height,864);assert.equal(side.sceneMs,result.sceneMs);assert.equal(side.sceneMs,side.snapshot.sceneMs);assert.equal(side.tick,side.snapshot.tick);assert.equal(side.camera,side.snapshot.camera);assert.equal(side.selectedPitch,candidate.pitch);
    for(const layer of side.layers){assert.equal(layer.width,1200);assert.equal(layer.height,864);assert.equal(layer.opacity,'1');}
    if(side.layers[1].alphaPixels>0&&candidate.kind.startsWith('swing'))visible[side.side].add(candidate.kind);if(side.layers[2].alphaPixels>0&&['pitch','batted'].includes(candidate.kind))visible[side.side].add(candidate.kind);
    if(candidate.kind==='held'){assert(side.possessedBy,'actual custody');assert.equal(side.layers[2].alphaPixels,0,'held ball overlay is transparent');}
    if(side.actualSha256!==side.expectedSha256)report.mismatches.push({width,camera,kind:candidate.kind,guides,side:side.side,differentPixels:side.differentPixels,firstDifference:side.firstDifference,fieldOnly:side.actualSha256===side.fieldSha256});
    if(guides&&side.actualSha256===side.expectedSha256){if(side.guide.applied){const color=side.side==='A'?[112,200,255,255]:[255,220,105,255];assert.deepEqual(side.guide.centerPixel,color,'guide at logical center scaled to backing pixels');assert(side.guide.changedPixels>0);const b=side.guide.bounds;assert(b.minX>=side.guide.cx-17&&b.maxX<=side.guide.cx+17&&b.minY>=side.guide.cy-17&&b.maxY<=side.guide.cy+17,'only scaled center cross changes');}else assert.equal(side.guide.changedPixels,0,'other cameras have no batter guide');}
   }return row;
  };
  for(const camera of ['batter','runner','mound','catcher','overhead']){for(const candidate of Object.values(cases))await sample(camera,candidate);await sample(camera,cases['swing-R'],true);}
  view.visibleCoverage=Object.fromEntries(Object.entries(visible).map(([side,values])=>[side,[...values]]));for(const side of ['A','B'])for(const kind of ['swing-L','swing-R','pitch','batted'])assert(visible[side].has(kind),'nonempty actual overlay '+side+' '+kind);
  await page.locator('#guides').uncheck();await call(page,'setCamera','batter');await call(page,'selectPitch',cases['swing-R'].pitch);await call(page,'seek',cases['swing-R'].ms);await page.locator('#view-A').screenshot({path:resolve(evidence,'layers-A-'+width+'.png')});await page.locator('#view-B').screenshot({path:resolve(evidence,'layers-B-'+width+'.png')});
  assert.deepEqual(await hashes(page),before,'composition and guides cannot change Core/bat history');assert.deepEqual(view.errors,[]);assert.deepEqual(view.externalRequests,[]);await context.close();page=null;
 }
 report.phase='pixel-verdict';assert.equal(sha(await readFile(artifact)),report.sha256);for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,path);
 assert.equal(report.mismatches.length,0,'all A/B pixels must equal actual field+bat+ball source-over composition and scaled batter guide');report.pass=true;console.log(JSON.stringify({pass:true,sha256:report.sha256,widths:report.views.map(v=>v.width),samples:report.views.map(v=>v.samples.length)}));
}catch(error){report.error=String(error.stack??error);if(page)try{await page.screenshot({path:resolve(evidence,'failure.png'),fullPage:true});}catch{}throw error;}
finally{await writeFile(resolve(evidence,'layers-check.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();}
