import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { freeAgentFixture } from './FreeAgentContractFixture.test-support';
import { createBaseScheduleSnapshot } from '../../core/world/competition/LeagueSchedule';
import { captureOfficialStandingsSchedule } from '../../core/world/competition/OfficialStandingsScheduleSource';
import { openSqliteDomesticScheduleStore } from './SqliteDomesticScheduleStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqliteFreeAgentContractStore } from './SqliteFreeAgentContractStore';
import { openSqliteRecruitmentEvidenceStore, type AcceptedRecruitmentSource, type AcceptedScoutingSource } from './SqliteRecruitmentEvidenceStore';


// Reuses the existing accepted recruitment fixture; no production defaults.
export const acceptedRecruitmentDayFixture = (closes: (() => void)[], directories: string[], withCalendar = true, calendarStartDay = 9) => {
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
    opponentMatrix: [{ homeClubId: 'club-a', awayClubId: 'club-b', gameCount: 2 }], allowedDays: [calendarStartDay, calendarStartDay + 1, calendarStartDay + 2], reservedWindows: [],
    series: [{ seriesId: 'series', homeClubId: 'club-a', awayClubId: 'club-b', startsOnDay: calendarStartDay, gameCount: 2 }] }) : null;
  world.initialize({ careerId: 'career-a', clubs: [x.beforeClub], schedule: base ? captureOfficialStandingsSchedule(base, []) : { seasonId: 'league-season-1', leagueId: 'league-a',
    memberClubIds: ['club-a', 'club-b'], regularSeasonGamesPerClub: 1,
    games: [{ gameId: 'game-1', homeClubId: 'club-a', awayClubId: 'club-b' }], revisionEventIds: ['schedule-1'] },
    standingsPolicy: { version: 'standing-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 } });
  const calendar = base ? openSqliteDomesticScheduleStore(path) : null;
  if (calendar && base) {
    closes.push(() => calendar.close()); calendar.initialize('career-a', base);
    calendar.initializeEvents('career-a', base.seasonId, { version: 'events-v1', allStarEnabled: false,
      marketWindows: [{ windowId: 'trade', type: 'TRADE_DEADLINE', day: calendarStartDay, policyVersion: 'trade-v1' },
        { windowId: 'registration', type: 'REGISTRATION_WINDOW_CLOSE', day: calendarStartDay + 1, policyVersion: 'registration-v1' }],
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
