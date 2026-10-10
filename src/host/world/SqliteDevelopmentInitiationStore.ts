import { assertNonPitchLearningEvent } from './SqliteNonPitchRepetitionStore';
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
import { readOwnedPitchPracticeAttempt } from './SqlitePitchPracticeAttemptStore';
import { rosterDevelopmentOriginSchema, captureRosterDevelopmentOrigin, readRosterDevelopmentOrigin,
  readRosterDevelopmentBoundary, resolveRosterDevelopmentOrigin, type RosterDevelopmentOrigin } from './RosterDevelopmentOrigin';
import { actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { PRACTICE_DEVELOPMENT_KIND, capturePracticeOriginEvidence, practiceOriginRequest, practiceOriginRow,
  readPracticeDevelopmentBoundary, resolvePracticeDevelopmentOrigin, validatePracticeDevelopmentIntake, validatePracticeDevelopmentRequest,
  type PracticeDevelopmentRequest, type PracticeDevelopmentSources, type PracticeOrigin, type PracticeOriginRow } from './PracticeDevelopmentOrigin';

import { NATIONAL_EXPOSURE_DEVELOPMENT_KIND, captureNationalExposureEvidence, nationalExposureOriginRequest, nationalExposureOriginRow,
  readNationalExposureDevelopmentBoundary, resolveNationalExposureOrigin, validateNationalExposureIntake, validateNationalExposureRequest,
  type NationalExposureDevelopmentRequest, type NationalExposureDevelopmentSources, type NationalExposureOrigin, type NationalExposureOriginRow } from './NationalExposureDevelopmentOrigin';

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
  applyPractice(input: PracticeDevelopmentRequest): RecordedDevelopmentInitiation;
  applyNationalExposure(input: NationalExposureDevelopmentRequest): RecordedDevelopmentInitiation;
  archiveRosterOrigin(episodeId: string): RecordedDevelopmentInitiation;
  advance(episodeId: string, sourceId: string,
    expectedRevision: number): DevelopmentLearningEpisode;
  read(episodeId: string): RecordedDevelopmentInitiation | null;
  readAcceptedPrior(careerId: string, playerId: string,
    atDay: number): readonly RecordedDevelopmentInitiation[];
  close(): void;
}>;
const ownedEpisodeReaders = new WeakMap<object, (connection: DatabaseSync, episodeId: string,
  revision: number) => RecordedDevelopmentInitiation | null>();
/** The real owner replays only the frozen earlier prefix on the consumer's
 * Native connection. Later learning must not become an earlier practice cause. */
export const readOwnedDevelopmentEpisode = (owner: Pick<SqliteDevelopmentInitiationStore, 'read'>,
  connection: DatabaseSync, episodeId: string, revision: number): RecordedDevelopmentInitiation | null => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const reader = ownedEpisodeReaders.get(owner);
  if (!reader || !(connection instanceof Native) || !connection.isTransaction
    || !Number.isSafeInteger(revision) || revision < 0) throw new Error('development prefix requires its owned Native reader and transaction');
  return reader(connection, episodeId, revision);
};

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
  sources: Omit<DevelopmentAppraisalSources, 'history'> & Readonly<{ practice?: PracticeDevelopmentSources; nationalExposure?: NationalExposureDevelopmentSources }>,
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
  );
  CREATE TABLE IF NOT EXISTS world_development_practice_origins (
    episode_id TEXT PRIMARY KEY, career_id TEXT NOT NULL, player_id TEXT NOT NULL,
    discovery_event_id TEXT NOT NULL, motif_id TEXT NOT NULL, attempt_id TEXT NOT NULL,
    appraisal_source_id TEXT NOT NULL UNIQUE, source_version TEXT NOT NULL,
    origin_json TEXT NOT NULL, origin_hash TEXT NOT NULL,
    UNIQUE(career_id, player_id, discovery_event_id)
  );
  CREATE TABLE IF NOT EXISTS world_development_national_exposure_origins (
    episode_id TEXT PRIMARY KEY, career_id TEXT NOT NULL, player_id TEXT NOT NULL,
    game_id TEXT NOT NULL, participation_receipt_id TEXT NOT NULL UNIQUE, appraisal_source_id TEXT NOT NULL UNIQUE,
    source_version TEXT NOT NULL, origin_json TEXT NOT NULL, origin_hash TEXT NOT NULL,
    UNIQUE(career_id, game_id, player_id)
  );`);
  db.exec(rosterDevelopmentOriginSchema);
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
  const getOrigin = db.prepare('SELECT * FROM world_development_practice_origins WHERE episode_id=?');
  const getNationalOrigin = db.prepare('SELECT * FROM world_development_national_exposure_origins WHERE episode_id=?');
  const readPhysical = (attemptId: string) => {
    if (!sources.practice) throw new Error('practice development physical source owner is required');
    return readOwnedPitchPracticeAttempt(sources.practice.attempts, db, attemptId);
  };
  const resolve = (input: DevelopmentInitiationSourceRequest,
    prior: readonly RecordedDevelopmentInitiation[]) =>
    resolveDevelopmentEpisodeFromAcceptedAppraisal({ ...sources,
      history: { readAcceptedPrior: () => prior } }, input);
  const guardEvent: DevelopmentLearningEvidenceGuard = (connection, event, phase) => {
    assertNonPitchLearningEvent(api, connection, event, phase);
    evidenceGuard?.(connection, event, phase);
  };
  const readCurrent = (episodeId: string, revision?: number, connection: DatabaseSync = db): RecordedDevelopmentInitiation | null => {
    if (!id(episodeId)) throw new Error('invalid development episodeId');
    const get = connection.prepare('SELECT * FROM world_development_initiations WHERE episode_id=?');
    const getOrigin = connection.prepare('SELECT * FROM world_development_practice_origins WHERE episode_id=?');
    const getNationalOrigin = connection.prepare('SELECT * FROM world_development_national_exposure_origins WHERE episode_id=?');
    const row = get.get(episodeId) as InitiationRow | undefined;
    if (!row) {
      if (getOrigin.get(episodeId) || getNationalOrigin.get(episodeId)) throw new Error('orphan development origin');
      return null;
    }
    const request = JSON.parse(row.request_json) as
      DevelopmentInitiationSourceRequest & { kind?: unknown };
    const prior = JSON.parse(row.prior_json) as
      RecordedDevelopmentInitiation[];
    if (request.episodeId !== episodeId
      || request.appraisalSourceId !== row.appraisal_source_id
      || canonicalJson(request) !== row.request_json
      || canonicalJson(prior) !== row.prior_json) {
      throw new Error('corrupt development initiation source');
    }
    if (Object.hasOwn(request, 'kind') && request.kind !== PRACTICE_DEVELOPMENT_KIND && request.kind !== NATIONAL_EXPOSURE_DEVELOPMENT_KIND) {
      throw new Error('invalid development initiation source kind');
    }
    if ((request.kind !== PRACTICE_DEVELOPMENT_KIND && getOrigin.get(episodeId))
      || (request.kind !== NATIONAL_EXPOSURE_DEVELOPMENT_KIND && getNationalOrigin.get(episodeId))) throw new Error('development origin cannot use a different request kind');
    const initial = request.kind === PRACTICE_DEVELOPMENT_KIND
      ? readPracticeDevelopmentBoundary(connection, row, attemptId => {
        if (!sources.practice) throw new Error('practice development physical source owner is required');
        return readOwnedPitchPracticeAttempt(sources.practice.attempts, connection, attemptId);
      }).initial
      : request.kind === NATIONAL_EXPOSURE_DEVELOPMENT_KIND ? readNationalExposureDevelopmentBoundary(connection, row).initial
        : readRosterDevelopmentOrigin(connection, episodeId) ? readRosterDevelopmentBoundary(connection, row).initial : resolve(request, prior);
    if (initial.assessment.careerId !== row.career_id
      || initial.assessment.playerId !== row.player_id
      || initial.assessment.atDay !== row.at_day
      || canonicalJson(initial.assessment) !== row.assessment_json
      || canonicalJson(initial.episode) !== row.initial_json) {
      throw new Error('development initiation replay diverged');
    }
    let current = initial.episode;
    if (revision !== undefined && (revision < current.revision || revision > row.revision)) {
      throw new Error('development historical revision is unavailable');
    }
    const updates = (revision === undefined
      ? connection.prepare('SELECT * FROM world_development_learning_events WHERE episode_id=? ORDER BY after_revision').all(episodeId)
      : connection.prepare(`SELECT * FROM world_development_learning_events WHERE episode_id=?
        AND after_revision<=? ORDER BY after_revision`).all(episodeId, revision)) as LearningRow[];
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
      guardEvent(connection, event, 'read');
    }
    if ((revision ?? row.revision) !== current.revision
      || revision === undefined && canonicalJson(current) !== row.current_json) {
      throw new Error('development learning head diverged');
    }
    return Object.freeze({ assessment: initial.assessment,
      episode: current });
  };
  const readSnapshot = <T>(work: () => T): T => {
    if (db.isTransaction) return work();
    db.exec('BEGIN');
    try { const result = work(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const read = (episodeId: string) => readSnapshot(() => readCurrent(episodeId));
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
  const archiveRosterOrigin = (episodeId: string, accepted?: RosterDevelopmentOrigin): RecordedDevelopmentInitiation => {
    const row = get.get(episodeId) as InitiationRow | undefined;
    if (!row) throw new Error('roster development original episode is missing');
    const request = JSON.parse(row.request_json) as DevelopmentInitiationSourceRequest & { kind?: unknown };
    if (Object.hasOwn(request, 'kind')) throw new Error('roster development cannot replace another origin kind');
    const existing = readRosterDevelopmentOrigin(db, episodeId);
    if (existing) return readRosterDevelopmentBoundary(db, row).initial;
    const appraisal = accepted?.appraisal ?? sources.appraisal.readAcceptedAppraisal(request.appraisalSourceId);
    const policies = accepted?.policies ?? sources.policies.readAcceptedPolicies(request.policySourceId);
    if (!appraisal || !policies) throw new Error('original accepted roster appraisal/policy inputs are unavailable');
    const origin = accepted ?? captureRosterDevelopmentOrigin(request, appraisal, policies, JSON.parse(row.prior_json) as RecordedDevelopmentInitiation[]);
    db.prepare('INSERT INTO world_development_roster_origins VALUES(?,?,?,?)')
      .run(episodeId, request.appraisalSourceId, canonicalJson(origin), actorHash(origin));
    const saved = get.get(episodeId) as InitiationRow | undefined;
    if (!saved || canonicalJson(saved) !== canonicalJson(row)) throw new Error('roster development original initiation changed during archive admission');
    return readRosterDevelopmentBoundary(db, saved).initial;
  };
  const api: SqliteDevelopmentInitiationStore = Object.freeze({
    archiveRosterOrigin(episodeId: string) {
      if (!id(episodeId)) throw new Error('invalid roster development episode identity');
      return transaction(() => archiveRosterOrigin(episodeId));
    },
    applyNationalExposure(rawInput): RecordedDevelopmentInitiation {
      const input = validateNationalExposureRequest(rawInput);
      return transaction(() => {
        const existing = read(input.episodeId);
        const raw = sources.nationalExposure?.readAcceptedAppraisal(input.appraisalSourceId) ?? null;
        const policyInput = sources.policies.readAcceptedPolicies(input.policySourceId);
        if (existing) {
          const saved = getNationalOrigin.get(input.episodeId) as NationalExposureOriginRow | undefined;
          if (!saved) throw new Error('development episode already belongs to a different source');
          const origin = JSON.parse(saved.origin_json) as NationalExposureOrigin;
          if (canonicalJson(input) !== canonicalJson(origin.request)
            || raw !== null && canonicalJson(raw) !== canonicalJson(origin.appraisal)
            || policyInput !== null && canonicalJson(policyInput) !== canonicalJson(origin.policies)) {
            throw new Error('National exposure accepted source is frozen differently');
          }
          return existing;
        }
        if (!raw || !policyInput) throw new Error('accepted National exposure appraisal or policies are missing');
        const { appraisal, policies } = validateNationalExposureIntake(input, raw, policyInput);
        if (db.prepare('SELECT episode_id FROM world_development_national_exposure_origins WHERE participation_receipt_id=?')
          .get(input.participationReceiptId)) throw new Error('National participation exposure has already been consumed');
        const evidence = captureNationalExposureEvidence(db, input, appraisal);
        if (db.prepare('SELECT episode_id FROM world_development_national_exposure_origins WHERE career_id=? AND game_id=? AND player_id=?')
          .get(appraisal.careerId, evidence.receipt.binding.gameId, input.playerId)) throw new Error('National game Player exposure has already been consumed');
        const prior = readAcceptedPrior(appraisal.careerId, input.playerId, Number.MAX_SAFE_INTEGER);
        const origin: NationalExposureOrigin = { request: input, appraisal, policies, evidence, prior };
        const reserved = nationalExposureOriginRow(origin);
        const assertOrigin = () => {
          if (canonicalJson(getNationalOrigin.get(input.episodeId)) !== canonicalJson(reserved)
            || canonicalJson(captureNationalExposureEvidence(db, input, appraisal)) !== canonicalJson(evidence)) {
            throw new Error('National exposure source or reservation differs on writer');
          }
        };
        // A dismissed appraisal also consumes this actual game/Player fact.
        db.prepare(`INSERT INTO world_development_national_exposure_origins
          (episode_id,career_id,player_id,game_id,participation_receipt_id,appraisal_source_id,source_version,origin_json,origin_hash)
          VALUES (?,?,?,?,?,?,?,?,?)`).run(reserved.episode_id, reserved.career_id, reserved.player_id, reserved.game_id, reserved.participation_receipt_id,
          reserved.appraisal_source_id, reserved.source_version, reserved.origin_json, reserved.origin_hash);
        assertOrigin();
        const result = resolveNationalExposureOrigin(origin);
        const expected = { episode_id: input.episodeId, career_id: appraisal.careerId, player_id: input.playerId,
          at_day: appraisal.appraisal.atDay, appraisal_source_id: input.appraisalSourceId,
          request_json: canonicalJson(nationalExposureOriginRequest(origin)), prior_json: canonicalJson(prior),
          assessment_json: canonicalJson(result.assessment), initial_json: canonicalJson(result.episode),
          current_json: canonicalJson(result.episode), revision: result.episode.revision };
        db.prepare(`INSERT INTO world_development_initiations
          (episode_id,career_id,player_id,at_day,appraisal_source_id,request_json,prior_json,assessment_json,initial_json,current_json,revision)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(expected.episode_id, expected.career_id, expected.player_id, expected.at_day,
          expected.appraisal_source_id, expected.request_json, expected.prior_json, expected.assessment_json, expected.initial_json,
          expected.current_json, expected.revision);
        assertOrigin();
        if (canonicalJson(get.get(input.episodeId)) !== canonicalJson(expected)) throw new Error('National exposure written assessment differs');
        const replayed = read(input.episodeId)!;
        if (canonicalJson(replayed) !== canonicalJson(result)) throw new Error('National exposure written replay differs');
        return replayed;
      });
    },
    applyPractice(rawInput): RecordedDevelopmentInitiation {
      const input = validatePracticeDevelopmentRequest(rawInput);
      return transaction(() => {
        const existing = read(input.episodeId);
        const raw = sources.practice?.readAcceptedAppraisal?.(input.appraisalSourceId) ?? null;
        const policyInput = sources.policies.readAcceptedPolicies(input.policySourceId);
        if (existing) {
          const saved = getOrigin.get(input.episodeId) as PracticeOriginRow | undefined;
          if (!saved) throw new Error('development episode already belongs to a different source');
          const origin = JSON.parse(saved.origin_json) as PracticeOrigin;
          if (canonicalJson(input) !== canonicalJson(origin.request)
            || raw !== null && canonicalJson(raw) !== canonicalJson(origin.appraisal)
            || policyInput !== null && canonicalJson(policyInput) !== canonicalJson(origin.policies)) {
            throw new Error('practice development accepted source is frozen differently');
          }
          return existing;
        }
        if (!raw || !policyInput || !sources.practice) throw new Error('accepted practice appraisal or policies are missing');
        const { appraisal, policies } = validatePracticeDevelopmentIntake(input, raw, policyInput);
        if (db.prepare('SELECT episode_id FROM world_development_practice_origins WHERE career_id=? AND player_id=? AND discovery_event_id=?')
          .get(appraisal.careerId, input.playerId, appraisal.discovery.sourceEventId)) {
          throw new Error('canonical practice discovery has already been consumed');
        }
        const evidence = capturePracticeOriginEvidence(db, input, appraisal, readPhysical);
        const prior = readAcceptedPrior(appraisal.careerId, input.playerId, Number.MAX_SAFE_INTEGER);
        const origin: PracticeOrigin = { request: input, appraisal, policies, evidence, prior };
        const reserved = practiceOriginRow(origin);
        const assertOrigin = () => {
          if (canonicalJson(getOrigin.get(input.episodeId)) !== canonicalJson(reserved)
            || canonicalJson(capturePracticeOriginEvidence(db, input, appraisal, readPhysical)) !== canonicalJson(evidence)) {
            throw new Error('practice development source or reservation differs on writer');
          }
        };
        // Both engagement and dismissal consume this canonical event. The
        // reservation and assessment share the existing initiation transaction.
        db.prepare(`INSERT INTO world_development_practice_origins
          (episode_id,career_id,player_id,discovery_event_id,motif_id,attempt_id,appraisal_source_id,source_version,origin_json,origin_hash)
          VALUES (?,?,?,?,?,?,?,?,?,?)`).run(reserved.episode_id, reserved.career_id, reserved.player_id, reserved.discovery_event_id,
          reserved.motif_id, reserved.attempt_id, reserved.appraisal_source_id, reserved.source_version, reserved.origin_json, reserved.origin_hash);
        assertOrigin();
        const result = resolvePracticeDevelopmentOrigin(origin);
        const expected = { episode_id: input.episodeId, career_id: appraisal.careerId, player_id: input.playerId,
          at_day: appraisal.appraisal.atDay, appraisal_source_id: input.appraisalSourceId,
          request_json: canonicalJson(practiceOriginRequest(origin)), prior_json: canonicalJson(prior),
          assessment_json: canonicalJson(result.assessment), initial_json: canonicalJson(result.episode),
          current_json: canonicalJson(result.episode), revision: result.episode.revision };
        db.prepare(`INSERT INTO world_development_initiations
          (episode_id,career_id,player_id,at_day,appraisal_source_id,request_json,prior_json,assessment_json,initial_json,current_json,revision)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(expected.episode_id, expected.career_id, expected.player_id, expected.at_day,
          expected.appraisal_source_id, expected.request_json, expected.prior_json, expected.assessment_json, expected.initial_json,
          expected.current_json, expected.revision);
        assertOrigin();
        if (canonicalJson(get.get(input.episodeId)) !== canonicalJson(expected)) throw new Error('practice development written assessment differs');
        const replayed = read(input.episodeId)!;
        if (canonicalJson(replayed) !== canonicalJson(result)) throw new Error('practice development written replay differs');
        return replayed;
      });
    },
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
        const appraisal = cloneInert(sources.appraisal.readAcceptedAppraisal(
          input.appraisalSourceId));
        if (!appraisal) {
          throw new Error('accepted development appraisal is missing');
        }
        // Include all accepted earlier decisions. The core rejects future
        // assessments or learning states when this request is backdated.
        const prior = readAcceptedPrior(appraisal.careerId,
          appraisal.playerId, Number.MAX_SAFE_INTEGER);
        const persistedRoster = !!db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name='world_roster_executions'").get();
        const policies = persistedRoster ? sources.policies.readAcceptedPolicies(input.policySourceId) : null;
        if (persistedRoster && !policies) throw new Error('original accepted roster policies are unavailable');
        const origin = policies ? captureRosterDevelopmentOrigin(input, appraisal, policies, prior) : null;
        const result = origin ? resolveRosterDevelopmentOrigin(db, origin) : resolve(input, prior);
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
        // Actual persisted roster owners can preserve their independently
        // accepted inputs immediately. Legacy structural source contracts keep
        // their old bytes; the new Native gate requires explicit reacquisition.
        if (origin) archiveRosterOrigin(input.episodeId, origin);
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
          guardEvent(db, JSON.parse(prior.event_json) as
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
        guardEvent(db, event, 'write');
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
        guardEvent(db, event, 'written');
        return read(episodeId)!.episode;
      });
    },
    read, readAcceptedPrior,
    close(): void { if (!closed) { db.close(); closed = true; } },
  });
  ownedEpisodeReaders.set(api, (connection, episodeId, revision) => {
    if (closed) throw new Error('development initiation store is closed');
    return readCurrent(episodeId, revision, connection);
  });
  return api;
};
