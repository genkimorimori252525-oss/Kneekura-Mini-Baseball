import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { policy } from '../../core/world/psychology/EmotionFixtures.test-support';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as actorReader from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as viewReader from './SamePlateAppearanceHistoricalExecutionEvidenceFromSqlite';
import * as participantsReader from './SamePlateAppearanceOriginalParticipants';
import { deriveSamePaDispatchRoles } from './SamePlateAppearanceDispatchRoles';
import { openSqliteBattingEmotionStore } from './SqliteBattingEmotionStore';

const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const cleanups:(()=>void)[]=[];
afterEach(()=>{cleanups.splice(0).forEach(close=>close());vi.restoreAllMocks();});
/** Focused consumer-binding seam only. Real role validation, genesis policy,
 * SQLite transaction and replay run; original actor/view reads are structural.
 * LAN01 separately owns the genuine occupied Native positive qualification. */
const setup=()=>{
  const directory=mkdtempSync(join(tmpdir(),'occupied-emotion-binding-')),path=join(directory,'owner.sqlite'),db=new DatabaseSync(path);
  const positions=['P','C','1B','2B','3B','SS','LF','CF','RF'];
  const people=Array.from({length:11},(_,i)=>({playerId:'p'+i,personId:'person'+i,sourceId:'person-link'+i}));
  const bindings=people.map((p,i)=>({playerId:p.playerId,personId:p.personId,personLinkSourceId:p.sourceId,careerId:'career',gameId:'game',gameDay:1,
    fixtureEventId:'fixture',competitionEditionId:'edition',side:i===0||i===10?'AWAY':'HOME'}));
  const actor:any={source:{sourceId:'actor',gameId:'game',playerId:'p0'},binding:bindings[0],person:people[0],defenderBindings:bindings.slice(1,10),defenderPersons:people.slice(1,10),
    match:{playId:1,bases:{first:'p10',second:null,third:null}},world:{runners:[{playerId:'p10'}],defenders:positions.map((registeredPosition,i)=>({playerId:people[i+1].playerId,registeredPosition}))}};
  const participants=bindings.map(b=>({playerId:b.playerId,reservedState:{careerId:'career',playerId:b.playerId,revision:0},
    projectedState:{careerId:'career',playerId:b.playerId,revision:1},projectedStateHash:hash({careerId:'career',playerId:b.playerId,revision:1})}));
  const pin=(owner:string,sourceId:string)=>({owner,sourceId,sourceHash:hash(sourceId),snapshotHash:hash(sourceId)}),enrollmentReference=pin('same_pa_enrollments','enrollment');
  const view:any={kind:'basis_prepared',source:{enrollmentReference},participants,lineage:{enrollmentReference,careerId:'career',gameId:'game',playId:1,
    actorReference:{owner:'physical_plate_appearance_actors',sourceId:'actor',sourceHash:hash(actor.source),snapshotHash:hash(actor)},
    participantReferences:bindings.map((b,i)=>({playerId:b.playerId,bindingHash:hash(b),personHash:hash(people[i]),baselineSourceId:'baseline'+i,revision:0,stateHash:hash(participants[i].reservedState)}))}};
  const originals:any=bindings.map((binding,i)=>({binding,person:people[i],role:i===0?'batter':i<10?'defender':'runner',startingBase:i===10?1:null}));
  const source={sourceId:'occupied-genesis',sourceVersion:'fixture-only-v1',capability:'owned_batting_emotion_genesis_v1',viewReference:pin('reserved_pa_execution_views','view'),
    member:deriveSamePaDispatchRoles(actor,view,originals)[0].member,policy:policy(),provenance:{assessmentSourceId:'assessment',assessmentVersion:'fixture-only-v1',
      calibrationSourceId:'existing-Core-emotion-fixture',calibrationVersion:'fixture-only-v1'}};
  vi.spyOn(actorReader,'readPhysicalPlateAppearanceActorFromSqlite').mockReturnValue(actor);
  vi.spyOn(viewReader,'readHistoricalSamePaExecutionView').mockReturnValue({view} as any);
  const readParticipants=vi.spyOn(participantsReader,'readSamePaOriginalParticipants').mockReturnValue(originals);
  const owner=openSqliteBattingEmotionStore(path,{readAcceptedGenesis:id=>id===source.sourceId?source:null});
  cleanups.push(()=>{owner.close();db.close();rmSync(directory,{recursive:true,force:true});});
  return{db,source,originals,readParticipants,owner};
};
it('authenticates all original occupied participants before accepting and replaying the batter genesis',()=>{
  const f=setup(),value=f.owner.acceptGenesis(f.source.sourceId);
  expect(value.kind).toBe('batting_emotion_genesis');expect(f.readParticipants).toHaveBeenCalled();
  expect(f.owner.readGenesis(f.source.sourceId)).toEqual(value);expect(f.owner.acceptGenesis(f.source.sourceId)).toEqual(value);
  expect(f.db.prepare('SELECT count(*) n FROM batting_emotion_v1_geneses').get()?.n).toBe(1);
});
it.each(['missing_runner','wrong_runner_person','wrong_batter_member'])('rejects %s before persisting an emotion genesis',kind=>{
  const f=setup();
  if(kind==='missing_runner')f.originals.pop();
  if(kind==='wrong_runner_person')f.originals[10].person={...f.originals[10].person,personId:'foreign-person'};
  if(kind==='wrong_batter_member')f.source.member={...f.source.member,personHash:hash('foreign-person')};
  expect(()=>f.owner.acceptGenesis(f.source.sourceId)).toThrow(/original/);
  expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name='batting_emotion_v1_geneses'").all()).toEqual([]);
});
