import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { playerPersonLinkEvidenceFromSqlite } from './SqlitePlayerPersonLinkStore';
import { nominalTable, nominalIdentity, nominalClaim, assertNominalReference, nominalSame } from './DispatchNominalSqliteOwnership';
import { sqliteJsonMetadataNodes as metadataNodes } from './SqliteOwnershipMetadata';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
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
export type PitchTimingEvidenceGuard = (db: Pick<DatabaseSync, 'prepare'>, source: AcceptedPitchTimingLearning,
  phase: 'write' | 'written' | 'retry' | 'read') => void;
export type DurablePitchTimingDevelopmentEvidence = Readonly<{
  source: PlayerPitchTimingSource;
  episodes: readonly DevelopmentLearningEpisode[];
}>;
export type SqlitePlayerPitchTimingStore = Readonly<{
  initialize(sourceId: string): PlayerPitchTimingSource;
  readHead(careerId: string, playerId: string):
    PlayerPitchTimingSource | null;
  /** Authenticates only the immutable prefix needed by an earlier physical proof. */
  selectAtRevision(careerId: string, playerId: string, revision: number): PlayerPitchTimingSource;
  readDevelopmentHistory(careerId: string, playerId: string):
    readonly PlayerDevelopmentHistoryEvent[] | null;
  readDevelopmentEvidenceAtDay(careerId: string, playerId: string,
    atDay: number): DurablePitchTimingDevelopmentEvidence | null;
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

/** Additive bounded normal-owner reader. It never opens a writer, follows a
 * current head or parses payloads after the explicitly pinned endpoint. */
const replayPlayerPitchTimingPrefixFromSqlite = (db: DatabaseSync,
  ref: SamePaReference<'world_pitch_timing_baselines' | 'world_pitch_timing_updates'>) => {
  const tables = ['world_pitch_timing_baselines', 'world_pitch_timing_updates'];
  const endpoint = nominalIdentity(db, tables, ref.owner, ref.sourceId), endpointSource = JSON.parse(String(endpoint.source_json));
  const cut = ref.owner === tables[0] ? 0 : endpoint.after_revision;
  if (!day(cut)) throw new Error('invalid dispatch nominal timing cut');
  const careerId = String(endpoint.career_id), playerId = String(endpoint.player_id);
  const scope = `(career_id=$career OR ${nominalClaim('source_json', ['careerId'], '$career')} OR ${nominalClaim('source_json', ['episode', 'careerId'], '$career')})
    AND (player_id=$player OR ${nominalClaim('source_json', ['playerId'], '$player')} OR ${nominalClaim('source_json', ['episode', 'playerId'], '$player')})`;
  const bases = db.prepare(`SELECT * FROM main.world_pitch_timing_baselines WHERE ${scope}`).all({ career: careerId, player: playerId });
  if (bases.length !== 1) throw new Error('dispatch nominal timing baseline is missing or ambiguous');
  const row = bases[0], source = JSON.parse(String(row.source_json)) as AcceptedPitchTimingBaseline;
  if (!fields(source, ['acceptedAtDay', 'careerId', 'personLinkSourceId', 'playerId', 'profile', 'sourceId', 'sourceVersion'])
    || ![source.sourceId, source.sourceVersion, source.personLinkSourceId].every(id) || !day(source.acceptedAtDay)
    || source.careerId !== careerId || source.playerId !== playerId || row.career_id !== careerId || row.player_id !== playerId
    || row.source_id !== source.sourceId || canonicalJson(source) !== row.source_json) throw new Error('corrupt dispatch nominal timing baseline');
  nominalIdentity(db, tables, tables[0], source.sourceId);
  const person = playerPersonLinkEvidenceFromSqlite(db).readLink(source.personLinkSourceId);
  if (!person || person.careerId !== careerId || person.playerId !== playerId || person.acceptedAtDay > source.acceptedAtDay) throw new Error('dispatch nominal timing Person differs');
  let current = createPlayerPitchTimingSource({ careerId, playerId, createdAtDay: source.acceptedAtDay, profile: source.profile });
  if (canonicalJson(current) !== row.initial_json) throw new Error('corrupt initial dispatch nominal timing state');
  const states = [current];
  const rawCut = `EXISTS(SELECT 1 FROM (${metadataNodes('state_json', ['revision'])}) n WHERE n.type IN ('integer','real') AND n.atom<=$cut)`;
  const updates = db.prepare(`SELECT * FROM main.world_pitch_timing_updates WHERE (${scope}
    OR ((${nominalClaim('state_json', ['careerId'], '$career')}) AND (${nominalClaim('state_json', ['playerId'], '$player')})))
    AND (after_revision<=$cut OR before_revision<$cut OR ${rawCut}) ORDER BY after_revision`).all({ career: careerId, player: playerId, cut });
  for (const [index, update] of updates.entries()) {
    const accepted = JSON.parse(String(update.source_json)) as AcceptedPitchTimingLearning;
    if (!fields(accepted, ['episode', 'measurements', 'practice', 'sourceId']) || !id(accepted.sourceId) || accepted.sourceId !== update.source_id
      || update.career_id !== careerId || update.player_id !== playerId || update.before_revision !== index || update.after_revision !== index + 1
      || canonicalJson(accepted) !== update.source_json || index + 1 > cut) throw new Error('corrupt dispatch nominal timing learning prefix');
    nominalIdentity(db, tables, tables[1], accepted.sourceId);
    current = applyConsolidatedPitchTimingEvidence(current, index, accepted.episode, accepted.measurements, accepted.practice);
    if (canonicalJson(current) !== update.state_json) throw new Error('dispatch nominal timing prefix replay diverged');
    states.push(current);
  }
  if (current.revision !== cut) throw new Error('dispatch nominal timing endpoint is missing');
  nominalSame(endpoint, cut === 0 ? row : updates.at(-1));
  assertNominalReference(ref, endpointSource, current, tables); return { source: current, states };
};

export const readPlayerPitchTimingPrefixFromSqlite = (db: DatabaseSync,
  ref: SamePaReference<'world_pitch_timing_baselines' | 'world_pitch_timing_updates'>): PlayerPitchTimingSource =>
  replayPlayerPitchTimingPrefixFromSqlite(db, ref).source;

/** The endpoint hash covers its full prefix; later-day states inside that pin
 * are authenticated but cannot supply this earlier game's numerical profile. */
export const selectPlayerPitchTimingProfileFromSqlitePrefix = (db: DatabaseSync,
  ref: SamePaReference<'world_pitch_timing_baselines' | 'world_pitch_timing_updates'>, atDay: number): PitchTimingProfile => {
  const proof = replayPlayerPitchTimingPrefixFromSqlite(db, ref), selected = proof.states.filter(s => s.effectiveDay <= atDay).at(-1);
  if (!selected) throw new Error('dispatch nominal timing unavailable at game day');
  return selectPlayerPitchTimingProfile(selected, proof.source.playerId, atDay);
};

/** Fresh acceptance only. Normal current history and head must agree; another
 * applicable revision beyond the immutable pin cannot be silently ignored. */
export const assertCurrentPlayerPitchTimingPrefixFromSqlite = (db: DatabaseSync,
  ref: SamePaReference<'world_pitch_timing_baselines' | 'world_pitch_timing_updates'>, atDay: number): void => {
  const pinned = replayPlayerPitchTimingPrefixFromSqlite(db, ref).source;
  nominalTable(db, 'world_pitch_timing_heads');
  const heads = db.prepare(`SELECT * FROM main.world_pitch_timing_heads WHERE (career_id=$career OR ${nominalClaim('state_json', ['careerId'], '$career')})
    AND (player_id=$player OR ${nominalClaim('state_json', ['playerId'], '$player')})`).all({ career: pinned.careerId, player: pinned.playerId });
  if (heads.length !== 1 || heads[0].career_id !== pinned.careerId || heads[0].player_id !== pinned.playerId || !day(heads[0].revision)) throw new Error('dispatch current timing head differs');
  const updates = db.prepare(`SELECT * FROM main.world_pitch_timing_updates WHERE (career_id=$career OR ${nominalClaim('source_json', ['episode', 'careerId'], '$career')} OR ${nominalClaim('state_json', ['careerId'], '$career')})
    AND (player_id=$player OR ${nominalClaim('source_json', ['episode', 'playerId'], '$player')} OR ${nominalClaim('state_json', ['playerId'], '$player')}) ORDER BY after_revision`).all({ career: pinned.careerId, player: pinned.playerId });
  if (updates.length !== heads[0].revision) throw new Error('dispatch current timing history or head differs');
  const baseline = updates.length ? null : db.prepare('SELECT * FROM main.world_pitch_timing_baselines WHERE career_id=? AND player_id=?').get(pinned.careerId, pinned.playerId);
  const endpoint = updates.at(-1) ?? baseline; if (!endpoint) throw new Error('dispatch current timing baseline missing');
  const current = replayPlayerPitchTimingPrefixFromSqlite(db, { owner: updates.length ? 'world_pitch_timing_updates' : 'world_pitch_timing_baselines',
    sourceId: String(endpoint.source_id), sourceHash: hash(JSON.parse(String(endpoint.source_json))), snapshotHash: hash(JSON.parse(String(updates.length ? endpoint.state_json : endpoint.initial_json))) });
  if (heads[0].state_json !== canonicalJson(current.source) || heads[0].revision !== current.source.revision) throw new Error('dispatch current timing head diverged');
  const selected = current.states.filter(s => s.effectiveDay <= atDay).at(-1);
  if (!selected || selected.revision > pinned.revision) throw new Error('dispatch current timing has an unpinned applicable revision');
  selectPlayerPitchTimingProfile(selected, pinned.playerId, atDay);
};

/** One versioned, replayable pitch-timing source per global Player. */
export const openSqlitePlayerPitchTimingStore = (
  databasePath: string,
  personLinks: AcceptedPlayerPersonLinkAuthority,
  authority?: AcceptedPitchTimingAuthority | null,
  evidenceGuard?: PitchTimingEvidenceGuard,
): SqlitePlayerPitchTimingStore => {
  if (evidenceGuard !== undefined && typeof evidenceGuard !== 'function') throw new Error('invalid pitch timing evidence guard');
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
  try {
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
    playerId: string, throughRevision?: number): PlayerPitchTimingSource | null => {
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
    const updates = (throughRevision === undefined ? getUpdates.all(careerId, playerId)
      : db.prepare(`SELECT * FROM world_pitch_timing_updates WHERE career_id=? AND player_id=?
        AND after_revision<=? ORDER BY after_revision`).all(careerId, playerId, throughRevision)) as UpdateRow[];
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
      evidenceGuard?.(db, accepted, 'read');
    }
    if (throughRevision !== undefined) {
      if (current.revision !== throughRevision) throw new Error('pitch timing historical revision is missing');
      return current;
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
    selectAtRevision(careerId: string, playerId: string, revision: number): PlayerPitchTimingSource {
      if (!id(careerId) || !id(playerId) || !day(revision)) throw new Error('invalid historical pitch timing revision scope');
      const selected = replay(careerId, playerId, revision);
      if (!selected) throw new Error('pitch timing historical baseline is missing');
      return selected;
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
    readDevelopmentEvidenceAtDay(careerId: string,
      playerId: string, atDay: number):
    DurablePitchTimingDevelopmentEvidence | null {
      if (!id(careerId) || !id(playerId) || !day(atDay)) {
        throw new Error('invalid historical development evidence scope');
      }
      if (!replay(careerId, playerId)) return null;
      const initial = baseline(careerId, playerId)!;
      let selected = JSON.parse(initial.initial_json) as
        PlayerPitchTimingSource;
      if (selected.createdAtDay > atDay) return null;
      const episodes: DevelopmentLearningEpisode[] = [];
      for (const row of getUpdates.all(careerId,
        playerId) as UpdateRow[]) {
        const candidate = JSON.parse(row.state_json) as
          PlayerPitchTimingSource;
        if (candidate.effectiveDay > atDay) break;
        selected = candidate;
        episodes.push((JSON.parse(row.source_json) as
          AcceptedPitchTimingLearning).episode);
      }
      return Object.freeze({ source: selected,
        episodes: Object.freeze(episodes) });
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
          evidenceGuard?.(db, JSON.parse(prior.source_json) as AcceptedPitchTimingLearning, 'retry');
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
        evidenceGuard?.(db, accepted, 'write');
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
        evidenceGuard?.(db, accepted, 'written');
        return replay(careerId, playerId)!;
      });
    },
    close(): void { if (!closed) { db.close(); closed = true; } },
  });
  } catch (error) { db.close(); throw error; }
};
