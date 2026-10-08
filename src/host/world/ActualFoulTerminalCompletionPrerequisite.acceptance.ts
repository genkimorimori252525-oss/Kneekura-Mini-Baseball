import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { constants, copyFileSync, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';
import { expect, it } from 'vitest';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { rawCensus, schemaCensus, fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { prepareRetainedTerminalSettledCopy, noSettledCheckpointSidecars } from './ActualFoulTerminalSettledCheckpoint.test-support';
import { assertTerminalScoringStorage } from './ActualFoulTerminalScoringEvidenceFromSqlite';
import { openSqliteActualFoulTerminalScoringStore } from './SqliteActualFoulTerminalScoringStore';
import { openSqliteActualFoulTerminalApplicationRunner } from './SqliteActualFoulTerminalApplicationRunner';
import { foulTerminalWorkloadEvidenceFromSqlite } from './ActualFoulTerminalRoleWorkloadEvidenceFromSqlite';
import { foulTerminalAcknowledgementAncestryFromSqlite, foulTerminalPendingInput } from './ActualFoulTerminalApplicationEvidenceFromSqlite';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldGeometry } from './BattedWorldFieldRoot';
import { actualFoulTerminalPostPlaySetupInput } from './ActualFoulTerminalPostPlaySetup';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

type Pin = { path:string; sha256:string };
const same = (a: unknown,b: unknown) => assert.equal(json(a),json(b));
const pinned = (pin:Pin) => {
  assert(isAbsolute(pin.path) && normalize(pin.path) === pin.path && realpathSync(pin.path) === pin.path && lstatSync(pin.path).isFile());
  const bytes=readFileSync(pin.path); assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256);
  return JSON.parse(bytes.toString('utf8'));
};
const currentReadQualification = () => {
  const path=process.env.TERMINAL_POSTPLAY_QUALIFIED_INPUT; assert(path,'current settled qualification manifest missing');
  const manifest=JSON.parse(readFileSync(path,'utf8'));
  assert.equal(manifest.version,'terminal_settled_current_read_qualified_v1');
  assert.equal(manifest.candidate.path,process.env.TERMINAL_POSTPLAY_SETTLED_INPUT);
  assert.equal(manifest.candidate.sha256,'4e662ef1981dd9ad2861aa3045b5607b9ec4276ce979ebb16ed47c1110056aae');
  pinned(manifest.candidate);
  const config=pinned(manifest.config),terminal=pinned(manifest.terminal),report=pinned(manifest.report),receipt=pinned(manifest.receipt);
  assert.equal(config.schema,'baseball_fresh_stage_v1'); assert.equal(config.released,true); assert.equal(config.expectedExitCode,0);
  assert.equal(terminal.status,'passed'); assert.equal(terminal.schema,'baseball_fresh_terminal_v1');
  assert.equal(terminal.configSha256,manifest.config.sha256); assert.equal(terminal.stage,config.stage);
  assert.equal(manifest.terminal.path,join(config.runDirectory,'terminal.json')); assert.equal(manifest.report.path,join(config.runDirectory,'vitest.json'));
  same(terminal.failures,[]);same(terminal.cancelSignals,[]);same(terminal.remainingOwnedProcesses,[]);same(terminal.after,terminal.before);
  assert.equal(terminal.originalChildExit,0);
  for(const group of ['source','dependencies','controls','runtime'])assert.equal(terminal.before[group].sha256,config.inputs[group].sha256);
  assert(terminal.ownedIdentities.length);
  for(const identity of terminal.ownedIdentities){const exits=terminal.groupChildExits.filter((e:{identity:unknown})=>json(e.identity)===json(identity));
    assert.equal(exits.length,1);assert.equal(exits[0].exitCode,0);assert.equal(exits[0].rawWaitStatus,0);}
  assert.equal(terminal.tests.passedCases,1);assert.equal(terminal.tests.expectedFailedCases,0);same(terminal.tests.skipped,[]);
  assert.equal(terminal.tests.reportSha256,manifest.report.sha256);
  const test={file:'src/host/world/ActualFoulTerminalSettledCheckpoint.acceptance.ts',
    name:'CP-G01 current original owners authenticate closed old W02 effects with zero-write freeze retry and reopen',status:'passed'};
  same(config.cases,[test]);assert.equal(report.success,true);assert.equal(report.numTotalTests,1);assert.equal(report.numPassedTests,1);
  assert.equal(report.numFailedTests,0);assert.equal(report.numPendingTests,0);assert.equal(report.numTodoTests,0);
  assert.equal(report.testResults.length,1);assert.equal(report.testResults[0].name,join(config.inputs.source.root,test.file));
  assert.equal(report.testResults[0].assertionResults.length,1);const result=report.testResults[0].assertionResults[0];
  assert.equal(result.fullName,test.name);assert.equal(result.status,'passed');same(result.failureMessages,[]);
  assert.equal(config.artifactEnvironment.TERMINAL_POSTPLAY_SETTLED_INPUT,manifest.candidate.path);
  assert(terminal.before.controls.entries.some((e:unknown)=>json(e)===json([manifest.candidate.path,'file',manifest.candidate.sha256])));
  assert.equal(receipt.version,'terminal_settled_current_read_qualification_v1');assert.equal(receipt.sourceProductionCommit,'4ab120f8aa0c8f99e5127339115b4c155c911a7c');
  assert.equal(receipt.destinationPath,manifest.artifact.path);assert.equal(receipt.destinationSha256,manifest.artifact.sha256);
  noSettledCheckpointSidecars(manifest.artifact.path);assert.equal(fileHash(manifest.artifact.path),manifest.artifact.sha256);
  return {manifest,receipt};
};
it('CP-R01 genuine current-authenticated all-ten settlement and real scoring reach the missing completion API', () => {
  const qualified=currentReadQualification(),f=prepareRetainedTerminalSettledCopy();
  let db:typeof f.db|undefined=f.db, scorer:ReturnType<typeof openSqliteActualFoulTerminalScoringStore>|undefined;
  let runner:ReturnType<typeof openSqliteActualFoulTerminalApplicationRunner>|undefined;
  try {
    expect(hash(rawCensus(db))).toBe(qualified.receipt.rowsHash);expect(hash(schemaCensus(db))).toBe(qualified.receipt.schemaHash);
    db.close();db=undefined;
    const path=join(f.directory,'scored-settled-workload.sqlite');
    copyFileSync(qualified.manifest.artifact.path,path,constants.COPYFILE_EXCL);
    expect(fileHash(path)).toBe(qualified.manifest.artifact.sha256);
    noSettledCheckpointSidecars(qualified.manifest.artifact.path);expect(fileHash(qualified.manifest.artifact.path)).toBe(qualified.manifest.artifact.sha256);
    const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');db=new DatabaseSync(path);
    // This genuine retained checkpoint already contains the canonical scoring
    // table. Its production validator is read-only; no schema setup is needed.
    const original=rawCensus(db),afterLayout=schemaCensus(db);assertTerminalScoringStorage(db);
    expect(db.prepare('SELECT * FROM main.official_scoring_applications').all()).toEqual([]);
    expect(rawCensus(db)).toEqual(original);expect(schemaCensus(db)).toEqual(afterLayout);
    const before=rawCensus(db);let writer:typeof db|undefined;
    const witness=witnessSqliteWrite(/INSERT INTO (?:main\.)?official_scoring_applications\b/,connection=>{writer=connection;return connection.isTransaction;});
    let scoring;
    try {scorer=openSqliteActualFoulTerminalScoringStore(path);scoring=scorer.apply(f.sourceId);expect(witness.wasReached()).toBe(true);}
    finally{witness.close();}
    expect(writer!.prepare('SELECT total_changes() AS n').get()!.n).toBe(1);
    expect(scoring.record).toMatchObject({classification:'strikeout',hitsCredited:0,errorsCharged:0});
    const ancestry=withSqliteReadTransaction(db,()=>foulTerminalAcknowledgementAncestryFromSqlite(db!).read(f.sourceId));
    expect(ancestry?.archiveStage).toBe('OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY');expect(ancestry?.evidence).not.toBeNull();
    if(!ancestry?.evidence)throw new Error('genuine original acknowledgement missing');
    const saved=ancestry.evidence,p=saved.proposal,request=foulTerminalPendingInput(p);
    expect(scoring.record.basisRulingId).toBe(p.callSource.sourceId);
    const scoreRow={__ack_rowid:1,scoring_application_id:scoring.scoringApplicationId,match_id:p.gameId,official_application_id:p.source.applicationId,
      closure_id:p.source.sourceId,source_event_id:scoring.sourceEventId,request_json:json({input:{scoringApplicationId:scoring.scoringApplicationId,officialApplication:request},evidence:null}),result_json:json(scoring)};
    const after=before.map(owner=>owner.table==='official_scoring_applications'?{...owner,rows:[scoreRow]}:owner);
    expect(rawCensus(db)).toEqual(after);expect(schemaCensus(db)).toEqual(afterLayout);
    const workload=withSqliteReadTransaction(db,()=>foulTerminalWorkloadEvidenceFromSqlite(db!).readSettlement(f.sourceId));
    expect(workload.kind).toBe('complete');if(workload.kind!=='complete')throw new Error('genuine all-ten effects missing');
    expect(workload.participants).toHaveLength(10);expect(workload.participants.every(p=>p.applied)).toBe(true);
    const end=JSON.parse(String(db.prepare('SELECT snapshot_json FROM actual_foul_play_ends WHERE source_id=?').get(p.physicalEndReference.sourceId)!.snapshot_json));
    const field=withSqliteReadTransaction(db,()=>battedWorldFieldEvidenceFromSqlite(db!).read(end.source.baseFieldSourceId));
    expect(field).not.toBeNull();if(!field)throw new Error('genuine field setup provenance missing');
    const geometry=battedWorldFieldGeometry(field),frame=field.response.touch.worldContact.flight.physicalPitch.frame;
    const source=actualFoulTerminalPostPlaySetupInput({sourceId:'fixture-terminal-continuing-setup',sourceVersion:'fixture-v1',capability:'actual_foul_terminal_post_play_setup_v1',
      terminalReference:{owner:'actual_foul_terminal_applications',sourceId:f.sourceId,sourceVersion:saved.source.sourceVersion,sourceHash:hash(saved.source),proposalHash:hash(p)},
      nextStartedAtTick:p.clock.closureTick+1,worldSetup:{baseCenters:{first:geometry.baseGeometry.bases.first.region.center,
        second:geometry.baseGeometry.bases.second.region.center,third:geometry.baseGeometry.bases.third.region.center},
        defenders:frame.world.defenders.map(({playerId,registeredPosition,position})=>({playerId,registeredPosition,position})),activePreviousPlayControllerIds:[]},
      controllerReset:'rule_system_retire_original_play'},'fixture-terminal-continuing-setup');
    // Explicit fixture-only setup acceptance: the original accepted venue and
    // original nine pre-play positions are reused, with closureTick+1 as the
    // chosen test start. This is not production timing/calibration inference.
    writeFileSync(join(f.directory,'completion-setup-fixture.json'),JSON.stringify({version:'terminal_post_play_explicit_test_setup_v1',source,
      provenance:{terminalSourceId:f.sourceId,originalFieldSourceId:field.source.sourceId,timingChoice:'explicit_fixture_closure_tick_plus_one',
        positionChoice:'original_accepted_pre_play_defender_positions',geometryChoice:'original_accepted_venue_base_centers'}},null,2),{flag:'wx'});
    expect(rawCensus(db)).toEqual(after);expect(schemaCensus(db)).toEqual(afterLayout);
    scorer.close();scorer=undefined;
    runner=openSqliteActualFoulTerminalApplicationRunner(path);
    const completionMethod=(runner as unknown as Record<string,unknown>).completePostPlay;
    expect(rawCensus(db)).toEqual(after);expect(schemaCensus(db)).toEqual(afterLayout);
    runner.close();runner=undefined;db.close();db=undefined;
    noSettledCheckpointSidecars(path);noSettledCheckpointSidecars(f.settledSourcePath);
    expect(fileHash(f.settledSourcePath)).toBe(f.settledSourceSha256);expect(fileHash(f.retainedPath)).toBe(f.retainedSha256);
    writeFileSync(join(f.directory,'scored-settled-prerequisite-receipt.json'),JSON.stringify({version:'terminal_scored_settled_prerequisite_v1',
      destinationPath:path,destinationSha256:fileHash(path),sourceArtifact:qualified.manifest.artifact,sourceId:f.sourceId,
      scoringApplicationId:scoring.scoringApplicationId,scoringRowHash:hash(Object.fromEntries(Object.entries(scoreRow).filter(([key])=>key!=='__ack_rowid'))),
      originalRevision:saved.result.official.receipt.durableRevision,rowsHash:hash(after),schemaHash:hash(afterLayout),setupSource:source,
      workloadParticipantCount:workload.participants.length,completed:false},null,2),{flag:'wx'});
    expect(typeof completionMethod,'GENUINE_SETTLED_SCORED_TERMINAL_COMPLETION_API_MISSING').toBe('function');
  }finally{try{runner?.close();}finally{try{scorer?.close();}finally{db?.close();}}}
},1_200_000);
