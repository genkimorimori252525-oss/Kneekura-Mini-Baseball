import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const home=dirname(fileURLToPath(import.meta.url)),file=resolve(home,'dist/球場設計室_v3_局所密度版.html'),out=resolve(home,'validation');
await mkdir(out,{recursive:true});
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report={pass:false,productSha256:createHash('sha256').update(await readFile(file)).digest('hex'),views:[],errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1480,height:1100}});page.on('pageerror',e=>report.errors.push(String(e.message)));
 const ready=async()=>{await page.waitForFunction(()=>{const s=BallparkStudio.inspect();return s.error||(s.ready&&s.revision===s.renderedRevision);},null,{timeout:90000});const s=await page.evaluate(()=>BallparkStudio.inspect());assert(!s.error,s.error);return s;};
 await page.goto(pathToFileURL(file).href,{timeout:90000});let s=await ready();await page.evaluate(()=>BallparkStudio.setCrowdPlayback({paused:true}));
 assert.equal(s.design.architecture.logo.brightness,.8);assert.equal(s.logoRender.brightness,.8);assert.equal(Number(await page.locator('#logo-brightness').inputValue()),.8);assert(s.architectureRender.scoreboard.enabled);
 for(const view of ['stadium','exterior','interior','scoreboard','overhead','catcher','mound','batter','fielder']){await page.selectOption('#camera',view);s=await ready();assert.equal(s.view.camera,view);report.views.push(view);}
 await page.selectOption('#camera','scoreboard');await ready();await page.locator('#preview').screenshot({path:resolve(out,'published-scoreboard.png')});
 assert.deepEqual(report.errors,[]);report.pass=true;report.grassLogoBrightness=.8;report.browser='Desktop Chrome, fresh context';
}finally{await browser.close();await writeFile(resolve(out,'browser-report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
