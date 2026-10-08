import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { appendFileSync, constants, copyFileSync, existsSync, lstatSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { it } from 'vitest';
import { fileHash, rawCensus, schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { actorJson as json, readPhysicalPlateAppearanceActorFromSqlite } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readPhysicalPitchProgressFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { foulTerminalPostPlayCompletionEvidenceFromSqlite } from './ActualFoulTerminalPostPlayCompletionEvidenceFromSqlite';
import { foulTerminalNextPlayReadinessFromSqlite } from './FoulTerminalNextPlayReadiness';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
type Pin={path:string;sha256:string};
const same=(a:unknown,b:unknown)=>assert.equal(json(a),json(b));
const pinned=(pin:Pin)=>{assert(isAbsolute(pin.path)&&normalize(pin.path)===pin.path&&realpathSync(pin.path)===pin.path&&lstatSync(pin.path).isFile());
  const bytes=readFileSync(pin.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256);return JSON.parse(bytes.toString('utf8'));};
const closed=(path:string)=>{for(const suffix of ['-wal','-shm','-journal'])assert(!existsSync(path+suffix),'closed input sidecar exists');};
/** This only reauthenticates the exact already-executed actor/pitch artifact.
 * No producer or mutation-capable gameplay owner opener runs. A normal Native
 * private-copy connection is guarded by the query-only proof snapshot. */
it('TN-R01 reviewed current owners reauthenticate the existing genuine terminal next actor and pitch without rerunning execution',()=>{
  assert(process.env.BASEBALL_GATE_RUNTIME&&process.env.BASEBALL_GATE_LOCKS);
  const path=process.env.TERMINAL_POSTPLAY_QUALIFIED_INPUT;assert(path);
  const input=JSON.parse(readFileSync(path,'utf8'));assert.equal(input.version,'terminal_next_play_readback_input_v1');
  assert.equal(input.executionReviewReleased,true,'selected-case review is not released');
  const review=pinned(input.executionReview),receipt=pinned(review.receipt);
  assert.equal(review.result,'sole_observed_clean_execution_qualified');assert.equal(review.checksResult,'passed');assert.equal(review.released,true);assert.equal(review.releasedSelectedPositiveCredit,1);
  assert.equal(review.caseObservations.passedCases,1);assert.equal(review.caseObservations.expectedFailedCases,0);
  assert.equal(review.originalControllerStatus,'failed');assert.equal(review.originalControllerAggregateCredit,0);
  assert.equal(review.nativeOperationRerun,false);assert.equal(review.sourceCommit,'3867234b4bcb88fbf4baa06d7c4865bb758216e1');
  assert.equal(review.sourceSrc,'bdbcdb1f4f1842f338539341f6f8def290a5aae2');
  const originalTerminal=pinned(review.originalTerminal),originalReport=pinned(review.originalReport);
  assert.equal(originalTerminal.status,'failed');assert.equal(originalTerminal.originalChildExit,0);
  assert.equal(originalReport.numTotalTests,2);assert.equal(originalReport.numPassedTests,1);assert.equal(originalReport.numFailedTests,0);
  assert.equal(originalReport.numPendingTests,1);assert.equal(originalReport.numTodoTests,0);assert.equal(originalReport.testResults.length,1);
  assert.equal(originalReport.testResults[0].assertionResults.length,2);
  assert.equal(originalReport.testResults[0].assertionResults[0].fullName,'TN-G01 genuine completed terminal admits the explicitly accepted next batter and one real pitch with no duplicate workload');
  assert.equal(originalReport.testResults[0].assertionResults[0].status,'passed');
  assert.equal(originalReport.testResults[0].assertionResults[1].fullName,'TN-F01 genuine terminal readiness is rechecked on the actor and pitch writer connections before and after their real INSERTs');
  assert.equal(originalReport.testResults[0].assertionResults[1].status,'skipped');
  assert.equal(receipt.destinationPath,review.artifact.path);assert.equal(receipt.destinationSha256,review.artifact.sha256);
  assert.equal(review.artifact.sha256,'08ee7c21afe627a4fdc523aaf7d80fed7fc25e27b4b1a6afb40dd94c71a9092e');
  closed(review.artifact.path);assert.equal(fileHash(review.artifact.path),review.artifact.sha256);
  const directory=mkdtempSync(join(tmpdir(),'terminal-next-readback-')),copy=join(directory,'next-play.sqlite');
  const progress=(message:string)=>appendFileSync(join(directory,'progress.jsonl'),JSON.stringify({at:new Date().toISOString(),message})+'\n');
  copyFileSync(review.artifact.path,copy,constants.COPYFILE_EXCL);assert.equal(fileHash(copy),review.artifact.sha256);
  const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')as typeof import('node:sqlite');
  // A normal Native open of this exclusive private copy lets SQLite retire its
  // own empty WAL/SHM at close. The proof remains inside query-only snapshots.
  const db=new DatabaseSync(copy);let witness:unknown;
  try {
    const before=rawCensus(db),schema=schemaCensus(db),changes=db.prepare('SELECT total_changes() AS n').get()!.n;
    progress('authenticating immutable completion and current readiness');
    withSqliteReadTransaction(db,()=>withBattedWorldPhysicalReadTraversal(db,()=>{
      const archive=foulTerminalPostPlayCompletionEvidenceFromSqlite(db).read(receipt.terminalSourceId);assert(archive);
      const ready=foulTerminalNextPlayReadinessFromSqlite(db).read(receipt.terminalSourceId);same(ready.archive,archive);same(ready.reference,receipt.readinessReference);
      progress('completion/current readiness authenticated; reading original next actor');
      const actor=readPhysicalPlateAppearanceActorFromSqlite(db,receipt.actorSourceId);assert(actor);
      assert.equal(actor.source.playerId,receipt.acceptedActorPlayerId);same(actor.origin.foulTerminalReadiness,ready.reference);assert(!('actualLiveReadiness'in actor.origin));
      assert.equal(actor.match.playId,archive.proposal.playId+1);same(actor.world,archive.result.completion.nextWorld);
      progress('original next actor authenticated; replaying stored next pitch');
      const pitches=readPhysicalPitchProgressFromSqlite(db,archive.proposal.gameId,actor.match.playId);assert.equal(pitches.length,1);
      const pitch=pitches[0];assert.equal(pitch.source.sourceId,receipt.pitchSourceId);same(pitch.frame.batterActor,actor);same(pitch.source.request.batter,receipt.acceptedTake);
      assert(pitch.result.pitch.resolution.timeline.events.length>pitch.beforeTimeline.events.length);
      same(rawCensus(db),before);same(schemaCensus(db),schema);assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n,changes);
      witness={terminalSourceId:archive.source.sourceId,completionId:archive.result.completion.completionId,snapshotHash:archive.result.completion.snapshotHash,
        actorSourceId:actor.source.sourceId,pitchSourceId:pitch.source.sourceId,readinessReference:ready.reference,storedPitchCount:pitches.length};
    }));
    same(rawCensus(db),before);same(schemaCensus(db),schema);assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n,changes);
  }finally{db.close();}
  progress('all read-only handles closed');closed(copy);closed(review.artifact.path);
  assert.equal(fileHash(copy),review.artifact.sha256);assert.equal(fileHash(review.artifact.path),review.artifact.sha256);
  const record={version:'terminal_next_play_current_readback_v1',inputArtifact:review.artifact,inputExecutionReview:input.executionReview,
    originalExecutionSource:{commit:review.sourceCommit,src:review.sourceSrc},currentReadSource:input.currentReadSource,
    sourceAttributionSeparate:true,originalControllerStatus:'failed',originalControllerAggregateCredit:0,
    nativeReadOnly:false,nativeOpenMode:'normal_private_copy',sqlReadOnlySnapshot:true,nativeExecutionRerun:false,noWrites:true,allHandlesClosed:true,originalInputUnchanged:true,
    faultGateQualified:false,twoCompletedPriorChainQualified:false,witness};
  writeFileSync(join(directory,'current-readback-receipt.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  console.info('TERMINAL_NEXT_READBACK_PRIVATE_ARTIFACT='+directory);
},1_200_000);
