import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { appendFileSync, constants, copyFileSync, existsSync, lstatSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname,isAbsolute, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { it } from 'vitest';
import { fileHash,rawCensus,schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { privatePitchFaultConservation } from './PrivatePitchFaultConservation.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { foulTerminalNextPlayReadinessFromSqlite } from './FoulTerminalNextPlayReadiness';
import { readPhysicalPlateAppearanceActorFromSqlite,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readPhysicalPitchProgressFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
type Pin={path:string;sha256:string};
const bytes=(pin:Pin)=>{assert(isAbsolute(pin.path)&&normalize(pin.path)===pin.path&&realpathSync(pin.path)===pin.path&&lstatSync(pin.path).isFile());
 const value=readFileSync(pin.path);assert.equal(createHash('sha256').update(value).digest('hex'),pin.sha256);return value;};
const pinned=(pin:Pin)=>JSON.parse(bytes(pin).toString('utf8'));
const same=(a:unknown,b:unknown)=>assert.equal(json(a),json(b));
const noSidecars=(path:string)=>{for(const suffix of ['-wal','-shm','-journal'])assert(!existsSync(path+suffix));};
const proof=(pin:Pin)=>{
 const o=pinned(pin);assert.equal(o.version,'terminal_retained_pitch_fault_observation_v1');assert.equal(o.originalCaseStatus,'failed');assert.equal(o.originalAggregateCredit,0);
 assert.equal(o.qualification,false);assert.equal(o.nativeReadbackPending,true);assert(['pitch_before','pitch_after'].includes(o.boundary));
 const config=pinned(o.config),terminal=pinned(o.terminal),report=pinned(o.report),errors=pinned(o.errors),input=pinned(o.originalInput);
 assert.equal(config.sourceIdentity.head,'db9a124d7e5ee08a5f62d170a0fe4531c903b028');assert.equal(config.sourceIdentity.src,'2318b7e0c1039a3561506afe1c3fbb9c61504fe4');
 assert.equal(o.config.sha256,o.boundary==='pitch_before'?'3ca562c543d511e676f27fce2fa6c7a0fc7ae2c46c246e97015be66a99ce4736':'adfe1db1d4d349883789ed688efb760a22e7308269d7c4878696564f26ddfae4');
 assert.equal(o.terminal.path,join(config.runDirectory,'terminal.json'));assert.equal(o.report.path,join(config.runDirectory,'vitest.json'));assert.equal(o.log.path,join(config.runDirectory,'output.log'));
 assert.equal(config.released,true);assert.equal(config.expectedExitCode,0);assert.equal(input.lane,o.boundary);
 assert.equal(terminal.status,'failed');assert.equal(terminal.configSha256,o.config.sha256);assert.equal(terminal.originalChildExit,1);
 same(terminal.failures,[{phase:'result',error:"ValueError('original child exit differs')"}]);same(terminal.cancelSignals,[]);same(terminal.remainingOwnedProcesses,[]);same(terminal.before,terminal.after);
 same(errors,{unhandled:[],suiteErrors:[]});assert(terminal.ownedIdentities.length);
 for(const identity of terminal.ownedIdentities){const found=terminal.groupChildExits.filter((e:{identity:unknown})=>json(e.identity)===json(identity));assert.equal(found.length,1);
  const original=json(identity)===json(terminal.originalChildIdentity);assert.equal(found[0].exitCode,original?1:0);assert.equal(found[0].rawWaitStatus,original?256:0);}
 assert.equal(report.numTotalTests,4);assert.equal(report.numFailedTests,1);assert.equal(report.numPassedTests,0);assert.equal(report.numPendingTests,3);assert.equal(report.numTodoTests,0);assert.equal(report.success,false);
 assert.equal(report.testResults.length,1);const result=report.testResults[0];assert.equal(result.name,join(config.inputs.source.root,'src/host/world/FoulTerminalNextPlayLanes.acceptance.ts'));
 assert.equal(result.assertionResults.length,4);assert.equal(result.status,'failed');assert(!result.message);
 for(const expected of config.cases){const found=result.assertionResults.filter((a:{fullName:string})=>a.fullName===expected.name);assert.equal(found.length,1);
  assert.equal(found[0].status,expected.status==='passed'?'failed':'skipped');
  if(expected.status==='passed'){assert.equal(expected.name,o.caseName);same(found[0].failureMessages,[o.soleFailure]);}else same(found[0].failureMessages,[]);}
 assert(o.soleFailure.includes(o.output.sha256)&&o.soleFailure.includes(o.actorArtifact.sha256));
 assert(o.soleFailure.includes(`at finish (${o.helper.path}:157:83)`));
 const helper=bytes(o.helper).toString('utf8');assert(helper.includes('const destinationSha256=fileHash(input.destinationPath);if(faultOnly)assert.equal(destinationSha256,input.sourceSha256);'));
 const sourceRows=terminal.before.source.entries as unknown[][];
 for(const p of [o.helper,o.test] as Pin[])assert(sourceRows.some(row=>row[0]===p.path&&row[1]==='file'&&row[2]===p.sha256));
 bytes(o.test);same(o.sourceFiles,sourceRows.filter(row=>row[1]==='file').map(row=>({path:row[0],sha256:row[2]})));for(const p of o.sourceFiles as Pin[])bytes(p);
 const logs=bytes(o.log).toString('utf8'),progress=bytes(o.progress).toString('utf8').trim().split('\n').map(line=>JSON.parse(line));
 assert.equal(logs.split('TERMINAL_NEXT_LANE_PRIVATE_ARTIFACT='+dirname(o.output.path)).length-1,1);
 same(progress.map(row=>row.message),o.expectedProgress);assert.equal(progress.length,6);
 for(const message of o.expectedProgress as string[])assert.equal(logs.split('TERMINAL_NEXT_LANE_PROGRESS='+message).length-1,1);
 const runtime=bytes(o.runtime).toString('utf8').trim().split('\n').map(line=>JSON.parse(line));assert(runtime.length);assert(!('runtime'in terminal));assert.equal(o.originalControllerStoppedBeforeRuntimeCheck,true);assert(runtime.some(row=>row.pid===terminal.originalChildPid));
 const nodeHash=fileHash(config.node);for(const row of runtime){assert.equal(row.node,'v26.10.0');assert.equal(row.nodeSha256,nodeHash);same(row.locks,terminal.locks);assert.equal(row.heapLimitMiB,config.expectedHeapLimitMiB);assert.equal(row.kind,'runtime');}
 const probes=bytes(o.cpuProbes).toString('utf8').trim().split('\n').map(line=>JSON.parse(line));assert(probes.length>0&&probes.length%2===0);
 const allowed=['cat /proc/cpuinfo | grep \"physical id\" | sort |uniq | wc -l','cat /proc/cpuinfo | grep \"core id\" | sort | uniq | wc -l'];
 for(let i=0;i<probes.length;i+=2){const a=probes[i],b=probes[i+1];assert.equal(a.kind,'optional-tinypool-cpu-probe-rejected');assert.equal(b.kind,'tinypool-existing-os-cpus-fallback');assert(allowed.includes(a.command));assert.equal(a.command,b.command);assert.equal(a.pid,b.pid);assert(Number.isInteger(b.cpuCount)&&b.cpuCount>0);
  for(const row of [a,b]){assert.equal(row.version,'1.1.1');assert.equal(row.dependencyHash,'21a972f29f565170207234994faef33fa4366f7ce2375e166f91a15bb2497fa5');assert.equal(row.packageHash,'fab0aa2756e7cf5c2dc020daafa86c2b5fa3cfd2f9087393418b9a7379dc3dda');}}
 bytes(o.resources);bytes(o.launch);assert.equal(config.wallSeconds,3600);assert.equal(config.heapMiB,1024);assert.equal(config.rssMiB,2048);assert(terminal.peakRssKiB<=2048*1024);
 for(const arg of ['--max-old-space-size=1024','--pool=threads','--poolOptions.threads.singleThread','--maxWorkers=1','--minWorkers=1','--no-file-parallelism'])assert.equal(terminal.argv.filter((value:string)=>value===arg).length,1);
 assert((terminal.before.runtime.entries as unknown[][]).some(row=>row[0]===config.node&&row[1]==='file'&&row[2]===nodeHash));
 assert.equal(o.actorCheckpoint.sha256,'b7f5a27606145079239befd0cad756111b8e15d8cc9b9674819f9b576878cd3c');const actor=pinned(o.actorCheckpoint);assert.equal(actor.version,'terminal_next_actor_checkpoint_input_v1');assert.equal(actor.qualified,true);
 same(actor.artifact,o.actorArtifact);same(actor.qualification,input.actorQualification);same(actor.artifact,input.actorArtifact);
 const actorReceipt=pinned(actor.qualification.receipt);assert.equal(actorReceipt.version,'terminal_next_actor_checkpoint_v1');assert.equal(actorReceipt.exactlyOncePitch,false);assert.equal(actorReceipt.pitchSourceId,null);
 const before=bytes(o.actorArtifact),after=bytes(o.output);noSidecars(o.actorArtifact.path);noSidecars(o.output.path);
 same(privatePitchFaultConservation(before,after),o.expectedMetadataCommit);
 return {o,actorReceipt,config};
};
/** New work is only fresh query-only Native authentication of retained outputs.
 * The original real writer-boundary observation is separately pinned/audited;
 * its failed case and controller remain failed with zero aggregate credit. */
it('TN-V01 retained genuine pitch fault observations and exact metadata-only outputs receive fresh Native read-only verification',()=>{
 assert(process.env.BASEBALL_GATE_RUNTIME&&process.env.BASEBALL_GATE_LOCKS);const inputPath=process.env.TERMINAL_POSTPLAY_QUALIFIED_INPUT;assert(inputPath);
 const input=JSON.parse(readFileSync(inputPath,'utf8'));assert.equal(input.version,'terminal_retained_pitch_fault_readback_input_v1');assert.equal(input.independentObservationReviewReleased,true);
 const observations=(input.observations as Pin[]).map(proof);same(observations.map(p=>p.o.boundary),['pitch_before','pitch_after']);
 const directory=mkdtempSync(join(tmpdir(),'terminal-retained-pitch-fault-'));console.info('TERMINAL_RETAINED_PITCH_FAULT_PRIVATE_ARTIFACT='+directory);
 const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')as typeof import('node:sqlite');const witnesses:unknown[]=[];
 for(const {o,actorReceipt} of observations){
  const copy=join(directory,o.boundary+'.sqlite');copyFileSync(o.output.path,copy,constants.COPYFILE_EXCL);assert.equal(fileHash(copy),o.output.sha256);
  const db=new DatabaseSync(copy);
  try{const before=rawCensus(db),schema=schemaCensus(db),changes=db.prepare('SELECT total_changes() AS n').get()!.n;
   appendFileSync(join(directory,'progress.jsonl'),JSON.stringify({at:new Date().toISOString(),boundary:o.boundary,phase:'fresh_native_read_start'})+'\n');
   withSqliteReadTransaction(db,()=>withBattedWorldPhysicalReadTraversal(db,()=>{
    const ready=foulTerminalNextPlayReadinessFromSqlite(db).read(actorReceipt.terminalSourceId);same(ready.reference,actorReceipt.readinessReference);
    const actor=readPhysicalPlateAppearanceActorFromSqlite(db,actorReceipt.actorSourceId);assert(actor);same(actor.origin.foulTerminalReadiness,ready.reference);assert(!('actualLiveReadiness'in actor.origin));
    assert.equal(actor.source.playerId,actorReceipt.acceptedActorPlayerId);assert.equal(actor.match.playId,ready.archive.proposal.playId+1);
    same(readPhysicalPitchProgressFromSqlite(db,ready.archive.proposal.gameId,actor.match.playId),[]);
    same(rawCensus(db),before);same(schemaCensus(db),schema);assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n,changes);
    witnesses.push({boundary:o.boundary,originalExecution:{config:o.config,terminal:o.terminal,report:o.report,log:o.log,runtime:o.runtime,helper:o.helper,caseStatus:'failed',aggregateCredit:0},
     observedOriginalWriterBoundary:'authenticated_from_exact_frozen_execution_and_sole_final_header_comparison_failure',newVerification:'fresh_native_query_only_completion_actor_empty_pitch',
     newWriterExecution:false,correctedWriterRerun:false,metadataCommit:o.expectedMetadataCommit,readinessReference:ready.reference,actorSourceId:actor.source.sourceId,pitchCount:0,
     input:o.output,copy,copySha256:o.output.sha256});
   }));
   same(rawCensus(db),before);same(schemaCensus(db),schema);assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n,changes);
  }finally{db.close();}
  noSidecars(copy);noSidecars(o.output.path);noSidecars(o.actorArtifact.path);assert.equal(fileHash(copy),o.output.sha256);bytes(o.output);bytes(o.actorArtifact);
  appendFileSync(join(directory,'progress.jsonl'),JSON.stringify({at:new Date().toISOString(),boundary:o.boundary,phase:'closed_unchanged'})+'\n');
 }
 writeFileSync(join(directory,'retained-fault-readback-receipt.json'),JSON.stringify({version:'terminal_retained_pitch_fault_readback_v1',currentReadSource:input.currentReadSource,
  inputObservations:input.observations,nativeOpenMode:'normal_private_copy',sqlReadOnlySnapshot:true,newWriterExecution:false,correctedWriterRerun:false,
  originalRunsRemainFailed:true,originalAggregateCredit:0,allHandlesClosed:true,allInputBytesUnchanged:true,twoCompletedPriorChainQualified:false,witnesses},null,2)+'\n',{flag:'wx'});
},1_200_000);
