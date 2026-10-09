import {createRequire} from 'node:module';
import {expect,it,vi} from 'vitest';
import {actorHash as hash} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
// Authenticated immutable envelope and legacy closure are explicit seams. The
// new current-head query is real Native SQL; old current readers must stay out.
vi.mock('./SqliteBattedWorldFieldStore',()=>({battedWorldFieldEvidenceFromSqlite:()=>({current:()=>{}})}));
vi.mock('./SqliteBattedWorldFieldExecutionStore',()=>({battedWorldFieldExecutionEvidenceFromSqlite:()=>({current:()=>{throw new Error('OLD_PHYSICAL_CURRENT_FORBIDDEN');}})}));
vi.mock('./SqliteActualFieldObservationStore',()=>({actualFieldObservationEvidenceFromSqlite:()=>({current:()=>{throw new Error('OLD_OBSERVATION_CURRENT_FORBIDDEN');}})}));
vi.mock('./ActualReceivedUmpireDefenderEvidence',()=>({receivedLegacyAdmissionPrefix:()=>Array.from({length:24},(_,i)=>i)}));
vi.mock('./ActualLivePlayFence',()=>({actualLivePlayExtensionOpenState:()=> 'original-open'}));
import {receivedRenewalEnrollmentEvidenceFromSqlite} from './ActualReceivedUmpireRenewalEvidence';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fixture=()=>{
  const db=new DatabaseSync(':memory:');db.exec("CREATE TABLE actual_field_observation_heads(physical_pitch_source_id TEXT,player_id TEXT,source_id TEXT,revision INTEGER); INSERT INTO actual_field_observation_heads VALUES('pitch','player','observation',3); CREATE TABLE actual_received_umpire_defender_replan_heads(enrollment_source_id TEXT,source_id TEXT,revision INTEGER,origin_process_source_id TEXT); INSERT INTO actual_received_umpire_defender_replan_heads VALUES('received','r2',2,'r1'); CREATE TABLE actual_defensive_decision_heads(physical_pitch_source_id TEXT,player_id TEXT,source_id TEXT,revision INTEGER); INSERT INTO actual_defensive_decision_heads VALUES('pitch','player','decision',1);");
  const own=receivedRenewalEnrollmentEvidenceFromSqlite(db),original={value:{physicalPitchSourceId:'pitch',playerId:'player',runtimeSourceId:'runtime',receivedEnrollmentSourceId:'received',receivedReplanSourceId:'r2',originProcessSourceId:'r1',
    anchor:{decision:{sourceId:'decision',revision:1},legacyAdmissionPrefix:{count:24,digest:hash(Array.from({length:24},(_,i)=>i))}}},baseField:{},execution:{},observation:{source:{sourceId:'observation'},revision:3}} as Parameters<typeof own.qualifyNonPhysicalCurrent>[0];
  return {db,own,original};
};
it('RC01 qualifies the conserved observation head without revisiting its old physical current cut',()=>{
  const f=fixture();try{expect(()=>f.own.qualifyNonPhysicalCurrent(f.original),'OLD_OBSERVATION_CURRENT_REENTERED').not.toThrow();expect(f.own.qualifyNonPhysicalCurrent(f.original)).toBe('original-open');
    expect(()=>f.own.qualifyCurrent(f.original)).toThrow('OLD_PHYSICAL_CURRENT_FORBIDDEN');}finally{f.db.close();}
});
it('RC02 rejects an advanced or moved observation head after immutable authentication',()=>{
  const f=fixture();try{for(const sql of ["UPDATE actual_field_observation_heads SET revision=4","UPDATE actual_field_observation_heads SET physical_pitch_source_id='foreign'"]){f.db.exec('BEGIN');f.db.exec(sql);expect(()=>f.own.qualifyNonPhysicalCurrent(f.original)).toThrow(/current observation head differs/);f.db.exec('ROLLBACK');}}finally{f.db.close();}
});
