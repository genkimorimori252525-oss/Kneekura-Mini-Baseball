import assert from 'node:assert/strict';
import { appendFileSync, existsSync, fstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getHeapStatistics } from 'node:v8';
import { performance } from 'node:perf_hooks';
import { assertClosedMainFile, digest, fileHash, openSqliteHandles, verifySource, writeNewJson } from './pipeline-common.mjs';
import { assertPhysicalProducerEvidence } from './physical-producer-evidence.mjs';
import { readPhysicalProducerEvidence } from './physical-producer-files.mjs';
import { assertKnownProfileProducerEvidence } from './known-profile-producer-evidence.mjs';
import { readKnownProfileProducerEvidence } from './known-profile-producer-files.mjs';
import { readReplayedRoleEvidence } from './inherited-role-files.mjs';
import { assertRoleReadReplayInput } from './role-read-replay-evidence.mjs';

const [mode, configPath] = process.argv.slice(2);
assert(['--run','--admission-only','--import-check'].includes(mode));
assert(isAbsolute(configPath) && normalize(configPath)===configPath && realpathSync(configPath)===configPath);
const configBytes=readFileSync(configPath), configSha256=digest(configBytes), c=JSON.parse(configBytes.toString('utf8'));
assert.equal(c.schema,'actual_role_read_replay_run_v1'); assert.equal(c.executionScope,'role_read_replay');
const root=c.sourceRoot, wrapper=dirname(fileURLToPath(import.meta.url));
assert(isAbsolute(root) && realpathSync(root)===root);assert.equal(wrapper,join(root,'tools/verification/actual-live-pipeline'));
const controlPaths={launcher:join(wrapper,'run-role-read-replay.py'),runtimeProbe:join(wrapper,'runtime-probe.cjs'),replayRunner:fileURLToPath(import.meta.url)};
const controls=()=>Object.fromEntries(Object.entries(controlPaths).map(([name,path])=>[name,fileHash(path)]));
const compactIdentity=value=>Object.fromEntries(['sourceRoot','sourceCommit','sourceTree','sourceManifestSha256'].map(name=>[name,value[name]]));

if(mode==='--run'){
  assert.equal(Number(process.versions.node.split('.')[0]),26);
  assert.equal(configSha256,process.env.BASEBALL_PIPELINE_CONFIG_SHA256);
  const heapLimitMiB=getHeapStatistics().heap_size_limit/1024/1024;
  const nativeLocks=[[8,'/workspace/shared/baseball-native-aux-check.lock'],[9,'/workspace/shared/baseball-native-check.lock']].map(([fd,path])=>{
    assert.equal(readlinkSync(`/proc/self/fd/${fd}`),path);const actual=fstatSync(fd),named=statSync(path);
    assert.equal(actual.dev,named.dev);assert.equal(actual.ino,named.ino);return {fd,path,device:actual.dev,inode:actual.ino};
  });
  assert.equal(process.env.BASEBALL_PIPELINE_OLD_SPACE_MIB,String(c.runtime.oldSpaceMiB));
  assert.equal(heapLimitMiB,c.runtime.expectedHeapLimitMiB);assert.equal(fileHash(process.execPath),c.runtime.nodeSha256);
  writeNewJson(join(`${c.runDirectory}.runtime`,'executing-process.json'),{at:new Date().toISOString(),pid:process.pid,ppid:process.ppid,
    role:'standalone-role-read-replay',node:process.version,execArgv:process.execArgv,inheritedNodeOptions:process.env.NODE_OPTIONS,
    requestedOldSpaceMiB:c.runtime.oldSpaceMiB,heapLimitMiB,nativeLocks,memory:process.memoryUsage(),nodeSha256:fileHash(process.execPath)});
}

// This entire admission path is SQLite-free and imports no artifact helper.
const admit=()=>{
  assert.equal(fileHash(configPath),configSha256,'replay configuration changed');
  const source=verifySource(c.sourceManifestPath,c.sourceManifestSha256,root,c.sourceCommit);
  const manifestBytes=readFileSync(c.sourceManifestPath);assert.equal(digest(manifestBytes),c.sourceManifestSha256);
  const manifest=JSON.parse(manifestBytes.toString('utf8')), observedControls=controls();assert.deepEqual(observedControls,c.controlHashes);
  let producer;
  if(c.physicalProducer.kind==='first_base_known_profile_producer_v1'){
    producer=readKnownProfileProducerEvidence(c);assertKnownProfileProducerEvidence(producer);
  }else{
    assert.equal(c.physicalProducer.kind,'first_base_clean_producer_v1');
    producer=readPhysicalProducerEvidence(c);assertPhysicalProducerEvidence(producer);
  }
  const producerReference={kind:c.physicalProducer.kind,sourceCommit:producer.terminal.sourceCommit,
    sourceManifestSha256:producer.terminal.sourceManifestSha256,originalInputSha256:producer.terminal.inputSha256,
    terminalSha256:c.physicalEvidenceSha256,outputSha256:c.physicalArtifactSha256,
    negativeEvidenceHashes:producer.terminal.negativeEvidenceHashes,referencedFiles:producer.referencedFiles};
  const roleEvidence=readReplayedRoleEvidence(c,producerReference,manifest);
  assertRoleReadReplayInput({config:c,roleEvidence,currentSourceManifest:manifest,
    observed:{currentSourceFilesUnchanged:true,controlHashes:observedControls}});
  for(const path of [c.physicalArtifactPath,c.physicalProducer.files.originalInput.path,c.inheritedRole.files.artifact.path])assertClosedMainFile(path);
  return {sourceIdentity:compactIdentity(source),producerReference,roleEvidence};
};
const admitted=admit(), inheritedStageReceipts=[{stage:'01-official',...c.inheritedOfficial.files.receipt},{stage:'02-role-workload',...c.inheritedRole.files.receipt}];
const loadHelper=async()=>{
  const module=await import(`${root}/tools/verification/actual-live-pipeline/role-read-replay-helper.ts`);
  assert.equal(typeof module.verifyActualRoleReadReplay,'function');return module.verifyActualRoleReadReplay;
};
if(mode==='--admission-only'){
  console.log(JSON.stringify({kind:'role_read_replay_input_admitted',sourceIdentity:admitted.sourceIdentity,
    originalFileCount:admitted.roleEvidence.referencedFiles.length,artifactHelpersImported:0,artifactHelpersExecuted:0,nativeArtifactsOpened:0}));
}else if(mode==='--import-check'){
  await loadHelper();admit();console.log(JSON.stringify({kind:'role_read_replay_import_passed',sourceIdentity:admitted.sourceIdentity,
    artifactHelpersImported:1,artifactHelpersExecuted:0,nativeArtifactsOpened:0}));
}else{
  const run=c.runDirectory;assert(isAbsolute(run) && normalize(run)===run && !existsSync(run),'fresh replay directory required');mkdirSync(run,{recursive:true});
  const started=performance.now(),counts={officialStarted:0,officialCompleted:0,roleStarted:0,roleCompleted:0,nextStarted:0,nextCompleted:0};
  const progress=(message,details={})=>{
    const event={at:new Date().toISOString(),stage:'role-read-replay',elapsedSeconds:(performance.now()-started)/1000,message,details};
    appendFileSync(join(run,'phases.jsonl'),`${JSON.stringify(event)}\n`);console.log(JSON.stringify(event));
  };
  const auditedPasses=[];
  const audit=()=>{const current=admit();assert.deepEqual(current.sourceIdentity,admitted.sourceIdentity);
    assert.deepEqual(current.producerReference,admitted.producerReference);return current;};
  writeNewJson(join(run,'input.json'),{schema:c.schema,config:c,configSha256,sourceIdentity:admitted.sourceIdentity,
    inheritedSourceIdentity:admitted.roleEvidence.roleReceipt.sourceIdentity,inheritedStageReceipts,
    physicalProducerReference:admitted.producerReference,scope:'read-only compatibility replay; no new domain helper or effects'});
  try{
    const helper=await loadHelper();audit();
    const result=helper({artifactPath:c.inheritedRole.files.artifact.path,artifactSha256:c.inheritedRole.files.artifact.sha256,
      roleReceipt:admitted.roleEvidence.roleReceipt,originalReceipt:admitted.roleEvidence.officialEvidence.officialReceipt,
      expectedSettlementSha256:c.expectedSettlementSha256,progress:message=>{
        progress(message);
        const matched=/^read pass ([12]): transaction and connection closed; original bytes preserved$/.exec(message);
        if(matched){assert.equal(Number(matched[1]),auditedPasses.length+1,'closed replay pass order differs');audit();auditedPasses.push(Number(matched[1]));}
      }});
    assert.deepEqual(auditedPasses,[1,2],'each closed pass must re-audit Source and all original evidence');audit();
    assert(result.passes.length===2);
    for(const pass of result.passes)assert.deepEqual(pass.observation.settlement,admitted.roleEvidence.roleReceipt.settlement,'replay differs from the sealed role DTO');
    const checks={sourceUnchanged:true,configUnchanged:true,controlsUnchanged:true,originalEvidenceUnchanged:true,...result.checks};
    assert.deepEqual(checks,{sourceUnchanged:true,configUnchanged:true,controlsUnchanged:true,originalEvidenceUnchanged:true,
      artifactUnchanged:true,closeReopenEqual:true,readOnlyEnforced:true});
    assert.deepEqual(result.executed,{readOnlyConnections:2,readTransactions:2,settlementReads:2,currentHeadReads:20,
      officialHelperCalls:0,roleHelperCalls:0,nextHelperCalls:0,newOfficialApplications:0,newWorkloadActivities:0,newPhysicalPitchActions:0});
    assert.deepEqual(result.openSqliteHandles,[]);
    const path=join(run,'role-read-replay.receipt.json');
    writeNewJson(path,{schema:'actual_role_read_replay_receipt_v1',status:'passed',sourceIdentity:admitted.sourceIdentity,
      inheritedSourceIdentity:admitted.roleEvidence.roleReceipt.sourceIdentity,roleSourceTransition:c.roleSourceTransition,
      originalRoleBinding:c.inheritedRole,originalOfficialBinding:c.inheritedOfficial,
      originalOfficialReadReplay:admitted.roleEvidence.roleReceipt.inheritedReadReplay,originalRoleReceipt:c.inheritedRole.files.receipt,
      expectedSettlementSha256:c.expectedSettlementSha256,
      physicalProducerReference:admitted.producerReference,originalPhysicalArtifactSha256:c.physicalArtifactSha256,
      inheritedFaultReceipts:inheritedStageReceipts,checks,executed:result.executed,passes:result.passes,
      openSqliteHandles:result.openSqliteHandles,newlyExecutedDomainFaults:[]});
    const sealed={stage:'role-read-replay',path,sha256:fileHash(path)};progress('replay receipt persisted',{receipt:sealed});
    audit();
    writeNewJson(join(run,'terminal.json'),{status:'read_replay_passed',executionScope:'role_read_replay',wholePipelinePassed:false,
      remainingStages:['next'],inheritedStages:['official','role'],sourceIdentity:admitted.sourceIdentity,counts,executed:result.executed,checks,
      phaseReceipts:[sealed],inheritedStageReceipts,openSqliteHandles:[],auditedClosedPasses:auditedPasses});
  }catch(error){
    writeNewJson(join(run,'terminal.json'),{status:'failed',executionScope:'role_read_replay',wholePipelinePassed:false,
      sourceIdentity:admitted.sourceIdentity,counts,inheritedStageReceipts,auditedClosedPasses:auditedPasses,
      openSqliteHandles:openSqliteHandles([c.inheritedRole.files.artifact.path]),error:{name:error?.name,message:String(error?.message??error)}});
    throw error;
  }
}
