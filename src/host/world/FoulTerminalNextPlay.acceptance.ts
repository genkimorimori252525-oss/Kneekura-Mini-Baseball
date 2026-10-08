import assert from 'node:assert/strict';
import { appendFileSync, lstatSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { it } from 'vitest';
import { fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { verifyFoulTerminalNextPlayArtifact } from './FoulTerminalNextPlayArtifact.test-support';
type Pin={path:string;sha256:string};
const pinned=(pin:Pin) => {
  assert(isAbsolute(pin.path)&&normalize(pin.path)===pin.path&&realpathSync(pin.path)===pin.path&&lstatSync(pin.path).isFile());
  assert.equal(fileHash(pin.path),pin.sha256);return JSON.parse(readFileSync(pin.path,'utf8'));
};
const input=() => {
  assert(process.env.BASEBALL_GATE_RUNTIME&&process.env.BASEBALL_GATE_LOCKS,'Native next-play qualification requires private capped/reaped controls');
  const path=process.env.TERMINAL_POSTPLAY_QUALIFIED_INPUT;assert(path,'completed terminal qualification input is missing');
  const manifest=JSON.parse(readFileSync(path,'utf8'));
  assert.equal(manifest.version,'terminal_completed_next_play_input_v1');
  assert.equal(manifest.acceptedNextInputs.sha256,'e6221ff03cad5e47fd1a48e1cbc4aed7fbf3d4795d09f83a0cf6b838012fd128');
  pinned(manifest.acceptedNextInputs);
  const q=manifest.qualification,config=pinned(q.config),terminal=pinned(q.terminal),report=pinned(q.report),receipt=pinned(q.receipt);
  assert.equal(terminal.schema,'baseball_fresh_terminal_v1');assert.equal(terminal.status,'passed');
  assert.equal(terminal.configSha256,q.config.sha256);assert.equal(terminal.stage,config.stage);assert.equal(config.expectedExitCode,0);
  assert.equal(q.terminal.path,join(config.runDirectory,'terminal.json'));assert.equal(q.report.path,join(config.runDirectory,'vitest.json'));
  for(const key of ['failures','cancelSignals','remainingOwnedProcesses'])assert.equal(json(terminal[key]),'[]');
  assert.equal(json(terminal.before),json(terminal.after));assert.equal(terminal.originalChildExit,0);assert(terminal.ownedIdentities.length);
  for(const identity of terminal.ownedIdentities){const exits=terminal.groupChildExits.filter((e:{identity:unknown})=>json(e.identity)===json(identity));
    assert.equal(exits.length,1);assert.equal(exits[0].exitCode,0);assert.equal(exits[0].rawWaitStatus,0);}
  assert.equal(report.success,true);assert(report.numPassedTests>0);assert.equal(report.numFailedTests,0);assert.equal(report.numPendingTests,0);assert.equal(report.numTodoTests,0);
  assert.equal(terminal.tests.reportSha256,q.report.sha256);assert.equal(terminal.tests.expectedFailedCases,0);assert.equal(json(terminal.tests.skipped),'[]');
  assert.equal(receipt.version,'terminal_continuing_completion_qualified_candidate_v1');
  assert.equal(receipt.path,manifest.completedArtifact.path);assert.equal(receipt.sha256,manifest.completedArtifact.sha256);
  assert.equal(receipt.exactUpdates,3);assert.equal(receipt.callbackFreeRetry,true);assert.equal(receipt.sourceId,manifest.terminalSourceId);
  assert.equal(fileHash(manifest.completedArtifact.path),manifest.completedArtifact.sha256);
  return manifest;
};
const run=(faultChecks:boolean) => {
  const manifest=input(),directory=mkdtempSync(join(tmpdir(),'terminal-next-play-'));
  console.info('TERMINAL_NEXT_PLAY_PRIVATE_ARTIFACT='+directory);
  const receipt=verifyFoulTerminalNextPlayArtifact({sourcePath:manifest.completedArtifact.path,sourceSha256:manifest.completedArtifact.sha256,
    destinationPath:join(directory,'next-play.sqlite'),terminalSourceId:manifest.terminalSourceId,
    acceptedInputPath:manifest.acceptedNextInputs.path,acceptedInputSha256:manifest.acceptedNextInputs.sha256,faultChecks,
    progress:message=>{appendFileSync(join(directory,'progress.jsonl'),JSON.stringify({at:new Date().toISOString(),message})+'\n');console.info('TERMINAL_NEXT_PLAY_PROGRESS='+message);}});
  writeFileSync(join(directory,'next-play-receipt.json'),JSON.stringify({...receipt,sourceQualification:manifest.qualificationAttribution},null,2)+'\n',{flag:'wx'});
};
it('TN-G01 genuine completed terminal admits the explicitly accepted next batter and one real pitch with no duplicate workload',()=>run(false),3_000_000);
it('TN-F01 genuine terminal readiness is rechecked on the actor and pitch writer connections before and after their real INSERTs',()=>run(true),3_000_000);
