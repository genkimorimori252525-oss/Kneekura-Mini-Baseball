import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { applyConsolidatedPitchTimingEvidence,
  createPlayerPitchTimingSource, selectPlayerPitchTimingProfile,
  type PitchTimingPracticeMeasurement,
  type PlayerPitchTimingSource } from
  '../../core/world/development/PlayerPitchTimingSource';
import type { DevelopmentLearningEpisode } from
  '../../core/world/development/DevelopmentLearningEpisode';
import { derivePitchTimingDevelopmentHistory,
  type PlayerDevelopmentHistoryEvent } from
  '../../core/world/development/PlayerDevelopmentHistory';
import type { DevelopmentPracticeBundle } from
  '../../core/world/development/DevelopmentPracticeExposure';
import type { PitchTimingProfile } from
  '../../core/sim/pitch/PitchTimingModel';
import type { AcceptedPlayerPersonLinkAuthority } from
  './SqliteFreeAgentContractStore';

export type AcceptedPitchTimingBaseline = Readonly<{
  sourceId: string;
  sourceVersion: string;
  careerId: string;
  playerId: string;
  personLinkSourceId: string;
  acceptedAtDay: number;
  profile: PitchTimingProfile;
}>;
export type AcceptedPitchTimingLearning = Readonly<{
  sourceId: string;
  episode: DevelopmentLearningEpisode;
  measurements: readonly PitchTimingPracticeMeasurement[];
  practice: DevelopmentPracticeBundle;
}>;
export type AcceptedPitchTimingAuthority = Readonly<{
  readAcceptedBaseline(sourceId: string):
    AcceptedPitchTimingBaseline | null;
  readAcceptedLearning(sourceId: string):
    AcceptedPitchTimingLearning | null;
}>;
export type SqlitePlayerPitchTimingStore = Readonly<{
  initialize(sourceId: string): PlayerPitchTimingSource;
  readHead(careerId: string, playerId: string):
    PlayerPitchTimingSource | null;
  readDevelopmentHistory(careerId: string, playerId: string):
    readonly PlayerDevelopmentHistoryEvent[] | null;
  selectProfile(careerId: string, playerId: string,
    atDay: number): PitchTimingProfile;
  selectProfileAtDay(careerId: string, playerId: string,
    atDay: number): PitchTimingProfile;
  apply(sourceId: string, expectedRevision: number):
    PlayerPitchTimingSource;
  close(): void;
}>;

type BaselineRow = { source_id: string;
  career_id: string; player_id: string;
  source_json: string; initial_json: string };
type HeadRow = { revision: number; state_json: string };
type UpdateRow = { source_id: string; career_id: string;
  player_id: string; before_revision: number;
  after_revision: number; source_json: string; state_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0)) : item);
const fields = (value: unknown, names: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === names.join('|');

/** One versioned, replayable pitch-timing source per global Player. */
export const openSqlitePlayerPitchTimingStore = (
  databasePath: string,
  personLinks: AcceptedPlayerPersonLinkAuthority,
  authority?: AcceptedPitchTimingAuthority | null,
): SqlitePlayerPitchTimingStore => {
  if (!id(databasePath) || !personLinks
    || typeof personLinks.readAcceptedPlayerPersonLink !== 'function'
    || (authority != null && (typeof authority.readAcceptedBaseline
      !== 'function' || typeof authority.readAcceptedLearning
        !== 'function'))) {
    throw new Error('invalid Player pitch timing sources');
  }
  const Database = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const db = new Database(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_pitch_timing_baselines (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL,
    player_id TEXT NOT NULL, source_json TEXT NOT NULL,
    initial_json TEXT NOT NULL, UNIQUE(career_id, player_id)
  );
  CREATE TABLE IF NOT EXISTS world_pitch_timing_heads (
    career_id TEXT NOT NULL, player_id TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK(revision >= 0),
    state_json TEXT NOT NULL, PRIMARY KEY(career_id, player_id)
  );
  CREATE TABLE IF NOT EXISTS world_pitch_timing_updates (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    before_revision INTEGER NOT NULL CHECK(before_revision >= 0),
    after_revision INTEGER NOT NULL CHECK(after_revision > before_revision),
    source_json TEXT NOT NULL, state_json TEXT NOT NULL,
    UNIQUE(career_id, player_id, after_revision),
    UNIQUE(career_id, player_id, source_id)
  );`);
  const getBaseline = db.prepare(`SELECT source_id, career_id, player_id,
    source_json, initial_json FROM world_pitch_timing_baselines
    WHERE career_id=? AND player_id=?`);
  const getBaselineBySource = db.prepare(`SELECT source_id, career_id, player_id,
    source_json, initial_json FROM world_pitch_timing_baselines
    WHERE source_id=?`);
  const getHead = db.prepare(`SELECT revision, state_json
    FROM world_pitch_timing_heads WHERE career_id=? AND player_id=?`);
  const getUpdates = db.prepare(`SELECT source_id, career_id,
    player_id, before_revision, after_revision, source_json, state_json
    FROM world_pitch_timing_updates WHERE career_id=? AND player_id=?
    ORDER BY after_revision`);
  const getUpdate = db.prepare(`SELECT source_id, career_id,
    player_id, before_revision, after_revision, source_json, state_json
    FROM world_pitch_timing_updates WHERE source_id=?`);
  const baseline = (careerId: string, playerId: string):
  BaselineRow | null => (getBaseline.get(careerId, playerId) as
    BaselineRow | undefined) ?? null;
  const head = (careerId: string, playerId: string): HeadRow | null =>
    (getHead.get(careerId, playerId) as HeadRow | undefined) ?? null;
  const validBaseline = (input: AcceptedPitchTimingBaseline | null,
    sourceId: string): input is AcceptedPitchTimingBaseline =>
    input !== null && fields(input, [
      'acceptedAtDay', 'careerId', 'personLinkSourceId', 'playerId',
      'profile', 'sourceId', 'sourceVersion',
    ]) && input.sourceId === sourceId && id(input.sourceVersion)
    && id(input.careerId) && id(input.playerId)
    && id(input.personLinkSourceId) && day(input.acceptedAtDay);
  const replay = (careerId: string,
    playerId: string): PlayerPitchTimingSource | null => {
    const stored = baseline(careerId, playerId);
    if (!stored) return null;
    const source = JSON.parse(stored.source_json) as
      AcceptedPitchTimingBaseline;
    const link = personLinks.readAcceptedPlayerPersonLink(
      source.personLinkSourceId);
    if (!validBaseline(source, source.sourceId)
      || source.careerId !== careerId || source.playerId !== playerId
      || stored.career_id !== careerId
      || stored.player_id !== playerId
      || stored.source_id !== source.sourceId
      || canonicalJson(source) !== stored.source_json
      || !link || link.careerId !== careerId
      || link.playerId !== playerId) {
      throw new Error('corrupt pitch timing baseline');
    }
    let current = createPlayerPitchTimingSource({ careerId,
      playerId, createdAtDay: source.acceptedAtDay,
      profile: source.profile });
    if (canonicalJson(current) !== stored.initial_json) {
      throw new Error('corrupt initial pitch timing source');
    }
    const updates = getUpdates.all(careerId, playerId) as UpdateRow[];
    for (const [index, update] of updates.entries()) {
      const accepted = JSON.parse(update.source_json) as
        AcceptedPitchTimingLearning;
      if (!fields(accepted, ['episode', 'measurements',
        'practice', 'sourceId'])
        || !id(accepted.sourceId)
        || accepted.sourceId !== update.source_id
        || update.career_id !== careerId
        || update.player_id !== playerId
        || update.before_revision !== index
        || update.after_revision !== index + 1
        || canonicalJson(accepted) !== update.source_json) {
        throw new Error('corrupt pitch timing learning source');
      }
      current = applyConsolidatedPitchTimingEvidence(current,
        index, accepted.episode, accepted.measurements,
        accepted.practice);
      if (canonicalJson(current) !== update.state_json) {
        throw new Error('pitch timing learning replay diverged');
      }
    }
    const durable = head(careerId, playerId);
    if (!durable || durable.revision !== current.revision
      || canonicalJson(current) !== durable.state_json) {
      throw new Error('pitch timing source head diverged');
    }
    return current;
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
    initialize(sourceId: string): PlayerPitchTimingSource {
      if (!id(sourceId)) throw new Error('invalid pitch timing baseline sourceId');
      return transaction(() => {
        const prior = getBaselineBySource.get(sourceId) as
          BaselineRow | undefined;
        if (prior) return replay(prior.career_id, prior.player_id)!;
        if (getUpdate.get(sourceId)) {
          throw new Error('pitch timing sourceId belongs to learning evidence');
        }
        if (!authority) {
          throw new Error('accepted pitch timing baseline authority is required');
        }
        const raw = authority.readAcceptedBaseline(sourceId);
        const source = raw === null ? null : cloneInert(raw);
        if (!validBaseline(source, sourceId)) {
          throw new Error('accepted pitch timing baseline is absent or invalid');
        }
        const link = personLinks.readAcceptedPlayerPersonLink(
          source.personLinkSourceId);
        if (!link || link.careerId !== source.careerId
          || link.playerId !== source.playerId) {
          throw new Error('pitch timing baseline lacks accepted Player Person link');
        }
        const initial = createPlayerPitchTimingSource({
          careerId: source.careerId, playerId: source.playerId,
          createdAtDay: source.acceptedAtDay, profile: source.profile,
        });
        db.prepare(`INSERT INTO world_pitch_timing_baselines
          (source_id, career_id, player_id, source_json, initial_json)
          VALUES (?, ?, ?, ?, ?)`).run(sourceId,
            source.careerId, source.playerId,
            canonicalJson(source), canonicalJson(initial));
        db.prepare(`INSERT INTO world_pitch_timing_heads
          (career_id, player_id, revision, state_json)
          VALUES (?, ?, 0, ?)`).run(source.careerId,
            source.playerId, canonicalJson(initial));
        return replay(source.careerId, source.playerId)!;
      });
    },
    readHead(careerId: string,
      playerId: string): PlayerPitchTimingSource | null {
      if (!id(careerId) || !id(playerId)) {
        throw new Error('invalid pitch timing source scope');
      }
      return replay(careerId, playerId);
    },
    readDevelopmentHistory(careerId: string,
      playerId: string): readonly PlayerDevelopmentHistoryEvent[] | null {
      if (!id(careerId) || !id(playerId)) {
        throw new Error('invalid pitch timing development history scope');
      }
      const source = replay(careerId, playerId);
      if (!source) return null;
      const episodes = (getUpdates.all(careerId, playerId) as UpdateRow[])
        .map((row) => (JSON.parse(row.source_json) as
          AcceptedPitchTimingLearning).episode);
      return derivePitchTimingDevelopmentHistory(source, episodes);
    },
    selectProfile(careerId: string, playerId: string,
      atDay: number): PitchTimingProfile {
      if (!id(careerId) || !id(playerId)) {
        throw new Error('invalid pitch timing source scope');
      }
      const current = replay(careerId, playerId);
      if (!current) throw new Error('pitch timing source is missing');
      return selectPlayerPitchTimingProfile(current, playerId, atDay);
    },
    selectProfileAtDay(careerId: string, playerId: string,
      atDay: number): PitchTimingProfile {
      if (!id(careerId) || !id(playerId) || !day(atDay)) {
        throw new Error('invalid historical pitch timing scope');
      }
      // Replay validates every accepted update before historical selection.
      if (!replay(careerId, playerId)) {
        throw new Error('pitch timing source is missing');
      }
      const initial = baseline(careerId, playerId)!;
      let selected = JSON.parse(initial.initial_json) as
        PlayerPitchTimingSource;
      for (const row of getUpdates.all(careerId,
        playerId) as UpdateRow[]) {
        const candidate = JSON.parse(row.state_json) as
          PlayerPitchTimingSource;
        if (candidate.effectiveDay > atDay) break;
        selected = candidate;
      }
      return selectPlayerPitchTimingProfile(selected,
        playerId, atDay);
    },
    apply(sourceId: string,
      expectedRevision: number): PlayerPitchTimingSource {
      if (!id(sourceId) || !day(expectedRevision)) {
        throw new Error('invalid pitch timing learning scope');
      }
      return transaction(() => {
        const prior = getUpdate.get(sourceId) as UpdateRow | undefined;
        if (prior) {
          if (prior.before_revision !== expectedRevision) {
            throw new Error('pitch timing sourceId retry revision differs');
          }
          replay(prior.career_id, prior.player_id);
          return JSON.parse(prior.state_json) as PlayerPitchTimingSource;
        }
        if (getBaselineBySource.get(sourceId)) {
          throw new Error('pitch timing sourceId belongs to baseline');
        }
        if (!authority) {
          throw new Error('accepted pitch timing learning authority is required');
        }
        const raw = authority.readAcceptedLearning(sourceId);
        const accepted = raw === null ? null : cloneInert(raw);
        if (!accepted || !fields(accepted,
          ['episode', 'measurements', 'practice', 'sourceId'])
          || accepted.sourceId !== sourceId) {
          throw new Error('accepted pitch timing learning is absent or invalid');
        }
        const { careerId, playerId } = accepted.episode;
        if (!id(careerId) || !id(playerId)) {
          throw new Error('invalid pitch timing learning Player');
        }
        const before = replay(careerId, playerId);
        if (!before) throw new Error('pitch timing baseline is missing');
        const after = applyConsolidatedPitchTimingEvidence(before,
          expectedRevision, accepted.episode,
          accepted.measurements, accepted.practice);
        db.prepare(`INSERT INTO world_pitch_timing_updates
          (source_id, career_id, player_id, before_revision,
           after_revision, source_json, state_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)`).run(sourceId,
            careerId, playerId, before.revision, after.revision,
            canonicalJson(accepted), canonicalJson(after));
        const updated = db.prepare(`UPDATE world_pitch_timing_heads
          SET revision=?, state_json=? WHERE career_id=?
          AND player_id=? AND revision=? AND state_json=?`)
          .run(after.revision, canonicalJson(after), careerId,
            playerId, before.revision, canonicalJson(before));
        if (updated.changes !== 1) {
          throw new Error('pitch timing source CAS failed');
        }
        return replay(careerId, playerId)!;
      });
    },
    close(): void { if (!closed) { db.close(); closed = true; } },
  });
};
