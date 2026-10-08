import { officialMatchTerminalOwnershipClaims } from './OfficialApplicationOwnershipFromSqlite';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, expect, it } from 'vitest';
import type { DatabaseSync as Database } from 'node:sqlite';
import { SqliteOfficialStateWriter } from './SqliteOfficialStateWriter';
import { officialStateSerialized as json } from './OfficialStateEncoding';
import { foulTerminalCompletionTableSql } from './world/ActualFoulTerminalApplicationStorage';
import { match } from './world/OfficialParticipationPlayFixtures.test-support';

// Synthetic local mirror rejection only. These fixtures never authenticate
// physical/scoring/workload owners or grant completion/actor admission.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
let db:Database;
const state=match(), applicationId='apply', sourceId='terminal';
const activation={previousPlayId:state.playId-1,closureId:sourceId,applicationId,durableRevision:1,nextMatchState:state,
  nextTimeline:{playId:state.playId,startedAtTick:10,lastEventTick:10,nextSequence:0,status:{kind:'ready',count:{balls:0,strikes:0}},events:[]}};
const envelope={activation,nextWorld:{tick:10,defenders:[],runners:[],ball:null}};
beforeEach(()=>{db=new DatabaseSync(':memory:');db.exec(`PRAGMA user_version=3;
 CREATE TABLE matches(match_id TEXT PRIMARY KEY,durable_revision INTEGER NOT NULL,state_json TEXT NOT NULL,activation_json TEXT);
 CREATE TABLE applications(application_id TEXT PRIMARY KEY,match_id TEXT NOT NULL,closure_id TEXT NOT NULL,request_hash TEXT NOT NULL,result_json TEXT NOT NULL,UNIQUE(match_id,closure_id));`);
 db.prepare('INSERT INTO matches VALUES(?,?,?,?)').run('game',1,json(state),json(envelope));});
afterEach(()=>db.close());
const insertTerminal=(result='{}',cached=true)=>{db.exec(foulTerminalCompletionTableSql);
 db.prepare('INSERT INTO actual_foul_terminal_applications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(cached?sourceId:'foreign',cached?'game':'foreign',cached?state.playId-1:90,
 cached?applicationId:'foreign-app','pitch','end','child','OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY','{}','bad','{}','bad',result);};
const reject=()=>{const before=db.prepare('SELECT total_changes() AS n').get();
 expect(()=>new SqliteOfficialStateWriter(db).getMatch('game'),'TERMINAL_LEGACY_MATCH_BYPASS').toThrow(/terminal|completion|pending/i);
 expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(before);};
it('CP-L01 leaves a genuinely unrelated legacy Match envelope unchanged',()=>{
 expect(new SqliteOfficialStateWriter(db).getMatch('game')?.activation).toEqual(activation);
});
it('CP-L02 rejects a legacy-shaped Match while its current original terminal is pending',()=>{insertTerminal();reject();});
it('CP-L03 rejects an orphan application pending origin before legacy fallback',()=>{
 db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run(applicationId,'game',sourceId,'bad',json({receipt:{applicationId,previousPlayId:state.playId-1},
 pendingPostPlay:{origin:{owner:'actual_foul_terminal_applications',sourceId}}}));reject();
});
it('CP-L04 discovers raw duplicate escaped array terminal application references',()=>{
 insertTerminal('[{"completion":{},"compl\\u0065tion":[[{"officialReference":{"applicationId":"apply"}}]],"completion":{}}]',false);reject();
});
it('CP-L05 rejects an orphan compact application completion reference',()=>{
 db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run(applicationId,'game','damaged','bad',
 '[{"compl\\u0065tion":[{"setupSourceId":"orphan-setup"}]}]');reject();
});
it('CP-L06 rejects a stray completion reference in a legacy-shaped Match envelope',()=>{
 db.prepare('UPDATE matches SET activation_json=?').run(json({...envelope,completion:{setupSourceId:'orphan-setup'}}));reject();
});
it('CP-L07 rejects a missing completion archive behind an application completion reference',()=>{
 db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run(applicationId,'game',sourceId,'bad',json({receipt:{applicationId,previousPlayId:state.playId-1},
 completion:{version:'actual_foul_terminal_post_play_completion_v1',completionId:'damaged',terminalSourceId:sourceId,setupSourceId:'setup',sourceHash:'a'.repeat(64),snapshotHash:'b'.repeat(64)}}));reject();
});
it('CP-L08 keeps foreign-game later terminal scope out of unrelated legacy Match admission',()=>{
 insertTerminal('{}',false);expect(new SqliteOfficialStateWriter(db).getMatch('game')?.activation).toEqual(activation);
});
it('CP-L09 discovers retained pending origin game and previous play with damaged cached IDs',()=>{
 insertTerminal(json({official:{pendingPostPlay:{matchId:'game',previousPlayId:state.playId-1}}}),false);reject();
});
it('CP-L10 discovers completion activation previous play through retained pending game',()=>{
 insertTerminal(json({official:{pendingPostPlay:{matchId:'game'}},completion:{activation:{previousPlayId:state.playId-1}}}),false);reject();
});
it('CP-L11 discovers completion retirement previous play through retained pending game',()=>{
 insertTerminal('[{"official":{"pendingPostPlay":{"matchId":"game"}},"compl\\u0065tion":[{"controllerRetirement":{"previousPlayId":'+(state.playId-1)+'}}]}]',false);reject();
});
it('CP-L12 discovers orphan completion closure matching the current activation closure',()=>{
 db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('foreign','foreign',sourceId,'bad',json({completion:{terminalSourceId:sourceId,setupSourceId:'setup'}}));reject();
});
it('CP-L13 discovers orphan completion official application reference',()=>{
 db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('foreign','foreign','foreign','bad',json({completion:{officialReference:{applicationId}}}));reject();
});
it('CP-L14 discovers orphan completion activation application reference',()=>{
 db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('foreign','foreign','foreign','bad','[{"compl\\u0065tion":[{"activation":{"applicationId":"apply"}}]}]');reject();
});
it('CP-L15 discovers orphan completion previous play through retained pending game',()=>{
 db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('foreign','foreign','foreign','bad',json({pendingPostPlay:{matchId:'game'},completion:{controllerRetirement:{previousPlayId:state.playId-1}}}));reject();
});
it('CP-L16 discovers terminal completion activation closure with damaged cached identities',()=>{
 insertTerminal(json({completion:{activation:{closureId:sourceId}}}),false);reject();
});
it('CP-L17 discovers terminal through an untagged legacy application closure edge',()=>{
 db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run(applicationId,'foreign','foreign','bad',json({receipt:{applicationId}}));
 insertTerminal(json({completion:{source:{sourceId:'setup'}}}),false);reject();
});
it('CP-L18 discovers terminal through transitive raw application and setup edges',()=>{
 db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run(applicationId,'foreign','bridge','bad',json({receipt:{applicationId:'bridge-app'}}));
 db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('bridge-app','foreign','foreign','bad',json({completion:{setupSourceId:'setup'}}));
 insertTerminal(json({completion:{source:{sourceId:'setup'}}}),false);reject();
});
it('CP-L19 rejects an orphan completion claim in a linked foreign Match',()=>{
 db.prepare('INSERT INTO matches VALUES(?,?,?,?)').run('foreign',9,json(state),json({completion:{officialReference:{applicationId}}}));reject();
});
const orphanClosure=(table:'physical_play_closures'|'actual_live_play_closures')=>{
 db.exec(`CREATE TABLE ${table}(source_id TEXT,${table==='physical_play_closures'?'source_version TEXT,':''}game_id TEXT,play_id INTEGER,application_id TEXT,${table==='physical_play_closures'?'scoring_application_id TEXT,':''}status TEXT,source_json TEXT,source_hash TEXT,proposal_json TEXT,proposal_hash TEXT,result_json TEXT)`);
 db.prepare(`INSERT INTO ${table}(source_id,game_id,play_id,application_id,status,source_json,source_hash,proposal_json,proposal_hash,result_json) VALUES(?,?,?,?,?,?,?,?,?,?)`)
  .run('foreign','foreign',90,'foreign-app','FOREIGN','{}','bad','{}','bad',json({official:{completion:{officialReference:{applicationId}}}}));reject();
};
it('CP-L20 rejects an orphan completion claim in a linked physical closure',()=>orphanClosure('physical_play_closures'));
it('CP-L21 rejects an orphan completion claim in a linked actual-live closure',()=>orphanClosure('actual_live_play_closures'));

it('CP-L22 preserves distinct physical terminal rows with identical raw bytes',()=>{
 insertTerminal();const columns=db.prepare('PRAGMA table_info(actual_foul_terminal_applications)').all().map(c=>'\"'+String(c.name)+'\" '+String(c.type)).join(',');
 db.exec(`CREATE TABLE terminal_copy(${columns});INSERT INTO terminal_copy SELECT * FROM actual_foul_terminal_applications;
 INSERT INTO terminal_copy SELECT * FROM actual_foul_terminal_applications;DROP TABLE actual_foul_terminal_applications;
 ALTER TABLE terminal_copy RENAME TO actual_foul_terminal_applications;`);
 const row=db.prepare('SELECT * FROM matches WHERE match_id=?').get('game')!;
 expect(officialMatchTerminalOwnershipClaims(db,'game',row,state.playId-1).terminal).toHaveLength(2);reject();
});
