import {createRequire} from 'node:module';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright-core'),browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{const p=await browser.newPage({viewport:{width:1280,height:1100}});await p.goto(pathToFileURL(resolve('../../outputs/球場設計室_v3_局所密度版.html')).href);await p.waitForFunction(()=>BallparkStudio?.inspect().ready);
 await p.evaluate(()=>BallparkStudio.setCrowdPlayback({paused:true}));
 if(process.argv[2]==='overhead'){await p.locator('#camera').selectOption('overhead');await p.waitForTimeout(100);}
 const wait=()=>p.waitForFunction(()=>{const s=BallparkStudio.inspect();return s.revision===s.renderedRevision;});
 const d=await p.evaluate(()=>BallparkStudio.inspect().design);d.architecture.logo.glow=1;d.architecture.logo.brightness=3;d.architecture.surfaceDetail.factor=8;d.architecture.roof.openingPercent=0;
 await p.locator('#roof-cutaway').uncheck();await p.waitForTimeout(100);await p.evaluate(d=>BallparkStudio.setDesign(d),d);await wait();
 const a=await p.locator('#preview').evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data)),state=await p.evaluate(()=>BallparkStudio.inspect());await p.locator('#preview').screenshot({path:'docs/ballpark-studio/evidence/glow-before.png'});
 d.architecture.logo.enabled=false;await p.evaluate(d=>BallparkStudio.setDesign(d),d);await wait();const b=await p.locator('#preview').evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data));await p.locator('#preview').screenshot({path:'docs/ballpark-studio/evidence/glow-disabled.png'});
 const differences=[];for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])differences.push({x:i/4%1200,y:Math.floor(i/4/1200),a:a.slice(i,i+3),b:b.slice(i,i+3)});
 const report={count:differences.length,examples:differences.slice(0,12),bounds:differences.length?{minX:Math.min(...differences.map(v=>v.x)),maxX:Math.max(...differences.map(v=>v.x)),minY:Math.min(...differences.map(v=>v.y)),maxY:Math.max(...differences.map(v=>v.y))}:null,surface:state.surfaceDetailRender};
 await writeFile('docs/ballpark-studio/evidence/glow-diagnostic-'+(process.argv[2]??'stadium')+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
