import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { verifyPinnedLiveCore } from './live-debug-core.mjs';

const dir='docs/verification/realism-debug-20261027/candidate-maker-direction-practice-current-01', htmlPath=dir+'/maker.html';
const nativeManifest='docs/verification/realism-debug-20261027/candidate-maker-direction-practice-native-current-01/manifest.json';
const workbenchManifest='docs/verification/realism-debug-20261027/candidate-maker-direction-practice-workbench-current-01/manifest.json';
const base='docs/verification/realism-debug-20261027/candidate-maker-reactive-v161-01/maker.html';
const inputs=[htmlPath,dir+'/manifest.json',base,'docs/verification/realism-debug-20261027/candidate-maker-reactive-v161-01/manifest.json',
  '../../outputs/にーくら野球メーカー_v133_スイング準備と振り抜き版.html','docs/verification/realism-debug-20261027/candidate-01/manifest.json',
  'docs/demos/baseball-maker-ui-v94.mjs','docs/demos/baseball-maker-pitcher-v92.js','docs/demos/baseball-maker-ball-comparison-v69.js',
  'docs/demos/baseball-maker-batting-practice-v150.js','docs/demos/measured-bat-library-v1.json','tools/browser-bridge/measured-bat-library-v1.js',
  'tools/browser-bridge/maker-match-renderer-v94.js','tools/browser-bridge/maker-pitcher-renderer-v94.js',
  'docs/verification/realism-debug-20261027/maker-contact-descriptor-v191-08/view-1200.json',nativeManifest,workbenchManifest,
  'tools/verification/check-maker-direction-practice-current.mjs','tools/verification/live-debug-core.mjs',
  'tools/verification/prepare-maker-direction.mjs','tools/verification/live-debug-case.mjs','tools/verification/live-debug-record.mjs'];
const sha=b=>createHash('sha256').update(b).digest('hex'), pin=async p=>{const b=await readFile(p);return {bytes:b.length,sha256:sha(b)}};
const report={pass:false,scope:'INTEGRATED_DIRECTION_PRACTICE_REPORT_CANDIDATE_NOT_FINAL_DELIVERY',cases:[],errors:[],requests:[],performancePass:false};
let browser;
try {
  const start=Object.fromEntries(await Promise.all(inputs.map(async p=>[p,await pin(p)]))); report.inputPins=start;
  const [native,wb]=await Promise.all([verifyPinnedLiveCore({manifestPath:nativeManifest}),verifyPinnedLiveCore({manifestPath:workbenchManifest})]);
  const candidate=JSON.parse(await readFile(dir+'/manifest.json','utf8'));
  const expected={
    [htmlPath]:'36cc176a94e15f61f677a9aa62288bce8da87561b036c1a90f7f8b5b15a41ea1',
    [base]:'f10fc2a3a3f4f947591f6673539787b3082a1cde15736dbc9a6fe3458cf2d434',
    'docs/demos/baseball-maker-ui-v94.mjs':'6a6d815a9dac933236abc321d683f50428029505edf44a6ab14895f514656c45',
    'docs/demos/baseball-maker-pitcher-v92.js':'b5aa65e27321efbbc2c95c236d9bf38c426ad5bbff71a0eedccf832537fd7801',
    'docs/demos/baseball-maker-ball-comparison-v69.js':'832ee7718b20dc62b3e22d01754ef4e2102290da27ffdc507a0b2ac4f6cf164d',
    'docs/demos/baseball-maker-batting-practice-v150.js':'f5f634e9403ba156434f8cf4d72e0a61b21919ad738693debd9df7ce83bb0115'};
  for(const [path,hash] of Object.entries(expected))assert.equal(start[path].sha256,hash,path+' freeze differs');
  assert.equal(native.manifest.entry.sha256,'ff706285c0d48f2d2a7de8c7d86bd62bea521ce1b1da85a44f9e8997db18b7ce');
  assert.equal(wb.manifest.entry.sha256,'2b954cb4d974957954331ba8c4378c593cf45a09ace32ca0c0147b7dd7675dc2');
  assert.equal(start[htmlPath].sha256,candidate.htmlSha256);assert.equal(start[base].sha256,candidate.baseSha256);
  assert.equal(candidate.nativeCoreSha256,native.manifest.entry.sha256);assert.equal(candidate.workbenchCoreSha256,wb.manifest.entry.sha256);
  assert.equal(candidate.makerUiSha256,start['docs/demos/baseball-maker-ui-v94.mjs'].sha256);
  assert.equal(candidate.pitcherUiSha256,start['docs/demos/baseball-maker-pitcher-v92.js'].sha256);
  assert.equal(candidate.comparisonUiSha256,start['docs/demos/baseball-maker-ball-comparison-v69.js'].sha256);
  assert.equal(candidate.practiceUiSha256,start['docs/demos/baseball-maker-batting-practice-v150.js'].sha256);
  const rendererScripts=html=>{
    const result=[];for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){
      if(!match[1].includes('var KneekuraNativeMatchCore ='))continue;
      const source=ts.createSourceFile('maker.js',match[1],ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
      const walk=n=>{if((ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))&&n.text.includes('var KneekuraNativeMatchCore =')&&n.text.includes('<!doctype html')){
        const scripts=[...n.text.matchAll(/<script id="(v(?:70-maker-match|77-maker-pitcher)-renderer)">([\s\S]*?)<\/script>/g)];
        for(const s of scripts)result.push({id:s[1],sha256:sha(s[2])});}ts.forEachChild(n,walk)};walk(source);
    }return result.sort((a,b)=>a.id.localeCompare(b.id));
  };
  const [baseHtml,html]=await Promise.all([readFile(base,'utf8'),readFile(htmlPath,'utf8')]);
  const embeddedNative=[];
  for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){
    if(!match[1].includes('var KneekuraNativeMatchCore ='))continue;
    const source=ts.createSourceFile('maker-embedded.js',match[1],ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    const walk=n=>{if((ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))&&n.text.includes('var KneekuraNativeMatchCore =')&&n.text.includes('<!doctype html')){
      const scripts=[...n.text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].filter(m=>m[1].includes('var KneekuraNativeMatchCore =')&&m[1].includes('__toCommonJS'));
      assert.equal(scripts.length,1);assert.equal(scripts[0][1],native.code.replace(/\n?$/,'\n'));embeddedNative.push(sha(native.code));
    }ts.forEachChild(n,walk)};walk(source);
  }
  assert.equal(embeddedNative.length,2);
  const embeddedWb=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].filter(m=>m[1].includes('var KneekuraBaseballWorkbench =')&&m[1].includes('__toCommonJS'));
  assert.equal(embeddedWb.length,1);assert.equal(embeddedWb[0][1],wb.code+'\n');
  report.embeddedCoreEquality={nativeCount:embeddedNative.length,nativeSha256:native.manifest.entry.sha256,workbenchCount:embeddedWb.length,workbenchSha256:wb.manifest.entry.sha256};
  const renderers=rendererScripts(baseHtml);assert.equal(renderers.length,2);assert.deepEqual(rendererScripts(html),renderers);report.rendererScripts=renderers;
  const nativeReport=JSON.parse(await readFile(inputs[14],'utf8')).report; assert.equal(nativeReport.physicsEffects,'NONE');
  const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});report.browserVersion=browser.version();
  for(const width of [1200,390]){
    const page=await browser.newPage({viewport:{width,height:1050}});let workers=0;page.on('worker',()=>workers++);page.on('pageerror',e=>report.errors.push(String(e)));
    page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))report.requests.push(r.url())});
    try{
      await page.goto(pathToFileURL(resolve(htmlPath)).href,{timeout:120000});
      await page.waitForFunction(()=>globalThis.baseballMaker&&globalThis.KneekuraBallComparison&&globalThis.KneekuraBattingPractice,null,{timeout:90000});
      await page.locator('#tab-player').click();await page.locator('#live-roster-player').selectOption('1-b0');
      assert.equal(await page.evaluate(()=>baseballMaker.getContactObservationReportV191()),null);
      const empty=await page.locator('#contact-observation-report-v191').innerText();assert(empty.includes('未評価')&&empty.includes('未読込'));
      const beforeReport=await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster()));
      await page.locator('#contact-observation-report-file-v191').setInputFiles({name:'reference.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(nativeReport))});
      await page.waitForFunction(()=>baseballMaker.getContactObservationReportV191()!==null);
      const loaded=await page.evaluate(()=>baseballMaker.getContactObservationReportV191());assert.deepEqual(loaded,nativeReport);
      assert((await page.locator('#contact-observation-report-v191').innerText()).includes('参考判定'));assert.equal(loaded.physicsEffects,'NONE');
      assert.equal(await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster())),beforeReport);
      await page.evaluate(()=>{const roster=baseballMaker.getLiveRoster(),id=document.getElementById('live-roster-player').value;
        roster.entries.find(e=>e.playerId===id).physical.batterApproachV122={version:'batter_approach_v122',sourceId:'SYNTHETIC_UI_DIRECTION_POLICY_NOT_MEASUREMENTS',priorReliance:0,directionCommitment:1,twoStrikeCommitmentDelta:0,preferredWhenCommitted:{pull:0,center:0,opposite:1},targetPullAnglesDegrees:{pull:25,center:0,opposite:-25}};
        baseballMaker.commitLiveRosterEditV86(roster)});
      const roster=await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster()));
      const qualityHelp=await page.locator('#pitcher-quality-v177').getAttribute('data-help');
      assert(qualityHelp.includes('選択は保存されます')&&qualityHelp.includes('3段階としては未採用'));
      await page.locator('#tab-bat').click();
      if(width===390){
        for(const mode of ['AUTO','PULL','CENTER','OPPOSITE']){await page.locator('#comparison-direction').selectOption(mode);assert.equal(await page.locator('#comparison-direction').inputValue(),mode)}
        await page.locator('#comparison-pitcher').selectOption('0-p0');await page.locator('#practice-batting').selectOption('take');
        await page.evaluate(()=>KneekuraBattingPractice.start());const state=await page.evaluate(()=>KneekuraBattingPractice.inspect());
        assert(state.ready&&state.workerActive);assert.equal(state.state.pitchCount,0);assert(workers>0);
        assert.equal(await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster())),roster);
        const bounds=await page.locator('#batting-practice-editor').evaluate(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,client:e.clientWidth,scroll:e.scrollWidth}));
        assert(bounds.left>=-1&&bounds.right<=width+1&&bounds.scroll<=bounds.client+1);
        report.cases.push({width,fourSelectionsReachable:true,practiceStart:true,workerCreated:workers,rosterUnchanged:true,initialUnassessed:true,referenceReport:true,
          physicsEffects:loaded.physicsEffects,qualityHelp:true,bounds,limit:'VIEWPORT_REACHABILITY_AND_INITIAL_STATE_ONLY_FULL_RECORD_PROOF_AT_1200'});continue;
      }
      const run=async mode=>{await page.locator('#comparison-direction').selectOption(mode);return page.evaluate(async()=>{await KneekuraBallComparison.run();
        const r=KneekuraBallComparison.getResult(),i=KneekuraBallComparison.getInput(),t=r.cases[0].pitch.diagnostics.battingDirectionV149;
        return {mode:i.battingDirectionRequestV149.mode,trace:t,all:r.cases.every(x=>JSON.stringify(x.pitch.diagnostics.battingDirectionV149)===JSON.stringify(t))}})};
      for(const mode of ['AUTO','PULL','CENTER','OPPOSITE']){const result=await run(mode);assert.equal(result.mode,mode);assert(result.all);
        if(mode==='AUTO'){assert.equal(result.trace.owner,'PERSONAL_APPROACH');assert.equal(result.trace.direction.aim,'OPPOSITE')}
        else {assert.equal(result.trace.owner,'TEMPORARY_REQUEST');assert.equal(result.trace.direction.aim,mode)}
        assert.equal(await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster())),roster)}
      await run('PULL');const restored=await run('AUTO');assert.equal(restored.trace.owner,'PERSONAL_APPROACH');assert.equal(restored.trace.direction.aim,'OPPOSITE');
      await page.locator('#comparison-pitcher').selectOption('0-p0');await page.locator('#practice-batting').selectOption('take');
      await page.evaluate(()=>KneekuraBattingPractice.start());
      const init=await page.evaluate(async code=>{const saved=KneekuraBattingPracticeCodecV150.parse(await KneekuraBattingPractice.exportText());
        globalThis.__normalApi=new Function(code+';return KneekuraNativeMatchCore;')();globalThis.__normalHost=__normalApi.createLiveBaseballMatchWorkerV116(saved.capture.configuration);
        return {initial:KneekuraBattingPractice.inspect(),clips:saved.capture.configuration.measuredClips.length,frames:saved.capture.configuration.measuredClips.reduce((n,c)=>n+c.frames.length,0)}},native.code);
      assert.equal(init.clips,673);assert.equal(init.frames,92201);assert(init.initial.workerActive);assert(workers>0);assert.equal(init.initial.state.pitchCount,0);
      const next=async()=>page.evaluate(async()=>{const a=await KneekuraBattingPractice.next(),b=__normalHost.issuePitch(a.record.command),c=KneekuraBattingPracticeCodecV150;
        return {exact:c.stringify(a.record)===c.stringify(b),state:a.state,record:a.record}});
      await page.locator('#comparison-direction').selectOption('AUTO');const first=await next();assert(first.exact);assert.equal(first.record.command.batting,'take');
      const beforePreview=await page.evaluate(()=>KneekuraBattingPracticeCodecV150.stringify(KneekuraBattingPractice.inspect().state));await run('AUTO');
      assert.equal(await page.evaluate(()=>KneekuraBattingPracticeCodecV150.stringify(KneekuraBattingPractice.inspect().state)),beforePreview);
      const saved=await page.evaluate(()=>KneekuraBattingPractice.exportText());const second=await next();assert(second.exact);
      assert.deepEqual(second.record.beforeMatch,first.record.match);assert.equal(second.state.pitchCount,2);
      assert.equal(first.record.play.diagnostics.batterObservedMemoryUpdateV151.totalAfter,1);
      assert.equal(second.record.play.diagnostics.batterObservationV151.preparedRecall.eligibleObservationCount,1);
      await page.locator('#practice-file').setInputFiles({name:'practice.json',mimeType:'application/json',buffer:Buffer.from(saved)});
      await page.waitForFunction(()=>KneekuraBattingPractice.inspect().context?.fromSavedPractice&&!KneekuraBattingPractice.inspect().busy);
      await page.evaluate(text=>{const s=KneekuraBattingPracticeCodecV150.parse(text);__normalHost=__normalApi.createLiveBaseballMatchWorkerV116(s.capture.configuration,s.capture.continuation)},saved);
      const replay=await next();assert(replay.exact);assert.deepEqual(replay,second);
      assert.equal(await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster())),roster);
      const bounds=await page.locator('#batting-practice-editor').evaluate(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,client:e.clientWidth,scroll:e.scrollWidth}));
      assert(bounds.left>=-1&&bounds.right<=width+1&&bounds.scroll<=bounds.client+1);
      report.cases.push({width,fourModes:true,manualAutoPolicy:true,rosterUnchanged:true,initialUnassessed:true,referenceReport:true,physicsEffects:loaded.physicsEffects,
        clips:init.clips,frames:init.frames,workerActive:true,workerCreated:workers,qualityHelp:true,takeHostExact:true,previewUnconsumed:true,continuationHostExact:true,resumeNextExact:true,bounds});
    }finally{await page.close()}
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);
  for(const path of inputs)assert.deepEqual(await pin(path),start[path],path+' changed');
  await verifyPinnedLiveCore({manifestPath:nativeManifest});await verifyPinnedLiveCore({manifestPath:workbenchManifest});
  report.endPinsEqual=true;report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1}
finally{if(browser)await browser.close();await writeFile(resolve(dir,'integration-qa-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'})}
console.log(JSON.stringify({pass:report.pass,cases:report.cases.length,error:report.error??null}));
