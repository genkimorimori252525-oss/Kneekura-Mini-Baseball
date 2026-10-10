import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { assessDevelopmentPracticeExposure, type DevelopmentPracticeBundle, type DevelopmentPracticeRepetition } from '../../core/world/development/DevelopmentPracticeExposure';
import { readOwnedDevelopmentEpisode, type SqliteDevelopmentInitiationStore } from './SqliteDevelopmentInitiationStore';
import { readOwnedPitchPracticeRepetition, type SqlitePitchPracticeAttemptStore } from './SqlitePitchPracticeAttemptStore';
import { readOwnedNonPitchRepetition } from './SqliteNonPitchRepetitionStore';
import { isNonPitchRepetitionEvent, nonPitchFields as fields, nonPitchId as id } from './NonPitchDevelopmentRepetition';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type PitchFactors = Omit<DevelopmentPracticeRepetition, 'atDay' | 'fatigue' | 'healthAvailability'>;
/** Explicit accepted coefficients; original owners supply occurrence, chronology,
 * health and fatigue. This Source neither measures nor changes an ability. */
export type AcceptedDevelopmentPracticeExposure = Readonly<{
  sourceId: string; sourceVersion: string; episodeId: string; episodeRevision: number;
  policy: DevelopmentPracticeBundle['policy']; prior: DevelopmentPracticeBundle['prior'];
  pitchFactors: readonly PitchFactors[];
  provenance: Readonly<{ assessmentSourceId: string; assessmentVersion: string; calibrationSourceId: string; calibrationVersion: string }>;
}>;
export type DevelopmentPracticeExposureOwners = Readonly<{
  development: Pick<SqliteDevelopmentInitiationStore, 'read'>;
  pitchPractice?: Pick<SqlitePitchPracticeAttemptStore, 'read'>;
}>;
const input = (raw: unknown, sourceId: string): AcceptedDevelopmentPracticeExposure => {
  const value = cloneInert(raw) as AcceptedDevelopmentPracticeExposure;
  if (!fields(value, ['sourceId', 'sourceVersion', 'episodeId', 'episodeRevision', 'policy', 'prior', 'pitchFactors', 'provenance'])
    || value.sourceId !== sourceId || ![value.sourceId, value.sourceVersion, value.episodeId].every(id)
    || !Number.isSafeInteger(value.episodeRevision) || value.episodeRevision < 0 || !Array.isArray(value.pitchFactors)
    || !fields(value.provenance, ['assessmentSourceId', 'assessmentVersion', 'calibrationSourceId', 'calibrationVersion'])
    || !Object.values(value.provenance).every(id)) throw new Error('invalid accepted practice exposure Source');
  const factors: readonly PitchFactors[] = value.pitchFactors;
  const names = ['trainingStimulus', 'coachingFit', 'challengeFit', 'motivation', 'opportunity', 'novelty'] as const;
  if (new Set(factors.map(item => item.sourceEventId)).size !== factors.length || factors.some(item =>
    !fields(item, ['sourceEventId', ...names]) || !id(item.sourceEventId) || names.some(name =>
      typeof item[name] !== 'number' || !Number.isFinite(item[name]) || item[name] < 0 || item[name] > 1))) {
    throw new Error('invalid explicit pitch exposure coefficients');
  }
  return freeze(value);
};

/** One ordered, complete episode bundle, authenticated on the consumer's Native
 * snapshot. Different repetition owners cannot substitute for one another. */
const derive = (db: DatabaseSync, owners: DevelopmentPracticeExposureOwners, source: AcceptedDevelopmentPracticeExposure) => {
  const episode = readOwnedDevelopmentEpisode(owners.development, db, source.episodeId, source.episodeRevision)?.episode;
  if (!episode || episode.stage !== 'CONSOLIDATED') throw new Error('practice exposure original consolidated episode is missing');
  const factors = new Map(source.pitchFactors.map(item => [item.sourceEventId, item])), proofs: unknown[] = [];
  const repetitions = episode.practiceSourceEventIds.map(eventId => {
    const event = episode.events.find(value => value.sourceEventId === eventId && value.kind === 'PRACTICE_RECORDED');
    if (!event) throw new Error('practice exposure original episode event is missing');
    if (isNonPitchRepetitionEvent(event)) {
      const owned = readOwnedNonPitchRepetition(owners.development, db, eventId);
      if (factors.has(eventId) || owned.episodeId !== episode.episodeId || owned.careerId !== episode.careerId
        || owned.playerId !== episode.playerId || json(owned.event) !== json(event)) throw new Error('practice exposure non-pitch ownership differs');
      proofs.push({ eventId, kind: 'NON_PITCH', hash: owned.proofHash }); return owned.repetition;
    }
    if (!eventId.startsWith('practice-workload:pitch-practice:') || !owners.pitchPractice) {
      throw new Error('practice exposure repetition owner is unsupported or missing');
    }
    const coefficients = factors.get(eventId), owned = readOwnedPitchPracticeRepetition(owners.pitchPractice, db, eventId);
    if (!coefficients || owned.episodeId !== episode.episodeId || owned.careerId !== episode.careerId
      || owned.playerId !== episode.playerId || json(owned.event) !== json(event)) throw new Error('practice exposure pitch ownership or coefficients differ');
    factors.delete(eventId); proofs.push({ eventId, kind: 'PITCH', hash: owned.proofHash });
    return { ...coefficients, atDay: event.atDay, fatigue: owned.fatigue, healthAvailability: owned.healthAvailability };
  });
  if (factors.size) throw new Error('practice exposure has unconsumed pitch coefficients');
  const bundle = { policy: source.policy, prior: source.prior, repetitions };
  const assessment = assessDevelopmentPracticeExposure(episode, bundle);
  return freeze({ source, episode, proofs, bundle, assessment });
};
export type DurableDevelopmentPracticeExposure = ReturnType<typeof derive>;
type Row = { source_id: string; episode_id: string; episode_revision: number; source_json: string; snapshot_json: string; snapshot_hash: string };
export const openSqliteDevelopmentPracticeExposureStore = (path: string, owners: DevelopmentPracticeExposureOwners,
  authority?: Readonly<{ readAcceptedExposure(sourceId: string): AcceptedDevelopmentPracticeExposure | null }>) => {
  if (!id(path) || !owners?.development || typeof owners.development.read !== 'function'
    || authority !== undefined && typeof authority.readAcceptedExposure !== 'function') throw new Error('invalid practice exposure owners');
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new Native(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS development_practice_exposures(source_id TEXT PRIMARY KEY,episode_id TEXT NOT NULL,
      episode_revision INTEGER NOT NULL,source_json TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL);`);
  let closed = false;
  const transaction = <T>(write: boolean, body: () => T): T => {
    if (closed) throw new Error('closed practice exposure owner'); db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN');
    try { const value = body(); db.exec('COMMIT'); return value; } catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const read = (sourceId: string): DurableDevelopmentPracticeExposure | null => {
    if (!id(sourceId)) throw new Error('invalid practice exposure identity');
    const rows = db.prepare(`SELECT * FROM development_practice_exposures WHERE source_id=$id
      OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id: sourceId }) as Row[];
    if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('practice exposure Source ownership differs');
    const row = rows[0]; if (!row) return null;
    const source = input(JSON.parse(row.source_json), sourceId), value = derive(db, owners, source);
    if (row.episode_id !== source.episodeId || row.episode_revision !== source.episodeRevision || row.source_json !== json(source)
      || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('practice exposure original archive differs');
    return value;
  };
  return Object.freeze({
    accept(sourceId: string): DurableDevelopmentPracticeExposure {
      if (!id(sourceId)) throw new Error('invalid practice exposure identity');
      const raw = authority?.readAcceptedExposure(sourceId) ?? null, source = raw === null ? null : input(raw, sourceId);
      return transaction(true, () => {
        const prior = read(sourceId);
        if (prior) { if (source && json(source) !== json(prior.source)) throw new Error('practice exposure Source changed'); return prior; }
        if (!source) throw new Error('accepted practice exposure Source is missing');
        const value = derive(db, owners, source);
        db.prepare('INSERT INTO development_practice_exposures VALUES(?,?,?,?,?,?)').run(sourceId, source.episodeId,
          source.episodeRevision, json(source), json(value), hash(value));
        const saved = read(sourceId);
        if (json(saved) !== json(value)) throw new Error('practice exposure original owners changed during INSERT');
        return saved!;
      });
    },
    read(sourceId: string) { return transaction(false, () => read(sourceId)); },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
