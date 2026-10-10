import { createRequire } from 'node:module';
import { assertPhysicalCapabilityDevelopment, physicalCapabilityDevelopmentInput, withPhysicalCapabilityReplay, type AcceptedPhysicalCapabilityDevelopment } from './AcceptedPhysicalCapabilityDevelopment';
import { bodyCompositionTableInstalled, withBodyCompositionTransaction } from './BodyMaterializationSqliteOwnership';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection,
  sqliteJsonMetadataMatches as matches } from './SqliteOwnershipMetadata';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createPlayerLocomotionCalibration, type PlayerLocomotionCalibration } from '../../core/sim/fielding/PlayerLocomotionCalibration';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerFieldingModelEvidenceFromSqlite, type DurablePlayerFieldingModel } from './SqlitePlayerFieldingModelStore';

/** All values are explicit accepted inputs; sourceVersion identifies calibration provenance, not a latest-version selector. */
export type AcceptedPlayerLocomotionModel = Readonly<{
  sourceId: string;
  sourceVersion: string;
  capability: 'defender_locomotion_v1';
  careerId: string;
  playerId: string;
  personLinkSourceId: string;
  fieldingModelSourceId: string;
  acceptedAtDay: number;
  developmentProvenance?: AcceptedPhysicalCapabilityDevelopment;
  calibration: PlayerLocomotionCalibration;
}>;
export type DurablePlayerLocomotionModel = Readonly<{
  source: AcceptedPlayerLocomotionModel;
  fieldingModel: DurablePlayerFieldingModel;
}>;
export type SqlitePlayerLocomotionModelStore = Readonly<{
  accept(sourceId: string): DurablePlayerLocomotionModel;
  read(sourceId: string): DurablePlayerLocomotionModel | null;
  selectAtDay(careerId: string, playerId: string, atDay: number): DurablePlayerLocomotionModel;
  close(): void;
}>;
type Authority = Readonly<{ readAcceptedModel(sourceId: string): AcceptedPlayerLocomotionModel | null }>;
type Row = {
  source_id: string; source_version: string; capability: string; career_id: string; player_id: string;
  person_link_source_id: string; fielding_model_source_id: string; accepted_at_day: number;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string;
};
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;
const fields = (value: unknown, names: readonly string[]): boolean => value !== null && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...names].sort());
const input = (raw: AcceptedPlayerLocomotionModel, sourceId?: string): AcceptedPlayerLocomotionModel => {
  const source = cloneInert(raw);
  if (!fields(source, ['sourceId', 'sourceVersion', 'capability', 'careerId', 'playerId', 'personLinkSourceId', 'fieldingModelSourceId', 'acceptedAtDay', 'calibration', ...(source && Object.hasOwn(source, 'developmentProvenance') ? ['developmentProvenance'] : [])])
    || sourceId !== undefined && source.sourceId !== sourceId
    || ![source.sourceId, source.sourceVersion, source.careerId, source.playerId, source.personLinkSourceId, source.fieldingModelSourceId].every(id)
    || source.capability !== 'defender_locomotion_v1' || !day(source.acceptedAtDay)) throw new Error('invalid accepted Player locomotion model Source');
  if (Object.hasOwn(source, 'developmentProvenance')) physicalCapabilityDevelopmentInput(source.developmentProvenance!, 'defender_locomotion');
  return { ...source, calibration: createPlayerLocomotionCalibration(source.calibration) };
};

// Ownership discovery enumerates decoded duplicate scalar/container occurrences. json_extract's
// first-value choice is not the same interpretation as JSON.parse's last-value choice.
const scopeClaim = (column: string, path: readonly string[]): string => {
  const object = "CASE WHEN owner.type='object' THEN owner.value ELSE '{}' END";
  return `EXISTS (SELECT 1 FROM (${nodes(column, path)}) owner
    WHERE EXISTS (SELECT 1 FROM (${nodes(object, ['careerId'])}) claim WHERE claim.type='text' AND claim.atom=?)
      AND EXISTS (SELECT 1 FROM (${nodes(object, ['playerId'])}) claim WHERE claim.type='text' AND claim.atom=?))`;
};
const sourceClaim = (column: string, path: readonly string[]): string =>
  `EXISTS (SELECT 1 FROM (${nodes(column, path)}) claim WHERE claim.type='text' AND claim.atom=?)`;

const baselineTable = 'world_player_locomotion_models';
const developmentTable = 'world_player_locomotion_model_developments';
type HistoryRow = Row & { owner_table: string };

/** Reconstructs the exact immutable fielding Source and its original Player/Person link, never a peer-supplied profile. */
export const playerLocomotionModelEvidenceFromSqlite = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>) => {
  const fielding = playerFieldingModelEvidenceFromSqlite(db);
  const derive = (raw: AcceptedPlayerLocomotionModel): DurablePlayerLocomotionModel => {
    const source = input(raw);
    return withPhysicalCapabilityReplay(db, 'defender_locomotion', source.sourceId, () => {
      const fieldingModel = fielding.read(source.fieldingModelSourceId);
      if (!fieldingModel || fieldingModel.source.careerId !== source.careerId || fieldingModel.source.playerId !== source.playerId
        || fieldingModel.source.personLinkSourceId !== source.personLinkSourceId || fieldingModel.person.sourceId !== source.personLinkSourceId
        || source.acceptedAtDay < fieldingModel.source.acceptedAtDay) throw new Error('Player locomotion model original fielding/Person scope differs');
      const value = freeze({ source, fieldingModel });
      if (source.developmentProvenance) {
        const prior = read(source.developmentProvenance.originalModelRef.sourceId);
        if (!prior) throw new Error('original locomotion development model is missing');
        assertPhysicalCapabilityDevelopment(db, source, prior, 'defender_locomotion');
      }
      return value;
    });
  };
  const metadata = (row: HistoryRow): void => {
    const source = { sourceId: row.source_id, sourceVersion: row.source_version, capability: row.capability,
      careerId: row.career_id, playerId: row.player_id, personLinkSourceId: row.person_link_source_id,
      fieldingModelSourceId: row.fielding_model_source_id, acceptedAtDay: row.accepted_at_day };
    const check = (column: string, path: readonly string[], expected: Readonly<Record<string, string | number>>): void => {
      const owners = nodes(column, path);
      const entry = db.prepare(`SELECT
        (SELECT count(*) FROM (${owners})) AS n,
        (SELECT owner.type FROM (${owners}) owner) AS type,
        (SELECT CASE WHEN owner.type='object' THEN ${projection('owner.value', Object.keys(expected))} END
          FROM (${owners}) owner) AS identity
        FROM ${row.owner_table} WHERE source_id=?`)
        .get(row.source_id) as { n: number; type: string; identity: string | null } | undefined;
      if (!entry || entry.n !== 1 || entry.type !== 'object' || !matches(entry.identity, expected)) {
        throw new Error('Player locomotion ownership metadata differs');
      }
    };
    check('source_json', [], source);
    check('snapshot_json', ['source'], source);
    // A duplicate ancestor may have only one populated child; checking leaf counts alone misses it.
    check('snapshot_json', ['fieldingModel'], {});
    check('snapshot_json', ['fieldingModel', 'source'], { sourceId: row.fielding_model_source_id,
      careerId: row.career_id, playerId: row.player_id, personLinkSourceId: row.person_link_source_id });
    check('snapshot_json', ['fieldingModel', 'person'], { sourceId: row.person_link_source_id,
      careerId: row.career_id, playerId: row.player_id });
  };
  const tables = () => [baselineTable, ...(bodyCompositionTableInstalled(db, developmentTable) ? [developmentTable] : [])];
  const claims = (row: HistoryRow) => {
    metadata(row);
    const source = input(JSON.parse(row.source_json), row.source_id), archived = JSON.parse(row.snapshot_json) as DurablePlayerLocomotionModel;
    if (!archived || Object.keys(archived).sort().join('|') !== ['source', 'fieldingModel'].sort().join('|')
      || json(archived.source) !== json(source) || (row.owner_table === developmentTable) !== !!source.developmentProvenance) {
      throw new Error('invalid original Player locomotion development archive');
    }
    if (row.career_id !== source.careerId || row.player_id !== source.playerId
        || row.source_version !== source.sourceVersion || row.capability !== source.capability || row.person_link_source_id !== source.personLinkSourceId
        || row.fielding_model_source_id !== source.fieldingModelSourceId || row.accepted_at_day !== source.acceptedAtDay
        || row.source_json !== json(source) || row.source_hash !== hash(source)
        || row.snapshot_json !== json(archived) || row.snapshot_hash !== hash(archived)) throw new Error('corrupt original Player locomotion model archive');
    return { row, source };
  };
  const scope = (careerId: string, playerId: string) => {
    const rows = tables().flatMap(table => db.prepare(`SELECT *, '${table}' AS owner_table FROM ${table} WHERE (career_id=? AND player_id=?)
      OR ${scopeClaim('source_json', [])}
      OR ${scopeClaim('snapshot_json', ['source'])}
      OR ${scopeClaim('snapshot_json', ['fieldingModel', 'source'])}
      OR ${scopeClaim('snapshot_json', ['fieldingModel', 'person'])}`)
      .all(careerId, playerId, careerId, playerId, careerId, playerId, careerId, playerId, careerId, playerId) as HistoryRow[]);
    const values = rows.map(claims).sort((a, b) => a.source.acceptedAtDay - b.source.acceptedAtDay);
    for (const [index, value] of values.entries()) {
      const prior = values[index - 1], p = value.source.developmentProvenance;
      if (value.source.careerId !== careerId || value.source.playerId !== playerId
        || (!prior ? !!p : !p || prior.source.acceptedAtDay >= value.source.acceptedAtDay
          || p.originalModelRef.sourceId !== prior.source.sourceId || p.originalModelRef.sourceVersion !== prior.source.sourceVersion
          || p.originalModelSourceHash !== prior.row.source_hash || p.originalModelSnapshotHash !== prior.row.snapshot_hash)) {
        throw new Error('Player locomotion baseline scope or development history differs');
      }
    }
    return values;
  };
  const read = (sourceId: string): DurablePlayerLocomotionModel | null => {
    if (!id(sourceId)) throw new Error('invalid Player locomotion model scope');
    const rows = tables().flatMap(table => db.prepare(`SELECT *, '${table}' AS owner_table FROM ${table} WHERE source_id=?
      OR ${sourceClaim('source_json', ['sourceId'])} OR ${sourceClaim('snapshot_json', ['source', 'sourceId'])}`)
      .all(sourceId, sourceId, sourceId) as HistoryRow[]);
    if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('Player locomotion Source ownership scope differs');
    if (!rows.length) return null;
    const { source } = claims(rows[0]); scope(source.careerId, source.playerId);
    const value = derive(source);
    if (rows[0].snapshot_json !== json(value)) throw new Error('corrupt original Player locomotion model archive');
    return value;
  };
  const selectAtDay = (careerId: string, playerId: string, atDay: number): DurablePlayerLocomotionModel => {
    if (!id(careerId) || !id(playerId) || !day(atDay)) throw new Error('invalid Player locomotion model day');
    const selected = scope(careerId, playerId).filter(value => value.source.acceptedAtDay <= atDay).at(-1);
    if (!selected) throw new Error('accepted Player locomotion baseline is missing or from a future day');
    return read(selected.source.sourceId)!;
  };
  const before = (raw: DurablePlayerLocomotionModel): void => {
    const value = cloneInert(raw);
    if (!fields(value, ['source', 'fieldingModel'])) throw new Error('invalid Player locomotion snapshot fields');
    input(value.source);
    const current = scope(value.source.careerId, value.source.playerId).at(-1), p = value.source.developmentProvenance;
    if (p ? !current || current.source.sourceId !== p.originalModelRef.sourceId || current.source.acceptedAtDay >= value.source.acceptedAtDay : !!current) {
      throw new Error('Player locomotion baseline already exists or development predecessor differs');
    }
    if (json(derive(value.source)) !== json(value)) throw new Error('Player locomotion original changed before write');
  };
  const after = (raw: DurablePlayerLocomotionModel) => {
    const value = cloneInert(raw);
    if (!fields(value, ['source', 'fieldingModel'])) throw new Error('invalid Player locomotion snapshot fields');
    input(value.source);
    if (scope(value.source.careerId, value.source.playerId).at(-1)?.source.sourceId !== value.source.sourceId) {
      throw new Error('accepted model history changed during insertion');
    }
  };
  const snapshot = <T>(body: () => T): T => {
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    return db instanceof DatabaseSync ? withBodyCompositionTransaction(db, false, body) : body();
  };
  return { derive, before, after, read: (id: string) => snapshot(() => read(id)),
    selectAtDay: (career: string, player: string, day: number) => snapshot(() => selectAtDay(career, player, day)) };
};

/** Append-only accepted development keeps the original baseline table and bytes. */
export const openSqlitePlayerLocomotionModelStore = (path: string, authority?: Authority): SqlitePlayerLocomotionModelStore => {
  if (!id(path) || authority != null && typeof authority.readAcceptedModel !== 'function') throw new Error('invalid Player locomotion model sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_player_locomotion_models (
    source_id TEXT PRIMARY KEY, source_version TEXT NOT NULL, capability TEXT NOT NULL, career_id TEXT NOT NULL, player_id TEXT NOT NULL,
    person_link_source_id TEXT NOT NULL, fielding_model_source_id TEXT NOT NULL, accepted_at_day INTEGER NOT NULL,
    source_json TEXT NOT NULL, source_hash TEXT NOT NULL, snapshot_json TEXT NOT NULL, snapshot_hash TEXT NOT NULL,
    UNIQUE(career_id,player_id));`);
  db.exec(`CREATE TABLE IF NOT EXISTS world_player_locomotion_model_developments (
    source_id TEXT PRIMARY KEY, source_version TEXT NOT NULL, capability TEXT NOT NULL, career_id TEXT NOT NULL, player_id TEXT NOT NULL,
    person_link_source_id TEXT NOT NULL, fielding_model_source_id TEXT NOT NULL, accepted_at_day INTEGER NOT NULL,
    source_json TEXT NOT NULL, source_hash TEXT NOT NULL, snapshot_json TEXT NOT NULL, snapshot_hash TEXT NOT NULL,
    UNIQUE(career_id,player_id,accepted_at_day));`);
  const own = playerLocomotionModelEvidenceFromSqlite(db);
  let closed = false;
  const check = (): void => { if (closed) throw new Error('closed Player locomotion model store'); };
  return Object.freeze({
    read(sourceId) { check(); return own.read(sourceId); },
    selectAtDay(careerId, playerId, atDay) { check(); return own.selectAtDay(careerId, playerId, atDay); },
    accept(sourceId) {
      check(); return withBodyCompositionTransaction(db, true, () => {
        const prior = own.read(sourceId), raw = authority?.readAcceptedModel(sourceId) ?? null;
        const source = raw === null ? null : input(raw, sourceId);
        if (prior) {
          if (source && json(source) !== json(prior.source)) throw new Error('Player locomotion Source is frozen differently');
          const original = own.read(sourceId);
          if (!original || json(original) !== json(prior)) throw new Error('Player locomotion original changed during retry');
          return original;
        }
        if (!source) throw new Error('accepted Player locomotion model Source is missing');
        const value = own.derive(source);
        own.before(value);
        const table = source.developmentProvenance ? developmentTable : baselineTable;
        db.prepare(`INSERT INTO ${table} VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(sourceId, source.sourceVersion, source.capability,
          source.careerId, source.playerId, source.personLinkSourceId, source.fieldingModelSourceId, source.acceptedAtDay,
          json(source), hash(source), json(value), hash(value));
        const saved = own.read(sourceId);
        if (!saved || json(saved) !== json(value)) throw new Error('Player locomotion original changed during write');
        own.after(saved); return saved;
      });
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
