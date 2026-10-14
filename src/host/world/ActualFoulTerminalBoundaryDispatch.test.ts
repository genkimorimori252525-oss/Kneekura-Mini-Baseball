import {SqliteOfficialStateWriter} from '../SqliteOfficialStateWriter';
import {createRequire} from 'node:module';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {expect,it,vi} from 'vitest';
import {boundaryFixture} from './ActualFoulTerminalBoundaryFixtures.test-support';
import * as completionOwner from './ActualFoulTerminalPostPlayCompletionEvidenceFromSqlite';
import {openSqliteActualFoulTerminalApplicationRunner} from './SqliteActualFoulTerminalApplicationRunner';
import {foulTerminalFinalCompletionTableSql} from './ActualFoulTerminalApplicationStorage';
import {readFoulTerminalCompletionMirrors} from '../OfficialTerminalPostPlayCompletion';
import {actorJson as json,actorHash as hash} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
// STRUCTURAL MOCKED Native transaction test: completion derivation is substituted
// with explicit Core fixture output. The original physical reader is never faked
// or invoked; these tests grant no genuine original/completion qualification.
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fixture=(kind:'half_change_continuing'|'game_final',run:(path:string,db:InstanceType<typeof DatabaseSync>,f:ReturnType<typeof boundaryFixture>)=>void)=>{
 const f=boundaryFixture(kind),p=f.proposal,path=join(mkdtempSync(join(tmpdir(),'terminal-boundary-structural-')),'boundary.sqlite'),db=new DatabaseSync(path);
 db.exec(foulTerminalFinalCompletionTableSql+`;PRAGMA user_version=3;CREATE TABLE matches(match_id TEXT PRIMARY KEY,durable_revision INTEGER NOT NULL,state_json TEXT NOT NULL,activation_json TEXT);
 CREATE TABLE applications(application_id TEXT PRIMARY KEY,match_id TEXT NOT NULL,closure_id TEXT NOT NULL,request_hash TEXT NOT NULL,result_json TEXT NOT NULL,UNIQUE(match_id,closure_id));
 CREATE TABLE official_fixtures(game_id TEXT PRIMARY KEY,venue_id TEXT NOT NULL,fixture_event_id TEXT NOT NULL UNIQUE,fixture_revision INTEGER NOT NULL);`);
 db.prepare('INSERT INTO actual_foul_terminal_applications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run('terminal','game',7,'apply','pitch','end','obligation','OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY',json(p.source),hash(p.source),json(p),hash(p),json(f.original));
 db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('apply','game','terminal',f.original.official.pendingPostPlay.requestHash,json(f.original.official));
 db.prepare('INSERT INTO matches VALUES(?,?,?,?)').run('game',1,json(f.original.official.receipt.appliedMatchState),json({pendingPostPlay:f.original.official.pendingPostPlay}));
 const mock=vi.spyOn(completionOwner,'foulTerminalPostPlayCompletionEvidenceFromSqlite').mockImplementation(connection=>({
 prepare:(source:unknown)=>{expect(source).toEqual(f.completion.source);return {original:{source:p.source,proposal:p,result:f.original},completion:f.completion};},
 read:()=>readFoulTerminalCompletionMirrors(connection,'terminal').archive,
 }as any));
 try{run(path,db,f);}finally{mock.mockRestore();db.close();}
};
it('BF-D01 both boundary arms perform exactly three existing-row updates and callback-free durable retry',()=>{
 for(const kind of ['half_change_continuing','game_final']as const)fixture(kind,(path,db,f)=>{
 const calls=vi.fn(()=>f.completion.source),runner=openSqliteActualFoulTerminalApplicationRunner(path,{readAcceptedPostPlaySetup:calls});
 const prepare=DatabaseSync.prototype.prepare,updates:string[]=[];const watch=vi.spyOn(DatabaseSync.prototype,'prepare').mockImplementation(function(this:InstanceType<typeof DatabaseSync>,sql:string){const statement=Reflect.apply(prepare,this,[sql]);if(/^UPDATE main\./.test(sql)){const run=statement.run;Object.defineProperty(statement,'run',{value:(...args:any[])=>{const result=Reflect.apply(run,statement,args);updates.push(sql);return result;}});}return statement;});
 try{const before=db.prepare('SELECT state_json,durable_revision FROM matches').get(),result=runner.completePostPlay('boundary');expect(updates).toHaveLength(3);expect(result.result.completion).toEqual(f.completion);expect(result.status).toBe(kind==='game_final'?'POST_PLAY_COMPLETED_FINAL':'POST_PLAY_COMPLETED_CONTINUING');expect(db.prepare('SELECT state_json,durable_revision FROM matches').get()).toEqual(before);
 const count=calls.mock.calls.length;expect(runner.completePostPlay('boundary')).toEqual(result);expect(calls).toHaveBeenCalledTimes(count);expect(updates).toHaveLength(3);
 }finally{watch.mockRestore();runner.close();}
 const reopened=openSqliteActualFoulTerminalApplicationRunner(path,{readAcceptedPostPlaySetup:()=>{throw new Error('RETRY_CALLBACK_FORBIDDEN');}});try{expect(reopened.completePostPlay('boundary').result.completion).toEqual(f.completion);}finally{reopened.close();}
 });
});
it('BF-D02 each of the six witnessed boundary updates rolls back after an injected failure',()=>{
 for(const kind of ['half_change_continuing','game_final']as const)for(const stop of [1,2,3])fixture(kind,(path,db,f)=>{
 const tables=['actual_foul_terminal_applications','applications','matches'],rows=()=>tables.map(t=>db.prepare('SELECT * FROM '+t).all()),before=rows();
 const runner=openSqliteActualFoulTerminalApplicationRunner(path,{readAcceptedPostPlaySetup:()=>f.completion.source}),prepare=DatabaseSync.prototype.prepare;let updates=0;
 const watch=vi.spyOn(DatabaseSync.prototype,'prepare').mockImplementation(function(this:InstanceType<typeof DatabaseSync>,sql:string){const statement=Reflect.apply(prepare,this,[sql]);if(/^UPDATE main\./.test(sql)){const run=statement.run;Object.defineProperty(statement,'run',{value:(...args:any[])=>{const result=Reflect.apply(run,statement,args);if(++updates===stop)throw new Error('STRUCTURAL_UPDATE_FAILURE');return result;}});}return statement;});
 try{expect(()=>runner.completePostPlay('boundary')).toThrow('STRUCTURAL_UPDATE_FAILURE');expect(updates).toBe(stop);expect(rows()).toEqual(before);}finally{watch.mockRestore();runner.close();}
 });
});
it('BF-D03 direct shared writer captures inert Source before capability-based storage dispatch',()=>{
 const db=new DatabaseSync(':memory:'),source=boundaryFixture('game_final').completion.source;let invoked=0;
 const active={...source};Object.defineProperty(active,'capability',{enumerable:true,get(){invoked++;return source.capability;}});
 try{const writer=new SqliteOfficialStateWriter(db);expect(()=>writer.prepareTerminalPostPlayCompletion(active)).toThrow();expect(invoked,'SHARED_WRITER_SOURCE_ACCESSOR_INVOKED').toBe(0);}finally{db.close();}
});
