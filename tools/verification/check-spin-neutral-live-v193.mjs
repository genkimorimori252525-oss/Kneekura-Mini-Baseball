import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { compilePinnedNativeEntry, fileState } from './native-measurement-probe-support-v183.mjs';
import { buildPinnedLiveCore, verifyPinnedLiveCore } from './live-debug-core.mjs';
import { stringifyDebugRecord, parseDebugRecord, firstDebugDifference } from './live-debug-record.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.BASEBALL_PLAYWRIGHT_CORE_PATH??resolve(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'));
const root=process.cwd(),arg=process.argv[2],out=resolve(arg??''),rel=relative(root,out);
assert(arg&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'new workspace output required');await mkdir(out,{recursive:false});
const save=(name,value)=>writeFile(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'}),report={pass:false,
  scope:'LOCAL_AUTHORING_GOLD_NO_TARGET_ACTUAL_CLOSED_PITCH_NOT_NATIVE_QUALIFICATION',cases:[],errors:[],nativeAdmission:false,privateArtifactNotForPublication:true};
let browser,fixtureBundle,manifestPath;
function runnerV193(){
  globalThis.__runSpinNeutralV193=(text)=>{
    const input=globalThis.__parseSpinNeutralV193(text),core=globalThis.KneekuraNativeMatchCore,
      host=core.createLiveBaseballMatchWorkerV116(input.match),record=host.issuePitch(input.command),
      contact=record.play.contact;
    return globalThis.__exactSpinNeutralV193({record,continuation:host.captureContinuationV116(),
      mastery:input.profile?core.projectLiveSpinMasteryV123(input.profile):null,
      observed:contact?core.observeBattedBallSpinV123({velocityMps:contact.exitVelocity,spinRadPerSecond:contact.exitSpin,bats:'R'}):null});
  };
}
try{
  const harnessPin=await fileState(resolve(root,'tools/verification/check-spin-neutral-live-v193.mjs'));
  fixtureBundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/spin-neutral-live-case-v193.ts',outputPath:resolve(out,'fixture-inputs.mjs')});
  const fixture=await import(pathToFileURL(fixtureBundle.bundlePath).href);
  const manifest=await buildPinnedLiveCore({root,out:resolve(out,'browser-core'),target:'native'});
  manifestPath=resolve(out,'browser-core','manifest.json');const pinned=await verifyPinnedLiveCore({root,manifestPath});
  const code=await readFile(resolve(out,'browser-core',manifest.entry.path),'utf8'),
    runtime=code+'\nglobalThis.__exactSpinNeutralV193='+stringifyDebugRecord.toString()+';globalThis.__parseSpinNeutralV193='+parseDebugRecord.toString()+';('+runnerV193.toString()+')();';
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});report.browserVersion=browser.version();
  const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(String(e)));await page.goto('about:blank');await page.addScriptTag({content:runtime});
  await page.evaluate(code=>{
    const blob=URL.createObjectURL(new Blob([code+'\nonmessage=e=>{try{postMessage({id:e.data.id,value:__runSpinNeutralV193(e.data.text)})}catch(error){postMessage({id:e.data.id,error:String(error.stack??error)})}};'],{type:'text/javascript'})),worker=new Worker(blob);let serial=0;
    const pending=new Map();globalThis.__spinWorkerV193=text=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});worker.postMessage({id,text});});
    worker.onmessage=e=>{const p=pending.get(e.data.id);if(!p)return;pending.delete(e.data.id);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.value);};
    worker.onerror=e=>{for(const p of pending.values())p.reject(Error(e.message));pending.clear();};
    globalThis.__closeSpinWorkerV193=()=>{worker.terminate();URL.revokeObjectURL(blob);};
  },runtime);
  for(const mode of ['LEGACY','INDEPENDENT']){
    const input=fixture.inputs(mode),results={};
    for(const channel of ['MAIN','WORKER']){
      results[channel]={};
      for(const variant of ['normal','gold']){
        const text=stringifyDebugRecord({match:input[variant],command:input.command,...(variant==='gold'?{profile:input.profile}:{})});
        const output=await page.evaluate(({channel,text})=>channel==='MAIN'?__runSpinNeutralV193(text):__spinWorkerV193(text),{channel,text}),value=parseDebugRecord(output);
        assert(value.record.play.contact);assert(value.record.play.outgoingBallMoment);assert.equal(value.record.play.rules.kind,'applied');
        assert.equal(value.record.play.rules.batterAdvanced,true,'the issued pitch must reach official PA closure');
        assert.equal(value.record.events.at(-1).kind,'pitch_adjudicated');results[channel][variant]=value;await save(mode+'-'+channel+'-'+variant+'.json',value);
      }
      const a=results[channel].normal,b=results[channel].gold,d=b.record.play.diagnostics;
      assert.equal(b.mastery.effectiveStateId,'GOLD');assert.equal(b.mastery.nativeAdmission,false);assert.equal(b.mastery.masteredTechniqueSet.length,4);
      assert.equal(d.spinIntentV123.selectedIntent,'NO_SPIN_TARGET');assert.equal(d.spinIntentV123.reason,'NONE_REQUESTED');assert.equal(d.spinIntentV123.nativeAdmission,false);
      assert.equal(firstDebugDifference(d.battedSpinV123,b.observed),null);assert.equal(firstDebugDifference(a.observed,b.observed),null);
      assert.equal(firstDebugDifference(fixture.physicalRecord(a.record),fixture.physicalRecord(b.record)),null);
      assert.equal(firstDebugDifference(a.continuation,b.continuation),null);if(mode==='INDEPENDENT')assert(a.record.play.diagnostics.randomnessV152);
      report.cases.push({mode,channel,classification:a.record.play.classification,frames:a.record.frames.length,
        officialTick:a.record.play.rules.endedAtTick,physicalExact:true,continuationExact:true,
        independentRandomTraceExact:mode==='INDEPENDENT'?true:null,legacyInternalRandomStateObserved:false});
    }
    for(const variant of ['normal','gold'])assert.equal(firstDebugDifference(results.MAIN[variant],results.WORKER[variant]),null,'Main/Worker full record must match');
  }
  await page.evaluate(()=>__closeSpinWorkerV193());await page.close();assert.deepEqual(report.errors,[]);
  await verifyPinnedLiveCore({root,manifestPath});assert.deepEqual(await fileState(resolve(root,'tools/verification/check-spin-neutral-live-v193.mjs')),harnessPin);
  assert.deepEqual(await fileState(fixtureBundle.bundlePath),{exists:true,bytes:fixtureBundle.bytes,sha256:fixtureBundle.sha256});
  for(const [path,pin]of Object.entries(fixtureBundle.sourcePins))assert.deepEqual(await fileState(resolve(root,path)),{exists:true,bytes:pin.bytes,sha256:pin.sha256});
  report.core={sha256:pinned.manifest.entry.sha256,inputCount:Object.keys(pinned.manifest.inputs).length,loadAndEndExact:true};report.fixtureInputs=fixtureBundle.inputCount;report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{if(browser)await browser.close();await save('report.json',report);}
console.log(JSON.stringify({pass:report.pass,browserVersion:report.browserVersion,cases:report.cases.length,core:report.core,error:report.error??null}));
