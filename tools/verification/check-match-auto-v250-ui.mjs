import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {resolve,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyPinnedLiveCore} from './live-debug-core.mjs';
import {stringifyDebugRecord} from './live-debug-record.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.BASEBALL_PLAYWRIGHT_CORE_PATH??resolve(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'));
const root=process.cwd(),candidate=resolve('work/match-auto-v250-ui-candidate-01'),out=resolve(process.argv[2]??''),rel=relative(root,out);assert(process.argv.length===3&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'new workspace output required');
const sha=b=>createHash('sha256').update(b).digest('hex'),pins={},report={pass:false,scope:'V250_STANDALONE_GUI_AND_MAKER_EMBEDDED_TEST_HARNESS',fixedSeed:'v250-ui-20261031',browserVersion:null,errors:[],requests:[],cases:[]};let browser;
const pathList=[resolve(candidate,'manifest.json'),resolve(candidate,'game.html'),resolve(candidate,'maker.html'),'tools/verification/check-match-auto-v250-ui.mjs','tools/verification/prepare-match-auto-v250.mjs','tools/browser-bridge/live-match-auto-direction-v250.js','tools/verification/live-debug-core.mjs','tools/verification/live-debug-record.mjs','work/match-auto-v250-candidate-01/native/manifest.json'];
for(const path of pathList){const b=await readFile(path);pins[path]={bytes:b.length,sha256:sha(b)}}
const manifest=JSON.parse(await readFile(resolve(candidate,'manifest.json'),'utf8'));assert.equal(pins[resolve(candidate,'game.html')].sha256,manifest.gameSha256);assert.equal(pins[resolve(candidate,'maker.html')].sha256,manifest.makerSha256);
for(const [path,pin] of Object.entries(manifest.pins)){const b=await readFile(path);assert.equal(b.length,pin.bytes);assert.equal(sha(b),pin.sha256);pins[path]=pin}
const native=await verifyPinnedLiveCore({manifestPath:'work/match-auto-v250-candidate-01/native/manifest.json'});assert.equal(native.manifest.entry.sha256,manifest.native.sha256);
await mkdir(out);await writeFile(resolve(out,'protocol-start.json'),JSON.stringify({pins,seed:report.fixedSeed,cases:['standalone-real-gui','maker-match-synthetic-frame','maker-pitcher-synthetic-frame'],sequence:['legacy-first','select-observed-same-game','new-game-observed','select-legacy-same-game','new-game-legacy'],native:native.manifest.entry},null,2)+'\n',{flag:'wx'});
async function exercise(page,frame,label,embedded){
 const c={label,authority:embedded?'TEST_HARNESS_CREATED_VISIBLE_FRAME_NOT_USER_GUI':'STANDALONE_REAL_GUI'};report.cases.push(c);
 const locator=(id)=>frame.locator('#'+id);await frame.waitForFunction(()=>globalThis.liveMatchPlayback?.inspect().host,null,{timeout:90000});
 assert.equal(await locator('match-auto-direction-v250').inputValue(),'legacy');await locator('fixed-seed').check();await locator('match-seed').fill(report.fixedSeed);await locator('new-game').click();
 async function pitch(expectedCount){await locator('next-pitch').click();await frame.waitForFunction(n=>{const s=liveMatchPlayback.inspect();if(s.error)throw Error(s.error);return s.generatedPitches>=n},expectedCount,{timeout:180000});}
 async function proof(expected,resetMain){return await frame.evaluate(({expected,resetMain})=>{
  const last=globalThis.__v250Inits.at(-1);if(!last)throw Error('missing actual worker init');const config=last.configuration,policy=config.batterAutoDirectionPolicyV250; if(expected!=='observed'&&Object.hasOwn(config,'batterAutoDirectionPolicyV250'))throw Error('legacy key present');if(expected==='observed'&&(!policy||policy.version!=='live_match_auto_direction_policy_v250'||policy.sourceId!=='match-auto-direction-v250-ui'||!config.batterObservationV151||!config.batterDirectionMotorV153))throw Error('observed policy differs');
  if(resetMain){globalThis.__v250Main=KneekuraNativeMatchCore.createLiveBaseballMatchWorkerV116(config);globalThis.__v250Compared=0}
  if(!globalThis.__v250Main)throw Error('missing reference Main Host');const history=liveMatchPlayback.inspect().host.history;
  for(let i=globalThis.__v250Compared;i<history.length;i++){
   const actual=history[i],main=__v250Main.issuePitch(actual.command),encoded=__v250Encode(actual);if(__v250Encode(main)!==encoded)throw Error('actual Worker and Main record differs');
   const event=__v250WorkerRecords.find(row=>row.record===actual);if(!event)throw Error('accepted Worker continuation missing');
   if(__v250Encode(__v250Main.captureContinuationV116())!==__v250Encode(event.continuation))throw Error('actual Worker and Main continuation differs');
   globalThis.__v250Compared++;
  }
  if(__v250Compared!==history.length)throw Error('not every accepted record compared');const actual=history.at(-1);return {workerCount:__v250Inits.length,policy:policy??null,compared:__v250Compared,exactRecords:true,exactContinuations:true,contact:!!actual.play.contact,field:!!actual.play.field};
 },{expected,resetMain});}
 async function summary(expected,name){const pending=page.waitForEvent('download',{timeout:30000});await locator('export-game').click();const dl=await pending,filename=resolve(out,label+'-'+name+'.json');await dl.saveAs(filename);const parsed=JSON.parse(await readFile(filename,'utf8'));const actual=parsed.configuration.batterAutoDirectionPolicyV250;if(expected==='legacy')assert.equal(Object.hasOwn(parsed.configuration,'batterAutoDirectionPolicyV250'),false);else assert.deepEqual(actual,{version:'live_match_auto_direction_policy_v250',sourceId:'match-auto-direction-v250-ui'});return {sha256:sha(await readFile(filename)),policy:actual??null}}
 await pitch(1);c.legacy=await proof('legacy',true);c.summaryLegacy=await summary('legacy','legacy');const before=await frame.evaluate(()=>({n:__v250Inits.length,s:liveMatchPlayback.inspect().generatedPitches}));
 await locator('match-auto-direction-v250').selectOption('observed');assert.match(await locator('match-auto-direction-status-v250').textContent(),/次の試合/);assert.deepEqual(await frame.evaluate(()=>({n:__v250Inits.length,s:liveMatchPlayback.inspect().generatedPitches})),before);await pitch(2);c.pendingObserved=await proof('legacy',false);assert.equal(c.pendingObserved.compared,2);
 await locator('new-game').click();assert.match(await locator('match-auto-direction-status-v250').textContent(),/現試合: 観測/);await pitch(1);c.observed=await proof('observed',true);c.summaryObserved=await summary('observed','observed');
 await locator('match-auto-direction-v250').selectOption('legacy');assert.match(await locator('match-auto-direction-status-v250').textContent(),/次の試合/);await pitch(2);c.pendingLegacy=await proof('observed',false);assert.equal(c.pendingLegacy.compared,2);await locator('new-game').click();await pitch(1);c.restored=await proof('legacy',true);c.summaryRestored=await summary('legacy','restored');
 if(!embedded){await page.setViewportSize({width:390,height:900});assert(await locator('match-auto-direction-v250').isVisible());c.mobileBox=await locator('match-auto-direction-v250').boundingBox();assert(c.mobileBox&&c.mobileBox.x>=0&&c.mobileBox.x+c.mobileBox.width<=390);await page.screenshot({path:resolve(out,'standalone-390.png'),fullPage:true});}
 c.pass=true;
}
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});report.browserVersion=browser.version();assert.equal(report.browserVersion,'156.0.8078.76');
 const context=await browser.newContext({viewport:{width:1200,height:900},acceptDownloads:true});await context.addInitScript({content:`globalThis.__v250Inits=[];globalThis.__v250WorkerRecords=[];globalThis.__v250Encode=${stringifyDebugRecord.toString()};const post=Worker.prototype.postMessage,seen=new WeakSet();Worker.prototype.postMessage=function(m,...rest){if(m?.kind==='init'){globalThis.__v250Inits.push({configuration:structuredClone(m.configuration)});if(!seen.has(this)){seen.add(this);this.addEventListener('message',e=>{if(e.data?.kind==='record')globalThis.__v250WorkerRecords.push({record:e.data.record,continuation:e.data.continuation})})}}return post.call(this,m,...rest)};`});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))report.requests.push(r.url())});
 await page.goto(pathToFileURL(resolve(candidate,'game.html')).href,{timeout:120000});await exercise(page,page.mainFrame(),'standalone',false);await page.close();
 const maker=await context.newPage();maker.on('pageerror',e=>report.errors.push(String(e)));maker.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))report.requests.push(r.url())});await maker.goto(pathToFileURL(resolve(candidate,'maker.html')).href,{timeout:120000});await maker.waitForFunction(()=>typeof KneekuraMakerMatchHtmlV70==='string'&&typeof KneekuraMakerPitcherMatchHtmlV77==='string',null,{timeout:90000});
 for(const [key,label] of [['KneekuraMakerMatchHtmlV70','maker-match'],['KneekuraMakerPitcherMatchHtmlV77','maker-pitcher']]){
  await maker.evaluate(key=>{const f=document.createElement('iframe');f.id='v250-test-frame';f.style='position:fixed;inset:0;width:1200px;height:900px;z-index:999999;background:white';f.srcdoc=globalThis[key];document.body.append(f)},key);const frame=await (await maker.locator('#v250-test-frame').elementHandle()).contentFrame();assert(frame,'test frame missing');await exercise(maker,frame,label,true);await maker.locator('#v250-test-frame').evaluate(f=>f.remove());
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);report.pass=true;
}catch(error){report.error=String(error?.stack??error)}finally{
 if(browser)try{await browser.close()}catch(error){report.pass=false;report.closeError=String(error)}
 try{for(const [path,pin] of Object.entries(pins)){const b=await readFile(path);assert.equal(b.length,pin.bytes);assert.equal(sha(b),pin.sha256)}await verifyPinnedLiveCore({manifestPath:'work/match-auto-v250-candidate-01/native/manifest.json'});report.endPins=true}catch(error){report.pass=false;report.endPins=false;report.endError=String(error?.stack??error)}
 await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});if(!report.pass)process.exitCode=1;
}
