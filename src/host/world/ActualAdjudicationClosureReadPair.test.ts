import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
type FieldModule=typeof import('./SqliteBattedWorldFieldStore');
type ExecutionModule=typeof import('./SqliteBattedWorldFieldExecutionStore');
const real=vi.hoisted(()=>({field:null as FieldModule|null,execution:null as ExecutionModule|null}));

// Pair/transaction boundary controls only. Real SQLite end/fence and adjudication
// identity/archive checks, closure fixture/binding checks and transaction guards
// remain active. Expensive physical derivation and unrelated domain projections
// below are explicitly replaced; these controls prove no physical acceptance.
const state = vi.hoisted(() => ({ end: null as any, base: null as any, execution: null as any,
  call: null as any, references: null as any, ledger: null as any, timeline: null as any,
  endReads: 0, fieldReads: 0, fieldScopes: 0, executionScopes: 0,
  endHook: null as null | ((db: DatabaseSync) => void), consumeHook: null as null | (() => void) }));
vi.mock('./ActualFirstBasePlayEndEvidenceFromSqlite', () => ({ actualFirstBasePlayEndEvidenceFromSqlite: (db: DatabaseSync) => ({
  derive: (source: unknown) => { state.endReads++; state.endHook?.(db); return freeze({ ...state.end, source }); },
}) }));
vi.mock('./SqliteBattedWorldFieldStore', () => ({
  withBattedWorldFieldReadTraversal:<T>(db:Parameters<FieldModule['withBattedWorldFieldReadTraversal']>[0],body:()=>T)=>real.field!.withBattedWorldFieldReadTraversal(db,body),
  activeBattedWorldFieldReadFrame:(...args:Parameters<FieldModule['activeBattedWorldFieldReadFrame']>)=>real.field!.activeBattedWorldFieldReadFrame(...args),
  activeBattedWorldFieldReadSnapshot:(...args:Parameters<FieldModule['activeBattedWorldFieldReadSnapshot']>)=>real.field!.activeBattedWorldFieldReadSnapshot(...args),
  assertBattedWorldFieldReadFrame:(...args:Parameters<FieldModule['assertBattedWorldFieldReadFrame']>)=>real.field!.assertBattedWorldFieldReadFrame(...args),
  isAuthenticatedBattedWorldFieldTraversalValue:(...args:Parameters<FieldModule['isAuthenticatedBattedWorldFieldTraversalValue']>)=>real.field!.isAuthenticatedBattedWorldFieldTraversalValue(...args),
  battedWorldFieldEvidenceFromSqlite: () => ({ read: () => { state.fieldReads++; return state.base; },
    scope: () => { state.fieldScopes++; return [state.base]; } }),
}));
vi.mock('./SqliteBattedWorldFieldExecutionStore', () => ({
  withBattedWorldPhysicalReadTraversal:<T>(db:Parameters<ExecutionModule['withBattedWorldPhysicalReadTraversal']>[0],body:()=>T)=>real.execution!.withBattedWorldPhysicalReadTraversal(db,body),
  battedWorldFieldExecutionEvidenceFromSqlite: () => ({ read: () => state.execution,
    scope: () => { state.executionScopes++; return [state.execution]; } }),
}));
vi.mock('./ActualLiveRuleApplicability', () => ({ assertActualLiveRuleApplicability: () => {} }));
vi.mock('./ActualObservationPhysicalPrefixHash', () => ({ actualObservationPhysicalPrefixEvidence: () => state.end.physicalPrefixReference }));
vi.mock('./BattedWorldFieldPhysicalPrefix', () => ({ battedWorldFieldPhysicalPrefix: () => ({ field: {} }) }));
vi.mock('./OwnedScheduledMotionArchive', async original => ({
  ...await original<typeof import('./OwnedScheduledMotionArchive')>(), ownedScheduledMotionArchiveHash: () => 'rule-hash',
}));
vi.mock('./SqliteActualFirstBaseUmpireStore', () => ({ actualFirstBaseUmpireEvidenceFromSqlite: () => ({
  readAvailableCall: () => state.call, importReferences: () => state.references,
}) }));
vi.mock('./ActualLiveAdjudication', () => ({ projectActualLiveAdjudication: () => ({ ledger: state.ledger, pendingReasons: [] }) }));
vi.mock('../../core/sim/plateAppearance/ActualFairFieldTimeline', () => ({ projectActualFairFieldTimeline: () => ({ kind: 'projected', timeline: state.timeline }) }));
vi.mock('./SqliteOfficialInitialWorldStore', async original => ({
  ...await original<typeof import('./SqliteOfficialInitialWorldStore')>(),
  readOfficialActorPersonLink: (_db: unknown, binding: any) => ({ personId: `person:${binding.playerId}` }),
}));
vi.mock('./ActualPlayerKinematicsFromPrefix', () => ({ actualPlayersKinematicsFromPrefix: (players: string[]) => {
  state.consumeHook?.(); return players.map(playerId => ({ playerId, personId: `person:${playerId}`,
    activeCommand: { sourceId: `command:${playerId}` }, ownedMotionCoverage: null }));
} }));

import { actualFirstBaseEndArchiveEncoding } from './SqliteActualFirstBasePlayEndStore';
import { actualLiveAdjudicationEvidenceFromSqlite } from './ActualLiveAdjudicationFromSqlite';
import { deriveActualLivePlayClosureProposal } from './ActualLivePlayClosureEvidenceFromSqlite';
import * as closureEvidence from './ActualLivePlayClosureEvidenceFromSqlite';
import { activeBattedWorldFieldReadFrame, activeBattedWorldFieldReadSnapshot } from './SqliteBattedWorldFieldStore';
import { openSqliteActualLiveAdjudicationStore } from './SqliteActualLiveAdjudicationStore';
import { openSqliteActualLivePlayClosureStore } from './SqliteActualLivePlayClosureStore';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
real.field=await vi.importActual<FieldModule>('./SqliteBattedWorldFieldStore');
real.execution=await vi.importActual<ExecutionModule>('./SqliteBattedWorldFieldExecutionStore');
const { DatabaseSync: Sqlite } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const endSource = { sourceId: 'end', sourceVersion: 'v1', runtimeSourceId: 'runtime', baseFieldSourceId: 'field',
  executionSourceId: 'rule', ruleConsumptionSourceId: 'consumption', umpireCallSourceId: 'call', communicationSourceId: 'communication' };
const adjudicationSource = { sourceId: 'adjudication', sourceVersion: 'v1', physicalEndSourceId: 'end', policy: null };
const match = { ruleProfileId: asRuleProfileId('npb-2026'), inning: 1, half: 'top' as const, outs: 0, balls: 0, strikes: 0,
  bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 }, playId: 7 };
const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
const defenders = positions.map((registeredPosition, index) => ({ playerId: index === 0 ? 'p2' : `home-${index}`,
  registeredPosition, position: { x: index, z: index } }));
const centers = { first: { x: 1, z: 1 }, second: { x: 0, z: 2 }, third: { x: -1, z: 1 } };
const closureSource = { sourceId: 'closure', sourceVersion: 'v1', adjudicationSourceId: 'adjudication', applicationId: 'apply',
  closureTick: 11, nextStartedAtTick: 12, controllerReset: 'rule_system_retire_original_play' as const,
  worldSetup: { baseCenters: centers, defenders, activePreviousPlayControllerIds: [] } };
const binding = (playerId: string, side: 'HOME' | 'AWAY') => ({ playerId, personId: `person:${playerId}`, careerId: 'career',
  gameId: 'game', gameDay: 10, competitionEditionId: 'season', fixtureEventId: 'fixture', clubId: side === 'HOME' ? 'home' : 'away', side, rosterRevision: 0 });
beforeEach(() => {
  state.endReads=state.fieldReads=state.fieldScopes=state.executionScopes=0;state.endHook=null;state.consumeHook=null;
  const playEnd={kind:'play_end' as const,tick:10,reason:'live_action_complete' as const};
  const ledger=createPlayAdjudicationLedger({playId:7,ruleProfileId:match.ruleProfileId,playEnd});
  state.ledger=recordCorrectRuleSnapshot(ledger,0,{eventId:'rule',tick:10,snapshotId:'rule',evidenceRevision:1,
    ruling:{outsAfter:1,basesAfter:match.bases,scoredRunnerIds:[]}});
  state.timeline={playId:7,startedAtTick:0,lastEventTick:10,nextSequence:1,
    status:{kind:'live_ball_complete',count:{balls:0,strikes:0},contactTick:1,playEndTick:10,disposition:{kind:'fair',fairDeterminationTick:2}},
    events:[{kind:'LiveBallPlayEnded',sequence:0,tick:10,payload:{playEnd}}]};
  const frame={gameId:'game',match,officialRevision:0,activation:null,batterActor:{binding:binding('away-1','AWAY')},
    bindings:defenders.map(d=>binding(d.playerId,'HOME')),world:{runners:[],defenders}};
  state.base=freeze({source:{sourceId:'field'},response:{touch:{worldContact:{flight:{physicalPitch:{frame}}}}},
    geometry:{geometry:{baseGeometry:{bases:Object.fromEntries(Object.entries(centers).map(([name,center])=>[name,{region:{center}}]))}}}});
  state.execution=freeze({source:{sourceId:'rule'},revision:1,baseField:state.base,execution:{kind:'first_base_race',
    ballEvidence:{kind:'grounded',territory:'fair'},groundRule:{correctRuleResult:{kind:'resolved',outsAfter:1,batterRunnerFirstBase:{kind:'out',runnerId:'away-1'}}}}});
  state.references=freeze({call:{sourceId:'call'},perception:{sourceId:'observation'},policy:{sourceId:'setup'},ruleEvidence:{sourceId:'rule'}});
  state.call=freeze({source:{sourceId:'call'},schedule:{kind:'called',calledAtElapsedSeconds:10,availableAtElapsedSeconds:10},onFieldCall:{ruling:'out'},
    observation:{source:{ruleExecutionSourceId:'rule'},gameId:'game',playId:7,physicalPitchSourceId:'pitch',clock:{originTick:0,ticksPerSecond:1}}});
  state.end=freeze({source:endSource,kind:'ended',gameId:'game',playId:7,physicalPitchSourceId:'pitch',playEnd,
    exactEnd:{originTick:0,tick:10,elapsedSeconds:10},wholeHistory:{originalTimeline:state.timeline},wholeHistoryHash:'history',
    wholeHistoryHashConvention:'owned_scheduled_whole_history_manifest_v1',physicalPrefixReference:{physicalPrefixHash:'prefix'},
    finalRuleReference:{sourceId:'rule',snapshotHash:'rule-hash'},operativeCallReferences:state.references,firstBaseEvidenceApplicability:{},futureWork:{}});
});
afterEach(() => vi.restoreAllMocks());
const fixture = (seedAdjudication = true) => {
  const directory=mkdtempSync(join(tmpdir(),'adjudication-closure-pair-')),path=join(directory,'state.sqlite'),db=new Sqlite(path);
  db.exec(`PRAGMA journal_mode=WAL;CREATE TABLE mutation_witness(value TEXT);
    CREATE TABLE actual_first_base_play_ends(source_id TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT);
    CREATE TABLE actual_live_play_fences(game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,closure_source_id TEXT);
    CREATE TABLE actual_live_adjudications(source_id TEXT,game_id TEXT,play_id INTEGER,physical_end_source_id TEXT,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT);
    CREATE TABLE official_fixtures(game_id TEXT,fixture_event_id TEXT);
    CREATE TABLE world_season_heads(career_id TEXT,season_id TEXT,schedule_json TEXT);
    CREATE TABLE official_participant_bindings(game_id TEXT,player_id TEXT,binding_json TEXT);`);
  const endEncoded=actualFirstBaseEndArchiveEncoding(state.end);
  db.prepare('INSERT INTO actual_first_base_play_ends VALUES(?,?,?,?,?,?,?,?)').run('end','game',7,'pitch',json(endSource),hash(endSource),endEncoded.json,endEncoded.hash);
  db.prepare('INSERT INTO actual_live_play_fences VALUES(?,?,?,?)').run('game',7,'pitch','end');
  db.prepare('INSERT INTO official_fixtures VALUES(?,?)').run('game','fixture');
  db.prepare('INSERT INTO world_season_heads VALUES(?,?,?)').run('career','season',JSON.stringify({seasonId:'season',games:[{gameId:'game',homeClubId:'home',awayClubId:'away'}]}));
  for(const b of [binding('away-1','AWAY'),...defenders.map(d=>binding(d.playerId,'HOME'))])
    db.prepare('INSERT INTO official_participant_bindings VALUES(?,?,?)').run('game',b.playerId,JSON.stringify(b));
  const owner=actualLiveAdjudicationEvidenceFromSqlite(db),value=owner.derive(adjudicationSource);
  if(seedAdjudication){db.prepare('INSERT INTO actual_live_adjudications VALUES(?,?,?,?,?,?,?,?)').run('adjudication','game',7,'end',json(adjudicationSource),hash(adjudicationSource),json(value),hash(value));
    expect(json(owner.read('adjudication'))).toBe(json(value));}
  state.endReads=state.fieldReads=state.fieldScopes=state.executionScopes=0;
  return {db,path,owner,value,close(){state.endHook=null;state.consumeHook=null;if(db.isTransaction)db.exec('ROLLBACK');db.close();rmSync(directory,{recursive:true,force:true});}};
};
type Pair = {value:ReturnType<ReturnType<typeof actualLiveAdjudicationEvidenceFromSqlite>['derive']>;end:typeof state.end;prefix:{baseField:typeof state.base;fields:unknown[];executions:unknown[]}};
const pair = (x:ReturnType<typeof fixture>,id='adjudication') => {
  const method=(x.owner as unknown as {readWithClosureInputs?:(id:string)=>Pair|null}).readWithClosureInputs;
  expect(typeof method,'authenticated paired reader is the missing feature').toBe('function');return method!(id);
};
const proposal=(db:DatabaseSync|Pick<DatabaseSync,'prepare'>)=>deriveActualLivePlayClosureProposal(db,closureSource);

it('keeps ordinary adjudication public bytes and supplies its exact freshly owned pair',()=>{
  const x=fixture();try{x.db.exec('BEGIN');const p=pair(x)!;expect(json(p.value)).toBe(json(x.value));
    expect(json(p.end)).toBe(json(state.end));expect(p.prefix.baseField).toBe(state.base);
    expect(p.prefix.executions).toEqual([state.execution]);expect([state.endReads,state.fieldScopes,state.executionScopes]).toEqual([1,1,1]);
    expect(json(x.owner.read('adjudication'))).toBe(json(p.value));expect(x.owner.read('adjudication')).not.toHaveProperty('prefix');
    expect(pair(x,'missing')).toBeNull();}finally{x.close();}
});
it('produces byte-identical closure proposals using one fresh pair in a real active transaction',()=>{
  const x=fixture();try{const legacy=json(proposal(x.db));expect([state.endReads,state.fieldScopes,state.executionScopes]).toEqual([2,2,2]);
    state.endReads=state.fieldScopes=state.executionScopes=0;x.db.exec('BEGIN');expect(json(proposal(x.db))).toBe(legacy);
    expect([state.endReads,state.fieldScopes,state.executionScopes]).toEqual([1,1,1]);}finally{x.close();}
});
it('starts a new pair for every independent closure and every later transaction',()=>{
  const x=fixture();try{x.db.exec('BEGIN');const first=json(proposal(x.db));expect(json(proposal(x.db))).toBe(first);
    expect(state.endReads).toBe(2);x.db.exec('COMMIT;BEGIN');expect(json(proposal(x.db))).toBe(first);expect(state.endReads).toBe(3);}finally{x.close();}
});
it('retains the legacy path for a connection proxy even when its isTransaction property says true',()=>{
  const x=fixture();try{x.db.exec('BEGIN');const proxy={prepare:x.db.prepare.bind(x.db),isTransaction:true};proposal(proxy);
    expect([state.endReads,state.fieldScopes,state.executionScopes]).toEqual([2,2,2]);}finally{x.close();}
});
it.each([
  "UPDATE actual_first_base_play_ends SET snapshot_hash='foreign'",
  'DELETE FROM actual_live_play_fences',
  "UPDATE actual_live_adjudications SET source_hash='foreign'",
  "UPDATE actual_live_adjudications SET snapshot_hash='foreign'",
])('retains real sealed-end/adjudication archive rejection: %s',sql=>{
  const x=fixture();try{x.db.exec(sql);x.db.exec('BEGIN');expect(()=>proposal(x.db)).toThrow(/archive|fence|ownership|identity/);}finally{x.close();}
});
it.each([
  "INSERT INTO mutation_witness VALUES('during-consumption')",
  'CREATE TABLE main.changed_during_pair(value TEXT)',
  'CREATE TEMP TABLE changed_during_pair(value TEXT)',
  'ROLLBACK;BEGIN',
])('rejects mutation after fresh pair reconstruction and before closure returns: %s',sql=>{
  const x=fixture();try{x.db.exec('BEGIN');let reached=false;state.consumeHook=()=>{reached=true;x.db.exec(sql);};
    expect(()=>proposal(x.db)).toThrow(/read.?only|changed|transaction|savepoint/i);expect(reached).toBe(true);
    expect(x.db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);}finally{x.close();}
});
it('blocks TEMP DDL prepared before pair consumption',()=>{
  const x=fixture();try{const statement=x.db.prepare('CREATE TEMP TABLE preprepared_shadow(value TEXT)');x.db.exec('BEGIN');state.consumeHook=()=>{statement.run();};
    expect(()=>proposal(x.db)).toThrow(/read.?only|changed|schema/i);}finally{x.close();}
});
it.each([0,1])('preserves the original error, restores query_only=%s and leaves the next call fresh',setting=>{
  const x=fixture(),original=new Error('original closure consumption error');try{x.db.exec(`BEGIN;PRAGMA query_only=${setting}`);
    state.consumeHook=()=>{throw original;};let caught;try{proposal(x.db);}catch(error){caught=error;}
    expect(caught).toBe(original);expect(x.db.prepare('PRAGMA query_only').get()!.query_only).toBe(setting);
    state.consumeHook=null;state.endReads=0;proposal(x.db);expect(state.endReads).toBe(1);}finally{x.close();}
});
it('keeps the original peer WAL snapshot and rejects its changed end in the next transaction',()=>{
  const x=fixture(),peer=new Sqlite(x.path);try{x.db.exec('BEGIN');state.consumeHook=()=>{state.consumeHook=null;peer.prepare("UPDATE actual_first_base_play_ends SET snapshot_hash='peer-corruption'").run();};
    proposal(x.db);x.db.exec('COMMIT;BEGIN');expect(()=>proposal(x.db)).toThrow(/archive/);}finally{peer.close();x.close();}
});
it('does not turn a missing end into caller-provided proof',()=>{
  const x=fixture();try{x.db.exec('DELETE FROM actual_first_base_play_ends;BEGIN');expect(()=>proposal(x.db)).toThrow(/physical end|missing/);}finally{x.close();}
});

// Instrument only the existing owner boundaries. SQL, archive authentication,
// official CAS/application and all proof-scope machinery remain real.
const phases = () => {
  const reads: {name:string;db:DatabaseSync;frame:object|null;snapshot:object|null;queryOnly:unknown}[]=[];
  const writes: {frame:object|null;queryOnly:unknown}[]=[],connections=new Set<DatabaseSync>();
  let afterOfficialWrite:((db:DatabaseSync)=>void)|undefined,beforeReceiptWrite:((db:DatabaseSync)=>void)|undefined;
  const observe=(name:string,db:Pick<DatabaseSync,'prepare'>)=>{
    if(!(db instanceof Sqlite))throw new Error('expected original Native connection');
    if(!connections.has(db)){connections.add(db);const prepare=db.prepare.bind(db);
      vi.spyOn(db,'prepare').mockImplementation(sql=>{
        const statement=prepare(sql);
        const official=/^\s*INSERT\s+INTO\s+applications\b/i.test(sql),receipt=/^\s*UPDATE\s+actual_live_play_closures\b/i.test(sql);
        if(official||receipt||/^\s*INSERT\s+INTO\s+actual_live_play_closures\b/i.test(sql)){
          const run=statement.run.bind(statement);statement.run=(...args)=>{
            writes.push({frame:activeBattedWorldFieldReadFrame(db),queryOnly:prepare('PRAGMA query_only').get()!.query_only});
            if(receipt)beforeReceiptWrite?.(db);
            const result=Reflect.apply(run,statement,args);if(official)afterOfficialWrite?.(db);return result;
          };
        }
        return statement;
      });db.function('terminal_write_phase',()=>{
      writes.push({frame:activeBattedWorldFieldReadFrame(db),queryOnly:db.prepare('PRAGMA query_only').get()!.query_only});return 0;
    });}
    reads.push({name,db,frame:activeBattedWorldFieldReadFrame(db),snapshot:activeBattedWorldFieldReadSnapshot(db),queryOnly:db.prepare('PRAGMA query_only').get()!.query_only});
  };
  state.endHook=db=>observe('end',db);
  const owner=closureEvidence.actualLivePlayClosureEvidenceFromSqlite,derive=closureEvidence.deriveActualLivePlayClosureProposal;
  const open=closureEvidence.assertActualLiveClosureOpenMatch,stage=closureEvidence.assertActualLiveClosureStage;
  vi.spyOn(closureEvidence,'actualLivePlayClosureEvidenceFromSqlite').mockImplementation(db=>{
    const original=owner(db);return{read:id=>{observe('closure-read',db);return original.read(id);}};
  });
  vi.spyOn(closureEvidence,'deriveActualLivePlayClosureProposal').mockImplementation((db,...args)=>{observe('derive',db);return derive(db,...args);});
  vi.spyOn(closureEvidence,'assertActualLiveClosureOpenMatch').mockImplementation((db,...args)=>{observe('open',db);return open(db,...args);});
  vi.spyOn(closureEvidence,'assertActualLiveClosureStage').mockImplementation((db,...args)=>{observe('stage',db);return stage(db,...args);});
  const released=()=>{for(const db of connections){expect(db.isTransaction).toBe(false);expect(activeBattedWorldFieldReadFrame(db)).toBeNull();expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);}};
  return{reads,writes,connections,released,setAfterOfficialWrite(hook:(db:DatabaseSync)=>void){afterOfficialWrite=hook;},
    setBeforeReceiptWrite(hook:(db:DatabaseSync)=>void){beforeReceiptWrite=hook;}};
};
const closureFixture=()=>{
  const x=fixture(),official=new SqliteOfficialStateStore(x.path);official.initializeMatch('game',match);official.close();return x;
};
it('terminal adjudication isolates prewrite, postwrite, public read and independent retry scopes',()=>{
  const x=fixture(false),p=phases(),owner=openSqliteActualLiveAdjudicationStore(x.path,{readAcceptedAdjudication:()=>{p.released();return adjudicationSource;}});
  try{
    x.db.exec('CREATE TRIGGER inspect_adjudication_insert AFTER INSERT ON actual_live_adjudications BEGIN SELECT terminal_write_phase(); END');
    const first=owner.accept('adjudication');expect(first).toEqual(x.value);
    expect(p.reads.every(r=>r.frame!==null&&r.queryOnly===1)).toBe(true);expect(new Set(p.reads.map(r=>r.snapshot)).size).toBe(2);
    expect(p.writes).toEqual([{frame:null,queryOnly:0}]);const before=x.db.prepare('SELECT * FROM actual_live_adjudications').all();
    const count=new Set(p.reads.map(r=>r.snapshot)).size;expect(owner.read('adjudication')).toEqual(first);expect(owner.accept('adjudication')).toEqual(first);
    expect(new Set(p.reads.map(r=>r.snapshot)).size).toBe(count+2);expect(x.db.prepare('SELECT * FROM actual_live_adjudications').all()).toEqual(before);p.released();
  }finally{owner.close();x.close();}
});
it('terminal closure isolates official validation and receipt phases from writes and accepted callbacks',()=>{
  const x=closureFixture(),p=phases(),owner=openSqliteActualLivePlayClosureStore(x.path,{readAcceptedClosure:()=>{p.released();return closureSource;}});
  try{
    const queued=owner.enqueue('closure'),result=owner.resume('closure');expect(result.official).toEqual(queued.proposal.expectedOfficial);
    expect(p.reads.every(r=>r.frame!==null&&r.queryOnly===1)).toBe(true);expect(p.connections.size).toBe(2);
    expect(p.writes).toEqual(Array.from({length:3},()=>({frame:null,queryOnly:0})));
    const officialReads=p.reads.filter(r=>r.name==='closure-read'&&r.db!==p.reads[0].db);
    expect(officialReads).toHaveLength(2);expect(new Set(officialReads.map(r=>r.snapshot)).size).toBe(2);
    const before=x.db.prepare('SELECT * FROM actual_live_play_closures').all(),offset=p.reads.length;
    expect(owner.resume('closure')).toEqual(result);expect(owner.read('closure')!.result).toEqual(result);
    expect(new Set(p.reads.slice(offset).filter(r=>r.name==='closure-read').map(r=>r.snapshot)).size).toBe(3);
    expect(x.db.prepare('SELECT * FROM actual_live_play_closures').all()).toEqual(before);p.released();
  }finally{owner.close();x.close();}
});
it.each(['adjudication','enqueue','official','receipt'] as const)('terminal %s rejects write-side original corruption and preserves its actual transaction boundary',boundary=>{
  const x=closureFixture();if(boundary==='adjudication')x.db.exec('DELETE FROM actual_live_adjudications');
  const p=phases(),adjudication=openSqliteActualLiveAdjudicationStore(x.path,{readAcceptedAdjudication:()=>adjudicationSource});
  const closure=openSqliteActualLivePlayClosureStore(x.path,{readAcceptedClosure:()=>closureSource});
  try{
    if(boundary==='official'||boundary==='receipt')closure.enqueue('closure');
    const before=x.db.prepare('SELECT * FROM actual_first_base_play_ends').all();
    const table=boundary==='adjudication'?'actual_live_adjudications':boundary==='official'?'applications':'actual_live_play_closures';
    const corruptTrigger=`CREATE TRIGGER corrupt_terminal_origin AFTER ${boundary==='receipt'?'UPDATE':'INSERT'} ON ${table}
      BEGIN UPDATE actual_first_base_play_ends SET snapshot_hash='corrupt'; END;`;
    if(boundary==='official')p.setAfterOfficialWrite(db=>db.exec("UPDATE actual_first_base_play_ends SET snapshot_hash='corrupt'"));
    // The official owner rejects pre-existing closure triggers. Install this real
    // receipt trigger only at its later UPDATE, inside the closure transaction.
    else if(boundary==='receipt')p.setBeforeReceiptWrite(db=>db.exec(corruptTrigger));
    else x.db.exec(corruptTrigger);
    const run=()=>boundary==='adjudication'?adjudication.accept('adjudication'):boundary==='enqueue'?closure.enqueue('closure'):closure.resume('closure');
    expect(run).toThrow(/archive|fence/);expect(x.db.prepare('SELECT * FROM actual_first_base_play_ends').all()).toEqual(before);
    expect(x.db.prepare('SELECT count(*) n FROM applications').get()!.n).toBe(boundary==='receipt'?1:0);
    expect(x.db.prepare('SELECT status FROM actual_live_play_closures').all()).toEqual(boundary==='official'||boundary==='receipt'?[{status:'QUEUED'}]:[]);p.released();
    if(boundary==='official')p.setAfterOfficialWrite(()=>{});else if(boundary==='receipt')p.setBeforeReceiptWrite(()=>{});else x.db.exec('DROP TRIGGER corrupt_terminal_origin');
    expect(run).not.toThrow();expect(p.reads.every(r=>r.frame!==null&&r.queryOnly===1)).toBe(true);p.released();
  }finally{closure.close();adjudication.close();x.close();}
});
it('terminal completed resume reauthenticates after callback-side authority mutation',()=>{
  const x=closureFixture();let corrupt=false;
  const owner=openSqliteActualLivePlayClosureStore(x.path,{readAcceptedClosure:()=>{
    if(corrupt)x.db.exec("UPDATE actual_first_base_play_ends SET snapshot_hash='callback-corrupt'");return closureSource;
  }});
  try{
    owner.enqueue('closure');owner.resume('closure');const before=x.db.prepare('SELECT * FROM actual_live_play_closures').all();corrupt=true;
    expect(()=>owner.resume('closure')).toThrow(/archive/);expect(x.db.prepare('SELECT * FROM actual_live_play_closures').all()).toEqual(before);
  }finally{owner.close();x.close();}
});
