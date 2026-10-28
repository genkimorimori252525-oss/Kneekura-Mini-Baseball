import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { firstDebugDifference, stringifyDebugRecord } from '../verification/live-debug-record.mjs';
const playwrightPath=process.env.BASEBALL_PLAYWRIGHT_CORE_PATH??resolve(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const { chromium } = createRequire(import.meta.url)(playwrightPath);
const root=process.cwd(),[outArg,reportArg,rendererArg]=process.argv.slice(2),out=resolve(outArg??''),rel=relative(root,out),reportPath=resolve(reportArg??'');
assert(outArg&&reportArg&&rendererArg&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'new workspace output, Native report and verified renderer required');
await mkdir(out,{recursive:false});
const sha=v=>createHash('sha256').update(v).digest('hex'),save=(name,v)=>writeFile(resolve(out,name),stringifyDebugRecord(v)+'\n',{flag:'wx'}),
  flags=['--executable-traits','--measured-library','--ball-comparison','--batter-comparison','--bat-orbit','--player-swing-preview','--whole-arc',
    '--equipment-preview','--technical-traits','--ball-display-fix','--pitcher-workbench','--pitch-library','--pitch-views','--course-seasons',
    '--pitch-menu','--lossless-performance','--maker-recovery','--presentation-v84','--maker-guides','--maker-validation','--course-map-v87',
    '--playback-v88','--pitch-arrows-v89','--maker-editor-v90','--pitch-movement-v92','--rules-v94'],
  maker=resolve(out,'maker.html'),nativeReport=JSON.parse(await readFile(reportPath,'utf8')),
  result={pass:false,scope:'MAKER_READ_ONLY_REPORT_AND_SAME_CORE_WORKBENCH_LABEL_CONTROL',productionCalibrationProven:false,
    nativeCareerSimulationProven:false,errors:[],externalRequests:[],privateArtifactNotForPublication:true};
let browser;
try{
  const paths=['tools/browser-bridge/check-maker-contact-descriptor-v191.mjs','tools/browser-bridge/build-maker.mjs',
    'docs/demos/baseball-maker-ui-v94.mjs','src/integration/browser/workbench-index.ts','src/integration/traits/ContactDescriptorReportV191.ts'];
  result.inputPins=Object.fromEntries(await Promise.all(paths.map(async path=>[path,{start:sha(await readFile(path))}])));
  result.nativeReportSha256=sha(await readFile(reportPath));
  const buildText=execFileSync(process.execPath,['tools/browser-bridge/build-maker.mjs',maker,...flags,'--contact-report='+reportPath,'--match-renderer='+resolve(rendererArg)],{encoding:'utf8',maxBuffer:8*1024*1024});
  await writeFile(resolve(out,'build.log'),buildText,{flag:'wx'});
  const bytes=await readFile(maker),html=bytes.toString('utf8'),marker='globalThis.baseballMaker = Object.freeze({';
  assert.equal(html.split(marker).length,2,'one diagnostic hook site required');
  const hooked=html.replace(marker,'globalThis.__contactReportPhysicsV191=()=>structuredClone(physicsResult());globalThis.__contactReportRerunV191=()=>simulate();\n'+marker),
    instrumented=resolve(out,'maker-read-hook.html');
  await writeFile(instrumented,hooked,{flag:'wx'});result.makerSha256=sha(bytes);result.instrumentedSha256=sha(hooked);
  result.readHook='read-only structuredClone of private physics result plus invocation of the existing simulate function; Core unchanged';
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  result.browserVersion=browser.version();
  for(const width of [1200,390]){
    const page=await browser.newPage({viewport:{width,height:1050}});
    page.on('pageerror',e=>result.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))result.externalRequests.push(r.url());});
    await page.goto(pathToFileURL(instrumented).href,{timeout:120000});
    await page.waitForFunction(()=>globalThis.baseballMaker,{},{timeout:90000});
    assert(await page.evaluate(()=>typeof baseballMaker.setContactObservationReportV191==='function'),'Maker report receiver missing');
    await page.waitForFunction(()=>globalThis.__contactReportPhysicsV191()!=null,{},{timeout:90000});
    await page.locator('#tab-player').click();
    const scope=nativeReport.scope;
    assert.deepEqual(await page.evaluate(()=>baseballMaker.getContactObservationReportV191()),nativeReport,'build injection must reach the real receiver');
    // This is a portable-report UI fixture, not a second Native authority claim.
    const collision=await page.evaluate(({nativeReport})=>{
      const player=KneekuraLiveGameRosterCatalog.players[0],scope={careerId:'other-ui-career',playerId:player.playerId},
        report={...nativeReport,scope,source:{...nativeReport.source,careerId:scope.careerId,subjectId:scope.playerId,
          sourceKey:'ui-only-scope-fixture',snapshotId:'ui-only-scope-fixture'}};
      baseballMaker.setContactObservationReportV191(report,scope);return {playerId:player.playerId,name:player.name};
    },{nativeReport});
    const scopeText=await page.locator('[data-contact-report-scope]').innerText();
    assert(scopeText.includes(collision.playerId),'report must show its own subject identity');
    assert(!scopeText.includes(collision.name),'same playerId in another career cannot borrow a Maker name');
    await page.evaluate(({report,scope})=>baseballMaker.setContactObservationReportV191(report,scope),{report:nativeReport,scope});
    const before=await page.evaluate(()=>({physics:__contactReportPhysicsV191(),state:baseballMaker.getState(),sources:baseballMaker.exportSources()}));
    assert.equal(before.physics.authority,'CORE_PHYSICAL_BATTING_WORKBENCH');
    assert(before.physics.contact?.exitSpin&&before.physics.flightFrames.length>0,'actual contact and flight are required');
    const beforeText=await page.locator('#contact-observation-report-v191').innerText();assert(beforeText.includes(nativeReport.displayName));
    const changed=await page.evaluate(({scope})=>{
      const current=baseballMaker.getContactObservationReportV191(),renamed=KneekuraBaseballWorkbench.withContactDescriptorDisplayNameV191(current,'対照表示名');
      baseballMaker.setContactObservationReportV191(renamed,scope);__contactReportRerunV191();
      return {report:baseballMaker.getContactObservationReportV191(),physics:__contactReportPhysicsV191(),state:baseballMaker.getState(),sources:baseballMaker.exportSources()};
    },{scope});
    assert.equal(changed.report.displayName,'対照表示名');assert.equal(firstDebugDifference(changed.report,{...nativeReport,displayName:'対照表示名'}),null);
    assert.equal(firstDebugDifference(changed.physics,before.physics),null,'all actual workbench physical fields must remain exact');
    assert.equal(firstDebugDifference(changed.state,before.state),null);assert.equal(firstDebugDifference(changed.sources,before.sources),null);
    const afterText=await page.locator('#contact-observation-report-v191').innerText();assert(afterText.includes('対照表示名'));
    assert(afterText.includes(nativeReport.model===null?'判定基準が未設定':'校正前'));
    assert(await page.evaluate(({scope})=>{try{baseballMaker.setContactObservationReportV191(baseballMaker.getContactObservationReportV191(),{...scope,careerId:'wrong-career'});return false;}catch{return true;}},{scope}));
    assert.equal((await page.evaluate(()=>baseballMaker.getContactObservationReportV191())).displayName,'対照表示名');
    await page.evaluate(({nativeReport,scope})=>baseballMaker.setContactObservationReportV191({...nativeReport,status:'UNAVAILABLE',
      reasons:['NO_MEASUREMENT_MODEL'],sampleCount:null,episodeCount:null,evidenceSpanDays:null,lineDriveFraction:null,model:null},scope),{nativeReport,scope});
    const unavailableText=await page.locator('#contact-observation-report-v191').innerText();
    assert(unavailableText.includes('判定基準が未設定'));assert(unavailableText.includes('未評価'));assert(!unavailableText.includes('該当なし'));
    await page.evaluate(({nativeReport,scope})=>baseballMaker.setContactObservationReportV191({...nativeReport,status:'UNAVAILABLE',
      source:null,reasons:['NO_REGISTERED_CONTACTS'],sampleCount:null,episodeCount:null,evidenceSpanDays:null,lineDriveFraction:null,model:null},scope),{nativeReport,scope});
    const noRecordsText=await page.locator('#contact-observation-report-v191').innerText();
    assert(noRecordsText.includes('集計済みの接触記録がありません'));assert(!noRecordsText.includes('通算0日目'));
    await page.locator('#clear-contact-observation-report-v191').click();
    assert.equal(await page.evaluate(()=>baseballMaker.getContactObservationReportV191()),null);
    await page.locator('#contact-observation-report-file-v191').setInputFiles(reportPath);
    await page.waitForFunction(()=>globalThis.baseballMaker.getContactObservationReportV191()?.displayName==='ラインドライブ');
    assert.deepEqual(await page.evaluate(()=>baseballMaker.getContactObservationReportV191()),nativeReport);
    const panel=page.locator('#contact-observation-report-v191');await panel.scrollIntoViewIfNeeded();
    await page.screenshot({path:resolve(out,'maker-report-'+width+'.png'),fullPage:false});
    const bounds=await panel.boundingBox();assert(bounds&&bounds.width>0&&bounds.x+bounds.width<=width+2,'report must fit viewport');
    await save('physics-before-'+width+'.json',before.physics);await save('physics-after-'+width+'.json',changed.physics);
    await save('view-'+width+'.json',{beforeText,afterText,scopeText,unavailableText,noRecordsText,bounds,report:changed.report,
      frames:{bat:before.physics.batFrames.length,pitch:before.physics.pitchFrames.length,flight:before.physics.flightFrames.length}});await page.close();
  }
  const manifest=JSON.parse(await readFile(maker+'.bundle-inputs.json','utf8')),build=JSON.parse(await readFile(maker+'.build.json','utf8'));
  for(const [path,pin]of Object.entries(result.inputPins)){pin.end=sha(await readFile(path));assert.equal(pin.end,pin.start);}
  for(const [path,hash]of Object.entries(manifest.inputs))assert.equal(sha(await readFile(path)),hash,'post-build source changed: '+path);
  assert.equal(build.sha256,result.makerSha256);assert.equal(build.coreSha256,manifest.entrySha256);
  assert.equal(build.uiSha256,result.inputPins['docs/demos/baseball-maker-ui-v94.mjs'].start);
  assert.equal(build.contactObservationReportSha256V191,result.nativeReportSha256);assert.equal(sha(await readFile(reportPath)),result.nativeReportSha256);
  result.browserBundle={inputCount:Object.keys(manifest.inputs).length,coreSha256:build.coreSha256,captureMode:manifest.captureMode};
  assert.deepEqual(result.errors,[]);assert.deepEqual(result.externalRequests,[]);result.pass=true;
}catch(error){result.error=String(error.stack??error);process.exitCode=1;}
finally{if(browser)await browser.close();await save('report.json',result);}
console.log(JSON.stringify({pass:result.pass,browserVersion:result.browserVersion,error:result.error??null,errors:result.errors.length}));
