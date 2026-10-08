import { createRequire } from 'node:module';
import { expect,it } from 'vitest';
import { prepareTerminalCompletedCopy } from './ActualFoulTerminalCompletedFixture.test-support';
import { foulTerminalPostPlayCompletionEvidenceFromSqlite } from './ActualFoulTerminalPostPlayCompletionEvidenceFromSqlite';
import { readPhysicalClosureScoringHistory,closureHash } from './PhysicalPlayClosureEvidenceFromSqlite';
import { rawCensus,schemaCensus,fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
it('CP-H01 genuine completed terminal supplies authenticated contiguous scoring history without writes or repair',()=>{
 const f=prepareTerminalCompletedCopy();let expected:ReturnType<typeof readPhysicalClosureScoringHistory>|undefined;
 try{
  const before=rawCensus(f.db),schema=schemaCensus(f.db),changes=f.db.prepare('SELECT total_changes() AS n').get();
  withSqliteReadTransaction(f.db,()=>{
   const saved=foulTerminalPostPlayCompletionEvidenceFromSqlite(f.db).read(f.sourceId);expect(saved).not.toBeNull();if(!saved)throw new Error('genuine completion missing');
   const p=saved.proposal,c=saved.result.completion,receipt=saved.result.official.receipt;
   const row=f.db.prepare('SELECT * FROM applications WHERE application_id=?').get(p.source.applicationId)!;
   const score=f.db.prepare('SELECT * FROM official_scoring_applications WHERE scoring_application_id=?').get(c.scoringReference.scoringApplicationId)!;
   expect(closureHash(score)).toBe(c.scoringReference.rowHash);
   let error:unknown;try{expected=readPhysicalClosureScoringHistory(f.db,{gameId:p.gameId,officialRevision:receipt.durableRevision});}catch(caught){error=caught;}
   expect(error,'COMPLETED_TERMINAL_SCORING_HISTORY_MISSING').toBeUndefined();expect(expected).toHaveLength(receipt.durableRevision);
   expect(expected!.at(-1)).toEqual({applicationId:p.source.applicationId,scoringApplicationId:c.scoringReference.scoringApplicationId,
    before:p.applicationBody.match,after:receipt.appliedMatchState,scoring:JSON.parse(String(score.result_json)),closureRowHash:closureHash(row),scoringRowHash:closureHash(score)});
  });
  expect(rawCensus(f.db)).toEqual(before);expect(schemaCensus(f.db)).toEqual(schema);expect(f.db.prepare('SELECT total_changes() AS n').get()).toEqual(changes);
 }finally{f.db.close();}
 const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')as typeof import('node:sqlite');const reopened=new DatabaseSync(f.path);
 try{const before=rawCensus(reopened),changes=reopened.prepare('SELECT total_changes() AS n').get();
  const last=expected!.at(-1)!;expect(withSqliteReadTransaction(reopened,()=>readPhysicalClosureScoringHistory(reopened,{gameId:last.scoring.matchId,officialRevision:expected!.length}))).toEqual(expected);
  expect(rawCensus(reopened)).toEqual(before);expect(reopened.prepare('SELECT total_changes() AS n').get()).toEqual(changes);
 }finally{reopened.close();}
 expect(fileHash(f.input.artifact.path)).toBe(f.input.artifact.sha256);
},1_100_000);
