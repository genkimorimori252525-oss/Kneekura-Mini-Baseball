import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { constants,copyFileSync,lstatSync,mkdtempSync,readFileSync,realpathSync } from 'node:fs';
import { isAbsolute,join,normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { noSettledCheckpointSidecars } from './ActualFoulTerminalSettledCheckpoint.test-support';
type Pin={path:string;sha256:string};
const pinned=(pin:Pin)=>{assert(isAbsolute(pin.path)&&normalize(pin.path)===pin.path&&realpathSync(pin.path)===pin.path&&lstatSync(pin.path).isFile());
 const bytes=readFileSync(pin.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256);return JSON.parse(bytes.toString('utf8'));};
/** Closed genuine three-update completion only. No producer, repair, migration,
 * scoring, workload charge or next actor/pitch operation is performed here. */
export const prepareTerminalCompletedCopy=()=>{
 assert(process.env.BASEBALL_GATE_RUNTIME&&process.env.BASEBALL_GATE_LOCKS);
 const inputPath=process.env.TERMINAL_POSTPLAY_COMPLETED_INPUT;assert(inputPath);
 const input=pinned({path:inputPath,sha256:'8e798309de01e607e5a9bf12c5f85074eeca1bc0588a5c4a3094fad02232bfa1'});
 assert.equal(input.version,'terminal_completed_fixture_candidate_v1');
 const config=pinned(input.config),terminal=pinned(input.terminal),report=pinned(input.report),receipt=pinned(input.receipt);
 assert.equal(config.schema,'baseball_fresh_stage_v1');assert.equal(config.released,true);assert.equal(config.expectedExitCode,0);
 assert.equal(terminal.schema,'baseball_fresh_terminal_v1');assert.equal(terminal.status,'passed');assert.equal(terminal.configSha256,input.config.sha256);assert.equal(terminal.stage,config.stage);
 assert.equal(input.terminal.path,join(config.runDirectory,'terminal.json'));assert.equal(input.report.path,join(config.runDirectory,'vitest.json'));
 for(const key of ['failures','cancelSignals','remainingOwnedProcesses'])assert.equal(json(terminal[key]),'[]');
 assert.equal(json(terminal.before),json(terminal.after));assert.equal(terminal.originalChildExit,0);assert(terminal.ownedIdentities.length);
 for(const identity of terminal.ownedIdentities){const exits=terminal.groupChildExits.filter((e:{identity:unknown})=>json(e.identity)===json(identity));
  assert.equal(exits.length,1);assert.equal(exits[0].exitCode,0);assert.equal(exits[0].rawWaitStatus,0);}
 for(const group of ['source','dependencies','controls','runtime'])assert.equal(terminal.before[group].sha256,config.inputs[group].sha256);
 const file='src/host/world/ActualFoulTerminalPostPlayCompletion.acceptance.ts',name='CP-G02 genuine continuing completion updates exactly three mirrors and preserves callback-free retry and reopen';
 assert.equal(json(config.cases),json([{file,name,status:'passed'}]));assert.equal(terminal.tests.passedCases,1);assert.equal(terminal.tests.expectedFailedCases,0);
 assert.equal(json(terminal.tests.skipped),'[]');assert.equal(terminal.tests.reportSha256,input.report.sha256);
 assert.equal(report.success,true);assert.equal(report.numTotalTests,1);assert.equal(report.numPassedTests,1);assert.equal(report.numFailedTests,0);assert.equal(report.numPendingTests,0);assert.equal(report.numTodoTests,0);
 assert.equal(report.testResults.length,1);assert.equal(report.testResults[0].name,join(config.inputs.source.root,file));assert.equal(report.testResults[0].assertionResults.length,1);
 const result=report.testResults[0].assertionResults[0];assert.equal(result.fullName,name);assert.equal(result.status,'passed');assert.equal(json(result.failureMessages),'[]');
 assert.equal(receipt.version,'terminal_continuing_completion_qualified_candidate_v1');assert.equal(receipt.path,input.artifact.path);assert.equal(receipt.sha256,input.artifact.sha256);
 assert.equal(receipt.exactUpdates,3);assert.equal(receipt.callbackFreeRetry,true);assert.equal(receipt.sourceId,'terminal-application');
 noSettledCheckpointSidecars(input.artifact.path);assert.equal(fileHash(input.artifact.path),input.artifact.sha256);
 const directory=mkdtempSync(join(tmpdir(),'terminal-completed-reader-')),path=join(directory,'completed.sqlite');
 copyFileSync(input.artifact.path,path,constants.COPYFILE_EXCL);assert.equal(fileHash(path),input.artifact.sha256);
 noSettledCheckpointSidecars(input.artifact.path);assert.equal(fileHash(input.artifact.path),input.artifact.sha256);
 console.info('TERMINAL_COMPLETED_READER_PRIVATE_ARTIFACT='+directory);
 const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')as typeof import('node:sqlite');
 return {directory,path,db:new DatabaseSync(path),sourceId:receipt.sourceId as string,input,receipt};
};
