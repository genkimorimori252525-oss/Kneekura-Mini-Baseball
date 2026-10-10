import {createRequire} from 'node:module';
import {expect,it,vi} from 'vitest';
import * as completion from './ActualFoulTerminalPostPlayCompletionEvidenceFromSqlite';
import * as people from './SqliteOfficialInitialWorldStore';
import * as workload from './ActualRoleWorkloadState';
import {boundaryFixture} from './ActualFoulTerminalBoundaryFixtures.test-support';
import {actorHash as hash} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
// STRUCTURAL MOCKED boundary contracts. Native bindings are real isolated rows;
// Person/workload owner outputs below are substitutes, never genuine qualification.
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const api=()=>{const fn=(completion as any).deriveFoulTerminalIncomingDefenders;expect(typeof fn,'INCOMING_DEFENSE_API_MISSING').toBe('function');return fn as (...args:any[])=>any;};
const fixture=(run:(db:InstanceType<typeof DatabaseSync>,p:any,s:any,states:Map<string,any>)=>void)=>{
 const db=new DatabaseSync(':memory:'),f=boundaryFixture(),p=structuredClone(f.proposal) as any,s=f.completion.source,states=new Map<string,any>();
 Object.assign(p,{fixture:{gameId:'game',venueId:'venue',fixtureEventId:'fixture',fixtureRevision:0},seasonFixture:{careerId:'career',competitionEditionId:'season',game:{gameId:'game',homeClubId:'home',awayClubId:'away',gameDay:1}}});
 p.participants[0].binding={...p.participants[0].binding,careerId:'career',gameDay:1,fixtureEventId:'fixture',competitionEditionId:'season'};
 db.exec('CREATE TABLE official_participant_bindings(game_id TEXT,player_id TEXT,binding_json TEXT)');
 for(const d of s.worldSetup.defenders){const b={gameId:'game',careerId:'career',competitionEditionId:'season',gameDay:1,clubId:'away',side:'AWAY',playerId:d.playerId,personId:'person-'+d.playerId,personLinkSourceId:'link-'+d.playerId,rosterRevision:0,fixtureEventId:'fixture'};
 db.prepare('INSERT INTO official_participant_bindings VALUES(?,?,?)').run('game',d.playerId,JSON.stringify(b));states.set(d.playerId,{careerId:'career',playerId:d.playerId,effectiveDay:1,revision:0});}
 const person=vi.spyOn(people,'readOfficialActorPersonLink').mockImplementation((_db,b)=>({personId:b.personId}as any));
 const state=vi.spyOn(workload,'readActualRoleWorkloadState').mockImplementation((_db,_career,id,revision)=>{const s=states.get(id);if(!s)return null;return revision===undefined?s:{...s,revision};});
 try{run(db,p,s,states);}finally{person.mockRestore();state.mockRestore();db.close();}
};
it('BF-H01 archives incoming opposite-side bindings and historical workload revisions without writes',()=>{
 const derive=api();fixture((db,p,s,states)=>{const before=db.prepare('SELECT total_changes() AS n').get();const refs=derive(db,p,s);expect(refs).toHaveLength(9);
 expect(refs.map((x:any)=>x.playerId)).toEqual(s.worldSetup.defenders.map((x:any)=>x.playerId).sort());expect(refs[0].workloadHash).toBe(hash(states.get(refs[0].playerId)));
 for(const state of states.values())state.revision=2;expect(derive(db,p,s,refs)).toEqual(refs);expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(before);
 });
});
it('BF-H02 rejects wrong side fixture Person identity missing binding and malformed role selection',()=>{
 const derive=api();for(const patch of [{side:'HOME'},{fixtureEventId:'other'},{personId:'person-incoming-1'},{competitionEditionId:'other'},{clubId:'home'},{gameDay:2}])fixture((db,p,s)=>{
 const row=db.prepare('SELECT binding_json FROM official_participant_bindings WHERE player_id=?').get('incoming-0')!;
 db.prepare('UPDATE official_participant_bindings SET binding_json=? WHERE player_id=?').run(JSON.stringify({...JSON.parse(String(row.binding_json)),...patch}),'incoming-0');expect(()=>derive(db,p,s)).toThrow();});
 fixture((db,p,s)=>{db.prepare('DELETE FROM official_participant_bindings WHERE player_id=?').run('incoming-0');expect(()=>derive(db,p,s)).toThrow();});
 fixture((db,p,s)=>{const altered=structuredClone(s);altered.worldSetup.defenders[0].registeredPosition='C';expect(()=>derive(db,p,altered)).toThrow();});
});
it('BF-H03 missing future foreign and changed archived workload fail without initialization',()=>{
 const derive=api();for(const change of [(m:Map<string,any>)=>m.delete('incoming-0'),(m:Map<string,any>)=>m.get('incoming-0').effectiveDay=2,(m:Map<string,any>)=>m.get('incoming-0').careerId='foreign'])fixture((db,p,s,states)=>{change(states);expect(()=>derive(db,p,s)).toThrow();});
 fixture((db,p,s,states)=>{const refs=derive(db,p,s);states.get('incoming-0').effectiveDay=0;expect(()=>derive(db,p,s,refs)).toThrow(/workload/);});
});
it('BF-H04 current readiness permits later authenticated heads and rejects stale or future-day heads',()=>{
 const derive=api(),current=(completion as any).assertFoulTerminalIncomingDefendersCurrent;expect(typeof current,'INCOMING_CURRENT_API_MISSING').toBe('function');
 fixture((db,p,s,states)=>{const refs=derive(db,p,s),c={...boundaryFixture().completion,source:s,incomingDefenders:refs};for(const state of states.values())state.revision=2;expect(()=>current(db,p,c)).not.toThrow();states.get('incoming-0').effectiveDay=2;expect(()=>current(db,p,c)).toThrow();});
});
