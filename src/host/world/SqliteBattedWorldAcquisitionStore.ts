import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { deriveBattedWorldAcquisition, type BattedWorldAcquisition } from '../../core/sim/ball/BattedWorldAcquisition';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedContactResponseEvidenceFromSqlite, type DurableBattedContactResponse, type SqliteBattedContactResponseStore } from './SqliteBattedContactResponseStore';
import { battedWorldContinuationEvidenceFromSqlite, battedWorldResponseInput, type DurableBattedWorldContinuation } from './SqliteBattedWorldContinuationStore';

export type AcceptedBattedWorldAcquisition = Readonly<{
  sourceId: string; sourceVersion: string; responseSourceId: string; continuationSourceId: string | null;
}>;
export type DurableBattedWorldAcquisition = Readonly<{
  source: AcceptedBattedWorldAcquisition; response: DurableBattedContactResponse;
  continuation: DurableBattedWorldContinuation | null; result: BattedWorldAcquisition;
}>;
export type SqliteBattedWorldAcquisitionStore = Readonly<{
  accept(sourceId: string): DurableBattedWorldAcquisition; read(sourceId: string): DurableBattedWorldAcquisition | null; close(): void;
}>;
type Authority = Readonly<{ readAcceptedAcquisition(sourceId: string): AcceptedBattedWorldAcquisition | null }>;
type Row = { source_id: string; response_source_id: string; continuation_source_id: string | null; physical_pitch_source_id: string;
  game_id: string; source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const input = (raw: AcceptedBattedWorldAcquisition, sourceId: string): AcceptedBattedWorldAcquisition => {
  const source = cloneInert(raw);
  if (!source || typeof source !== 'object' || Array.isArray(source) || Object.keys(source).sort().join('|')
    !== 'continuationSourceId|responseSourceId|sourceId|sourceVersion' || source.sourceId !== sourceId
    || ![sourceId, source.sourceVersion, source.responseSourceId].every(id)
    || source.continuationSourceId !== null && !id(source.continuationSourceId)) throw new Error('invalid accepted batted acquisition Source');
  return source;
};
const physicalId = (response: DurableBattedContactResponse) => response.touch.worldContact.flight.source.physicalPitchSourceId;

/** Original and complete actual prefix evidence is re-derived on this connection; no transported acquisition result is trusted. */
export const battedWorldAcquisitionEvidenceFromSqlite = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>) => {
  const ownResponses = battedContactResponseEvidenceFromSqlite(db), ownContinuations = battedWorldContinuationEvidenceFromSqlite(db);
  const hasContinuations = () => !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='batted_world_continuations'").get();
  const derive = (source: AcceptedBattedWorldAcquisition): DurableBattedWorldAcquisition => {
    const response = ownResponses.read(source.responseSourceId);
    if (!response) throw new Error('original batted acquisition response is missing');
    const continuations = hasContinuations() ? ownContinuations.scope(response) : [];
    const continuation = source.continuationSourceId === null ? null
      : continuations.find((value) => value.source.sourceId === source.continuationSourceId) ?? null;
    if (source.continuationSourceId !== null && (!continuation || continuation.response.source.sourceId !== response.source.sourceId
      || json(continuation.response) !== json(response))) throw new Error('batted acquisition original continuation scope differs');
    const result = deriveBattedWorldAcquisition({ response: battedWorldResponseInput(response),
      throughTicks: continuation?.history.map((prior) => prior.throughTick) ?? [] });
    return freeze({ source, response, continuation, result });
  };
  const read = (sourceId: string): DurableBattedWorldAcquisition | null => {
    if (!id(sourceId)) throw new Error('invalid batted acquisition scope');
    const row = db.prepare('SELECT * FROM batted_world_acquisitions WHERE source_id=?').get(sourceId) as Row | undefined;
    if (!row) return null;
    const source = input(JSON.parse(row.source_json) as AcceptedBattedWorldAcquisition, sourceId), value = derive(source);
    if (row.response_source_id !== source.responseSourceId || row.continuation_source_id !== source.continuationSourceId
      || row.physical_pitch_source_id !== physicalId(value.response) || row.game_id !== value.response.model.gameId
      || row.source_json !== json(source) || row.source_hash !== hash(source) || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) {
      throw new Error('corrupt original batted acquisition archive');
    }
    return value;
  };
  const current = (value: DurableBattedWorldAcquisition): void => {
    ownResponses.current(value.response);
    if (value.continuation) ownContinuations.current(value.continuation);
    const currentPrefix = hasContinuations() ? ownContinuations.scope(value.response).at(-1) : null;
    if ((currentPrefix?.source.sourceId ?? null) !== value.source.continuationSourceId) throw new Error('batted acquisition actual prefix is no longer current');
    if (json(derive(value.source)) !== json(value)) throw new Error('batted acquisition original changed during write');
  };
  return { read, derive, current, ownResponses, ownContinuations };
};

/** A sole actual retained glove candidate plus uninterrupted World establishes acquisition, never official play closure. */
export const openSqliteBattedWorldAcquisitionStore = (path: string, responses: Pick<SqliteBattedContactResponseStore, 'read'>,
  authority?: Authority): SqliteBattedWorldAcquisitionStore => {
  if (!id(path) || typeof responses?.read !== 'function' || authority != null && typeof authority.readAcceptedAcquisition !== 'function') {
    throw new Error('invalid batted acquisition sources');
  }
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS batted_world_acquisitions (source_id TEXT PRIMARY KEY,response_source_id TEXT NOT NULL,
    continuation_source_id TEXT,physical_pitch_source_id TEXT NOT NULL UNIQUE,game_id TEXT NOT NULL,
    source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL);`);
  const own = battedWorldAcquisitionEvidenceFromSqlite(db);
  let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed batted acquisition scope'); };
  return Object.freeze({
    read(sourceId) { check(sourceId); return own.read(sourceId); },
    accept(sourceId) {
      check(sourceId);
      const prior = own.read(sourceId), raw = authority?.readAcceptedAcquisition(sourceId) ?? null, source = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('batted acquisition Source is frozen differently');
        const original = own.read(sourceId);
        if (!original || json(original) !== json(prior)) throw new Error('batted acquisition original changed during retry');
        return original;
      }
      if (!source) throw new Error('accepted batted acquisition Source is missing');
      const value = own.derive(source); own.current(value);
      const peer = responses.read(source.responseSourceId);
      if (!peer || json(peer) !== json(value.response)) throw new Error('batted acquisition peer response differs');
      db.exec('BEGIN IMMEDIATE');
      try {
        own.current(value);
        db.prepare('INSERT INTO batted_world_acquisitions VALUES (?,?,?,?,?,?,?,?,?)').run(sourceId, source.responseSourceId, source.continuationSourceId,
          physicalId(value.response), value.response.model.gameId, json(source), hash(source), json(value), hash(value));
        own.current(value);
        const saved = own.read(sourceId);
        if (!saved || json(saved) !== json(value)) throw new Error('batted acquisition original changed during write');
        db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
