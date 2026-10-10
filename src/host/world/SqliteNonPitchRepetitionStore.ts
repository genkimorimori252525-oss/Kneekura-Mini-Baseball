import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { appendDevelopmentLearningEvent, type DevelopmentLearningEventInput } from '../../core/world/development/DevelopmentLearningEpisode';
import { assessDevelopmentPracticeExposure, type DevelopmentPracticeBundle } from '../../core/world/development/DevelopmentPracticeExposure';
import { readOwnedDevelopmentEpisode, type SqliteDevelopmentInitiationStore, type DevelopmentLearningEvidenceGuard } from './SqliteDevelopmentInitiationStore';
import { nonPitchOpportunityInput, nonPitchAssessmentInput, nonPitchId as id, nonPitchRepetitionEventId,
  isNonPitchRepetitionEvent, type NonPitchRepetitionAuthority, type NonPitchRepetitionOpportunity } from './NonPitchDevelopmentRepetition';
import { readNonPitchRepetitionFrame, readNonPitchRepetitionCompletion } from './NonPitchRepetitionEvidenceFromSqlite';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes } from './SqliteOwnershipMetadata';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type Db = DatabaseSync;
type Opportunity = ReturnType<typeof readNonPitchRepetitionFrame>;
type Physical = ReturnType<typeof readNonPitchRepetitionCompletion>;
type Episode = NonNullable<ReturnType<typeof readOwnedDevelopmentEpisode>>['episode'];
type Reservation = Readonly<{ source: NonPitchRepetitionOpportunity; frame: Opportunity; episode: Episode; eventId: string }>;
type ReservationRow = { source_id: string; career_id: string; game_id: string; play_id: number; player_id: string;
  opportunity_id: string; event_id: string; source_json: string; snapshot_json: string; snapshot_hash: string };
type AssessmentRow = { opportunity_source_id: string; source_id: string; event_id: string; assessment_json: string;
  physical_json: string; physical_hash: string; event_json: string; repetition_json: string };
type LearningRow = { source_id: string; episode_id: string; before_revision: number; after_revision: number; event_json: string; state_json: string };
const playClaim = (path: readonly string[]) => `EXISTS(SELECT 1 FROM (${sqliteJsonMetadataNodes('snapshot_json', path)}) p
  WHERE p.type='integer' AND p.atom=$play)`;

const repetitionReader = (development: Pick<SqliteDevelopmentInitiationStore, 'read'>) => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const reservationRow = (connection: Db, sourceId: string): ReservationRow | null => {
    const rows = connection.prepare(`SELECT * FROM non_pitch_repetition_opportunities WHERE source_id=$id
      OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`)
      .all({ id: sourceId }) as ReservationRow[];
    if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('non-pitch opportunity Source ownership differs');
    return rows[0] ?? null;
  };
  const deriveReservation = (connection: Db, source: NonPitchRepetitionOpportunity, fresh: boolean): Reservation => {
    const frame = readNonPitchRepetitionFrame(connection, source, fresh);
    const accepted = readOwnedDevelopmentEpisode(development, connection, source.episodeId, source.episodeRevision);
    const episode = accepted?.episode;
    if (!episode || episode.careerId !== frame.careerId || episode.playerId !== frame.playerId
      || episode.domain !== source.domain || !['HYPOTHESIS', 'PRACTICING'].includes(episode.stage)
      || episode.effectiveDay > frame.gameDay) throw new Error('non-pitch opportunity original episode scope or stage differs');
    if (fresh) {
      const head = connection.prepare('SELECT revision,current_json FROM world_development_initiations WHERE episode_id=?').get(source.episodeId);
      if (head?.revision !== episode.revision || head.current_json !== json(episode)) throw new Error('non-pitch opportunity episode revision is stale');
    }
    return freeze({ source, frame, episode, eventId: nonPitchRepetitionEventId(frame.careerId, frame.gameId, frame.playId, frame.playerId) });
  };
  const scopeRows = (connection: Db, value: Reservation) => connection.prepare(`SELECT * FROM non_pitch_repetition_opportunities
    WHERE event_id=$event OR ${claim('snapshot_json', ['eventId'], '$event')}
      OR ((career_id=$career OR ${claim('snapshot_json', ['frame', 'careerId'], '$career')} OR ${claim('snapshot_json', ['episode', 'careerId'], '$career')})
        AND (game_id=$game OR ${claim('snapshot_json', ['frame', 'gameId'], '$game')} OR ${claim('snapshot_json', ['frame', 'actor', 'source', 'gameId'], '$game')})
        AND (play_id=$play OR ${playClaim(['frame', 'playId'])} OR ${playClaim(['frame', 'actor', 'match', 'playId'])})
        AND (player_id=$player OR ${claim('source_json', ['playerId'], '$player')}
          OR ${claim('snapshot_json', ['source', 'playerId'], '$player')} OR ${claim('snapshot_json', ['frame', 'playerId'], '$player')}
          OR ${claim('snapshot_json', ['frame', 'binding', 'playerId'], '$player')} OR ${claim('snapshot_json', ['frame', 'person', 'playerId'], '$player')}
          OR ${claim('snapshot_json', ['episode', 'playerId'], '$player')}))
      OR ((career_id=$career OR ${claim('snapshot_json', ['frame', 'careerId'], '$career')})
        AND (opportunity_id=$opportunity OR ${claim('source_json', ['opportunityId'], '$opportunity')}
          OR ${claim('snapshot_json', ['source', 'opportunityId'], '$opportunity')}))`)
    .all({ event: value.eventId, career: value.frame.careerId, game: value.frame.gameId, play: value.frame.playId,
      player: value.frame.playerId, opportunity: value.source.opportunityId }) as ReservationRow[];
  const readReservation = (connection: Db, sourceId: string): Reservation | null => {
    const row = reservationRow(connection, sourceId); if (!row) return null;
    const source = nonPitchOpportunityInput(JSON.parse(row.source_json), sourceId), value = deriveReservation(connection, source, false);
    const peers = scopeRows(connection, value);
    if (peers.length !== 1 || peers[0].source_id !== sourceId || row.source_json !== json(source)
      || row.career_id !== value.frame.careerId || row.game_id !== value.frame.gameId || row.play_id !== value.frame.playId
      || row.player_id !== value.frame.playerId || row.opportunity_id !== source.opportunityId || row.event_id !== value.eventId
      || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('non-pitch opportunity original archive differs');
    return value;
  };
  const requiredReservation = (connection: Db, sourceId: string): Reservation => {
    const value = readReservation(connection, sourceId); if (!value) throw new Error('non-pitch prospective opportunity is missing'); return value;
  };
  const assessmentRow = (connection: Db, opportunitySourceId: string, eventId: string | null): AssessmentRow | null => {
    const rows = connection.prepare(`SELECT * FROM non_pitch_repetition_assessments WHERE opportunity_source_id=$id
      OR ${claim('assessment_json', ['opportunitySourceId'], '$id')} OR event_id=$event
      OR ${claim('event_json', ['sourceEventId'], '$event')} OR ${claim('repetition_json', ['sourceEventId'], '$event')}`)
      .all({ id: opportunitySourceId, event: eventId }) as AssessmentRow[];
    if (rows.length > 1 || rows.length === 1 && rows[0].opportunity_source_id !== opportunitySourceId) throw new Error('non-pitch assessment opportunity ownership differs');
    return rows[0] ?? null;
  };
  const deriveAssessment = (connection: Db, reservation: Reservation, raw: unknown, sourceId: string) => {
    const assessment = nonPitchAssessmentInput(raw, sourceId);
    if (assessment.opportunitySourceId !== reservation.source.sourceId) throw new Error('non-pitch assessment targets another opportunity');
    const physical = readNonPitchRepetitionCompletion(connection, reservation.frame, reservation.source.exercise, assessment.closureSourceId);
    if (physical.physicalProofHash !== assessment.physicalProofHash) throw new Error('non-pitch assessment original physical proof differs');
    const event: DevelopmentLearningEventInput | null = assessment.relevant ? { eventId: reservation.eventId, sourceEventId: reservation.eventId,
      atDay: reservation.frame.gameDay, kind: 'PRACTICE_RECORDED', domain: reservation.source.domain } : null;
    const repetition = event ? { ...assessment.factors, sourceEventId: event.sourceEventId, atDay: event.atDay,
      fatigue: physical.workload.before.fatigue } : null;
    if (event) appendDevelopmentLearningEvent(reservation.episode, reservation.episode.revision, event);
    return freeze({ reservation, assessment, physical, event, repetition });
  };
  type Assessed = ReturnType<typeof deriveAssessment>;
  const readAssessment = (connection: Db, opportunitySourceId: string): Assessed | null => {
    const reservation = readReservation(connection, opportunitySourceId);
    const row = assessmentRow(connection, opportunitySourceId, reservation?.eventId ?? null); if (!row) return null;
    if (!reservation) throw new Error('non-pitch assessed opportunity is missing');
    const value = deriveAssessment(connection, reservation, JSON.parse(row.assessment_json), row.source_id);
    const peers = connection.prepare(`SELECT * FROM non_pitch_repetition_assessments WHERE source_id=$source OR event_id=$event
      OR ${claim('assessment_json', ['sourceId'], '$source')}`).all({ source: value.assessment.sourceId, event: reservation.eventId });
    if (peers.length !== 1 || peers[0].opportunity_source_id !== opportunitySourceId
      || row.event_id !== reservation.eventId || row.assessment_json !== json(value.assessment)
      || row.physical_json !== json(value.physical) || row.physical_hash !== hash(value.physical)
      || row.event_json !== json(value.event) || row.repetition_json !== json(value.repetition)) throw new Error('non-pitch assessment or physical archive differs');
    return value;
  };
  const byEvent = (connection: Db, eventId: string): Assessed => {
    const rows = connection.prepare(`SELECT * FROM non_pitch_repetition_opportunities WHERE event_id=$id
      OR ${claim('snapshot_json', ['eventId'], '$id')}`).all({ id: eventId }) as ReservationRow[];
    if (rows.length !== 1 || rows[0].event_id !== eventId) throw new Error('non-pitch repetition event ownership is missing or differs');
    const value = readAssessment(connection, rows[0].source_id);
    if (!value?.event || value.event.sourceEventId !== eventId) throw new Error('non-pitch assessed repetition is missing');
    return value;
  };
  const learningRows = (connection: Db, eventId: string): LearningRow[] => connection.prepare(`SELECT * FROM world_development_learning_events
    WHERE source_id=$id OR ${claim('event_json', ['sourceEventId'], '$id')}`).all({ id: eventId }) as LearningRow[];
  const evidenceGuard: DevelopmentLearningEvidenceGuard = (connection, event, phase) => {
    if (!isNonPitchRepetitionEvent(event)) return;
    if (!(connection instanceof Native) || !connection.isTransaction) throw new Error('non-pitch learning requires the writer Native transaction');
    const value = byEvent(connection, event.sourceEventId), before = value.reservation.episode;
    if (json(event) !== json(value.event)) throw new Error('non-pitch learning event differs from original assessment');
    const rows = learningRows(connection, event.sourceEventId), after = appendDevelopmentLearningEvent(before, before.revision, event);
    if (phase === 'write' ? rows.length !== 0 : rows.length !== 1) throw new Error('non-pitch learning receipt cardinality differs');
    if (rows[0] && (rows[0].source_id !== event.sourceEventId || rows[0].episode_id !== before.episodeId
      || rows[0].before_revision !== before.revision || rows[0].after_revision !== after.revision
      || rows[0].event_json !== json(event) || rows[0].state_json !== json(after))) throw new Error('non-pitch original learning application differs');
  };
  return { deriveReservation, scopeRows, readReservation, requiredReservation, assessmentRow, deriveAssessment, readAssessment, byEvent, learningRows, evidenceGuard };
};
/** Fixed-format dispatch in the existing learning owner. Every read, retry and
 * writer phase reauthenticates these original Sources, even without an optional
 * caller guard. Historical dependencies decrease by the pinned episode revision. */
export const assertNonPitchLearningEvent = (development: Pick<SqliteDevelopmentInitiationStore, 'read'>,
  connection: Parameters<DevelopmentLearningEvidenceGuard>[0], event: DevelopmentLearningEventInput,
  phase: Parameters<DevelopmentLearningEvidenceGuard>[2]): void => {
  if (!isNonPitchRepetitionEvent(event)) return;
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(connection instanceof Native) || !connection.isTransaction && (phase === 'write' || phase === 'written')) {
    throw new Error('non-pitch learning requires the writer Native transaction');
  }
  withBattedVenueLegalReadSnapshot(connection, () => repetitionReader(development).evidenceGuard(connection, event, phase));
};

/** Reconstruct the original repetition on an owning consumer's transaction.
 * The development owner capability and fixed event guard remain mandatory. */
export const readOwnedNonPitchRepetition = (development: Pick<SqliteDevelopmentInitiationStore, 'read'>,
  connection: DatabaseSync, eventId: string) => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(connection instanceof Native) || !connection.isTransaction || !id(eventId)) {
    throw new Error('non-pitch exposure requires an owned Native repetition snapshot');
  }
  const reader = repetitionReader(development), value = reader.byEvent(connection, eventId);
  reader.evidenceGuard(connection, value.event!, 'read');
  return freeze({ event: value.event!, repetition: value.repetition!, episodeId: value.reservation.episode.episodeId,
    careerId: value.reservation.frame.careerId, playerId: value.reservation.frame.playerId,
    proofHash: hash(value) });
};

/** One prospective original game/Player/play repetition. Game workload remains
 * MATCH: this owner never charges effort a second time or manufactures ability. */
export const openSqliteNonPitchRepetitionStore = (path: string, development: Pick<SqliteDevelopmentInitiationStore, 'read' | 'advance'>,
  authority: NonPitchRepetitionAuthority = {}) => {
  if (!id(path) || !development || typeof development.read !== 'function' || typeof development.advance !== 'function') {
    throw new Error('invalid non-pitch repetition owner');
  }
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new Native(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS non_pitch_repetition_opportunities(
      source_id TEXT PRIMARY KEY,career_id TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,player_id TEXT NOT NULL,
      opportunity_id TEXT NOT NULL,event_id TEXT NOT NULL UNIQUE,source_json TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
      UNIQUE(career_id,game_id,play_id,player_id),UNIQUE(career_id,opportunity_id));
    CREATE TABLE IF NOT EXISTS non_pitch_repetition_assessments(
      opportunity_source_id TEXT PRIMARY KEY,source_id TEXT NOT NULL UNIQUE,event_id TEXT NOT NULL UNIQUE,
      assessment_json TEXT NOT NULL,physical_json TEXT NOT NULL,physical_hash TEXT NOT NULL,event_json TEXT NOT NULL,repetition_json TEXT NOT NULL);`);
  let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('closed or invalid non-pitch repetition owner'); };
  const transaction = <T>(write: boolean, body: () => T): T => {
    db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN');
    try { const value = body(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const { deriveReservation, scopeRows, readReservation, requiredReservation, assessmentRow, deriveAssessment, readAssessment, byEvent, learningRows, evidenceGuard } = repetitionReader(development);
  type Assessed = NonNullable<ReturnType<typeof readAssessment>>;
  return Object.freeze({
    prepare(sourceId: string): Reservation {
      check(sourceId);
      const raw = authority.readAcceptedOpportunity?.(sourceId) ?? null;
      const source = raw === null ? null : nonPitchOpportunityInput(raw, sourceId);
      return transaction(true, () => {
        const prior = readReservation(db, sourceId);
        if (prior) {
          if (source && json(prior.source) !== json(source)) throw new Error('non-pitch accepted opportunity changed'); return prior;
        }
        if (!source) throw new Error('accepted non-pitch opportunity is missing');
        const value = deriveReservation(db, source, true);
        if (scopeRows(db, value).length || learningRows(db, value.eventId).length) throw new Error('original game/Player repetition is already reserved');
        const f = value.frame;
        db.prepare('INSERT INTO non_pitch_repetition_opportunities VALUES(?,?,?,?,?,?,?,?,?,?)').run(sourceId, f.careerId, f.gameId,
          f.playId, f.playerId, source.opportunityId, value.eventId, json(source), json(value), hash(value));
        const after = readReservation(db, sourceId);
        if (json(after) !== json(value) || json(deriveReservation(db, source, true)) !== json(value)) throw new Error('non-pitch prospective dependencies changed during INSERT');
        return value;
      });
    },
    readOpportunity(sourceId: string) { check(sourceId); return transaction(false, () => readReservation(db, sourceId)); },
    inspectCompletion(sourceId: string, closureSourceId: string): Physical {
      check(sourceId); return transaction(false, () => {
        const value = requiredReservation(db, sourceId);
        return readNonPitchRepetitionCompletion(db, value.frame, value.source.exercise, closureSourceId);
      });
    },
    assess(sourceId: string): Assessed {
      check(sourceId);
      const raw = authority.readAcceptedAssessment?.(sourceId) ?? null;
      return transaction(true, () => {
        const peers = db.prepare(`SELECT * FROM non_pitch_repetition_assessments WHERE source_id=$id
          OR ${claim('assessment_json', ['sourceId'], '$id')}`).all({ id: sourceId }) as AssessmentRow[];
        if (peers.length) {
          if (peers.length !== 1 || peers[0].source_id !== sourceId) throw new Error('non-pitch assessment Source ownership differs');
          const prior = readAssessment(db, peers[0].opportunity_source_id)!;
          if (raw && json(nonPitchAssessmentInput(raw, sourceId)) !== json(prior.assessment)) throw new Error('non-pitch accepted assessment changed'); return prior;
        }
        if (!raw) throw new Error('accepted non-pitch assessment is missing');
        const assessment = nonPitchAssessmentInput(raw, sourceId), reservation = requiredReservation(db, assessment.opportunitySourceId);
        if (assessmentRow(db, reservation.source.sourceId, reservation.eventId)) throw new Error('non-pitch repetition already assessed');
        const value = deriveAssessment(db, reservation, assessment, sourceId);
        db.prepare('INSERT INTO non_pitch_repetition_assessments VALUES(?,?,?,?,?,?,?,?)').run(reservation.source.sourceId, sourceId,
          reservation.eventId, json(assessment), json(value.physical), hash(value.physical), json(value.event), json(value.repetition));
        if (json(readAssessment(db, reservation.source.sourceId)) !== json(value)) throw new Error('non-pitch assessment dependencies changed during INSERT');
        return value;
      });
    },
    read(sourceId: string) { check(sourceId); return transaction(false, () => readAssessment(db, sourceId)); },
    readRepetition(eventId: string) { check(eventId); return transaction(false, () => {
      const value = byEvent(db, eventId); evidenceGuard(db, value.event!, 'read'); return value.repetition!;
    }); },
    adopt(sourceId: string) {
      check(sourceId);
      const value = transaction(false, () => { requiredReservation(db, sourceId); return readAssessment(db, sourceId); });
      if (!value) return { kind: 'pending' as const, reason: 'assessment_missing' as const };
      if (!value.event) return { kind: 'not_relevant' as const };
      const before = value.reservation.episode;
      const after = development.advance(before.episodeId, value.event.sourceEventId, before.revision);
      transaction(false, () => evidenceGuard(db, value.event!, 'retry'));
      return freeze({ kind: 'recorded' as const, episode: after });
    },
    assessExposure(episodeId: string, revision: number, input: Omit<DevelopmentPracticeBundle, 'repetitions'>) {
      check(episodeId); return transaction(false, () => {
        const episode = readOwnedDevelopmentEpisode(development, db, episodeId, revision)?.episode;
        if (!episode) throw new Error('non-pitch exposure episode is missing');
        const repetitions = episode.practiceSourceEventIds.map(eventId => {
          const value = byEvent(db, eventId); evidenceGuard(db, value.event!, 'read'); return value.repetition!;
        });
        return assessDevelopmentPracticeExposure(episode, { ...input, repetitions });
      });
    },
    learningAuthority: Object.freeze({ readAcceptedLearningEvent(eventId: string) {
      check(eventId); return transaction(false, () => byEvent(db, eventId).event);
    } }),
    evidenceGuard,
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
