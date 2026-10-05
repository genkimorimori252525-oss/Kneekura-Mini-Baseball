import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { appendDevelopmentLearningEvent,
  type DevelopmentLearningEventInput,
  type DevelopmentLearningEpisode } from
  '../../core/world/development/DevelopmentLearningEpisode';
import type { RecordedDevelopmentInitiation } from
  '../../core/world/development/DevelopmentInitiationHistory';
import { resolveDevelopmentEpisodeFromAcceptedAppraisal,
  type DevelopmentAppraisalSources } from
  './DevelopmentEpisodeFromAcceptedAppraisal';

export type DevelopmentInitiationSourceRequest = Readonly<{
  episodeId: string;
  executionId: string;
  playerId: string;
  personSourceId: string;
  appraisalSourceId: string;
  policySourceId: string;
}>;
export type AcceptedDevelopmentLearningAuthority = Readonly<{
  readAcceptedLearningEvent(sourceId: string):
    DevelopmentLearningEventInput | null;
}>;
export type DevelopmentLearningEvidenceGuard = (
  database: Pick<DatabaseSync, 'prepare'>,
  event: DevelopmentLearningEventInput,
  phase: 'write' | 'written' | 'read' | 'retry',
) => void;
export type SqliteDevelopmentInitiationStore = Readonly<{
  apply(input: DevelopmentInitiationSourceRequest):
    RecordedDevelopmentInitiation;
  advance(episodeId: string, sourceId: string,
    expectedRevision: number): DevelopmentLearningEpisode;
  read(episodeId: string): RecordedDevelopmentInitiation | null;
  readAcceptedPrior(careerId: string, playerId: string,
    atDay: number): readonly RecordedDevelopmentInitiation[];
  close(): void;
}>;

type InitiationRow = { episode_id: string; career_id: string;
  player_id: string; at_day: number;
  appraisal_source_id: string; request_json: string;
  prior_json: string; assessment_json: string;
  initial_json: string; current_json: string; revision: number };
type LearningRow = { source_id: string; episode_id: string;
  before_revision: number; after_revision: number;
  event_json: string; state_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0)) : item);

/** Durable episode assessment and accepted learning progression for one Career. */
export const openSqliteDevelopmentInitiationStore = (
  databasePath: string,
  sources: Omit<DevelopmentAppraisalSources, 'history'>,
  learningAuthority?: AcceptedDevelopmentLearningAuthority | null,
  evidenceGuard?: DevelopmentLearningEvidenceGuard,
): SqliteDevelopmentInitiationStore => {
  if (!id(databasePath) || !sources?.roster || !sources.person
    || !sources.appraisal || !sources.policies
    || (learningAuthority != null
      && typeof learningAuthority.readAcceptedLearningEvent
        !== 'function')
    || (evidenceGuard !== undefined && typeof evidenceGuard !== 'function')) {
    throw new Error('invalid development initiation sources');
  }
  const Database = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const db = new Database(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_development_initiations (
    episode_id TEXT PRIMARY KEY, career_id TEXT NOT NULL,
    player_id TEXT NOT NULL, at_day INTEGER NOT NULL CHECK(at_day >= 0),
    appraisal_source_id TEXT NOT NULL UNIQUE,
    request_json TEXT NOT NULL, prior_json TEXT NOT NULL,
    assessment_json TEXT NOT NULL, initial_json TEXT NOT NULL,
    current_json TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK(revision >= 1)
  );
  CREATE TABLE IF NOT EXISTS world_development_learning_events (
    source_id TEXT PRIMARY KEY, episode_id TEXT NOT NULL,
    before_revision INTEGER NOT NULL CHECK(before_revision >= 1),
    after_revision INTEGER NOT NULL CHECK(after_revision > before_revision),
    event_json TEXT NOT NULL, state_json TEXT NOT NULL,
    UNIQUE(episode_id, after_revision)
  );`);
  const get = db.prepare(`SELECT * FROM world_development_initiations
    WHERE episode_id=?`);
  const getPrior = db.prepare(`SELECT episode_id FROM
    world_development_initiations WHERE career_id=? AND player_id=?
    AND at_day<=? ORDER BY at_day, episode_id`);
  const getLearning = db.prepare(`SELECT * FROM
    world_development_learning_events WHERE episode_id=?
    ORDER BY after_revision`);
  const getLearningSource = db.prepare(`SELECT * FROM
    world_development_learning_events WHERE source_id=?`);
  const resolve = (input: DevelopmentInitiationSourceRequest,
    prior: readonly RecordedDevelopmentInitiation[]) =>
    resolveDevelopmentEpisodeFromAcceptedAppraisal({ ...sources,
      history: { readAcceptedPrior: () => prior } }, input);
  const read = (episodeId: string): RecordedDevelopmentInitiation | null => {
    if (!id(episodeId)) throw new Error('invalid development episodeId');
    const row = get.get(episodeId) as InitiationRow | undefined;
    if (!row) return null;
    const request = JSON.parse(row.request_json) as
      DevelopmentInitiationSourceRequest;
    const prior = JSON.parse(row.prior_json) as
      RecordedDevelopmentInitiation[];
    if (request.episodeId !== episodeId
      || request.appraisalSourceId !== row.appraisal_source_id
      || canonicalJson(request) !== row.request_json
      || canonicalJson(prior) !== row.prior_json) {
      throw new Error('corrupt development initiation source');
    }
    const initial = resolve(request, prior);
    if (initial.assessment.careerId !== row.career_id
      || initial.assessment.playerId !== row.player_id
      || initial.assessment.atDay !== row.at_day
      || canonicalJson(initial.assessment) !== row.assessment_json
      || canonicalJson(initial.episode) !== row.initial_json) {
      throw new Error('development initiation replay diverged');
    }
    let current = initial.episode;
    const updates = getLearning.all(episodeId) as LearningRow[];
    for (const update of updates) {
      const event = JSON.parse(update.event_json) as
        DevelopmentLearningEventInput;
      if (update.episode_id !== episodeId
        || update.before_revision !== current.revision
        || update.after_revision !== current.revision + 1
        || !id(update.source_id)
        || canonicalJson(event) !== update.event_json) {
        throw new Error('corrupt development learning source');
      }
      current = appendDevelopmentLearningEvent(current,
        current.revision, event);
      if (canonicalJson(current) !== update.state_json) {
        throw new Error('development learning replay diverged');
      }
      evidenceGuard?.(db, event, 'read');
    }
    if (row.revision !== current.revision
      || canonicalJson(current) !== row.current_json) {
      throw new Error('development learning head diverged');
    }
    return Object.freeze({ assessment: initial.assessment,
      episode: current });
  };
  const readAcceptedPrior = (careerId: string, playerId: string,
    atDay: number): readonly RecordedDevelopmentInitiation[] => {
    if (!id(careerId) || !id(playerId) || !day(atDay)) {
      throw new Error('invalid development initiation history scope');
    }
    return Object.freeze((getPrior.all(careerId, playerId,
      atDay) as Pick<InitiationRow, 'episode_id'>[])
      .map(row => {
        const verified = read(row.episode_id)!;
        const stored = get.get(row.episode_id) as InitiationRow;
        let episode = JSON.parse(stored.initial_json) as
          DevelopmentLearningEpisode;
        for (const update of getLearning.all(row.episode_id) as
        LearningRow[]) {
          const event = JSON.parse(update.event_json) as
            DevelopmentLearningEventInput;
          if (event.atDay > atDay) break;
          episode = appendDevelopmentLearningEvent(episode,
            episode.revision, event);
        }
        return Object.freeze({ assessment: verified.assessment,
          episode });
      }));
  };
  const transaction = <T>(work: () => T): T => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  let closed = false;
  return Object.freeze({
    apply(input: DevelopmentInitiationSourceRequest):
    RecordedDevelopmentInitiation {
      if (!input || !id(input.episodeId)
        || !id(input.appraisalSourceId)) {
        throw new Error('invalid development initiation request source');
      }
      return transaction(() => {
        const existing = read(input.episodeId);
        if (existing) {
          const row = get.get(input.episodeId) as InitiationRow;
          if (canonicalJson(input) !== row.request_json) {
            throw new Error('development episode retry source differs');
          }
          return existing;
        }
        const appraisal = sources.appraisal.readAcceptedAppraisal(
          input.appraisalSourceId);
        if (!appraisal) {
          throw new Error('accepted development appraisal is missing');
        }
        // Include all accepted earlier decisions. The core rejects future
        // assessments or learning states when this request is backdated.
        const prior = readAcceptedPrior(appraisal.careerId,
          appraisal.playerId, Number.MAX_SAFE_INTEGER);
        const result = resolve(input, prior);
        db.prepare(`INSERT INTO world_development_initiations
          (episode_id, career_id, player_id, at_day,
           appraisal_source_id, request_json, prior_json,
           assessment_json, initial_json, current_json, revision)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            input.episodeId, result.assessment.careerId,
            result.assessment.playerId, result.assessment.atDay,
            input.appraisalSourceId, canonicalJson(input),
            canonicalJson(prior), canonicalJson(result.assessment),
            canonicalJson(result.episode),
            canonicalJson(result.episode), result.episode.revision);
        return read(input.episodeId)!;
      });
    },
    advance(episodeId: string, sourceId: string,
      expectedRevision: number): DevelopmentLearningEpisode {
      if (!id(episodeId) || !id(sourceId)
        || !day(expectedRevision)) {
        throw new Error('invalid development learning scope');
      }
      return transaction(() => {
        const prior = getLearningSource.get(sourceId) as
          LearningRow | undefined;
        if (prior) {
          if (prior.episode_id !== episodeId
            || prior.before_revision !== expectedRevision) {
            throw new Error('development learning source retry differs');
          }
          read(episodeId);
          evidenceGuard?.(db, JSON.parse(prior.event_json) as
            DevelopmentLearningEventInput, 'retry');
          return JSON.parse(prior.state_json) as
            DevelopmentLearningEpisode;
        }
        const current = read(episodeId);
        if (!current) throw new Error('development episode is missing');
        if (!learningAuthority) {
          throw new Error('accepted development learning authority is required');
        }
        const raw = learningAuthority.readAcceptedLearningEvent(sourceId);
        if (!raw) {
          throw new Error('accepted development learning event is missing');
        }
        const event = cloneInert(raw);
        const after = appendDevelopmentLearningEvent(current.episode,
          expectedRevision, event);
        evidenceGuard?.(db, event, 'write');
        db.prepare(`INSERT INTO world_development_learning_events
          (source_id, episode_id, before_revision, after_revision,
           event_json, state_json) VALUES (?, ?, ?, ?, ?, ?)`).run(
            sourceId, episodeId, current.episode.revision,
            after.revision, canonicalJson(event), canonicalJson(after));
        const updated = db.prepare(`UPDATE world_development_initiations
          SET current_json=?, revision=? WHERE episode_id=?
          AND revision=? AND current_json=?`).run(
            canonicalJson(after), after.revision, episodeId,
            current.episode.revision, canonicalJson(current.episode));
        if (updated.changes !== 1) {
          throw new Error('development learning CAS failed');
        }
        evidenceGuard?.(db, event, 'written');
        return read(episodeId)!.episode;
      });
    },
    read, readAcceptedPrior,
    close(): void { if (!closed) { db.close(); closed = true; } },
  });
};
