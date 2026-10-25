import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stadiumMesh} from './stadium-mesh.mjs';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {chromium}=createRequire(import.meta.url)('playwright-core');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{const page=await browser.newPage();await page.goto(pathToFileURL(resolve('../../outputs/球場設計室_v3_局所密度版.html')).href);await page.waitForFunction(()=>BallparkStudio?.inspect().ready);
 const data=await page.evaluate(()=>{const d=BallparkStudio.inspect().design;d.architecture.roof.openingPercent=0;BallparkStudio.setDesign(d);return d;});
 await page.waitForTimeout(100);const sample=await page.evaluate(()=>{
  const s=BallparkStudio.inspect(),w=document.getElementById('engine').contentWindow,cam=s.cameraProjection,grid=w.KneekuraPresentationControlsV84.grid,cells=new Map(),
   sy=Math.sin(cam.yaw),cy=Math.cos(cam.yaw),sp=Math.sin(cam.pitch),cp=Math.cos(cam.pitch),
   project=p=>{const dx=p.x-cam.eye.x,dy=p.y-cam.eye.y,dz=p.z-cam.eye.z,side=cy*dx-sy*dz,ahead=sy*dx+cy*dz,up=cp*dy+sp*ahead,depth=-sp*dy+cp*ahead;return depth<.12?null:{x:cam.cx+cam.f*side/depth,y:cam.cy-cam.f*up/depth,depth};},
   paint=(x,y,depth,color)=>{const key=grid.key(grid.snap(x),grid.snap(y)),old=cells.get(key);if(!old||depth<=old.depth+.001)cells.set(key,{x:grid.snap(x),y:grid.snap(y),depth,color});};
  w.KneekuraBallparkArchitectureV2.render({geometry:s.geometry,cam,grid,project,paint,cutaway:false});
  return {cam,geometry:s.geometry,red:[...cells.values()].filter(c=>parseInt(c.color.slice(1,3),16)>parseInt(c.color.slice(5,7),16)+40)};
 });
 const mesh=stadiumMesh(sample.geometry),cam=sample.cam,
  sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x}),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,
  hit=(dir,a,b,c)=>{const e1=sub(b,a),e2=sub(c,a),p=cross(dir,e2),det=dot(e1,p);if(Math.abs(det)<1e-8)return null;const v=sub(cam.eye,a),u=dot(v,p)/det;if(u<0||u>1)return null;const q=cross(v,e1),bary=dot(dir,q)/det;if(bary<0||bary+u>1)return null;const t=dot(e2,q)/det;return t>.12?t:null;};
 const leaks=[];for(const cell of sample.red){const side=(cell.x-cam.cx)/cam.f,up=(cam.cy-cell.y)/cam.f,ahead=Math.sin(cam.pitch)*up+Math.cos(cam.pitch),
  dir={x:Math.cos(cam.yaw)*side+Math.sin(cam.yaw)*ahead,y:Math.cos(cam.pitch)*up-Math.sin(cam.pitch),z:-Math.sin(cam.yaw)*side+Math.cos(cam.yaw)*ahead};let roof=Infinity;
  for(const s of mesh.surfaces.filter(s=>s.roof))for(let i=1;i<s.points.length-1;i++){const t=hit(dir,s.points[0],s.points[i],s.points[i+1]);if(t!==null)roof=Math.min(roof,t);}
  if(roof<cell.depth-.01)leaks.push({...cell,roof});}
 const report={cam,red:sample.red.length,leaks:leaks.length,examples:leaks.slice(0,8),sha256:createHash('sha256').update(await readFile('../../outputs/球場設計室_v3_局所密度版.html')).digest('hex')};
 console.log(JSON.stringify(report,null,2));
 if(process.argv[2]){assert(/^[a-z0-9-]+$/.test(process.argv[2]));await writeFile('docs/ballpark-studio/evidence/roof-depth-'+process.argv[2]+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});}
 assert.equal(leaks.length,0,'Closed roof must occlude every inspected spectator/rail light behind it');
}finally{await browser.close();}
