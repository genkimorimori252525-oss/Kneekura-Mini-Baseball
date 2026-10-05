import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { appendDevelopmentLearningEvent, type DevelopmentLearningEpisode, type DevelopmentLearningEventInput } from '../../core/world/development/DevelopmentLearningEpisode';
import { advancePlayerWorkloadRecovery, type PlayerWorkloadActivity } from '../../core/world/development/PlayerWorkloadRecovery';
import type { SqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import type { SqlitePersonGenesisStore } from './SqlitePersonGenesisStore';
import type { SqlitePlayerPitchTimingStore } from './SqlitePlayerPitchTimingStore';
import type { SqlitePlayerReleaseGeometryStore } from './SqlitePlayerReleaseGeometryStore';
import { assertArchivedPlayerWorkloadActivity, type SqlitePlayerWorkloadRecoveryStore, type DurablePlayerWorkloadActivity } from './SqlitePlayerWorkloadRecoveryStore';
import type { SqlitePitchFatiguePolicyStore } from './SqlitePitchFatiguePolicyStore';
import type { SqliteDevelopmentInitiationStore } from './SqliteDevelopmentInitiationStore';
import { freezePractice, planPracticeDelivery, practiceActivityId, practiceAttemptId, practiceFields, practiceHash,
  practiceId, practiceJson as json, practicePhases, practiceRevision, practiceTimingAtRevision, practiceWorkload,
  validatePracticeAssessment, validatePracticeOpportunity, type PitchPracticeAssessment, type PitchPracticeAttempt,
  type PitchPracticeFrame, type PitchPracticeOpportunity, type PitchPracticePriorClock, type PitchPracticeSettlement } from './PitchPracticeAttempt';

export type PitchPracticeSources = Readonly<{
  personLinks: Pick<SqlitePlayerPersonLinkStore, 'readLink'>;
  person: Pick<SqlitePersonGenesisStore, 'read'>;
  timing: Pick<SqlitePlayerPitchTimingStore, 'readHead'>;
  release: Pick<SqlitePlayerReleaseGeometryStore, 'readHead'>;
  workload: Pick<SqlitePlayerWorkloadRecoveryStore, 'readHead' | 'selectAtRevision' | 'readActivity' | 'apply'>;
  policies: Pick<SqlitePitchFatiguePolicyStore, 'readAcceptedPolicy'>;
  episodes: Pick<SqliteDevelopmentInitiationStore, 'read' | 'advance'>;
}>;
export type PitchPracticeAuthority = Readonly<{
  readAcceptedOpportunity(sourceId: string): PitchPracticeOpportunity | null;
  readAcceptedAssessment(sourceId: string): PitchPracticeAssessment | null;
}>;
type EvidenceDb = Pick<DatabaseSync, 'prepare'>;
export type SqlitePitchPracticeAttemptStore = Readonly<{
  begin(sourceId: string): PitchPracticeAttempt;
  advance(attemptId: string, expectedRevision: number, throughUs: number): PitchPracticeAttempt;
  acceptAssessment(sourceId: string): PitchPracticeAttempt;
  read(attemptId: string): PitchPracticeAttempt | null;
  readAcceptedActivity(sourceId: string): PlayerWorkloadActivity | null;
  readAcceptedLearningEvent(sourceId: string): DevelopmentLearningEventInput | null;
  assertWorkloadEvidence(db: EvidenceDb, activity: PlayerWorkloadActivity, phase: string): void;
  assertLearningEvidence(db: EvidenceDb, event: DevelopmentLearningEventInput, phase: string): void;
  settle(attemptId: string): PitchPracticeSettlement;
  close(): void;
}>;
type Row = {
  sequence: number; attempt_id: string; source_id: string; activity_id: string; career_id: string; player_id: string;
  opportunity_id: string; ordinal: number; opportunity_json: string; frame_json: string; prior_clock_json: string;
  delivery_json: string; episode_before_json: string; source_evidence_json: string; learning_evidence_json: string; immutable_hash: string; progress_json: string;
  revision: number; through_us: number; assessment_source_id: string | null; assessment_json: string | null; assessment_hash: string | null;
};
type Progress = Readonly<{ beforeRevision: number; throughUs: number }>;
type EpisodeRow = { initial_json: string };
type LearningRow = { source_id: string; episode_id: string; before_revision: number; after_revision: number; event_json: string; state_json: string };

// Snapshots contain accepted immutable originals, never today's mutable heads.
// Existing store reads first authenticate these inputs; comparing their original
// bytes on a writer's connection also detects uncommitted source mutations.
const physicalEvidence = (connection: EvidenceDb, o: PitchPracticeOpportunity, frame: PitchPracticeFrame): unknown => {
  const scope = [o.careerId, o.playerId];
  const policy = frame.workload.policy;
  return {
    link: connection.prepare('SELECT * FROM world_player_person_links WHERE source_id=?').get(o.personLinkSourceId) ?? null,
    person: connection.prepare('SELECT * FROM world_person_priors WHERE source_id=?').get(o.personLinkSourceId) ?? null,
    genesis: connection.prepare('SELECT * FROM world_person_genesis_careers WHERE career_id=?').get(o.careerId) ?? null,
    timing: connection.prepare('SELECT * FROM world_pitch_timing_baselines WHERE career_id=? AND player_id=?').get(...scope) ?? null,
    timingUpdates: connection.prepare('SELECT * FROM world_pitch_timing_updates WHERE career_id=? AND player_id=? AND after_revision<=? ORDER BY after_revision')
      .all(...scope, o.timingRevision),
    release: connection.prepare('SELECT * FROM world_player_release_baselines WHERE career_id=? AND player_id=?').get(...scope) ?? null,
    releaseChanges: connection.prepare('SELECT * FROM world_player_release_changes WHERE career_id=? AND player_id=? AND revision<=? ORDER BY revision')
      .all(...scope, o.releaseRevision),
    workload: connection.prepare('SELECT * FROM world_player_workload_baselines WHERE career_id=? AND player_id=?').get(...scope) ?? null,
    workloadPolicy: connection.prepare('SELECT * FROM world_player_workload_policies WHERE career_id=? AND policy_id=? AND version=?')
      .get(o.careerId, policy.policyId, policy.version) ?? null,
    workloadActivities: connection.prepare('SELECT * FROM world_player_workload_activities WHERE career_id=? AND player_id=? AND after_revision<=? ORDER BY after_revision')
      .all(...scope, o.workloadRevision),
    fatiguePolicy: connection.prepare('SELECT * FROM world_pitch_fatigue_policies WHERE source_id=?').get(o.fatiguePolicySourceId) ?? null,
  };
};
const learningEvidence = (connection: EvidenceDb, episodeId: string): unknown => {
  const initiation = connection.prepare(`SELECT episode_id, career_id, player_id, at_day, appraisal_source_id,
    request_json, prior_json, assessment_json, initial_json FROM world_development_initiations WHERE episode_id=?`)
    .get(episodeId) as { request_json: string; career_id: string } | undefined;
  if (!initiation) throw new Error('practice learning initiation source is missing');
  const request = JSON.parse(initiation.request_json) as { executionId: string; personSourceId: string };
  const execution = connection.prepare('SELECT * FROM world_roster_executions WHERE execution_id=?').get(request.executionId) as {
    career_id: string; club_id: string; decision_id: string; result_json: string;
  } | undefined;
  if (!execution) throw new Error('practice learning roster source is missing');
  const result = JSON.parse(execution.result_json) as { result: { execution: { worldRevision: number } } };
  return {
    initiation, execution,
    opportunity: connection.prepare('SELECT * FROM world_roster_opportunities WHERE career_id=? AND club_id=? AND decision_id=?')
      .get(execution.career_id, execution.club_id, execution.decision_id) ?? null,
    worldEvent: connection.prepare('SELECT * FROM world_decision_revision_events WHERE career_id=? AND world_revision=?')
      .get(execution.career_id, result.result.execution.worldRevision) ?? null,
    link: connection.prepare('SELECT * FROM world_player_person_links WHERE source_id=?').get(request.personSourceId) ?? null,
    person: connection.prepare('SELECT * FROM world_person_priors WHERE source_id=?').get(request.personSourceId) ?? null,
    genesis: connection.prepare('SELECT * FROM world_person_genesis_careers WHERE career_id=?').get(initiation.career_id) ?? null,
  };
};

type Verification = {
  physical: Map<string, PitchPracticeAttempt>;
  learning: Map<string, string>;
};
const verification = (): Verification => ({ physical: new Map(), learning: new Map() });

/** Owns consumed standalone delivery phases, not Match time or standardized learning. */
export const openSqlitePitchPracticeAttemptStore = (databasePath: string, sources: PitchPracticeSources,
  authority?: PitchPracticeAuthority): SqlitePitchPracticeAttemptStore => {
  if (!practiceId(databasePath) || !sources?.personLinks || !sources.person || !sources.timing || !sources.release
    || !sources.workload || !sources.policies || !sources.episodes || authority !== undefined
      && (typeof authority.readAcceptedOpportunity !== 'function' || typeof authority.readAcceptedAssessment !== 'function')) {
    throw new Error('invalid practice sources or authority');
  }
  const { DatabaseSync: Database } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new Database(databasePath);
  try {
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
    db.exec(`CREATE TABLE IF NOT EXISTS pitch_practice_attempts (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT, attempt_id TEXT NOT NULL UNIQUE, source_id TEXT NOT NULL UNIQUE,
      activity_id TEXT NOT NULL UNIQUE, career_id TEXT NOT NULL, player_id TEXT NOT NULL,
      opportunity_id TEXT NOT NULL, ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
      opportunity_json TEXT NOT NULL, frame_json TEXT NOT NULL, prior_clock_json TEXT NOT NULL,
      delivery_json TEXT NOT NULL, episode_before_json TEXT NOT NULL, source_evidence_json TEXT NOT NULL,
      learning_evidence_json TEXT NOT NULL, immutable_hash TEXT NOT NULL,
      progress_json TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision >= 0), through_us INTEGER NOT NULL CHECK(through_us >= 0),
      assessment_source_id TEXT UNIQUE, assessment_json TEXT, assessment_hash TEXT,
      UNIQUE(career_id, opportunity_id, ordinal)
    );`);
    let closed = false;
    const check = (value: string): void => { if (closed || !practiceId(value)) throw new Error('invalid or closed practice scope'); };
    const rowById = (connection: EvidenceDb, attemptId: string): Row | undefined =>
      connection.prepare('SELECT * FROM pitch_practice_attempts WHERE attempt_id=?').get(attemptId) as Row | undefined;
    const rowByActivity = (connection: EvidenceDb, activityId: string): Row | undefined =>
      connection.prepare('SELECT * FROM pitch_practice_attempts WHERE activity_id=?').get(activityId) as Row | undefined;
    const transaction = <T>(work: () => T): T => {
      db.exec('BEGIN IMMEDIATE');
      try { const result = work(); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    };
    const captureFrame = (o: PitchPracticeOpportunity, fresh: boolean): PitchPracticeFrame => {
      const personLink = sources.personLinks.readLink(o.personLinkSourceId), person = sources.person.read(o.personLinkSourceId);
      if (!personLink || !person || personLink.careerId !== o.careerId || personLink.playerId !== o.playerId
        || personLink.acceptedAtDay > o.atDay || person.careerId !== o.careerId || person.playerId !== o.playerId
        || person.personId !== personLink.personId || person.sourceId !== o.personLinkSourceId) throw new Error('practice Player Person scope differs');
      const timingHead = sources.timing.readHead(o.careerId, o.playerId), releaseHead = sources.release.readHead(o.careerId, o.playerId);
      const workloadHead = sources.workload.readHead(o.careerId, o.playerId), policy = sources.policies.readAcceptedPolicy(o.fatiguePolicySourceId);
      if (!timingHead || !releaseHead || !workloadHead || !policy) throw new Error('practice source baseline or policy missing');
      if (fresh && (timingHead.revision !== o.timingRevision || releaseHead.revision !== o.releaseRevision || workloadHead.revision !== o.workloadRevision)) {
        throw new Error('stale practice source revision');
      }
      const timing = practiceTimingAtRevision(timingHead, o.timingRevision);
      const release = o.releaseRevision === 0 ? releaseHead.baseline : releaseHead.changes[o.releaseRevision - 1];
      const workload = sources.workload.selectAtRevision(o.careerId, o.playerId, o.workloadRevision);
      if (!release || timing.effectiveDay > o.atDay || release.effectiveDay > o.atDay || workload.effectiveDay > o.atDay || policy.availableAtDay > o.atDay) {
        throw new Error('practice source revision is missing or future');
      }
      return { personLink, person, timing, release, workload, policy };
    };
    const immutable = (row: Row): unknown => ({ attemptId: row.attempt_id, activityId: row.activity_id,
      opportunity: JSON.parse(row.opportunity_json), frame: JSON.parse(row.frame_json), priorClock: JSON.parse(row.prior_clock_json),
      delivery: JSON.parse(row.delivery_json), episodeBefore: JSON.parse(row.episode_before_json),
      sourceEvidence: JSON.parse(row.source_evidence_json), learningEvidence: JSON.parse(row.learning_evidence_json) });
    const workloadReceipt = (attempt: PitchPracticeAttempt, connection?: EvidenceDb): DurablePlayerWorkloadActivity | null => {
      const activity = practiceWorkload(attempt), receipt = sources.workload.readActivity(practiceActivityId(attempt.attemptId));
      if (!receipt) return null;
      if (!activity || json(receipt.activity) !== json(activity) || json(receipt.before) !== json(attempt.frame.workload)
        || json(receipt.after) !== json(advancePlayerWorkloadRecovery(attempt.frame.workload, attempt.opportunity.workloadRevision, activity))) {
        throw new Error('practice workload receipt differs from execution');
      }
      if (connection) assertArchivedPlayerWorkloadActivity(connection, receipt);
      return receipt;
    };
    const clockFor = (attempt: PitchPracticeAttempt, connection: EvidenceDb): PitchPracticePriorClock => {
      const receipt = workloadReceipt(attempt, connection);
      if (!attempt.completionReference || !receipt) throw new Error('prior practice ownership remains unfinished or workload unsettled');
      return { attemptId: attempt.attemptId, atDay: attempt.opportunity.atDay,
        followThroughEndUs: attempt.plannedDelivery.timeline.followThroughEndUs, completionHash: attempt.completionReference.hash,
        workloadActivityId: receipt.activity.sourceEventId, workloadRevision: receipt.after.revision };
    };
    // This path never reads learning history. Dependencies decrease by sequence.
    const decode = (row: Row, connection: EvidenceDb, selectedRevision = row.revision,
      verified: Verification = verification()): PitchPracticeAttempt => {
      const cacheKey = `${row.attempt_id}:${selectedRevision}`;
      const cached = verified.physical.get(cacheKey);
      if (cached) return cached;
      const remember = (attempt: PitchPracticeAttempt): PitchPracticeAttempt => {
        const frozen = freezePractice(attempt); verified.physical.set(cacheKey, frozen); return frozen;
      };
      const o = validatePracticeOpportunity(JSON.parse(row.opportunity_json) as PitchPracticeOpportunity, row.source_id);
      const frame = captureFrame(o, false), plannedDelivery = planPracticeDelivery(o, frame);
      const priorClock = JSON.parse(row.prior_clock_json) as PitchPracticePriorClock | null;
      const episodeBefore = JSON.parse(row.episode_before_json) as DevelopmentLearningEpisode | null;
      if (row.attempt_id !== practiceAttemptId(o) || row.activity_id !== practiceActivityId(row.attempt_id)
        || row.career_id !== o.careerId || row.player_id !== o.playerId || row.opportunity_id !== o.opportunityId || row.ordinal !== o.ordinal
        || !practiceRevision(row.sequence) || row.sequence === 0 || !practiceRevision(row.revision) || !practiceRevision(row.through_us)
        || json(o) !== row.opportunity_json || json(frame) !== row.frame_json || json(plannedDelivery) !== row.delivery_json
        || json(priorClock) !== row.prior_clock_json || json(episodeBefore) !== row.episode_before_json
        || json(physicalEvidence(connection, o, frame)) !== row.source_evidence_json
        || json(JSON.parse(row.learning_evidence_json)) !== row.learning_evidence_json
        || practiceHash(immutable(row)) !== row.immutable_hash) throw new Error('corrupt practice frozen frame or source');
      const earlier = connection.prepare(`SELECT * FROM pitch_practice_attempts WHERE career_id=? AND player_id=? AND sequence<? ORDER BY sequence DESC LIMIT 1`)
        .get(o.careerId, o.playerId, row.sequence) as Row | undefined;
      const expectedClock = earlier ? clockFor(decode(earlier, connection, earlier.revision, verified), connection) : null;
      if (json(expectedClock) !== json(priorClock)) throw new Error('practice prior clock evidence differs');
      if (priorClock && (o.atDay < priorClock.atDay || o.atDay === priorClock.atDay && o.readyAtUs < priorClock.followThroughEndUs
        || o.workloadRevision < priorClock.workloadRevision)) throw new Error('practice clock chronology or workload differs');
      const previous = connection.prepare(`SELECT * FROM pitch_practice_attempts WHERE career_id=? AND opportunity_id=? AND sequence<? ORDER BY ordinal DESC LIMIT 1`)
        .get(o.careerId, o.opportunityId, row.sequence) as Row | undefined;
      if (o.ordinal !== (previous ? previous.ordinal + 1 : 0) || o.previousAttemptId !== (previous?.attempt_id ?? null)
        || previous && previous.player_id !== o.playerId) throw new Error('practice ordinal or previous attempt differs');
      if (o.episode === null ? episodeBefore !== null : !episodeBefore || episodeBefore.episodeId !== o.episode.episodeId
        || episodeBefore.revision !== o.episode.revision || episodeBefore.careerId !== o.careerId || episodeBefore.playerId !== o.playerId
        || episodeBefore.effectiveDay > o.atDay) throw new Error('practice episode boundary scope differs');
      const progress = JSON.parse(row.progress_json) as Progress[];
      if (!Array.isArray(progress) || json(progress) !== row.progress_json || progress.length !== row.revision
        || !practiceRevision(selectedRevision) || selectedRevision > row.revision) throw new Error('corrupt practice progress history');
      let throughUs = o.readyAtUs;
      for (const [index, step] of progress.entries()) {
        if (!practiceFields(step, ['beforeRevision', 'throughUs']) || step.beforeRevision !== index || !practiceRevision(step.throughUs)
          || step.throughUs <= throughUs || step.throughUs > plannedDelivery.timeline.followThroughEndUs) throw new Error('corrupt practice consumed prefix');
        throughUs = step.throughUs;
      }
      if (throughUs !== row.through_us) throw new Error('practice progress head differs');
      throughUs = selectedRevision ? progress[selectedRevision - 1].throughUs : o.readyAtUs;
      const events = selectedRevision ? practicePhases(plannedDelivery).filter(event => event.atUs <= throughUs) : [];
      const released = events.some(event => event.kind === 'released'), completed = events.length === 5;
      const timeline = plannedDelivery.timeline;
      const observation: PitchPracticeAttempt['observation'] = released ? { kind: 'RAW_TIMING', deliveryMode: timeline.deliveryMode,
        motionStartUs: timeline.motionStartUs, releaseUs: timeline.releaseUs, motionToReleaseUs: timeline.releaseUs - timeline.motionStartUs } : null;
      const completionReference = completed ? { attemptId: row.attempt_id, revision: selectedRevision,
        hash: practiceHash({ immutableHash: row.immutable_hash, revision: selectedRevision, throughUs, events }) } : null;
      const attempt: PitchPracticeAttempt = { attemptId: row.attempt_id, opportunity: o, revision: selectedRevision, throughUs, priorClock,
        status: completed ? 'DELIVERY_COMPLETE' : 'IN_PROGRESS', frame, plannedDelivery, events, observation, completionReference, assessment: null };
      if (row.assessment_json === null) {
        if (row.assessment_source_id !== null || row.assessment_hash !== null) throw new Error('corrupt practice assessment identity');
        return remember(attempt);
      }
      if (!row.assessment_source_id || row.assessment_hash !== practiceHash({ immutableHash: row.immutable_hash, assessment: JSON.parse(row.assessment_json) })) {
        throw new Error('corrupt practice assessment source');
      }
      // An old progress retry remains the original physical prefix.
      if (!completed) return remember(attempt);
      const assessment = validatePracticeAssessment(JSON.parse(row.assessment_json) as PitchPracticeAssessment, row.assessment_source_id, attempt);
      if (json(assessment) !== row.assessment_json) throw new Error('corrupt practice assessment archive');
      return remember({ ...attempt, assessment });
    };
    const read = (attemptId: string): PitchPracticeAttempt | null => { check(attemptId); const row = rowById(db, attemptId); return row ? decode(row, db) : null; };
    const required = (attemptId: string): PitchPracticeAttempt => { const attempt = read(attemptId); if (!attempt) throw new Error('practice attempt is missing'); return attempt; };
    const learningEvent = (attempt: PitchPracticeAttempt): DevelopmentLearningEventInput | null => {
      if (!practiceWorkload(attempt) || !attempt.opportunity.episode || !workloadReceipt(attempt)) return null;
      const sourceEventId = practiceActivityId(attempt.attemptId);
      return { eventId: sourceEventId, sourceEventId, atDay: attempt.opportunity.atDay, kind: 'PRACTICE_RECORDED', domain: attempt.opportunity.episode.domain };
    };
    const eligible = (episode: DevelopmentLearningEpisode, event: DevelopmentLearningEventInput): boolean =>
      (episode.stage === 'HYPOTHESIS' || episode.stage === 'PRACTICING') && episode.domain === event.domain && episode.effectiveDay <= event.atDay;
    // Authenticate the full frozen earlier boundary on the consumer connection;
    // never recursively request the episode's current head from its read guard.
    const assertEpisodeBoundary = (connection: EvidenceDb, row: Row,
      verified: Verification = verification()): DevelopmentLearningEpisode => {
      const expected = JSON.parse(row.episode_before_json) as DevelopmentLearningEpisode | null;
      if (!expected) throw new Error('practice learning target is missing');
      if (json(learningEvidence(connection, expected.episodeId)) !== row.learning_evidence_json) throw new Error('practice original learning source evidence differs');
      const initial = connection.prepare('SELECT initial_json FROM world_development_initiations WHERE episode_id=?').get(expected.episodeId) as EpisodeRow | undefined;
      if (!initial) throw new Error('practice episode source is missing');
      let current = JSON.parse(initial.initial_json) as DevelopmentLearningEpisode;
      if (json(current) !== initial.initial_json || current.revision > expected.revision) throw new Error('practice initial episode boundary differs');
      const prefix = connection.prepare(`SELECT * FROM world_development_learning_events WHERE episode_id=? AND after_revision<=? ORDER BY after_revision`)
        .all(expected.episodeId, expected.revision) as LearningRow[];
      for (const update of prefix) {
        const event = JSON.parse(update.event_json) as DevelopmentLearningEventInput;
        if (update.before_revision !== current.revision || update.after_revision !== current.revision + 1 || update.episode_id !== expected.episodeId
          || json(event) !== update.event_json) throw new Error('practice episode prefix differs');
        if (event.kind === 'PRACTICE_RECORDED') {
          const dependency = rowByActivity(connection, event.sourceEventId);
          if (dependency) {
            if (dependency.sequence >= row.sequence) throw new Error('practice learning dependency must be earlier');
            authenticateLearning(connection, event, 'read', verified);
          }
        }
        current = appendDevelopmentLearningEvent(current, current.revision, event);
        if (json(current) !== update.state_json) throw new Error('practice episode prefix result differs');
      }
      if (json(current) !== json(expected)) throw new Error('practice frozen episode boundary differs');
      return current;
    };
    const assertWorkloadEvidence = (connection: EvidenceDb, activity: PlayerWorkloadActivity, phase: string): void => {
      const row = rowByActivity(connection, activity.sourceEventId);
      if (!row) throw new Error('practice workload source is missing');
      const attempt = decode(row, connection);
      if (json(practiceWorkload(attempt)) !== json(activity)) throw new Error('practice workload source evidence differs');
      if (phase !== 'write') assertArchivedPlayerWorkloadActivity(connection, { activity, before: attempt.frame.workload,
        after: advancePlayerWorkloadRecovery(attempt.frame.workload, attempt.opportunity.workloadRevision, activity) });
    };
    const authenticateLearning = (connection: EvidenceDb, event: DevelopmentLearningEventInput, phase: string, verified: Verification): void => {
      const cached = verified.learning.get(event.sourceEventId);
      if (cached !== undefined) {
        if (cached !== json(event)) throw new Error('practice learning source identity differs');
        return;
      }
      const row = rowByActivity(connection, event.sourceEventId);
      if (!row) throw new Error('practice learning source is missing');
      const attempt = decode(row, connection, row.revision, verified), expected = learningEvent(attempt);
      if (!expected || json(expected) !== json(event) || !workloadReceipt(attempt, connection)) throw new Error('practice learning workload evidence differs');
      const before = assertEpisodeBoundary(connection, row, verified);
      if (!eligible(before, event)) throw new Error('practice learning stage or domain differs');
      // When already inserted, bind destination and exact revision as well as DTO.
      const receipts = connection.prepare(`SELECT * FROM world_development_learning_events
        WHERE json_extract(event_json, '$.sourceEventId')=?`).all(event.sourceEventId) as LearningRow[];
      if (phase === 'write' ? receipts.length !== 0 : receipts.length !== 1 || receipts[0]?.source_id !== event.sourceEventId) {
        throw new Error('practice learning durable source identity or alias differs');
      }
      const saved = receipts[0];
      if (saved && (saved.episode_id !== before.episodeId || saved.before_revision !== before.revision || saved.after_revision !== before.revision + 1
        || saved.event_json !== json(event) || saved.state_json !== json(appendDevelopmentLearningEvent(before, before.revision, event)))) {
        throw new Error('practice learning durable application differs');
      }
      verified.learning.set(event.sourceEventId, json(event));
    };
    const assertLearningEvidence = (connection: EvidenceDb, event: DevelopmentLearningEventInput, phase: string): void => {
      authenticateLearning(connection, event, phase, verification());
    };
    return Object.freeze({
      begin(sourceId): PitchPracticeAttempt {
        check(sourceId);
        const raw = authority?.readAcceptedOpportunity(sourceId) ?? null;
        const o = raw === null ? null : validatePracticeOpportunity(raw, sourceId);
        return transaction(() => {
          const prior = db.prepare('SELECT * FROM pitch_practice_attempts WHERE source_id=?').get(sourceId) as Row | undefined;
          if (prior) {
            if (o && json(o) !== prior.opportunity_json) throw new Error('practice opportunity already frozen differently');
            return decode(prior, db);
          }
          if (!o) throw new Error('accepted practice opportunity is missing');
          const attemptId = practiceAttemptId(o);
          if (rowById(db, attemptId)) throw new Error('practice identity already belongs to another source alias');
          const previous = db.prepare('SELECT * FROM pitch_practice_attempts WHERE career_id=? AND opportunity_id=? ORDER BY ordinal DESC LIMIT 1')
            .get(o.careerId, o.opportunityId) as Row | undefined;
          if (o.ordinal !== (previous ? previous.ordinal + 1 : 0) || o.previousAttemptId !== (previous?.attempt_id ?? null)
            || previous && previous.player_id !== o.playerId) throw new Error('practice ordinal or previous attempt differs');
          const earlier = db.prepare('SELECT * FROM pitch_practice_attempts WHERE career_id=? AND player_id=? ORDER BY sequence DESC LIMIT 1')
            .get(o.careerId, o.playerId) as Row | undefined;
          const priorClock = earlier ? clockFor(decode(earlier, db), db) : null;
          if (priorClock && (o.atDay < priorClock.atDay || o.atDay === priorClock.atDay && o.readyAtUs < priorClock.followThroughEndUs)) {
            throw new Error('practice Player clock overlaps its prior attempt');
          }
          const frame = captureFrame(o, true), delivery = planPracticeDelivery(o, frame);
          const episodeBefore = o.episode ? sources.episodes.read(o.episode.episodeId)?.episode ?? null : null;
          if (o.episode && (!episodeBefore || episodeBefore.revision !== o.episode.revision || episodeBefore.careerId !== o.careerId
            || episodeBefore.playerId !== o.playerId || episodeBefore.effectiveDay > o.atDay)) throw new Error('practice episode scope or revision differs');
          const activityId = practiceActivityId(attemptId);
          const sourceEvidence = physicalEvidence(db, o, frame);
          const acceptedLearningEvidence = episodeBefore ? learningEvidence(db, episodeBefore.episodeId) : null;
          const immutableHash = practiceHash({ attemptId, activityId, opportunity: o, frame, priorClock, delivery, episodeBefore,
            sourceEvidence, learningEvidence: acceptedLearningEvidence });
          db.prepare(`INSERT INTO pitch_practice_attempts (attempt_id, source_id, activity_id, career_id, player_id, opportunity_id, ordinal,
            opportunity_json, frame_json, prior_clock_json, delivery_json, episode_before_json, source_evidence_json, learning_evidence_json, immutable_hash, progress_json, revision, through_us)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(attemptId, sourceId, activityId, o.careerId, o.playerId, o.opportunityId,
              o.ordinal, json(o), json(frame), json(priorClock), json(delivery), json(episodeBefore), json(sourceEvidence), json(acceptedLearningEvidence), immutableHash, '[]', 0, o.readyAtUs);
          return required(attemptId);
        });
      },
      advance(attemptId, expectedRevision, throughUs): PitchPracticeAttempt {
        check(attemptId);
        if (!practiceRevision(expectedRevision) || !practiceRevision(throughUs)) throw new Error('invalid practice progress revision or time');
        return transaction(() => {
          const current = required(attemptId), row = rowById(db, attemptId)!;
          const progress = JSON.parse(row.progress_json) as Progress[];
          const prior = progress.findIndex(step => step.beforeRevision === expectedRevision && step.throughUs === throughUs);
          if (prior >= 0) return decode(row, db, prior + 1);
          if (expectedRevision !== current.revision) throw new Error('stale practice progress revision');
          if (throughUs === current.throughUs) return current;
          if (throughUs < current.throughUs || throughUs > current.plannedDelivery.timeline.followThroughEndUs
            || current.status === 'DELIVERY_COMPLETE' || current.revision === Number.MAX_SAFE_INTEGER) throw new Error('invalid practice consumed time');
          const changed = db.prepare(`UPDATE pitch_practice_attempts SET progress_json=?, revision=?, through_us=? WHERE attempt_id=? AND revision=? AND progress_json=?`)
            .run(json([...progress, { beforeRevision: current.revision, throughUs }]), current.revision + 1, throughUs, attemptId, current.revision, row.progress_json);
          if (changed.changes !== 1) throw new Error('practice progress CAS failed');
          return required(attemptId);
        });
      },
      acceptAssessment(sourceId): PitchPracticeAttempt {
        check(sourceId);
        const raw = authority?.readAcceptedAssessment(sourceId) ?? null;
        return transaction(() => {
          const saved = db.prepare('SELECT * FROM pitch_practice_attempts WHERE assessment_source_id=?').get(sourceId) as Row | undefined;
          if (saved) {
            const current = decode(saved, db);
            if (raw && json(validatePracticeAssessment(raw, sourceId, current)) !== saved.assessment_json) throw new Error('practice assessment already frozen differently');
            return current;
          }
          if (!raw || !practiceId(raw.attemptId)) throw new Error('accepted practice assessment is missing');
          const current = required(raw.attemptId), assessment = validatePracticeAssessment(raw, sourceId, current), row = rowById(db, raw.attemptId)!;
          if (current.assessment) throw new Error('practice assessment already frozen under another source');
          const changed = db.prepare(`UPDATE pitch_practice_attempts SET assessment_source_id=?, assessment_json=?, assessment_hash=? WHERE attempt_id=? AND assessment_json IS NULL`)
            .run(sourceId, json(assessment), practiceHash({ immutableHash: row.immutable_hash, assessment }), current.attemptId);
          if (changed.changes !== 1) throw new Error('practice assessment CAS failed');
          return required(current.attemptId);
        });
      },
      read,
      readAcceptedActivity(sourceId) { check(sourceId); const row = rowByActivity(db, sourceId); return row ? practiceWorkload(decode(row, db)) : null; },
      readAcceptedLearningEvent(sourceId) {
        check(sourceId); const row = rowByActivity(db, sourceId); if (!row) return null;
        const event = learningEvent(decode(row, db)); if (!event) return null;
        if (!eligible(assertEpisodeBoundary(db, row), event)) return null;
        return freezePractice(event);
      },
      assertWorkloadEvidence, assertLearningEvidence,
      settle(attemptId): PitchPracticeSettlement {
        const current = required(attemptId), activity = practiceWorkload(current);
        if (!current.completionReference) return { kind: 'pending', reason: 'delivery_incomplete' };
        if (!activity) return { kind: 'pending', reason: 'assessment_missing' };
        // Existing owners retain separate transactions and original revision CAS.
        const workload = sources.workload.apply(activity.sourceEventId, current.opportunity.workloadRevision);
        const receipt = workloadReceipt(required(attemptId), db);
        if (!receipt || json(receipt.after) !== json(workload)) throw new Error('practice workload application differs');
        if (!current.opportunity.episode) return freezePractice({ kind: 'complete', activity, workload, episode: null });
        const row = rowById(db, attemptId)!, event = learningEvent(current)!;
        const before = assertEpisodeBoundary(db, row);
        if (!eligible(before, event)) return { kind: 'pending', reason: 'learning_stage_or_domain', workload };
        const saved = db.prepare('SELECT * FROM world_development_learning_events WHERE source_id=?').get(activity.sourceEventId) as LearningRow | undefined;
        if (!saved) {
          const head = sources.episodes.read(before.episodeId)?.episode;
          if (!head || json(head) !== json(before)) return { kind: 'pending', reason: 'learning_revision_conflict', workload };
        }
        const episode = sources.episodes.advance(before.episodeId, activity.sourceEventId, before.revision);
        assertLearningEvidence(db, event, 'retry');
        if (json(episode) !== json(appendDevelopmentLearningEvent(before, before.revision, event))) throw new Error('practice episode result differs');
        return freezePractice({ kind: 'complete', activity, workload, episode });
      },
      close() { if (!closed) { db.close(); closed = true; } },
    });
  } catch (error) { db.close(); throw error; }
};
