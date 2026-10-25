import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright-core');
const dir=resolve('docs/ballpark-studio/evidence/architecture-preview-'+process.argv[2]);await mkdir(dir,{recursive:true});
const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),p=await b.newPage({viewport:{width:1480,height:1100}}),errors=[];
p.on('pageerror',e=>errors.push(String(e)));
try{
await p.goto(pathToFileURL(resolve('../../outputs/球場設計室_v3_局所密度版.html')).href,{timeout:90000});
const wait=async()=>{await p.waitForFunction(()=>{const s=BallparkStudio.inspect();return s.error||(s.ready&&s.renderedRevision===s.revision);},null,{timeout:90000});await p.evaluate(()=>BallparkStudio.setCrowdPlayback({paused:true}));};
await wait();
for(const camera of ['stadium','exterior','interior','scoreboard','overhead','catcher','mound','batter','fielder']){
await p.selectOption('#camera',camera);await p.waitForTimeout(120);await wait();await p.locator('#preview').screenshot({path:dir+'/'+camera+'.png'});
await writeFile(dir+'/'+camera+'.json',JSON.stringify(await p.evaluate(()=>BallparkStudio.inspect()),null,2));
}
await p.selectOption('#camera','exterior');await p.locator('#roof-opening').evaluate(e=>{e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(150);await wait();await p.locator('#preview').screenshot({path:dir+'/closed-exterior.png'});
console.log(JSON.stringify({errors,dir}));
}finally{await b.close();}
