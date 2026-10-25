import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const {chromium}=createRequire(import.meta.url)('playwright-core');
const file=resolve('../../outputs/球場設計室_v3_局所密度版.html');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(pathToFileURL(file).href,{timeout:90000});
 await page.waitForFunction(()=>{const s=BallparkStudio.inspect();return s.ready&&s.revision===s.renderedRevision;},null,{timeout:90000});
 const s=await page.evaluate(()=>BallparkStudio.inspect());
 assert.equal(s.design.architecture.logo.brightness,.8);
 assert.equal(s.logoRender.brightness,.8);
 assert.equal(Number(await page.locator('#logo-brightness').inputValue()),.8);
 assert.equal(s.architectureRender.scoreboard.enabled,true);
 assert.equal(s.error,null);
 assert.deepEqual(errors,[]);
 const report={pass:true,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),brightness:s.logoRender.brightness,scoreboardEnabled:true,errors};
 await writeFile('docs/ballpark-studio/evidence/accepted-grass08.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}finally{await browser.close();}
