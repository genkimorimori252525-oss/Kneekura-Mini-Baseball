import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { expect,it } from 'vitest';
const load=async()=>{
  expect(existsSync(new URL('./ActualReceivedUmpireContinuation.ts',import.meta.url)),'RECEIVED_POSITIVE_CONTINUATION_MISSING').toBe(true);
  return import('./ActualReceivedUmpireContinuation');
};
const source={sourceId:'continue-12',sourceVersion:'fixture-v1',baseFieldSourceId:'field-a',previousExecutionSourceId:'adoption-11',
  action:{kind:'received_renewal_continuation_v1' as const,renewalEnrollmentSourceId:'renewal-a',renewalAdoptionSourceId:'adoption-11'}};
it('RC01 accepts only versioned references and rejects commands or a rebound predecessor',async()=>{
  const m=await load();expect(m.receivedContinuationInput(source)).toEqual(source);
  expect(()=>m.receivedContinuationInput({...source,action:{...source.action,throughTick:20}} as never)).toThrow();
  expect(()=>m.receivedContinuationInput({...source,previousExecutionSourceId:'elsewhere'})).toThrow();
  expect(()=>m.receivedContinuationInput({...source,sourceVersion:''})).toThrow();
});
it('RC02 derives the earliest accepted coverage or authentic pending-work boundary',async()=>{
  const m=await load(),at={originTick:100,elapsedSeconds:0.2,tick:102,ticksPerSecond:10};
  expect(m.receivedContinuationBound(at,120,[null,108,null])).toBe(108);
  expect(m.receivedContinuationBound(at,106,[null,108])).toBe(106);
  expect(()=>m.receivedContinuationBound(at,120,[102])).toThrow(/due|progress/);
  expect(()=>m.receivedContinuationBound({...at,elapsedSeconds:0.20001},120,[])).toThrow(/exact|integer/);
});
it('RC03 schema inspection is inert and rejects case aliases without repair',async()=>{
  await load();const m=await import('./ActualReceivedUmpireContinuationSchema');
  const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new DatabaseSync(':memory:');
  try{expect(m.receivedContinuationSchema(db)).toBe('pristine');expect(db.prepare('SELECT count(*) AS n FROM sqlite_master').get()!.n).toBe(0);
    db.exec('CREATE TABLE ACTUAL_RECEIVED_UMPIRE_CONTINUATIONS(source_id TEXT)');
    expect(()=>m.receivedContinuationSchema(db)).toThrow(/schema/);expect(db.prepare('SELECT name FROM sqlite_master').get()!.name).toBe('ACTUAL_RECEIVED_UMPIRE_CONTINUATIONS');
  }finally{db.close();}
});
it('RC04 a continuation-only moved reference fences its original play without old-family repair',async()=>{
  await load();const m=await import('./ActualReceivedUmpireContinuationSchema'),claims=await import('./ActualReceivedUmpireDefenderClaims');
  const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new DatabaseSync(':memory:');
  try{db.exec('BEGIN');m.installReceivedContinuationSchema(db);db.exec('COMMIT');
    db.exec('CREATE TABLE physical_pitch_progress_actions(source_id TEXT,game_id TEXT,play_id INTEGER)');
    db.prepare('INSERT INTO physical_pitch_progress_actions VALUES(?,?,?)').run('pitch-a','game-a',1);
    db.prepare('INSERT INTO actual_received_umpire_continuations VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('continue-12','fixture-v1','moved-game',9,'pitch-a','player-a','renewal-a','adoption-11',12,'source-hash','snapshot-hash','receipt-hash');
    expect(()=>claims.assertNoReceivedDefenderClaims(db,{gameId:'game-a',playId:1})).toThrow(/pending|ownership/);
    expect(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name LIKE 'actual_received_umpire_defender_%'").get()!.n).toBe(0);
  }finally{db.close();}
});
