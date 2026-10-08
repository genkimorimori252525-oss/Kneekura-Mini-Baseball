import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRosterState } from '../../core/world/roster/RosterState';
import { createHumanControlState } from '../../core/world/control/HumanControl';
import { selectManagerControlledDecision } from '../../core/world/manager/ManagerControlledDecision';
import { bootstrap, value } from '../../core/world/club/ClubFixtures.test-support';
import { createClubFromSeed } from '../../core/world/club';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { openSqliteNationalRosterSnapshotStore } from './SqliteNationalRosterSnapshotStore';
import { openSqliteWorldControlStore } from './SqliteWorldControlStore';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { resolveAndRecordPitchAgainstBatter } from '../../core/sim/pitching/PitchAgainstBatter';
import { applyStrikeoutPlateAppearanceToMatchState } from '../../core/sim/plateAppearance/PlateAppearanceMatchState';
import { createPlayAdjudicationLedger, recordCorrectRuleSnapshot, closeOfficialPlay } from '../../core/adjudication/PlayAdjudicationLedger';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { match, worldSetup } from './OfficialParticipationPlayFixtures.test-support';
import type { PlayerWorkloadActivity } from '../../core/world/development/PlayerWorkloadRecovery';
import type { LegalRosterActionBinding } from '../../core/world/manager/ExecutedRosterDecisionDispatcher';
import { openSqlitePlayerHealthRehabStore, type AcceptedHealthDiagnosis, type AcceptedHealthRehabEffect } from './SqlitePlayerHealthRehabStore';

export const healthRehabDiagnosis: AcceptedHealthDiagnosis = { sourceId: 'injury-1', sourceVersion: 'v1', clinicalRecordId: 'diagnosis-record', personLinkSourceId: 'intake-p2',
  previousCaseId: null, diagnosis: { caseId: 'injury-1', careerId: 'career-a', playerId: 'p2', diagnosedAtDay: 2, injuryBurden: 0.8,
    policy: { policyId: 'clinical-fixture', version: 'v1', availableAtDay: 1, medicalBurdenReductionPerHour: 0.2,
      rehabEntryMaximumBurden: 0.5, returnMaximumBurden: 0.1, practiceExposurePerEffortUnit: 1, minimumPracticeExposure: 1, minimumRehabGames: 1 } } };

/** Actual Native owners, with explicit synthetic reserve medical/competition calibration. */
export const healthRehabFixture = (options: Readonly<{ gameId?: string }> = {}) => {
  const gameId = options.gameId ?? 'rehab-game';
  const path = join(mkdtempSync(join(tmpdir(), 'minibaseball-health-rehab-')), 'world.db');
  const stores: { close(): void }[] = [], track = <T extends { close(): void }>(store: T): T => { stores.push(store); return store; };
  const world = track(openSqliteWorldSettlementStore(path)), roster = track(openSqliteManagerRosterDecisionStore(path));
  const creation = bootstrap();
  const club = value(createClubFromSeed({ ...creation, context: { ...creation.context, effectiveDay: 1 },
    initial: { ...creation.initial, season: { ...creation.initial.season, startsOnDay: 1, competitionEditionIds: ['reserve-1'] } } }));
  world.initialize({ careerId: 'career-a', clubs: [club],
    schedule: { leagueId: 'reserve-fixture', seasonId: 'reserve-1',
    memberClubIds: ['club-a', 'club-b'], regularSeasonGamesPerClub: 1, revisionEventIds: [],
    games: [{ gameId, homeClubId: 'club-a', awayClubId: 'club-b' }] },
    standingsPolicy: { version: 'fixture-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 } });
  const players = worldSetup('p2').defenders.map((defender) => defender.playerId);
  roster.initialize({ careerId: 'career-a', clubId: 'club-a', mood: null, roster: createRosterState({ careerId: 'career-a', effectiveDay: 1,
    profiles: [{ profileId: 'reserve-fixture', version: 'v1', season: 1, competitionEditionId: 'reserve-1', activeLimit: null,
      allowedAssignmentKinds: ['RESERVE'], rehabParticipationAllowed: true }], units: [{ unitId: 'reserve-a', clubId: 'club-a', kind: 'RESERVE' }],
    players: [...players, 'unused'].map((playerId) => ({ playerId, clubRights: { rightsHolderClubId: 'club-a', contractId: `contract-${playerId}` },
      assignment: { unitId: 'reserve-a', clubId: 'club-a' }, registrations: [{ competitionEditionId: 'reserve-1', clubId: 'club-a', status: 'ACTIVE',
        eligibility: 'ELIGIBLE', evidenceId: 'accepted-reserve-registration' }], availability: { status: 'AVAILABLE', evidenceId: 'initial-clinical' } })) }) });
  const links = track(openSqlitePlayerPersonLinkStore(path, { readAcceptedPlayerIntake: (sourceId) => [...players, 'unused'].some((p) => sourceId === `intake-${p}`)
    ? { sourceId, sourceVersion: 'v1', careerId: 'career-a', playerId: sourceId.slice(7), personId: `person-${sourceId.slice(7)}`,
      sourceRecordId: `accepted-${sourceId}`, acceptedRevision: 0, acceptedAtDay: 1, rosterRevision: 0 } : null }));
  links.acceptBatch([...players, 'unused'].map((p) => `intake-${p}`));
  const activities = new Map<string, PlayerWorkloadActivity>();
  const workload = track(openSqlitePlayerWorkloadRecoveryStore(path, links, { readAcceptedBaseline: (sourceId) => sourceId === 'workload-p2'
    ? { sourceId, sourceVersion: 'v1', personLinkSourceId: 'intake-p2', careerId: 'career-a', playerId: 'p2', createdAtDay: 1, fatigue: 0,
      recoveryCapacity: 1, policy: { policyId: 'workload-fixture', version: 'v1', availableAtDay: 1,
        workloadFatiguePerUnit: 0.1, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } } : null,
    readAcceptedActivity: (sourceId) => activities.get(sourceId) ?? null }));
  workload.initialize('workload-p2');
  const snapshots = track(openSqliteNationalRosterSnapshotStore(path, { roster }));
  const official = track(new SqliteOfficialStateStore(path));
  official.registerOfficialFixture({ gameId, venueId: 'reserve-field', fixtureEventId: 'rehab-fixture', fixtureRevision: 0 });
  official.initializeMatch(gameId, match());
  const participation = track(new SqliteOfficialParticipationStore(path, {
    readGame: (requestedGameId) => requestedGameId === gameId && world.readSeason('career-a', 'reserve-1') ? { careerId: 'career-a', competitionEditionId: 'reserve-1',
      gameDay: 10, homeClubId: 'club-a', awayClubId: 'club-b', fixtureEventId: 'rehab-fixture' } : null,
    readRoster: (c, clubId) => roster.readHead(c, clubId)?.roster ?? null,
    readPersonLink: (p, sourceId) => { const link = links.readLink(sourceId); return link?.playerId === p ? { sourceId, personId: link.personId } : null; },
  }));
  const control = track(openSqliteWorldControlStore(path));
  control.initialize({ careerId: 'career-a', worldRevision: 0, control: createHumanControlState({ revision: 0, controllerId: 'human',
    controlledClubId: 'club-a', domainIds: ['ROSTER'], manualDomainIds: [] }) });
  const applyAvailability = (binding: LegalRosterActionBinding) => {
    const r = roster.readHead('career-a', 'club-a')!, w = control.readHead('career-a')!;
    const score = { mean: 1, uncertainty: 0, evidence: 1 };
    const selectionAgent = { managerId: 'manager-a', appointmentId: 'appointment-a', state: {
      skills: { tacticalJudgment: 50, analysis: 50, adaptation: 50, playerEvaluation: 50, operations: 50, leadership: 50 },
      philosophy: { preferredStyleTags: [] as string[] }, temperament: { riskAppetite: 50, decisionPace: 50, policyPersistence: 50, noveltyAppetite: 50, consultationStyle: 50 },
      strategyMemory: { activePolicyActionIds: [] as string[] }, beliefs: { candidates: ['injured', 'rehab', 'return', 'stale-return'].map((actionId) => ({
        actionId, styleTags: [] as string[], competitiveOutcome: score, resourceHealth: score, executionFeasibility: score, opponentInformationResponse: score })) } } };
    const issued = roster.issueOpportunity({ careerId: 'career-a', clubId: 'club-a', expectedClubRevision: 0, expectedRosterRevision: r.roster.revision,
      clubAsOfDay: binding.command.effectiveDay, control: w.control, decisionId: binding.actionId, contextId: binding.actionId,
      worldRevision: w.worldRevision, candidates: [binding], selectionAgent });
    const selection = selectManagerControlledDecision(w.control, issued.opportunity, selectionAgent, `trace-${binding.actionId}`);
    if (!selection.ok) throw new Error('medical roster selection fixture failed');
    const request = { careerId: 'career-a', clubId: 'club-a', expectedClubRevision: 0, expectedRosterRevision: r.roster.revision, expectedMoodRevision: null,
      clubAsOfDay: binding.command.effectiveDay, control: w.control, opportunity: issued.opportunity, selection: selection.value, selectionAgent,
      binding, currentWorldRevision: w.worldRevision, afterWorldRevision: w.worldRevision + 1, executionId: `execute-${binding.actionId}` };
    return { request, execute: () => roster.apply(request) };
  };
  const record = (sourceEventId: string, atDay: number, detail: object) => {
    const activity = { sourceEventId, sourceVersion: 'v1', evidenceId: `actual-${sourceEventId}`, careerId: 'career-a', playerId: 'p2', atDay,
      ...detail } as PlayerWorkloadActivity;
    activities.set(sourceEventId, activity); workload.apply(sourceEventId, workload.readHead('career-a', 'p2')!.revision); return activity;
  };
  const play = () => {
    const head = roster.readHead('career-a', 'club-a')!, snapshot = snapshots.capture('career-a', 'club-a');
    for (const playerId of [...players, 'unused']) participation.bindPregame({ gameId, careerId: 'career-a', competitionEditionId: 'reserve-1',
      gameDay: 10, clubId: 'club-a', side: 'HOME', playerId, personId: `person-${playerId}`, personLinkSourceId: `intake-${playerId}`,
      rosterRevision: head.roster.revision, fixtureEventId: 'rehab-fixture' });
    const apply = (before: CanonicalMatchState, revision: number, startedAtTick: number, applicationId: string) => {
      let timeline = createCanonicalPlateAppearanceTimeline(before, startedAtTick);
      for (let i = 0; i < 3; i++) {
        const tick = timeline.lastEventTick + 1;
        timeline = resolveAndRecordPitchAgainstBatter(timeline, { action: { kind: 'take' }, trajectory: {
          start: { tick, position: { x: 0, y: 1.5, z: 18 }, velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } },
          acceleration: { x: 0, y: 0, z: 0 }, endTick: tick + 700_000, ticksPerSecond: 1_000_000 },
          plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.6 }, ballRadiusMeters: 0.0366 }).timeline;
      }
      const next = applyStrikeoutPlateAppearanceToMatchState(before, timeline);
      let adjudication = createPlayAdjudicationLedger({ playId: before.playId, ruleProfileId: before.ruleProfileId, playEnd: null });
      adjudication = recordCorrectRuleSnapshot(adjudication, 0, { eventId: `rule-${applicationId}`, snapshotId: `rule-${applicationId}`,
        tick: timeline.lastEventTick + 1, evidenceRevision: 1, ruling: { outsAfter: next.outs, basesAfter: next.bases, scoredRunnerIds: [] } });
      adjudication = closeOfficialPlay(adjudication, 1, { eventId: applicationId, closureId: applicationId, tick: timeline.lastEventTick + 2 });
      return official.applyAndActivate({ kind: 'non_live', matchId: gameId, applicationId, expectedDurableRevision: revision,
        match: before, timeline, adjudication, context: { kind: 'strikeout' }, nextStartedAtTick: timeline.lastEventTick + 3, worldSetup: worldSetup('p2') });
    };
    const first = apply(match(), 0, 0, 'rehab-activate');
    apply(first.activation.nextMatchState, 1, first.nextWorld.tick, 'rehab-close');
    const receipt = participation.confirmPlayed(gameId, 'p2', 'DEFENDER', 'rehab-activate', 'rehab-close');
    return { receipt, snapshot };
  };
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = track(new DatabaseSync(path));
  return { path, links, workload, snapshots, participation, roster, official, control, db, track, record, play, applyAvailability,
    close: () => stores.reverse().forEach((store) => store.close()) };
};

export const healthRehabStoreFixture = (initialize = true, options: Readonly<{ gameId?: string }> = {}) => {
  const f = healthRehabFixture(options), diagnoses = new Map([[healthRehabDiagnosis.sourceId, healthRehabDiagnosis]]);
  const effects = new Map<string, AcceptedHealthRehabEffect>();
  const sources = { personLinks: f.links, workload: f.workload, participation: f.participation, rosterSnapshots: f.snapshots, roster: f.roster };
  const authority = { readAcceptedDiagnosis: (sourceId: string) => diagnoses.get(sourceId) ?? null,
    readAcceptedEffect: (sourceId: string) => effects.get(sourceId) ?? null };
  const health = f.track(openSqlitePlayerHealthRehabStore(f.path, sources, authority));
  if (initialize) health.initialize('injury-1');
  const medical: AcceptedHealthRehabEffect = { sourceId: 'medical', sourceVersion: 'v1', caseId: 'injury-1', kind: 'MEDICAL_RECOVERY',
    clinicalRecordId: 'actual-treatment-record', workloadActivityId: 'treatment' };
  f.record('treatment', 3, { kind: 'RECOVERY', durationHours: 4, quality: 1, medicalAvailability: 1 }); effects.set(medical.sourceId, medical);
  const prepareGame = () => {
    f.applyAvailability(health.createAvailabilityAction({ careerId: 'career-a', clubId: 'club-a', caseId: 'injury-1', caseRevision: 0,
      actionId: 'injured', expectedRosterRevision: 0, effectiveDay: 2 })).execute();
    health.apply('medical', 0);
    f.applyAvailability(health.createAvailabilityAction({ careerId: 'career-a', clubId: 'club-a', caseId: 'injury-1', caseRevision: 1,
      actionId: 'rehab', expectedRosterRevision: 1, effectiveDay: 3 })).execute();
    f.record('rehab-practice', 4, { kind: 'PRACTICE', effortUnits: 2, healthAvailability: 1 });
    effects.set('practice', { sourceId: 'practice', sourceVersion: 'v1', caseId: 'injury-1', kind: 'REHAB_PRACTICE', clinicalRecordId: 'exercise-record', workloadActivityId: 'rehab-practice' });
    health.apply('practice', 1);
    const result = f.play();
    const game: AcceptedHealthRehabEffect = { sourceId: 'game', sourceVersion: 'v1', caseId: 'injury-1', kind: 'REHAB_GAME',
      participationReceiptId: result.receipt.receiptId, rosterSnapshotId: result.snapshot.snapshotId };
    effects.set(game.sourceId, game); return { ...result, game };
  };
  return { f, health, diagnoses, effects, sources, authority, medical, prepareGame };
};
