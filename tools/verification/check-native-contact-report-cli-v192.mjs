import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { stringifyDebugRecord } from './live-debug-record.mjs';
import { compilePinnedNativeEntry, createPinnedNativeCopy, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite');
const root=process.cwd(),arg=process.argv[2],out=resolve(arg??''),rel=relative(root,out);
assert(arg&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'new workspace output required');await mkdir(out,{recursive:false});
const save=(name,value)=>writeFile(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'}),sha=value=>createHash('sha256').update(value).digest('hex'),
  metadata=['world_native_batting_contact_observations_v188','world_native_batting_contact_observation_heads_v188'];
function state(path){
  const db=new DatabaseSync(path,{readOnly:true});
  try{
    db.exec('PRAGMA query_only=1; BEGIN');
    const catalog=db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all(),rows={};
    for(const row of catalog.filter(r=>r.type==='table'&&!r.name.startsWith('sqlite_')&&!metadata.includes(r.name))){
      assert(/^[A-Za-z0-9_]+$/.test(row.name));rows[row.name]=db.prepare('SELECT * FROM main."'+row.name+'" ORDER BY rowid').all();
    }
    const result={physicalHash:sha(stringifyDebugRecord({catalog:catalog.filter(r=>!metadata.includes(r.tbl_name)),rows})),
      physicalTableCount:Object.keys(rows).length,metadataTables:catalog.filter(r=>r.type==='table'&&metadata.includes(r.name)).map(r=>r.name).sort()};
    if(result.metadataTables.length===2)result.receipts=db.prepare('SELECT COUNT(*) AS n FROM main.'+metadata[0]).get().n;
    db.exec('COMMIT');return result;
  }finally{db.close();}
}
const report={pass:false,commands:[],productionCalibrationProven:false,normalAiProven:false,privateArtifactNotForPublication:true};
let bundle,runtimeBundle,copy;
const cacheNames=async()=>{try{return(await readdir(resolve(root,'dist'))).filter(n=>n.startsWith('.native-contact-report-v192-')).sort();}
  catch(error){if(error.code==='ENOENT')return [];throw error;}};
try{
  const paths=['tools/native-contact-report-v192.mjs','tools/native-contact-report-runtime-v192.ts','tools/verification/check-native-contact-report-cli-v192.mjs'];
  report.inputPins=Object.fromEntries(await Promise.all(paths.map(async path=>[path,{start:await fileState(resolve(root,path))}])));
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-two-day-contact-case-v190.ts',outputPath:resolve(out,'fixture-only.mjs')});
  runtimeBundle=await compilePinnedNativeEntry({root,entryPath:'tools/native-contact-report-runtime-v192.ts',outputPath:resolve(out,'normal-runtime-pinned.mjs')});
  const fixtureApi=await import(pathToFileURL(bundle.bundlePath).href),originalPath=resolve(out,'original.sqlite'),fixture=fixtureApi.createCase(originalPath),
    original=await fileState(originalPath);
  copy=await createPinnedNativeCopy({originalPath,outputPath:resolve(out,'commands.sqlite'),expectedMainSha256:original.sha256});
  const before=state(copy.copyPath),base=['--database='+copy.copyPath,'--career='+fixture.scope.careerId,'--player='+fixture.scope.playerId],
    cachesBefore=await cacheNames();
  const call=async(name,args,success=true,expectedFailure)=>{
    const result=spawnSync(process.execPath,['tools/native-contact-report-v192.mjs',...args],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
    await save(name+'-process.json',{args,status:result.status,stdout:result.stdout,stderr:result.stderr,error:result.error?String(result.error):null});
    report.commands.push({name,status:result.status});assert.equal(result.status===0,success,result.stderr);
    if(!success){assert(expectedFailure?.test(result.stderr),'expected domain failure was not observed');return null;}
    const parsed=JSON.parse(result.stdout);assert.equal(parsed.runtime.sha256,runtimeBundle.sha256,'all commands must use the pinned normal runtime');
    assert.equal(parsed.runtime.sourceInputs,runtimeBundle.inputCount);return parsed;
  };
  const emptyPath=resolve(out,'before-collection.json');await call('export-before',['export',...base,'--output='+emptyPath]);
  const empty=JSON.parse(await readFile(emptyPath,'utf8'));assert.equal(empty.status,'UNAVAILABLE');assert.deepEqual(empty.reasons,['NO_REGISTERED_CONTACTS']);assert.equal(empty.source,null);
  assert.deepEqual(state(copy.copyPath).metadataTables,[]);
  await call('unknown-collect',['collect','--database='+copy.copyPath,'--career='+fixture.scope.careerId,'--player=missing-player'],false,/subject is absent or ambiguous/);
  const wrongOut=resolve(out,'must-not-exist.json');
  await call('unknown-export',['export','--database='+copy.copyPath,'--career=missing-career','--player='+fixture.scope.playerId,'--output='+wrongOut],false,/subject is absent or ambiguous/);
  assert.equal((await fileState(wrongOut)).exists,false);assert.deepEqual(state(copy.copyPath).metadataTables,[]);
  await call('missing-calendar',['collect',...base],false,/formal career day\/origin\/edition is unavailable/);
  const failed=state(copy.copyPath);assert.equal(failed.physicalHash,before.physicalHash);assert.equal(failed.metadataTables.length,2);assert.equal(failed.receipts,0);
  const collected=await call('collect',['collect',...base,'--calendar-edition='+fixture.careerCalendarEditionId]);
  assert.equal(collected.collection.registeredReferenceCount,2);assert.equal(collected.collection.source.revision,2);assert.equal(collected.runtime.fixtureImports,false);
  const retried=await call('collect-retry',['collect',...base,'--calendar-edition='+fixture.careerCalendarEditionId]);
  assert.deepEqual(retried.collection,collected.collection);assert.equal(state(copy.copyPath).receipts,2);
  const unknownModelPath=resolve(out,'no-model.json'),mainBefore=await fileState(copy.copyPath);
  const exported=await call('export-no-model',['export',...base,'--output='+unknownModelPath]);
  const noModel=JSON.parse(await readFile(unknownModelPath,'utf8'));
  assert.equal(noModel.status,'UNAVAILABLE');assert.deepEqual(noModel.reasons,['NO_MEASUREMENT_MODEL']);
  assert.equal(noModel.source.revision,2);assert.equal(noModel.sampleCount,null);assert.equal(noModel.model,null);
  assert.deepEqual(await fileState(copy.copyPath),mainBefore);assert.equal(exported.runtime.fixtureImports,false);
  // Explicit caller files exercise configuration, not a shipped calibration or default.
  const model={modelId:'v192-explicit-caller-test-only',version:'1',minimumEpisodes:2,minimumDays:1,windowDays:9,maximumSourceAgeDays:0,
    rule:{familyId:'line_drive',lowerAngleDeg:17,upperAngleDeg:23,minimumFraction:.8}},
    policy={policyId:'v192-caller-only',version:'1',families:[{familyId:'line_drive',modelId:model.modelId,modelVersion:model.version,minimumRecognitionEpisodes:2,minimumRecognitionDays:1}]};
  const modelPath=resolve(out,'explicit-model.json'),policyPath=resolve(out,'explicit-policy.json'),explicitPath=resolve(out,'explicit-report.json');
  await save('explicit-model.json',model);await save('explicit-policy.json',policy);
  await call('export-explicit',['export',...base,'--output='+explicitPath,'--model='+modelPath,'--policy='+policyPath]);
  const explicit=JSON.parse(await readFile(explicitPath,'utf8'));assert.equal(explicit.status,'ABSENT');assert.deepEqual(explicit.model,{modelId:model.modelId,version:model.version});
  assert.equal(explicit.modelCalibration,'UNCONFIRMED');assert.equal(explicit.sampleCount,2);assert.equal(explicit.physicsEffects,'NONE');
  const outputBefore=await fileState(explicitPath);await call('refuse-overwrite',['export',...base,'--output='+explicitPath],false,/Output already exists/);assert.deepEqual(await fileState(explicitPath),outputBefore);
  const after=state(copy.copyPath);assert.equal(after.physicalHash,before.physicalHash);assert.equal(after.receipts,2);
  assert.deepEqual(await cacheNames(),cachesBefore);
  assert.deepEqual((await databaseFiles(originalPath)).main,copy.originalDatabaseBefore.main);
  assert.deepEqual(await fileState(copy.copyPath),mainBefore);
  report.physicalTablesAndCatalogUnchanged=true;report.physicalTableCount=before.physicalTableCount;
  report.originalMainUnchanged=true;report.exportMainUnchanged=true;report.commandRuntime=exported.runtime;report.sidecarsAfter=await databaseFiles(copy.copyPath);report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  try{
    for(const pinned of [bundle,runtimeBundle])if(pinned){assert.deepEqual(await fileState(pinned.bundlePath),{exists:true,bytes:pinned.bytes,sha256:pinned.sha256});
      for(const [path,pin]of Object.entries(pinned.sourcePins))assert.deepEqual(await fileState(resolve(root,path)),{exists:true,bytes:pin.bytes,sha256:pin.sha256});}
    if(bundle)report.fixtureBundleInputs=bundle.inputCount;if(runtimeBundle)report.normalRuntimeBundle={sha256:runtimeBundle.sha256,inputCount:runtimeBundle.inputCount,loadAndEndPins:true};
    for(const [path,pin]of Object.entries(report.inputPins??{})){pin.end=await fileState(resolve(root,path));assert.deepEqual(pin.end,pin.start);}
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  await save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,commands:report.commands.length,physicalTablesAndCatalogUnchanged:report.physicalTablesAndCatalogUnchanged,
  fixtureBundleInputs:report.fixtureBundleInputs,runtimeInputs:report.commandRuntime?.sourceInputs,error:report.error??report.pinError??null}));
