import { afterEach, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { dispatchDomesticCalendarDay } from './DomesticSeasonRuntime';
import { acceptedRecruitmentDayFixture } from './DomesticDayRecruitmentFixture.test-support';
import { managerBoundaryFixture } from './ManagerBeliefBoundary.test-support';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteDomesticScheduleStore } from './SqliteDomesticScheduleStore';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { canonicalRosterEvidenceJson as json } from './RosterEvidenceJson';

const cleanup: (()=>void)[] = [], directories: string[] = [];
afterEach(()=>{while(cleanup.length) cleanup.pop()!();directories.splice(0).forEach(path=>rmSync(path,{recursive:true,force:true}));});
const empty={careerId:'career-a',day:10,openings:[],market:[],roster:[]} as const;
const opening={careerId:'career-a',seasonId:'league-season-1',gameId:'series:2',ruleProfileId:NPB_2026_RULE_PROFILE.id,playId:0};
const matchFixture=()=>{
  const f=acceptedRecruitmentDayFixture(cleanup,directories),match=new SqliteOfficialStateStore(f.path);cleanup.push(()=>match.close());
  const stores={world:f.world,archive:f.calendar!,match};
  const move=()=>f.calendar!.appendRevision('career-a','league-season-1',0,{eventId:'interleaved-rainout',gameId:'series:2',newDay:11,reason:'RAINOUT'},10);
  return {f,match,stores,move,input:{...empty,openings:[opening]}};
};
it.each(['fixture','match'] as const)('rejects a real accepted rainout interleaved before the %s transaction',stage=>{
  const {f,match,stores,move,input}=matchFixture();
  if(stage==='fixture') {
    const write=match.registerOfficialFixture.bind(match);
    match.registerOfficialFixture=(...args)=>{move();return write(...args);};
  } else {
    const write=match.initializeMatch.bind(match);
    match.initializeMatch=(...args)=>{move();return write(...args);};
  }
  const result=dispatchDomesticCalendarDay(stores,input);
  expect(result.games[0].status).toBe('REJECTED');
  expect(match.getMatch('series:2')).toBeNull();
  expect(Boolean(match.getOfficialFixture('series:2'))).toBe(stage==='match');
  expect(f.calendar!.readCareerDay('career-a',11).seasons[0].games[0].gameId).toBe('series:2');
});
it.each(['official_fixtures','matches'] as const)('rolls back %s and same-connection calendar changes after the actual INSERT',table=>{
  const {f,match,stores,move,input}=matchFixture();
  const before=f.db.prepare('SELECT * FROM world_domestic_schedules').get()!;
  const beforeWorld=f.db.prepare('SELECT * FROM world_season_heads').get()!;
  move();
  const moved=f.db.prepare('SELECT * FROM world_domestic_schedules').get()!;
  const movedWorld=f.db.prepare('SELECT * FROM world_season_heads').get()!;
  f.db.prepare('UPDATE world_domestic_schedules SET revision=?,records_json=?').run(before.revision,before.records_json);
  f.db.prepare('UPDATE world_season_heads SET schedule_json=?,standings_json=?').run(beforeWorld.schedule_json,beforeWorld.standings_json);
  const witness=witnessSqliteWrite(new RegExp(`INSERT INTO ${table}\\s*\\(`),db=>{
    db.prepare('UPDATE world_domestic_schedules SET revision=?,records_json=?').run(moved.revision,moved.records_json);
    db.prepare('UPDATE world_season_heads SET schedule_json=?,standings_json=?').run(movedWorld.schedule_json,movedWorld.standings_json);
    return true;
  });
  try {
    expect(dispatchDomesticCalendarDay(stores,input).games[0].status).toBe('REJECTED');
    expect(witness.wasReached()).toBe(true);
  } finally {witness.close();}
  expect(match.getMatch('series:2')).toBeNull();
  expect(Boolean(match.getOfficialFixture('series:2'))).toBe(table==='matches');
  expect(f.db.prepare('SELECT * FROM world_domestic_schedules').get()).toEqual(before);
  expect(f.db.prepare('SELECT * FROM world_season_heads').get()).toEqual(beforeWorld);
});
const rosterFixture=(stableEstimate=false)=>{
  const f=managerBoundaryFixture(cleanup,stableEstimate),roster=openSqliteManagerRosterDecisionStore(f.databasePath);
  const world=openSqliteWorldSettlementStore(f.databasePath),archive=openSqliteDomesticScheduleStore(f.databasePath),match=new SqliteOfficialStateStore(f.databasePath);
  cleanup.push(()=>roster.close(),()=>world.close(),()=>archive.close(),()=>match.close());
  const original=roster.readOpportunity('career-a','club-a','decision-1')!;
  const opportunity={careerId:'career-a',clubId:'club-a',expectedClubRevision:0,expectedRosterRevision:1,clubAsOfDay:12,
    control:original.control,decisionId:'decision-2',contextId:'context-2',worldRevision:1,managerId:'manager-a',appointmentId:'appointment-a',
    candidates:[{actionId:'rest-p1',command:{commandId:'rest-p1',expectedRevision:1,effectiveDay:12,
      changes:[{playerId:'p1',availability:{status:'AVAILABLE' as const,evidenceId:'recovered-1'}}]}}]};
  const input={...empty,day:12,roster:[{opportunity,managerBeliefRevision:0}]};
  return {f,roster,input,stores:{world,archive,match,roster,belief:f.history}};
};
it.each([false,true])('rejects a real interleaved observation at Native admission, including equal agent values=%s',stableEstimate=>{
  const {f,roster,input,stores}=rosterFixture(stableEstimate);
  let observed=false;
  const readHead=stores.belief.readHead;
  const belief={...stores.belief,readHead:(...args:Parameters<typeof readHead>)=>{
    const before=readHead(...args);if(!observed){observed=true;f.first();}return before;
  }};
  const result=dispatchDomesticCalendarDay({...stores,belief},input);
  expect(observed).toBe(true);
  expect(result.roster[0].status).toBe('REJECTED');
  expect(roster.readOpportunity('career-a','club-a','decision-2')).toBeNull();
  expect(f.history.readHead('career-a','manager-a')!.revision).toBe(1);
});
it('pins original belief provenance even when a later authentic observation leaves the agent values equal',()=>{
  const {f,roster,input,stores}=rosterFixture(true);
  const issued=dispatchDomesticCalendarDay(stores,input);
  expect(issued.roster[0].status).toBe('INCOMPLETE');
  const before=f.history.readHead('career-a','manager-a')!,after=f.first().state;
  expect(after.agent).toEqual(before.agent);expect(after.revision).toBe(1);
  const reopened=openSqliteManagerRosterDecisionStore(f.databasePath);cleanup.push(()=>reopened.close());
  expect(dispatchDomesticCalendarDay({...stores,roster:reopened},input).roster).toEqual(issued.roster);
  expect(dispatchDomesticCalendarDay(stores,{...input,roster:[{...input.roster[0],managerBeliefRevision:1}]}).roster[0].status).toBe('REJECTED');
  expect(roster.readOpportunity('career-a','club-a','decision-2')).toEqual(issued.roster[0].result!.opportunity);
});
it('rolls back a writer-local removal of the newly pinned belief revision',()=>{
  const {f,roster,input,stores}=rosterFixture();
  const before=f.snapshot();
  const witness=witnessSqliteWrite(/INSERT INTO world_roster_opportunities\s/,db=>{
    const row=db.prepare("SELECT issued_json FROM world_roster_opportunities WHERE decision_id='decision-2'").get()!;
    const issued=JSON.parse(String(row.issued_json));delete issued.managerBeliefRevision;
    db.prepare("UPDATE world_roster_opportunities SET issued_json=? WHERE decision_id='decision-2'").run(json(issued));return true;
  });
  try {
    expect(dispatchDomesticCalendarDay(stores,input).roster[0].status).toBe('REJECTED');
    expect(witness.wasReached()).toBe(true);
  } finally {witness.close();}
  expect(roster.readOpportunity('career-a','club-a','decision-2')).toBeNull();expect(f.snapshot()).toBe(before);
});

it('rejects a copied calendar on another Match database before either accepted-day write',()=>{
  const original=matchFixture(),copy=matchFixture();
  // Both independent Native files currently contain equal calendar/World data.
  const result=dispatchDomesticCalendarDay({...original.stores,match:copy.match},original.input);
  expect(result.games[0]).toMatchObject({status:'REJECTED',reason:'accepted domestic day calendar is not on its Match writer connection'});
  expect(copy.match.getOfficialFixture('series:2')).toBeNull();expect(copy.match.getMatch('series:2')).toBeNull();
});
