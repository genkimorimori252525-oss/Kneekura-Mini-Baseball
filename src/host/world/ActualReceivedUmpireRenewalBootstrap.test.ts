import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
// Only the original-owner derivation is isolated. Native schema, transactions,
// callback ordering and pre-DDL claim discovery are real; no genuine-root credit.
vi.mock('./ActualReceivedUmpireDefenderEvidence',()=>({receivedEnrollmentEvidenceFromSqlite:()=>({
  derive:(source:unknown)=>({value:{source,gameId:'game-a',playId:1}}),qualifyCurrent:()=> 'original-open',
})}));
import { openSqliteActualReceivedUmpireDefenderEnrollmentStore } from './SqliteActualReceivedUmpireDefenderEnrollmentStore';
const { DatabaseSync }=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const source={sourceId:'old-enrollment',sourceVersion:'fixture-v1',capability:'received_umpire_defender_enrollment_v1' as const,runtimeSourceId:'runtime-a',physicalPitchSourceId:'pitch-a',playerId:'player-a',observationSourceId:'observation-a',currentExecutionSourceId:'execution-a',predecessorDecisionSourceId:'decision-a',predecessorMotorSourceId:'motor-a',predecessorAdoptionSourceId:'adoption-a'};
const run=(duringBegin:boolean)=>{
  const directory=mkdtempSync(join(tmpdir(),'received-renewal-bootstrap-')),path=join(directory,'state.sqlite'),peer=new DatabaseSync(path),store=openSqliteActualReceivedUmpireDefenderEnrollmentStore(path,{readAcceptedEnrollment:()=>source});
  const exec=DatabaseSync.prototype.exec;let createdOld=false,injected=false;
  const inject=()=>{peer.exec("CREATE TABLE actual_received_umpire_renewal_heads(source_id TEXT); INSERT INTO actual_received_umpire_renewal_heads VALUES('survivor')");injected=true;};
  try{
    if(!duringBegin)inject();
    DatabaseSync.prototype.exec=function(this:InstanceType<typeof DatabaseSync>,sql:string){
      if(duringBegin&&!injected&&sql==='BEGIN IMMEDIATE')inject();
      if(sql.startsWith('CREATE TABLE actual_received_umpire_defender_'))createdOld=true;
      return exec.call(this,sql);
    };
    expect(()=>store.accept(source.sourceId)).toThrow();
    expect(createdOld,'RENEWAL_ORPHAN_BOOTSTRAPPED_OLD_FAMILY').toBe(false);
    expect(peer.prepare("SELECT name FROM sqlite_master WHERE name GLOB 'actual_received_umpire_defender_*'").all()).toEqual([]);
    expect(peer.prepare('SELECT * FROM actual_received_umpire_renewal_heads').all()).toEqual([{source_id:'survivor'}]);
  }finally{DatabaseSync.prototype.exec=exec;store.close();peer.close();rmSync(directory,{recursive:true});}
};
it('RB01 rejects a renewal orphan before old enrollment bootstrap is attempted',()=>run(false));
it('RB02 repeats union census inside the transaction before old bootstrap DDL',()=>run(true));
