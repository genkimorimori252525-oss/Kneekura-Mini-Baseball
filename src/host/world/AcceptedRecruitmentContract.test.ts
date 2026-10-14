import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { freeAgentFixture } from './FreeAgentContractFixture.test-support';
import { createBaseScheduleSnapshot } from '../../core/world/competition/LeagueSchedule';
import { captureOfficialStandingsSchedule } from '../../core/world/competition/OfficialStandingsScheduleSource';
import { openSqliteDomesticScheduleStore } from './SqliteDomesticScheduleStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqliteFreeAgentContractStore } from './SqliteFreeAgentContractStore';
import { openSqliteRecruitmentEvidenceStore, type AcceptedRecruitmentSource, type AcceptedScoutingSource } from './SqliteRecruitmentEvidenceStore';

const closes: (() => void)[] = [], directories: string[] = [];
afterEach(() => { closes.splice(0).reverse().forEach(close => close()); directories.splice(0).forEach(p => rmSync(p, { recursive: true, force: true })); });
const setup = (withCalendar = false) => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-recruitment-')); directories.push(directory);
  const path = join(directory, 'world.sqlite'), x = freeAgentFixture();
  const world = openSqliteWorldSettlementStore(path), roster = openSqliteManagerRosterDecisionStore(path);
  const links = { readAcceptedPlayerPersonLink: (id: string) => id === 'person-link-1'
    ? { careerId: 'career-a', playerId: 'target', personId: 'person-target' } : null };
  const contract = openSqliteFreeAgentContractStore(path, links);
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path);
  closes.push(() => world.close(), () => roster.close(), () => contract.close(), () => db.close());
  const base = withCalendar ? createBaseScheduleSnapshot({ seasonId: 'league-season-1', leagueId: 'league-a',
    calendarProfileVersion: 'calendar-v1', generatorVersion: 'generator-v1', scheduleSeed: 'market-seed',
    opponentMatrixVersion: 'matrix-v1', regularSeasonGamesPerClub: 2, memberClubIds: ['club-a', 'club-b'],
    opponentMatrix: [{ homeClubId: 'club-a', awayClubId: 'club-b', gameCount: 2 }], allowedDays: [9, 10, 11], reservedWindows: [],
    series: [{ seriesId: 'series', homeClubId: 'club-a', awayClubId: 'club-b', startsOnDay: 9, gameCount: 2 }] }) : null;
  world.initialize({ careerId: 'career-a', clubs: [x.beforeClub], schedule: base ? captureOfficialStandingsSchedule(base, []) : { seasonId: 'league-season-1', leagueId: 'league-a',
    memberClubIds: ['club-a', 'club-b'], regularSeasonGamesPerClub: 1,
    games: [{ gameId: 'game-1', homeClubId: 'club-a', awayClubId: 'club-b' }], revisionEventIds: ['schedule-1'] },
    standingsPolicy: { version: 'standing-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 } });
  const calendar = base ? openSqliteDomesticScheduleStore(path) : null;
  if (calendar && base) {
    closes.push(() => calendar.close()); calendar.initialize('career-a', base);
    calendar.initializeEvents('career-a', base.seasonId, { version: 'events-v1', allStarEnabled: false,
      marketWindows: [{ windowId: 'trade', type: 'TRADE_DEADLINE', day: 9, policyVersion: 'trade-v1' },
        { windowId: 'registration', type: 'REGISTRATION_WINDOW_CLOSE', day: 10, policyVersion: 'registration-v1' }],
      rosterExpansionEnabled: false, awardSelectionPolicyVersion: 'awards-v1' });
  }
  roster.initialize({ careerId: 'career-a', clubId: 'club-a', roster: x.rosterState, mood: null });
  contract.initializeWageSchedules(x.beforeSchedules);
  const old = x.request.decisions.decisions[0];
  const evidence: AcceptedScoutingSource = { sourceId: 'scout-e', sourceVersion: 'v1', kind: 'EVIDENCE', record: old.knowledgeEvidence[0] };
  const report: AcceptedScoutingSource = { sourceId: 'scout-r', sourceVersion: 'v1', kind: 'REPORT', record: old.knowledgeReports[0] };
  const scouting = new Map<string, AcceptedScoutingSource>([[evidence.sourceId, evidence], [report.sourceId, report]]);
  const need = { careerId: 'career-a', clubId: 'club-a', asOfDay: 10, snapshotId: 'need-1', policyVersion: 'need-v1',
    competitionEditionId: 'league-season-1', positionGroup: 'C', candidateDomainId: 'catcher-role', minimumCandidateEstimate: 1,
    knowledgeDomainId: 'contact', requiredRole: 'starter', horizon: 'NOW' as const, targetCount: 1, minimumEstimate: 40 };
  const source: AcceptedRecruitmentSource = { sourceId: 'recruit-1', sourceVersion: 'v1',
    expected: { clubRevision: 0, rosterRevision: 0, wageRevision: 0, knowledgeRevision: 2 },
    authorityProfile: old.sourceBackedAuthority!.profile, need,
    needPolicy: { version: 'need-v1', availableAtDay: 0, roles: [{ positionGroup: need.positionGroup, requiredRole: need.requiredRole,
      candidateDomainId: need.candidateDomainId, minimumCandidateEstimate: need.minimumCandidateEstimate,
      knowledgeDomainId: need.knowledgeDomainId, minimumEstimate: need.minimumEstimate, targetCount: need.targetCount }] },
    proposedCurrentSeasonPayrollMinorUnits: 100,
    decision: { decisionId: old.decisionId, careerId: old.careerId, clubId: old.clubId, playerId: old.playerId,
      decidedAtDay: old.decidedAtDay, decision: old.decision, authorityPersonId: old.authorityPersonId,
      governanceProfileVersion: old.governanceProfileVersion, knowledgeReportIds: old.knowledgeReportIds,
      fitEstimate: old.fitEstimate, marketContext: old.marketContext, offeredTerms: old.offeredTerms! } };
  const recruitment = new Map([[source.sourceId, source]]);
  const owner = openSqliteRecruitmentEvidenceStore(path, {
    readAcceptedScoutingSource: id => scouting.get(id) ?? null,
    readAcceptedRecruitmentSource: id => recruitment.get(id) ?? null });
  closes.push(() => owner.close());
  const accept = () => {
    owner.acceptScouting('scout-e', 0); owner.acceptScouting('scout-r', 1);
    return owner.acceptDecision('recruit-1', 0);
  };
  const request = (reference: ReturnType<typeof accept>['reference']) => {
    const { decisions: _decisions, ...rest } = x.request;
    return { ...rest, recruitmentReference: reference };
  };
  return { path, x, world, roster, contract, db, owner, source, scouting, recruitment, links, accept, request, calendar };
};

it('persists original scouting and authorized recruitment through the actual contract and reopens after later knowledge', () => {
  const f = setup(), decision = f.accept();
  expect(decision.ledger.decisions[0]).toMatchObject({ sourceBackedRosterNeed: { rosterRevision: 0, knowledgeRevision: 2 },
    sourceBackedAuthority: { authorityPersonId: 'gm-1' } });
  const result = f.contract.applyAcceptedDecision(f.request(decision.reference));
  expect(f.roster.readHead('career-a', 'club-a')!.roster.players[0].clubRights.rightsHolderClubId).toBe('club-a');
  expect(result.wageRevision).toBe(1);
  const extra: AcceptedScoutingSource = { ...f.scouting.get('scout-e')!, sourceId: 'scout-e-later', kind: 'EVIDENCE',
    record: { ...(f.scouting.get('scout-e')! as Extract<AcceptedScoutingSource, { kind: 'EVIDENCE' }>).record,
      evidenceId: 'e-later', sourceEventId: 'later-game', observedAtDay: 12, availableAtDay: 12 } };
  f.scouting.set(extra.sourceId, extra); f.owner.acceptScouting(extra.sourceId, 2);
  const reopened = openSqliteRecruitmentEvidenceStore(f.path), contract = openSqliteFreeAgentContractStore(f.path, f.links);
  closes.push(() => reopened.close(), () => contract.close());
  expect(reopened.readDecision('recruit-1')).toEqual(decision);
  expect(contract.applyAcceptedDecision(f.request(decision.reference))).toEqual(result);
  expect(contract.readAcceptedFreeAgentRightsEvent(result.rightsEvent.eventId)?.rightsEvent).toEqual(result.rightsEvent);
});

it('rejects stale decision revisions, missing knowledge and changed accepted sources without admitting a decision', () => {
  const f = setup();
  expect(() => f.owner.acceptDecision('recruit-1', 0)).toThrow();
  f.owner.acceptScouting('scout-e', 0); f.owner.acceptScouting('scout-r', 1);
  f.recruitment.set('recruit-1', { ...f.source, expected: { ...f.source.expected, rosterRevision: 1 } });
  expect(() => f.owner.acceptDecision('recruit-1', 0)).toThrow(/stale/);
  expect(f.owner.readDecision('recruit-1')).toBeNull();
  f.recruitment.set('recruit-1', f.source); const accepted = f.owner.acceptDecision('recruit-1', 0);
  f.recruitment.set('recruit-1', { ...f.source, decision: { ...f.source.decision, fitEstimate: { ...f.source.decision.fitEstimate, upper: 1 } } });
  expect(() => f.owner.acceptDecision('recruit-1', 0)).toThrow(/frozen/);
  expect(f.owner.readDecision('recruit-1')).toEqual(accepted);
});

it('rolls back the decision when its insertion changes original scouting evidence', () => {
  const f = setup(); f.owner.acceptScouting('scout-e', 0); f.owner.acceptScouting('scout-r', 1);
  f.db.exec("CREATE TRIGGER alter_scout AFTER INSERT ON world_recruitment_decisions BEGIN UPDATE world_scouting_sources SET source_json=json_set(source_json,'$.record.sourceEventId','changed') WHERE source_id='scout-e'; END");
  expect(() => f.owner.acceptDecision('recruit-1', 0)).toThrow();
  expect(f.owner.readDecision('recruit-1')).toBeNull();
  expect(f.owner.readKnowledge('career-a', 'club-a')?.evidence[0].sourceEventId).toBe('match-1');
  f.db.exec('DROP TRIGGER alter_scout'); expect(f.owner.acceptDecision('recruit-1', 0).ledger.revision).toBe(1);
});

it('authenticates original evidence after the contract INSERT and rolls back all contract effects', () => {
  const f = setup(), decision = f.accept();
  f.db.exec("CREATE TRIGGER alter_recruit AFTER INSERT ON world_free_agent_applications BEGIN UPDATE world_scouting_sources SET source_json=json_set(source_json,'$.record.sourceEventId','changed') WHERE source_id='scout-e'; END");
  expect(() => f.contract.applyAcceptedDecision(f.request(decision.reference))).toThrow();
  expect(f.world.readClub('career-a', 'club-a')?.revision).toBe(0);
  expect(f.roster.readHead('career-a', 'club-a')?.roster.revision).toBe(0);
  expect(f.contract.readWageSchedules('career-a', 'club-a')?.revision).toBe(0);
  expect(f.contract.readApplication(f.x.request.applicationId)).toBeNull();
  f.db.exec('DROP TRIGGER alter_recruit'); expect(f.contract.applyAcceptedDecision(f.request(decision.reference)).clubRevision).toBe(1);
});

it('rolls back an accepted contract when an INSERT trigger removes both its reference and marker', () => {
  const f = setup(), decision = f.accept(), request = f.request(decision.reference);
  f.db.exec(`CREATE TRIGGER strip_recruitment AFTER INSERT ON world_free_agent_applications BEGIN
    UPDATE world_free_agent_applications
      SET request_json=json_remove(request_json,'$.recruitmentReference')
      WHERE application_id=NEW.application_id;
    DELETE FROM world_free_agent_recruitment_references WHERE application_id=NEW.application_id;
  END`);
  expect(() => f.contract.applyAcceptedDecision(request)).toThrow();
  expect(f.world.readClub('career-a', 'club-a')?.revision).toBe(0);
  expect(f.roster.readHead('career-a', 'club-a')?.roster.revision).toBe(0);
  expect(f.contract.readWageSchedules('career-a', 'club-a')?.revision).toBe(0);
  expect(f.contract.readApplication(request.applicationId)).toBeNull();
  expect(f.db.prepare('SELECT count(*) AS n FROM world_accepted_free_agent_rights').get()?.n).toBe(0);
  expect(f.db.prepare('SELECT count(*) AS n FROM world_free_agent_recruitment_references').get()?.n).toBe(0);
  expect(f.owner.readDecision('recruit-1')).toEqual(decision);
  f.db.exec('DROP TRIGGER strip_recruitment');
  const result = f.contract.applyAcceptedDecision(request);
  expect(result.clubRevision).toBe(1);
  expect(f.contract.readApplication(request.applicationId)).toEqual(result);
  expect(f.db.prepare('SELECT count(*) AS n FROM world_free_agent_recruitment_references').get()?.n).toBe(1);
});

it('rejects altered original knowledge on both historical contract read and exact retry', () => {
  const f = setup(), decision = f.accept(), request = f.request(decision.reference);
  f.contract.applyAcceptedDecision(request);
  f.db.exec("UPDATE world_scouting_sources SET source_json=json_set(source_json,'$.record.confidence','HIGH') WHERE source_id='scout-r'");
  expect(() => f.contract.readApplication(request.applicationId)).toThrow();
  expect(() => f.contract.applyAcceptedDecision(request)).toThrow();
});

it('rejects mismatched decision reference and refuses legacy intake under an accepted application identity', () => {
  const f = setup(), decision = f.accept(), request = f.request(decision.reference);
  expect(() => f.contract.applyAcceptedDecision({ ...request, recruitmentReference: { ...decision.reference, snapshotHash: 'wrong' } })).toThrow();
  f.contract.applyAcceptedDecision(request);
  expect(() => f.contract.apply({ ...f.x.request, decisions: decision.ledger })).toThrow();
  f.db.exec("UPDATE world_free_agent_applications SET request_json=json_remove(request_json,'$.recruitmentReference')");
  expect(() => f.contract.readApplication(request.applicationId)).toThrow();
});

it('rejects ungrounded reports, stale scouting revisions and changed source retries', () => {
  const f = setup();
  expect(() => f.owner.acceptScouting('scout-r', 0)).toThrow(/evidence/);
  expect(f.owner.readKnowledge('career-a', 'club-a')).toBeNull();
  const before = f.owner.acceptScouting('scout-e', 0);
  expect(() => f.owner.acceptScouting('scout-r', 0)).toThrow(/stale/);
  const report = f.scouting.get('scout-r')! as Extract<AcceptedScoutingSource, { kind: 'REPORT' }>;
  f.scouting.set('scout-r', { ...report, record: { ...report.record, availableAtDay: 8 } });
  expect(() => f.owner.acceptScouting('scout-r', 1)).toThrow(/future|backdated/);
  expect(f.owner.readKnowledge('career-a', 'club-a')).toEqual(before);
  f.scouting.set('scout-r', report); const accepted = f.owner.acceptScouting('scout-r', 1);
  f.scouting.set('scout-r', { ...report, record: { ...report.record, confidence: 'HIGH' } });
  expect(() => f.owner.acceptScouting('scout-r', 1)).toThrow(/frozen/);
  expect(f.owner.readKnowledge('career-a', 'club-a')).toEqual(accepted);
});

it('retains the complete PASS and acquisition history in the accepted contract', () => {
  const f = setup(); f.owner.acceptScouting('scout-e', 0); f.owner.acceptScouting('scout-r', 1);
  const { offeredTerms: _terms, ...unoffered } = f.source.decision;
  const pass: AcceptedRecruitmentSource = { ...f.source, sourceId: 'pass-source', proposedCurrentSeasonPayrollMinorUnits: null,
    decision: { ...unoffered, decisionId: 'pass-decision', decision: 'PASS' } };
  f.recruitment.set(pass.sourceId, pass);
  const passed = f.owner.acceptDecision(pass.sourceId, 0), acquired = f.owner.acceptDecision(f.source.sourceId, 1);
  expect(acquired.ledger.decisions.map(d => d.decision)).toEqual(['PASS', 'ACQUIRE']);
  expect(f.owner.readDecision(pass.sourceId)).toEqual(passed);
  f.contract.applyAcceptedDecision(f.request(acquired.reference));
  f.db.exec("UPDATE world_recruitment_decisions SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id='pass-source'");
  expect(() => f.contract.readApplication(f.x.request.applicationId)).toThrow();
});

it('refuses a stale contract head without creating its accepted reference marker', () => {
  const f = setup(), decision = f.accept();
  expect(() => f.contract.applyAcceptedDecision({ ...f.request(decision.reference), expectedRosterRevision: 1 })).toThrow(/stale/);
  expect(f.db.prepare('SELECT count(*) AS n FROM world_free_agent_recruitment_references').get()?.n).toBe(0);
  expect(f.world.readClub('career-a', 'club-a')?.revision).toBe(0);
});

it('preserves the exact original legacy request bytes and result through the unchanged intake', () => {
  const f = setup(), bytes = JSON.stringify(f.x.request), saved = f.contract.apply(f.x.request);
  expect(f.db.prepare('SELECT request_json FROM world_free_agent_applications WHERE application_id=?').get(f.x.request.applicationId)?.request_json).toBe(bytes);
  expect(f.db.prepare('SELECT count(*) AS n FROM world_free_agent_recruitment_references').get()?.n).toBe(0);
  expect(f.contract.apply(f.x.request)).toEqual(saved);
  expect(f.contract.readApplication(f.x.request.applicationId)).toEqual(saved);
});

it('does not infer bilateral acceptance from an accepted acquisition decision', () => {
  const f = setup(), decision = f.accept(), request = f.request(decision.reference);
  expect(() => f.contract.applyAcceptedDecision({ ...request, acceptance: { ...request.acceptance, sourceEventId: 'not-accepted' } }))
    .toThrow(/acceptance/);
  expect(f.world.readClub('career-a', 'club-a')?.revision).toBe(0);
  expect(f.contract.readApplication(request.applicationId)).toBeNull();
});


const associateMarket = (f: ReturnType<typeof setup>, eventDay = 9) => {
  const trigger = f.calendar!.marketTriggersOnDay('career-a', 'league-season-1', eventDay)[0]!;
  const marketOrigin = f.calendar!.captureMarketTriggerReference('career-a', trigger);
  f.recruitment.set(f.source.sourceId, { ...f.source, marketOrigin });
  return marketOrigin;
};

it('adopts an explicit original market trigger through recruitment and contract, preserving it after calendar revision and reopen', () => {
  const f = setup(true), origin = associateMarket(f), decision = f.accept();
  expect(decision.source.marketOrigin).toEqual(origin);
  expect(origin.trigger.day).toBe(9); expect(decision.source.decision.decidedAtDay).toBe(10);
  const result = f.contract.applyAcceptedDecision(f.request(decision.reference));
  f.calendar!.appendRevision('career-a', 'league-season-1', 0,
    { eventId: 'later-rainout', gameId: 'series:2', newDay: 11, reason: 'RAINOUT' }, 10);
  const calendar = openSqliteDomesticScheduleStore(f.path), owner = openSqliteRecruitmentEvidenceStore(f.path);
  const contract = openSqliteFreeAgentContractStore(f.path, f.links);
  closes.push(() => calendar.close(), () => owner.close(), () => contract.close());
  expect(calendar.captureMarketTriggerReference('career-a', origin.trigger)).toEqual(origin);
  expect(owner.readDecision(f.source.sourceId)).toEqual(decision);
  expect(contract.applyAcceptedDecision(f.request(decision.reference))).toEqual(result);
  expect(contract.readApplication(f.x.request.applicationId)).toEqual(result);
  const otherOrigin = calendar.captureMarketTriggerReference('career-a',
    calendar.marketTriggersOnDay('career-a', 'league-season-1', 10)[0]!);
  f.recruitment.set(f.source.sourceId, { ...f.source, marketOrigin: otherOrigin });
  expect(() => f.owner.acceptDecision(f.source.sourceId, 0)).toThrow(/frozen/);
});

it('does not infer market causality from a decision on a trigger day', () => {
  const f = setup(true), decision = f.accept();
  expect(f.calendar!.marketTriggersOnDay('career-a', 'league-season-1', 10)).toHaveLength(1);
  expect(Object.hasOwn(decision.source, 'marketOrigin')).toBe(false);
  expect(decision.source).toEqual(f.source);
  expect(f.contract.applyAcceptedDecision(f.request(decision.reference)).wageRevision).toBe(1);
});

it('rejects changed calendar identity, trigger identity, future triggers and malformed origins before admitting a decision', () => {
  const f = setup(true), origin = associateMarket(f);
  f.owner.acceptScouting('scout-e', 0); f.owner.acceptScouting('scout-r', 1);
  for (const invalid of [
    { ...origin, careerId: 'different-career' },
    { ...origin, baseScheduleHash: 'changed' },
    { ...origin, seasonEventsHash: 'changed' },
    { ...origin, trigger: { ...origin.trigger, windowId: 'absent' } },
    { ...origin, trigger: { ...origin.trigger, day: 10 } },
    { ...origin, trigger: { ...origin.trigger, policyVersion: 'other-policy' } },
    { ...origin, hidden: true }, null,
  ]) {
    f.recruitment.set(f.source.sourceId, { ...f.source, marketOrigin: invalid } as never);
    expect(() => f.owner.acceptDecision(f.source.sourceId, 0)).toThrow();
    expect(f.owner.readDecision(f.source.sourceId)).toBeNull();
  }
  const future = f.calendar!.captureMarketTriggerReference('career-a',
    f.calendar!.marketTriggersOnDay('career-a', 'league-season-1', 10)[0]!);
  f.recruitment.set(f.source.sourceId, { ...f.source, marketOrigin: future,
    decision: { ...f.source.decision, decidedAtDay: 9 } });
  expect(() => f.owner.acceptDecision(f.source.sourceId, 0)).toThrow(/market.*future/);
  expect(f.owner.readDecision(f.source.sourceId)).toBeNull();
});

it('rejects invented trigger output and a trigger whose durable event snapshot is absent', () => {
  const f = setup(true), origin = associateMarket(f);
  expect(() => f.calendar!.captureMarketTriggerReference('career-a', { ...origin.trigger, type: 'HYBRID' })).toThrow();
  f.db.exec('DELETE FROM world_league_season_events');
  expect(() => f.accept()).toThrow();
  expect(f.owner.readDecision(f.source.sourceId)).toBeNull();
});

it.each(['decision', 'contract'])('rolls back a %s INSERT that rewrites the otherwise valid original event snapshot', target => {
  const f = setup(true), origin = associateMarket(f);
  f.owner.acceptScouting('scout-e', 0); f.owner.acceptScouting('scout-r', 1);
  const decision = target === 'contract' ? f.owner.acceptDecision(f.source.sourceId, 0) : null;
  const table = target === 'decision' ? 'world_recruitment_decisions' : 'world_free_agent_applications';
  f.db.exec(`CREATE TRIGGER alter_market AFTER INSERT ON ${table} BEGIN
    UPDATE world_league_season_events
      SET profile_json=json_set(profile_json,'$.version','changed'),
          snapshot_json=json_set(snapshot_json,'$.eventProfileVersion','changed');
  END`);
  expect(() => decision ? f.contract.applyAcceptedDecision(f.request(decision.reference))
    : f.owner.acceptDecision(f.source.sourceId, 0)).toThrow();
  expect(f.calendar!.captureMarketTriggerReference('career-a', origin.trigger)).toEqual(origin);
  expect(f.world.readClub('career-a', 'club-a')?.revision).toBe(0);
  expect(f.roster.readHead('career-a', 'club-a')?.roster.revision).toBe(0);
  expect(f.contract.readWageSchedules('career-a', 'club-a')?.revision).toBe(0);
  expect(f.contract.readApplication(f.x.request.applicationId)).toBeNull();
  expect(f.owner.readDecision(f.source.sourceId)).toEqual(decision);
  f.db.exec('DROP TRIGGER alter_market');
  const accepted = f.owner.acceptDecision(f.source.sourceId, 0);
  expect(f.contract.applyAcceptedDecision(f.request(accepted.reference)).clubRevision).toBe(1);
});

it('authenticates market history during contract admission, historical reads and exact retries', () => {
  const f = setup(true); associateMarket(f); const decision = f.accept(), request = f.request(decision.reference);
  const original = f.db.prepare('SELECT profile_json,snapshot_json FROM world_league_season_events').get()!;
  const corrupt = () => f.db.exec(`UPDATE world_league_season_events
    SET profile_json=json_set(profile_json,'$.version','changed'), snapshot_json=json_set(snapshot_json,'$.eventProfileVersion','changed')`);
  corrupt(); expect(() => f.contract.applyAcceptedDecision(request)).toThrow();
  expect(f.world.readClub('career-a', 'club-a')?.revision).toBe(0);
  f.db.prepare('UPDATE world_league_season_events SET profile_json=?,snapshot_json=?')
    .run(original.profile_json!, original.snapshot_json!);
  f.contract.applyAcceptedDecision(request); corrupt();
  expect(() => f.owner.readDecision(f.source.sourceId)).toThrow();
  expect(() => f.contract.readApplication(request.applicationId)).toThrow();
  expect(() => f.contract.applyAcceptedDecision(request)).toThrow();
});


it('preserves an earlier market decision behind an ordinary decision and rejects replacement of its base calendar', () => {
  const f = setup(true), origin = associateMarket(f);
  f.owner.acceptScouting('scout-e', 0); f.owner.acceptScouting('scout-r', 1);
  const { offeredTerms: _terms, ...unoffered } = f.source.decision;
  const pass: AcceptedRecruitmentSource = { ...f.source, sourceId: 'market-pass', marketOrigin: origin,
    proposedCurrentSeasonPayrollMinorUnits: null, decision: { ...unoffered, decisionId: 'market-pass-decision', decision: 'PASS' } };
  f.recruitment.set(pass.sourceId, pass); f.owner.acceptDecision(pass.sourceId, 0);
  f.recruitment.set(f.source.sourceId, f.source);
  const decision = f.owner.acceptDecision(f.source.sourceId, 1), request = f.request(decision.reference);
  expect(Object.hasOwn(decision.source, 'marketOrigin')).toBe(false);
  const result = f.contract.applyAcceptedDecision(request);
  const original = f.db.prepare('SELECT base_json FROM world_domestic_schedules').get()!.base_json!;
  f.db.exec("UPDATE world_domestic_schedules SET base_json=json_set(base_json,'$.scheduleSeed','replacement-seed')");
  const substituted = f.calendar!.captureMarketTriggerReference('career-a', origin.trigger);
  expect(substituted.trigger).toEqual(origin.trigger);
  expect(substituted.seasonEventsHash).toBe(origin.seasonEventsHash);
  expect(substituted.baseScheduleHash).not.toBe(origin.baseScheduleHash);
  expect(() => f.contract.readApplication(request.applicationId)).toThrow();
  expect(() => f.contract.applyAcceptedDecision(request)).toThrow();
  f.db.prepare('UPDATE world_domestic_schedules SET base_json=?').run(original);
  expect(f.contract.readApplication(request.applicationId)).toEqual(result);
});
