import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { dispatchDomesticCalendarDay } from './DomesticSeasonRuntime';
import { openSqliteDomesticScheduleStore } from './SqliteDomesticScheduleStore';
import { afterEach, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { acceptedRecruitmentDayFixture } from './DomesticDayRecruitmentFixture.test-support';

const closes: (() => void)[] = [], directories: string[] = [];
afterEach(()=>{closes.splice(0).reverse().forEach(close=>close());directories.splice(0).forEach(path=>rmSync(path,{recursive:true,force:true}));});
it('reads actual due games, calendar origins and revised dates from the registered Career calendars',()=>{
  const f=acceptedRecruitmentDayFixture(closes,directories), calendar=f.calendar!;
  const day=calendar.readCareerDay('career-a',10);
  expect(day.missingScheduleSeasonIds).toEqual([]);
  expect(day.seasons[0].games.map(game=>game.gameId)).toEqual(['series:2']);
  expect(day.seasons[0].marketTriggers[0]).toEqual(calendar.captureMarketTriggerReference('career-a',calendar.marketTriggersOnDay('career-a','league-season-1',10)[0]));
  calendar.appendRevision('career-a','league-season-1',0,{eventId:'rainout',gameId:'series:2',newDay:11,reason:'RAINOUT'},10);
  expect(calendar.readCareerDay('career-a',10).seasons[0].games).toEqual([]);
  expect(calendar.readCareerDay('career-a',11).seasons[0].games.map(game=>game.gameId)).toEqual(['series:2']);
});
it('authenticates the exact accepted market association and decision day on the decision writer',()=>{
  const f=acceptedRecruitmentDayFixture(closes,directories),calendar=f.calendar!;
  const origin=calendar.captureMarketTriggerReference('career-a',calendar.marketTriggersOnDay('career-a','league-season-1',9)[0]);
  const other=calendar.captureMarketTriggerReference('career-a',calendar.marketTriggersOnDay('career-a','league-season-1',10)[0]);
  f.recruitment.set(f.source.sourceId,{...f.source,marketOrigin:origin});
  f.owner.acceptScouting('scout-e',0);f.owner.acceptScouting('scout-r',1);
  expect(()=>f.owner.acceptDecision(f.source.sourceId,0,{origin:other,decisionDay:10})).toThrow('market origin');
  expect(f.owner.readDecision(f.source.sourceId)).toBeNull();
  const saved=f.owner.acceptDecision(f.source.sourceId,0,{origin,decisionDay:10});
  expect(()=>f.owner.acceptDecision(f.source.sourceId,0,{origin,decisionDay:11})).toThrow('calendar day');
  expect(f.owner.acceptDecision(f.source.sourceId,0,{origin,decisionDay:10})).toEqual(saved);
});
const baseInput={careerId:'career-a',day:10,openings:[],market:[],roster:[]} as const;
it('keeps missing inputs and interrupted writes visible, then reopens and retries the accepted day',()=>{
  const f=acceptedRecruitmentDayFixture(closes,directories),match=new SqliteOfficialStateStore(f.path);closes.push(()=>match.close());
  const stores={world:f.world,archive:f.calendar!,match};
  expect(dispatchDomesticCalendarDay(stores,baseInput).games[0]).toMatchObject({status:'MISSING_INPUT',reason:'OPENING_MATCH_INPUT'});
  f.db.exec("CREATE TRIGGER interrupt_day BEFORE INSERT ON matches BEGIN SELECT RAISE(ABORT,'day interrupted'); END");
  const input={...baseInput,openings:[{careerId:'career-a',seasonId:'league-season-1',gameId:'series:2',ruleProfileId:NPB_2026_RULE_PROFILE.id,playId:0}]};
  expect(dispatchDomesticCalendarDay(stores,input).games[0]).toMatchObject({status:'REJECTED',reason:'day interrupted'});
  expect(match.getOfficialFixture('series:2')).not.toBeNull();expect(match.getMatch('series:2')).toBeNull();
  f.db.exec('DROP TRIGGER interrupt_day');
  const reopened=new SqliteOfficialStateStore(f.path),archive=openSqliteDomesticScheduleStore(f.path);closes.push(()=>reopened.close(),()=>archive.close());
  const result=dispatchDomesticCalendarDay({...stores,match:reopened,archive},input);
  expect(result.games[0]).toMatchObject({status:'INCOMPLETE',reason:'MATCH_EXECUTION',result:{match:{durableRevision:0}}});
  expect(reopened.getMatch('series:2')).not.toBeNull();
  expect(dispatchDomesticCalendarDay(stores,input)).toEqual(result);
  expect(result.outstanding.some(item=>item.reason==='ACCEPTED_MARKET_DECISION_INPUT')).toBe(true);
});

it('rejects a moved original on partial retry and never prepares it using an obsolete day',()=>{
  const f=acceptedRecruitmentDayFixture(closes,directories),match=new SqliteOfficialStateStore(f.path);closes.push(()=>match.close());
  const stores={world:f.world,archive:f.calendar!,match};
  const input={...baseInput,openings:[{careerId:'career-a',seasonId:'league-season-1',gameId:'series:2',ruleProfileId:NPB_2026_RULE_PROFILE.id,playId:0}]};
  f.db.exec("CREATE TRIGGER interrupt_fixture BEFORE INSERT ON official_fixtures BEGIN SELECT RAISE(ABORT,'fixture interrupted'); END");
  expect(dispatchDomesticCalendarDay(stores,input).games[0].status).toBe('REJECTED');
  f.db.exec('DROP TRIGGER interrupt_fixture');
  f.calendar!.appendRevision('career-a','league-season-1',0,{eventId:'rainout',gameId:'series:2',newDay:11,reason:'RAINOUT'},10);
  const retry=dispatchDomesticCalendarDay(stores,input);
  expect(retry.games[0]).toMatchObject({status:'REJECTED',reason:'opening Match is not due on the accepted calendar day'});
  expect(match.getMatch('series:2')).toBeNull();
  expect(dispatchDomesticCalendarDay(stores,{...input,day:11}).games[0].status).toBe('INCOMPLETE');
});

import { openSqliteFreeAgentContractStore } from './SqliteFreeAgentContractStore';
import { openSqliteRecruitmentEvidenceStore } from './SqliteRecruitmentEvidenceStore';
it('retains an accepted calendar decision when contract delivery fails and reopens both owners for exact delivery',()=>{
  const f=acceptedRecruitmentDayFixture(closes,directories),match=new SqliteOfficialStateStore(f.path);closes.push(()=>match.close());
  const origin=f.calendar!.captureMarketTriggerReference('career-a',f.calendar!.marketTriggersOnDay('career-a','league-season-1',9)[0]);
  f.recruitment.set(f.source.sourceId,{...f.source,marketOrigin:origin});
  f.owner.acceptScouting('scout-e',0);f.owner.acceptScouting('scout-r',1);
  const {decisions:_decisions,...contract}=f.x.request;
  const input={...baseInput,day:11,market:[{sourceId:f.source.sourceId,expectedRevision:0,decisionDay:10,origin,contract}]};
  const stores={world:f.world,archive:f.calendar!,match,recruitment:f.owner,contracts:f.contract};
  f.db.exec("CREATE TRIGGER interrupt_contract BEFORE INSERT ON world_free_agent_applications BEGIN SELECT RAISE(ABORT,'contract interrupted'); END");
  const interrupted=dispatchDomesticCalendarDay(stores,input);
  expect(interrupted.market[0]).toMatchObject({status:'REJECTED',reason:'contract interrupted',result:{decision:{source:{sourceId:f.source.sourceId}}}});
  expect(f.owner.readDecision(f.source.sourceId)).not.toBeNull();
  expect(f.contract.readApplication(contract.applicationId)).toBeNull();
  f.db.exec('DROP TRIGGER interrupt_contract');
  const recruitment=openSqliteRecruitmentEvidenceStore(f.path),contracts=openSqliteFreeAgentContractStore(f.path,f.links);
  closes.push(()=>recruitment.close(),()=>contracts.close());
  const result=dispatchDomesticCalendarDay({...stores,recruitment,contracts},input);
  expect(result.market[0]).toMatchObject({status:'APPLIED',result:{contract:{clubRevision:1,rosterRevision:1,wageRevision:1}}});
  expect(f.roster.readHead('career-a','club-a')!.roster.players[0].clubRights.rightsHolderClubId).toBe('club-a');
  expect(dispatchDomesticCalendarDay(stores,input).market).toEqual(result.market);
  const other=f.calendar!.captureMarketTriggerReference('career-a',f.calendar!.marketTriggersOnDay('career-a','league-season-1',10)[0]);
  expect(dispatchDomesticCalendarDay(stores,{...input,market:[{...input.market[0],origin:other}]}).market[0].status).toBe('REJECTED');
  expect(f.world.readClub('career-a','club-a')!.revision).toBe(1);
});

import { selectManagerControlledDecision } from '../../core/world/manager/ManagerControlledDecision';
import { managerRosterAdmissionFixture, corruptManagerRosterAdmissionBefore } from './ManagerRosterBeliefAdmission.test-support';
import { openSqliteManagerRosterDecisionStore, type RosterExecutionRequest } from './SqliteManagerRosterDecisionStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
it('issues and executes accepted roster work while retaining its original belief across later history and reopen',()=>{
  const {f,roster,input:opportunity}=managerRosterAdmissionFixture(closes);
  const world=openSqliteWorldSettlementStore(f.databasePath),archive=openSqliteDomesticScheduleStore(f.databasePath),match=new SqliteOfficialStateStore(f.databasePath);
  closes.push(()=>world.close(),()=>archive.close(),()=>match.close());
  const stores={world,archive,match,roster,belief:f.history};
  const command={...baseInput,day:12,roster:[{opportunity,managerBeliefRevision:1}]};
  const issued=dispatchDomesticCalendarDay(stores,command);
  expect(issued.calendar.missingScheduleSeasonIds).toEqual(['league-season-1']);
  expect(issued.roster[0]).toMatchObject({status:'INCOMPLETE',reason:'ACCEPTED_ROSTER_EXECUTION_INPUT'});
  const next=issued.roster[0].result!.opportunity;
  const selected=selectManagerControlledDecision(next.control,next.opportunity,next.selectionAgent,'trace-2');
  if(!selected.ok) throw new Error('accepted selection missing');
  const execution:RosterExecutionRequest={careerId:'career-a',clubId:'club-a',expectedClubRevision:0,expectedRosterRevision:1,
    expectedMoodRevision:null,control:next.control,opportunity:next.opportunity,selection:selected.value,selectionAgent:next.selectionAgent,
    binding:next.bindings.find(v=>v.actionId===selected.value.decision.actionId)!,clubAsOfDay:12,currentWorldRevision:1,afterWorldRevision:2,executionId:'execution-2'};
  const execute={...command,roster:[{...command.roster[0],execution}]};
  const applied=dispatchDomesticCalendarDay(stores,execute);
  expect(applied.roster[0]).toMatchObject({status:'APPLIED',result:{execution:{rosterRevision:2}}});
  f.history.apply({careerId:'career-a',managerId:'manager-a',expectedRevision:1,executionId:'execution-2'});
  const reopened=openSqliteManagerRosterDecisionStore(f.databasePath);closes.push(()=>reopened.close());
  expect(dispatchDomesticCalendarDay({...stores,roster:reopened},execute).roster).toEqual(applied.roster);
  corruptManagerRosterAdmissionBefore(f.db);
  expect(dispatchDomesticCalendarDay(stores,execute).roster[0].status).toBe('REJECTED');
  expect(roster.readHead('career-a','club-a')!.roster.revision).toBe(2);
});

import { openSqliteClubEconomyStore } from './SqliteClubEconomyStore';
import { persistClubEconomyOperation } from './ClubEconomyOperationDriver';
import { createClubWageScheduleLedger } from '../../core/world/club/ClubWageScheduleLedger';
it('keeps the original prepared venue after an ordinary same-day Club event and rejects corrupted original evidence',()=>{
  const f=acceptedRecruitmentDayFixture(closes,directories),match=new SqliteOfficialStateStore(f.path),economy=openSqliteClubEconomyStore(f.path);
  closes.push(()=>match.close(),()=>economy.close());
  const stores={world:f.world,archive:f.calendar!,match};
  const input={...baseInput,openings:[{careerId:'career-a',seasonId:'league-season-1',gameId:'series:2',ruleProfileId:NPB_2026_RULE_PROFILE.id,playId:0}]};
  const initial=dispatchDomesticCalendarDay(stores,input);
  expect(initial.games[0].status).toBe('INCOMPLETE');
  const club=f.world.readClub('career-a','club-a')!.state;
  persistClubEconomyOperation(economy,{kind:'STRUCTURAL_REVENUE',applicationId:'revenue',expectedClubRevision:club.revision,
    club,history:f.world.readClubHistory('career-a','club-a')!,wageSchedules:createClubWageScheduleLedger('career-a','club-a'),
    fact:{factId:'revenue',careerId:'career-a',clubId:'club-a',season:1,category:'commercial',settlementRef:'settlement-revenue',
      sourceEventId:'receipt-revenue',receivedAtDay:10,availableAtDay:10,capacityRevisionAtReceipt:0,amount:1,currency:'SIM'},
    policy:{policyId:'revenue-v1',version:'v1',careerId:'career-a',clubId:'club-a',season:1,availableAtDay:10,currency:'SIM',maximumSeasonAmount:700,allowedCategories:['commercial']}});
  expect(f.world.readClub('career-a','club-a')!.revision).toBe(1);
  expect(dispatchDomesticCalendarDay(stores,input).games).toEqual(initial.games);
  f.db.exec("UPDATE official_fixtures SET venue_id='forged' WHERE game_id='series:2'");
  expect(dispatchDomesticCalendarDay(stores,input).games[0].status).toBe('REJECTED');
});

import { closeOfficialPlay, createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import { createCanonicalPlateAppearanceTimeline, recordCountedPitch } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { prepareDomesticMatch } from './DomesticSeasonRuntime';
import { openSqliteOfficialWorldSettlementOutbox } from './SqliteOfficialWorldSettlementOutbox';
import { openSqliteMatchdayAttendanceStore } from './SqliteMatchdayAttendanceStore';
const pendingFinalFixture=()=>{
  const f=acceptedRecruitmentDayFixture(closes,directories,true,10),match=new SqliteOfficialStateStore(f.path),outbox=openSqliteOfficialWorldSettlementOutbox(f.path);
  closes.push(()=>match.close(),()=>outbox.close());
  const stores={world:f.world,archive:f.calendar!,match,outbox};
  // Existing supported non-live final fixture, with explicit accepted scoring.
  const before={ruleProfileId:NPB_2026_RULE_PROFILE.id,inning:9,half:'top' as const,outs:2,balls:0,strikes:2,
    bases:{first:null,second:null,third:null},score:{away:0,home:1},playId:8};
  const prepared=prepareDomesticMatch(stores,{careerId:'career-a',seasonId:'league-season-1',gameId:'series:1',matchState:before});
  const timeline=recordCountedPitch(createCanonicalPlateAppearanceTimeline(before,1000),1100,{kind:'swinging_strike'});
  let adjudication=createPlayAdjudicationLedger({playId:8,ruleProfileId:before.ruleProfileId,playEnd:null});
  adjudication=recordCorrectRuleSnapshot(adjudication,0,{eventId:'rule-final',tick:1101,snapshotId:'rule-final',evidenceRevision:1,
    ruling:{outsAfter:3,basesAfter:before.bases,scoredRunnerIds:[]}});
  adjudication=closeOfficialPlay(adjudication,1,{eventId:'close-final',closureId:'closure-final',tick:1102});
  const finalInput={kind:'non_live' as const,matchId:'series:1',applicationId:'final-2',expectedDurableRevision:0,match:before,timeline,
    adjudication,context:{kind:'strikeout' as const},game:{seasonId:'league-season-1',homeClubId:'club-a',awayClubId:'club-b',
      policy:{version:'completion-v1',minimumInnings:9,tiesAllowed:false},venueBinding:prepared.fixture.binding,
      lineScore:{innings:Array.from({length:9},(_,i)=>({inning:i+1,awayRuns:0,homeRuns:i===8?null:i===0?1:0})),
        totals:{away:{runs:0,hits:0,errors:0},home:{runs:1,hits:1,errors:0}}}}};
  const gate={factId:'gate-2',careerId:'career-a',sourceEventId:'turnstile-2',gameId:'series:1',stadiumId:'stadium-a',
    observedAtDay:10,availableAtDay:10,venueRevisionAtObservation:0,count:120};
  const attendance=openSqliteMatchdayAttendanceStore(f.path,stores,{readAcceptedGateCount:id=>id===gate.factId?gate:null});closes.push(()=>attendance.close());
  attendance.accept(gate.factId,'league-season-1');
  const season=f.world.readSeason('career-a','league-season-1')!;
  const request={finalInput,expectedSeasonRevision:0,expectedClubRevision:0,outcomeDelivery:'required_completed_match_outcomes_v1' as const,
    worldInput:{schedule:season.schedule,priorResults:[],standingsPolicy:season.standingsPolicy,homeClub:f.x.beforeClub,
      homeClubHistory:f.world.readClubHistory('career-a','club-a')!,wageSchedules:f.x.beforeSchedules,attendance:gate,
      revenuePolicy:{version:'matchday-v1',availableAtDay:10,seasonId:'league-season-1',currency:'SIM',recognizedMinorUnitsPerAttendee:5},finalizedAtDay:10}};
  outbox.enqueue(request);
  return {f,match,outbox,stores,attendance,request};
};
it('resumes a retained real final after unrelated schedule revision and keeps required outcome delivery pending after World commit',()=>{
  const {f,match,outbox,stores,attendance}=pendingFinalFixture();
  f.db.exec("CREATE TRIGGER interrupt_settlement BEFORE INSERT ON world_settlement_applications BEGIN SELECT RAISE(ABORT,'world interrupted'); END");
  expect(dispatchDomesticCalendarDay({...stores,attendance},baseInput).settlements[0]).toMatchObject({status:'REJECTED',reason:'world interrupted'});
  expect(match.getMatch('series:1')!.finalResult).not.toBeNull();expect(outbox.read('final-2')!.status).toBe('PENDING');
  f.db.exec('DROP TRIGGER interrupt_settlement');
  const result=dispatchDomesticCalendarDay({...stores,attendance},baseInput);
  f.calendar!.appendRevision('career-a','league-season-1',0,{eventId:'other-rainout',gameId:'series:2',newDay:12,reason:'RAINOUT'},10);
  const reopened=openSqliteOfficialWorldSettlementOutbox(f.path);closes.push(()=>reopened.close());
  expect(result.settlements[0]).toMatchObject({status:'INCOMPLETE',reason:'PLAYER_OUTCOME_DELIVERY'});
  expect(f.world.readSeason('career-a','league-season-1')!.results).toHaveLength(1);
  expect(f.world.readClub('career-a','club-a')!.revision).toBe(1);
  expect(reopened.read('final-2')!.status).toBe('PENDING');
  const retry=dispatchDomesticCalendarDay({...stores,outbox:reopened,attendance},baseInput);
  expect(retry.settlements).toEqual(result.settlements);
  expect(retry.games[0].status).toBe('APPLIED');
  expect(retry.outstanding.some(item=>item.id==='final-2'&&item.status==='INCOMPLETE')).toBe(true);
});

it('preserves a rejected pre-World original when an accepted revision changes its first-write preconditions',()=>{
  const {f,stores,attendance,outbox,request}=pendingFinalFixture();
  f.calendar!.appendRevision('career-a','league-season-1',0,{eventId:'other-rainout',gameId:'series:2',newDay:12,reason:'RAINOUT'},10);
  const result=dispatchDomesticCalendarDay({...stores,attendance},baseInput);
  expect(result.settlements[0]).toMatchObject({status:'REJECTED',reason:'world standings projection mismatch'});
  expect(result.outstanding.some(item=>item.id==='final-2'&&item.status==='REJECTED')).toBe(true);
  expect(outbox.read('final-2')).toMatchObject({status:'PENDING',request});
  expect(f.world.readSeason('career-a','league-season-1')!.results).toHaveLength(0);
  expect(f.world.readClub('career-a','club-a')!.revision).toBe(0);
});

it('distinguishes an absent accepted decision source from a rejected source and never hides a lost actual final as missing setup',()=>{
  const f=acceptedRecruitmentDayFixture(closes,directories),match=new SqliteOfficialStateStore(f.path);closes.push(()=>match.close());
  const origin=f.calendar!.captureMarketTriggerReference('career-a',f.calendar!.marketTriggersOnDay('career-a','league-season-1',9)[0]);
  const stores={world:f.world,archive:f.calendar!,match,recruitment:f.owner};
  const command={...baseInput,market:[{sourceId:'absent',expectedRevision:0,decisionDay:10,origin}]};
  expect(dispatchDomesticCalendarDay(stores,command).market[0]).toMatchObject({status:'MISSING_INPUT',reason:'ACCEPTED_RECRUITMENT_SOURCE'});
  const altered={...origin,seasonEventsHash:'0'.repeat(64)};
  expect(dispatchDomesticCalendarDay(stores,{...command,market:[{...command.market[0],origin:altered}]}).market[0].status).toBe('REJECTED');
  const final=pendingFinalFixture();
  dispatchDomesticCalendarDay({...final.stores,attendance:final.attendance},baseInput);
  final.f.db.exec("PRAGMA foreign_keys=OFF; DELETE FROM matches WHERE match_id='series:1'; PRAGMA foreign_keys=ON;");
  const result=dispatchDomesticCalendarDay({...final.stores,attendance:final.attendance},baseInput);
  expect(result.games[0]).toMatchObject({status:'REJECTED',reason:'domestic World result lacks its authentic Match final'});
});
