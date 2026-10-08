import {createRequire} from 'node:module';
import {expect,it,vi} from 'vitest';
import {boundaryFixture} from './ActualFoulTerminalBoundaryFixtures.test-support';
import * as owner from './ActualFoulTerminalPostPlayCompletionEvidenceFromSqlite';
import {foulTerminalReadinessReference,foulTerminalNextPlayReadinessFromSqlite} from './FoulTerminalNextPlayReadiness';
import {assertNoFoulTerminalNextPlay} from './FoulTerminalNextPlayGuard';
// STRUCTURAL MOCKED readiness consumer tests; no completed physical evidence.
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const ref=(version:string)=>({version,terminalSourceId:'terminal',setupSourceId:'boundary',completionId:'id',snapshotHash:'a'.repeat(64),applicationId:'apply',gameId:'game',previousPlayId:7});
it('BF-R01 readiness accepts only the explicit v1 and v2 exact eight-key references',()=>{
 for(const version of ['actual_foul_terminal_next_play_readiness_v1','actual_foul_terminal_next_play_readiness_v2'])expect(foulTerminalReadinessReference(ref(version)as any)).toEqual(ref(version));
 expect(()=>foulTerminalReadinessReference(ref('other')as any)).toThrow();expect(()=>foulTerminalReadinessReference({...ref('actual_foul_terminal_next_play_readiness_v2'),finalResult:{}}as any)).toThrow();
});
it('BF-R02 final completion is explicitly rejected before actor or pitch readiness',()=>{
 const db=new DatabaseSync(':memory:'),f=boundaryFixture('game_final');const mock=vi.spyOn(owner,'foulTerminalPostPlayCompletionEvidenceFromSqlite').mockReturnValue({readWithEffects:()=>({archive:{source:f.proposal.source,proposal:f.proposal,result:{...f.original,completion:f.completion},status:'POST_PLAY_COMPLETED_FINAL'},settlement:{}})}as any);
 try{const before=db.prepare('SELECT total_changes() AS n').get();expect(()=>foulTerminalNextPlayReadinessFromSqlite(db).readHistorical('terminal')).toThrow(/final/);expect(()=>foulTerminalNextPlayReadinessFromSqlite(db).read('terminal')).toThrow(/final/);expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(before);}finally{mock.mockRestore();db.close();}
});
it('BF-R03 malformed final marker cannot obtain the continuing-only admission permit',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec('CREATE TABLE applications(application_id TEXT,match_id TEXT,result_json TEXT)');
 db.prepare('INSERT INTO applications VALUES(?,?,?)').run('apply','game',JSON.stringify({receipt:{previousPlayId:7},completion:{version:'actual_foul_terminal_post_play_completion_v2',kind:'game_final',terminalSourceId:'terminal'},finalResult:{applicationId:'apply',gameId:'game'}}));expect(()=>assertNoFoulTerminalNextPlay(db,'apply')).toThrow();}finally{db.close();}
});
