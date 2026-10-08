import { expect,it } from 'vitest';
import { SqliteOfficialStateWriter } from '../SqliteOfficialStateWriter';
import { prepareTerminalCompletedCopy } from './ActualFoulTerminalCompletedFixture.test-support';
import { rawCensus,schemaCensus,fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
it('CP-LG01 genuine completed local Match decoding survives the shared raw rejection census',()=>{
 const f=prepareTerminalCompletedCopy();try{
  const before=rawCensus(f.db),schema=schemaCensus(f.db),changes=f.db.prepare('SELECT total_changes() AS n').get();
  const row=f.db.prepare('SELECT game_id,result_json FROM actual_foul_terminal_applications WHERE source_id=?').get(f.sourceId)!;
  const expected=JSON.parse(String(row.result_json));let error:unknown,result:ReturnType<SqliteOfficialStateWriter['getMatch']>|undefined;
  try{result=new SqliteOfficialStateWriter(f.db).getMatch(String(row.game_id));}catch(caught){error=caught;}
  expect(error,'GENUINE_COMPLETED_LOCAL_CENSUS_REJECTED').toBeUndefined();
  expect(result?.activation).toEqual(expected.completion.activation);expect(result?.nextWorld).toEqual(expected.completion.nextWorld);
  expect(result?.durableRevision).toBe(expected.official.receipt.durableRevision);expect(result?.matchState).toEqual(expected.official.receipt.appliedMatchState);
  expect(result?.pendingPostPlay).toBeUndefined();expect(rawCensus(f.db)).toEqual(before);expect(schemaCensus(f.db)).toEqual(schema);
  expect(f.db.prepare('SELECT total_changes() AS n').get()).toEqual(changes);expect(fileHash(f.input.artifact.path)).toBe(f.input.artifact.sha256);
 }finally{f.db.close();}
},120_000);
