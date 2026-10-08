import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { DatabaseSync } from 'node:sqlite';
import { vi } from 'vitest';
import * as actorOwner from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actorJson as json, actorHash as hash, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqlitePlayerWorkloadRecoveryStore, type AcceptedPlayerWorkloadBaseline } from './SqlitePlayerWorkloadRecoveryStore';
import { ensurePlayerPersonLinkSchema, type AcceptedPlayerIntakeSource } from './SqlitePlayerPersonLinkStore';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import type { PlayerWorkloadActivity } from '../../core/world/development/PlayerWorkloadRecovery';
import type { AcceptedSamePlateAppearanceEnrollment } from './SamePlateAppearanceEnrollment';
const { DatabaseSync: NativeDatabase } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
export const native = (path: string) => new NativeDatabase(path);
/** Small isolated Native workload/owner tests. Actor authentication is mocked;
 * these values are never used to qualify or modify the genuine checkpoint. */
export const enrollmentFixture = (suffix = '') => {
  const directory = mkdtempSync(join(tmpdir(), 'same-pa-small-')), path = join(directory, 'test.sqlite'), db = native(path);
  db.exec('PRAGMA journal_mode=WAL'); ensurePlayerPersonLinkSchema(db);
  const links = new Map<string, AcceptedPlayerIntakeSource>(), baselines = new Map<string, AcceptedPlayerWorkloadBaseline>();
  const activities = new Map<string, PlayerWorkloadActivity>();
  const players = ['away-2', ...Array.from({ length: 9 }, (_, i) => `home-${i+1}`)].map(p => p + suffix);
  const bindings = players.map((playerId, i) => {
    const personLinkSourceId = 'intake-' + playerId;
    const person: AcceptedPlayerIntakeSource = { sourceId: personLinkSourceId, careerId: 'career-a', playerId, personId: 'person-'+playerId,
      sourceRecordId: 'record-'+playerId, sourceVersion: 'fixture-v1', acceptedRevision: 1, acceptedAtDay: 1, rosterRevision: 0 };
    links.set(personLinkSourceId,person);
    db.prepare('INSERT INTO world_player_person_links VALUES(?,?,?,?,?,?,?)').run(personLinkSourceId,'career-a',playerId,person.personId,0,1,json(person));
    baselines.set('baseline-'+playerId, { sourceId:'baseline-'+playerId, sourceVersion:'fixture-v1', personLinkSourceId,
      careerId:'career-a',playerId,createdAtDay:1,fatigue:0.2,recoveryCapacity:0.5,
      policy:{policyId:'workload',version:'v1',availableAtDay:0,workloadFatiguePerUnit:0.1,travelFatiguePerKm:0.001,recoveryPerHour:0.1} });
    return {careerId:'career-a',gameId:'game'+suffix,playerId,personId:person.personId,personLinkSourceId,gameDay:2,
      fixtureEventId:'fixture'+suffix,competitionEditionId:'season',clubId:i?'home':'away',side:i?'HOME':'AWAY'};
  });
  const personLinks = { readLink:(sourceId:string)=>links.get(sourceId)??null };
  const authority = { readAcceptedBaseline:(sourceId:string)=>baselines.get(sourceId)??null,readAcceptedActivity:(sourceId:string)=>activities.get(sourceId)??null };
  const workload = openSqlitePlayerWorkloadRecoveryStore(path,personLinks,authority);
  for (const baseline of baselines.values()) workload.initialize(baseline.sourceId);
  const actor = { source:{sourceId:'actor'+suffix,sourceVersion:'fixture-v1',gameId:'game'+suffix,playerId:players[0],initialWorldSourceId:'initial'+suffix},
    binding:bindings[0],defenderBindings:bindings.slice(1),person:links.get('intake-'+players[0]),defenderPersons:players.slice(1).map(p=>links.get('intake-'+p)),
    match:{playId:1,bases:{first:null,second:null,third:null}},world:{runners:[],defenders:players.slice(1).map(playerId=>({playerId}))},
    officialRevision:0,origin:{initialWorldHash:'fixture',applicationHash:null,scoringHash:null},fixtureHash:hash('fixture'+suffix),
    worldFixture:{careerId:'career-a',competitionEditionId:'season',game:{gameId:'game'+suffix,homeClubId:'home',awayClubId:'away'}} } as unknown as DurablePhysicalPlateAppearanceActor;
  db.exec(`CREATE TABLE physical_plate_appearance_actors(source_id TEXT PRIMARY KEY,source_version TEXT,game_id TEXT,play_id INTEGER,player_id TEXT,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT);
    CREATE TABLE physical_pitch_progress_actions(source_id TEXT PRIMARY KEY,game_id TEXT,play_id INTEGER,progress_revision INTEGER,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT);
    CREATE TABLE physical_pitch_progress_heads(game_id TEXT,play_id INTEGER,revision INTEGER,last_source_id TEXT);`);
  const persistActor = () => db.prepare('INSERT OR REPLACE INTO physical_plate_appearance_actors VALUES(?,?,?,?,?,?,?,?,?)').run(actor.source.sourceId,actor.source.sourceVersion,
    actor.source.gameId,actor.match.playId,actor.source.playerId,json(actor.source),hash(actor.source),json(actor),hash(actor));
  persistActor();
  vi.spyOn(actorOwner,'readPhysicalPlateAppearanceActorFromSqlite').mockImplementation((_connection,sourceId)=>sourceId===actor.source.sourceId?actor:null);
  vi.spyOn(actorOwner,'assertPhysicalActorOpenFrame').mockImplementation(()=>{});
  const source: AcceptedSamePlateAppearanceEnrollment = { sourceId:'enrollment'+suffix,sourceVersion:'fixture-v1',capability:'reserved_same_pa_enrollment_v1',
    actorReference:{owner:'physical_plate_appearance_actors',sourceId:actor.source.sourceId,sourceHash:hash(actor.source),snapshotHash:hash(actor)},
    firstPhysicalPitchSourceId:'first-pitch'+suffix,executionBasis:'reserved_cumulative_actual_role_total_v1',
    participantBaselineReferences:players.map(playerId=>({playerId,baselineSourceId:'baseline-'+playerId,revision:0,stateHash:hash(readActualRoleWorkloadState(db,'career-a',playerId))})) };
  const close = () => { workload.close(); db.close(); rmSync(directory,{recursive:true,force:true}); };
  return {path,db,actor,source,players,personLinks,authority,workload,activities,baselines,persistActor,close};
};
export const count = (db: Pick<DatabaseSync,'prepare'>, table:string) => db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n;

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants,copyFileSync,existsSync,readFileSync } from 'node:fs';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
/** Explicitly gated consumer of the parent's closed qualified checkpoint.
 * It inventories actual prerequisites only. Missing refs are reported as inputs;
 * no baseline is manufactured and the checkpoint is never opened in place. */
export const inspectQualifiedSamePaActorCopy = (input:Readonly<{manifestPath:string;manifestSha256:string;destinationPath:string}>) => {
  const fileHash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
  const closed=(path:string)=>{for(const suffix of ['-wal','-shm','-journal'])assert(!existsSync(path+suffix),'checkpoint has a live sidecar');};
  assert.equal(fileHash(input.manifestPath),input.manifestSha256);
  const manifest=JSON.parse(readFileSync(input.manifestPath,'utf8')) as {version:string;qualified:boolean;artifact:{path:string;sha256:string};qualification:{receipt:{path:string;sha256:string}}};
  assert.equal(manifest.version,'terminal_next_actor_checkpoint_input_v1');assert.equal(manifest.qualified,true);
  assert.equal(fileHash(manifest.qualification.receipt.path),manifest.qualification.receipt.sha256);
  const receipt=JSON.parse(readFileSync(manifest.qualification.receipt.path,'utf8')) as {actorSourceId:string;acceptedActorPlayerId:string;pitchSourceId:null;pitchWriterInvoked:boolean;readinessReference:unknown};
  assert.equal(receipt.acceptedActorPlayerId,'away-2');assert.equal(receipt.pitchSourceId,null);assert.equal(receipt.pitchWriterInvoked,false);
  assert.notEqual(manifest.artifact.path,input.destinationPath);assert(!existsSync(input.destinationPath));closed(manifest.artifact.path);
  assert.equal(fileHash(manifest.artifact.path),manifest.artifact.sha256);copyFileSync(manifest.artifact.path,input.destinationPath,constants.COPYFILE_EXCL);
  assert.equal(fileHash(input.destinationPath),manifest.artifact.sha256);
  const db=native(input.destinationPath);
  try{return withSqliteReadTransaction(db,()=>withBattedWorldPhysicalReadTraversal(db,()=>{
    const actual=actorOwner.readPhysicalPlateAppearanceActorFromSqlite(db,receipt.actorSourceId);assert(actual);
    actorOwner.assertPhysicalActorOpenFrame(db,actual);assert.equal(actual.binding.playerId,receipt.acceptedActorPlayerId);
    assert.deepEqual(actual.origin.foulTerminalReadiness,receipt.readinessReference);
    const bindings=[actual.binding,...actual.defenderBindings];assert.equal(bindings.length,10);
    assert.equal(new Set(bindings.map(b=>b.playerId)).size,10);assert.equal(new Set(bindings.map(b=>b.personId)).size,10);
    const missingBaselinePlayerIds:string[]=[],participantBaselineReferences:AcceptedSamePlateAppearanceEnrollment['participantBaselineReferences'][number][]=[];
    for(const b of bindings){const state=readActualRoleWorkloadState(db,b.careerId,b.playerId,undefined,b.personLinkSourceId);
      if(!state){missingBaselinePlayerIds.push(b.playerId);continue;}
      const row=db.prepare('SELECT source_id FROM world_player_workload_baselines WHERE career_id=? AND player_id=?').get(b.careerId,b.playerId);assert(row);
      participantBaselineReferences.push({playerId:b.playerId,baselineSourceId:String(row.source_id),revision:state.revision,stateHash:hash(state)});
    }
    assert.equal(db.prepare('SELECT count(*) AS n FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=?').get(actual.source.gameId,actual.match.playId)!.n,0);
    return {kind:'authenticated_actor_prerequisites' as const,actorReference:{owner:'physical_plate_appearance_actors' as const,sourceId:actual.source.sourceId,sourceHash:hash(actual.source),snapshotHash:hash(actual)},
      gameId:actual.source.gameId,playId:actual.match.playId,missingBaselinePlayerIds,participantBaselineReferences,reservationAttempted:false as const};
  }));}finally{db.close();closed(input.destinationPath);closed(manifest.artifact.path);assert.equal(fileHash(manifest.artifact.path),manifest.artifact.sha256);
    assert.equal(fileHash(input.destinationPath),manifest.artifact.sha256);assert.equal(fileHash(input.manifestPath),input.manifestSha256);}
};
