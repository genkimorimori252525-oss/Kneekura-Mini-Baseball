import { state } from '../../core/world/club/ClubFixtures.test-support';
import { createRosterState } from '../../core/world/roster/RosterState';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import { openSqliteWorldCompetitionCycleStore } from './SqliteWorldCompetitionCycleStore';
import { openSqliteNationalCompetitionSelectionStore } from './SqliteNationalCompetitionSelectionStore';
import { openSqliteNationalEligibilityFactStore } from './SqliteNationalEligibilityFactStore';
import { openSqliteNationalRosterSnapshotStore } from './SqliteNationalRosterSnapshotStore';
import { worldCycleInput } from './WorldCompetitionCycleFixtures.test-support';
import { createHumanControlState } from '../../core/world/control/HumanControl';
import { selectManagerControlledDecision } from '../../core/world/manager/ManagerControlledDecision';
import type { PlayerAvailability } from '../../core/world/roster/RosterTypes';
import { openSqliteWorldControlStore } from './SqliteWorldControlStore';
import type { ClubWorldRegion } from '../../core/world/competition/ClubWorldBerths';

export const nationalCallupFixture = (withoutLegalFacts: readonly number[] = [], population?: Readonly<{
  playerNationIds: readonly string[];
  nations: readonly Readonly<{ nationId: string; region: ClubWorldRegion }>[];
}>) => {
  const playerCount = population?.playerNationIds.length ?? 6;
  const path = `file:national-callup-${crypto.randomUUID()}?mode=memory&cache=shared`;
  const world = openSqliteWorldSettlementStore(path);
  world.initialize({ careerId: 'career-a', clubs: [state()], schedule: {
    seasonId: 'league-season-1', leagueId: 'league-a', memberClubIds: ['club-a', 'club-b'],
    regularSeasonGamesPerClub: 1, games: [{ gameId: 'domestic-1', homeClubId: 'club-a', awayClubId: 'club-b' }],
    revisionEventIds: [] }, standingsPolicy: { version: 'v1', tieCreditNumerator: 1,
      tieCreditDenominator: 2, runDifferentialCapPerGame: 5 } });
  const roster = openSqliteManagerRosterDecisionStore(path);
  roster.initialize({ careerId: 'career-a', clubId: 'club-a', mood: null,
    roster: createRosterState({ careerId: 'career-a', revision: 0, effectiveDay: 10,
      profiles: [{ profileId: 'league', version: 'v1', season: 1, competitionEditionId: 'league-season-1',
        activeLimit: null, allowedAssignmentKinds: ['FIRST_TEAM'], rehabParticipationAllowed: false }],
      units: [{ unitId: 'first-a', clubId: 'club-a', kind: 'FIRST_TEAM' }],
      players: Array.from({ length: playerCount }, (_, i) => ({ playerId: `p${i}`,
        assignment: i === 5 ? null : { unitId: 'first-a', clubId: 'club-a' },
        clubRights: { rightsHolderClubId: i === 5 ? null : 'club-a', contractId: i === 5 ? null : `contract-${i}` }, registrations: [],
        availability: { status: !population && i === 2 ? 'INJURED' as const : 'AVAILABLE' as const, evidenceId: `medical-${i}` } })) }) });
  const control = openSqliteWorldControlStore(path);
  control.initialize({ careerId: 'career-a', worldRevision: 0, control: createHumanControlState({ revision: 0,
    controllerId: 'human', controlledClubId: 'club-a', domainIds: ['ROSTER'], manualDomainIds: [] }) });
  const changeAvailability = (playerId: string, status: PlayerAvailability['status'], effectiveDay: number): void => {
    const head = roster.readHead('career-a', 'club-a')!;
    const worldHead = control.readHead('career-a')!;
    const actionId = `medical-${playerId}-${head.roster.revision}`;
    const opportunity = { decisionId: actionId, contextId: actionId, worldRevision: worldHead.worldRevision,
      clubId: 'club-a', domainId: 'ROSTER', managerId: 'manager-a', appointmentId: 'appointment-a', legalActionIds: [actionId] };
    const score = { mean: 1, uncertainty: 0, evidence: 1 };
    const selectionAgent = { managerId: 'manager-a', appointmentId: 'appointment-a', state: {
      skills: { tacticalJudgment: 50, analysis: 50, adaptation: 50, playerEvaluation: 50, operations: 50, leadership: 50 },
      philosophy: { preferredStyleTags: [] as string[] }, temperament: { riskAppetite: 50, decisionPace: 50,
        policyPersistence: 50, noveltyAppetite: 50, consultationStyle: 50 }, strategyMemory: { activePolicyActionIds: [] as string[] },
      beliefs: { candidates: [{ actionId, styleTags: [] as string[], competitiveOutcome: score,
        resourceHealth: score, executionFeasibility: score, opponentInformationResponse: score }] } } };
    const binding = { actionId, command: { commandId: actionId, expectedRevision: head.roster.revision,
      effectiveDay, changes: [{ playerId, availability: { status, evidenceId: actionId } }] } };
    const selected = selectManagerControlledDecision(worldHead.control, opportunity, selectionAgent, `trace-${actionId}`);
    if (!selected.ok) throw new Error('invalid medical roster fixture');
    roster.issueOpportunity({ careerId: 'career-a', clubId: 'club-a', expectedClubRevision: 0,
      expectedRosterRevision: head.roster.revision, clubAsOfDay: effectiveDay, control: worldHead.control,
      decisionId: actionId, contextId: actionId, worldRevision: worldHead.worldRevision, candidates: [binding], selectionAgent });
    roster.apply({ careerId: 'career-a', clubId: 'club-a', expectedClubRevision: 0,
      expectedRosterRevision: head.roster.revision, expectedMoodRevision: null, control: worldHead.control,
      opportunity, selection: selected.value, selectionAgent, clubAsOfDay: effectiveDay, binding,
      currentWorldRevision: worldHead.worldRevision, afterWorldRevision: worldHead.worldRevision + 1, executionId: actionId });
  };
  const links = openSqlitePlayerPersonLinkStore(path, { readAcceptedPlayerIntake: (sourceId) => {
    const i = Number(sourceId.replace('link-', ''));
    return Number.isInteger(i) && i >= 0 && i < playerCount ? { sourceId, careerId: 'career-a', playerId: `p${i}`,
      personId: `person-${i}`, sourceRecordId: `intake-${i}`, sourceVersion: 'v1',
      acceptedAtDay: 10, acceptedRevision: 1, rosterRevision: 0 } : null;
  } });
  const nations = openSqliteNationCompetitionRegionStore(path);
  for (const { nationId, region } of population?.nations ?? ['JP', 'KR'].map((nationId) => ({ nationId, region: 'ASIA_PACIFIC' as const }))) {
    nations.record({ careerId: 'career-a', nationId, region, effectiveFromDay: 0, sourceEventId: nationId });
  }
  const cycle = openSqliteWorldCompetitionCycleStore(path);
  cycle.initialize('career-a', worldCycleInput(0));
  const selections = openSqliteNationalCompetitionSelectionStore(path, { cycle });
  selections.initialize({ careerId: 'career-a', editionId: 'wbc-2032', kind: 'WBC',
    cycleOrdinal: 0, careerDayOne: '2031-01-01', cutoffDay: 400 });
  selections.initialize({ careerId: 'career-a', editionId: 'premier-2034', kind: 'PREMIER_12',
    cycleOrdinal: 0, careerDayOne: '2031-01-01', cutoffDay: 1300 });
  const facts = openSqliteNationalEligibilityFactStore(path, { personLinks: links, nations });
  for (let i = 0; i < playerCount; i++) {
    links.accept(`link-${i}`);
    if (withoutLegalFacts.includes(i)) continue;
    for (const nationId of population ? [population.playerNationIds[i]] : ['JP', 'KR']) facts.record({ careerId: 'career-a', personLinkSourceId: `link-${i}`,
      active: true, fact: { evidenceId: `legal-${i}-${nationId}`, playerId: `p${i}`, personId: `person-${i}`,
        nationId, basis: 'CITIZENSHIP', effectiveFromDay: 10 } });
  }
  const snapshots = openSqliteNationalRosterSnapshotStore(path, { roster });
  const sources = { selections, personLinks: links, facts, nations, rosterSnapshots: snapshots };
  const request = (i = 0) => ({ eventId: `call-${i}`, careerId: 'career-a', editionId: 'wbc-2032',
    nationId: 'JP', playerId: `p${i}`, personId: `person-${i}`, personLinkSourceId: `link-${i}`,
    rosterContextClubId: 'club-a', registeredAtDay: 420, replacementOf: null as string | null,
    eligibilityPolicy: { version: 'legal-v1', acceptedBases: ['CITIZENSHIP' as const],
      allowNationSwitch: true, seniorOfficialAppearanceLocksNation: true },
    callupPolicy: { version: 'wbc-roster-v1', rosterLimit: 1, initialRegistrationCutoffDay: 420, replacementCutoffDay: 430,
      allowedDeclineReasons: ['INJURY' as const, 'PERSONAL' as const] },
    response: { decision: 'ACCEPT' as 'ACCEPT' | 'DECLINE', reason: null as null | 'PERSONAL', evidenceId: `response-${i}` } });
  return { path, world, roster, links, nations, cycle, selections, facts, snapshots, sources, request, changeAvailability,
    close: () => { snapshots.close(); facts.close(); selections.close(); cycle.close(); nations.close(); links.close(); control.close(); roster.close(); world.close(); } };
};
