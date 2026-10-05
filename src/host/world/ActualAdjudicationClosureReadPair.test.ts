import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, expect, it, vi } from 'vitest';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';

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
vi.mock('./SqliteBattedWorldFieldStore', async original => ({
  ...await original<typeof import('./SqliteBattedWorldFieldStore')>(),
  battedWorldFieldEvidenceFromSqlite: () => ({ read: () => { state.fieldReads++; return state.base; },
    scope: () => { state.fieldScopes++; return [state.base]; } }),
}));
vi.mock('./SqliteBattedWorldFieldExecutionStore', async original => ({
  ...await original<typeof import('./SqliteBattedWorldFieldExecutionStore')>(),
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
const fixture = () => {
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
  db.prepare('INSERT INTO actual_live_adjudications VALUES(?,?,?,?,?,?,?,?)').run('adjudication','game',7,'end',json(adjudicationSource),hash(adjudicationSource),json(value),hash(value));
  expect(json(owner.read('adjudication'))).toBe(json(value));
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
