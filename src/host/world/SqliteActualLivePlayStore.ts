import { actualLivePlayScopeArchiveEncoding as encode } from './ActualLivePlayArchive';
import { createRequire } from 'node:module';
import { actualLivePlayId as id, actualLivePlayScopeInput as input, type AcceptedActualLivePlayScope, type DurableActualLivePlayScope } from './ActualLivePlayScope';
import { actualLivePlayEvidenceFromSqlite } from './ActualLivePlayEvidenceFromSqlite';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection, sqliteJsonMetadataMatches as matches,
  type SqliteJsonMetadataPath } from './SqliteOwnershipMetadata';

type Authority = Readonly<{ readAcceptedScope(sourceId: string): AcceptedActualLivePlayScope | null }>;
type Row = { source_id: string; source_version: string; physical_pitch_source_id: string; game_id: string; play_id: number;
  scope_id: string; cut_key: string; source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
/** Immutable observations of a root/cut, not exclusive registration or a physical admission fence.
 * Different cuts share the deterministic scopeId; an unsupported original-pitch view cannot
 * prevent a later field view. Evaluation remains read-only and explicitly pending in v1. */
export const openSqliteActualLivePlayStore = (path: string, authority?: Authority) => {
  if (!id(path) || authority != null && typeof authority.readAcceptedScope !== 'function') throw new Error('invalid actual live-play scope owner');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS actual_live_play_scopes (source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,
    physical_pitch_source_id TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,scope_id TEXT NOT NULL,cut_key TEXT NOT NULL,
    source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL);`);
  const own = actualLivePlayEvidenceFromSqlite(db); let closed = false;
  const same = (a: DurableActualLivePlayScope | null, b: DurableActualLivePlayScope) => {
    if (!a) return false; const left = encode(a), right = encode(b); return left.json === right.json && left.hash === right.hash;
  };
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed actual live-play scope'); };
  const read = (sourceId: string): DurableActualLivePlayScope | null => {
    check(sourceId);
    const claims = [['source_json', []], ['snapshot_json', ['source']], ['snapshot_json', ['history', { array: 'all' }]],
      ['snapshot_json', ['history']]] as const;
    const rows = db.prepare(`SELECT * FROM actual_live_play_scopes WHERE source_id=$id
      OR ${claims.map(([column, path]) => claim(column, [...path, 'sourceId'], '$id')).join(' OR ')}`).all({ id: sourceId }) as Row[];
    if (!rows.length) return null;
    if (rows.length !== 1 || rows[0].source_id !== sourceId) throw new Error('actual live-play Source ownership identity differs');
    const row = rows[0];
    const metadata = (document: string, path: SqliteJsonMetadataPath, type: string, expected: Record<string, string | number | null> = {}) => {
      const value = db.prepare(`SELECT count(*) AS n,sum(o.type=$type) AS typed,
        CASE WHEN o.type='object' THEN ${projection('o.value', Object.keys(expected))} END AS metadata
        FROM (${nodes('$document', path)}) o`).get({ document, type });
      if (!value || value.n !== 1 || value.typed !== 1 || type === 'object' && Object.keys(expected).length && !matches(value.metadata as string | null, expected)) {
        throw new Error('actual live-play ownership metadata differs');
      }
    };
    const expected = { sourceId: row.source_id, sourceVersion: row.source_version, physicalPitchSourceId: row.physical_pitch_source_id, capability: 'actual_live_play_scope_v1' };
    metadata(row.source_json, [], 'object', expected); metadata(row.snapshot_json, [], 'object', { revision: 1 });
    metadata(row.snapshot_json, ['source'], 'object', expected); metadata(row.snapshot_json, ['history'], 'array');
    metadata(row.snapshot_json, ['history', { array: 'all' }], 'object', expected);
    metadata(row.snapshot_json, ['scope'], 'object', { scopeId: row.scope_id, physicalPitchSourceId: row.physical_pitch_source_id,
      gameId: row.game_id, playId: row.play_id });
    const source = input(JSON.parse(row.source_json), sourceId), value = own.derive(source), encoded = encode(value);
    if (row.cut_key !== json(source.cut) || row.source_json !== json(source) || row.source_hash !== hash(source)
      || row.snapshot_json !== encoded.json || row.snapshot_hash !== encoded.hash) throw new Error('corrupt original actual live-play scope archive');
    return value;
  };
  const snapshot = <T>(body: () => T) => {
    db.exec('BEGIN'); try { const value = body(); db.exec('COMMIT'); return value; } catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  return Object.freeze({
    read(sourceId: string) { check(sourceId); return snapshot(() => read(sourceId)); },
    evaluate(sourceId: string) { check(sourceId); return snapshot(() => {
      const value = read(sourceId); if (!value) throw new Error('actual live-play accepted scope missing'); return own.evaluate(value);
    }); },
    accept(sourceId: string): DurableActualLivePlayScope {
      check(sourceId);
      const prior = snapshot(() => read(sourceId)), raw = authority?.readAcceptedScope(sourceId) ?? null, source = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('actual live-play scope Source frozen differently');
        return snapshot(() => { const saved = read(sourceId); if (!same(saved, prior)) throw new Error('actual live-play scope changed during retry'); return saved!; });
      }
      if (!source) throw new Error('accepted actual live-play scope Source missing');
      const value = snapshot(() => own.derive(source, true)), projection = snapshot(() => own.evaluate(value)), encoded = encode(value);
      db.exec('BEGIN IMMEDIATE');
      try {
        if (read(sourceId)) throw new Error('actual live-play Source appeared during write');
        own.current(value);
        if (json(own.evaluate(value)) !== json(projection)) throw new Error('actual live-play producer dependencies changed before write');
        db.prepare('INSERT INTO actual_live_play_scopes VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(sourceId, source.sourceVersion,
          source.physicalPitchSourceId, value.scope.gameId, value.scope.playId, value.scope.scopeId, json(source.cut), json(source), hash(source), encoded.json, encoded.hash);
        own.current(value);
        if (json(own.evaluate(value)) !== json(projection)) throw new Error('actual live-play producer dependencies changed during write');
        const saved = read(sourceId); if (!same(saved, value)) throw new Error('actual live-play archive changed during write');
        db.exec('COMMIT'); return saved!;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
