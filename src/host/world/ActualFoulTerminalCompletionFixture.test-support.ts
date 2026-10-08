import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { constants, copyFileSync, lstatSync, mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { rawCensus, schemaCensus, fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { noSettledCheckpointSidecars } from './ActualFoulTerminalSettledCheckpoint.test-support';
import { actualFoulTerminalPostPlaySetupInput } from './ActualFoulTerminalPostPlaySetup';
import { assertFoulTerminalApplicationStorage, foulTerminalCompletionTableSql } from './ActualFoulTerminalApplicationStorage';

type Pin={path:string;sha256:string};
const same=(a:unknown,b:unknown)=>assert.equal(json(a),json(b));
const pinned=(pin:Pin)=>{assert(isAbsolute(pin.path)&&normalize(pin.path)===pin.path&&realpathSync(pin.path)===pin.path&&lstatSync(pin.path).isFile());
 const bytes=readFileSync(pin.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256);return JSON.parse(bytes.toString('utf8'));};
/** A fresh private-copy cutover only. The accepted source is the exact explicit
 * fixture packet produced at the genuine scoring/API RED, never a new choice. */
export const prepareTerminalCompletionCopy=()=>{
 assert(process.env.BASEBALL_GATE_RUNTIME&&process.env.BASEBALL_GATE_LOCKS);
 const inputPath=process.env.TERMINAL_POSTPLAY_COMPLETION_INPUT;assert(inputPath,'qualified scored completion input missing');
 const input=JSON.parse(readFileSync(inputPath,'utf8'));assert.equal(input.version,'terminal_scored_completion_input_v1');
 const config=pinned(input.config),terminal=pinned(input.terminal),report=pinned(input.report),receipt=pinned(input.receipt),packet=pinned(input.setup);
 assert.equal(config.schema,'baseball_fresh_stage_v1');assert.equal(config.released,true);assert.equal(config.expectedExitCode,1);
 assert.equal(terminal.status,'passed');assert.equal(terminal.schema,'baseball_fresh_terminal_v1');
 assert.equal(terminal.configSha256,input.config.sha256);assert.equal(terminal.stage,config.stage);
 assert.equal(input.terminal.path,join(config.runDirectory,'terminal.json'));assert.equal(input.report.path,join(config.runDirectory,'vitest.json'));
 same(terminal.failures,[]);same(terminal.cancelSignals,[]);same(terminal.remainingOwnedProcesses,[]);same(terminal.after,terminal.before);
 assert.equal(terminal.originalChildExit,1);assert(terminal.ownedIdentities.length);
 for(const identity of terminal.ownedIdentities){const exits=terminal.groupChildExits.filter((e:{identity:unknown})=>json(e.identity)===json(identity));
  const expected=json(identity)===json(terminal.originalChildIdentity)?1:0;assert.equal(exits.length,1);assert.equal(exits[0].exitCode,expected);assert.equal(exits[0].rawWaitStatus,expected*256);}
 for(const group of ['source','dependencies','controls','runtime'])assert.equal(terminal.before[group].sha256,config.inputs[group].sha256);
 assert.equal(terminal.tests.expectedFailedCases,1);assert.equal(terminal.tests.passedCases,0);same(terminal.tests.skipped,[]);assert.equal(terminal.tests.reportSha256,input.report.sha256);
 const file='src/host/world/ActualFoulTerminalCompletionPrerequisite.acceptance.ts',name='CP-R01 genuine current-authenticated all-ten settlement and real scoring reach the missing completion API';
 same(config.cases,[{file,name,status:'failed',failureContains:['GENUINE_SETTLED_SCORED_TERMINAL_COMPLETION_API_MISSING']}]);
 assert.equal(report.numTotalTests,1);assert.equal(report.numFailedTests,1);assert.equal(report.numPassedTests,0);assert.equal(report.numPendingTests,0);assert.equal(report.numTodoTests,0);
 assert.equal(report.testResults.length,1);assert.equal(report.testResults[0].name,join(config.inputs.source.root,file));assert.equal(report.testResults[0].assertionResults.length,1);
 const result=report.testResults[0].assertionResults[0];assert.equal(result.fullName,name);assert.equal(result.status,'failed');
 assert(result.failureMessages.join('\n').includes('GENUINE_SETTLED_SCORED_TERMINAL_COMPLETION_API_MISSING'));
 assert.equal(receipt.version,'terminal_scored_settled_prerequisite_v1');assert.equal(receipt.completed,false);assert.equal(receipt.workloadParticipantCount,10);
 assert.equal(receipt.destinationPath,input.artifact.path);assert.equal(receipt.destinationSha256,input.artifact.sha256);
 assert.equal(packet.version,'terminal_post_play_explicit_test_setup_v1');same(packet.source,receipt.setupSource);
 const source=actualFoulTerminalPostPlaySetupInput(packet.source,packet.source.sourceId);
 noSettledCheckpointSidecars(input.artifact.path);assert.equal(fileHash(input.artifact.path),input.artifact.sha256);
 const directory=mkdtempSync(join(tmpdir(),'terminal-post-play-completion-')),path=join(directory,'completion.sqlite');
 console.info('TERMINAL_POST_PLAY_COMPLETION_PRIVATE_ARTIFACT='+directory);
 copyFileSync(input.artifact.path,path,constants.COPYFILE_EXCL);assert.equal(fileHash(path),input.artifact.sha256);
 noSettledCheckpointSidecars(input.artifact.path);assert.equal(fileHash(input.artifact.path),input.artifact.sha256);
 const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')as typeof import('node:sqlite');const db=new DatabaseSync(path);
 try{
  const before=rawCensus(db),schema=schemaCensus(db);assertFoulTerminalApplicationStorage(db,'acknowledgement');
  assert(!db.prepare("SELECT 1 FROM main.sqlite_master WHERE name='__terminal_completion_previous'").get());
  const columns=db.prepare('PRAGMA main.table_info(actual_foul_terminal_applications)').all().map(c=>'"'+String(c.name).replaceAll('"','""')+'"').join(',');
  db.exec('BEGIN IMMEDIATE');try{db.exec('ALTER TABLE main.actual_foul_terminal_applications RENAME TO __terminal_completion_previous');
   db.exec(foulTerminalCompletionTableSql);db.exec('INSERT INTO main.actual_foul_terminal_applications(rowid,'+columns+') SELECT rowid,'+columns+' FROM main.__terminal_completion_previous');
   db.exec('DROP TABLE main.__terminal_completion_previous');db.exec('COMMIT');}catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}
  assertFoulTerminalApplicationStorage(db,'completion');same(rawCensus(db),before);
  const after=schemaCensus(db);same(after.main.filter(r=>r.tbl_name!=='actual_foul_terminal_applications'),schema.main.filter(r=>r.tbl_name!=='actual_foul_terminal_applications'));
  same(after.temp,schema.temp);assert.equal(after.userVersion,schema.userVersion);assert.equal(after.mainVersion,Number(schema.mainVersion)+3);
  return {directory,path,db,source,sourceId:source.terminalReference.sourceId,input,receipt};
 }catch(error){db.close();throw error;}
};
