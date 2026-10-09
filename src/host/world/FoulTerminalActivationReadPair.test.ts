import {beforeEach,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
import type {DatabaseSync as Database} from 'node:sqlite';
// Structural Native dispatch fixture: original completion/physical proofs are
// deliberately mocked. Readiness membership, metadata census and real Native
// transaction/query-only/savepoint guards execute normally; no genuine credit.
const observed=vi.hoisted(()=>({values:new WeakMap<object,any>(),counts:new WeakMap<object,number>(),hook:null as null|((db:Database)=>void),reject:false}));
vi.mock('./ActualFoulTerminalPostPlayCompletionEvidenceFromSqlite',()=>({foulTerminalPostPlayCompletionEvidenceFromSqlite:(db:Database)=>{
 const read=()=>{observed.counts.set(db,(observed.counts.get(db)??0)+1);if(observed.reject)throw new Error('original completion rejected');observed.hook?.(db);return observed.values.get(db);};
 return{read:()=>read()?.archive??null,readWithEffects:()=>read()??null};
}}));
import {readFoulTerminalPhysicalActivation,assertFoulTerminalPhysicalActivationCurrent} from './FoulTerminalNextPlayReadiness';
import {readPriorFoulTerminalActivationReadiness} from './ActualLivePlayClosureEvidenceFromSqlite';
import {actorJson as json} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')as typeof import('node:sqlite');
beforeEach(()=>{observed.values=new WeakMap();observed.counts=new WeakMap();observed.hook=null;observed.reject=false;});
const fixture=()=>{
 const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE applications(application_id TEXT,match_id TEXT,result_json TEXT,closure_id TEXT,request_hash TEXT);
 CREATE TABLE matches(match_id TEXT,durable_revision INTEGER,state_json TEXT,activation_json TEXT);
 CREATE TABLE actual_live_play_runtimes(game_id TEXT,play_id INTEGER);
 CREATE TABLE actual_foul_play_ends(source_id TEXT,game_id TEXT,play_id INTEGER);
 CREATE TABLE actual_live_play_closures(source_id TEXT,game_id TEXT,play_id INTEGER,application_id TEXT,status TEXT,source_json TEXT,source_hash TEXT,proposal_json TEXT,proposal_hash TEXT,result_json TEXT);
 CREATE TABLE actual_foul_terminal_applications(source_id TEXT,game_id TEXT,play_id INTEGER,application_id TEXT,status TEXT,source_json TEXT,proposal_json TEXT,result_json TEXT,physical_pitch_source_id TEXT,physical_end_source_id TEXT,official_obligation_key TEXT,source_hash TEXT,proposal_hash TEXT);
 CREATE TABLE pair_probe(value INTEGER);INSERT INTO pair_probe VALUES(0);`);
 const official={receipt:{applicationId:'app',previousPlayId:1,durableRevision:1},activation:{previousPlayId:1,nextMatchState:{playId:2}},nextWorld:{tick:2}};
 const participants=Array.from({length:10},(_,i)=>({binding:{playerId:'p'+i,careerId:'career',gameDay:7,clubId:i?'home':'away',personLinkSourceId:'link'+i},person:{personId:'person'+i}}));
 const settlement={kind:'complete',careerId:'career',gameId:'game',playId:1,gameDay:7,participants:participants.map(p=>({playerId:p.binding.playerId,personId:p.person.personId,clubId:p.binding.clubId,applied:true,after:{playerId:p.binding.playerId,careerId:'career',revision:1,effectiveDay:7}}))};
 const completion={source:{sourceId:'setup'},completionId:json(['actual_foul_terminal_post_play_completion_v1','terminal','setup']),snapshotHash:'a'.repeat(64),officialReference:{applicationId:'app'},activation:official.activation,nextWorld:official.nextWorld};
 const archive={source:{sourceId:'terminal',applicationId:'app'},proposal:{gameId:'game',playId:1,participants},status:'POST_PLAY_COMPLETED_CONTINUING',result:{official,completion}};
 db.prepare('INSERT INTO applications(application_id,match_id,result_json) VALUES(?,?,?)').run('app','game',json(official));
 db.prepare('INSERT INTO actual_foul_terminal_applications(source_id,game_id,play_id,application_id,status,source_json,proposal_json,result_json) VALUES(?,?,?,?,?,?,?,?)').run('terminal','game',1,'app',archive.status,json(archive.source),json(archive.proposal),json(archive.result));
 db.prepare('INSERT INTO actual_foul_play_ends VALUES(?,?,?)').run('end','game',1);observed.values.set(db,{archive,settlement});
 const activate=()=>readFoulTerminalPhysicalActivation(db,'game','app');
 const owned=()=>{db.exec('BEGIN');try{const result=activate();db.exec('COMMIT');return result;}catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}};
 return{db,activate,owned,count:()=>observed.counts.get(db)??0,reset:()=>observed.counts.set(db,0),close:()=>{if(db.isTransaction)db.exec('ROLLBACK');db.close();}};
};
it('FT-R01 authenticates target completion once inside the owned activation with identical returned bytes',()=>{
 const f=fixture();try{const expected=json(f.activate());expect(f.count()).toBe(2);f.reset();const rows=json(f.db.prepare('SELECT * FROM applications').all());expect(json(f.owned())).toBe(expected);expect(json(f.db.prepare('SELECT * FROM applications').all())).toBe(rows);expect(f.count(),'TERMINAL_COMPLETION_REPLAY_DUPLICATED').toBe(1);}finally{f.close();}
});
it('FT-R02 does not reuse completed readiness across operations or connections',()=>{
 const a=fixture(),b=fixture();try{a.owned();a.owned();b.owned();expect([a.count(),b.count()],'TERMINAL_COMPLETION_REPLAY_DUPLICATED').toEqual([2,1]);observed.reject=true;expect(()=>a.owned()).toThrow(/original completion rejected/);}finally{a.close();b.close();}
});
it('FT-R03 rejects a real mutate-and-restore during the completed target handoff',()=>{
 const f=fixture();try{let writes=0;observed.hook=db=>{if(writes)return;const prior=db.prepare('PRAGMA query_only').get()!.query_only;db.exec('PRAGMA query_only=OFF');db.exec('UPDATE pair_probe SET value=1;UPDATE pair_probe SET value=0');writes=2;db.exec('PRAGMA query_only='+prior);};expect(()=>f.owned()).toThrow();expect(writes).toBe(2);expect(f.db.prepare('SELECT value FROM pair_probe').get()!.value).toBe(0);}finally{f.close();}
});
it('FT-R04 rejects rollback and replacement of the owned transaction despite unchanged counters',()=>{
 const f=fixture();try{let replaced=0;observed.hook=db=>{if(replaced)return;db.exec('ROLLBACK;BEGIN;PRAGMA query_only=ON');replaced++;};expect(()=>f.owned()).toThrow();expect(replaced).toBe(1);}finally{f.close();}
});
it('FT-R05 keeps current write-admission freshness separate from the historical target pair',()=>{
 const f=fixture();try{const activation=f.owned()!;observed.reject=true;expect(()=>assertFoulTerminalPhysicalActivationCurrent(f.db,activation.readinessReference,'game',2)).toThrow(/original completion rejected/);expect(f.db.isTransaction).toBe(false);expect(f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);}finally{f.close();}
});
it('FT-R06 still authenticates the complete prior-scope census after the target is ready',()=>{
 const f=fixture();try{f.db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?)').run('game',0);expect(()=>f.owned()).toThrow(/missing|ambiguous/);expect(f.count()).toBeGreaterThan(0);}finally{f.close();}
});
it('FT-R07 preserves the unpaired path without an active owned Native frame',()=>{
 const f=fixture();try{f.db.exec('BEGIN');expect(readPriorFoulTerminalActivationReadiness(f.db,'app')).not.toBeNull();expect(f.count()).toBe(2);f.db.exec('ROLLBACK');expect(f.activate()).not.toBeNull();expect(f.count()).toBe(4);}finally{f.close();}
});
