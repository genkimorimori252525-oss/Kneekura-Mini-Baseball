import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { assertPhysicalCapabilityDevelopment, withPhysicalCapabilityReplay } from './AcceptedPhysicalCapabilityDevelopment';
import { bodyCompositionTableInstalled, withBodyCompositionTransaction } from './BodyMaterializationSqliteOwnership';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection,
  sqliteJsonMetadataMatches as matches } from './SqliteOwnershipMetadata';
import { playerRunnerDecisionMotionModelInput as input, runnerModelId as id, runnerModelDay as day,
  type AcceptedPlayerRunnerDecisionMotionModel } from './PlayerRunnerDecisionMotionModel';
export type { AcceptedPlayerRunnerDecisionMotionModel } from './PlayerRunnerDecisionMotionModel';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerPersonLinkEvidenceFromSqlite, type DurablePlayerPersonLink } from './SqlitePlayerPersonLinkStore';

export type DurablePlayerRunnerDecisionMotionModel = Readonly<{
  source: AcceptedPlayerRunnerDecisionMotionModel;
  person: DurablePlayerPersonLink;
}>;
export type SqlitePlayerRunnerDecisionMotionModelStore = Readonly<{
  accept(sourceId: string): DurablePlayerRunnerDecisionMotionModel;
  read(sourceId: string): DurablePlayerRunnerDecisionMotionModel | null;
  selectAtDay(careerId: string, playerId: string, atDay: number): DurablePlayerRunnerDecisionMotionModel;
  close(): void;
}>;
type Authority = Readonly<{ readAcceptedModel(sourceId: string): AcceptedPlayerRunnerDecisionMotionModel | null }>;
type Row = {
  source_id: string; source_version: string; capability: string; career_id: string; player_id: string;
  person_link_source_id: string; accepted_at_day: number;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string;
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

const baselineTable = 'world_player_runner_decision_motion_models';
const developmentTable = 'world_player_runner_decision_motion_developments';
type HistoryRow = Row & { owner_table: string };

/** Reconstructs explicit runner parameters and their original Player/Person link; no defender model or live truth dependency. */
export const playerRunnerDecisionMotionModelEvidenceFromSqlite = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>) => {
  const derive = (raw: AcceptedPlayerRunnerDecisionMotionModel): DurablePlayerRunnerDecisionMotionModel => {
    const source = input(raw);
    return withPhysicalCapabilityReplay(db, 'runner_decision_motion', source.sourceId, () => {
      const person = playerPersonLinkEvidenceFromSqlite(db).readLink(source.personLinkSourceId);
      if (!person || person.sourceId !== source.personLinkSourceId || person.careerId !== source.careerId
        || person.playerId !== source.playerId || source.acceptedAtDay < person.acceptedAtDay) {
        throw new Error('runner decision-motion model original Person scope or day differs');
      }
      const value = freeze({ source, person });
      if (source.developmentProvenance) {
        const prior = read(source.developmentProvenance.originalModelRef.sourceId);
        if (!prior) throw new Error('original runner decision-motion development model is missing');
        assertPhysicalCapabilityDevelopment(db, source, prior, 'runner_decision_motion');
      }
      return value;
    });
  };
  const metadata = (row: HistoryRow): void => {
    const source = { sourceId: row.source_id, sourceVersion: row.source_version, capability: row.capability,
      careerId: row.career_id, playerId: row.player_id, personLinkSourceId: row.person_link_source_id,
      acceptedAtDay: row.accepted_at_day };
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
        throw new Error('Player runner decision-motion ownership metadata differs');
      }
    };
    check('source_json', [], source);
    check('snapshot_json', ['source'], source);
    check('snapshot_json', ['person'], { sourceId: row.person_link_source_id,
      careerId: row.career_id, playerId: row.player_id });
  };
  const tables = () => [baselineTable, ...(bodyCompositionTableInstalled(db, developmentTable) ? [developmentTable] : [])];
  const claims = (row: HistoryRow) => {
    metadata(row);
    const source = input(JSON.parse(row.source_json), row.source_id), archived = JSON.parse(row.snapshot_json) as DurablePlayerRunnerDecisionMotionModel;
    if (!archived || Object.keys(archived).sort().join('|') !== ['source', 'person'].sort().join('|')
      || json(archived.source) !== json(source) || (row.owner_table === developmentTable) !== !!source.developmentProvenance) {
      throw new Error('invalid original Player runner decision-motion development archive');
    }
    if (row.career_id !== source.careerId || row.player_id !== source.playerId
        || row.source_version !== source.sourceVersion || row.capability !== source.capability || row.person_link_source_id !== source.personLinkSourceId
        || row.accepted_at_day !== source.acceptedAtDay
        || row.source_json !== json(source) || row.source_hash !== hash(source)
        || row.snapshot_json !== json(archived) || row.snapshot_hash !== hash(archived)) throw new Error('corrupt original Player runner decision-motion model archive');
    return { row, source };
  };
  const scope = (careerId: string, playerId: string) => {
    const rows = tables().flatMap(table => db.prepare(`SELECT *, '${table}' AS owner_table FROM ${table} WHERE (career_id=? AND player_id=?)
      OR ${scopeClaim('source_json', [])}
      OR ${scopeClaim('snapshot_json', ['source'])}
      OR ${scopeClaim('snapshot_json', ['person'])}`)
      .all(careerId, playerId, careerId, playerId, careerId, playerId, careerId, playerId) as HistoryRow[]);
    const values = rows.map(claims).sort((a, b) => a.source.acceptedAtDay - b.source.acceptedAtDay);
    for (const [index, value] of values.entries()) {
      const prior = values[index - 1], p = value.source.developmentProvenance;
      if (value.source.careerId !== careerId || value.source.playerId !== playerId
        || (!prior ? !!p : !p || prior.source.acceptedAtDay >= value.source.acceptedAtDay
          || p.originalModelRef.sourceId !== prior.source.sourceId || p.originalModelRef.sourceVersion !== prior.source.sourceVersion
          || p.originalModelSourceHash !== prior.row.source_hash || p.originalModelSnapshotHash !== prior.row.snapshot_hash)) {
        throw new Error('Player runner decision-motion baseline scope or development history differs');
      }
    }
    return values;
  };
  const read = (sourceId: string): DurablePlayerRunnerDecisionMotionModel | null => {
    if (!id(sourceId)) throw new Error('invalid Player runner decision-motion model scope');
    const rows = tables().flatMap(table => db.prepare(`SELECT *, '${table}' AS owner_table FROM ${table} WHERE source_id=?
      OR ${sourceClaim('source_json', ['sourceId'])} OR ${sourceClaim('snapshot_json', ['source', 'sourceId'])}`)
      .all(sourceId, sourceId, sourceId) as HistoryRow[]);
    if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('Player runner decision-motion Source ownership scope differs');
    if (!rows.length) return null;
    const { source } = claims(rows[0]); scope(source.careerId, source.playerId);
    const value = derive(source);
    if (rows[0].snapshot_json !== json(value)) throw new Error('corrupt original Player runner decision-motion model archive');
    return value;
  };
  const selectAtDay = (careerId: string, playerId: string, atDay: number): DurablePlayerRunnerDecisionMotionModel => {
    if (!id(careerId) || !id(playerId) || !day(atDay)) throw new Error('invalid Player runner decision-motion model day');
    const selected = scope(careerId, playerId).filter(value => value.source.acceptedAtDay <= atDay).at(-1);
    if (!selected) throw new Error('accepted Player runner decision-motion baseline is missing or from a future day');
    return read(selected.source.sourceId)!;
  };
  const before = (raw: DurablePlayerRunnerDecisionMotionModel): void => {
    const value = cloneInert(raw);
    input(value.source);
    const current = scope(value.source.careerId, value.source.playerId).at(-1), p = value.source.developmentProvenance;
    if (p ? !current || current.source.sourceId !== p.originalModelRef.sourceId || current.source.acceptedAtDay >= value.source.acceptedAtDay : !!current) {
      throw new Error('Player runner decision-motion baseline already exists or development predecessor differs');
    }
    if (json(derive(value.source)) !== json(value)) throw new Error('Player runner decision-motion original changed before write');
  };
  const after = (raw: DurablePlayerRunnerDecisionMotionModel) => {
    const value = cloneInert(raw);
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
export const openSqlitePlayerRunnerDecisionMotionModelStore = (path: string, authority?: Authority): SqlitePlayerRunnerDecisionMotionModelStore => {
  if (!id(path) || authority != null && typeof authority.readAcceptedModel !== 'function') throw new Error('invalid Player runner decision-motion model sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_player_runner_decision_motion_models (
    source_id TEXT PRIMARY KEY, source_version TEXT NOT NULL, capability TEXT NOT NULL, career_id TEXT NOT NULL, player_id TEXT NOT NULL,
    person_link_source_id TEXT NOT NULL, accepted_at_day INTEGER NOT NULL,
    source_json TEXT NOT NULL, source_hash TEXT NOT NULL, snapshot_json TEXT NOT NULL, snapshot_hash TEXT NOT NULL,
    UNIQUE(career_id,player_id));`);
  db.exec(`CREATE TABLE IF NOT EXISTS world_player_runner_decision_motion_developments (
    source_id TEXT PRIMARY KEY, source_version TEXT NOT NULL, capability TEXT NOT NULL, career_id TEXT NOT NULL, player_id TEXT NOT NULL,
    person_link_source_id TEXT NOT NULL, accepted_at_day INTEGER NOT NULL,
    source_json TEXT NOT NULL, source_hash TEXT NOT NULL, snapshot_json TEXT NOT NULL, snapshot_hash TEXT NOT NULL,
    UNIQUE(career_id,player_id,accepted_at_day));`);
  const own = playerRunnerDecisionMotionModelEvidenceFromSqlite(db);
  let closed = false;
  const check = (): void => { if (closed) throw new Error('closed Player runner decision-motion model store'); };
  return Object.freeze({
    read(sourceId) { check(); return own.read(sourceId); },
    selectAtDay(careerId, playerId, atDay) { check(); return own.selectAtDay(careerId, playerId, atDay); },
    accept(sourceId) {
      check(); return withBodyCompositionTransaction(db, true, () => {
        const prior = own.read(sourceId), raw = authority?.readAcceptedModel(sourceId) ?? null;
        const source = raw === null ? null : input(raw, sourceId);
        if (prior) {
          if (source && json(source) !== json(prior.source)) throw new Error('Player runner decision-motion Source is frozen differently');
          const original = own.read(sourceId);
          if (!original || json(original) !== json(prior)) throw new Error('Player runner decision-motion original changed during retry');
          return original;
        }
        if (!source) throw new Error('accepted Player runner decision-motion model Source is missing');
        const value = own.derive(source);
        own.before(value);
        const table = source.developmentProvenance ? developmentTable : baselineTable;
        db.prepare(`INSERT INTO ${table} VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(sourceId, source.sourceVersion, source.capability,
          source.careerId, source.playerId, source.personLinkSourceId, source.acceptedAtDay,
          json(source), hash(source), json(value), hash(value));
        const saved = own.read(sourceId);
        if (!saved || json(saved) !== json(value)) throw new Error('Player runner decision-motion original changed during write');
        own.after(saved); return saved;
      });
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
