import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { appendDevelopmentLearningEvent, type DevelopmentLearningEpisode, type DevelopmentLearningEventInput } from '../../core/world/development/DevelopmentLearningEpisode';
import { applyConsolidatedPitchTimingEvidence, type PlayerPitchTimingSource } from '../../core/world/development/PlayerPitchTimingSource';
import type { PitchTimingProfile } from '../../core/sim/pitch/PitchTimingModel';
import { assertArchivedPlayerWorkloadActivity, bindDevelopmentPracticeFromWorkload, type SqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import type { SqlitePlayerPitchTimingStore, AcceptedPitchTimingLearning } from './SqlitePlayerPitchTimingStore';
import type { SqliteDevelopmentInitiationStore } from './SqliteDevelopmentInitiationStore';
import type { SqlitePitchPracticeAttemptStore } from './SqlitePitchPracticeAttemptStore';
import { freezePractice, practiceAttemptId, practiceFields, practiceHash, practiceId, practiceJson as json,
  practiceRevision, practiceWorkload, validatePracticeOpportunity, planPracticeDelivery,
  type PitchPracticeAttempt, type PitchPracticeFrame, type PitchPracticeOpportunity } from './PitchPracticeAttempt';

type EvidenceDb = Pick<DatabaseSync, 'prepare'>;
export type ActualPracticePairPlan = Readonly<{
  sourceId: string; sourceVersion: string;
  original: Readonly<{ attemptId: string; completionHash: string; activityId: string; episodeId: string; episodeRevision: number }>;
  normalOpportunity: PitchPracticeOpportunity; quickOpportunity: PitchPracticeOpportunity;
  protocol: Readonly<{ sourceId: string; sourceVersion: string; conditionRule: 'COMPARABLE_CONDITIONS';
    normalizationSourceId: string; normalizationVersion: string; frameEvidenceVersion?: 'BODY_FRAME_V1' }>;
  reference: Readonly<{ personLinkSourceId: string; timingRevision: number; releaseRevision: number;
    timingProfile: PitchTimingProfile; release: PitchPracticeFrame['release']; fatiguePolicy: PitchPracticeFrame['policy'];
    moundReference: PitchPracticeOpportunity['moundReference']; physics: PitchPracticeOpportunity['physics']; beforeFatigue: number; healthAvailability: number }>;
}>;
export type ActualPracticePairPlanReceipt = Readonly<{ source: ActualPracticePairPlan; hash: string }>;
type ProbeMeasurement = Readonly<{
  completion: NonNullable<PitchPracticeAttempt['completionReference']>; frameHash: string;
  observation: NonNullable<PitchPracticeAttempt['observation']>; workloadActivityId: string;
}>;
/** Values are supplied by an explicit accepted measurement provider, not calculated from raw timing here. */
export type AcceptedActualPracticeMeasurement = Readonly<{
  sourceId: string; sourceVersion: string; planSourceId: string; planHash: string; atDay: number;
  protocolSourceId: string; protocolVersion: string; normalizationSourceId: string; normalizationVersion: string;
  normal: ProbeMeasurement; quick: ProbeMeasurement;
  standardized: Readonly<{ normalMotionToReleaseUs: number; quickMotionToReleaseUs: number }>;
  provenance: Readonly<{ measurementSourceId: string; measurementVersion: string; calibrationSourceId: string; calibrationVersion: string }>;
}>;
export type ActualPracticeMeasurementReceipt = Readonly<{
  source: AcceptedActualPracticeMeasurement; hash: string; practiceSourceEventId: string;
}>;
export type ActualPracticeLearningAuthority = Readonly<{
  readAcceptedPairPlan?(sourceId: string): ActualPracticePairPlan | null;
  readAcceptedStandardizedMeasurement?(sourceId: string): AcceptedActualPracticeMeasurement | null;
  readAcceptedTimingLearning?(sourceId: string): AcceptedPitchTimingLearning | null;
}>;
export type ActualPracticeLearningPreparation = Readonly<{ kind: 'pending'; reason: string }> | Readonly<{
  kind: 'ready'; sourceId: string; expectedTimingRevision: number; pairResultSourceIds: readonly string[]; learning: AcceptedPitchTimingLearning;
}>;
export type ActualPracticeLearningMethods = Readonly<{
  acceptPairPlan(sourceId: string): ActualPracticePairPlanReceipt;
  readPairPlan(sourceId: string): ActualPracticePairPlanReceipt | null;
  acceptMeasurement(sourceId: string): ActualPracticeMeasurementReceipt;
  readMeasurement(sourceId: string): ActualPracticeMeasurementReceipt | null;
  prepareLearning(sourceId: string, pairResultSourceIds: readonly string[], expectedTimingRevision: number): ActualPracticeLearningPreparation;
  settleLearning(sourceId: string): Readonly<{ kind: 'pending'; reason: string }> | Readonly<{ kind: 'complete'; source: PlayerPitchTimingSource }>;
  readAcceptedLearning(sourceId: string): AcceptedPitchTimingLearning | null;
  assertTimingEvidence(db: EvidenceDb, input: AcceptedPitchTimingLearning, phase: string): void;
}>;
type Sources = Readonly<{
  workload: Pick<SqlitePlayerWorkloadRecoveryStore, 'readActivity'>;
  timing: Pick<SqlitePlayerPitchTimingStore, 'readHead' | 'selectAtRevision'> & Partial<Pick<SqlitePlayerPitchTimingStore, 'apply'>>;
  episodes: Pick<SqliteDevelopmentInitiationStore, 'read'>;
}>;
type Tools = Readonly<{
  check(sourceId: string): void;
  transaction<T>(work: () => T): T;
  readAttempt(db: EvidenceDb, id: string, maximumTimingRevision: number): PitchPracticeAttempt | null;
  inspectFrame(opportunity: PitchPracticeOpportunity, fresh: boolean): PitchPracticeFrame;
  frameEvidence(db: EvidenceDb, opportunity: PitchPracticeOpportunity, frame: PitchPracticeFrame, bodyFrameOnly?: boolean): unknown;
  assertPlanOpportunity(db: EvidenceDb, opportunity: PitchPracticeOpportunity, bodyFrameOnly: boolean): void;
  assertLearningEvidence(db: EvidenceDb, event: DevelopmentLearningEventInput, phase: string): void;
}>;
type PlanRow = { source_id: string; original_activity_id: string; source_json: string; reference_frame_json: string; reference_evidence_json: string;
  after_sequence: number; source_hash: string };
type ReservationRow = { attempt_id: string; source_id: string; plan_source_id: string; mode: string; opportunity_json: string };
type MeasurementRow = { source_id: string; plan_source_id: string; practice_source_id: string; source_json: string; source_hash: string };
type LearningRequest = Readonly<{ sourceId: string; pairResultSourceIds: readonly string[]; expectedTimingRevision: number }>;
type RequestRow = { source_id: string; request_json: string; request_hash: string; input_json: string | null; input_hash: string | null };
type EpisodeLearningRow = { source_id: string; episode_id: string; before_revision: number; after_revision: number; event_json: string; state_json: string };
const unit = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const positiveDuration = (value: unknown): value is number => practiceRevision(value) && value > 0;
const same = (a: unknown, b: unknown): boolean => json(a) === json(b);
const pairReference = (o: PitchPracticeOpportunity, frame: PitchPracticeFrame, healthAvailability: number): ActualPracticePairPlan['reference'] => ({
  personLinkSourceId: o.personLinkSourceId, timingRevision: o.timingRevision, releaseRevision: o.releaseRevision,
  timingProfile: frame.timing.profile, release: frame.release, fatiguePolicy: frame.policy,
  moundReference: o.moundReference, physics: o.physics, beforeFatigue: frame.workload.fatigue, healthAvailability,
});
const acceptedPlan = (raw: ActualPracticePairPlan, sourceId: string): ActualPracticePairPlan => {
  const p = cloneInert(raw);
  if (!practiceFields(p, ['sourceId', 'sourceVersion', 'original', 'normalOpportunity', 'quickOpportunity', 'protocol', 'reference'])
    || p.sourceId !== sourceId || !practiceId(p.sourceId) || !practiceId(p.sourceVersion)
    || !practiceFields(p.original, ['attemptId', 'completionHash', 'activityId', 'episodeId', 'episodeRevision'])
    || ![p.original.attemptId, p.original.completionHash, p.original.activityId, p.original.episodeId].every(practiceId)
    || !practiceRevision(p.original.episodeRevision)
    || !practiceFields(p.protocol, ['sourceId', 'sourceVersion', 'conditionRule', 'normalizationSourceId', 'normalizationVersion',
      ...(p.protocol && Object.hasOwn(p.protocol, 'frameEvidenceVersion') ? ['frameEvidenceVersion'] : [])])
    || Object.hasOwn(p.protocol, 'frameEvidenceVersion') && p.protocol.frameEvidenceVersion !== 'BODY_FRAME_V1'
    || ![p.protocol.sourceId, p.protocol.sourceVersion, p.protocol.normalizationSourceId, p.protocol.normalizationVersion].every(practiceId)
    || p.protocol.conditionRule !== 'COMPARABLE_CONDITIONS'
    || !practiceFields(p.reference, ['personLinkSourceId', 'timingRevision', 'releaseRevision', 'timingProfile', 'release', 'fatiguePolicy',
      'moundReference', 'physics', 'beforeFatigue', 'healthAvailability'])
    || !unit(p.reference.beforeFatigue) || !unit(p.reference.healthAvailability)) throw new Error('invalid accepted practice pair plan or protocol');
  const n = validatePracticeOpportunity(p.normalOpportunity, p.normalOpportunity?.sourceId);
  const q = validatePracticeOpportunity(p.quickOpportunity, p.quickOpportunity?.sourceId);
  if (n.timingIntent.deliveryMode !== 'NORMAL' || q.timingIntent.deliveryMode !== 'QUICK' || n.episode !== null || q.episode !== null
    || n.sourceId === q.sourceId || practiceAttemptId(n) === practiceAttemptId(q)
    || practiceAttemptId(n) === p.original.attemptId || practiceAttemptId(q) === p.original.attemptId
    || n.careerId !== q.careerId || n.playerId !== q.playerId || n.personLinkSourceId !== q.personLinkSourceId
    || n.timingRevision !== q.timingRevision || n.releaseRevision !== q.releaseRevision || n.fatiguePolicySourceId !== q.fatiguePolicySourceId
    || !same(n.physics, q.physics) || !same(n.moundReference, q.moundReference)
    || q.workloadRevision <= n.workloadRevision || q.atDay < n.atDay || q.atDay === n.atDay && q.readyAtUs < n.readyAtUs
    || !['STANDARD', 'DELIBERATE'].includes(n.timingIntent.cadenceIntent) || !['STANDARD', 'DELIBERATE'].includes(q.timingIntent.cadenceIntent)) {
    throw new Error('practice pair probe scope, mode, target or prospective revision differs');
  }
  return freezePractice(p);
};

/** Installs reference intake in the existing practice owner's connection and transaction scope. */
export const installActualPracticeLearning = (db: DatabaseSync, sources: Sources,
  authority: ActualPracticeLearningAuthority | undefined, tools: Tools): ActualPracticeLearningMethods & Readonly<{
    assertProbeAdmission(opportunity: PitchPracticeOpportunity): void;
    assertProbeReservation(db: EvidenceDb, opportunity: PitchPracticeOpportunity): void;
    probeReservationEvidence(db: EvidenceDb, opportunity: PitchPracticeOpportunity): unknown | null;
  }> => {
  for (const key of ['readAcceptedPairPlan', 'readAcceptedStandardizedMeasurement', 'readAcceptedTimingLearning'] as const) {
    if (authority?.[key] !== undefined && typeof authority[key] !== 'function') throw new Error('invalid actual learning authority');
  }
  db.exec(`CREATE TABLE IF NOT EXISTS pitch_practice_pair_plans (
    source_id TEXT PRIMARY KEY, original_activity_id TEXT NOT NULL UNIQUE, source_json TEXT NOT NULL,
    reference_frame_json TEXT NOT NULL, reference_evidence_json TEXT NOT NULL, after_sequence INTEGER NOT NULL CHECK(after_sequence>=0), source_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pitch_practice_probe_reservations (
    attempt_id TEXT PRIMARY KEY, source_id TEXT NOT NULL UNIQUE, plan_source_id TEXT NOT NULL, mode TEXT NOT NULL, opportunity_json TEXT NOT NULL,
    UNIQUE(plan_source_id,mode)
  );
  CREATE TABLE IF NOT EXISTS pitch_practice_standardized_measurements (
    source_id TEXT PRIMARY KEY, plan_source_id TEXT NOT NULL UNIQUE, practice_source_id TEXT NOT NULL UNIQUE,
    source_json TEXT NOT NULL, source_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pitch_practice_learning_requests (
    source_id TEXT PRIMARY KEY, request_json TEXT NOT NULL, request_hash TEXT NOT NULL,
    input_json TEXT, input_hash TEXT
  );`);
  const getPlan = (connection: EvidenceDb, sourceId: string): PlanRow | undefined => connection.prepare('SELECT * FROM pitch_practice_pair_plans WHERE source_id=?').get(sourceId) as PlanRow | undefined;
  const getMeasurement = (connection: EvidenceDb, sourceId: string): MeasurementRow | undefined => connection.prepare('SELECT * FROM pitch_practice_standardized_measurements WHERE source_id=?').get(sourceId) as MeasurementRow | undefined;
  const getRequest = (connection: EvidenceDb, sourceId: string): RequestRow | undefined => connection.prepare('SELECT * FROM pitch_practice_learning_requests WHERE source_id=?').get(sourceId) as RequestRow | undefined;
  const probeRows = (connection: EvidenceDb, o: PitchPracticeOpportunity): ReservationRow[] => connection.prepare(
    'SELECT * FROM pitch_practice_probe_reservations WHERE attempt_id=? OR source_id=? ORDER BY attempt_id').all(practiceAttemptId(o), o.sourceId) as ReservationRow[];
  const probeReservationEvidence = (connection: EvidenceDb, o: PitchPracticeOpportunity): unknown | null => {
    const rows = probeRows(connection, o);
    return rows.length ? { rows, plans: rows.map(row => getPlan(connection, row.plan_source_id) ?? null) } : null;
  };
  const original = (connection: EvidenceDb, p: ActualPracticePairPlan, ceiling: number): PitchPracticeAttempt => {
    const a = tools.readAttempt(connection, p.original.attemptId, ceiling);
    const activity = a && practiceWorkload(a);
    if (!a || !activity || !a.opportunity.episode || a.completionReference?.hash !== p.original.completionHash
      || activity.sourceEventId !== p.original.activityId || a.opportunity.episode.episodeId !== p.original.episodeId
      || a.opportunity.careerId !== p.normalOpportunity.careerId || a.opportunity.playerId !== p.normalOpportunity.playerId
      || p.normalOpportunity.atDay < a.opportunity.atDay) throw new Error('practice pair original completion or episode differs');
    const eventRow = connection.prepare('SELECT * FROM world_development_learning_events WHERE source_id=?').get(activity.sourceEventId) as EpisodeLearningRow | undefined;
    if (!eventRow || eventRow.episode_id !== p.original.episodeId || eventRow.after_revision !== p.original.episodeRevision) throw new Error('practice pair original episode prefix is missing');
    const event = JSON.parse(eventRow.event_json) as DevelopmentLearningEventInput;
    tools.assertLearningEvidence(connection, event, 'read');
    return a;
  };
  const decodePlan = (connection: EvidenceDb, row: PlanRow, maximumTimingRevision = Number.MAX_SAFE_INTEGER): ActualPracticePairPlanReceipt => {
    const source = acceptedPlan(JSON.parse(row.source_json) as ActualPracticePairPlan, row.source_id);
    const referenceFrame = JSON.parse(row.reference_frame_json) as PitchPracticeFrame;
    const referenceEvidence = JSON.parse(row.reference_evidence_json) as unknown;
    if (row.original_activity_id !== source.original.activityId || json(source) !== row.source_json || json(referenceFrame) !== row.reference_frame_json
      || json(referenceEvidence) !== row.reference_evidence_json
      || !practiceRevision(row.after_sequence) || row.source_hash !== practiceHash({ source, referenceFrame, referenceEvidence, afterSequence: row.after_sequence })) {
      throw new Error('corrupt frozen practice pair plan');
    }
    const ceiling = Math.min(maximumTimingRevision, source.normalOpportunity.timingRevision);
    if (source.normalOpportunity.timingRevision > maximumTimingRevision) throw new Error('practice pair depends on a later timing revision');
    original(connection, source, ceiling);
    const frame = tools.inspectFrame(source.normalOpportunity, false);
    // Prospective validation only: no phases or observations are retained here.
    planPracticeDelivery(source.normalOpportunity, frame);
    planPracticeDelivery(source.quickOpportunity, frame);
    if (!same(frame, referenceFrame) || !same(tools.frameEvidence(connection, source.normalOpportunity, frame, source.protocol.frameEvidenceVersion === 'BODY_FRAME_V1'), referenceEvidence)
      || !same(source.reference, pairReference(source.normalOpportunity, frame, source.reference.healthAvailability))) {
      throw new Error('practice pair reference frame differs');
    }
    const reservations = connection.prepare('SELECT * FROM pitch_practice_probe_reservations WHERE plan_source_id=? ORDER BY mode').all(source.sourceId) as ReservationRow[];
    if (reservations.length !== 2) throw new Error('practice pair probe reservation is missing');
    for (const [mode, o] of [['NORMAL', source.normalOpportunity], ['QUICK', source.quickOpportunity]] as const) {
      const reservation = reservations.find(r => r.mode === mode);
      const attempt = connection.prepare('SELECT sequence FROM pitch_practice_attempts WHERE attempt_id=?').get(practiceAttemptId(o));
      if (!reservation || reservation.attempt_id !== practiceAttemptId(o) || reservation.source_id !== o.sourceId || reservation.opportunity_json !== json(o)
        || attempt && Number(attempt.sequence) <= row.after_sequence) throw new Error('practice probe identity was reused or not prospectively reserved');
    }
    return freezePractice({ source, hash: row.source_hash });
  };
  const readPairPlan = (sourceId: string): ActualPracticePairPlanReceipt | null => {
    tools.check(sourceId); const row = getPlan(db, sourceId); return row ? decodePlan(db, row) : null;
  };
  const settledProbe = (connection: EvidenceDb, o: PitchPracticeOpportunity, ceiling: number) => {
    const attempt = tools.readAttempt(connection, practiceAttemptId(o), ceiling), activity = attempt && practiceWorkload(attempt);
    if (!attempt || !activity || !attempt.completionReference || !same(attempt.opportunity, o)) throw new Error('paired practice probe completion is missing');
    const receipt = sources.workload.readActivity(activity.sourceEventId);
    if (!receipt || !same(receipt.activity, activity) || !same(receipt.before, attempt.frame.workload)) throw new Error('paired practice probe workload is not settled');
    assertArchivedPlayerWorkloadActivity(connection, receipt);
    return { attempt, activity, receipt };
  };
  const assertQuickPredecessor = (connection: EvidenceDb, p: ActualPracticePairPlan, ceiling: number): void => {
    const normal = settledProbe(connection, p.normalOpportunity, ceiling), quick = p.quickOpportunity;
    if (normal.receipt.after.revision > quick.workloadRevision) throw new Error('paired NORMAL workload follows QUICK revision');
    let previous = normal.receipt.after, recoveryUs = 0;
    const rows = connection.prepare(`SELECT source_id FROM world_player_workload_activities
      WHERE career_id=? AND player_id=? AND after_revision>? AND after_revision<=? ORDER BY after_revision`)
      .all(quick.careerId, quick.playerId, previous.revision, quick.workloadRevision) as { source_id: string }[];
    for (const row of rows) {
      const receipt = sources.workload.readActivity(row.source_id);
      if (!receipt || !same(receipt.before, previous)) throw new Error('practice recovery workload prefix differs');
      assertArchivedPlayerWorkloadActivity(connection, receipt);
      previous = receipt.after;
      if (receipt.activity.kind === 'RECOVERY') {
        // Unit conversion within an explicit local interval, never a day/global clock conversion.
        const durationUs = receipt.activity.durationHours * 3_600_000_000;
        recoveryUs += durationUs;
        if (!Number.isFinite(durationUs) || durationUs < 0 || !Number.isFinite(recoveryUs)
          || recoveryUs > Number.MAX_SAFE_INTEGER) throw new Error('practice recovery duration overflow');
      }
    }
    if (previous.revision !== quick.workloadRevision) throw new Error('practice recovery workload prefix is incomplete');
    if (quick.atDay === normal.attempt.opportunity.atDay) {
      const availableUs = quick.readyAtUs - normal.attempt.plannedDelivery.timeline.followThroughEndUs;
      if (!Number.isSafeInteger(availableUs) || availableUs < 0 || recoveryUs > availableUs) throw new Error('practice recovery exceeds the same-day local interval');
    }
  };
  const probe = (connection: EvidenceDb, o: PitchPracticeOpportunity, quoted: ProbeMeasurement,
    reference: ActualPracticePairPlan['reference'], ceiling: number): PitchPracticeAttempt => {
    if (!practiceFields(quoted, ['completion', 'frameHash', 'observation', 'workloadActivityId'])) throw new Error('invalid standardized measurement probe reference');
    const { attempt: a, activity } = settledProbe(connection, o, ceiling);
    if (!a.observation
      || !same(quoted.completion, a.completionReference) || quoted.frameHash !== practiceHash(a.frame)
      || !same(quoted.observation, a.observation) || quoted.workloadActivityId !== activity.sourceEventId) throw new Error('standardized measurement completion, raw observation or frame differs');
    if (activity.kind !== 'PRACTICE' || !same(reference, pairReference(o, a.frame, activity.healthAvailability))) {
      throw new Error('standardized measurement has incomparable fatigue or reference conditions');
    }
    return a;
  };
  const validateMeasurement = (connection: EvidenceDb, raw: AcceptedActualPracticeMeasurement, sourceId: string,
    maximumTimingRevision = Number.MAX_SAFE_INTEGER): { source: AcceptedActualPracticeMeasurement; plan: ActualPracticePairPlanReceipt } => {
    const m = cloneInert(raw);
    if (!practiceFields(m, ['sourceId', 'sourceVersion', 'planSourceId', 'planHash', 'atDay', 'protocolSourceId', 'protocolVersion',
      'normalizationSourceId', 'normalizationVersion', 'normal', 'quick', 'standardized', 'provenance'])
      || m.sourceId !== sourceId || ![m.sourceId, m.sourceVersion, m.planSourceId, m.planHash, m.protocolSourceId, m.protocolVersion,
        m.normalizationSourceId, m.normalizationVersion].every(practiceId) || !practiceRevision(m.atDay)
      || !practiceFields(m.standardized, ['normalMotionToReleaseUs', 'quickMotionToReleaseUs'])
      || !positiveDuration(m.standardized.normalMotionToReleaseUs) || !positiveDuration(m.standardized.quickMotionToReleaseUs)
      || !practiceFields(m.provenance, ['measurementSourceId', 'measurementVersion', 'calibrationSourceId', 'calibrationVersion'])
      || !Object.values(m.provenance).every(practiceId)) throw new Error('invalid accepted standardized measurement or calibration provenance');
    const row = getPlan(connection, m.planSourceId);
    if (!row) throw new Error('standardized measurement pair plan is missing');
    const plan = decodePlan(connection, row, maximumTimingRevision), p = plan.source;
    if (m.planHash !== plan.hash || m.protocolSourceId !== p.protocol.sourceId || m.protocolVersion !== p.protocol.sourceVersion
      || m.normalizationSourceId !== p.protocol.normalizationSourceId || m.normalizationVersion !== p.protocol.normalizationVersion) {
      throw new Error('standardized measurement protocol or normalization source differs');
    }
    const ceiling = Math.min(maximumTimingRevision, p.normalOpportunity.timingRevision);
    assertQuickPredecessor(connection, p, ceiling);
    const normal = probe(connection, p.normalOpportunity, m.normal, p.reference, ceiling);
    const quick = probe(connection, p.quickOpportunity, m.quick, p.reference, ceiling);
    if (m.atDay < normal.opportunity.atDay || m.atDay < quick.opportunity.atDay) throw new Error('standardized measurement chronology differs');
    return { source: freezePractice(m), plan };
  };
  const decodeMeasurement = (connection: EvidenceDb, row: MeasurementRow, maximumTimingRevision = Number.MAX_SAFE_INTEGER): ActualPracticeMeasurementReceipt => {
    const parsed = JSON.parse(row.source_json) as AcceptedActualPracticeMeasurement;
    if (row.source_hash !== practiceHash(parsed) || json(parsed) !== row.source_json) throw new Error('corrupt standardized measurement source');
    const { source, plan } = validateMeasurement(connection, parsed, row.source_id, maximumTimingRevision);
    if (row.plan_source_id !== plan.source.sourceId || row.practice_source_id !== plan.source.original.activityId) throw new Error('standardized measurement practice binding differs');
    return freezePractice({ source, hash: row.source_hash, practiceSourceEventId: row.practice_source_id });
  };
  const readMeasurement = (sourceId: string): ActualPracticeMeasurementReceipt | null => {
    tools.check(sourceId); const row = getMeasurement(db, sourceId); return row ? decodeMeasurement(db, row) : null;
  };
  const requestValue = (sourceId: string, ids: readonly string[], expectedTimingRevision: number): LearningRequest => {
    if (!practiceId(sourceId) || !Array.isArray(ids) || ids.length === 0 || !ids.every(practiceId)
      || new Set(ids).size !== ids.length || !practiceRevision(expectedTimingRevision)) throw new Error('invalid or duplicate actual learning request coverage');
    return freezePractice({ sourceId, pairResultSourceIds: [...ids], expectedTimingRevision });
  };
  const decodeRequest = (row: RequestRow): LearningRequest => {
    const parsed = JSON.parse(row.request_json) as LearningRequest;
    const request = requestValue(parsed.sourceId, parsed.pairResultSourceIds, parsed.expectedTimingRevision);
    if (row.source_id !== request.sourceId || json(request) !== row.request_json || row.request_hash !== practiceHash(request)
      || (row.input_json === null) !== (row.input_hash === null)) throw new Error('corrupt actual learning request');
    return request;
  };
  const assertExclusiveReports = (connection: EvidenceDb, request: LearningRequest): void => {
    const others = connection.prepare('SELECT * FROM pitch_practice_learning_requests WHERE source_id<>?').all(request.sourceId) as RequestRow[];
    for (const row of others) {
      const other = decodeRequest(row);
      if (other.pairResultSourceIds.some(id => request.pairResultSourceIds.includes(id))) throw new Error('standardized report is already reserved by another learning source');
    }
  };
  // Compare the exact closed episode prefix before calling its ordinary guarded
  // reader. A changed/later head cannot redirect proof traversal into this update.
  const assertEpisodePrefix = (connection: EvidenceDb, expected: DevelopmentLearningEpisode): void => {
    const initial = connection.prepare('SELECT initial_json, current_json, revision FROM world_development_initiations WHERE episode_id=?')
      .get(expected.episodeId) as { initial_json: string; current_json: string; revision: number } | undefined;
    if (!initial || initial.revision !== expected.revision || initial.current_json !== json(expected)) throw new Error('actual learning closed episode boundary differs');
    let current = JSON.parse(initial.initial_json) as DevelopmentLearningEpisode;
    if (json(current) !== initial.initial_json || current.revision > expected.revision) throw new Error('actual learning initial episode differs');
    const rows = connection.prepare('SELECT * FROM world_development_learning_events WHERE episode_id=? AND after_revision<=? ORDER BY after_revision')
      .all(expected.episodeId, expected.revision) as EpisodeLearningRow[];
    for (const row of rows) {
      const event = JSON.parse(row.event_json) as DevelopmentLearningEventInput;
      if (row.before_revision !== current.revision || row.after_revision !== current.revision + 1 || json(event) !== row.event_json) {
        throw new Error('actual learning episode source prefix differs');
      }
      current = appendDevelopmentLearningEvent(current, current.revision, event);
      if (json(current) !== row.state_json) throw new Error('actual learning episode result prefix differs');
    }
    if (!same(current, expected)) throw new Error('actual learning episode evidence differs');
    const accepted = sources.episodes.read(expected.episodeId);
    if (!accepted || !same(accepted.episode, expected)) throw new Error('actual learning episode owner differs');
  };
  const validateLearning = (connection: EvidenceDb, request: LearningRequest, raw: AcceptedPitchTimingLearning): AcceptedPitchTimingLearning => {
    const input = cloneInert(raw);
    if (!practiceFields(input, ['sourceId', 'episode', 'measurements', 'practice']) || input.sourceId !== request.sourceId
      || !input.episode || input.episode.stage !== 'CONSOLIDATED' || input.episode.domain !== 'TECHNICAL'
      || !Array.isArray(input.measurements) || !input.practice || !Array.isArray(input.practice.repetitions)) {
      throw new Error('actual learning requires a complete accepted consolidated input');
    }
    const reports = request.pairResultSourceIds.map(id => {
      const row = getMeasurement(connection, id);
      if (!row) throw new Error('actual learning standardized measurement is missing');
      return decodeMeasurement(connection, row, request.expectedTimingRevision);
    });
    const practiceIds = input.episode.practiceSourceEventIds;
    if (reports.length !== practiceIds.length || input.measurements.length !== practiceIds.length
      || new Set(reports.map(r => r.practiceSourceEventId)).size !== reports.length
      || reports.some(r => !practiceIds.includes(r.practiceSourceEventId))) throw new Error('actual learning pair coverage differs');
    for (const report of reports) {
      const plan = decodePlan(connection, getPlan(connection, report.source.planSourceId)!, request.expectedTimingRevision).source;
      if (plan.original.episodeId !== input.episode.episodeId || plan.normalOpportunity.careerId !== input.episode.careerId
        || plan.normalOpportunity.playerId !== input.episode.playerId || report.source.atDay > input.episode.effectiveDay) {
        throw new Error('actual learning measurement episode scope or chronology differs');
      }
      const measurement = input.measurements.find(item => item.practiceSourceEventId === report.practiceSourceEventId);
      if (!measurement || !same(measurement, { practiceSourceEventId: report.practiceSourceEventId, ...report.source.standardized })) {
        throw new Error('accepted learning measurement differs from the bound standardized report');
      }
    }
    assertEpisodePrefix(connection, input.episode);
    const bound = bindDevelopmentPracticeFromWorkload(sources.workload, input.episode, { policy: input.practice.policy, prior: input.practice.prior,
      repetitions: input.practice.repetitions.map(({ fatigue: _fatigue, healthAvailability: _health, ...factors }) => factors) });
    if (!same(bound, input.practice)) throw new Error('accepted learning exposure differs from historical workload evidence');
    const before = sources.timing.selectAtRevision(input.episode.careerId, input.episode.playerId, request.expectedTimingRevision);
    // Reuse the existing eligibility and measured-source formula without changing
    // its numeric values, exposure coefficients, or NO_SOURCE_CHANGE behavior.
    applyConsolidatedPitchTimingEvidence(before, request.expectedTimingRevision, input.episode, input.measurements, input.practice);
    return freezePractice(input);
  };
  const readyInput = (connection: EvidenceDb, row: RequestRow): AcceptedPitchTimingLearning | null => {
    const request = decodeRequest(row);
    assertExclusiveReports(connection, request);
    if (row.input_json === null) return null;
    const input = JSON.parse(row.input_json) as AcceptedPitchTimingLearning;
    if (json(input) !== row.input_json || row.input_hash !== practiceHash({ request, input })) throw new Error('corrupt frozen actual learning input');
    return validateLearning(connection, request, input);
  };
  const readAcceptedLearning = (sourceId: string): AcceptedPitchTimingLearning | null => {
    tools.check(sourceId); const row = getRequest(db, sourceId); return row ? readyInput(db, row) : null;
  };
  const assertTimingEvidence = (connection: EvidenceDb, input: AcceptedPitchTimingLearning, phase: string): void => {
    const row = getRequest(connection, input.sourceId);
    if (!row) throw new Error('actual practice learning source is missing');
    const request = decodeRequest(row), accepted = readyInput(connection, row);
    if (!accepted || !same(accepted, input)) throw new Error('actual practice learning frozen DTO differs');
    const receipts = connection.prepare(`SELECT * FROM world_pitch_timing_updates WHERE json_extract(source_json,'$.sourceId')=?`)
      .all(input.sourceId) as { source_id: string; career_id: string; player_id: string; before_revision: number; after_revision: number; source_json: string; state_json: string }[];
    if (phase === 'write' ? receipts.length !== 0 : receipts.length !== 1 || receipts[0]?.source_id !== input.sourceId) {
      throw new Error('actual practice timing receipt identity or alias differs');
    }
    if (receipts[0]) {
      const receipt = receipts[0];
      const before = sources.timing.selectAtRevision(input.episode.careerId, input.episode.playerId, request.expectedTimingRevision);
      const after = applyConsolidatedPitchTimingEvidence(before, request.expectedTimingRevision, input.episode, input.measurements, input.practice);
      if (receipt.career_id !== input.episode.careerId || receipt.player_id !== input.episode.playerId
        || receipt.before_revision !== request.expectedTimingRevision || receipt.after_revision !== request.expectedTimingRevision + 1
        || receipt.source_json !== json(input) || receipt.state_json !== json(after)) throw new Error('actual practice timing application differs');
    }
  };
  return Object.freeze({
    acceptPairPlan(sourceId): ActualPracticePairPlanReceipt {
      tools.check(sourceId);
      const raw = authority?.readAcceptedPairPlan?.(sourceId) ?? null;
      return tools.transaction(() => {
        const existing = getPlan(db, sourceId);
        if (existing) {
          const saved = decodePlan(db, existing);
          if (raw && !same(acceptedPlan(raw, sourceId), saved.source)) throw new Error('practice pair plan already frozen differently');
          return saved;
        }
        if (!raw) throw new Error('accepted practice pair plan is missing');
        const source = acceptedPlan(raw, sourceId);
        original(db, source, source.normalOpportunity.timingRevision);
        if (db.prepare('SELECT source_id FROM pitch_practice_pair_plans WHERE original_activity_id=?').get(source.original.activityId)) {
          throw new Error('original practice already has a reserved measurement pair');
        }
        for (const o of [source.normalOpportunity, source.quickOpportunity]) {
          const attemptId = practiceAttemptId(o);
          if (db.prepare('SELECT attempt_id FROM pitch_practice_attempts WHERE attempt_id=? OR source_id=?').get(attemptId, o.sourceId)) throw new Error('practice probe already started before prospective plan');
          if (db.prepare('SELECT attempt_id FROM pitch_practice_probe_reservations WHERE attempt_id=? OR source_id=?').get(attemptId, o.sourceId)) throw new Error('practice probe Source or canonical identity is already reserved');
          tools.assertPlanOpportunity(db, o, source.protocol.frameEvidenceVersion === 'BODY_FRAME_V1');
        }
        const referenceFrame = tools.inspectFrame(source.normalOpportunity, true);
        planPracticeDelivery(source.normalOpportunity, referenceFrame);
        planPracticeDelivery(source.quickOpportunity, referenceFrame);
        if (!same(source.reference, pairReference(source.normalOpportunity, referenceFrame, source.reference.healthAvailability))) throw new Error('practice pair reference conditions differ');
        const afterSequence = Number(db.prepare('SELECT coalesce(max(sequence),0) AS n FROM pitch_practice_attempts').get()!.n);
        const referenceEvidence = tools.frameEvidence(db, source.normalOpportunity, referenceFrame, source.protocol.frameEvidenceVersion === 'BODY_FRAME_V1');
        const hash = practiceHash({ source, referenceFrame, referenceEvidence, afterSequence });
        db.prepare('INSERT INTO pitch_practice_pair_plans VALUES(?,?,?,?,?,?,?)')
          .run(sourceId, source.original.activityId, json(source), json(referenceFrame), json(referenceEvidence), afterSequence, hash);
        for (const [mode, o] of [['NORMAL', source.normalOpportunity], ['QUICK', source.quickOpportunity]] as const) {
          db.prepare('INSERT INTO pitch_practice_probe_reservations VALUES(?,?,?,?,?)').run(practiceAttemptId(o), o.sourceId, sourceId, mode, json(o));
        }
        const saved = decodePlan(db, getPlan(db, sourceId)!);
        for (const o of [source.normalOpportunity, source.quickOpportunity]) tools.assertPlanOpportunity(db, o, source.protocol.frameEvidenceVersion === 'BODY_FRAME_V1');
        return saved;
      });
    },
    readPairPlan,
    probeReservationEvidence,
    assertProbeReservation(connection, opportunity): void {
      const rows = probeRows(connection, opportunity);
      if (!rows.length) return;
      if (rows.length !== 1) throw new Error('practice probe Source and canonical reservations disagree');
      const row = rows[0], planRow = getPlan(connection, row.plan_source_id);
      if (!planRow) throw new Error('practice probe reservation lacks a plan');
      const plan = decodePlan(connection, planRow, opportunity.timingRevision).source;
      const expected = row.mode === 'NORMAL' ? plan.normalOpportunity : row.mode === 'QUICK' ? plan.quickOpportunity : null;
      if (!expected || !same(expected, opportunity)) throw new Error('practice order contradicts a reserved probe opportunity');
      if (plan.protocol.frameEvidenceVersion !== 'BODY_FRAME_V1') throw new Error('practice probe evidence mode did not reserve a future owned order');
    },
    assertProbeAdmission(opportunity): void {
      const rows = db.prepare('SELECT * FROM pitch_practice_probe_reservations WHERE attempt_id=? OR source_id=?')
        .all(practiceAttemptId(opportunity), opportunity.sourceId) as ReservationRow[];
      if (!rows.length) return;
      if (rows.length !== 1) throw new Error('practice probe Source and canonical reservations disagree');
      const row = rows[0];
      const planRow = getPlan(db, row.plan_source_id);
      if (!planRow) throw new Error('practice probe reservation lacks a plan');
      const plan = decodePlan(db, planRow).source;
      const expected = row.mode === 'NORMAL' ? plan.normalOpportunity : row.mode === 'QUICK' ? plan.quickOpportunity : null;
      if (!expected || !same(expected, opportunity)) throw new Error('frozen prospective probe command differs');
      if (row.mode === 'QUICK') assertQuickPredecessor(db, plan, plan.normalOpportunity.timingRevision);
    },
    acceptMeasurement(sourceId): ActualPracticeMeasurementReceipt {
      tools.check(sourceId);
      const raw = authority?.readAcceptedStandardizedMeasurement?.(sourceId) ?? null;
      return tools.transaction(() => {
        const existing = getMeasurement(db, sourceId);
        if (existing) {
          const saved = decodeMeasurement(db, existing);
          if (raw && !same(raw, saved.source)) throw new Error('standardized measurement already frozen differently');
          return saved;
        }
        if (!raw) throw new Error('accepted standardized measurement is missing');
        const { source, plan } = validateMeasurement(db, raw, sourceId);
        if (db.prepare('SELECT source_id FROM pitch_practice_standardized_measurements WHERE plan_source_id=? OR practice_source_id=?')
          .get(plan.source.sourceId, plan.source.original.activityId)) throw new Error('measurement pair is already frozen under another source alias');
        db.prepare('INSERT INTO pitch_practice_standardized_measurements VALUES(?,?,?,?,?)')
          .run(sourceId, source.planSourceId, plan.source.original.activityId, json(source), practiceHash(source));
        return decodeMeasurement(db, getMeasurement(db, sourceId)!);
      });
    },
    readMeasurement,
    prepareLearning(sourceId, pairResultSourceIds, expectedTimingRevision): ActualPracticeLearningPreparation {
      tools.check(sourceId);
      const request = requestValue(sourceId, pairResultSourceIds, expectedTimingRevision);
      const raw = authority?.readAcceptedTimingLearning?.(sourceId) ?? null;
      return tools.transaction(() => {
        const existing = getRequest(db, sourceId);
        if (existing && !same(decodeRequest(existing), request)) throw new Error('frozen learning request revision or inputs differ');
        assertExclusiveReports(db, request);
        const previous = existing && readyInput(db, existing);
        if (previous) {
          if (raw && !same(raw, previous)) throw new Error('actual learning complete DTO is already frozen differently');
          return freezePractice({ kind: 'ready', ...request, learning: previous });
        }
        // A request can wait for a future final accepted source. It never creates
        // a partial numerical DTO, feedback, consolidation or a corrected value.
        let input: AcceptedPitchTimingLearning | null = null;
        let pendingReason = 'accepted_final_learning_missing';
        if (raw) {
          if (!raw.episode || !practiceId(raw.episode.careerId) || !practiceId(raw.episode.playerId)) throw new Error('invalid accepted actual learning scope');
          const head = sources.timing.readHead(raw.episode.careerId, raw.episode.playerId);
          if (!head || head.revision !== request.expectedTimingRevision) throw new Error('stale actual learning timing revision');
          if (!practiceFields(raw, ['sourceId', 'episode', 'measurements', 'practice']) || raw.sourceId !== sourceId) throw new Error('invalid accepted final learning source');
          if (raw.episode.stage !== 'CONSOLIDATED') pendingReason = 'episode_not_consolidated';
          else if (request.pairResultSourceIds.some(id => !getMeasurement(db, id))) pendingReason = 'standardized_measurement_missing';
          else input = validateLearning(db, request, raw);
        }
        if (!existing) db.prepare('INSERT INTO pitch_practice_learning_requests VALUES(?,?,?,?,?)')
          .run(sourceId, json(request), practiceHash(request), null, null);
        assertExclusiveReports(db, request);
        if (!input) return { kind: 'pending', reason: pendingReason };
        const changed = db.prepare('UPDATE pitch_practice_learning_requests SET input_json=?, input_hash=? WHERE source_id=? AND input_json IS NULL')
          .run(json(input), practiceHash({ request, input }), sourceId);
        if (changed.changes !== 1) throw new Error('actual learning intake CAS failed');
        const saved = readyInput(db, getRequest(db, sourceId)!);
        if (!saved || !same(saved, input)) throw new Error('actual learning intake changed before commit');
        return freezePractice({ kind: 'ready', ...request, learning: saved });
      });
    },
    readAcceptedLearning, assertTimingEvidence,
    settleLearning(sourceId) {
      tools.check(sourceId); const row = getRequest(db, sourceId);
      if (!row) return { kind: 'pending' as const, reason: 'learning_request_missing' };
      const request = decodeRequest(row), input = readyInput(db, row);
      if (!input) return { kind: 'pending' as const, reason: 'accepted_final_learning_missing' };
      if (!sources.timing.apply) throw new Error('actual learning requires the existing timing writer');
      const source = sources.timing.apply(sourceId, request.expectedTimingRevision);
      assertTimingEvidence(db, input, 'retry');
      return freezePractice({ kind: 'complete' as const, source });
    },
  });
};

/** Facade only: all intake stays with the existing practice owner, capability with timing. */
export const createActualPitchTimingLearningAdapter = (sources: Readonly<{ practice: SqlitePitchPracticeAttemptStore }> & Partial<Sources>): ActualPracticeLearningMethods => {
  if (!sources?.practice || typeof sources.practice.acceptPairPlan !== 'function') throw new Error('actual practice learning owner is missing');
  const owner = sources.practice;
  return Object.freeze({ acceptPairPlan: owner.acceptPairPlan, readPairPlan: owner.readPairPlan,
    acceptMeasurement: owner.acceptMeasurement, readMeasurement: owner.readMeasurement,
    prepareLearning: owner.prepareLearning, settleLearning: owner.settleLearning,
    readAcceptedLearning: owner.readAcceptedLearning, assertTimingEvidence: owner.assertTimingEvidence });
};
