import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {resolve,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseDebugRecord} from '../verification/live-debug-record.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.BASEBALL_PLAYWRIGHT_CORE_PATH??resolve(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'));
const root=process.cwd(),out=resolve(process.argv[2]??''),rel=relative(root,out);assert(process.argv.length===3&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'new output required');await mkdir(out,{recursive:false});
const sourcePath='docs/demos/baseball-maker-spin-practice-v239.js',sidecarPath='work/maker-contact-frame-v244-hook-browser-03/closed.json',htmlPath='work/maker-contact-frame-v244-candidate-01/maker.html';
const sha=b=>createHash('sha256').update(b).digest('hex'),pins={},report={pass:false,boundary:'DISPLAY_ONLY_SAVED_SIDECAR_PROJECTION_NOT_PHYSICS_OR_AUTHENTICATION',pageErrors:[],requests:[]};let browser;
try{
 for(const p of [sourcePath,sidecarPath,htmlPath,'tools/browser-bridge/check-contact-frame-display-v244.mjs']){const b=await readFile(p);pins[p]={bytes:b.length,sha256:sha(b)}}
 assert.equal(pins[sourcePath].sha256,'255896d148f01a48097ea5e8b8fca0b77e37b45f7321a3634cab88c9fe23fa9f');
 assert.equal(pins[sidecarPath].sha256,'d0a84837c4ad6d52fb95307bb448045093efef2eda74443673b43c38354df4a1');assert.equal(pins[htmlPath].sha256,'a3162fa81279c136c466d83371c79970aa2157171fb51a6110edc30de21f2ef6');
 const data=parseDebugRecord((await readFile(sidecarPath)).toString('utf8')),saved=data.closed;assert.equal(saved.phase,'CLOSED');assert.equal(saved.slots[1].steps[0].trialRecord.play.diagnostics.observedSpinContactFrameV244.reason,'NO_CANDIDATE_MEETS_DECLARED_THRESHOLDS');
 const episode={phase:saved.phase,activeIndex:saved.activeIndex,plan:{motor:{subjectId:saved.plan.motor.subjectId,technique:saved.plan.motor.technique},episodes:saved.plan.episodes,criterion:saved.plan.criterion},slots:saved.slots.map(slot=>({index:slot.index,seed:slot.seed,initial:slot.initial?true:null,ended:slot.ended,steps:slot.steps.map(step=>({kind:step.kind,trialRecord:step.trialRecord?{command:{practiceSwingDecisionV241:step.trialRecord.command.practiceSwingDecisionV241??null},play:{contact:!!step.trialRecord.play.contact,call:step.trialRecord.play.call,diagnostics:{observedSpinContactFrameV244:step.trialRecord.play.diagnostics.observedSpinContactFrameV244??null}}}:null}))})),evaluation:{status:saved.evaluation.status,observations:saved.evaluation.observations.map(o=>({normalDirectionalSpin:o.normalDirectionalSpin,actualDirectionalSpin:o.actualDirectionalSpin,directionalImprovement:o.directionalImprovement}))}};
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});report.browserVersion=browser.version();assert.equal(report.browserVersion,'156.0.8078.76');
 const page=await browser.newPage({viewport:{width:390,height:1050}});page.on('pageerror',e=>report.pageErrors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))report.requests.push(r.url())});
 await page.goto(pathToFileURL(resolve(htmlPath)).href,{timeout:120000});await page.waitForFunction(()=>globalThis.baseballMaker&&document.getElementById('batting-practice-editor'),null,{timeout:90000});await page.locator('#tab-bat').click();
 const source=(await readFile(sourcePath)).toString('utf8');await page.evaluate(({source,episode})=>{document.getElementById('spin-practice-v239')?.remove();globalThis.KneekuraBattingPractice={inspect:()=>({state:{spinPracticeEpisodesV242:episode,pitchCount:2,finished:false},stale:false})};(0,eval)(source);},{source,episode});
 const panel=page.locator('#spin-practice-v239');await panel.waitFor({state:'visible'});const dataView=await panel.evaluate(el=>{const p=el.getBoundingClientRect(),nodes=[el,...el.querySelectorAll('*')].filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0}).map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,id:e.id,left:r.left,right:r.right,width:r.width,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}});return {text:el.innerText,rect:{left:p.left,right:p.right,width:p.width},scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,nodes}});
 assert(dataView.text.includes('基準を満たす候補なし'));assert(dataView.text.includes('未評価'));assert(!dataView.text.includes('NO_CANDIDATE_MEETS_DECLARED_THRESHOLDS'));assert(!dataView.text.includes('null rad/s'));
 assert(dataView.rect.left>=0&&dataView.rect.right<=390&&dataView.scrollWidth<=dataView.clientWidth+1,'panel exceeds viewport');for(const n of dataView.nodes)assert(n.left>=dataView.rect.left-1&&n.right<=dataView.rect.right+1&&n.scrollWidth<=n.clientWidth+1,'panel descendant overflow: '+JSON.stringify(n));
 await panel.screenshot({path:resolve(out,'panel-390.png')});const screenshot=await readFile(resolve(out,'panel-390.png'));report.screenshot={path:resolve(out,'panel-390.png'),bytes:screenshot.length,sha256:sha(screenshot)};report.dom=dataView;assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.requests,[]);report.pass=true;
}catch(error){report.error=String(error?.stack??error);report.pass=false}finally{
 if(browser)try{await browser.close()}catch(error){report.closeError=String(error);report.pass=false}
 try{for(const [p,pin]of Object.entries(pins)){const b=await readFile(p);assert.equal(b.length,pin.bytes);assert.equal(sha(b),pin.sha256)}report.inputPinsUnchanged=true}catch(error){report.inputPinsUnchanged=false;report.endError=String(error);report.pass=false}
 report.inputPins=pins;await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});if(!report.pass)process.exitCode=1;
}
