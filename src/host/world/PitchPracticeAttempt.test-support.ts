// Synthetic accepted calibration/opportunities; real SQLite owners and delivery
// models. These fixtures are not production practice scheduling or learning.
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';
import type { CanonicalPitchDelivery } from '../../core/sim/pitch/CanonicalPitchDelivery';
import type { PitchTimingIntent } from '../../core/sim/pitch/PitchTimingModel';
import type { Vec3 } from '../../core/model/geometry';
import type { DevelopmentLearningEpisode, DevelopmentLearningEventInput } from '../../core/world/development/DevelopmentLearningEpisode';
import type { PlayerPitchTimingSource } from '../../core/world/development/PlayerPitchTimingSource';
import type { PlayerWorkloadActivity, PlayerWorkloadRecoveryState } from '../../core/world/development/PlayerWorkloadRecovery';
import { CATALYST_FAMILIES } from '../../core/world/development/DevelopmentCatalyst';
import { DEVELOPMENT_DOMAINS, MATURITY_TIMINGS, CURVE_SHAPES } from '../../core/world/development/DevelopmentTrajectory';
import { STAR_GENESIS_POTENTIALS } from '../../core/world/development/StarGenesis';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { createRosterState } from '../../core/world/roster/RosterState';
import { createHumanControlState } from '../../core/world/control/HumanControl';
import { selectManagerControlledDecision } from '../../core/world/manager/ManagerControlledDecision';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteWorldControlStore } from './SqliteWorldControlStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqlitePersonGenesisStore } from './SqlitePersonGenesisStore';
import { openSqlitePlayerPitchTimingStore } from './SqlitePlayerPitchTimingStore';
import { openSqlitePlayerReleaseGeometryStore, type PlayerReleaseGeometrySnapshot } from './SqlitePlayerReleaseGeometryStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { openSqlitePitchFatiguePolicyStore, type AcceptedPitchFatiguePolicy } from './SqlitePitchFatiguePolicyStore';
import { openSqliteDevelopmentInitiationStore } from './SqliteDevelopmentInitiationStore';
import type { DevelopmentAppraisalSources } from './DevelopmentEpisodeFromAcceptedAppraisal';

// Test-owned contract for the absent producer. No production stub is installed.
export type PracticeOpportunity = {
  sourceId: string; sourceVersion: string; opportunityId: string; ordinal: number;
  previousAttemptId: string | null; careerId: string; playerId: string; personLinkSourceId: string;
  atDay: number; readyAtUs: number; workloadRevision: number; timingRevision: number; releaseRevision: number;
  fatiguePolicySourceId: string; practiceSeed: number; timingIntent: PitchTimingIntent;
  moundReference: Vec3; physics: { velocity: Vec3; spin: Vec3 };
  episode: { episodeId: string; revision: number; domain: 'TECHNICAL' } | null;
};
export type PracticeAssessment = {
  sourceId: string; sourceVersion: string; attemptId: string; completionHash: string;
  effortUnits: number; healthAvailability: number;
  provenance: { assessmentSourceId: string; assessmentVersion: string; calibrationSourceId: string; calibrationVersion: string };
};
export type PracticeAttempt = {
  attemptId: string; opportunity: PracticeOpportunity; revision: number; throughUs: number;
  priorClock: null | { attemptId: string; atDay: number; followThroughEndUs: number;
    completionHash: string; workloadActivityId: string; workloadRevision: number };
  status: 'IN_PROGRESS' | 'DELIVERY_COMPLETE';
  frame: { personLink: unknown; person: unknown; workload: PlayerWorkloadRecoveryState;
    timing: PlayerPitchTimingSource; release: PlayerReleaseGeometrySnapshot; policy: AcceptedPitchFatiguePolicy };
  plannedDelivery: CanonicalPitchDelivery;
  events: readonly { kind: 'motion_started' | 'gather_ended' | 'stride_started' | 'released' | 'follow_through_completed'; atUs: number }[];
  observation: null | { kind: 'RAW_TIMING'; deliveryMode: 'NORMAL' | 'QUICK'; motionStartUs: number; releaseUs: number; motionToReleaseUs: number };
  completionReference: null | { attemptId: string; revision: number; hash: string };
  assessment: PracticeAssessment | null;
};
type Database = import('node:sqlite').DatabaseSync;
type EvidenceDb = Pick<Database, 'prepare'>;
export type PracticeOwner = {
  begin(sourceId: string): PracticeAttempt;
  advance(attemptId: string, revision: number, throughUs: number): PracticeAttempt;
  acceptAssessment(sourceId: string): PracticeAttempt;
  read(attemptId: string): PracticeAttempt | null;
  readAcceptedActivity(sourceId: string): PlayerWorkloadActivity | null;
  readAcceptedLearningEvent(sourceId: string): DevelopmentLearningEventInput | null;
  assertWorkloadEvidence(db: EvidenceDb, activity: PlayerWorkloadActivity, phase: string): void;
  assertLearningEvidence(db: EvidenceDb, event: DevelopmentLearningEventInput, phase: string): void;
  settle(attemptId: string): { kind: 'pending'; reason: string; workload?: PlayerWorkloadRecoveryState }
    | { kind: 'complete'; activity: PlayerWorkloadActivity; workload: PlayerWorkloadRecoveryState; episode: DevelopmentLearningEpisode | null };
  close(): void;
};
type PracticeModule = { openSqlitePitchPracticeAttemptStore(path: string, sources: unknown, authority?: unknown): PracticeOwner };

export type PracticeFixtureHooks = {
  managerBeliefCandidates?: readonly import('../../core/world/manager/ManagerDecision').ManagerActionBelief[];
  quickSpeedFactor?: number;
  controlDomainIds?: readonly string[];
  manualControlDomainIds?: readonly string[];
  practiceOrderSources?: boolean;
  extraPracticeAuthority?: Readonly<Record<string, (sourceId: string) => unknown>>;
  readAcceptedTimingLearning?: (sourceId: string) => import('./SqlitePlayerPitchTimingStore').AcceptedPitchTimingLearning | null;
  assertTimingEvidence?: (db: EvidenceDb, source: import('./SqlitePlayerPitchTimingStore').AcceptedPitchTimingLearning, phase: string) => void;
};
export async function practiceFixture(cleanup: (() => void)[], hooks: PracticeFixtureHooks = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'actual-pitch-practice-')), path = join(directory, 'world.sqlite');
  const handles: { close(): void }[] = [];
  const keep = <T extends { close(): void }>(value: T): T => { handles.push(value); return value; };
  let owner: PracticeOwner | undefined;
  const close = () => { owner = undefined; while (handles.length) handles.pop()!.close(); };
  cleanup.push(() => rmSync(directory, { recursive: true, force: true }), close);
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  let world = keep(openSqliteWorldSettlementStore(path));
  world.initialize({ careerId: 'career-a', clubs: [state()], schedule: { seasonId: 'league-season-1', leagueId: 'league-a',
    memberClubIds: ['club-a', 'club-b'], regularSeasonGamesPerClub: 1,
    games: [{ gameId: 'scheduled-only', homeClubId: 'club-a', awayClubId: 'club-b' }], revisionEventIds: [] },
    standingsPolicy: { version: 'fixture-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 } });
  let roster = keep(openSqliteManagerRosterDecisionStore(path));
  roster.initialize({ careerId: 'career-a', clubId: 'club-a', mood: null, roster: createRosterState({ careerId: 'career-a', effectiveDay: 10,
    profiles: [{ profileId: 'fixture-league', version: 'v1', season: 1, competitionEditionId: 'league-season-1', activeLimit: null,
      allowedAssignmentKinds: ['FIRST_TEAM', 'RESERVE'], rehabParticipationAllowed: false }],
    units: [{ unitId: 'reserve', clubId: 'club-a', kind: 'RESERVE' }, { unitId: 'first', clubId: 'club-a', kind: 'FIRST_TEAM' }],
    players: [{ playerId: 'p1', clubRights: { rightsHolderClubId: 'club-a', contractId: 'contract-p1' },
      assignment: { unitId: 'reserve', clubId: 'club-a' }, registrations: [], availability: { status: 'AVAILABLE', evidenceId: 'accepted-health' } }] }) });
  const intake = { sourceId: 'intake-p1', sourceVersion: 'fixture-v1', careerId: 'career-a', playerId: 'p1', personId: 'person-p1',
    sourceRecordId: 'fixture-intake', acceptedRevision: 0, acceptedAtDay: 10, rosterRevision: 0 };
  let links = keep(openSqlitePlayerPersonLinkStore(path, { readAcceptedPlayerIntake: id => id === intake.sourceId ? intake : null }));
  links.accept(intake.sourceId);
  let person = keep(openSqlitePersonGenesisStore(path));
  const ones = { min: 1, max: 1 }, zero = { min: 0, max: 0 };
  const ranges = <T extends string>(keys: readonly T[], value: typeof ones) => Object.fromEntries(keys.map(key => [key, value])) as Record<T, typeof ones>;
  person.initializeCareer({ careerId: 'career-a', initializedAtDay: 10, careerSeed: 12345, policies: {
    trajectory: { policyId: 'fixture-trajectory', profileVersion: 'v1', availableAtDay: 10,
      timingWeights: { VERY_EARLY: 0, EARLY: 0, NORMAL: 1, LATE: 0, VERY_LATE: 0 },
      shapeWeights: { SHARP_PEAK: 0, BROAD_PLATEAU: 1, STEPWISE_WAVES: 0 }, domainOffsetRanges: ranges(DEVELOPMENT_DOMAINS, zero) },
    catalyst: { policyId: 'fixture-catalyst', profileVersion: 'v1', availableAtDay: 10,
      sensitivityRanges: ranges(CATALYST_FAMILIES, ones), signatureMotifs: [], signatureMotifCount: 0 },
    star: { policyId: 'fixture-star', profileVersion: 'v1', availableAtDay: 10,
      tierWeights: { ORDINARY: 1, STAR_CANDIDATE: 0, SUPERSTAR_CANDIDATE: 0 }, potentialRanges: {
        ORDINARY: ranges(STAR_GENESIS_POTENTIALS, zero), STAR_CANDIDATE: ranges(STAR_GENESIS_POTENTIALS, zero), SUPERSTAR_CANDIDATE: ranges(STAR_GENESIS_POTENTIALS, zero) } } } });
  person.materialize(intake.sourceId);
  const timingInput = { sourceId: 'timing-p1', sourceVersion: 'fixture-v1', careerId: 'career-a', playerId: 'p1', personLinkSourceId: intake.sourceId,
    acceptedAtDay: 10, profile: { baseStartIntervalUs: 10_000_000, normalMotionToReleaseUs: 600_000, followThroughUs: 200_000,
      quickSpeedFactor: hooks.quickSpeedFactor ?? 1.8, cadenceExecutionControl: 0.8, cadenceTimingKnowledge: 0.8, quickRepeatability: 0.8, naturalVariationUs: 50_000,
      normalPhaseWeights: { gather: 2, transition: 3, stride: 5 }, quickPhaseWeights: { gather: 1, transition: 2, stride: 3 } } };
  const releaseInput = { ...timingInput, sourceId: 'release-p1', body: { heightMeters: 1.8, shoulderHeightMeters: 1.5, armReachMeters: 0.8,
    postureDropMeters: 0.1, throwingSide: 'RIGHT' as const }, profile: { armSlotClass: 'OVERHAND' as const, releaseHeightTier: 'HIGH' as const,
    releaseHeightRatio: 0.9, releaseLateralRatio: 0.1, releaseExtensionRatio: 0.2, armSlotElevationDeg: 70, armSlotAzimuthDeg: 0 },
    tierBoundaries: [0.65, 0.7, 0.75, 0.8, 0.85, 0.95] };
  const timingLearning = new Map<string, import('./SqlitePlayerPitchTimingStore').AcceptedPitchTimingLearning>();
  // The optional fourth timing guard is a proposed consumer extension in the
  // next adapter's RED fixture. Existing callers retain their current behavior.
  const openTimingOwner = openSqlitePlayerPitchTimingStore as (...args: [...Parameters<typeof openSqlitePlayerPitchTimingStore>,
    PracticeFixtureHooks['assertTimingEvidence']?]) => ReturnType<typeof openSqlitePlayerPitchTimingStore>;
  const openTiming = (withAuthority: boolean) => keep(openTimingOwner(path, links, withAuthority ? {
    readAcceptedBaseline: id => id === timingInput.sourceId ? timingInput : null,
    readAcceptedLearning: id => timingLearning.get(id) ?? hooks.readAcceptedTimingLearning?.(id) ?? null,
  } : undefined, hooks.assertTimingEvidence));
  let timing = openTiming(true);
  const releaseChanges = new Map<string, import('./SqlitePlayerReleaseGeometryStore').AcceptedReleaseGeometryChange>();
  let release = keep(openSqlitePlayerReleaseGeometryStore(path, links, { readAcceptedBaseline: id => id === releaseInput.sourceId ? releaseInput : null,
    readAcceptedChange: id => releaseChanges.get(id) ?? null }));
  timing.initialize(timingInput.sourceId); release.initialize(releaseInput.sourceId);
  const workloadInput = { sourceId: 'workload-p1', sourceVersion: 'fixture-v1', personLinkSourceId: intake.sourceId,
    careerId: 'career-a', playerId: 'p1', createdAtDay: 10, fatigue: 0.2, recoveryCapacity: 0.5,
    policy: { policyId: 'fixture-workload', version: 'v1', availableAtDay: 10, workloadFatiguePerUnit: 0.1, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } };
  const activities = new Map<string, PlayerWorkloadActivity>();
  const openWorkload = () => keep(openSqlitePlayerWorkloadRecoveryStore(path, links, {
    readAcceptedBaseline: id => id === workloadInput.sourceId ? workloadInput : null,
    readAcceptedActivity: id => activities.get(id) ?? owner?.readAcceptedActivity(id) ?? null },
  (db, activity, phase) => { if (activity.kind === 'PRACTICE') owner?.assertWorkloadEvidence(db, activity, phase); }));
  let workload = openWorkload(); workload.initialize(workloadInput.sourceId);
  const fatigueInput: AcceptedPitchFatiguePolicy = { sourceId: 'fatigue-p1', sourceVersion: 'fixture-v1', policyId: 'fixture-fatigue', version: 'v1',
    availableAtDay: 10, motionDurationScaleAtFullFatigue: 1.5, velocityRetentionAtFullFatigue: 0.8, spinRetentionAtFullFatigue: 0.9 };
  let policies = keep(openSqlitePitchFatiguePolicyStore(path, { readAcceptedPolicy: id => id === fatigueInput.sourceId ? fatigueInput : null }));
  policies.accept(fatigueInput.sourceId);

  // The catalyst is a genuinely issued/executed roster promotion, not practice.
  const control = createHumanControlState({ revision: 0, controllerId: 'human', controlledClubId: 'club-a',
    domainIds: hooks.controlDomainIds ?? ['ROSTER'], manualDomainIds: hooks.manualControlDomainIds ?? [] });
  let worldControl = keep(openSqliteWorldControlStore(path)); worldControl.initialize({ careerId: 'career-a', worldRevision: 0, control });
  const score = { mean: 1, uncertainty: 0, evidence: 1 };
  const agent = { managerId: 'manager-a', appointmentId: 'appointment-a', state: {
    skills: { tacticalJudgment: 50, analysis: 50, adaptation: 50, playerEvaluation: 50, operations: 50, leadership: 50 },
    philosophy: { preferredStyleTags: [] as string[] }, temperament: { riskAppetite: 50, decisionPace: 50, policyPersistence: 50, noveltyAppetite: 50, consultationStyle: 50 },
    beliefs: { candidates: [{ actionId: 'promote', styleTags: [] as string[], competitiveOutcome: score, resourceHealth: score,
      executionFeasibility: score, opponentInformationResponse: score }, ...(hooks.managerBeliefCandidates ?? [])] },
    strategyMemory: { activePolicyActionIds: [] as string[] } } };
  const binding = { actionId: 'promote', command: { commandId: 'promote', expectedRevision: 0, effectiveDay: 11,
    changes: [{ playerId: 'p1', assignment: { unitId: 'first', clubId: 'club-a' } }] } };
  const issued = roster.issueOpportunity({ careerId: 'career-a', clubId: 'club-a', expectedClubRevision: 0, expectedRosterRevision: 0,
    clubAsOfDay: 11, control, decisionId: 'promote-decision', contextId: 'promote-context', worldRevision: 0, candidates: [binding], selectionAgent: agent });
  const selected = selectManagerControlledDecision(control, issued.opportunity, agent, 'promotion-trace');
  if (!selected.ok) throw new Error('practice fixture promotion selection failed');
  roster.apply({ careerId: 'career-a', clubId: 'club-a', expectedClubRevision: 0, expectedRosterRevision: 0, expectedMoodRevision: null,
    clubAsOfDay: 11, control, opportunity: issued.opportunity, selection: selected.value, selectionAgent: agent, binding,
    currentWorldRevision: 0, afterWorldRevision: 1, executionId: 'promotion-execution' });
  const curves = Object.fromEntries(MATURITY_TIMINGS.map(t => [t, Object.fromEntries(CURVE_SHAPES.map(s => [s,
    [{ ageYears: 0, receptivity: 1, declinePressure: 0 }, { ageYears: 40, receptivity: 1, declinePressure: 0 }]]))])) as unknown as
    import('../../core/world/development/DevelopmentReceptivity').DevelopmentReceptivityPolicy['templateCurves'];
  const episodeSources = (): Omit<DevelopmentAppraisalSources, 'history'> => ({ roster, person,
    appraisal: { readAcceptedAppraisal: id => id === 'appraisal' ? { sourceId: id, episodeId: 'episode', careerId: 'career-a', playerId: 'p1',
      domain: 'TECHNICAL', ageYears: 20, competingLearningLoad: 0, appraisal: { sourceEventId: id, atDay: 11,
        salience: 1, learningDisposition: 1, novelty: 1, consolidationCapacity: 1 } } : null },
    policies: { readAcceptedPolicies: id => id === 'learning-policies' ? { sourceId: id, careerId: 'career-a',
      learning: { policyId: 'fixture-learning', version: 'v1', availableAtDay: 10, minimumPracticeEvents: 3, minimumFeedbackEvents: 1, minimumElapsedDays: 5 },
      receptivity: { policyId: 'fixture-receptivity', version: 'v1', profileVersion: 'v1', availableAtDay: 10, templateCurves: curves },
      initiation: { policyId: 'fixture-initiation', version: 'v1', availableAtDay: 10, baseChance: 1, maximumChance: 1,
        sameMotifSaturation: 0.5, cooldownDays: 30, maximumOpenHypotheses: 2 } } : null } });
  const learningEvents = new Map<string, DevelopmentLearningEventInput>([['hypothesis', {
    eventId: 'hypothesis', sourceEventId: 'hypothesis', kind: 'HYPOTHESIS_FORMED', atDay: 12, domain: 'TECHNICAL' }]]);
  // The fourth argument is the planned optional existing-owner evidence guard.
  // It introduces no production placeholder before the observed RED gate.
  const openEpisode = openSqliteDevelopmentInitiationStore as (...args: [...Parameters<typeof openSqliteDevelopmentInitiationStore>,
    ((db: EvidenceDb, event: DevelopmentLearningEventInput, phase: string) => void)?]) => ReturnType<typeof openSqliteDevelopmentInitiationStore>;
  const openEpisodes = () => keep(openEpisode(path, episodeSources(), { readAcceptedLearningEvent: id =>
    learningEvents.get(id) ?? owner?.readAcceptedLearningEvent(id) ?? null },
  (db, event, phase) => { if (event.kind === 'PRACTICE_RECORDED') owner?.assertLearningEvidence(db, event, phase); }));
  let episodes = openEpisodes();
  const initiated = episodes.apply({ episodeId: 'episode', executionId: 'promotion-execution', playerId: 'p1',
    personSourceId: intake.sourceId, appraisalSourceId: 'appraisal', policySourceId: 'learning-policies' });
  if (initiated.episode.stage !== 'ENGAGED') throw new Error('practice fixture initiation did not engage');
  episodes.advance('episode', 'hypothesis', initiated.episode.revision);
  let db = keep(new DatabaseSync(path));
  if (db.prepare("SELECT name FROM sqlite_master WHERE name IN ('matches','official_fixtures')").all().length) throw new Error('practice fixture fabricated a Match');
  const opportunity: PracticeOpportunity = { sourceId: 'opportunity-0', sourceVersion: 'fixture-v1', opportunityId: 'practice-session', ordinal: 0,
    previousAttemptId: null, careerId: 'career-a', playerId: 'p1', personLinkSourceId: intake.sourceId,
    atDay: 13, readyAtUs: 0, workloadRevision: 0, timingRevision: 0, releaseRevision: 0, fatiguePolicySourceId: fatigueInput.sourceId,
    practiceSeed: 31415, timingIntent: { deliveryMode: 'NORMAL', cadenceIntent: 'STANDARD' }, moundReference: { x: 0, y: 0, z: 18 },
    physics: { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } },
    episode: { episodeId: 'episode', revision: episodes.read('episode')!.episode.revision, domain: 'TECHNICAL' } };
  const opportunities = new Map([[opportunity.sourceId, opportunity]]), assessments = new Map<string, PracticeAssessment>();
  let timingReads = 0;
  // Call-through observation only: every result still comes from the real owner.
  const sources = () => ({ personLinks: links, person, timing: { ...timing,
    readHead: (...args: Parameters<typeof timing.readHead>) => { timingReads++; return timing.readHead(...args); },
    selectAtRevision: (...args: Parameters<typeof timing.selectAtRevision>) => { timingReads++; return timing.selectAtRevision(...args); } },
  release, workload, policies, episodes,
  orders: hooks.practiceOrderSources ? { world, control: worldControl, roster } : undefined });
  const module = await vi.importActual<PracticeModule>('./SqlitePitchPracticeAttemptStore');
  owner = keep(module.openSqlitePitchPracticeAttemptStore(path, sources(), {
    ...hooks.extraPracticeAuthority,
    readAcceptedOpportunity: (id: string) => opportunities.get(id) ?? null,
    readAcceptedAssessment: (id: string) => assessments.get(id) ?? null }));
  const complete = (sourceId = opportunity.sourceId) => { const first = owner!.begin(sourceId);
    return owner!.advance(first.attemptId, first.revision, first.plannedDelivery.timeline.followThroughEndUs); };
  const assess = (attempt: PracticeAttempt, overrides: Partial<PracticeAssessment> = {}) => {
    const assessment: PracticeAssessment = { sourceId: `assessment:${attempt.attemptId}`, sourceVersion: 'fixture-v1', attemptId: attempt.attemptId,
      completionHash: attempt.completionReference!.hash, effortUnits: 1, healthAvailability: 0.9,
      provenance: { assessmentSourceId: `observed-effort:${attempt.attemptId}`, assessmentVersion: 'fixture-v1',
        calibrationSourceId: 'fixture-effort-health', calibrationVersion: 'v1' }, ...overrides };
    assessments.set(assessment.sourceId, assessment); return owner!.acceptAssessment(assessment.sourceId);
  };
  const recordRecovery = () => { const before = workload.readHead('career-a', 'p1')!;
    const activity: PlayerWorkloadActivity = { sourceEventId: `recovery:${before.revision}`, sourceVersion: 'fixture-v1', evidenceId: 'accepted-recovery',
      careerId: 'career-a', playerId: 'p1', atDay: 13, kind: 'RECOVERY', durationHours: 1, quality: 1, medicalAvailability: 1 };
    activities.set(activity.sourceEventId, activity); return workload.apply(activity.sourceEventId, before.revision); };
  const nextOpportunity = (previous: PracticeAttempt, overrides: Partial<PracticeOpportunity> = {}) => {
    const next: PracticeOpportunity = { ...opportunity, sourceId: `opportunity-${previous.opportunity.ordinal + 1}`, ordinal: previous.opportunity.ordinal + 1,
      previousAttemptId: previous.attemptId, readyAtUs: previous.plannedDelivery.timeline.followThroughEndUs + 1,
      workloadRevision: workload.readHead('career-a', 'p1')!.revision, timingRevision: timing.readHead('career-a', 'p1')!.revision,
      releaseRevision: release.readHead('career-a', 'p1')!.revision,
      episode: { episodeId: 'episode', domain: 'TECHNICAL', revision: episodes.read('episode')!.episode.revision }, ...overrides };
    opportunities.set(next.sourceId, next); return next;
  };
  const reopen = () => { close(); roster = keep(openSqliteManagerRosterDecisionStore(path)); links = keep(openSqlitePlayerPersonLinkStore(path));
    if (hooks.practiceOrderSources) { world = keep(openSqliteWorldSettlementStore(path)); worldControl = keep(openSqliteWorldControlStore(path)); }
    person = keep(openSqlitePersonGenesisStore(path)); timing = openTiming(false);
    release = keep(openSqlitePlayerReleaseGeometryStore(path, links)); workload = openWorkload(); policies = keep(openSqlitePitchFatiguePolicyStore(path));
    episodes = openEpisodes(); db = keep(new DatabaseSync(path)); owner = keep(module.openSqlitePitchPracticeAttemptStore(path, sources())); };
  return { path, opportunity, opportunities, assessments, activities, learningEvents, timingLearning, releaseChanges, timingInput, releaseInput, fatigueInput,
    get owner() { return owner!; }, get db() { return db; }, get sources() { return sources(); },
    get roster() { return roster; },
    complete, assess, nextOpportunity, recordRecovery, reopen, close, readTimingCount: () => timingReads,
    count: (table: string) => Number(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n),
    snapshot: (table: string) => JSON.stringify(db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()) };
}
