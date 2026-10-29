import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { projectFairPoleRuleSourceV1Input as input, deriveProjectFairPoleRuleRegistrationV1 as derive,
  type AcceptedProjectFairPoleRuleSourceV1, type RegisteredProjectFairPoleRuleSourceV1 } from './RuleSourceRegistryV1';

const table = 'rule_source_registry_v1_sources';
const columns = [
  ['source_id', 'TEXT'], ['source_version', 'TEXT'], ['rule_kind', 'TEXT'], ['evidence_authority', 'TEXT'],
  ['rule_model_id', 'TEXT'], ['rule_model_revision', 'TEXT'], ['rule_profile_id', 'TEXT'], ['rules_revision', 'TEXT'],
  ['interpretation', 'TEXT'], ['available_from_day', 'INTEGER'], ['source_json', 'TEXT'], ['source_hash', 'TEXT'], ['snapshot_json', 'TEXT'], ['snapshot_hash', 'TEXT'],
] as const;
const scopeKeys = ['evidence_authority', 'rule_model_id', 'rule_model_revision', 'rule_profile_id', 'rules_revision', 'interpretation'] as const;
const schema = 'CREATE TABLE ' + table + '(' + columns.map(([name, type], index) => name + ' ' + type + (index === 0 ? ' PRIMARY KEY' : ' NOT NULL')).join(',')
  + ',UNIQUE(' + scopeKeys.join(',') + '))';
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const same = (left: unknown, right: unknown) => { if (json(left) !== json(right)) throw Error('rule Source registry original Source, scope or write differs'); };
type Row = { [K in typeof columns[number][0]]: string | number };
type Pending = Readonly<{ kind: 'pending'; missingAcceptedSourceIds: readonly string[] }>;
export type RuleSourceRegistryReferenceV1 = SamePaReference<typeof table>;
export type RuleSourceRegistryAuthorityV1 = Readonly<{ readAcceptedSource(sourceId: string): unknown }>;
export type SqliteRuleSourceRegistryStore = Readonly<{
  read(sourceId: string): RegisteredProjectFairPoleRuleSourceV1 | null;
  accept(sourceId: string): RegisteredProjectFairPoleRuleSourceV1 | Pending;
  close(): void;
}>;

/** Exact owned table and automatic indexes; triggers cannot exceed the owner's
 * single-row accounting. Read APIs never install or repair storage. */
const storage = (db: DatabaseSync): boolean => withBattedVenueLegalReadSnapshot(db, () => {
  const catalog = db.prepare("SELECT type,name,tbl_name,sql FROM main.sqlite_schema WHERE type IN ('table','view','index') AND (lower(name) GLOB 'rule_source_registry_v1_*' OR lower(tbl_name) GLOB 'rule_source_registry_v1_*')").all();
  if (!catalog.length) return false;
  const fail = (): never => { throw Error('rule Source registry storage is partial or malformed'); };
  const own = catalog.filter(row => row.name === table);
  if (own.length !== 1 || own[0].type !== 'table' || own[0].tbl_name !== table || own[0].sql !== schema) fail();
  const actualColumns = db.prepare('PRAGMA main.table_xinfo(' + table + ')').all();
  if (actualColumns.length !== columns.length || actualColumns.some((column, i) => column.cid !== i || column.name !== columns[i][0]
    || column.type !== columns[i][1] || column.notnull !== (i === 0 ? 0 : 1) || column.dflt_value !== null || column.pk !== (i === 0 ? 1 : 0) || column.hidden !== 0)) fail();
  const indexes = db.prepare('PRAGMA main.index_list(' + table + ')').all(), expected = [['source_id'], [...scopeKeys]];
  if (indexes.length !== expected.length || catalog.length !== 3) fail();
  for (const [i, keys] of expected.entries()) {
    const name = 'sqlite_autoindex_' + table + '_' + (i + 1), entry = indexes.filter(index => index.name === name), row = catalog.filter(r => r.name === name);
    if (entry.length !== 1 || entry[0].unique !== 1 || entry[0].origin !== (i === 0 ? 'pk' : 'u') || entry[0].partial !== 0
      || row.length !== 1 || row[0].type !== 'index' || row[0].tbl_name !== table || row[0].sql !== null) fail();
    const info = db.prepare('PRAGMA main.index_xinfo(' + name + ')').all();
    same(info.filter(value => value.key === 1).map(value => value.name), keys);
    if (info.length !== keys.length + 1 || info.some(value => value.desc !== 0 || value.coll !== 'BINARY') || info.at(-1)?.cid !== -1 || info.at(-1)?.key !== 0) fail();
  }
  return true;
});

const rowFor = (value: RegisteredProjectFairPoleRuleSourceV1): Row => {
  const s = value.source;
  return { source_id: s.sourceId, source_version: s.sourceVersion, rule_kind: s.kind, evidence_authority: s.evidenceAuthority,
    rule_model_id: s.scope.ruleModelId, rule_model_revision: s.scope.ruleModelRevision, rule_profile_id: s.baseProfile.ruleProfileId,
    rules_revision: s.baseProfile.rulesRevision, interpretation: s.interpretation, available_from_day: s.availableFromDay,
    source_json: json(s), source_hash: hash(s), snapshot_json: json(value), snapshot_hash: hash(value) };
};
const owner = (db: DatabaseSync) => {
  const rows = (): Row[] => storage(db) ? db.prepare('SELECT * FROM main.' + table + ' ORDER BY rowid').all() as Row[] : [];
  const claim = (document: string, path: readonly string[]) => `EXISTS (SELECT 1 FROM (${nodes(document, path)}) claim WHERE claim.type='text' AND claim.atom=?)`;
  const identities = (sourceId: string): Row[] => !storage(db) ? [] : db.prepare('SELECT * FROM main.' + table + ' WHERE source_id=? OR '
    + claim('source_json', ['sourceId']) + ' OR ' + claim('snapshot_json', ['source', 'sourceId'])).all(sourceId, sourceId, sourceId) as Row[];
  const scope = (s: AcceptedProjectFairPoleRuleSourceV1): Row[] => {
    if (!storage(db)) return [];
    const paths = [['evidenceAuthority'], ['scope', 'ruleModelId'], ['scope', 'ruleModelRevision'], ['baseProfile', 'ruleProfileId'], ['baseProfile', 'rulesRevision'], ['interpretation']];
    const values = [s.evidenceAuthority, s.scope.ruleModelId, s.scope.ruleModelRevision, s.baseProfile.ruleProfileId, s.baseProfile.rulesRevision, s.interpretation];
    const where = scopeKeys.map((column, i) => '(' + column + '=? OR ' + claim('source_json', paths[i]) + ' OR ' + claim('snapshot_json', ['source', ...paths[i]]) + ')').join(' AND ');
    return db.prepare('SELECT * FROM main.' + table + ' WHERE ' + where).all(...values.flatMap(value => [value, value, value])) as Row[];
  };
  const read = (sourceId: string): RegisteredProjectFairPoleRuleSourceV1 | null => {
    if (!text(sourceId)) throw Error('invalid rule Source registry identity');
    const claims = identities(sourceId); if (claims.length > 1 || claims.length === 1 && claims[0].source_id !== sourceId) throw Error('rule Source registry Source ownership differs');
    const row = claims[0]; if (!row) return null;
    const source = input(JSON.parse(String(row.source_json)), sourceId), value = derive(source, sourceId);
    const scoped = scope(source); if (scoped.length !== 1 || scoped[0].source_id !== sourceId) throw Error('rule Source registry canonical scope differs');
    same(row, rowFor(value)); return value;
  };
  return { rows, scope, read };
};

/** Normal caller-connection evidence. No caller profile/provider or cached proof
 * can substitute for the Source and compiled-profile rederivation. */
export const ruleSourceRegistryEvidenceFromSqlite = (db: DatabaseSync) => {
  const own = owner(db);
  return Object.freeze({
    read: (sourceId: string) => withBattedVenueLegalReadSnapshot(db, () => own.read(sourceId)),
    readReference: (ref: RuleSourceRegistryReferenceV1) => withBattedVenueLegalReadSnapshot(db, () => {
      if (!samePaReferenceValid(ref, table)) throw Error('invalid rule Source registry reference');
      const value = own.read(ref.sourceId); if (!value) return null;
      same(reference(table, value), ref); return value;
    }),
  });
};

/** Registration owns one row only. It neither adopts a Root nor changes a
 * physical/legal/official result; missing declarations remain ordinary pending. */
export const openSqliteRuleSourceRegistryStore = (path: string, authority?: RuleSourceRegistryAuthorityV1): SqliteRuleSourceRegistryStore => {
  if (!text(path) || authority !== undefined && typeof authority.readAcceptedSource !== 'function') throw Error('invalid rule Source registry authority');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  const own = owner(db), tx = battingInvocationTransaction(db, () => storage(db));
  const read = (id: string) => tx.run(false, proof => proof(() => own.read(id)), () => {});
  return Object.freeze({ read,
    accept(id: string) {
      const prior = read(id), raw = authority?.readAcceptedSource(id) ?? null, source = raw === null ? null : input(raw, id);
      if (prior) {
        if (source) same(source, prior.source);
        return tx.run(false, proof => proof(() => { const saved = own.read(id); same(saved, prior); return prior; }), () => {});
      }
      if (!source) return tx.run(false, proof => proof(() => {
        if (own.read(id) !== null) throw Error('rule Source registry changed while resolving a missing declaration');
        return freeze({ kind: 'pending' as const, missingAcceptedSourceIds: [id] });
      }), () => {});
      const preflight = tx.run(false, proof => proof(() => ({ value: derive(source, id), rows: own.rows() })), () => {});
      return tx.run(true, (proof, step) => {
        same(proof(() => ({ value: derive(source, id), rows: own.rows() })), preflight);
        if (!storage(db)) step(() => db.exec(schema), 0, 1);
        if (proof(() => own.scope(source)).length) throw Error('rule Source registry canonical scope alias rejected');
        const row = rowFor(preflight.value), expected = [...preflight.rows, row];
        step(() => {
          const result = db.prepare('INSERT INTO main.' + table + ' VALUES(' + columns.map(() => '?').join(',') + ')').run(...columns.map(([name]) => row[name]));
          if (result.changes !== 1) throw Error('rule Source registry insert row count differs');
        }, 1);
        proof(() => { same(own.read(id), preflight.value); same(own.rows(), expected); });
        return preflight.value;
      }, value => { same(own.read(id), value); same(own.rows(), [...preflight.rows, rowFor(value)]); });
    }, close: tx.close,
  });
};
