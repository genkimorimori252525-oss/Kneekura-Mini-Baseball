import { createRequire } from 'node:module';
import { actualLivePlayId as id } from './ActualLivePlayScope';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection, sqliteJsonMetadataMatches as matches,
  type SqliteJsonMetadataPath } from './SqliteOwnershipMetadata';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type Db = import('node:sqlite').DatabaseSync;
type Table = 'actual_live_play_queue_checkpoints' | 'actual_live_rule_consumptions';
type Row = { source_id: string; ownership_key: string; source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
type Source = Readonly<{ sourceId: string }>;
type Receipt<S extends Source> = Readonly<{ source: S; ownershipKey: string }>;
export type ActualLiveImmutableOwner<S extends Source, V extends Receipt<S>> = Readonly<{
  input(raw: S, sourceId: string): S; derive(source: S, current?: boolean): V;
  ownershipField?: 'captureExecutionSourceId';
}>;
/** The caller owns one snapshot. All rows are reconstructed by the concrete owner. */
export const actualLiveImmutableReceiptEvidenceFromSqlite = <S extends Source, V extends Receipt<S>>(
  db: Pick<Db, 'prepare'>, table: Table, own: ActualLiveImmutableOwner<S, V>) => {
  const assertUnique = (source: S, ownershipKey: string, expectedCount: number) => {
    const field = own.ownershipField;
    const identity = field ? (source as unknown as Record<string, string>)[field] : null;
    const extra = field ? ` OR ${claim('source_json', [field], '$identity')}
      OR ${claim('snapshot_json', ['source', field], '$identity')}
      OR ${claim('snapshot_json', ['history', { array: 'all' }, field], '$identity')}
      OR ${claim('snapshot_json', ['history', field], '$identity')}
      OR ${claim('snapshot_json', ['consumption', 'capture', 'sourceId'], '$identity')}` : '';
    const rows = db.prepare(`SELECT source_id,ownership_key FROM ${table} WHERE ownership_key=$key
      OR ${claim('snapshot_json', ['ownershipKey'], '$key')}${extra}`).all(field ? { key: ownershipKey, identity } : { key: ownershipKey });
    if (rows.length !== expectedCount || rows.some(r => r.source_id !== source.sourceId || r.ownership_key !== ownershipKey)) {
      throw new Error('actual live receipt ownership already consumed or hidden claim differs');
    }
  };
  const readMetadata = (sourceId: string, ownershipKey?: string) => {
    if (!id(sourceId)) throw new Error('invalid actual live receipt Source');
    const rows = db.prepare(`SELECT * FROM ${table} WHERE source_id=$id
      OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}
      OR ${claim('snapshot_json', ['history', { array: 'all' }, 'sourceId'], '$id')}
      OR ${claim('snapshot_json', ['history', 'sourceId'], '$id')}`).all({ id: sourceId }) as Row[];
    if (!rows.length) return null;
    if (rows.length !== 1 || rows[0].source_id !== sourceId) throw new Error('actual live receipt ownership identity differs');
    const row = rows[0], source = own.input(JSON.parse(row.source_json), sourceId);
    if (row.source_json !== json(source) || row.source_hash !== hash(source)) throw new Error('actual live receipt Source archive differs');
    if (ownershipKey !== undefined && row.ownership_key !== ownershipKey) throw new Error('actual live receipt ownership index differs');
    const metadata = (path: SqliteJsonMetadataPath, type: string, expected: Record<string, string | number | null> = {}) => {
      const selected = db.prepare(`SELECT count(*) AS n,sum(o.type=$type) AS typed,
        CASE WHEN o.type='object' THEN ${projection('o.value', Object.keys(expected))} END AS metadata
        FROM (${nodes('$document', path)}) o`).get({ document: row.snapshot_json, type });
      if (!selected || selected.n !== 1 || selected.typed !== 1
        || type === 'object' && !matches(selected.metadata as string | null, expected)) throw new Error('actual live receipt ownership container metadata differs');
    };
    const sourceMetadata = (path: SqliteJsonMetadataPath) => {
      // Source mirrors can contain structured cuts. Compare the canonical Source
      // object itself rather than casting nested values into a scalar projection.
      // Raw node equality also retains duplicate-key/container detection without
      // parsing or replaying any surrounding future receipt/result payload.
      const selected = db.prepare(`SELECT count(*) AS n,sum(o.type='object') AS typed,
        sum(o.type='object' AND o.value=$source) AS matched FROM (${nodes('$document', path)}) o`)
        .get({ document: row.snapshot_json, source: json(source) });
      if (!selected || selected.n !== 1 || selected.typed !== 1 || selected.matched !== 1) {
        throw new Error('actual live receipt Source mirror metadata differs');
      }
    };
    metadata([], 'object', { revision: 1, ownershipKey: row.ownership_key });
    sourceMetadata(['source']);
    metadata(['history'], 'array');
    sourceMetadata(['history', { array: 'all' }]);
    return { row, source };
  };
  const read = (sourceId: string): V | null => {
    const metadata = readMetadata(sourceId);
    if (!metadata) return null;
    const { row, source } = metadata, value = own.derive(source);
    if (row.ownership_key !== value.ownershipKey || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) {
      throw new Error('actual live receipt archive differs');
    }
    assertUnique(source, value.ownershipKey, 1);
    return value;
  };
  return { read, readMetadata, assertUnique };
};
/** Private transactional mechanism shared by the two versioned live evidence owners.
 * The concrete owner supplies all parsing/rederivation; the request supplies no trusted receipt. */
export const openActualLiveImmutableReceiptStore = <S extends Source, V extends Receipt<S>>(path: string,
  table: Table, make: (db: Db) => ActualLiveImmutableOwner<S, V>, accepted?: (sourceId: string) => S | null) => {
  if (!id(path)) throw new Error('invalid actual live receipt path');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS ${table} (source_id TEXT PRIMARY KEY,ownership_key TEXT NOT NULL UNIQUE,
    source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL);`);
  const own = make(db), evidence = actualLiveImmutableReceiptEvidenceFromSqlite(db, table, own); let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed actual live receipt Source'); };
  const snapshot = <T>(body: () => T): T => {
    db.exec('BEGIN'); try { const result = body(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  return Object.freeze({
    read(sourceId: string) { check(sourceId); return snapshot(() => evidence.read(sourceId)); },
    accept(sourceId: string): V {
      check(sourceId);
      const prior = snapshot(() => evidence.read(sourceId)), raw = accepted?.(sourceId) ?? null;
      const source = raw === null ? null : own.input(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('actual live receipt Source frozen differently');
        return snapshot(() => { const saved = evidence.read(sourceId); if (json(saved) !== json(prior)) throw new Error('actual live receipt changed during retry'); return saved!; });
      }
      if (!source) throw new Error('accepted actual live receipt Source missing');
      const value = snapshot(() => own.derive(source, true));
      db.exec('BEGIN IMMEDIATE');
      try {
        if (evidence.read(sourceId)) throw new Error('actual live receipt Source appeared during write');
        evidence.assertUnique(source, value.ownershipKey, 0);
        if (json(own.derive(source, true)) !== json(value)) throw new Error('actual live receipt dependencies changed before write');
        db.prepare(`INSERT INTO ${table} VALUES (?,?,?,?,?,?)`).run(sourceId, value.ownershipKey, json(source), hash(source), json(value), hash(value));
        if (json(own.derive(source, true)) !== json(value)) throw new Error('actual live receipt dependencies changed during write');
        const saved = evidence.read(sourceId);
        if (json(saved) !== json(value)) throw new Error('actual live receipt changed during write');
        db.exec('COMMIT'); return saved!;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
