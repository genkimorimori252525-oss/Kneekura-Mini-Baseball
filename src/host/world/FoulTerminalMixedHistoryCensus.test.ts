import { beforeEach, expect, test, vi } from 'vitest';
import { createRequire } from 'node:module';
import type { DatabaseSync as Database } from 'node:sqlite';
// These replace both authenticated archive boundaries solely to exercise the
// shared per-scope dispatch. None of these archives, effects or histories is
// genuine; qualification requires separate original-owner Native artifacts.
const fixture = vi.hoisted(() => ({ terminals:new Map<string,any>(), live:new Map<string,any>(), effects:[] as string[], heads:new Map<string,any>(), headHook:null as null|((db:Database)=>void) }));
vi.mock('./ActualFoulTerminalPostPlayCompletionEvidenceFromSqlite', () => ({
  foulTerminalPostPlayCompletionEvidenceFromSqlite: () => ({
    read:(id:string) => fixture.terminals.get(id)?.archive ?? null,
    readWithEffects:(id:string) => { fixture.effects.push(`terminal:${id}`); return fixture.terminals.get(id) ?? null; },
  }),
}));
vi.mock('./ActualLivePlayReadinessFromSqlite', () => ({actualLivePlayReadinessFromSqlite:() => ({
  read:(id:string) => { fixture.effects.push(`live:${id}`); return fixture.live.get(id); },
  readHistorical:(id:string) => { fixture.effects.push(`live:${id}`); return fixture.live.get(id); },
})}));
vi.mock('./ActualRoleWorkloadState', () => ({readActualRoleWorkloadState:(db:Database,_career:string,player:string) => {fixture.headHook?.(db);return fixture.heads.get(player) ?? null;}}));
import { assertPriorActualLiveClosureCompleted } from './ActualLivePlayClosureEvidenceFromSqlite';
import { foulTerminalNextPlayReadinessFromSqlite, foulTerminalReadinessReference,
  assertFoulTerminalPhysicalActivationCurrent, readFoulTerminalPhysicalActivation } from './FoulTerminalNextPlayReadiness';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
beforeEach(() => { fixture.terminals.clear();fixture.live.clear();fixture.effects=[];fixture.heads.clear();fixture.headHook=null; });
const database = () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE applications(application_id TEXT,match_id TEXT,result_json TEXT,closure_id TEXT,request_hash TEXT);
    CREATE TABLE matches(match_id TEXT,durable_revision INTEGER,state_json TEXT,activation_json TEXT);
    CREATE TABLE actual_live_play_runtimes(game_id TEXT,play_id INTEGER);
    CREATE TABLE actual_foul_play_ends(source_id TEXT,game_id TEXT,play_id INTEGER);
    CREATE TABLE actual_live_play_closures(source_id TEXT,game_id TEXT,play_id INTEGER,application_id TEXT,status TEXT,source_json TEXT,source_hash TEXT,proposal_json TEXT,proposal_hash TEXT,result_json TEXT);
    CREATE TABLE actual_foul_terminal_applications(source_id TEXT,game_id TEXT,play_id INTEGER,application_id TEXT,status TEXT,
      source_json TEXT,proposal_json TEXT,result_json TEXT,physical_pitch_source_id TEXT,physical_end_source_id TEXT,official_obligation_key TEXT,source_hash TEXT,proposal_hash TEXT);`);
  return db;
};
const application = (db:Database,play:number) => {
  const result = {receipt:{applicationId:`app-${play}`,previousPlayId:play,durableRevision:play},
    activation:{previousPlayId:play,nextMatchState:{playId:play+1}},nextWorld:{tick:play+1}};
  db.prepare('INSERT INTO applications(application_id,match_id,result_json) VALUES(?,?,?)').run(`app-${play}`,'game',json(result)); return result;
};
const terminal = (db:Database,play:number) => {
  const sourceId = `terminal-${play}`, result = application(db,play);
  const participants = Array.from({length:10},(_,i) => ({binding:{playerId:`player-${i}`,careerId:'career',gameDay:7,
    clubId:`club-${i ? 'home' : 'away'}`,personLinkSourceId:`link-${i}`},person:{personId:`person-${i}`}}));
  const settlement = {kind:'complete',careerId:'career',gameId:'game',playId:play,gameDay:7,participants:participants.map(p => ({
    playerId:p.binding.playerId,personId:p.person.personId,clubId:p.binding.clubId,applied:true,
    after:{playerId:p.binding.playerId,careerId:'career',revision:1,effectiveDay:7},
  }))};
  const completion = {source:{sourceId:`setup-${play}`},completionId:json(['actual_foul_terminal_post_play_completion_v1',sourceId,`setup-${play}`]),
    snapshotHash:'a'.repeat(64),officialReference:{applicationId:`app-${play}`},activation:result.activation,nextWorld:result.nextWorld};
  const archive = {source:{sourceId,applicationId:`app-${play}`},proposal:{gameId:'game',playId:play,participants},
    status:'POST_PLAY_COMPLETED_CONTINUING',result:{official:result,completion}};
  fixture.terminals.set(sourceId,{archive,settlement});
  db.prepare('INSERT INTO actual_foul_terminal_applications(source_id,game_id,play_id,application_id,status,source_json,proposal_json,result_json) VALUES(?,?,?,?,?,?,?,?)').run(sourceId,'game',play,`app-${play}`,
    archive.status,json(archive.source),json(archive.proposal),json(archive.result));
  db.prepare('INSERT INTO actual_foul_play_ends(source_id,game_id,play_id) VALUES(?,?,?)').run(`end-${play}`,'game',play);
  return {archive,settlement};
};
const live = (db:Database,play:number) => {
  application(db,play);db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?)').run('game',play);
  db.prepare('INSERT INTO actual_live_play_closures(source_id,game_id,play_id,application_id) VALUES(?,?,?,?)').run(`live-${play}`,'game',play,`app-${play}`);
  fixture.live.set(`live-${play}`,{kind:'ready',closure:{proposal:{gameId:'game',playId:play,application:{applicationId:`app-${play}`}}}});
};
test('TM-S01 structural terminal then live dispatch does not require a first-base closure for terminal scope', () => {
  const db=database();try {terminal(db,1);live(db,2);assertPriorActualLiveClosureCompleted(db,'app-2',true);
    expect(fixture.effects.slice().sort()).toEqual(['live:live-2','terminal:terminal-1']);
  } finally {db.close();}
});
test('TM-S02 structural live then terminal dispatch authenticates all prior scopes', () => {
  const db=database();try {live(db,1);terminal(db,2);assertPriorActualLiveClosureCompleted(db,'app-2',true);
    expect(fixture.effects).toEqual(['live:live-1','terminal:terminal-2']);
  } finally {db.close();}
});
test('TM-S03 structural selected terminal cannot bypass an earlier unresolved scope or dual owners', () => {
  const db=database();try {terminal(db,2);db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?)').run('game',1);
    expect(() => assertPriorActualLiveClosureCompleted(db,'app-2',true)).toThrow(/missing|ambiguous/);
    db.exec('DELETE FROM actual_live_play_runtimes');
    db.prepare('INSERT INTO actual_live_play_closures(source_id,game_id,play_id,application_id) VALUES(?,?,?,?)').run('dual','game',2,'other');
    expect(() => assertPriorActualLiveClosureCompleted(db,'app-2',true)).toThrow(/missing|ambiguous/);
  } finally {db.close();}
});
test('TM-S04 structural retained pending aliases and malformed completion-only mirrors reject', () => {
  const db=database();try {terminal(db,1);
    db.prepare('INSERT INTO applications(application_id,match_id,result_json) VALUES(?,?,?)').run('alias','game',json({pendingPostPlay:{applicationId:'damaged',matchId:'game',previousPlayId:1}}));
    expect(() => assertPriorActualLiveClosureCompleted(db,'app-1',true)).toThrow(/terminal|pending/);
    db.exec('DELETE FROM applications; DELETE FROM actual_foul_terminal_applications; DELETE FROM actual_foul_play_ends');
    db.prepare('INSERT INTO applications(application_id,match_id,result_json) VALUES(?,?,?)').run('app-1','game',json({receipt:{applicationId:'app-1',previousPlayId:1},completion:{}}));
    expect(() => assertPriorActualLiveClosureCompleted(db,'app-1',true)).toThrow(/terminal|pending/);
  } finally {db.close();}
});
test('TM-S05 structural readiness reference is exact stable and independent of current heads', () => {
  const db=database();try {const pair=terminal(db,1),owner=foulTerminalNextPlayReadinessFromSqlite(db);
    const historical=owner.readHistorical('terminal-1');
    expect(Object.keys(historical.reference).sort()).toEqual(['version','terminalSourceId','setupSourceId','completionId','snapshotHash','applicationId','gameId','previousPlayId'].sort());
    for (const raw of [{...historical.reference,extra:true},{...historical.reference,version:'other'}, {...historical.reference,previousPlayId:-1}]) {
      expect(() => foulTerminalReadinessReference(raw as any)).toThrow(/reference/);
    }
    const c=pair.archive.result.completion;
    db.prepare('INSERT INTO matches VALUES(?,?,?,?)').run('game',1,json(c.activation.nextMatchState),json({activation:c.activation,nextWorld:c.nextWorld}));
    for (const p of pair.settlement.participants) fixture.heads.set(p.playerId,{...p.after});
    expect(owner.read('terminal-1').reference).toEqual(historical.reference);
    fixture.heads.set('player-1',{...pair.settlement.participants[1].after,revision:2});
    expect(owner.read('terminal-1').reference).toEqual(historical.reference);
    expect(() => assertFoulTerminalPhysicalActivationCurrent(db,historical.reference,'game',3)).toThrow(/consuming frame/);
    fixture.heads.set('player-1',{...pair.settlement.participants[1].after,revision:2,effectiveDay:8});
    expect(() => owner.read('terminal-1')).toThrow(/current workload/);
    expect(owner.readHistorical('terminal-1').reference).toEqual(historical.reference);
    fixture.heads.set('player-1',{...pair.settlement.participants[1].after});
    db.exec('UPDATE matches SET durable_revision=2');
    expect(() => owner.read('terminal-1')).toThrow(/current Match/);
    expect(owner.readHistorical('terminal-1').reference).toEqual(historical.reference);
  } finally {db.close();}
});
test('TM-S06 structural array-wrapped raw scope mirrors cannot hide retained ends or dual owner kinds', () => {
  const db=database();try {
    live(db,2);db.exec('ALTER TABLE actual_foul_play_ends ADD COLUMN snapshot_json TEXT');
    db.prepare('INSERT INTO actual_foul_play_ends VALUES(?,?,?,?)').run('hidden','foreign',1,'[{"gameId":"game","playId":1}]');
    expect(() => assertPriorActualLiveClosureCompleted(db,'app-2',true),'ARRAY_SCOPE_CENSUS_MISSING').toThrow(/scope/);
    db.exec('DELETE FROM actual_foul_play_ends; DELETE FROM actual_live_play_closures; DELETE FROM actual_live_play_runtimes; DELETE FROM applications');
    db.exec('DROP TABLE actual_foul_play_ends; CREATE TABLE actual_foul_play_ends(source_id TEXT,game_id TEXT,play_id INTEGER)');
    terminal(db,1);
    db.prepare('INSERT INTO actual_live_play_closures(source_id,game_id,play_id,application_id,proposal_json) VALUES(?,?,?,?,?)').run('hidden-live','foreign',91,'foreign','[{"gameId":"game","playId":1}]');
    expect(() => assertPriorActualLiveClosureCompleted(db,'app-1',true),'ARRAY_DUAL_OWNER_CENSUS_MISSING').toThrow(/ambiguous/);
  } finally {db.close();}
});
test('TM-S07 structural earlier dual owner survives through an application Source mirror alone', () => {
  const db=database();try {
    terminal(db,1);live(db,2);
    db.prepare('INSERT INTO actual_live_play_closures(source_id,game_id,play_id,application_id,source_json) VALUES(?,?,?,?,?)').run('hidden-live','foreign',91,'foreign','[{"applicationId":"app-1"}]');
    expect(() => assertPriorActualLiveClosureCompleted(db,'app-2',true),'EARLIER_APPLICATION_LINKED_DUAL_OWNER_MISSING').toThrow(/ambiguous/);
  } finally {db.close();}
});
test('TM-S08 structural a replaced retained-scope owner cannot prove absence', () => {
  const db=database();try {
    live(db,2);db.exec(`DROP TABLE actual_foul_play_ends;
      CREATE VIEW actual_foul_play_ends AS SELECT 'end-1' AS source_id,'game' AS game_id,1 AS play_id`);
    expect(() => assertPriorActualLiveClosureCompleted(db,'app-2',true),'REPLACED_SCOPE_OWNER_ACCEPTED').toThrow(/schema|scope/);
  } finally {db.close();}
});

test('TM-S09 structural terminal current-head reads reject a real native mutate-restore inside their proof interval', () => {
  const db=database();try {
    const pair=terminal(db,1),c=pair.archive.result.completion;
    db.prepare('INSERT INTO matches VALUES(?,?,?,?)').run('game',1,json(c.activation.nextMatchState),json({activation:c.activation,nextWorld:c.nextWorld}));
    db.exec('CREATE TABLE terminal_read_guard_probe(value INTEGER); INSERT INTO terminal_read_guard_probe VALUES(0); BEGIN');
    for (const p of pair.settlement.participants) fixture.heads.set(p.playerId,{...p.after});
    let writes=0;
    fixture.headHook=connection=>{
      if(writes)return;
      const prior=connection.prepare('PRAGMA query_only').get()!.query_only;
      connection.exec('PRAGMA query_only=OFF');
      connection.prepare('UPDATE terminal_read_guard_probe SET value=value+1').run();writes++;
      connection.prepare('UPDATE terminal_read_guard_probe SET value=value-1').run();writes++;
      connection.exec('PRAGMA query_only='+prior);
    };
    expect(()=>foulTerminalNextPlayReadinessFromSqlite(db).read('terminal-1'),'TERMINAL_CURRENT_READ_INTERVAL_UNGUARDED').toThrow();
    expect(writes).toBe(2);expect(db.prepare('SELECT value FROM terminal_read_guard_probe').get()!.value).toBe(0);
  } finally {if(db.isTransaction)db.exec('ROLLBACK');db.close();}
});

test('TM-S10 structural terminal actor activation guards the final application hash after readiness', () => {
  const db=database(),restore:(()=>void)[]=[];
  try {
    terminal(db,1);db.exec('CREATE TABLE terminal_activation_guard_probe(value INTEGER); INSERT INTO terminal_activation_guard_probe VALUES(0); BEGIN');
    let writes=0;const prepare=db.prepare.bind(db);
    const spy=vi.spyOn(db,'prepare').mockImplementation((...args)=>{
      const statement=prepare(...args);
      if(args[0]==='SELECT * FROM applications WHERE application_id=? AND match_id=?'){
        const get=statement.get.bind(statement);
        const getSpy=vi.spyOn(statement,'get').mockImplementation((...params)=>{
          const row=get(...params),prior=db.prepare('PRAGMA query_only').get()!.query_only;
          db.exec('PRAGMA query_only=OFF');
          db.prepare('UPDATE terminal_activation_guard_probe SET value=value+1').run();writes++;
          db.prepare('UPDATE terminal_activation_guard_probe SET value=value-1').run();writes++;
          db.exec('PRAGMA query_only='+prior);return row;
        });restore.push(()=>getSpy.mockRestore());
      }
      return statement;
    });restore.push(()=>spy.mockRestore());
    expect(()=>readFoulTerminalPhysicalActivation(db,'game','app-1'),'TERMINAL_ACTIVATION_HASH_INTERVAL_UNGUARDED').toThrow();
    expect(writes).toBe(2);expect(db.prepare('SELECT value FROM terminal_activation_guard_probe').get()!.value).toBe(0);
  } finally {while(restore.length)restore.pop()!();if(db.isTransaction)db.exec('ROLLBACK');db.close();}
});
