import { createRequire } from 'node:module';
import { sqliteJsonMetadataNodes as metadataNodes } from './SqliteOwnershipMetadata';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerPersonLinkEvidenceFromSqlite } from './SqlitePlayerPersonLinkStore';
import { playerFieldingModelEvidenceFromSqlite, type DurablePlayerFieldingModel } from './SqlitePlayerFieldingModelStore';

export type ReceivedCallPolicyPriorities = Readonly<{ ballPursuitPriority: number; holdPriority: number }>;

/** All values are explicit accepted inputs; sourceVersion identifies explicit import provenance, never calibration or production certification. */
export type AcceptedReceivedUmpireDefenderPolicyData = Readonly<{
  sourceId: string;
  sourceVersion: string;
  careerId: string;
  playerId: string;
  personLinkSourceId: string;
  fieldingModelSourceId: string;
  acceptedAtDay: number;
  capability: 'received_umpire_defender_policy_data_v1';
  provenance: 'explicit_imported_policy_data_v1';
  profiles: Readonly<{ out: ReceivedCallPolicyPriorities | null; safe: ReceivedCallPolicyPriorities | null }>;
}>;
export type DurableReceivedUmpireDefenderPolicyData = Readonly<{
  source: AcceptedReceivedUmpireDefenderPolicyData;
  fieldingModel: DurablePlayerFieldingModel;
}>;
export type SqliteReceivedUmpireDefenderPolicyDataStore = Readonly<{
  accept(sourceId: string): DurableReceivedUmpireDefenderPolicyData;
  read(sourceId: string): DurableReceivedUmpireDefenderPolicyData | null;
  close(): void;
}>;
type Authority = Readonly<{ readAcceptedPolicyData(sourceId: string): AcceptedReceivedUmpireDefenderPolicyData | null }>;
type Row = {
  source_id: string; source_version: string; career_id: string; player_id: string;
  person_link_source_id: string; fielding_model_source_id: string; accepted_at_day: number;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string;
};
// Keep Player pairs in the same exact owner container while enumerating every
// duplicate leaf/container. Canonical archive validation below rejects ambiguity.
const playerClaim = (document: string, path: readonly string[], identity: 'playerId' | 'personId' = 'playerId'): string => `EXISTS (
  SELECT 1 FROM (${metadataNodes(document, path)}) owner,
    json_each(CASE WHEN owner.type='object' THEN owner.value ELSE '{}' END) career,
    json_each(CASE WHEN owner.type='object' THEN owner.value ELSE '{}' END) player
  WHERE career.key='careerId' AND career.type='text' AND career.atom=?
    AND player.key='${identity}' AND player.type='text' AND player.atom=?)`;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;
const fields = (value: unknown, names: readonly string[]): boolean => value !== null && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...names].sort());
const input = (raw: AcceptedReceivedUmpireDefenderPolicyData, sourceId?: string): AcceptedReceivedUmpireDefenderPolicyData => {
  const source = cloneInert(raw);
  if (!fields(source, ['sourceId', 'sourceVersion', 'careerId', 'playerId', 'personLinkSourceId', 'fieldingModelSourceId', 'acceptedAtDay', 'capability', 'provenance', 'profiles'])
    || sourceId !== undefined && source.sourceId !== sourceId
    || ![source.sourceId, source.sourceVersion, source.careerId, source.playerId, source.personLinkSourceId, source.fieldingModelSourceId].every(id)
    || !day(source.acceptedAtDay) || source.capability !== 'received_umpire_defender_policy_data_v1'
    || source.provenance !== 'explicit_imported_policy_data_v1' || !fields(source.profiles, ['out', 'safe'])
    || !Object.values(source.profiles).every(profile => profile === null || fields(profile, ['ballPursuitPriority', 'holdPriority'])
      && Object.values(profile).every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1))) throw new Error('invalid accepted received policy data model Source');
  return freeze(source);
};

/** Reconstructs the exact immutable fielding Source and its original Player/Person link, never a peer-supplied profile. */
const receivedUmpireDefenderPolicyDataOwner = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>) => {
  const fielding = playerFieldingModelEvidenceFromSqlite(db);
  const selectedDependencyClaims = (source: AcceptedReceivedUmpireDefenderPolicyData, person: DurablePlayerFieldingModel['person']) => {
    // Legacy readers authenticate their indexed row. Here, only the consumed
    // intake/Player/Person and Career are also reserved by every raw claim.
    const people = db.prepare(`SELECT source_id FROM main.world_player_person_links WHERE source_id=?
      OR (career_id=? AND (player_id=? OR person_id=?))
      OR EXISTS (SELECT 1 FROM (${metadataNodes('source_json', ['sourceId'])}) claim WHERE claim.type='text' AND claim.atom=?)
      OR ${playerClaim('source_json', [])}
      OR ${playerClaim('source_json', [], 'personId')}`)
      .all(source.personLinkSourceId, source.careerId, source.playerId, person.personId, source.personLinkSourceId,
        source.careerId, source.playerId, source.careerId, person.personId);
    if (people.length !== 1 || people[0].source_id !== source.personLinkSourceId) throw new Error('received policy original Person ownership claims differ');
    const rosters = db.prepare(`SELECT career_id FROM main.world_roster_heads WHERE career_id=?
      OR EXISTS (SELECT 1 FROM (${metadataNodes('roster_json', ['careerId'])}) claim WHERE claim.type='text' AND claim.atom=?)`)
      .all(source.careerId, source.careerId);
    if (rosters.length !== 1 || rosters[0].career_id !== source.careerId) throw new Error('received policy original roster ownership claims differ');
  };
  const derive = (raw: AcceptedReceivedUmpireDefenderPolicyData): DurableReceivedUmpireDefenderPolicyData => {
    const source = input(raw);
    for (const table of ['world_player_fielding_models', 'world_player_person_links', 'world_roster_heads']) {
      const schema = db.prepare('SELECT type FROM main.sqlite_master WHERE name=?').all(table);
      if (schema.length !== 1 || schema[0].type !== 'table') throw new Error('received policy original owner schema differs');
      const expected = table === 'world_roster_heads' ? [['career_id']]
        : [['source_id'], ['career_id', 'player_id'], ...(table === 'world_player_person_links' ? [['career_id', 'person_id']] : [])];
      const unique = db.prepare(`PRAGMA main.index_list(${table})`).all()
        .filter(index => index.unique === 1 && index.partial === 0 && (index.origin === 'pk' || index.origin === 'u'))
        .map(index => db.prepare('SELECT name FROM pragma_index_info(?) ORDER BY seqno').all(index.name).map(column => column.name));
      const primary = db.prepare(`PRAGMA main.table_info(${table})`).all().filter(column => Number(column.pk) > 0)
        .sort((a, b) => Number(a.pk) - Number(b.pk)).map(column => column.name);
      if (json(primary) !== json(expected[0]) || json(unique.map(columns => json(columns)).sort()) !== json(expected.map(columns => json(columns)).sort())) {
        throw new Error('received policy original owner uniqueness schema differs');
      }
    }
    const fieldingModel = fielding.read(source.fieldingModelSourceId);
    const person = playerPersonLinkEvidenceFromSqlite(db).readLink(source.personLinkSourceId);
    if (!fieldingModel || fieldingModel.source.careerId !== source.careerId || fieldingModel.source.playerId !== source.playerId
      || fieldingModel.source.personLinkSourceId !== source.personLinkSourceId || fieldingModel.person.sourceId !== source.personLinkSourceId
      || !person || json(person) !== json(fieldingModel.person)
      || source.acceptedAtDay < fieldingModel.source.acceptedAtDay) throw new Error('received policy data model original fielding/Person scope differs');
    selectedDependencyClaims(source, person);
    return freeze({ source, fieldingModel });
  };
  const scope = (careerId: string, playerId: string): readonly DurableReceivedUmpireDefenderPolicyData[] => {
    // Each ownership mirror participates, including pinned nested fielding/Person snapshots.
    // Jointly changing the index and Source must not hide an archived original Player baseline.
    const rows = db.prepare(`SELECT * FROM main.world_received_umpire_defender_policy_data WHERE (career_id=? AND player_id=?)
      OR ${playerClaim('source_json', [])}
      OR ${playerClaim('snapshot_json', ['source'])}
      OR ${playerClaim('snapshot_json', ['fieldingModel', 'source'])}
      OR ${playerClaim('snapshot_json', ['fieldingModel', 'person'])}`)
      .all(careerId, playerId, careerId, playerId, careerId, playerId, careerId, playerId, careerId, playerId) as Row[];
    if (rows.length > 1) throw new Error('received policy data baseline scope differs');
    return rows.map((row) => {
      const source = input(JSON.parse(row.source_json) as AcceptedReceivedUmpireDefenderPolicyData, row.source_id), value = derive(source);
      if (source.careerId !== careerId || source.playerId !== playerId || row.career_id !== careerId || row.player_id !== playerId
        || row.source_version !== source.sourceVersion || row.person_link_source_id !== source.personLinkSourceId
        || row.fielding_model_source_id !== source.fieldingModelSourceId || row.accepted_at_day !== source.acceptedAtDay
        || row.source_json !== json(source) || row.source_hash !== hash(source)
        || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt original received policy data model archive');
      return value;
    });
  };
  const read = (sourceId: string): DurableReceivedUmpireDefenderPolicyData | null => {
    if (!id(sourceId)) throw new Error('invalid received policy data model scope');
    const rows = db.prepare(`SELECT * FROM main.world_received_umpire_defender_policy_data WHERE source_id=?
      OR EXISTS (SELECT 1 FROM (${metadataNodes('source_json', ['sourceId'])}) claim WHERE claim.type='text' AND claim.atom=?)
      OR EXISTS (SELECT 1 FROM (${metadataNodes('snapshot_json', ['source', 'sourceId'])}) claim WHERE claim.type='text' AND claim.atom=?)`)
      .all(sourceId, sourceId, sourceId) as Row[];
    if (rows.length > 1) throw new Error('received policy data Source ownership scope differs');
    const row = rows[0];
    if (!row) return null;
    if (row.source_id !== sourceId) throw new Error('received policy data Source identity mirror differs');
    const source = input(JSON.parse(row.source_json) as AcceptedReceivedUmpireDefenderPolicyData, sourceId);
    const value = scope(source.careerId, source.playerId)[0];
    if (!value || value.source.sourceId !== sourceId) throw new Error('received policy data model is outside its own baseline');
    return value;
  };
  const before = (raw: DurableReceivedUmpireDefenderPolicyData): void => {
    const value = cloneInert(raw);
    if (scope(value.source.careerId, value.source.playerId).length) throw new Error('received policy data baseline already exists');
    if (json(derive(value.source)) !== json(value)) throw new Error('received policy data original changed before write');
  };
  return { derive, read, before };
};

const table = 'world_received_umpire_defender_policy_data';
const schemaSql = `CREATE TABLE world_received_umpire_defender_policy_data (
    source_id TEXT PRIMARY KEY, source_version TEXT NOT NULL, career_id TEXT NOT NULL, player_id TEXT NOT NULL,
    person_link_source_id TEXT NOT NULL, fielding_model_source_id TEXT NOT NULL, accepted_at_day INTEGER NOT NULL,
    source_json TEXT NOT NULL, source_hash TEXT NOT NULL, snapshot_json TEXT NOT NULL, snapshot_hash TEXT NOT NULL,
    UNIQUE(career_id,player_id))`;
const normalizedSql = (sql: string) => sql.replace(/\s+/g, ' ').trim();
type Db = import('node:sqlite').DatabaseSync;
const assertSchema = (db: Db): void => {
  const rows = db.prepare('SELECT type,name,sql FROM main.sqlite_master WHERE tbl_name=? ORDER BY name').all(table);
  const own = rows.filter(row => row.name === table);
  if (own.length !== 1 || own[0].type !== 'table' || typeof own[0].sql !== 'string'
    || normalizedSql(own[0].sql) !== normalizedSql(schemaSql)
    || rows.length !== 3 || rows.some(row => row.name !== table && (row.type !== 'index' || row.sql !== null))) {
    throw new Error('received policy data owner schema differs');
  }
  // The original owners use unqualified names. They must resolve only to main.
  if (db.prepare('PRAGMA database_list').all().some(row => row.name !== 'main' && row.name !== 'temp')
    || db.prepare("SELECT name FROM temp.sqlite_master WHERE type IN ('table','view') LIMIT 1").get()) {
    throw new Error('received policy data requires main-only authority schema');
  }
};

/** Inert, one immutable baseline per Player. Import provenance supplies no live availability or production certification. */
export const openSqliteReceivedUmpireDefenderPolicyDataStore = (path: string, authority?: Authority): SqliteReceivedUmpireDefenderPolicyDataStore => {
  if (!id(path) || authority != null && typeof authority.readAcceptedPolicyData !== 'function') throw new Error('invalid received policy data sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
    db.exec('BEGIN IMMEDIATE');
    if (!db.prepare('SELECT name FROM main.sqlite_master WHERE name=?').get(table)) db.exec(schemaSql);
    assertSchema(db);
    db.exec('COMMIT');
    if (db.isTransaction) throw new Error('received policy schema transaction remains active');
    assertSchema(db);
  } catch (error) {
    try { if (db.isTransaction) db.exec('ROLLBACK'); } finally { db.close(); }
    throw error;
  }
  const own = receivedUmpireDefenderPolicyDataOwner(db);
  let closed = false, busy = false;
  const retire = () => { if (!closed) { closed = true; db.close(); } };
  const check = () => { if (closed) throw new Error('closed received policy data store'); };
  const counters = () => [db.prepare('SELECT total_changes() AS n').get()!.n,
    db.prepare('PRAGMA main.schema_version').get()!.schema_version,
    db.prepare('PRAGMA temp.schema_version').get()!.schema_version];
  const account = (before: ReturnType<typeof counters>, added: number) => {
    const after = counters();
    if (typeof before[0] !== 'number' || !Number.isSafeInteger(before[0] + added) || after[0] !== before[0] + added
      || after[1] !== before[1] || after[2] !== before[2]) throw new Error('received policy data write accounting or schema changed');
  };
  const cleanup = (error: unknown): never => {
    try {
      if (!db.isTransaction) { retire(); throw error; }
      db.exec('ROLLBACK');
      if (db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 0) {
        retire(); throw new Error('received policy data cleanup state differs', { cause: error });
      }
    } catch (cleanupError) {
      retire();
      if (cleanupError !== error) throw new AggregateError([error, cleanupError], 'received policy data rollback failed');
    }
    throw error;
  };
  const proof = <T>(body: () => T): T => {
    if (!db.isTransaction) throw new Error('received policy data proof transaction missing');
    const before = counters(), queryOnly = db.prepare('PRAGMA query_only').get()!.query_only;
    if (queryOnly !== 0) throw new Error('received policy data query_only state differs');
    db.exec('SAVEPOINT received_policy_data_proof');
    db.exec('PRAGMA query_only=1');
    try {
      assertSchema(db);
      const value = body();
      if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1) throw new Error('received policy data proof state changed');
      account(before, 0);
      db.exec('RELEASE received_policy_data_proof');
      if (!db.isTransaction) throw new Error('received policy data proof transaction disappeared');
      account(before, 0);
      return value;
    } finally { db.exec('PRAGMA query_only=0'); }
  };
  const snapshot = <T>(body: () => T): T => {
    const before = counters();
    try {
      db.exec('BEGIN');
      const value = proof(body); account(before, 0);
      db.exec('COMMIT');
      if (db.isTransaction) throw new Error('received policy data read transaction remains active');
      account(before, 0);
      return value;
    } catch (error) { return cleanup(error); }
  };
  const use = <T>(body: () => T): T => {
    check(); if (busy) throw new Error('received policy data store re-entry');
    busy = true; try { return body(); } finally { busy = false; }
  };
  const accepted = (sourceId: string) => {
    const raw = authority?.readAcceptedPolicyData(sourceId) ?? null;
    return raw === null ? null : input(raw, sourceId);
  };
  return Object.freeze({
    read(sourceId) { return use(() => snapshot(() => own.read(sourceId))); },
    accept(sourceId) { return use(() => {
      const prior = snapshot(() => own.read(sourceId)), source = accepted(sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('received policy data Source is frozen differently');
        return snapshot(() => {
          const original = own.read(sourceId);
          if (!original || json(original) !== json(prior)) throw new Error('received policy data original changed during retry');
          return original;
        });
      }
      if (!source) throw new Error('accepted received policy data Source is missing');
      const value = snapshot(() => { const value = own.derive(source); own.before(value); return value; });
      // External callbacks finish before the write; their result must remain exact.
      if (json(accepted(sourceId)) !== json(source)) throw new Error('received policy data Source changed after preflight');
      const before = counters();
      try {
        db.exec('BEGIN IMMEDIATE');
        proof(() => own.before(value)); account(before, 0);
        const result = db.prepare('INSERT INTO main.world_received_umpire_defender_policy_data VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
          sourceId, source.sourceVersion, source.careerId, source.playerId, source.personLinkSourceId, source.fieldingModelSourceId,
          source.acceptedAtDay, json(source), hash(source), json(value), hash(value));
        if (result.changes !== 1) throw new Error('received policy data own INSERT differs');
        account(before, 1);
        const saved = proof(() => own.read(sourceId));
        if (!saved || json(saved) !== json(value)) throw new Error('received policy data original changed during write');
        account(before, 1);
        const durableRow = db.prepare('SELECT * FROM main.world_received_umpire_defender_policy_data WHERE source_id=?').get(sourceId);
        if (!db.isTransaction) throw new Error('received policy data write transaction disappeared');
        db.exec('COMMIT');
        // A successful exec call and total_changes do not prove durability: a
        // replaced COMMIT can roll back normally. Read only our exact row here.
        if (db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 0) throw new Error('received policy data commit state differs');
        account(before, 1); assertSchema(db);
        const committed = db.prepare('SELECT * FROM main.world_received_umpire_defender_policy_data WHERE source_id=?').get(sourceId);
        if (!committed || json(committed) !== json(durableRow)) throw new Error('received policy data durable own row differs');
        return saved;
      } catch (error) { return cleanup(error); }
    }); },
    close() { if (busy) throw new Error('received policy data store re-entry'); retire(); },
  });
};
