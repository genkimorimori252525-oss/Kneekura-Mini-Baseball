// Synthetic accepted fixture inputs only. Every physical/state transition below
// uses its existing Native owner. No discovery detector or calibration is implied.
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'vitest';
import { CATALYST_FAMILIES } from '../../core/world/development/DevelopmentCatalyst';
import { DEVELOPMENT_DOMAINS, MATURITY_TIMINGS, CURVE_SHAPES } from '../../core/world/development/DevelopmentTrajectory';
import { STAR_GENESIS_POTENTIALS } from '../../core/world/development/StarGenesis';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { createRosterState } from '../../core/world/roster/RosterState';
import type { AcceptedDevelopmentAppraisal, AcceptedDevelopmentPolicies } from './DevelopmentEpisodeFromAcceptedAppraisal';
import type { PitchPracticeAssessment, PitchPracticeAttempt, PitchPracticeOpportunity } from './PitchPracticeAttempt';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqlitePersonGenesisStore } from './SqlitePersonGenesisStore';
import { openSqlitePlayerPitchTimingStore } from './SqlitePlayerPitchTimingStore';
import { openSqlitePlayerReleaseGeometryStore } from './SqlitePlayerReleaseGeometryStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { openSqlitePitchFatiguePolicyStore, type AcceptedPitchFatiguePolicy } from './SqlitePitchFatiguePolicyStore';
import { openSqliteDevelopmentInitiationStore } from './SqliteDevelopmentInitiationStore';
import { openSqlitePitchPracticeAttemptStore, type SqlitePitchPracticeAttemptStore } from './SqlitePitchPracticeAttemptStore';

export function practiceOriginFixture(cleanup: (() => void)[]) {
  const directory = mkdtempSync(join(tmpdir(), 'practice-origin-prerequisite-'));
  const path = join(directory, 'world.sqlite'), handles: { close(): void }[] = [];
  const keep = <T extends { close(): void }>(value: T): T => { handles.push(value); return value; };
  let owner: SqlitePitchPracticeAttemptStore | undefined;
  const close = () => { owner = undefined; while (handles.length) handles.pop()!.close(); };
  // Register cleanup before opening any owner, and before an absent-entry probe.
  cleanup.push(() => rmSync(directory, { recursive: true, force: true }), close);
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const world = keep(openSqliteWorldSettlementStore(path));
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
      quickSpeedFactor: 1.8, cadenceExecutionControl: 0.8, cadenceTimingKnowledge: 0.8, quickRepeatability: 0.8, naturalVariationUs: 50_000,
      normalPhaseWeights: { gather: 2, transition: 3, stride: 5 }, quickPhaseWeights: { gather: 1, transition: 2, stride: 3 } } };
  const releaseInput = { ...timingInput, sourceId: 'release-p1', body: { heightMeters: 1.8, shoulderHeightMeters: 1.5, armReachMeters: 0.8,
    postureDropMeters: 0.1, throwingSide: 'RIGHT' as const }, profile: { armSlotClass: 'OVERHAND' as const, releaseHeightTier: 'HIGH' as const,
    releaseHeightRatio: 0.9, releaseLateralRatio: 0.1, releaseExtensionRatio: 0.2, armSlotElevationDeg: 70, armSlotAzimuthDeg: 0 },
    tierBoundaries: [0.65, 0.7, 0.75, 0.8, 0.85, 0.95] };
  let timing = keep(openSqlitePlayerPitchTimingStore(path, links, {
    readAcceptedBaseline: id => id === timingInput.sourceId ? timingInput : null, readAcceptedLearning: () => null }));
  let release = keep(openSqlitePlayerReleaseGeometryStore(path, links, {
    readAcceptedBaseline: id => id === releaseInput.sourceId ? releaseInput : null, readAcceptedChange: () => null }));
  timing.initialize(timingInput.sourceId); release.initialize(releaseInput.sourceId);
  const workloadInput = { sourceId: 'workload-p1', sourceVersion: 'fixture-v1', personLinkSourceId: intake.sourceId,
    careerId: 'career-a', playerId: 'p1', createdAtDay: 10, fatigue: 0.2, recoveryCapacity: 0.5,
    policy: { policyId: 'fixture-workload', version: 'v1', availableAtDay: 10, workloadFatiguePerUnit: 0.1, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } };
  const openWorkload = () => keep(openSqlitePlayerWorkloadRecoveryStore(path, links, {
    readAcceptedBaseline: id => id === workloadInput.sourceId ? workloadInput : null,
    readAcceptedActivity: id => owner?.readAcceptedActivity(id) ?? null },
  (db, activity, phase) => {
    if (!owner) throw new Error('practice evidence owner is not open');
    owner.assertWorkloadEvidence(db, activity, phase);
  }));
  let workload = openWorkload(); workload.initialize(workloadInput.sourceId);
  const fatigueInput: AcceptedPitchFatiguePolicy = { sourceId: 'fatigue-p1', sourceVersion: 'fixture-v1', policyId: 'fixture-fatigue', version: 'v1',
    availableAtDay: 10, motionDurationScaleAtFullFatigue: 1.5, velocityRetentionAtFullFatigue: 0.8, spinRetentionAtFullFatigue: 0.9 };
  let policies = keep(openSqlitePitchFatiguePolicyStore(path, { readAcceptedPolicy: id => id === fatigueInput.sourceId ? fatigueInput : null }));
  policies.accept(fatigueInput.sourceId);
  // Missing accepted appraisal/policies remain missing. No roster execution,
  // development initiation or hypothesis is needed to initialize this owner.
  const openEpisodes = () => keep(openSqliteDevelopmentInitiationStore(path, { roster, person,
    appraisal: { readAcceptedAppraisal: () => null }, policies: { readAcceptedPolicies: () => null } }));
  let episodes = openEpisodes();
  const opportunity: PitchPracticeOpportunity = { sourceId: 'origin-opportunity', sourceVersion: 'fixture-v1', opportunityId: 'origin-session', ordinal: 0,
    previousAttemptId: null, careerId: 'career-a', playerId: 'p1', personLinkSourceId: intake.sourceId,
    atDay: 13, readyAtUs: 0, workloadRevision: 0, timingRevision: 0, releaseRevision: 0, fatiguePolicySourceId: fatigueInput.sourceId,
    practiceSeed: 31415, timingIntent: { deliveryMode: 'NORMAL', cadenceIntent: 'STANDARD' }, moundReference: { x: 0, y: 0, z: 18 },
    physics: { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } }, episode: null };
  const opportunities = new Map([[opportunity.sourceId, opportunity]]), assessments = new Map<string, PitchPracticeAssessment>();
  const sources = () => ({ personLinks: links, person, timing, release, workload, policies, episodes });
  owner = keep(openSqlitePitchPracticeAttemptStore(path, sources(), {
    readAcceptedOpportunity: id => opportunities.get(id) ?? null, readAcceptedAssessment: id => assessments.get(id) ?? null }));
  let db = keep(new DatabaseSync(path));
  const assess = (attempt: PitchPracticeAttempt) => {
    if (!attempt.completionReference) throw new Error('fixture assessment requires actual completion');
    const assessment: PitchPracticeAssessment = { sourceId: `fixture-assessment:${attempt.attemptId}`, sourceVersion: 'fixture-v1',
      attemptId: attempt.attemptId, completionHash: attempt.completionReference.hash, effortUnits: 1, healthAvailability: 0.9,
      provenance: { assessmentSourceId: `fixture-observed-effort:${attempt.attemptId}`, assessmentVersion: 'fixture-v1',
        calibrationSourceId: 'fixture-effort-health', calibrationVersion: 'v1' } };
    assessments.set(assessment.sourceId, assessment);
    return owner!.acceptAssessment(assessment.sourceId);
  };
  const reopen = () => {
    close(); roster = keep(openSqliteManagerRosterDecisionStore(path)); links = keep(openSqlitePlayerPersonLinkStore(path));
    person = keep(openSqlitePersonGenesisStore(path)); timing = keep(openSqlitePlayerPitchTimingStore(path, links));
    release = keep(openSqlitePlayerReleaseGeometryStore(path, links)); workload = openWorkload();
    policies = keep(openSqlitePitchFatiguePolicyStore(path)); episodes = openEpisodes();
    owner = keep(openSqlitePitchPracticeAttemptStore(path, sources())); db = keep(new DatabaseSync(path));
  };
  return { path, opportunity, opportunities, assessments, assess, reopen,
    get owner() { return owner!; }, get db() { return db; }, get sources() { return sources(); }, get roster() { return roster; },
    count: (table: string) => Number(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n),
    snapshot: (table: string) => JSON.stringify(db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()) };
}

export type PracticeOriginFixture = ReturnType<typeof practiceOriginFixture>;

// A future consumer must still require these externally accepted facts. RAW_TIMING,
// effort and health do not imply discovery, its canonical identity or its motif.
export type AcceptedPracticeDiscoveryFixture = AcceptedDevelopmentAppraisal & Readonly<{
  sourceVersion: string;
  discovery: Readonly<{ sourceEventId: string; occurredAtDay: number; motifId: string;
    completionReference: NonNullable<PitchPracticeAttempt['completionReference']> }>;
}>;
export function acceptedPracticeDiscoveryFixture(completed: PitchPracticeAttempt) {
  if (!completed.completionReference || !completed.assessment || completed.opportunity.episode !== null) {
    throw new Error('fixture discovery input requires an assessed actual origin');
  }
  const appraisal: AcceptedPracticeDiscoveryFixture = {
    sourceId: 'fixture-accepted-practice-appraisal', sourceVersion: 'fixture-v1', episodeId: 'practice-origin-episode',
    careerId: completed.opportunity.careerId, playerId: completed.opportunity.playerId, domain: 'TECHNICAL', ageYears: 20, competingLearningLoad: 0,
    appraisal: { sourceEventId: 'fixture-personal-appraisal-response', atDay: 13, salience: 1, learningDisposition: 1, novelty: 1, consolidationCapacity: 1 },
    discovery: { sourceEventId: 'fixture-canonical-discovery-event', occurredAtDay: 13,
      motifId: 'fixture-accepted-technical-motif', completionReference: completed.completionReference } };
  const curves = Object.fromEntries(MATURITY_TIMINGS.map(t => [t, Object.fromEntries(CURVE_SHAPES.map(s => [s,
    [{ ageYears: 0, receptivity: 1, declinePressure: 0 }, { ageYears: 40, receptivity: 1, declinePressure: 0 }]]))])) as unknown as
      AcceptedDevelopmentPolicies['receptivity']['templateCurves'];
  const policies: AcceptedDevelopmentPolicies = { sourceId: 'fixture-accepted-development-policies', careerId: completed.opportunity.careerId,
    learning: { policyId: 'fixture-learning', version: 'v1', availableAtDay: 10, minimumPracticeEvents: 3, minimumFeedbackEvents: 1, minimumElapsedDays: 5 },
    receptivity: { policyId: 'fixture-receptivity', version: 'v1', profileVersion: 'v1', availableAtDay: 10, templateCurves: curves },
    initiation: { policyId: 'fixture-initiation', version: 'v1', availableAtDay: 10, baseChance: 1, maximumChance: 1,
      sameMotifSaturation: 0.5, cooldownDays: 30, maximumOpenHypotheses: 2 } };
  return { appraisal, policies, request: { episodeId: appraisal.episodeId, playerId: appraisal.playerId,
    personSourceId: completed.opportunity.personLinkSourceId, appraisalSourceId: appraisal.sourceId, policySourceId: policies.sourceId } };
}

export function assertPracticeOriginPrerequisite(f: PracticeOriginFixture) {
  const emptyTables = ['world_roster_executions', 'world_roster_opportunities', 'world_development_initiations', 'world_development_learning_events'];
  const unchangedTables = ['world_roster_heads', 'world_player_person_links', 'world_person_genesis_careers', 'world_person_priors',
    'world_pitch_timing_baselines', 'world_pitch_timing_updates', 'world_player_release_baselines', 'world_player_release_changes'];
  const originals = unchangedTables.map(table => [table, f.snapshot(table)] as const);
  const assertOriginals = () => {
    for (const table of emptyTables) expect(f.count(table), table).toBe(0);
    for (const [table, original] of originals) expect(f.snapshot(table), table).toBe(original);
    expect(f.roster.readHead('career-a', 'club-a')!.roster.revision).toBe(0);
    expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name IN ('matches','official_fixtures','physical_pitch_progress_actions')").all()).toEqual([]);
  };
  assertOriginals();
  const begun = f.owner.begin(f.opportunity.sourceId);
  expect(begun.opportunity).toEqual(f.opportunity);
  expect(begun.opportunity.episode).toBeNull();
  expect(begun.priorClock).toBeNull();
  expect(begun.events).toEqual([]);
  expect(begun.completionReference).toBeNull();
  expect(f.owner.settle(begun.attemptId)).toEqual({ kind: 'pending', reason: 'delivery_incomplete' });
  expect(f.count('world_player_workload_activities')).toBe(0);
  const t = begun.plannedDelivery.timeline;
  let current = begun;
  const phases = [
    { kind: 'motion_started', atUs: t.motionStartUs }, { kind: 'gather_ended', atUs: t.gatherEndUs },
    { kind: 'stride_started', atUs: t.strideStartUs }, { kind: 'released', atUs: t.releaseUs },
    { kind: 'follow_through_completed', atUs: t.followThroughEndUs },
  ];
  for (const [index, phase] of phases.entries()) {
    current = f.owner.advance(current.attemptId, current.revision, phase.atUs);
    expect(current.events).toEqual(phases.slice(0, index + 1));
    expect(current.frame).toEqual(begun.frame);
    if (index < phases.length - 1) expect(current.completionReference).toBeNull();
  }
  expect(current.status).toBe('DELIVERY_COMPLETE');
  expect(current.completionReference).toMatchObject({ attemptId: begun.attemptId, revision: current.revision });
  expect(current.completionReference!.hash).toMatch(/^[a-f0-9]{64}$/);
  expect(current.observation).toEqual({ kind: 'RAW_TIMING', deliveryMode: 'NORMAL', motionStartUs: t.motionStartUs,
    releaseUs: t.releaseUs, motionToReleaseUs: t.releaseUs - t.motionStartUs });
  expect(f.owner.settle(current.attemptId)).toEqual({ kind: 'pending', reason: 'assessment_missing' });
  expect(f.count('world_player_workload_activities')).toBe(0);
  const completed = f.assess(current);
  expect(completed.assessment).toMatchObject({ attemptId: completed.attemptId, completionHash: completed.completionReference!.hash });
  const result = f.owner.settle(completed.attemptId);
  expect(result.kind).toBe('complete');
  if (result.kind !== 'complete') throw new Error('practice origin prerequisite did not settle');
  expect(result.episode).toBeNull();
  expect(result.activity).toMatchObject({ kind: 'PRACTICE', careerId: 'career-a', playerId: 'p1',
    evidenceId: completed.completionReference!.hash, effortUnits: 1, healthAvailability: 0.9 });
  expect(result.workload.revision).toBe(begun.frame.workload.revision + 1);
  expect(result.workload.fatigue).toBeGreaterThan(begun.frame.workload.fatigue);
  const receipt = f.sources.workload.readActivity(result.activity.sourceEventId);
  expect(receipt).toEqual({ activity: result.activity, before: begun.frame.workload, after: result.workload });
  expect(f.owner.readAcceptedLearningEvent(result.activity.sourceEventId)).toBeNull();
  expect(f.count('world_player_workload_activities')).toBe(1);
  expect(f.count('pitch_practice_attempts')).toBe(1);
  const row = f.db.prepare('SELECT opportunity_json, episode_before_json, learning_evidence_json FROM pitch_practice_attempts WHERE attempt_id=?')
    .get(completed.attemptId) as { opportunity_json: string; episode_before_json: string; learning_evidence_json: string };
  expect(JSON.parse(row.opportunity_json).episode).toBeNull();
  expect(row.episode_before_json).toBe('null');
  expect(row.learning_evidence_json).toBe('null');
  assertOriginals();
  const saved = f.owner.read(completed.attemptId), workloadRows = f.snapshot('world_player_workload_activities');
  f.opportunities.clear(); f.assessments.clear(); f.reopen();
  expect(f.owner.read(completed.attemptId)).toEqual(saved);
  expect(f.owner.begin(f.opportunity.sourceId)).toEqual(saved);
  expect(f.owner.settle(completed.attemptId)).toEqual(result);
  expect(f.sources.workload.readActivity(result.activity.sourceEventId)).toEqual(receipt);
  expect(f.snapshot('world_player_workload_activities')).toBe(workloadRows);
  expect(f.sources.person.read(f.opportunity.personLinkSourceId)).toEqual(begun.frame.person);
  expect(f.sources.timing.readHead('career-a', 'p1')).toEqual(begun.frame.timing);
  expect(f.sources.release.readHead('career-a', 'p1')!.baseline).toEqual(begun.frame.release);
  assertOriginals();
  return { completed, result, receipt };
}
