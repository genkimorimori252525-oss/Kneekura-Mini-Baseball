import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, lstatSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { it } from 'vitest';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { verifyFoulTerminalNextPlayArtifact } from './FoulTerminalNextPlayArtifact.test-support';
type Pin={path:string;sha256:string};
type Lane='actor_checkpoint'|'pitch_before'|'pitch_after'|'pitch_clean';
const file='src/host/world/FoulTerminalNextPlayLanes.acceptance.ts';
const names={actor_checkpoint:'TN-A01 genuine completed copy rejects both actor boundary faults and closes one authentic actor-only checkpoint',
 pitch_before:'TN-P01 genuine actor checkpoint rejects participant drift before the real pitch INSERT',
 pitch_after:'TN-P02 genuine actor checkpoint rolls back participant drift after the real pitch INSERT',
 pitch_clean:'TN-P03 genuine actor checkpoint admits one physical take with zero-write retry and read-only reopen'};
const same=(a:unknown,b:unknown)=>assert.equal(json(a),json(b));
const bytes=(pin:Pin)=>{assert(isAbsolute(pin.path)&&normalize(pin.path)===pin.path&&realpathSync(pin.path)===pin.path&&lstatSync(pin.path).isFile());
 const data=readFileSync(pin.path);assert.equal(createHash('sha256').update(data).digest('hex'),pin.sha256);return data;};
const pinned=(pin:Pin)=>JSON.parse(bytes(pin).toString('utf8'));
const closed=(pin:Pin)=>{bytes(pin);for(const suffix of ['-wal','-shm','-journal'])assert(!existsSync(pin.path+suffix));};
const qualified=(q:{config:Pin;terminal:Pin;report:Pin;receipt:Pin},expectedFile:string,expectedName:string,skippedNames:readonly string[]=[])=>{
 const config=pinned(q.config),terminal=pinned(q.terminal),report=pinned(q.report),receipt=pinned(q.receipt);
 assert.equal(config.schema,'baseball_fresh_stage_v1');assert.equal(config.released,true);assert.equal(config.expectedExitCode,0);
 assert.equal(terminal.schema,'baseball_fresh_terminal_v1');assert.equal(terminal.status,'passed');assert.equal(terminal.configSha256,q.config.sha256);assert.equal(terminal.stage,config.stage);
 assert.equal(q.terminal.path,join(config.runDirectory,'terminal.json'));assert.equal(q.report.path,join(config.runDirectory,'vitest.json'));
 for(const key of ['failures','cancelSignals','remainingOwnedProcesses'])same(terminal[key],[]);
 same(terminal.before,terminal.after);assert.equal(terminal.originalChildExit,0);assert(terminal.ownedIdentities.length);
 for(const identity of terminal.ownedIdentities){const exits=terminal.groupChildExits.filter((e:{identity:unknown})=>json(e.identity)===json(identity));
  assert.equal(exits.length,1);assert.equal(exits[0].exitCode,0);assert.equal(exits[0].rawWaitStatus,0);}
 for(const group of ['source','dependencies','controls','runtime'])assert.equal(terminal.before[group].sha256,config.inputs[group].sha256);
 assert.equal(terminal.tests.passedCases,1);assert.equal(terminal.tests.expectedFailedCases,0);assert.equal(terminal.tests.credit,1);
 same(terminal.tests.skipped,skippedNames.map(name=>({file:expectedFile,name,status:'skipped',credit:0})));assert.equal(terminal.tests.reportSha256,q.report.sha256);
 assert.equal(report.success,true);assert.equal(report.numTotalTests,1+skippedNames.length);assert.equal(report.numPassedTests,1);assert.equal(report.numFailedTests,0);
 assert.equal(report.numPendingTests,skippedNames.length);assert.equal(report.numTodoTests,0);assert.equal(report.testResults.length,1);
 assert.equal(report.testResults[0].name,join(config.inputs.source.root,expectedFile));assert.equal(report.testResults[0].assertionResults.length,1+skippedNames.length);
 for(const [name,status] of [[expectedName,'passed'],...skippedNames.map(name=>[name,'skipped'])]){
  const found=report.testResults[0].assertionResults.filter((a:{fullName:string})=>a.fullName===name);assert.equal(found.length,1);assert.equal(found[0].status,status);same(found[0].failureMessages,[]);
 }
 return {config,receipt};
};
const input=(lane:Lane)=>{
 assert(process.env.BASEBALL_GATE_RUNTIME&&process.env.BASEBALL_GATE_LOCKS);
 const path=process.env.TERMINAL_POSTPLAY_QUALIFIED_INPUT;assert(path);assert.equal(realpathSync(path),path);
 const manifest=JSON.parse(readFileSync(path,'utf8'));assert.equal(manifest.version,'terminal_next_play_lane_input_v1');assert.equal(manifest.lane,lane);
 const completion=pinned(manifest.completedInput);assert.equal(completion.version,'terminal_completed_next_play_input_v1');
 assert.equal(completion.acceptedNextInputs.sha256,'e6221ff03cad5e47fd1a48e1cbc4aed7fbf3d4795d09f83a0cf6b838012fd128');pinned(completion.acceptedNextInputs);
 assert.equal(completion.qualificationAttribution.candidateManifest.sha256,'8e798309de01e607e5a9bf12c5f85074eeca1bc0588a5c4a3094fad02232bfa1');pinned(completion.qualificationAttribution.candidateManifest);
 const original=qualified(completion.qualification,'src/host/world/ActualFoulTerminalPostPlayCompletion.acceptance.ts',
  'CP-G02 genuine continuing completion updates exactly three mirrors and preserves callback-free retry and reopen').receipt;
 assert.equal(original.version,'terminal_continuing_completion_qualified_candidate_v1');assert.equal(original.path,completion.completedArtifact.path);
 assert.equal(original.sha256,completion.completedArtifact.sha256);assert.equal(original.exactUpdates,3);assert.equal(original.callbackFreeRetry,true);
 assert.equal(original.sourceId,completion.terminalSourceId);closed(completion.completedArtifact);
 let source:Pin=completion.completedArtifact;
 if(lane!=='actor_checkpoint'){
  const actor=qualified(manifest.actorQualification,file,names.actor_checkpoint,[names.pitch_before,names.pitch_after,names.pitch_clean]);
  const receipt=actor.receipt;assert.equal(receipt.version,'terminal_next_actor_checkpoint_v1');assert.equal(receipt.mode,'actor_checkpoint');
  for(const key of ['originalRowsPreserved','noDuplicateWorkload','exactlyOnceActor','reopened','allHandlesClosed','actorWriterInvoked'])assert.equal(receipt[key],true);
  assert.equal(receipt.exactlyOncePitch,false);assert.equal(receipt.pitchSourceId,null);assert.equal(receipt.pitchWriterInvoked,false);
  same(receipt.sourceArtifact,completion.completedArtifact);same(receipt.acceptedInput,completion.acceptedNextInputs);same(receipt.completedInput,manifest.completedInput);
  assert.equal(receipt.terminalSourceId,completion.terminalSourceId);assert.equal(receipt.acceptedActorPlayerId,'away-2');
  same(receipt.faultEvidence,{actorBeforeInsert:true,actorAfterInsert:true,pitchBeforeInsert:false,pitchAfterInsert:false});
  source=manifest.actorArtifact;assert.equal(receipt.destinationPath,source.path);assert.equal(receipt.destinationSha256,source.sha256);closed(source);
 }
 return {manifest,completion,source};
};
const run=(lane:Lane)=>{
 const {manifest,completion,source}=input(lane),directory=mkdtempSync(join(tmpdir(),'terminal-next-lane-'));
 console.info('TERMINAL_NEXT_LANE_PRIVATE_ARTIFACT='+directory);
 const receipt=verifyFoulTerminalNextPlayArtifact({sourcePath:source.path,sourceSha256:source.sha256,destinationPath:join(directory,'lane.sqlite'),
  terminalSourceId:completion.terminalSourceId,acceptedInputPath:completion.acceptedNextInputs.path,acceptedInputSha256:completion.acceptedNextInputs.sha256,
  mode:lane,faultChecks:lane!=='pitch_clean',progress:message=>{appendFileSync(join(directory,'progress.jsonl'),JSON.stringify({at:new Date().toISOString(),message})+'\n');console.info('TERMINAL_NEXT_LANE_PROGRESS='+message);}});
 writeFileSync(join(directory,'lane-receipt.json'),JSON.stringify({...receipt,executionSource:manifest.currentSource,completedInput:manifest.completedInput,
  ...(manifest.actorQualification?{actorQualification:manifest.actorQualification}:{}),sourceQualification:completion.qualificationAttribution},null,2)+'\n',{flag:'wx'});
};
it('TN-A01 genuine completed copy rejects both actor boundary faults and closes one authentic actor-only checkpoint',()=>run('actor_checkpoint'),3_500_000);
it('TN-P01 genuine actor checkpoint rejects participant drift before the real pitch INSERT',()=>run('pitch_before'),3_500_000);
it('TN-P02 genuine actor checkpoint rolls back participant drift after the real pitch INSERT',()=>run('pitch_after'),3_500_000);
it('TN-P03 genuine actor checkpoint admits one physical take with zero-write retry and read-only reopen',()=>run('pitch_clean'),3_500_000);
