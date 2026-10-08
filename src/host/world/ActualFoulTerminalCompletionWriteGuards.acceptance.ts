import { expect,it } from 'vitest';
import { prepareTerminalCompletionCopy } from './ActualFoulTerminalCompletionFixture.test-support';
import { openSqliteActualFoulTerminalApplicationRunner } from './SqliteActualFoulTerminalApplicationRunner';
import { rawCensus,schemaCensus,fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
const run=(kind:'accepted_source'|'owned_result'|'unrelated_head')=>{
 const f=prepareTerminalCompletionCopy();let runner:ReturnType<typeof openSqliteActualFoulTerminalApplicationRunner>|undefined;
 try{
  const before=rawCensus(f.db),schema=schemaCensus(f.db),original=JSON.parse(String(f.db.prepare('SELECT proposal_json FROM actual_foul_terminal_applications WHERE source_id=?').get(f.sourceId)!.proposal_json));
  const actors=original.participants.map((p:{binding:{careerId:string;playerId:string}})=>p.binding);
  const unrelated=f.db.prepare('SELECT career_id,player_id,revision FROM world_player_workload_heads').all()
   .find(h=>!actors.some((a:{careerId:string;playerId:string})=>a.careerId===h.career_id&&a.playerId===h.player_id));
  if(kind==='unrelated_head')expect(unrelated,'genuine retained unrelated workload head is required').toBeDefined();
  let writes=0,fired=false,alter=true;
  runner=openSqliteActualFoulTerminalApplicationRunner(f.path,{readAcceptedPostPlaySetup:()=>{
   if(kind==='accepted_source'&&alter&&writes===3){fired=true;return {...f.source,sourceVersion:f.source.sourceVersion+'-changed-after-write'};}return f.source;
  }});
  const witness=witnessSqliteWrite(/UPDATE main\.(?:applications|matches|actual_foul_terminal_applications)\b/,writer=>{
   writes++;expect(writer.isTransaction).toBe(true);
   if(!fired&&kind==='owned_result'&&writes===3){fired=true;
    writer.prepare("UPDATE actual_foul_terminal_applications SET result_json=json_set(result_json,'$.completion.source.sourceVersion','injected-corruption') WHERE source_id=?").run(f.sourceId);
   }
   if(!fired&&kind==='unrelated_head'&&writes===1){fired=true;
    writer.prepare('UPDATE world_player_workload_heads SET revision=revision+1 WHERE career_id=? AND player_id=?').run(unrelated!.career_id,unrelated!.player_id);
   }
   return true;
  });
  try{expect(()=>runner!.completePostPlay(f.source.sourceId)).toThrow(/changed|differ|completion|archive|hash|write accounting/i);
   expect(witness.wasReached()).toBe(true);expect(fired).toBe(true);expect(writes).toBe(3);
  }finally{witness.close();alter=false;runner.close();runner=undefined;}
  expect(rawCensus(f.db)).toEqual(before);expect(schemaCensus(f.db)).toEqual(schema);
  runner=openSqliteActualFoulTerminalApplicationRunner(f.path);expect(runner.read(f.sourceId)?.status).toBe('OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY');
  expect(rawCensus(f.db)).toEqual(before);expect(fileHash(f.input.artifact.path)).toBe(f.input.artifact.sha256);
 }finally{runner?.close();f.db.close();}
};
it('CP-F09 changed accepted setup after all three actual writes rolls the complete transaction back',()=>run('accepted_source'),1_100_000);
it('CP-F10 owned completion corruption after the third actual UPDATE rolls all mirrors back',()=>run('owned_result'),1_100_000);
it('CP-F11 unrelated retained workload corruption after an actual UPDATE is rejected and rolled back',()=>run('unrelated_head'),1_100_000);
