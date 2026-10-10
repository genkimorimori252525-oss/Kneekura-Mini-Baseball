import { readNativePitchPracticeAttemptFromSqlite, assertNativePitchPracticeLearningSettledFromSqlite } from './NativePitchPracticeEvidenceFromSqlite';
import { practiceActivityId, practiceWorkload } from './PitchPracticeAttempt';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { appendDevelopmentLearningEvent, type DevelopmentLearningEventInput } from '../../core/world/development/DevelopmentLearningEpisode';
import { advancePlayerWorkloadRecovery, type PlayerWorkloadActivity } from '../../core/world/development/PlayerWorkloadRecovery';
import { nonPitchAssessmentInput, nonPitchFields as fields, nonPitchId as id, type AcceptedNonPitchRepetitionAssessment } from './NonPitchDevelopmentRepetition';
import { readOwnedDevelopmentEpisode, type SqliteDevelopmentInitiationStore, type DevelopmentLearningEvidenceGuard } from './SqliteDevelopmentInitiationStore';
import { readNativeDevelopmentEpisodeFromSqlite } from './NativeDevelopmentEpisodeFromSqlite';
import { playerPersonLinkEvidenceFromSqlite } from './SqlitePlayerPersonLinkStore';
import { playerWorkloadRecoveryStoreFromSqlite, assertArchivedPlayerWorkloadActivity } from './SqlitePlayerWorkloadRecoveryStore';
import { assertNoSamePaPlayerReservation } from './SamePlateAppearanceReservationGuard';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { standalonePracticeInput, standaloneTick, readStandalonePracticeMotionFrame, executeStandalonePracticeMotion,
  type AcceptedStandalonePractice } from './StandalonePracticeMotion';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type AcceptedStandalonePracticeAssessment = Omit<AcceptedNonPitchRepetitionAssessment, 'closureSourceId'> & Readonly<{ effortUnits: number }>;
export type StandalonePracticeAuthority = Readonly<{
  readAcceptedPractice?(sourceId: string): AcceptedStandalonePractice | null;
  readAcceptedAssessment?(sourceId: string): AcceptedStandalonePracticeAssessment | null;
}>;
type Development = Pick<SqliteDevelopmentInitiationStore, 'read'> | null;
type Row = { source_id: string; career_id: string; player_id: string; opportunity_id: string; event_id: string;
  workload_revision: number; source_json: string; snapshot_json: string; snapshot_hash: string };
type ProgressRow = { source_id: string; revision: number; before_revision: number; through_tick: number; snapshot_json: string; snapshot_hash: string };
type AssessmentRow = { source_id: string; opportunity_source_id: string; snapshot_json: string; snapshot_hash: string };
const prefix = 'standalone-practice:';
export const isStandalonePracticeEvent = (event: Pick<DevelopmentLearningEventInput, 'sourceEventId'>): boolean => event.sourceEventId.startsWith(prefix);
const eventId = (source: AcceptedStandalonePractice) => `${prefix}${hash([source.careerId, source.playerId, source.opportunityId])}`;
const assessmentInput = (raw: unknown, sourceId: string): AcceptedStandalonePracticeAssessment => {
  const source = cloneInert(raw) as AcceptedStandalonePracticeAssessment;
  if (!fields(source, ['sourceId', 'sourceVersion', 'opportunitySourceId', 'physicalProofHash', 'relevant', 'factors', 'provenance', 'effortUnits'])
    || !Number.isFinite(source.effortUnits) || source.effortUnits < 0) throw new Error('invalid standalone practice assessed effort');
  const { effortUnits: _effort, ...rest } = source;
  nonPitchAssessmentInput({ ...rest, closureSourceId: source.opportunitySourceId }, sourceId);
  return freeze(source);
};
const native = (db: DatabaseSync) => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof Native) || !db.isTransaction) throw new Error('standalone practice requires an owned Native snapshot');
};
const reader = (db: DatabaseSync, development: Development) => {
  native(db);
  const derive = (source: AcceptedStandalonePractice, fresh: boolean) => {
    const frame = readStandalonePracticeMotionFrame(db, source, fresh);
    const episode = (development ? readOwnedDevelopmentEpisode(development, db, source.episodeId, source.episodeRevision)
      : readNativeDevelopmentEpisodeFromSqlite(db, source.episodeId, source.episodeRevision))?.episode;
    if (!episode || episode.careerId !== source.careerId || episode.playerId !== source.playerId || episode.domain !== source.domain
      || episode.effectiveDay > source.atDay || !['HYPOTHESIS', 'PRACTICING'].includes(episode.stage)) throw new Error('standalone practice original learning intention differs');
    if (fresh) {
      assertNoSamePaPlayerReservation(db, source);
      const head = db.prepare('SELECT revision,current_json FROM world_development_initiations WHERE episode_id=?').get(source.episodeId);
      if (head?.revision !== source.episodeRevision || head.current_json !== json(episode)) throw new Error('standalone practice episode revision is stale');
    }
    // Validate the accepted command at its original origin; no completion is adopted here.
    const initial = executeStandalonePracticeMotion(source, frame, source.startTick);
    return freeze({ source, frame, episode, eventId: eventId(source), initial });
  };
  type Reservation = ReturnType<typeof derive>;
  const rowFor = (sourceId: string): Row | null => {
    if (!id(sourceId)) throw new Error('invalid standalone practice identity');
    const rows = db.prepare(`SELECT * FROM main.standalone_practice_commands WHERE source_id=$id
      OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id: sourceId }) as Row[];
    if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('standalone command Source ownership differs');
    if (!rows.length && (db.prepare(`SELECT 1 FROM main.standalone_practice_progress WHERE source_id=$id
      OR ${claim('snapshot_json', ['sourceId'], '$id')}`).get({ id: sourceId })
      || db.prepare(`SELECT 1 FROM main.standalone_practice_assessments WHERE opportunity_source_id=$id
        OR ${claim('snapshot_json', ['assessment', 'opportunitySourceId'], '$id')}`).get({ id: sourceId }))) {
      throw new Error('standalone practice has orphan consumed evidence');
    }
    return rows[0] ?? null;
  };
  const peers = (value: Reservation) => db.prepare(`SELECT * FROM main.standalone_practice_commands WHERE event_id=$event
    OR ${claim('snapshot_json', ['eventId'], '$event')}
    OR ((career_id=$career OR ${claim('source_json', ['careerId'], '$career')} OR ${claim('snapshot_json', ['episode', 'careerId'], '$career')})
      AND (player_id=$player OR ${claim('source_json', ['playerId'], '$player')} OR ${claim('snapshot_json', ['episode', 'playerId'], '$player')})
      AND (opportunity_id=$opportunity OR ${claim('source_json', ['opportunityId'], '$opportunity')} OR workload_revision=$revision))`)
    .all({ event: value.eventId, career: value.source.careerId, player: value.source.playerId,
      opportunity: value.source.opportunityId, revision: value.source.workloadRevision }) as Row[];
  const reservation = (sourceId: string) => {
    const row = rowFor(sourceId); if (!row) return null;
    const source = standalonePracticeInput(JSON.parse(row.source_json), sourceId), value = derive(source, false), claims = peers(value);
    if (claims.length !== 1 || claims[0].source_id !== sourceId || row.career_id !== source.careerId || row.player_id !== source.playerId
      || row.opportunity_id !== source.opportunityId || row.event_id !== value.eventId || row.workload_revision !== source.workloadRevision
      || row.source_json !== json(source) || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('standalone original command archive differs');
    return value;
  };
  const required = (sourceId: string) => { const value = reservation(sourceId); if (!value) throw new Error('standalone practice command is missing'); return value; };
  const progress = (value: Reservation, revision?: number) => {
    const source = value.source;
    let current = freeze({ sourceId: source.sourceId, revision: 0, throughTick: source.startTick, execution: value.initial });
    const rows = db.prepare(`SELECT * FROM main.standalone_practice_progress WHERE source_id=$id
      OR ${claim('snapshot_json', ['sourceId'], '$id')} ORDER BY revision`).all({ id: source.sourceId }) as ProgressRow[];
    for (const row of rows) {
      if (row.source_id !== source.sourceId) throw new Error('standalone consumed progress owner differs');
      if (revision !== undefined && row.revision > revision) continue;
      if (row.before_revision !== current.revision || row.revision !== current.revision + 1 || row.through_tick <= current.throughTick) throw new Error('standalone consumed progress is not contiguous');
      current = freeze({ sourceId: source.sourceId, revision: row.revision, throughTick: row.through_tick,
        execution: executeStandalonePracticeMotion(source, value.frame, row.through_tick) });
      if (row.snapshot_json !== json(current) || row.snapshot_hash !== hash(current)) throw new Error('standalone consumed physical archive differs');
    }
    if (revision !== undefined && current.revision !== revision) throw new Error('standalone consumed revision is missing');
    const complete = current.throughTick === source.endTick;
    return freeze({ reservation: value, progress: current, complete,
      physicalProofHash: complete ? hash({ reservation: value, progress: current }) : null });
  };
  const physical = (sourceId: string, revision?: number) => progress(required(sourceId), revision);
  const deriveAssessment = (assessment: AcceptedStandalonePracticeAssessment) => {
    const physicalValue = physical(assessment.opportunitySourceId), value = physicalValue.reservation;
    if (!physicalValue.complete || physicalValue.physicalProofHash !== assessment.physicalProofHash) throw new Error('standalone original consumed completion differs');
    if (assessment.relevant && !physicalValue.progress.execution.moved) throw new Error('stationary standalone command is not a relevant motion repetition');
    const s = value.source;
    const activity: PlayerWorkloadActivity = { sourceEventId: value.eventId, sourceVersion: 'standalone-practice-workload-v1',
      evidenceId: assessment.physicalProofHash, careerId: s.careerId, playerId: s.playerId, atDay: s.atDay, kind: 'PRACTICE',
      effortUnits: assessment.effortUnits, healthAvailability: assessment.factors.healthAvailability };
    advancePlayerWorkloadRecovery(value.frame.workload, s.workloadRevision, activity);
    const event: DevelopmentLearningEventInput | null = assessment.relevant ? { eventId: value.eventId, sourceEventId: value.eventId,
      atDay: s.atDay, kind: 'PRACTICE_RECORDED', domain: s.domain } : null;
    if (event) appendDevelopmentLearningEvent(value.episode, value.episode.revision, event);
    return freeze({ physical: physicalValue, assessment, activity, event,
      repetition: event ? { ...assessment.factors, sourceEventId: value.eventId, atDay: s.atDay, fatigue: value.frame.workload.fatigue } : null });
  };
  const assessed = (sourceId: string) => {
    const value = physical(sourceId);
    const rows = db.prepare(`SELECT * FROM main.standalone_practice_assessments WHERE opportunity_source_id=$id
      OR ${claim('snapshot_json', ['assessment', 'opportunitySourceId'], '$id')}`).all({ id: sourceId }) as AssessmentRow[];
    if (rows.length > 1 || rows.length === 1 && rows[0].opportunity_source_id !== sourceId) throw new Error('standalone assessment ownership differs');
    const row = rows[0]; if (!row) return null;
    const saved = JSON.parse(row.snapshot_json) as { assessment: AcceptedStandalonePracticeAssessment };
    const result = deriveAssessment(assessmentInput(saved.assessment, row.source_id));
    if (row.snapshot_json !== json(result) || row.snapshot_hash !== hash(result) || json(result.physical) !== json(value)) throw new Error('standalone original assessment archive differs');
    return result;
  };
  const byEvent = (sourceEventId: string) => {
    const rows = db.prepare(`SELECT * FROM main.standalone_practice_commands WHERE event_id=$id
      OR ${claim('snapshot_json', ['eventId'], '$id')}`).all({ id: sourceEventId }) as Row[];
    if (rows.length !== 1 || rows[0].event_id !== sourceEventId) throw new Error('standalone practice event owner is missing or differs');
    const result = assessed(rows[0].source_id);
    if (!result || result.activity.sourceEventId !== sourceEventId) throw new Error('standalone practice accepted assessment is missing');
    return result;
  };
  const workloadEvidence = (value: NonNullable<ReturnType<typeof assessed>>, phase: string) => {
    const activity = value.activity, before = value.physical.reservation.frame.workload;
    const after = advancePlayerWorkloadRecovery(before, before.revision, activity);
    const rows = db.prepare(`SELECT * FROM world_player_workload_activities WHERE source_id=$id
      OR ${claim('source_json', ['sourceEventId'], '$id')}`).all({ id: activity.sourceEventId });
    if (phase === 'write' ? rows.length !== 0 : rows.length !== 1) throw new Error('standalone original PRACTICE receipt cardinality differs');
    if (rows[0]) {
      const row = rows[0];
      if (row.source_id !== activity.sourceEventId || row.career_id !== before.careerId || row.player_id !== before.playerId
        || row.before_revision !== before.revision || row.after_revision !== after.revision || row.source_json !== json(activity)
        || row.before_json !== json(before) || row.after_json !== json(after)) throw new Error('standalone original PRACTICE receipt differs');
      assertArchivedPlayerWorkloadActivity(db, { activity, before, after });
    }
    return { activity, before, after };
  };
  const learningGuard = (event: DevelopmentLearningEventInput, phase: string) => {
    const value = byEvent(event.sourceEventId), before = value.physical.reservation.episode;
    if (!value.event || json(value.event) !== json(event)) throw new Error('standalone learning differs from accepted relevance');
    workloadEvidence(value, 'read');
    const rows = db.prepare(`SELECT * FROM world_development_learning_events WHERE source_id=$id
      OR ${claim('event_json', ['sourceEventId'], '$id')}`).all({ id: event.sourceEventId });
    if (phase === 'write' ? rows.length !== 0 : rows.length !== 1) throw new Error('standalone learning receipt cardinality differs');
    const after = appendDevelopmentLearningEvent(before, before.revision, event), row = rows[0];
    if (row && (row.source_id !== event.sourceEventId || row.episode_id !== before.episodeId || row.before_revision !== before.revision
      || row.after_revision !== after.revision || row.event_json !== json(event) || row.state_json !== json(after))) throw new Error('standalone original learning application differs');
  };
  return { derive, peers, reservation, physical, required, assessed, deriveAssessment, byEvent, workloadEvidence, learningGuard };
};

/** The existing pitching owner uses the same Player clock exclusion. This
 * check reads originals; it neither relabels a drill nor installs new tables. */
export const assertStandalonePracticeBeforePitch = (db: DatabaseSync,
  next: Readonly<{ careerId: string; playerId: string; atDay: number; readyAtUs: number }>): void => {
  if (!db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name='standalone_practice_commands'").get()) return;
  native(db);
  const own = reader(db, null);
  const rows = db.prepare(`SELECT source_id FROM main.standalone_practice_commands WHERE
    (career_id=$career OR ${claim('source_json', ['careerId'], '$career')})
    AND (player_id=$player OR ${claim('source_json', ['playerId'], '$player')})`)
    .all({ career: next.careerId, player: next.playerId });
  for (const row of rows) {
    const value = own.assessed(String(row.source_id));
    if (!value) throw new Error('standalone practice blocks a new pitch until its consumed work is settled');
    own.workloadEvidence(value, 'read');
    if (value.event) own.learningGuard(value.event, 'read');
    const previous = value.physical.reservation.source;
    if (previous.atDay > next.atDay || previous.atDay === next.atDay
      && BigInt(previous.endTick) * 1_000_000n > BigInt(next.readyAtUs) * BigInt(previous.ticksPerSecond)) {
      throw new Error('pitch practice overlaps original standalone work');
    }
  }
};
const assertPriorPitchPractice = (db: DatabaseSync, source: AcceptedStandalonePractice): void => {
  if (!db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name='pitch_practice_attempts'").get()) return;
  const rows = db.prepare(`SELECT attempt_id FROM main.pitch_practice_attempts WHERE
    (career_id=$career OR ${claim('opportunity_json', ['careerId'], '$career')})
    AND (player_id=$player OR ${claim('opportunity_json', ['playerId'], '$player')})`)
    .all({ career: source.careerId, player: source.playerId });
  const workload = playerWorkloadRecoveryStoreFromSqlite(db, playerPersonLinkEvidenceFromSqlite(db));
  for (const row of rows) {
    const previous = readNativePitchPracticeAttemptFromSqlite(db, String(row.attempt_id));
    const expected = previous && practiceWorkload(previous), receipt = previous && workload.readActivity(practiceActivityId(previous.attemptId));
    if (!previous?.completionReference || !expected || !receipt || json(expected) !== json(receipt.activity)
      || json(receipt.before) !== json(previous.frame.workload)) throw new Error('original pitch practice remains unfinished or unsettled');
    assertArchivedPlayerWorkloadActivity(db, receipt);
    assertNativePitchPracticeLearningSettledFromSqlite(db, previous.attemptId);
    if (previous.opportunity.atDay > source.atDay || previous.opportunity.atDay === source.atDay
      && BigInt(previous.plannedDelivery.timeline.followThroughEndUs) * BigInt(source.ticksPerSecond) > BigInt(source.startTick) * 1_000_000n) {
      throw new Error('standalone practice overlaps original pitching work');
    }
  }
};

/** Fixed dispatch also protects generic learning readers and retries. */
export const assertStandalonePracticeLearningEvent = (development: Development,
  connection: Parameters<DevelopmentLearningEvidenceGuard>[0], event: DevelopmentLearningEventInput, phase: string): void => {
  if (!isStandalonePracticeEvent(event)) return;
  withBattedVenueLegalReadSnapshot(connection as DatabaseSync, () => reader(connection as DatabaseSync, development).learningGuard(event, phase));
};
export const assertStandalonePracticeWorkloadActivity = (db: DatabaseSync, activity: PlayerWorkloadActivity, phase: string): void => {
  if (!activity.sourceEventId.startsWith(prefix)) return;
  const own = reader(db, null), value = own.byEvent(activity.sourceEventId);
  if (json(value.activity) !== json(activity)) throw new Error('standalone PRACTICE activity differs from its original assessment');
  own.workloadEvidence(value, phase);
};
export const readStandalonePracticeRepetition = (db: DatabaseSync, development: Development, sourceEventId: string) => {
  const own = reader(db, development), value = own.byEvent(sourceEventId);
  if (!value.event || !value.repetition) throw new Error('standalone practice is not an accepted relevant repetition');
  own.learningGuard(value.event, 'read');
  const source = value.physical.reservation.source;
  return freeze({ event: value.event, repetition: value.repetition, episodeId: source.episodeId,
    careerId: source.careerId, playerId: source.playerId, proofHash: hash(value) });
};

/** Durably consumes a prescribed motor interval, then charges its explicitly
 * assessed effort once. Completion denotes the drill interval, never a play end. */
export const openSqliteStandalonePracticeStore = (path: string, development: Pick<SqliteDevelopmentInitiationStore, 'read' | 'advance'>,
  authority: StandalonePracticeAuthority = {}) => {
  if (!id(path) || !development || typeof development.read !== 'function' || typeof development.advance !== 'function'
    || Object.values(authority).some(value => typeof value !== 'function')) throw new Error('invalid standalone practice owner');
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new Native(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS main.standalone_practice_commands(source_id TEXT PRIMARY KEY,career_id TEXT NOT NULL,player_id TEXT NOT NULL,
      opportunity_id TEXT NOT NULL,event_id TEXT NOT NULL UNIQUE,workload_revision INTEGER NOT NULL,source_json TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(career_id,player_id,opportunity_id),UNIQUE(career_id,player_id,workload_revision));
    CREATE TABLE IF NOT EXISTS main.standalone_practice_progress(source_id TEXT NOT NULL,revision INTEGER NOT NULL,before_revision INTEGER NOT NULL,
      through_tick INTEGER NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,PRIMARY KEY(source_id,revision));
    CREATE TABLE IF NOT EXISTS main.standalone_practice_assessments(source_id TEXT PRIMARY KEY,opportunity_source_id TEXT NOT NULL UNIQUE,
      snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL);`);
  let closed = false;
  const transaction = <T>(write: boolean, body: (own: ReturnType<typeof reader>) => T): T => {
    if (closed) throw new Error('closed standalone practice owner'); db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN');
    try { const value = body(reader(db, development)); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const api = {
    begin(sourceId: string) {
      const raw = authority.readAcceptedPractice?.(sourceId) ?? null;
      const source = raw === null ? null : standalonePracticeInput(raw, sourceId);
      return transaction(true, own => {
        const prior = own.reservation(sourceId);
        if (prior) { if (source && json(source) !== json(prior.source)) throw new Error('standalone practice Source changed'); return own.physical(sourceId); }
        if (!source) throw new Error('accepted standalone practice Source is missing');
        const value = own.derive(source, true);
        assertPriorPitchPractice(db, source);
        if (own.peers(value).length || db.prepare(`SELECT 1 FROM world_player_workload_activities WHERE source_id=$id
          OR ${claim('source_json', ['sourceEventId'], '$id')}`).get({ id: value.eventId })
          || db.prepare(`SELECT 1 FROM world_development_learning_events WHERE source_id=$id
            OR ${claim('event_json', ['sourceEventId'], '$id')}`).get({ id: value.eventId })) {
          throw new Error('standalone Player opportunity or workload revision is already reserved');
        }
        const earlier = db.prepare(`SELECT * FROM main.standalone_practice_commands WHERE
          (career_id=$career OR ${claim('source_json', ['careerId'], '$career')} OR ${claim('snapshot_json', ['episode', 'careerId'], '$career')})
          AND (player_id=$player OR ${claim('source_json', ['playerId'], '$player')} OR ${claim('snapshot_json', ['episode', 'playerId'], '$player')})`)
          .all({ career: source.careerId, player: source.playerId }) as Row[];
        for (const row of earlier) {
          const prior = own.assessed(row.source_id);
          if (!prior) throw new Error('standalone Player still has unfinished practice');
          own.workloadEvidence(prior, 'read');
          if (prior.event) own.learningGuard(prior.event, 'read');
          const previous = prior.physical.reservation.source;
          if (previous.atDay > source.atDay || previous.atDay === source.atDay
            && BigInt(previous.endTick) * BigInt(source.ticksPerSecond) > BigInt(source.startTick) * BigInt(previous.ticksPerSecond)) {
            throw new Error('standalone practice cannot overlap earlier consumed work');
          }
        }
        db.prepare('INSERT INTO main.standalone_practice_commands VALUES(?,?,?,?,?,?,?,?,?)').run(sourceId, source.careerId, source.playerId,
          source.opportunityId, value.eventId, source.workloadRevision, json(source), json(value), hash(value));
        if (json(own.required(sourceId)) !== json(value) || json(own.derive(source, true)) !== json(value)) throw new Error('standalone admission dependencies changed');
        return own.physical(sourceId);
      });
    },
    advance(sourceId: string, expectedRevision: number, throughTick: number) {
      return transaction(true, own => {
        const before = own.physical(sourceId), s = before.reservation.source;
        if (!standaloneTick(expectedRevision) || !standaloneTick(throughTick)) throw new Error('invalid standalone progress request');
        if (expectedRevision < before.progress.revision) {
          const saved = db.prepare('SELECT through_tick,snapshot_json FROM main.standalone_practice_progress WHERE source_id=? AND before_revision=?').get(sourceId, expectedRevision);
          if (!saved || saved.through_tick !== throughTick) throw new Error('standalone progress retry differs');
          return own.physical(sourceId, expectedRevision + 1);
        }
        if (expectedRevision !== before.progress.revision || before.complete || throughTick <= before.progress.throughTick || throughTick > s.endTick) throw new Error('stale or invalid standalone physical progress');
        const workload = playerWorkloadRecoveryStoreFromSqlite(db, playerPersonLinkEvidenceFromSqlite(db)).readHead(s.careerId, s.playerId);
        if (workload?.revision !== s.workloadRevision) throw new Error('standalone physical work lost its original workload revision');
        assertNoSamePaPlayerReservation(db, s);
        const progress = { sourceId, revision: expectedRevision + 1, throughTick, execution: executeStandalonePracticeMotion(s, before.reservation.frame, throughTick) };
        db.prepare('INSERT INTO main.standalone_practice_progress VALUES(?,?,?,?,?,?)').run(sourceId, progress.revision, expectedRevision, throughTick, json(progress), hash(progress));
        const after = own.physical(sourceId);
        if (json(after.progress) !== json(progress) || json(playerWorkloadRecoveryStoreFromSqlite(db, playerPersonLinkEvidenceFromSqlite(db))
          .readHead(s.careerId, s.playerId)) !== json(workload)) throw new Error('standalone execution changed during adoption');
        assertNoSamePaPlayerReservation(db, s);
        return after;
      });
    },
    read(sourceId: string) { return transaction(false, own => own.reservation(sourceId) ? own.physical(sourceId) : null); },
    assess(sourceId: string) {
      const raw = authority.readAcceptedAssessment?.(sourceId) ?? null;
      return transaction(true, own => {
        const rows = db.prepare(`SELECT * FROM main.standalone_practice_assessments WHERE source_id=$id
          OR ${claim('snapshot_json', ['assessment', 'sourceId'], '$id')}`).all({ id: sourceId }) as AssessmentRow[];
        if (rows.length) {
          if (rows.length !== 1 || rows[0].source_id !== sourceId) throw new Error('standalone assessment Source ownership differs');
          const prior = own.assessed(rows[0].opportunity_source_id)!;
          if (raw && json(assessmentInput(raw, sourceId)) !== json(prior.assessment)) throw new Error('standalone accepted assessment changed'); return prior;
        }
        if (!raw) throw new Error('accepted standalone assessment is missing');
        const assessment = assessmentInput(raw, sourceId), value = own.deriveAssessment(assessment);
        if (own.assessed(assessment.opportunitySourceId)) throw new Error('standalone practice already assessed');
        db.prepare('INSERT INTO main.standalone_practice_assessments VALUES(?,?,?,?)').run(sourceId, assessment.opportunitySourceId, json(value), hash(value));
        const saved = own.assessed(assessment.opportunitySourceId);
        if (json(saved) !== json(value)) throw new Error('standalone assessment dependencies changed'); return saved!;
      });
    },
    settle(sourceId: string) {
      const value = transaction(true, own => {
        const physical = own.physical(sourceId);
        if (!physical.complete) return null;
        const assessed = own.assessed(sourceId); if (!assessed) return null;
        const workload = playerWorkloadRecoveryStoreFromSqlite(db, playerPersonLinkEvidenceFromSqlite(db), {
          readAcceptedBaseline: () => null, readAcceptedActivity: event => event === assessed.activity.sourceEventId ? assessed.activity : null,
        }, { transaction: work => work() });
        workload.apply(assessed.activity.sourceEventId, assessed.physical.reservation.source.workloadRevision);
        own.workloadEvidence(assessed, 'read');
        return assessed;
      });
      if (!value) return { kind: 'pending' as const, reason: 'consumed_completion_or_assessment_missing' as const };
      const before = value.physical.reservation.episode;
      const episode = value.event ? development.advance(before.episodeId, value.event.sourceEventId, before.revision) : null;
      transaction(false, own => { own.workloadEvidence(own.assessed(sourceId)!, 'read'); if (value.event) own.learningGuard(value.event, 'retry'); });
      return freeze({ kind: 'complete' as const, activity: value.activity, episode });
    },
    readAcceptedLearningEvent(sourceEventId: string) {
      if (!sourceEventId.startsWith(prefix)) return null;
      return transaction(false, own => own.byEvent(sourceEventId).event);
    },
    close() { if (!closed) { db.close(); closed = true; } },
  };
  return Object.freeze(api);
};
