import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { resolve,relative,isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyPinnedLiveCore } from '../verification/live-debug-core.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.BASEBALL_PLAYWRIGHT_CORE_PATH??resolve(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'));
const out=resolve(process.argv[2]??''),rel=relative(process.cwd(),out);assert(process.argv.length===3&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'new output required');await mkdir(out,{recursive:false});
const old='work/maker-observed-spin-v237-candidate-02',candidate='work/maker-observed-spin-v237-candidate-03',oldUi='work/v237-spin-controls-layout-baseline-01/worktree.js',ui='docs/demos/baseball-maker-ball-comparison-v69.js',
 proof='work/v237-spin-controls-layout-baseline-01/reverse-proof.json',userPath='C:/Users/genki/Downloads/にーくら選手とバット (2).json';
const sha=b=>createHash('sha256').update(b).digest('hex'),pins={},pin=async p=>{const b=await readFile(p);pins[resolve(p)]={bytes:b.length,sha256:sha(b)};return b},
 save=(n,v)=>writeFile(resolve(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const report={pass:false,boundary:'V237_READABILITY_ONLY_NO_PRACTICE_OR_COMPARISON_REPLAY',priorComparisonPassNotExpanded:true,practicePitchReplayed:0,comparisonRuns:0,errors:[],requests:[],cases:[]};let browser,endAudit;
try{
 const [oldHtml,newHtml,oldManifestBytes,newManifestBytes,oldUiBytes,uiBytes,proofBytes,userBytes]=await Promise.all([pin(old+'/maker.html'),pin(candidate+'/maker.html'),pin(old+'/manifest.json'),pin(candidate+'/manifest.json'),pin(oldUi),pin(ui),pin(proof),pin(userPath)]);
 const m2=JSON.parse(oldManifestBytes),m3=JSON.parse(newManifestBytes),proofData=JSON.parse(proofBytes),user=JSON.parse(userBytes);
 assert.equal(sha(oldHtml),'4832269e62e79964a29ae42992e6edd08656be4f792b8d09f784687b0f5bc8b1');assert.equal(sha(newHtml),m3.htmlSha256);
 assert.equal(sha(oldUiBytes),'9873830f82ff59da1421f648d223b775ea992d7dda8067a6dda09b9bfa053916');assert.equal(sha(uiBytes),'eed18aab9924dd71bffaafb1f9e25c3faca2cace7a58e7b1d063582622741fe5');
 assert.equal(sha(proofBytes),'7c976e9482f16aa77a515f4ef6243c2dfdc4285131e521cf62383c87f7d926e4');assert(proofData.literalReverseExact);
 const added=Buffer.from(' style="grid-template-columns:minmax(0,1fr)"'),loc=newHtml.indexOf(added);assert(loc>=0&&newHtml.indexOf(added,loc+1)<0);
 assert(Buffer.concat([newHtml.subarray(0,loc),newHtml.subarray(loc+added.length)]).equals(oldHtml),'candidate differs beyond one local style insertion');
 assert(uiBytes.includes(added));const upos=uiBytes.indexOf(added);assert(Buffer.concat([uiBytes.subarray(0,upos),uiBytes.subarray(upos+added.length)]).equals(oldUiBytes));
 assert.deepEqual(m2.native,m3.native);assert.deepEqual(m2.workbench,m3.workbench);assert.equal(userBytes.length,59857);assert.equal(sha(userBytes),'e0123a572d66bf6bd5fa92af6c9ffbe6fe47fbcf27d00135c9441bf95927b3ce');
 assert.equal(user.livePhysicalRoster.entries.find(x=>x.playerId==='1-b0')?.physical?.clipId,'obp-23_5');
 const priorReceipt='docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_adaae87828714795836550e3c4336a40.json',r=JSON.parse(await pin(priorReceipt)),log=await pin(r.output_path);
 assert.equal(r.task_id,'MB-20261027-REALISM-DEBUG-PLAN');assert.equal(r.result,'PASS');assert.equal(sha(log),r.output_sha256);report.priorReceipt=priorReceipt;
 const native=await verifyPinnedLiveCore({manifestPath:resolve(candidate,'native/manifest.json')}),wb=await verifyPinnedLiveCore({manifestPath:resolve(candidate,'workbench/manifest.json')});
 assert.equal(native.manifest.entry.sha256,m2.native.sha256);assert.equal(wb.manifest.entry.sha256,m2.workbench.sha256);
 for(const [p,v]of Object.entries(m3.inputPins)){const b=await pin(p);assert.equal(b.length,v.bytes);assert.equal(sha(b),v.sha256)}
 await pin('tools/browser-bridge/check-maker-observed-spin-v237-readable.mjs');
 endAudit=async()=>{for(const [p,v]of Object.entries(pins)){const b=await readFile(p);assert.equal(b.length,v.bytes);assert.equal(sha(b),v.sha256)}
  await verifyPinnedLiveCore({manifestPath:resolve(candidate,'native/manifest.json')});await verifyPinnedLiveCore({manifestPath:resolve(candidate,'workbench/manifest.json')})};
 await save('start.json',{pins,oldRunRole:'CONTEXT_ONLY_NO_CASE_REEXECUTION',styleOnly:true,native:m3.native,workbench:m3.workbench});
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});report.browserVersion=browser.version();assert.equal(report.browserVersion,'156.0.8078.49','unreviewed Chrome version');
 const page=await browser.newPage({viewport:{width:1200,height:1050}});page.on('pageerror',e=>report.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))report.requests.push(r.url())});
 await page.goto(pathToFileURL(resolve(candidate,'maker.html')).href,{timeout:120000});await page.waitForFunction(()=>globalThis.baseballMaker&&globalThis.KneekuraBallComparison,null,{timeout:90000});
 await page.evaluate(packet=>baseballMaker.importState(packet),user);const imported=await page.evaluate(()=>{const roster=baseballMaker.getLiveRoster(),validated=baseballMaker.validateLiveRoster(roster),b=KneekuraBaseballWorkbench.applyLivePhysicalRosterV1({players:KneekuraLiveGameRosterCatalog.players,roster}).players.find(p=>p.playerId==='1-b0');
  return {roster,validated,bats:b.bats,clip:b.physical.clipId,depth:KneekuraBaseballWorkbench.resolveLiveBattingSetupV94({...KneekuraBaseballWorkbench.resolveLiveMatchPlayerPhysicalV98(b),heightMeters:b.heightMeters,bats:b.bats}).contactPlaneZ}});
 assert.deepEqual(imported.roster,imported.validated);assert.equal(imported.bats,'L');assert.equal(imported.clip,'obp-23_5');assert(Number.isFinite(imported.depth));
 await page.locator('#tab-player').click();await page.locator('#live-roster-player').selectOption('1-b0');await page.locator('#tab-bat').click();
 await page.locator('#comparison-spin-trial summary').click();assert(await page.locator('#comparison-spin-trial').evaluate(e=>e.open));
 await page.locator('#comparison-spin-technique').selectOption('TOPSPIN');await page.locator('#comparison-spin-x').fill('0');await page.locator('#comparison-spin-y').fill('-0.01');await page.locator('#comparison-spin-depth').fill(String(imported.depth));
 for(const width of [1200,390]){
  if(width===390)await page.setViewportSize({width,height:1050});const panel=page.locator('#comparison-spin-trial');await panel.scrollIntoViewIfNeeded();assert(await panel.evaluate(e=>e.open));
  const box=await panel.boundingBox(),controls=await panel.locator('label').evaluateAll(labels=>labels.map(label=>{const control=label.querySelector('input,select'),r=control?.getBoundingClientRect(),lr=label.getBoundingClientRect(),node=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
   const range=document.createRange();if(node)range.selectNodeContents(node);const tr=node?range.getBoundingClientRect():null;return{id:control?.id,value:control?.value,left:r?.left,right:r?.right,width:r?.width,labelWidth:lr.width,labelText:node?.textContent.trim(),textWidth:tr?.width,writingMode:getComputedStyle(label).writingMode}}));
  assert(box&&box.x>=-2&&box.x+box.width<=width+2);assert.equal(controls.length,4);
  for(const c of controls){assert(c.width>=240&&c.left>=-2&&c.right<=width+2,'control too narrow or outside viewport: '+c.id);assert(c.labelWidth>=240&&c.writingMode==='horizontal-tb'&&c.textWidth>=Math.min(48,c.labelText.length*8),'label compressed: '+c.id)}
  assert.deepEqual(controls.map(c=>c.id),['comparison-spin-technique','comparison-spin-x','comparison-spin-y','comparison-spin-depth']);
  await page.screenshot({path:resolve(out,'maker-'+width+'.png')});report.cases.push({width,box,controls,open:true});
 }
 assert.deepEqual(await page.evaluate(()=>baseballMaker.getLiveRoster()),imported.roster);assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);report.normalImport=true;report.styleOnlyCandidate=true;report.pass=true;
}catch(e){report.error=String(e.stack??e);report.pass=false;process.exitCode=1}
finally{if(browser)try{await browser.close()}catch(e){report.cleanupError=String(e.stack??e);report.pass=false;process.exitCode=1}
 if(endAudit)try{await endAudit();report.endPins=true}catch(e){report.pinError=String(e.stack??e);report.pass=false;process.exitCode=1}await save('report.json',report)}
console.log(JSON.stringify({pass:report.pass,error:report.error??report.pinError??null}));
