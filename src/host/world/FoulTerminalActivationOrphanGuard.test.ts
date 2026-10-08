import { expect, test } from 'vitest';
import { createRequire } from 'node:module';
import { assertNoFoulTerminalNextPlay } from './FoulTerminalNextPlayGuard';
import { assertPriorPhysicalClosureCompleted } from './PhysicalPlayClosureEvidenceFromSqlite';
import { readFoulTerminalPhysicalActivation } from './FoulTerminalNextPlayReadiness';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
// Raw-only Native rejection cases. No accepted completion/effect is fabricated.
const fixture=()=>{const db=new DatabaseSync(':memory:');db.exec(`
 CREATE TABLE applications(application_id TEXT,match_id TEXT,closure_id TEXT,request_hash TEXT,result_json TEXT);
 CREATE TABLE matches(match_id TEXT,durable_revision INTEGER,state_json TEXT,activation_json TEXT);
 CREATE TABLE physical_play_closures(source_id TEXT,source_version TEXT,game_id TEXT,play_id INTEGER,application_id TEXT,
 scoring_application_id TEXT,status TEXT,source_json TEXT,source_hash TEXT,proposal_json TEXT,proposal_hash TEXT,result_json TEXT);
 CREATE TABLE actual_live_play_closures(source_id TEXT,game_id TEXT,play_id INTEGER,application_id TEXT,status TEXT,
 source_json TEXT,source_hash TEXT,proposal_json TEXT,proposal_hash TEXT,result_json TEXT);
 CREATE TABLE actual_foul_terminal_applications(source_id TEXT,game_id TEXT,play_id INTEGER,application_id TEXT,physical_pitch_source_id TEXT,
 physical_end_source_id TEXT,official_obligation_key TEXT,status TEXT,source_json TEXT,source_hash TEXT,proposal_json TEXT,proposal_hash TEXT,result_json TEXT);
 `);return db;};
const routes=[(db:ReturnType<typeof fixture>)=>assertNoFoulTerminalNextPlay(db,'target'),
 (db:ReturnType<typeof fixture>)=>assertPriorPhysicalClosureCompleted(db,'target'),
 (db:ReturnType<typeof fixture>)=>readFoulTerminalPhysicalActivation(db,'game','target')];
const encodings=(value:unknown)=>[JSON.stringify(value),'['+JSON.stringify(value)+']'];
test('OG-S01 raw orphan completion application identities cannot escape through foreign cached IDs',()=>{
 for(const value of [{completion:{officialReference:{applicationId:'target'}}},{completion:{activation:{applicationId:'target'}}},
   {activation:{applicationId:'target'},completion:{}}])for(const document of encodings(value))for(const read of routes){
  const db=fixture();try{
   db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('foreign','foreign','foreign','bad',document);
   expect(()=>read(db),'ORPHAN_COMPLETION_APPLICATION_IDENTITY_ESCAPED').toThrow(/terminal|completion|ownership/);
  }finally{db.close();}
 }
});
test('OG-S02 untagged application bridges retain every selected terminal-marked owner kind',()=>{
 for(const kind of ['applications','matches','physical_play_closures','actual_live_play_closures']){
  const db=fixture();try{
   db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('target','game','bridge-one','bad','{"receipt":{"applicationId":"target","previousPlayId":1}}');
   db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('foreign','foreign','bridge-one','bad','{"activation":{"applicationId":"bridge-two"}}');
   if(kind==='applications')db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('bridge-two','foreign','last','bad','{"completion":{}}');
   else if(kind==='matches')db.prepare('INSERT INTO matches VALUES(?,?,?,?)').run('foreign',1,'{}','{"activation":{"applicationId":"bridge-two"},"completion":{}}');
   else db.prepare(`INSERT INTO ${kind}(source_id,game_id,play_id,application_id,source_json,proposal_json,result_json) VALUES(?,?,?,?,?,?,?)`)
      .run('foreign','foreign',90,'bridge-two','{}','{"expectedOfficial":{"completion":{}}}','{}');
   expect(()=>assertNoFoulTerminalNextPlay(db,'target'),'TRANSITIVE_TERMINAL_OWNER_MARKER_ESCAPED').toThrow(/terminal|completion|ownership/);
  }finally{db.close();}
 }
});
test('OG-S03 unrelated raw terminal markers do not convert an ordinary earlier activation into a terminal claim',()=>{
 const db=fixture();try{
  db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('target','game','original','bad','{"receipt":{"applicationId":"target","previousPlayId":1}}');
  db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('foreign','foreign','foreign','bad','{"completion":{"officialReference":{"applicationId":"unrelated"}}}');
  expect(()=>assertNoFoulTerminalNextPlay(db,'target')).not.toThrow();
 }finally{db.close();}
});
