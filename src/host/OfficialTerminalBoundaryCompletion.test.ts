import {createRequire} from 'node:module';
import {foulTerminalFinalCompletionTableSql} from './world/ActualFoulTerminalApplicationStorage';
import {SqliteOfficialStateWriter} from './SqliteOfficialStateWriter';
import {readFoulTerminalCompletionMirrors,foulTerminalCompletionMatchEnvelope} from './OfficialTerminalPostPlayCompletion';
import { expect,it } from 'vitest';
import { boundaryFixture } from './world/ActualFoulTerminalBoundaryFixtures.test-support';
import { validateFoulTerminalCompletionWire,foulTerminalCompletedOfficial } from './OfficialTerminalPostPlayCompletion';
import { actorHash as hash,actorJson as json } from './world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
const reseal=(c:any)=>{const {snapshotHash,...payload}=c;return {...payload,snapshotHash:hash(payload)};};
it('BF-W01 validates both exact structural boundary arms preserving original receipts',()=>{
 for(const kind of ['half_change_continuing','game_final']as const){const f=boundaryFixture(kind),c=validateFoulTerminalCompletionWire(f.completion,f.proposal,f.original);
 expect(c).toEqual(f.completion);const result=foulTerminalCompletedOfficial(f.original.official,c);expect(result.receipt).toEqual(f.original.official.receipt);expect(result.pendingPostPlay).toEqual(f.original.official.pendingPostPlay);
 expect(Object.keys(result).sort()).toEqual((kind==='game_final'?['receipt','pendingPostPlay','completion','finalResult']:['receipt','pendingPostPlay','completion','activation','nextWorld']).sort());}
});
it('BF-W02 rejects self history final activation surplus and noncanonical output hashes',()=>{
 const f=boundaryFixture('game_final');for(const patch of [{activation:{}},{nextWorld:{}},{incomingDefenders:[]},{scoringHistoryReference:{throughDurableRevision:1,earlier:[]}},{snapshotHash:'a'.repeat(64)}]){
 const c={...f.completion,...patch};expect(()=>validateFoulTerminalCompletionWire('snapshotHash'in patch?c:reseal(c),f.proposal,f.original)).toThrow();}
 const c=structuredClone(f.completion);c.controllerRetirement.nextPlayId=8;expect(()=>validateFoulTerminalCompletionWire(reseal(c),f.proposal,f.original)).toThrow();
});
it('BF-W03 rejects half membership disorder duplicate Persons and false finality',()=>{
 const f=boundaryFixture();for(const mutate of [(c:any)=>c.incomingDefenders.reverse(),(c:any)=>c.incomingDefenders[1].personId=c.incomingDefenders[0].personId,(c:any)=>c.incomingDefenders.pop(),(c:any)=>c.source.kind='game_final']){
 const c=structuredClone(f.completion);mutate(c);expect(()=>validateFoulTerminalCompletionWire(reseal(c),f.proposal,f.original)).toThrow();}
 expect(json(f.original.official.receipt)).toContain('"half":"bottom"');
});

const local=(kind:'half_change_continuing'|'game_final',body:(db:InstanceType<(typeof import('node:sqlite'))['DatabaseSync']>,f:ReturnType<typeof boundaryFixture>)=>void)=>{
 const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');const db=new DatabaseSync(':memory:');
 try{const f=boundaryFixture(kind),p=f.proposal,c=f.completion,official=foulTerminalCompletedOfficial(f.original.official,c);
 db.exec(foulTerminalFinalCompletionTableSql+`;PRAGMA user_version=3;CREATE TABLE matches(match_id TEXT PRIMARY KEY,durable_revision INTEGER NOT NULL,state_json TEXT NOT NULL,activation_json TEXT);
 CREATE TABLE applications(application_id TEXT PRIMARY KEY,match_id TEXT NOT NULL,closure_id TEXT NOT NULL,request_hash TEXT NOT NULL,result_json TEXT NOT NULL,UNIQUE(match_id,closure_id));`);
 db.prepare('INSERT INTO actual_foul_terminal_applications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run('terminal','game',7,'apply','pitch','end','obligation',kind==='game_final'?'POST_PLAY_COMPLETED_FINAL':'POST_PLAY_COMPLETED_CONTINUING',json(p.source),hash(p.source),json(p),hash(p),json({...f.original,completion:c}));
 db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('apply','game','terminal',f.original.official.pendingPostPlay.requestHash,json(official));
 db.prepare('INSERT INTO matches VALUES(?,?,?,?)').run('game',1,json(f.original.official.receipt.appliedMatchState),json(foulTerminalCompletionMatchEnvelope(c)));body(db,f);
 }finally{db.close();}
};
it('BF-W04 local mirrors dispatch exact final versus half envelopes without mutation',()=>{
 for(const kind of ['game_final','half_change_continuing']as const)local(kind,(db,f)=>{
  const before=db.prepare('SELECT total_changes() AS n').get();expect(readFoulTerminalCompletionMirrors(db,'terminal',true).archive.result.completion).toEqual(f.completion);
  const match=new SqliteOfficialStateWriter(db).getMatch('game')!;expect(match.activation===null).toBe(kind==='game_final');expect(match.nextWorld===null).toBe(kind==='game_final');
  expect(match.finalResult).toEqual(kind==='game_final'?f.completion.finalResult:null);expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(before);
 });
});
it('BF-W05 final historical local reads reject a later Match revision and wrong status',()=>local('game_final',(db)=>{
 db.prepare('UPDATE matches SET durable_revision=2').run();expect(()=>readFoulTerminalCompletionMirrors(db,'terminal')).toThrow();
 db.prepare('UPDATE matches SET durable_revision=1').run();db.prepare("UPDATE actual_foul_terminal_applications SET status='POST_PLAY_COMPLETED_CONTINUING'").run();expect(()=>readFoulTerminalCompletionMirrors(db,'terminal')).toThrow();
}));
it('BF-W06 discovers final game and retirement scope when every cached owner identity is damaged',()=>local('game_final',(db)=>{
 db.exec('DELETE FROM applications');db.prepare('UPDATE actual_foul_terminal_applications SET source_id=?,game_id=?,application_id=?,play_id=?,source_json=?,proposal_json=?,result_json=?').run('foreign','foreign','foreign',99,'{}','{}',JSON.stringify({completion:{finalResult:{gameId:'game'},controllerRetirement:{previousPlayId:7}}}));
 expect(()=>new SqliteOfficialStateWriter(db).getMatch('game'),'FINAL_GAME_SCOPE_DISCOVERY_MISSING').toThrow();
}));
it('BF-W07 a Native case alias cannot masquerade as an absent terminal owner before final fallback',()=>local('game_final',(db)=>{
 db.exec('DELETE FROM applications;ALTER TABLE actual_foul_terminal_applications RENAME TO alias_temp;ALTER TABLE alias_temp RENAME TO ACTUAL_FOUL_TERMINAL_APPLICATIONS');
 expect(()=>new SqliteOfficialStateWriter(db).getMatch('game'),'FINAL_CASE_ALIAS_DISCOVERY_MISSING').toThrow();
}));
it('BF-W08 an empty temp Match shadow cannot hide a durable final terminal',()=>local('game_final',(db)=>{
 db.exec('CREATE TEMP TABLE matches(match_id TEXT,durable_revision INTEGER,state_json TEXT,activation_json TEXT)');
 expect(()=>new SqliteOfficialStateWriter(db).getMatch('game'),'FINAL_EMPTY_TEMP_MATCH_SHADOW_ACCEPTED').toThrow();
}));
