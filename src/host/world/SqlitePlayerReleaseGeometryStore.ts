import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import { projectReleaseHeightTier,
  resolvePitcherReleasePosition,
  type PitcherBodyReleaseModel,
  type PitcherReleaseGeometryProfile } from
  '../../core/sim/pitch/PitcherReleaseGeometry';
import type { AcceptedPlayerPersonLinkAuthority } from
  './SqliteFreeAgentContractStore';

export type PlayerReleaseBody = Omit<PitcherBodyReleaseModel,
  'moundReference'>;
export type AcceptedReleaseGeometryBaseline = Readonly<{
  sourceId: string; sourceVersion: string;
  careerId: string; playerId: string; personLinkSourceId: string;
  acceptedAtDay: number; body: PlayerReleaseBody;
  profile: PitcherReleaseGeometryProfile;
  tierBoundaries: readonly number[];
}>;
export type AcceptedReleaseGeometryChange = Readonly<{
  sourceId: string; sourceVersion: string;
  careerId: string; playerId: string;
  causeEventId: string;
  causeKind: 'FORM_REBUILD' | 'COACHING_MECHANICAL_CHANGE'
    | 'INJURY_RECOVERY' | 'ARM_SLOT_CONVERSION' | 'BODY_CHANGE';
  effectiveDay: number; body: PlayerReleaseBody;
  profile: PitcherReleaseGeometryProfile;
}>;
export type AcceptedReleaseGeometryAuthority = Readonly<{
  readAcceptedBaseline(sourceId: string):
    AcceptedReleaseGeometryBaseline | null;
  readAcceptedChange(sourceId: string):
    AcceptedReleaseGeometryChange | null;
}>;
export type PlayerReleaseGeometrySnapshot = Readonly<{
  sourceId: string; sourceVersion: string; effectiveDay: number;
  body: PlayerReleaseBody; profile: PitcherReleaseGeometryProfile;
}>;
export type PlayerReleaseGeometryHistory = Readonly<{
  careerId: string; playerId: string; revision: number;
  tierBoundaries: readonly number[];
  baseline: PlayerReleaseGeometrySnapshot;
  changes: readonly (PlayerReleaseGeometrySnapshot & Readonly<{
    causeEventId: string;
    causeKind: AcceptedReleaseGeometryChange['causeKind'];
  }>)[];
}>;
export type SqlitePlayerReleaseGeometryStore = Readonly<{
  initialize(sourceId: string): PlayerReleaseGeometryHistory;
  apply(sourceId: string, expectedRevision: number):
    PlayerReleaseGeometryHistory;
  readHead(careerId: string, playerId: string):
    PlayerReleaseGeometryHistory | null;
  selectAtDay(careerId: string, playerId: string,
    atDay: number): PlayerReleaseGeometrySnapshot;
  positionAtDay(careerId: string, playerId: string,
    atDay: number, moundReference: Vec3): Vec3;
  close(): void;
}>;

type BaselineRow = { source_id: string; career_id: string;
  player_id: string; source_json: string };
type ChangeRow = { source_id: string; career_id: string;
  player_id: string; revision: number; source_json: string };
type HeadRow = { revision: number; state_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const fields = (value: unknown, names: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === names.join('|');
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0)) : item);
const validateGeometry = (body: PlayerReleaseBody,
  profile: PitcherReleaseGeometryProfile,
  tierBoundaries: readonly number[]): void => {
  if (!fields(body, ['armReachMeters', 'heightMeters',
    'postureDropMeters', 'shoulderHeightMeters', 'throwingSide'])
    || !fields(profile, ['armSlotAzimuthDeg', 'armSlotClass',
      'armSlotElevationDeg', 'releaseExtensionRatio',
      'releaseHeightRatio', 'releaseHeightTier',
      'releaseLateralRatio'])) {
    throw new Error('invalid Player release geometry fields');
  }
  if (projectReleaseHeightTier(profile.releaseHeightRatio,
    tierBoundaries) !== profile.releaseHeightTier) {
    throw new Error('release height tier differs from continuous geometry');
  }
  resolvePitcherReleasePosition({ ...body,
    moundReference: { x: 0, y: 0, z: 0 } }, profile);
};
const validBaseline = (value: AcceptedReleaseGeometryBaseline | null,
  sourceId: string): value is AcceptedReleaseGeometryBaseline =>
  value !== null && fields(value, ['acceptedAtDay', 'body',
    'careerId', 'personLinkSourceId', 'playerId', 'profile',
    'sourceId', 'sourceVersion', 'tierBoundaries'])
  && value.sourceId === sourceId && id(value.sourceVersion)
  && id(value.careerId) && id(value.playerId)
  && id(value.personLinkSourceId) && day(value.acceptedAtDay)
  && Array.isArray(value.tierBoundaries);
const validChange = (value: AcceptedReleaseGeometryChange | null,
  sourceId: string): value is AcceptedReleaseGeometryChange =>
  value !== null && fields(value, ['body', 'careerId',
    'causeEventId', 'causeKind', 'effectiveDay', 'playerId',
    'profile', 'sourceId', 'sourceVersion'])
  && value.sourceId === sourceId && id(value.sourceVersion)
  && id(value.careerId) && id(value.playerId)
  && id(value.causeEventId) && day(value.effectiveDay)
  && ['FORM_REBUILD', 'COACHING_MECHANICAL_CHANGE',
    'INJURY_RECOVERY', 'ARM_SLOT_CONVERSION', 'BODY_CHANGE']
    .includes(value.causeKind);
const initialState = (source: AcceptedReleaseGeometryBaseline):
PlayerReleaseGeometryHistory => ({
  careerId: source.careerId, playerId: source.playerId,
  revision: 0, tierBoundaries: source.tierBoundaries,
  baseline: { sourceId: source.sourceId,
    sourceVersion: source.sourceVersion,
    effectiveDay: source.acceptedAtDay,
    body: source.body, profile: source.profile },
  changes: [],
});
const advance = (before: PlayerReleaseGeometryHistory,
  source: AcceptedReleaseGeometryChange):
PlayerReleaseGeometryHistory => {
  const previous = before.changes.at(-1) ?? before.baseline;
  if (source.careerId !== before.careerId
    || source.playerId !== before.playerId
    || source.effectiveDay < previous.effectiveDay
    || before.changes.some((item) =>
      item.causeEventId === source.causeEventId)) {
    throw new Error('release change contradicts Player history');
  }
  validateGeometry(source.body, source.profile,
    before.tierBoundaries);
  return { ...before, revision: before.revision + 1,
    changes: [...before.changes, {
      sourceId: source.sourceId, sourceVersion: source.sourceVersion,
      effectiveDay: source.effectiveDay, body: source.body,
      profile: source.profile, causeEventId: source.causeEventId,
      causeKind: source.causeKind,
    }] };
};

/** A fixed per-Player delivery source; only accepted Career events can revise it. */
export const openSqlitePlayerReleaseGeometryStore = (
  databasePath: string,
  personLinks: AcceptedPlayerPersonLinkAuthority,
  authority?: AcceptedReleaseGeometryAuthority | null,
): SqlitePlayerReleaseGeometryStore => {
  if (!id(databasePath) || !personLinks
    || typeof personLinks.readAcceptedPlayerPersonLink !== 'function'
    || (authority != null && (typeof authority.readAcceptedBaseline
      !== 'function' || typeof authority.readAcceptedChange
        !== 'function'))) {
    throw new Error('invalid Player release source');
  }
  const Database = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const db = new Database(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_player_release_baselines (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL,
    player_id TEXT NOT NULL, source_json TEXT NOT NULL,
    UNIQUE(career_id, player_id)
  );
  CREATE TABLE IF NOT EXISTS world_player_release_changes (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL,
    player_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision > 0),
    source_json TEXT NOT NULL,
    UNIQUE(career_id, player_id, revision)
  );
  CREATE TABLE IF NOT EXISTS world_player_release_heads (
    career_id TEXT NOT NULL, player_id TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK(revision >= 0),
    state_json TEXT NOT NULL, PRIMARY KEY(career_id, player_id)
  );`);
  const getBaseline = db.prepare(`SELECT source_id, career_id,
    player_id, source_json FROM world_player_release_baselines
    WHERE career_id=? AND player_id=?`);
  const getBaselineBySource = db.prepare(`SELECT source_id, career_id,
    player_id, source_json FROM world_player_release_baselines
    WHERE source_id=?`);
  const getChange = db.prepare(`SELECT source_id, career_id,
    player_id, revision, source_json FROM world_player_release_changes
    WHERE source_id=?`);
  const getChanges = db.prepare(`SELECT source_id, career_id,
    player_id, revision, source_json FROM world_player_release_changes
    WHERE career_id=? AND player_id=? ORDER BY revision`);
  const getHead = db.prepare(`SELECT revision, state_json
    FROM world_player_release_heads WHERE career_id=? AND player_id=?`);
  const replay = (careerId: string,
    playerId: string): PlayerReleaseGeometryHistory | null => {
    const row = getBaseline.get(careerId, playerId) as BaselineRow | undefined;
    if (!row) return null;
    const source = JSON.parse(row.source_json) as
      AcceptedReleaseGeometryBaseline;
    const link = personLinks.readAcceptedPlayerPersonLink(
      source.personLinkSourceId);
    if (!validBaseline(source, row.source_id)
      || row.career_id !== careerId || row.player_id !== playerId
      || source.careerId !== careerId || source.playerId !== playerId
      || !link || link.careerId !== careerId || link.playerId !== playerId
      || canonicalJson(source) !== row.source_json) {
      throw new Error('corrupt Player release baseline');
    }
    validateGeometry(source.body, source.profile,
      source.tierBoundaries);
    let current = initialState(source);
    const changes = getChanges.all(careerId, playerId) as ChangeRow[];
    for (const [index, item] of changes.entries()) {
      const change = JSON.parse(item.source_json) as
        AcceptedReleaseGeometryChange;
      if (!validChange(change, item.source_id)
        || item.career_id !== careerId || item.player_id !== playerId
        || item.revision !== index + 1
        || canonicalJson(change) !== item.source_json) {
        throw new Error('corrupt Player release change');
      }
      current = advance(current, change);
    }
    const head = getHead.get(careerId, playerId) as HeadRow | undefined;
    if (!head || head.revision !== current.revision
      || head.state_json !== canonicalJson(current)) {
      throw new Error('Player release history head diverged');
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
  const selectAtDay = (careerId: string, playerId: string,
    atDay: number): PlayerReleaseGeometrySnapshot => {
    if (!id(careerId) || !id(playerId) || !day(atDay)) {
      throw new Error('invalid Player release selection');
    }
    const source = replay(careerId, playerId);
    if (!source || atDay < source.baseline.effectiveDay) {
      throw new Error('Player release source is missing at day');
    }
    return source.changes.filter((item) =>
      item.effectiveDay <= atDay).at(-1) ?? source.baseline;
  };
  let closed = false;
  return Object.freeze({
    initialize(sourceId: string): PlayerReleaseGeometryHistory {
      if (!id(sourceId)) throw new Error('invalid release baseline sourceId');
      return transaction(() => {
        const prior = getBaselineBySource.get(sourceId) as
          BaselineRow | undefined;
        if (prior) return replay(prior.career_id, prior.player_id)!;
        if (getChange.get(sourceId)) {
          throw new Error('release sourceId belongs to change evidence');
        }
        if (!authority) throw new Error('accepted release baseline authority is required');
        const raw = authority.readAcceptedBaseline(sourceId);
        const source = raw === null ? null : cloneInert(raw);
        if (!validBaseline(source, sourceId)) {
          throw new Error('accepted release baseline is absent or invalid');
        }
        const link = personLinks.readAcceptedPlayerPersonLink(
          source.personLinkSourceId);
        if (!link || link.careerId !== source.careerId
          || link.playerId !== source.playerId) {
          throw new Error('release baseline lacks accepted Player Person link');
        }
        validateGeometry(source.body, source.profile,
          source.tierBoundaries);
        const initial = initialState(source);
        db.prepare(`INSERT INTO world_player_release_baselines
          (source_id, career_id, player_id, source_json)
          VALUES (?, ?, ?, ?)`).run(sourceId, source.careerId,
            source.playerId, canonicalJson(source));
        db.prepare(`INSERT INTO world_player_release_heads
          (career_id, player_id, revision, state_json)
          VALUES (?, ?, 0, ?)`).run(source.careerId,
            source.playerId, canonicalJson(initial));
        return replay(source.careerId, source.playerId)!;
      });
    },
    apply(sourceId: string,
      expectedRevision: number): PlayerReleaseGeometryHistory {
      if (!id(sourceId) || !day(expectedRevision)) {
        throw new Error('invalid release change scope');
      }
      return transaction(() => {
        const prior = getChange.get(sourceId) as ChangeRow | undefined;
        if (prior) {
          if (prior.revision !== expectedRevision + 1) {
            throw new Error('release sourceId retry revision differs');
          }
          const current = replay(prior.career_id, prior.player_id)!;
          if (current.changes[prior.revision - 1]?.sourceId !== sourceId) {
            throw new Error('release sourceId revision diverged');
          }
          return { ...current, revision: prior.revision,
            changes: current.changes.slice(0, prior.revision) };
        }
        if (getBaselineBySource.get(sourceId)) {
          throw new Error('release sourceId belongs to baseline');
        }
        if (!authority) throw new Error('accepted release change authority is required');
        const raw = authority.readAcceptedChange(sourceId);
        const source = raw === null ? null : cloneInert(raw);
        if (!validChange(source, sourceId)) {
          throw new Error('accepted release change is absent or invalid');
        }
        const before = replay(source.careerId, source.playerId);
        if (!before) throw new Error('release baseline is missing');
        if (before.revision !== expectedRevision) {
          throw new Error('stale Player release revision');
        }
        const after = advance(before, source);
        db.prepare(`INSERT INTO world_player_release_changes
          (source_id, career_id, player_id, revision, source_json)
          VALUES (?, ?, ?, ?, ?)`).run(sourceId,
            source.careerId, source.playerId, after.revision,
            canonicalJson(source));
        const updated = db.prepare(`UPDATE world_player_release_heads
          SET revision=?, state_json=? WHERE career_id=? AND player_id=?
          AND revision=? AND state_json=?`).run(after.revision,
            canonicalJson(after), source.careerId, source.playerId,
            before.revision, canonicalJson(before));
        if (updated.changes !== 1) {
          throw new Error('Player release head CAS failed');
        }
        return replay(source.careerId, source.playerId)!;
      });
    },
    readHead(careerId: string, playerId: string):
    PlayerReleaseGeometryHistory | null {
      if (!id(careerId) || !id(playerId)) {
        throw new Error('invalid Player release scope');
      }
      return replay(careerId, playerId);
    },
    selectAtDay,
    positionAtDay(careerId: string, playerId: string,
      atDay: number, moundReference: Vec3): Vec3 {
      const selected = selectAtDay(careerId, playerId, atDay);
      return resolvePitcherReleasePosition({ ...selected.body,
        moundReference }, selected.profile);
    },
    close(): void { if (!closed) { db.close(); closed = true; } },
  });
};
