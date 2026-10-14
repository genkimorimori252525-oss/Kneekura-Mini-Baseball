import { createClubWageScheduleLedger } from '../../core/world/club/ClubWageScheduleLedger';
import { openSqliteClubEconomyStore } from './SqliteClubEconomyStore';
import { persistClubEconomyOperation } from './ClubEconomyOperationDriver';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { createBaseScheduleSnapshot } from '../../core/world/competition/LeagueSchedule';
import { buildOfficialStandings } from '../../core/world/competition/OfficialStandings';
import { captureOfficialStandingsSchedule } from '../../core/world/competition/OfficialStandingsScheduleSource';
import type { OfficialGameResult } from '../../core/world/competition/OfficialGameCompletion';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteDomesticScheduleStore } from './SqliteDomesticScheduleStore';
import { openSqliteDomesticCompetitionSeasonStore, type DomesticCompetitionSourceRequest } from './SqliteDomesticCompetitionSeasonStore';
import { createDomesticParticipationAuthority } from './SqliteOfficialParticipationAuthority';
import { projectConferenceDomesticCompetitionFromWorld } from './ConferenceDomesticCompetitionFromWorld';
import { projectNorthAmericaDomesticCompetitionFromWorld } from './NorthAmericaDomesticCompetitionFromWorld';

const closes: (() => void)[] = [], directories: string[] = [];
afterEach(() => { closes.splice(0).reverse().forEach(close => close()); directories.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })); });
const setup = (kind: 'DIRECT' | 'CONFERENCE' | 'NORTH_AMERICA' | 'WINTER' = 'DIRECT') => {
  const [count, volume, leagueId] = kind === 'DIRECT' ? [4,108,'league-006'] as const : kind === 'CONFERENCE'
    ? [12,120,'league-001'] as const : kind === 'NORTH_AMERICA' ? [30,162,'league-008'] as const : [6,100,'league-010'] as const;
  const clubs = Array.from({ length: count }, (_, index) => `club-${index + 1}`);
  const matrix = clubs.flatMap((homeClubId, index) => clubs.slice(index + 1).map((awayClubId, offset) => ({ homeClubId, awayClubId,
    gameCount: kind === 'DIRECT' ? 36 : kind === 'WINTER' ? 20 : kind === 'CONFERENCE' ? index % 2 === 0 && offset === 0 ? 20 : 10
      : Math.min(offset + 1, count - offset - 1) <= 8 || offset + 1 === 15 ? 6 : 5 })));
  let nextDay = 11;
  const series = matrix.flatMap((pair, pairIndex) => {
    const sizes: (2|3|4)[] = []; let remaining = pair.gameCount;
    while (remaining) { const size = remaining === 4 ? 4 : remaining === 2 ? 2 : 3; sizes.push(size); remaining -= size; }
    return sizes.map((gameCount, part) => { const row = { seriesId: `regular-${pairIndex}-${part}`, homeClubId: pair.homeClubId,
      awayClubId: pair.awayClubId, startsOnDay: nextDay, gameCount }; nextDay += gameCount; return row; });
  });
  const baseSchedule = createBaseScheduleSnapshot({ seasonId: 'league-season-1', leagueId, calendarProfileVersion: 'league-calendar-v1',
    generatorVersion: 'generator-v1', scheduleSeed: 'seed', opponentMatrixVersion: 'matrix-v1', regularSeasonGamesPerClub: volume,
    memberClubIds: clubs, opponentMatrix: matrix, allowedDays: Array.from({ length: nextDay - 11 }, (_, i) => i + 11),
    reservedWindows: [{ kind: 'POSTSEASON', startsOnDay: nextDay, endsOnDay: nextDay + 100 }], series });
  const schedule = captureOfficialStandingsSchedule(baseSchedule, []), policy = { version: 'standings-v1', tieCreditNumerator: 1,
    tieCreditDenominator: 2, runDifferentialCapPerGame: 10 };
  const resultFor = (game: {gameId:string;homeClubId:string;awayClubId:string}, index: number): OfficialGameResult => {
    const homeWins = clubs.indexOf(game.homeClubId) < clubs.indexOf(game.awayClubId), home = homeWins ? 1 : 0, away = homeWins ? 0 : 1;
    return { ...game, seasonId: 'league-season-1', homeRuns: home, awayRuns: away, winnerClubId: homeWins ? game.homeClubId : game.awayClubId,
      completionReason: 'BOTTOM_COMPLETE', ruleProfileId: NPB_2026_RULE_PROFILE.id, gamePolicyVersion: 'completion-v1', closureId: `closure-${index}`,
      applicationId: `application-${index}`, durableRevision: 1, venueBinding: { gameId: game.gameId, venueId: 'stadium-a', fixtureEventId: `regular-fixture-${index}`, fixtureRevision: 1 },
      lineScore: { innings: [{ inning: 1, homeRuns: home, awayRuns: away }], totals: { home: { runs: home, hits: home, errors: 0 }, away: { runs: away, hits: away, errors: 0 } } } };
  };
  // Completed regular-season readers are an explicit structural seam. New plan,
  // Club journal, fixture and Match effects below use actual SQLite owners.
  const results = baseSchedule.games.map(resultFor), regular = new Map(results.map(result => [result.gameId, result]));
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-postseason-')); directories.push(directory);
  const path = join(directory, 'world.sqlite'), world = openSqliteWorldSettlementStore(path), archive = openSqliteDomesticScheduleStore(path), match = new SqliteOfficialStateStore(path);
  const original = state();
  world.initialize({ careerId: 'career-a', schedule, standingsPolicy: policy, clubs: clubs.map(clubId => ({ ...original,
    identity: { ...original.identity, clubId }, live: { ...original.live, references: { ...original.live.references, rivalryStateRefs: [] } },
    season: { ...original.season, plan: { ...original.season.plan, financialProfile: { ...original.season.plan.financialProfile, leagueId } } } })) });
  archive.initialize('career-a', baseSchedule);
  const completed = { careerId: 'career-a', seasonId: schedule.seasonId, revision: results.length, schedule, standingsPolicy: policy,
    results, standings: { kind: 'OFFICIAL' as const, snapshot: buildOfficialStandings(schedule, results, policy) } };
  const initial = { ruleProfileId: NPB_2026_RULE_PROFILE.id, inning: 1, half: 'top' as const, outs: 0, balls: 0, strikes: 0,
    bases: { first: null, second: null, third: null }, score: { home: 0, away: 0 }, playId: 0 };
  const sources = { world: { ...world, readSeason: () => completed }, archive, match: {
    getMatch: (gameId:string) => { const finalResult = regular.get(gameId); return finalResult ? { durableRevision: 1, matchState: initial, activation: null, nextWorld: null, finalResult } : match.getMatch(gameId); },
    getOfficialFixture: (gameId:string) => regular.get(gameId)?.venueBinding ?? match.getOfficialFixture(gameId),
    registerOfficialFixture: match.registerOfficialFixture.bind(match), initializeMatch: match.initializeMatch.bind(match),
  } };
  const common = { careerId: 'career-a', seasonId: schedule.seasonId, competitionEditionId: 'continental', berthCount: 1,
    alreadyQualifiedClubIds: [], eligibilityByClubId: Object.fromEntries(clubs.map(id => [id, { eligible: true }])) };
  const plan = (id:string, high:string, low:string, bestOf:number) => ({ seriesId:id, seasonId:schedule.seasonId, bestOf, higherSeedClubId:high,
    lowerSeedClubId:low, scheduledGames:Array.from({ length:bestOf }, (_,i) => ({ gameId:`${id}:${i+1}`, homeClubId:high, awayClubId:low })) });
  let request: DomesticCompetitionSourceRequest;
  if (kind === 'DIRECT') request = { kind, input: { ...common, qualificationPolicyVersion:'qual-v1', postseasonPlans:[{ stage:'final', plan:plan('final','club-1','club-2',5) }] } };
  else if (kind === 'CONFERENCE') {
    const input = { ...common, alignment:{ version:'alignment-v1',seasonId:schedule.seasonId,leagueId, groups:[{groupId:'a',clubIds:clubs.slice(0,6)},{groupId:'b',clubIds:clubs.slice(6)}]},
      policy:{version:'japan-v1',format:'JAPAN' as const,championshipHigherSeedGroupId:'a',qualificationPolicyVersion:'qual-v1',qualificationPriorityGroupIds:['a','b']},
      groupPlans:[{groupId:'a',series:[]},{groupId:'b',series:[]}],championshipPlan:null };
    const next = projectConferenceDomesticCompetitionFromWorld(sources,input)!.postseason.nextGroupSeries;
    request = { kind,input:{...input,groupPlans:input.groupPlans.map(group => ({...group,series:next.filter(item=>item.groupId===group.groupId).map(item=>({stage:item.stage,plan:plan(group.groupId,item.higherSeedClubId,item.lowerSeedClubId,item.bestOf)}))}))} };
  } else if (kind === 'NORTH_AMERICA') {
    const input = { ...common, conferenceAlignment:{version:'conf-v1',seasonId:schedule.seasonId,leagueId,groups:[{groupId:'a',clubIds:clubs.slice(0,15)},{groupId:'b',clubIds:clubs.slice(15)}]},
      divisionAlignment:{version:'div-v1',seasonId:schedule.seasonId,leagueId,groups:Array.from({length:6},(_,i)=>({groupId:`division-${i}`,clubIds:clubs.slice(i*5,i*5+5)}))},
      policy:{version:'na-v1',championshipHigherSeedConferenceId:'a',bracket:{seedSources:['DIVISION_WINNER_1','DIVISION_WINNER_2','DIVISION_WINNER_3','WILD_CARD_1','WILD_CARD_2','WILD_CARD_3'] as const,
        wildCardPairings:[[3,6],[4,5]] as const,divisionByes:[1,2],divisionPairings:[[1,1],[2,0]] as const}},
      conferencePlans:[{conferenceId:'a',series:[]},{conferenceId:'b',series:[]}],championshipPlan:null,qualificationPolicyVersion:'qual-v1' };
    const next=projectNorthAmericaDomesticCompetitionFromWorld(sources,input)!.postseason.nextConferenceSeries;
    request={kind,input:{...input,conferencePlans:input.conferencePlans.map(group=>({...group,series:next.filter(item=>item.conferenceId===group.conferenceId).map(item=>({stage:item.stage,plan:plan(`${group.conferenceId}-${item.stage}`,item.higherSeedClubId,item.lowerSeedClubId,item.bestOf)}))}))}};
  } else request = { kind, input: { ...common, version:'winter-v1', roundGames: clubs.slice(0,4).flatMap((homeClubId,i)=>clubs.slice(0,4).filter(id=>id!==homeClubId).map((awayClubId,j)=>({ gameId:`round-${i}-${j}`,day:nextDay+i*3+j,homeClubId,awayClubId }))), roundTiebreakPolicy:policy,tiebreakPlans:[],finalPlan:null,qualificationPolicyVersion:'qual-v1' } };
  const games=request.kind==='DIRECT'?request.input.postseasonPlans.flatMap(e=>e.plan.scheduledGames):request.kind==='CONFERENCE'?request.input.groupPlans.flatMap(g=>g.series.flatMap(e=>e.plan.scheduledGames))
    :request.kind==='NORTH_AMERICA'?request.input.conferencePlans.flatMap(g=>g.series.flatMap(e=>e.plan.scheduledGames)):request.input.roundGames;
  const source={sourceId:'postseason-plan-1',sourceVersion:'v1',expectedRevision:0,request,gameDays:games.map((game,i)=>({gameId:game.gameId,day:nextDay+i}))};
  const competition=openSqliteDomesticCompetitionSeasonStore(path,sources); const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'); const db=new DatabaseSync(path);
  closes.push(()=>world.close(),()=>archive.close(),()=>match.close(),()=>competition.close(),()=>db.close());
  return {path,world,archive,match,competition,db,sources,source,initial,games,nextDay,resultFor,regular};
};

it.each(['DIRECT','CONFERENCE','NORTH_AMERICA','WINTER'] as const)('persists %s accepted calendar and prepares a real opening Match', kind => {
  const f=setup(kind), accepted=f.competition.acceptPostseasonPlan(f.source);
  const prepared=f.competition.preparePostseasonMatch({ sourceId:f.source.sourceId,gameId:f.games[0].gameId,ruleProfileId:NPB_2026_RULE_PROFILE.id,playId:0 });
  expect(accepted.revision).toBe(1);
  expect(prepared.match.matchState).toEqual(f.initial);
  expect(f.match.getOfficialFixture(f.games[0].gameId)).toEqual(prepared.fixture);
  expect(prepared.fixture.venueId).toBe('stadium-a');
  expect(f.match.getMatch(f.games[0].gameId)).toEqual(prepared.match);
  expect(f.competition.readPostseasonPlan(f.source.sourceId)).toEqual(accepted);
});

const opening = (f: ReturnType<typeof setup>, gameId = f.games[0].gameId) => ({ sourceId:f.source.sourceId,gameId,ruleProfileId:NPB_2026_RULE_PROFILE.id,playId:0 });
it('retains the original accepted plan and participant game scope after interrupted Match creation and reopen', () => {
  const f=setup(); f.competition.acceptPostseasonPlan(f.source);
  f.db.exec("CREATE TRIGGER fail_postseason BEFORE INSERT ON matches BEGIN SELECT RAISE(ABORT,'opening interrupted'); END");
  expect(()=>f.competition.preparePostseasonMatch(opening(f))).toThrow('opening interrupted');
  const fixture=f.match.getOfficialFixture(f.games[0].gameId); expect(fixture).not.toBeNull(); expect(f.match.getMatch(f.games[0].gameId)).toBeNull();
  f.db.exec('DROP TRIGGER fail_postseason');
  const reopened=openSqliteDomesticCompetitionSeasonStore(f.path,f.sources); closes.push(()=>reopened.close());
  const prepared=reopened.preparePostseasonMatch(opening(f)); expect(prepared.fixture).toEqual(fixture);
  expect(reopened.preparePostseasonMatch(opening(f))).toEqual(prepared);
  expect(()=>reopened.preparePostseasonMatch({...opening(f),playId:1})).toThrow('different state');
  expect(reopened.acceptPostseasonPlan(f.source)).toEqual(f.competition.readPostseasonPlan(f.source.sourceId));
  const authority=createDomesticParticipationAuthority({careerId:'career-a',seasonId:'league-season-1',world:f.sources.world, schedule:f.archive,
    match:f.match,roster:{} as never,personLinks:{readAcceptedPlayerPersonLink:()=>null},postseason:reopened});
  expect(authority.readGame(f.games[0].gameId)).toEqual({careerId:'career-a',competitionEditionId:'league-season-1',gameDay:f.nextDay,
    homeClubId:f.games[0].homeClubId,awayClubId:f.games[0].awayClubId,fixtureEventId:fixture!.fixtureEventId});
});

it('rejects stale plans, changed accepted dates and invalid calendar/profile before fixture effects', () => {
  const f=setup();
  for (const source of [
    {...f.source,expectedRevision:1},
    {...f.source,gameDays:f.source.gameDays.map((game,index)=>index===0?{...game,day:0}:game)},
    {...f.source,gameDays:f.source.gameDays.slice(1)},
  ]) expect(()=>f.competition.acceptPostseasonPlan(source)).toThrow();
  expect(f.competition.readPostseasonPlan(f.source.sourceId)).toBeNull();
  f.competition.acceptPostseasonPlan(f.source);
  expect(()=>f.competition.acceptPostseasonPlan({...f.source,gameDays:f.source.gameDays.map(game=>({...game,day:game.day+1}))})).toThrow('frozen differently');
  expect(()=>f.competition.preparePostseasonMatch({...opening(f),ruleProfileId:'unknown' as never})).toThrow('unsupported rule profile');
  expect(()=>f.competition.preparePostseasonMatch(opening(f,f.games[1].gameId))).toThrow('next required');
  expect(f.match.getOfficialFixture(f.games[0].gameId)).toBeNull();
  expect(f.match.getOfficialFixture(f.games[1].gameId)).toBeNull();
});

it('rolls back an actual plan INSERT rewrite and detects a later self-consistent changed origin through the pinned fixture', () => {
  const f=setup();
  f.db.exec(`CREATE TRIGGER rewrite_postseason AFTER INSERT ON world_domestic_postseason_plans BEGIN
    UPDATE world_domestic_postseason_plans SET source_json=json_set(source_json,'$.sourceVersion','rewritten'); END`);
  expect(()=>f.competition.acceptPostseasonPlan(f.source)).toThrow();
  expect(f.competition.readPostseasonPlan(f.source.sourceId)).toBeNull();
  f.db.exec('DROP TRIGGER rewrite_postseason');
  f.competition.acceptPostseasonPlan(f.source); f.competition.preparePostseasonMatch(opening(f));
  const raw=JSON.parse((f.db.prepare('SELECT source_json FROM world_domestic_postseason_plans').get() as {source_json:string}).source_json);
  raw.sourceVersion='changed-after-fixture';
  const canonical=(value:unknown):string=>JSON.stringify(value,(_key,item:unknown)=>item!==null&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a<b?-1:a>b?1:0)):item);
  f.db.prepare('UPDATE world_domestic_postseason_plans SET source_json=?').run(canonical(raw));
  expect(()=>f.competition.readPostseasonPlan(f.source.sourceId)).toThrow('original fixture');
  expect(()=>f.competition.preparePostseasonMatch(opening(f))).toThrow('original fixture');
});

it('honors the Match-reader final prefix and refuses an unnecessary game after the series is clinched', () => {
  const f=setup(); f.competition.acceptPostseasonPlan(f.source);
  for (const [index,game] of f.games.slice(0,3).entries()) {
    const prepared=f.competition.preparePostseasonMatch(opening(f,game.gameId));
    // Same explicit result-reader seam as the original regular-season completion fixture.
    f.regular.set(game.gameId,{...f.resultFor(game,10000+index),venueBinding:prepared.fixture});
  }
  expect(()=>f.competition.preparePostseasonMatch(opening(f,f.games[3].gameId))).toThrow('next required');
  expect(f.match.getOfficialFixture(f.games[3].gameId)).toBeNull();
  f.db.exec(`CREATE TRIGGER erase_postseason AFTER INSERT ON world_domestic_competition_seasons BEGIN DELETE FROM world_domestic_postseason_plans; END`);
  expect(()=>f.competition.finalize(f.source.request)).toThrow();
  expect(f.competition.readSnapshot('career-a','league-season-1')).toBeNull();
  expect(f.competition.readPostseasonPlan(f.source.sourceId)).not.toBeNull();
  f.db.exec('DROP TRIGGER erase_postseason');
  expect(f.competition.finalize(f.source.request).domesticChampionSnapshot.championClubId).toBe('club-1');
  const request=f.source.request;
  if(request.kind!=='DIRECT') throw new Error('fixture format');
  expect(()=>f.competition.finalize({...request,input:{...request.input,competitionEditionId:'different'}})).toThrow('accepted postseason plan');
});

it('extends a Conference plan from actual-reader preceding wins while retaining the original fixture origin', () => {
  const f=setup('CONFERENCE'); f.competition.acceptPostseasonPlan(f.source);
  if(f.source.request.kind!=='CONFERENCE') throw new Error('fixture format');
  const first=f.source.request.input.groupPlans[0].series[0].plan;
  let originalFixture;
  for(const [index,game] of first.scheduledGames.slice(0,2).entries()) {
    const prepared=f.competition.preparePostseasonMatch(opening(f,game.gameId)); originalFixture??=prepared.fixture;
    f.regular.set(game.gameId,{...f.resultFor(game,20000+index),venueBinding:prepared.fixture});
  }
  const expected=projectConferenceDomesticCompetitionFromWorld(f.sources,f.source.request.input)!.postseason.nextGroupSeries.find(item=>item.groupId==='a')!;
  const plan={seriesId:'a-final',seasonId:'league-season-1',bestOf:expected.bestOf,higherSeedClubId:expected.higherSeedClubId,lowerSeedClubId:expected.lowerSeedClubId,
    scheduledGames:Array.from({length:expected.bestOf},(_,index)=>({gameId:`a-final:${index+1}`,homeClubId:expected.higherSeedClubId,awayClubId:expected.lowerSeedClubId}))};
  const source={...f.source,sourceId:'postseason-plan-2',expectedRevision:1,request:{...f.source.request,input:{...f.source.request.input,
    groupPlans:f.source.request.input.groupPlans.map(group=>group.groupId==='a'?{...group,series:[...group.series,{stage:expected.stage,plan}]}:group)}},
    gameDays:[...f.source.gameDays,...plan.scheduledGames.map((game,index)=>({gameId:game.gameId,day:f.nextDay+20+index}))]};
  expect(f.competition.acceptPostseasonPlan(source).revision).toBe(2);
  expect(f.competition.readPostseasonGame('career-a','league-season-1',first.scheduledGames[0].gameId)!.fixture).toEqual(originalFixture);
  const prepared=f.competition.preparePostseasonMatch({...opening(f,plan.scheduledGames[0].gameId),sourceId:source.sourceId});
  expect(prepared.match.matchState).toEqual(f.initial);
  expect(f.competition.readPostseasonPlan(f.source.sourceId)!.revision).toBe(1);
  expect(()=>f.competition.acceptPostseasonPlan({...source,sourceId:'stale'})).toThrow('stale');
});

it('retains the original venue journal prefix across later same-day Club revenue, reopen and title finalization', () => {
  const f=setup(), economy=openSqliteClubEconomyStore(f.path); closes.push(()=>economy.close());
  const receive=(eventId:string) => {
    const club=f.world.readClub('career-a',f.games[0].homeClubId)!.state;
    return persistClubEconomyOperation(economy,{kind:'STRUCTURAL_REVENUE',applicationId:eventId,expectedClubRevision:club.revision,
      club,history:f.world.readClubHistory('career-a',club.identity.clubId)!,wageSchedules:createClubWageScheduleLedger('career-a',club.identity.clubId),
      fact:{factId:eventId,careerId:'career-a',clubId:club.identity.clubId,season:1,category:'commercial',settlementRef:`settlement-${eventId}`,
        sourceEventId:`receipt-${eventId}`,receivedAtDay:f.nextDay,availableAtDay:f.nextDay,capacityRevisionAtReceipt:club.revision,amount:1,currency:'SIM'},
      policy:{policyId:'revenue-v1',version:'v1',careerId:'career-a',clubId:club.identity.clubId,season:1,availableAtDay:f.nextDay,currency:'SIM',
        maximumSeasonAmount:700,allowedCategories:['commercial']}});
  };
  receive('before-fixture');
  const originalRevision=f.world.readClub('career-a',f.games[0].homeClubId)!.revision;
  f.competition.acceptPostseasonPlan(f.source);
  const prepared=f.competition.preparePostseasonMatch(opening(f));
  receive('after-fixture');
  expect(f.world.readClub('career-a',f.games[0].homeClubId)!.revision).toBe(originalRevision+1);
  const reopened=openSqliteDomesticCompetitionSeasonStore(f.path,f.sources); closes.push(()=>reopened.close());
  expect(reopened.preparePostseasonMatch(opening(f))).toEqual(prepared);
  expect(reopened.readPostseasonGame('career-a','league-season-1',f.games[0].gameId)!.fixture).toEqual(prepared.fixture);
  expect(reopened.acceptPostseasonPlan(f.source)).toEqual(reopened.readPostseasonPlan(f.source.sourceId));
  for(const [index,game] of f.games.slice(0,3).entries()) {
    const result=reopened.preparePostseasonMatch(opening(f,game.gameId));
    f.regular.set(game.gameId,{...f.resultFor(game,30000+index),venueBinding:result.fixture});
  }
  expect(reopened.finalize(f.source.request).domesticChampionSnapshot.championClubId).toBe('club-1');
  f.db.prepare('DELETE FROM world_club_event_journal WHERE career_id=? AND club_id=? AND after_revision=?')
    .run('career-a',f.games[0].homeClubId,originalRevision);
  expect(()=>reopened.readPostseasonGame('career-a','league-season-1',f.games[0].gameId)).toThrow();
  expect(()=>reopened.readSnapshot('career-a','league-season-1')).toThrow();
  expect(f.match.getOfficialFixture(f.games[0].gameId)).toEqual(prepared.fixture);
});
