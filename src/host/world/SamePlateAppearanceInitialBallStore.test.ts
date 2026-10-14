import { afterEach,expect,it,vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaOfficialSourceReference as originalRef } from './SamePlateAppearanceCatchCommunicationSource';
import { initialBallTables as tables } from './SamePlateAppearanceInitialBallSource';
import { openSqliteSamePlateAppearanceInitialBallStore } from './SqliteSamePlateAppearanceInitialBallStore';
import * as proof from './SamePlateAppearanceInitialBallProof';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const cleanups:(()=>void)[]=[];
afterEach(()=>{cleanups.splice(0).forEach(f=>f());vi.restoreAllMocks();});
const ref=(owner:string)=>({owner,sourceId:owner,sourceHash:hash(owner),snapshotHash:hash(owner)}) as any;
/** Storage/admission boundary test; the separately tested physical derivation
 * is isolated here, while the actual Native transaction and Play owner run. */
const fixture=()=>{
  const directory=mkdtempSync(join(tmpdir(),'initial-ball-owner-')),path=join(directory,'test.sqlite'),db=new DatabaseSync(path),owners:{close():void}[]=[];
  cleanups.push(()=>{owners.forEach(s=>s.close());db.close();rmSync(directory,{recursive:true,force:true});});
  let executed=false;
  const venue:any={sourceId:'venue',sourceVersion:'test-v1',rulePolicy:{ruleProfileId:'npb'}};
  const source:any={sourceId:'setup',sourceVersion:'test-v1',capability:'same_pa_initial_ball_setup_v1',enrollmentReference:ref('same_pa_enrollments'),
    viewReference:ref('reserved_pa_execution_views'),actionReference:ref('pa_dispatch_v1_action_plans'),postureReference:ref('batting_observation_v1_postures'),
    venueReference:originalRef(venue),firstPhysicalPitchSourceId:'pitch',pitcherPlayerId:'p',custody:{kind:'explicit_initial_secure_custody_v1',role:'tag_hand',ball:{tick:100,position:{x:0,y:1,z:18},velocity:{x:0,y:0,z:0},spin:{x:0,y:0,z:0}}}};
  const lineage:any={enrollmentReference:source.enrollmentReference,actorReference:ref('physical_plate_appearance_actors'),careerId:'career',gameId:'game',playId:1,firstPhysicalPitchSourceId:'pitch'};
  const setup:any={kind:'same_pa_initial_ball_setup_v1',source,lineage,originalVenue:venue,occurredAt:{originTick:100,elapsedSeconds:0,tick:100}};
  vi.spyOn(proof,'deriveSamePaInitialSetupFromSqlite').mockImplementation((_db,s,v,fresh)=>{if(fresh&&executed)throw new Error('past pre-pitch cut');expect(s).toEqual(source);expect(v).toEqual(venue);return setup;});
  const person:any={sourceId:'umpire-person',sourceVersion:'test-v1',capability:'accepted_original_umpire_person_v1',careerId:'career',officialId:'u',personId:'person-u'};
  const assignment:any={sourceId:'assignment',sourceVersion:'test-v1',capability:'same_pa_explicit_live_ball_assignment_v1',role:'plate_umpire',enrollmentReference:source.enrollmentReference,
    gameId:'game',playId:1,physicalPitchSourceId:'pitch',officialId:'u',personId:'person-u',personReference:originalRef(person),policy:{sourceId:'policy',sourceVersion:'test-v1',ruleProfileId:'npb',kind:'accepted_original_live_ball_action_v1'}};
  const play:any={sourceId:'play',sourceVersion:'test-v1',capability:'same_pa_initial_play_v1',setupReference:reference(tables.setup,setup),assignmentReference:originalRef(assignment),officialId:'u',personId:'person-u',declaration:'play'};
  const accepted=new Map<string,unknown>([[source.sourceId,source],[venue.sourceId,venue],[person.sourceId,person],[assignment.sourceId,assignment],[play.sourceId,play]]);
  const authority={readAcceptedSetup:(id:string)=>accepted.get(id),readAcceptedVenue:(id:string)=>accepted.get(id),readAcceptedPlay:(id:string)=>accepted.get(id),readAcceptedAssignment:(id:string)=>accepted.get(id),readAcceptedOfficialPerson:(id:string)=>accepted.get(id)};
  const open=(withAuthority=true)=>{const s=openSqliteSamePlateAppearanceInitialBallStore(path,withAuthority?authority:undefined);owners.push(s);return s;};
  return{db,source,setup,play,venue,assignment,person,accepted,open,execute:()=>{executed=true;}};
};
it('accepts setup then separate Play, reopens callback-free and rejects backdated fresh work',()=>{
  const f=fixture(),owner=f.open();expect(owner.acceptSetup('setup')).toEqual(f.setup);const play=owner.acceptPlay('play');expect(play.kind).toBe('same_pa_initial_play_v1');
  f.execute();f.accepted.clear();expect(f.open(false).acceptSetup('setup')).toEqual(f.setup);expect(f.open(false).acceptPlay('play')).toEqual(play);
  const rows=f.db.prepare('SELECT * FROM '+tables.play).all();f.db.exec('DELETE FROM '+tables.play);f.accepted.set('play',f.play);
  // Missing original assignment remains pending and never manufactures Play.
  expect(owner.acceptPlay('play').kind).toBe('pending');
  f.accepted.set('assignment',f.assignment);f.accepted.set('umpire-person',f.person);
  expect(()=>owner.acceptPlay('play')).toThrow('past pre-pitch cut');
  expect(f.db.prepare('SELECT * FROM '+tables.play).all()).toEqual([]);expect(rows).toHaveLength(1);
});
it('cannot repair removed setup with a surviving original Play claim',()=>{
  const f=fixture(),owner=f.open();owner.acceptSetup('setup');owner.acceptPlay('play');f.db.exec('DELETE FROM '+tables.setup);
  expect(()=>owner.acceptSetup('setup')).toThrow(/surviving Play/);expect(f.db.prepare('SELECT * FROM '+tables.setup).all()).toEqual([]);
});
it('rejects mutated accepted venue and moved metadata without rewriting saved evidence',()=>{
  const f=fixture(),owner=f.open();owner.acceptSetup('setup');const row=f.db.prepare('SELECT * FROM '+tables.setup).get();
  f.accepted.set('venue',{...f.venue,sourceVersion:'changed'});expect(()=>owner.acceptSetup('setup')).toThrow();expect(f.db.prepare('SELECT * FROM '+tables.setup).get()).toEqual(row);
  f.db.prepare('UPDATE '+tables.setup+' SET source_id=?').run('alias');expect(()=>owner.readSetup('setup')).toThrow(/alias/);
});
it('rolls back both fresh namespaces if exact insertion fails',()=>{
  const f=fixture(),owner=f.open(),prototype=DatabaseSync.prototype,original=prototype.prepare;
  vi.spyOn(prototype,'prepare').mockImplementation(function(this:InstanceType<typeof DatabaseSync>,sql:string){if(sql.startsWith('INSERT INTO main.'+tables.setup))throw new Error('injected insert failure');return original.call(this,sql);});
  expect(()=>owner.acceptSetup('setup')).toThrow('injected insert failure');expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name GLOB 'pa_initial_ball_v1_*'").all()).toEqual([]);
});
