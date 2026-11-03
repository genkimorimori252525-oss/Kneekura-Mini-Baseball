import {afterEach,expect,it,vi} from 'vitest';
import {practiceFixture} from './PitchPracticeAttempt.test-support';
import {readNativePitchPracticeAttemptFromSqlite as read} from './NativePitchPracticeEvidenceFromSqlite';
import {withNativeDevelopmentReadPhaseV126 as phase} from './NativeDevelopmentReadPhaseV126';
const cleanup:(()=>void)[]=[];
afterEach(()=>{while(cleanup.length)cleanup.pop()!();});

it('shares only a completed Native attempt, distinguishes timing ceilings and discards it after the proof section',async()=>{
 const f=await practiceFixture(cleanup);f.opportunities.set(f.opportunity.sourceId,{...f.opportunity,episode:null});
 const begun=f.owner.begin(f.opportunity.sourceId),db=f.db;db.exec('BEGIN');const trace=vi.spyOn(db,'prepare');
 const reads=()=>trace.mock.calls.filter(([sql])=>sql==='SELECT * FROM pitch_practice_attempts WHERE attempt_id=?').length;
 try{
  phase(db,()=>{const first=read(db,begun.attemptId),second=read(db,begun.attemptId);
   expect(reads()).toBe(1);expect(second).toBe(first);expect(first).toEqual(begun);expect(Object.isFrozen(first!.frame)).toBe(true);
   expect(read(db,begun.attemptId,0)).toEqual(begun);expect(reads()).toBe(2);});
  phase(db,()=>expect(read(db,begun.attemptId)).toEqual(begun));expect(reads()).toBe(3);
 }finally{trace.mockRestore();db.exec('ROLLBACK');}
});

it('poisons cached Native attempt proof on an attached owner or database mutation, while a new snapshot reauthenticates originals',async()=>{
 const f=await practiceFixture(cleanup);f.opportunities.set(f.opportunity.sourceId,{...f.opportunity,episode:null});
 const begun=f.owner.begin(f.opportunity.sourceId),db=f.db;db.exec('BEGIN');
 try{
  expect(()=>phase(db,()=>{read(db,begun.attemptId);db.exec("ATTACH ':memory:' AS foreign_owner");expect(()=>read(db,begun.attemptId)).toThrow();
   db.exec('DETACH foreign_owner');expect(()=>read(db,begun.attemptId)).toThrow(/expired/);})).toThrow(/expired/);
  expect(()=>phase(db,()=>{read(db,begun.attemptId);db.exec("PRAGMA query_only=0;UPDATE world_pitch_timing_baselines SET initial_json='{}';PRAGMA query_only=1");
   return read(db,begun.attemptId);})).toThrow();
 }finally{db.exec('ROLLBACK');}
 db.exec('BEGIN');try{expect(phase(db,()=>read(db,begun.attemptId))).toEqual(begun);}finally{db.exec('ROLLBACK');}
});
