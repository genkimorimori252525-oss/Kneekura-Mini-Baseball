import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DatabaseSync as Database } from 'node:sqlite';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import { openSqlitePhysicalPlateAppearanceActorStore, type AcceptedPhysicalPlateAppearanceActor } from './SqlitePhysicalPlateAppearanceActorStore';
import { openSqlitePhysicalPitchProgressStore, type AcceptedPhysicalPitchActionSource } from './SqlitePhysicalPitchProgressStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { openSqlitePlayerPitchTimingStore } from './SqlitePlayerPitchTimingStore';
import { openSqlitePlayerReleaseGeometryStore } from './SqlitePlayerReleaseGeometryStore';
import { openSqlitePitchFatiguePolicyStore } from './SqlitePitchFatiguePolicyStore';
import { readPhysicalPitchProgressFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { readPhysicalPlateAppearanceActorFromSqlite, actorJson as json, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { foulTerminalNextPlayReadinessFromSqlite } from './FoulTerminalNextPlayReadiness';
import { foulTerminalPostPlayCompletionEvidenceFromSqlite } from './ActualFoulTerminalPostPlayCompletionEvidenceFromSqlite';
import { fileHash, rawCensus, schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { privatePitchFaultConservation } from './PrivatePitchFaultConservation.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const same = (a: unknown,b: unknown) => assert.equal(json(a),json(b));
const closedFile = (path:string) => { for (const suffix of ['-wal','-shm','-journal']) assert(!existsSync(path+suffix), 'next-play input must be a closed artifact'); };

/** Inject a single real workload-head write after the physical writer actually
 * acquires its transaction and before its admission checks. Test-only; never
 * supplies a fake ready result or changes the native statement outcome. */
const acquisitionFault = (path:string,career:string,player:string,expectedRevision:number) => {
  const prototype = DatabaseSync.prototype, descriptor = Object.getOwnPropertyDescriptor(prototype,'exec');
  assert(descriptor && typeof descriptor.value === 'function');
  let reached = false;
  const wrapped = function(this:Database,...args:Parameters<Database['exec']>) {
    const result = Reflect.apply(descriptor.value,this,args);
    if (!reached && args[0] === 'BEGIN IMMEDIATE'
      && this.prepare('PRAGMA database_list').all().find(row => row.name === 'main')?.file === path) {
      assert(this.isTransaction);
      assert.equal(this.prepare('SELECT revision FROM world_player_workload_heads WHERE career_id=? AND player_id=?').get(career,player)?.revision,expectedRevision);
      this.prepare('UPDATE world_player_workload_heads SET revision=revision+100 WHERE career_id=? AND player_id=?').run(career,player);
      reached = true;
    }
    return result;
  };
  Object.defineProperty(prototype,'exec',{...descriptor,value:wrapped});
  return { reached:() => reached, close() {
    assert.equal(Object.getOwnPropertyDescriptor(prototype,'exec')?.value,wrapped,'acquisition witness was replaced');
    Object.defineProperty(prototype,'exec',descriptor);
  } };
};
/** A copied genuine completion is the only input. There is no physical producer,
 * completion writer, original-effect repair or accepted-batter substitution. */
export const verifyFoulTerminalNextPlayArtifact = (input:Readonly<{
  sourcePath:string; sourceSha256:string; destinationPath:string; terminalSourceId:string;
  acceptedInputPath:string; acceptedInputSha256:string; faultChecks:boolean;
  mode?:'actor_checkpoint'|'pitch_before'|'pitch_after'|'pitch_clean'; progress?:(message:string) => void;
}>) => {
  const mode=input.mode??'all',pitchOnly=mode.startsWith('pitch_');
  if(mode==='actor_checkpoint'||mode==='pitch_before'||mode==='pitch_after')assert(input.faultChecks);
  assert.notEqual(input.sourcePath,input.destinationPath);assert(!existsSync(input.destinationPath));closedFile(input.sourcePath);
  assert.equal(fileHash(input.sourcePath),input.sourceSha256);
  assert.equal(fileHash(input.acceptedInputPath),input.acceptedInputSha256);
  const accepted = JSON.parse(readFileSync(input.acceptedInputPath,'utf8')) as { nextBatterPlayerId:string;
    nextTake:Extract<AcceptedPhysicalPitchActionSource['request']['batter'],{action:{kind:'take'}}> };
  assert.equal(accepted.nextBatterPlayerId,'away-2');
  same(accepted.nextTake,{action:{kind:'take'},plateZ:0,strikeZone:{centerX:0,halfWidth:0.2,lowerY:1.4,upperY:1.8},ballRadiusMeters:0.0366});
  mkdirSync(dirname(input.destinationPath),{recursive:true});copyFileSync(input.sourcePath,input.destinationPath,constants.COPYFILE_EXCL);
  assert.equal(fileHash(input.destinationPath),input.sourceSha256,'the copied input must preserve every source byte');
  const resources:{close():void}[]=[],track=<T extends {close():void}>(r:T):T => {resources.push(r);return r;};
  const drain=() => {const errors:unknown[]=[];while(resources.length)try{resources.pop()!.close();}catch(error){errors.push(error);}
    if(errors.length)throw new AggregateError(errors,'next-play fixture handle cleanup failed');};
  try {
    const db=track(new DatabaseSync(input.destinationPath));
    const original=rawCensus(db),originalSchema=schemaCensus(db);
    input.progress?.('authenticating genuine completed terminal on its unchanged private copy');
    const ready=withSqliteReadTransaction(db,()=>foulTerminalNextPlayReadinessFromSqlite(db).read(input.terminalSourceId));
    input.progress?.('genuine completed terminal current readiness authenticated');
    const saved=ready.archive,p=saved.proposal,c=saved.result.completion,first=p.participants[0].binding,game=p.seasonFixture.game;
    assert.equal(p.clock.ticksPerSecond,1_000_000,'the reused pitch recipe requires microsecond World ticks');
    assert.equal(c.activation.nextMatchState.playId,p.playId+1);
    same(rawCensus(db),original);
    const links=track(openSqlitePlayerPersonLinkStore(input.destinationPath)),official=track(new SqliteOfficialStateStore(input.destinationPath));
    const participation=track(new SqliteOfficialParticipationStore(input.destinationPath,{
      readGame:gameId => gameId === p.gameId ? {careerId:first.careerId,competitionEditionId:first.competitionEditionId,gameDay:first.gameDay,
        homeClubId:game.homeClubId,awayClubId:game.awayClubId,fixtureEventId:first.fixtureEventId} : null,
      readRoster:() => null,readPersonLink:(playerId,sourceId) => {const link=links.readLink(sourceId);return link?.playerId===playerId?{sourceId,personId:link.personId}:null;},
    }));
    const binding=participation.readPregameBinding(p.gameId,accepted.nextBatterPlayerId);assert(binding,'accepted next batter is not in this original fixture');
    assert.equal(binding.side,c.activation.nextMatchState.half==='top'?'AWAY':'HOME');
    assert.equal(binding.careerId,first.careerId);assert.equal(binding.gameDay,first.gameDay);assert.equal(binding.fixtureEventId,first.fixtureEventId);
    assert.equal(binding.competitionEditionId,first.competitionEditionId);assert(links.readLink(binding.personLinkSourceId));
    assert(!c.nextWorld.defenders.some(a=>a.playerId===binding.playerId));
    const initialWorlds=track(openSqliteOfficialInitialWorldStore(input.destinationPath,{matches:official,participation}));
    const actorInput:AcceptedPhysicalPlateAppearanceActor={sourceId:'fixture-next-terminal-batter',sourceVersion:'fixture-v1',gameId:p.gameId,
      playerId:accepted.nextBatterPlayerId,activationApplicationId:saved.source.applicationId};
    // Pitch lanes consume the authentic closed actor checkpoint and never open an actor writer.
    const actors=pitchOnly?null:track(openSqlitePhysicalPlateAppearanceActorStore(input.destinationPath,{matches:official,participation,initialWorlds},
      {readAcceptedActor:sourceId=>sourceId===actorInput.sourceId?actorInput:null}));
    same(rawCensus(db),original);
    const pitcher=c.nextWorld.defenders.find(a=>a.registeredPosition==='P');assert(pitcher);
    const participant=ready.settlement.participants.find(a=>a.playerId!==pitcher.playerId);assert(participant);
    const revision=Number(db.prepare('SELECT revision FROM world_player_workload_heads WHERE career_id=? AND player_id=?').get(first.careerId,participant.playerId)!.revision);
    const faultEvidence={actorBeforeInsert:false,actorAfterInsert:false,pitchBeforeInsert:false,pitchAfterInsert:false};
    const rejectsCurrentWorkload=(write:()=>unknown)=>{
      let failure:unknown;try{write();}catch(error){failure=error;}assert(failure,'the real writer must reject participant head drift');
      const messages=(value:unknown):string[]=>value instanceof Error?[value.message,...('cause'in value?messages(value.cause):[])]:[];
      assert(messages(failure).some(message=>/actual role workload head differs|terminal readiness current workload head differs/.test(message)),
        'the real current participant workload check must reject the fault');
    };
    const injectBefore=(write:()=>unknown,sql:RegExp) => {
      const before=rawCensus(db),fault=acquisitionFault(input.destinationPath,first.careerId,participant.playerId,revision);
      const witness=witnessSqliteWrite(sql,()=>true);
      try {rejectsCurrentWorkload(write);assert(fault.reached(),'the real writer acquisition must be reached');assert(!witness.wasReached(),'the guarded INSERT must not run');}
      finally {witness.close();fault.close();}
      same(rawCensus(db),before);
    };
    const injectAfter=(write:()=>unknown,table:string,sourceId:string,sql:RegExp) => {
      const before=rawCensus(db),schema=schemaCensus(db);
      // Test-only mutation after the genuine native INSERT returned, on that
      // exact writer connection. No trigger/schema change or fabricated proof.
      const witness=witnessSqliteWrite(sql,writer=>{
        assert(writer.isTransaction);
        assert.equal(writer.prepare('PRAGMA database_list').all().find(row=>row.name==='main')?.file,input.destinationPath);
        assert.equal(writer.prepare(`SELECT count(*) AS n FROM ${table} WHERE source_id=?`).get(sourceId)!.n,1);
        assert.equal(writer.prepare('SELECT revision FROM world_player_workload_heads WHERE career_id=? AND player_id=?').get(first.careerId,participant.playerId)!.revision,revision);
        writer.prepare('UPDATE world_player_workload_heads SET revision=revision+100 WHERE career_id=? AND player_id=?').run(first.careerId,participant.playerId);
        assert.equal(writer.prepare('SELECT revision FROM world_player_workload_heads WHERE career_id=? AND player_id=?').get(first.careerId,participant.playerId)!.revision,revision+100);
        return true;
      });
      try {rejectsCurrentWorkload(write);assert(witness.wasReached(),'the actual INSERT and same-connection participant drift must be witnessed');}
      finally {witness.close();}
      same(rawCensus(db),before);same(schemaCensus(db),schema);
    };
    const finish=(actor:DurablePhysicalPlateAppearanceActor,nextPitch?:ReturnType<typeof readPhysicalPitchProgressFromSqlite>[number])=>{
      const faultOnly=mode==='pitch_before'||mode==='pitch_after';
      const after=rawCensus(db),allowed=new Set(pitchOnly?['physical_pitch_progress_actions','physical_pitch_progress_heads','actual_live_play_admissions']:
        ['physical_plate_appearance_actors','physical_plate_appearance_actor_games','physical_pitch_progress_actions','physical_pitch_progress_heads','actual_live_play_admissions']);
      for(const owner of original){const next=after.find(a=>a.table===owner.table);assert(next);same(next.rows.slice(0,owner.rows.length),owner.rows);
        if(!allowed.has(String(owner.table)))same(next,owner);}
      same(schemaCensus(db),originalSchema);if(faultOnly)same(after,original);
      assert.equal(db.prepare('SELECT count(*) AS n FROM physical_plate_appearance_actors WHERE source_id=?').get(actorInput.sourceId)!.n,1);
      assert.equal(db.prepare('SELECT count(*) AS n FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=?').get(p.gameId,p.playId+1)!.n,nextPitch?1:0);
      const completionBytes=json(saved);drain();closedFile(input.destinationPath);
      input.progress?.('all execution handles closed; reopening immutable completion and lane output in a query-only snapshot');
      // Only our closed private output is opened normally, so SQLite can retire
      // its own empty WAL/SHM. All proof work stays in the query-only snapshot.
      const reopened=new DatabaseSync(input.destinationPath);
      try {withSqliteReadTransaction(reopened,()=>withBattedWorldPhysicalReadTraversal(reopened,()=>{
        assert.equal(json(foulTerminalPostPlayCompletionEvidenceFromSqlite(reopened).read(input.terminalSourceId)),completionBytes);
        same(readPhysicalPlateAppearanceActorFromSqlite(reopened,actorInput.sourceId),actor);
        const history=readPhysicalPitchProgressFromSqlite(reopened,p.gameId,p.playId+1);
        if(nextPitch){assert.equal(history.length,1);same(history[0],nextPitch);}else same(history,[]);
      }));}finally{reopened.close();}
      closedFile(input.destinationPath);closedFile(input.sourcePath);assert.equal(fileHash(input.sourcePath),input.sourceSha256);
      assert.equal(fileHash(input.acceptedInputPath),input.acceptedInputSha256);
      const destinationSha256=fileHash(input.destinationPath);
      const faultConservation=faultOnly?privatePitchFaultConservation(readFileSync(input.sourcePath),readFileSync(input.destinationPath)):null;
      return {version:mode==='all'?'terminal_next_play_native_qualification_v1':mode==='actor_checkpoint'?'terminal_next_actor_checkpoint_v1':
        faultOnly?'terminal_next_pitch_boundary_fault_v1':'terminal_next_pitch_clean_v1',mode,
        sourceArtifact:{path:input.sourcePath,sha256:input.sourceSha256},acceptedInput:{path:input.acceptedInputPath,sha256:input.acceptedInputSha256},
        destinationPath:input.destinationPath,destinationSha256,terminalSourceId:input.terminalSourceId,actorSourceId:actorInput.sourceId,
        pitchSourceId:nextPitch?.source.sourceId??null,acceptedActorPlayerId:accepted.nextBatterPlayerId,acceptedTake:accepted.nextTake,readinessReference:ready.reference,
        originalRowsPreserved:true,noDuplicateWorkload:true,exactlyOnceActor:true,exactlyOncePitch:!!nextPitch,reopened:true,allHandlesClosed:true,
        faultOnlyOutputByteIdentical:false,faultOnlySqlStateConserved:faultOnly,expectedOpenerMetadataCommit:faultConservation,faultChecks:input.faultChecks,faultEvidence,actorWriterInvoked:!pitchOnly,pitchWriterInvoked:mode!=='actor_checkpoint',
        autonomousBatterSelection:false,twoCompletedPriorChainQualified:false};
    };
    let actor:DurablePhysicalPlateAppearanceActor;
    if(pitchOnly){
      actor=withSqliteReadTransaction(db,()=>readPhysicalPlateAppearanceActorFromSqlite(db,actorInput.sourceId))!;assert(actor);
      same(actor.source,actorInput);same(actor.origin.foulTerminalReadiness,ready.reference);same(actor.world,c.nextWorld);
      assert.equal(db.prepare('SELECT count(*) AS n FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=?').get(p.gameId,p.playId+1)!.n,0);
      input.progress?.('genuine closed actor checkpoint authenticated; no new actor writer invoked');
    }else{
    if(input.faultChecks){
      injectBefore(()=>actors!.accept(actorInput.sourceId),/^INSERT INTO physical_plate_appearance_actors\b/);faultEvidence.actorBeforeInsert=true;
      input.progress?.('actor pre-INSERT acquisition fault rejected and rolled back');
      injectAfter(()=>actors!.accept(actorInput.sourceId),'physical_plate_appearance_actors',actorInput.sourceId,/^INSERT INTO physical_plate_appearance_actors\b/);faultEvidence.actorAfterInsert=true;
      input.progress?.('actor post-INSERT participant drift rejected and rolled back');
    }
    input.progress?.('accepting the explicitly supplied next batter through the real actor writer');
    let actorWriter:Database|undefined;
    const actorWitness=witnessSqliteWrite(/^INSERT INTO physical_plate_appearance_actors\b/,writer=>{actorWriter=writer;return writer.isTransaction;});
    try {actor=actors!.accept(actorInput.sourceId);assert(actorWitness.wasReached());}finally{actorWitness.close();}
    input.progress?.('real next-actor acceptance returned');
    assert.equal(actor.match.playId,p.playId+1);same(actor.origin.foulTerminalReadiness,ready.reference);assert(!('actualLiveReadiness' in actor.origin));
    same(actor.world,c.nextWorld);assert.equal(actor.source.playerId,accepted.nextBatterPlayerId);
    const actorChanges=actorWriter!.prepare('SELECT total_changes() AS n').get()!.n;
    same(actors!.accept(actorInput.sourceId),actor);assert.equal(actorWriter!.prepare('SELECT total_changes() AS n').get()!.n,actorChanges);
    input.progress?.('next-actor exact zero-write retry returned');
    }
    if(mode==='actor_checkpoint')return finish(actor);
    const originalPitch=withSqliteReadTransaction(db,()=>readPhysicalPitchProgressFromSqlite(db,p.gameId,p.playId).at(-1));assert(originalPitch);
    input.progress?.('original physical pitch authenticated for the new accepted take');
    const workload=track(openSqlitePlayerWorkloadRecoveryStore(input.destinationPath,links));
    const timing=track(openSqlitePlayerPitchTimingStore(input.destinationPath,links));
    const release=track(openSqlitePlayerReleaseGeometryStore(input.destinationPath,links));
    const policies=track(openSqlitePitchFatiguePolicyStore(input.destinationPath));
    const current=workload.readHead(originalPitch.frame.workload.careerId,originalPitch.frame.workload.playerId);assert(current);
    const pitchInput:AcceptedPhysicalPitchActionSource={sourceId:'fixture-next-terminal-pitch',sourceVersion:'fixture-v1',gameId:p.gameId,
      activationApplicationId:saved.source.applicationId,effortPolicy:originalPitch.source.effortPolicy,
      request:{...originalPitch.source.request,workloadRevision:current.revision,
        delivery:{...originalPitch.source.request.delivery,readyAtUs:actor.world.tick},batter:accepted.nextTake}};
    const pitches=track(openSqlitePhysicalPitchProgressStore(input.destinationPath,{matches:official,initialWorlds,participation,
      runtime:{workload,timing,release,policies,effortPolicies:{readAcceptedPolicy:id=>id===pitchInput.effortPolicy.sourceId?pitchInput.effortPolicy:null}}},
      {readAcceptedAction:id=>id===pitchInput.sourceId?pitchInput:null}));
    if(input.faultChecks&&(mode==='all'||mode==='pitch_before')){
      injectBefore(()=>pitches.accept(pitchInput.sourceId,0),/^INSERT INTO physical_pitch_progress_actions\b/);faultEvidence.pitchBeforeInsert=true;
      input.progress?.('pitch pre-INSERT acquisition fault rejected and rolled back');
    }
    if(input.faultChecks&&(mode==='all'||mode==='pitch_after')){
      injectAfter(()=>pitches.accept(pitchInput.sourceId,0),'physical_pitch_progress_actions',pitchInput.sourceId,/^INSERT INTO physical_pitch_progress_actions\b/);faultEvidence.pitchAfterInsert=true;
      input.progress?.('pitch post-INSERT participant drift rejected and rolled back');
    }
    if(mode==='pitch_before'||mode==='pitch_after'){same(pitches.readProgress(p.gameId,p.playId+1),null);return finish(actor);}
    input.progress?.('executing one real physical take with the accepted batter and settled workload');
    let pitchWriter:Database|undefined;
    const pitchWitness=witnessSqliteWrite(/^INSERT INTO physical_pitch_progress_actions\b/,writer=>{pitchWriter=writer;return writer.isTransaction;});
    let nextPitch;
    try {nextPitch=pitches.accept(pitchInput.sourceId,0);assert(pitchWitness.wasReached());}finally{pitchWitness.close();}
    input.progress?.('real next-pitch acceptance returned');
    assert.equal(nextPitch.frame.match.playId,p.playId+1);assert.equal(nextPitch.frame.batterActor!.source.sourceId,actor.source.sourceId);
    same(nextPitch.frame.batterActor!.origin.foulTerminalReadiness,ready.reference);same(nextPitch.frame.workload,current);
    assert.equal(nextPitch.beforeTimeline.startedAtTick,actor.world.tick);
    assert(nextPitch.result.pitch.resolution.timeline.events.length>nextPitch.beforeTimeline.events.length);
    const pitchChanges=pitchWriter!.prepare('SELECT total_changes() AS n').get()!.n;
    same(pitches.accept(pitchInput.sourceId,0),nextPitch);assert.equal(pitchWriter!.prepare('SELECT total_changes() AS n').get()!.n,pitchChanges);
    input.progress?.('next-pitch exact zero-write retry returned');
    return finish(actor,nextPitch);
  } finally {drain();}
};
