import { battedWorldFieldGeometry } from './BattedWorldFieldRoot';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BallWorldSettledFoulDeadEvidenceInput } from '../../core/rules/BallWorldSettledFoulDeadEvidence';
import { getRuleProfile, NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';

export type AcceptedBattedVenueLegalPolicy = Readonly<{
  sourceId: string; sourceVersion: string; version: 'batted_venue_legal_policy_v1';
  gameId: string; careerId: string; fixtureEventId: string; venueId: string; availableAtDay: number;
  baseFieldSourceId: string; worldModelSourceId: string; responseModelSourceId: string;
  fieldGeometrySourceId: string; baseGeometrySourceId: string;
  rulePolicy: BallWorldSettledFoulDeadEvidenceInput['policy'];
}>;
export type BattedVenueFieldReference = Readonly<{
  owner: 'batted_world_field_actions'; sourceId: string; sourceVersion: string; revision: number;
  sourceHash: string; snapshotHash: string;
}>;
export type DurableBattedVenueLegalPolicy = Readonly<{
  source: AcceptedBattedVenueLegalPolicy;
  physicalPitchSourceId: string; playId: number; fixtureRevision: number; ruleProfileHash: string;
  anchor: BattedVenueFieldReference;
  dependencies: Readonly<{ physicalPitchHash: string; fixtureHash: string; worldModelHash: string;
    responseModelHash: string; fieldGeometryHash: string; baseGeometryHash: string; episodeFieldBindingHash?: string }>;
}>;
export type BattedVenueLegalPolicyAuthority = Readonly<{
  readAcceptedPolicy(sourceId: string): AcceptedBattedVenueLegalPolicy | null;
}>;
export type SqliteBattedVenueLegalPolicyStore = Readonly<{
  accept(sourceId: string): DurableBattedVenueLegalPolicy;
  read(sourceId: string): DurableBattedVenueLegalPolicy | null;
  close(): void;
}>;

type Db = import('node:sqlite').DatabaseSync;
type Row = Readonly<{
  source_id: string; source_version: string; policy_version: string; game_id: string; career_id: string;
  fixture_event_id: string; venue_id: string; available_at_day: number; physical_pitch_source_id: string;
  base_field_source_id: string; source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string;
}>;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const fields = (value: unknown, names: readonly string[]) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...names].sort());
const sourceInput = (raw: AcceptedBattedVenueLegalPolicy, sourceId: string): AcceptedBattedVenueLegalPolicy => {
  const source = cloneInert(raw);
  if (!fields(source, ['sourceId', 'sourceVersion', 'version', 'gameId', 'careerId', 'fixtureEventId', 'venueId', 'availableAtDay',
    'baseFieldSourceId', 'worldModelSourceId', 'responseModelSourceId', 'fieldGeometrySourceId', 'baseGeometrySourceId', 'rulePolicy'])
    || source.sourceId !== sourceId || source.version !== 'batted_venue_legal_policy_v1'
    || ![sourceId, source.sourceVersion, source.gameId, source.careerId, source.fixtureEventId, source.venueId,
      source.baseFieldSourceId, source.worldModelSourceId, source.responseModelSourceId, source.fieldGeometrySourceId, source.baseGeometrySourceId].every(id)
    || !Number.isSafeInteger(source.availableAtDay) || source.availableAtDay < 0
    || !fields(source.rulePolicy, ['version', 'ruleProfileId', 'rulesRevision'])
    || source.rulePolicy.version !== 'untouched_settled_foul_dead_v1' || !id(source.rulePolicy.ruleProfileId) || !id(source.rulePolicy.rulesRevision)) {
    throw new Error('invalid accepted venue legal policy Source');
  }
  const profile = getRuleProfile(source.rulePolicy.ruleProfileId);
  if (profile.id !== NPB_2026_RULE_PROFILE.id || profile.rulesRevision !== source.rulePolicy.rulesRevision) {
    throw new Error('unsupported venue legal policy RuleProfile revision');
  }
  return freeze(source);
};

/** Real snapshot ownership, preserving an enclosing transaction and its settings. */
export const withBattedVenueLegalReadSnapshot = <T>(db: Db, body: () => T): T => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof DatabaseSync)) throw new Error('venue legal evidence requires a real SQLite connection');
  const read = () => withBattedWorldPhysicalReadTraversal(db, () => {
    // Original physical owners use unqualified table names. This API admits
    // authority from main only, including when a main dependency is absent.
    const databases = db.prepare('PRAGMA database_list').all();
    if (databases.filter(row => row.name === 'main').length !== 1
      || databases.some(row => row.name !== 'main' && row.name !== 'temp')
      || db.prepare("SELECT name FROM temp.sqlite_master WHERE type IN ('table','view') LIMIT 1").get()) {
      throw new Error('venue legal evidence requires main-only authority storage');
    }
    return body();
  });
  if (db.isTransaction) return read();
  db.exec('BEGIN');
  try {
    const result = read();
    if (!db.isTransaction) throw new Error('venue legal read transaction disappeared');
    db.exec('COMMIT'); return result;
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
};

const policyOwner = (db: Db) => {
  const originalFields = battedWorldFieldEvidenceFromSqlite(db);
  const installed = () => {
    const schema = db.prepare("SELECT type FROM main.sqlite_master WHERE name='batted_venue_legal_policies'").all();
    if (schema.length === 0) return false;
    if (schema.length !== 1 || schema[0].type !== 'table') throw new Error('venue legal policy owner schema differs');
    return true;
  };
  const claim = (document: string, path: readonly string[]) => `EXISTS (SELECT 1 FROM (${nodes(document, path)}) identity
    WHERE identity.type='text' AND identity.atom=?)`;
  const identities = (sourceId: string): readonly Row[] => !installed() ? [] : db.prepare(`SELECT * FROM main.batted_venue_legal_policies
    WHERE source_id=? OR ${claim('source_json', ['sourceId'])} OR ${claim('snapshot_json', ['source', 'sourceId'])}`)
    .all(sourceId, sourceId, sourceId) as Row[];
  const scope = (physicalPitchSourceId: string, version: string): readonly Row[] => !installed() ? [] : db.prepare(`
    SELECT * FROM main.batted_venue_legal_policies WHERE
      (physical_pitch_source_id=? OR ${claim('snapshot_json', ['physicalPitchSourceId'])}
       OR base_field_source_id IN (SELECT source_id FROM main.batted_world_field_actions WHERE physical_pitch_source_id=?)
       OR EXISTS (SELECT 1 FROM (${nodes('source_json', ['baseFieldSourceId'])}) anchor
         JOIN main.batted_world_field_actions field ON anchor.type='text' AND anchor.atom=field.source_id WHERE field.physical_pitch_source_id=?)
       OR EXISTS (SELECT 1 FROM (${nodes('snapshot_json', ['source', 'baseFieldSourceId'])}) anchor
         JOIN main.batted_world_field_actions field ON anchor.type='text' AND anchor.atom=field.source_id WHERE field.physical_pitch_source_id=?))
      AND (policy_version=? OR ${claim('source_json', ['version'])} OR ${claim('snapshot_json', ['source', 'version'])})`)
    .all(physicalPitchSourceId, physicalPitchSourceId, physicalPitchSourceId, physicalPitchSourceId, physicalPitchSourceId,
      version, version, version) as Row[];
  const derive = (source: AcceptedBattedVenueLegalPolicy): DurableBattedVenueLegalPolicy => {
    const anchor = originalFields.read(source.baseFieldSourceId);
    if (!anchor) throw new Error('venue legal original field anchor is missing');
    battedWorldFieldGeometry(anchor);
    const response = anchor.response, world = response.touch.worldContact, geometry = anchor.geometry;
    const baseGeometry = geometry.baseGeometry, fixture = baseGeometry.fixture, pitch = world.flight.physicalPitch;
    const batter = pitch.frame.batterActor;
    if (!batter || source.gameId !== world.model.gameId || source.gameId !== pitch.frame.gameId || source.gameId !== fixture.game_id
      || source.careerId !== world.model.careerId || source.careerId !== batter.binding.careerId
      || source.fixtureEventId !== world.model.fixtureEventId || source.fixtureEventId !== fixture.fixture_event_id
      || source.fixtureEventId !== batter.binding.fixtureEventId || source.venueId !== world.model.venueId || source.venueId !== fixture.venue_id
      || source.worldModelSourceId !== world.model.sourceId || source.responseModelSourceId !== response.model.sourceId
      || source.fieldGeometrySourceId !== geometry.source.sourceId || source.baseGeometrySourceId !== baseGeometry.source.sourceId
      || source.availableAtDay > batter.binding.gameDay || source.rulePolicy.ruleProfileId !== pitch.frame.match.ruleProfileId
      || pitch.source.sourceId !== world.flight.source.physicalPitchSourceId) throw new Error('venue legal original pitch/fixture/model scope differs');
    const profile = getRuleProfile(source.rulePolicy.ruleProfileId);
    if (source.rulePolicy.rulesRevision !== profile.rulesRevision) throw new Error('venue legal registered profile changed');
    return freeze({ source, physicalPitchSourceId: pitch.source.sourceId, playId: pitch.frame.match.playId,
      fixtureRevision: fixture.fixture_revision, ruleProfileHash: hash(profile),
      anchor: { owner: 'batted_world_field_actions', sourceId: anchor.source.sourceId, sourceVersion: anchor.source.sourceVersion,
        revision: anchor.revision, sourceHash: hash(anchor.source), snapshotHash: hash(anchor) },
      dependencies: { physicalPitchHash: hash(pitch), fixtureHash: hash(fixture), worldModelHash: hash(world.model),
        responseModelHash: hash(response.model), fieldGeometryHash: hash(geometry), baseGeometryHash: hash(baseGeometry),
        ...(anchor.rootKind === 'episode_field_binding_v1' ? { episodeFieldBindingHash: hash(anchor.episodeFieldBinding) } : {}) } });
  };
  const read = (sourceId: string): DurableBattedVenueLegalPolicy | null => {
    if (!id(sourceId)) throw new Error('invalid venue legal policy scope');
    const rows = identities(sourceId);
    if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('venue legal policy Source ownership differs');
    const row = rows[0]; if (!row) return null;
    const source = sourceInput(JSON.parse(row.source_json) as AcceptedBattedVenueLegalPolicy, sourceId), value = derive(source);
    const claims = scope(value.physicalPitchSourceId, source.version);
    if (claims.length !== 1 || claims[0].source_id !== sourceId) throw new Error('venue legal original pitch/version ownership differs');
    if (row.source_version !== source.sourceVersion || row.policy_version !== source.version || row.game_id !== source.gameId
      || row.career_id !== source.careerId || row.fixture_event_id !== source.fixtureEventId || row.venue_id !== source.venueId
      || row.available_at_day !== source.availableAtDay || row.physical_pitch_source_id !== value.physicalPitchSourceId
      || row.base_field_source_id !== source.baseFieldSourceId || row.source_json !== json(source) || row.source_hash !== hash(source)
      || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt venue legal policy archive or dependencies');
    return value;
  };
  return { derive, read, scope };
};

/** Same-connection authenticated configuration read. It never installs schema. */
export const battedVenueLegalPolicyEvidenceFromSqlite = (db: Db) => {
  const own = policyOwner(db);
  return Object.freeze({ read: (sourceId: string) => withBattedVenueLegalReadSnapshot(db, () => own.read(sourceId)) });
};

/** Accepted interpretation configuration only: no live producer, physical head or closure write. */
export const openSqliteBattedVenueLegalPolicyStore = (
  path: string, authority?: BattedVenueLegalPolicyAuthority,
): SqliteBattedVenueLegalPolicyStore => {
  if (!id(path) || authority !== undefined && typeof authority.readAcceptedPolicy !== 'function') throw new Error('invalid venue legal policy authority');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  try {
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS main.batted_venue_legal_policies (
        source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,policy_version TEXT NOT NULL,game_id TEXT NOT NULL,career_id TEXT NOT NULL,
        fixture_event_id TEXT NOT NULL,venue_id TEXT NOT NULL,available_at_day INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL,
        base_field_source_id TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
        UNIQUE(physical_pitch_source_id,policy_version));`);
  } catch (error) { db.close(); throw error; }
  const own = policyOwner(db); let closed = false;
  const check = () => { if (closed) throw new Error('closed venue legal policy store'); };
  const snapshot = <T>(body: () => T) => withBattedVenueLegalReadSnapshot(db, body);
  return Object.freeze({
    read(sourceId) { check(); return snapshot(() => own.read(sourceId)); },
    accept(sourceId) {
      check();
      // The earlier read is intentional: an authority callback cannot replace an
      // existing Source between discovery and the immutable retry proof.
      const prior = snapshot(() => own.read(sourceId));
      const raw = authority?.readAcceptedPolicy(sourceId) ?? null, source = raw === null ? null : sourceInput(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('venue legal policy Source is frozen differently');
        return snapshot(() => {
          const saved = own.read(sourceId);
          if (!saved || json(saved) !== json(prior)) throw new Error('venue legal original policy changed during retry');
          return saved;
        });
      }
      if (!source) throw new Error('accepted venue legal policy Source is missing');
      const proposed = snapshot(() => own.derive(source)), encoded = json(proposed);
      db.exec('BEGIN IMMEDIATE');
      try {
        if (own.scope(proposed.physicalPitchSourceId, source.version).length) throw new Error('venue legal original pitch/version already has a policy');
        const current = snapshot(() => own.derive(source));
        if (json(current) !== encoded) throw new Error('venue legal original dependencies changed before write');
        const beforeChanges = db.prepare('SELECT total_changes() AS n').get()!.n;
        if (typeof beforeChanges !== 'number' || !Number.isSafeInteger(beforeChanges + 1)) {
          throw new Error('venue legal write accounting is unavailable');
        }
        const assertOwnInsert = () => {
          if (db.prepare('SELECT total_changes() AS n').get()!.n !== beforeChanges + 1) {
            throw new Error('venue legal acceptance changed more than its own policy row');
          }
        };
        db.prepare(`INSERT INTO main.batted_venue_legal_policies
          (source_id,source_version,policy_version,game_id,career_id,fixture_event_id,venue_id,available_at_day,physical_pitch_source_id,
           base_field_source_id,source_json,source_hash,snapshot_json,snapshot_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(sourceId, source.sourceVersion, source.version, source.gameId, source.careerId, source.fixtureEventId, source.venueId,
            source.availableAtDay, proposed.physicalPitchSourceId, source.baseFieldSourceId, json(source), hash(source), encoded, hash(proposed));
        assertOwnInsert();
        const saved = snapshot(() => own.read(sourceId));
        assertOwnInsert();
        if (!saved || json(saved) !== encoded) throw new Error('venue legal original policy changed during write');
        db.exec('COMMIT'); return saved;
      } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
