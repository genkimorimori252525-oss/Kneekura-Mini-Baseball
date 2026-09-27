import { createRequire } from 'node:module';
import type { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { applyAndSettleOfficialRegularSeasonGame,
  type OfficialWorldSettlementRequest,
  type OfficialWorldSettlementResult } from './OfficialWorldSettlementDriver';
import type { SqliteWorldSettlementStore } from
  './SqliteWorldSettlementStore';

export type DurableOfficialWorldSettlementRequest = Omit<
  OfficialWorldSettlementRequest, 'matchStore' | 'worldStore'>;
export type OfficialWorldSettlementStores = Readonly<{
  matchStore: SqliteOfficialStateStore;
  worldStore: SqliteWorldSettlementStore;
}>;
export type OfficialWorldOutboxEntry = Readonly<{
  applicationId: string;
  status: 'PENDING' | 'COMPLETED';
  request: DurableOfficialWorldSettlementRequest;
  result: OfficialWorldSettlementResult | null;
}>;
export type SqliteOfficialWorldSettlementOutbox = Readonly<{
  enqueue(request: DurableOfficialWorldSettlementRequest):
    OfficialWorldOutboxEntry;
  read(applicationId: string): OfficialWorldOutboxEntry | null;
  listPending(): readonly OfficialWorldOutboxEntry[];
  resume(applicationId: string,
    stores: OfficialWorldSettlementStores): OfficialWorldSettlementResult;
  submit(request: DurableOfficialWorldSettlementRequest,
    stores: OfficialWorldSettlementStores): OfficialWorldSettlementResult;
  close(): void;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const revision = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

/** Canonical, lossless JSON for exact applicationId retry evidence. */
const canonicalJson = (value: unknown): string => {
  const ancestors = new Set<object>();
  let nodes = 0;
  const visit = (item: unknown, depth: number): unknown => {
    nodes += 1;
    if (nodes > 100_000 || depth > 64) {
      throw new Error('world outbox evidence exceeds size limit');
    }
    if (item === null || typeof item === 'string'
      || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) {
      return item === 0 ? 0 : item;
    }
    if (typeof item !== 'object' || ancestors.has(item)) {
      throw new Error('world outbox requires inert JSON evidence');
    }
    ancestors.add(item);
    let normalized: unknown;
    if (Array.isArray(item)) {
      if (Reflect.ownKeys(item).length !== item.length + 1) {
        throw new Error('world outbox requires dense arrays');
      }
      const array: unknown[] = [];
      for (let index = 0; index < item.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(item,
          String(index));
        if (!descriptor || !descriptor.enumerable
          || !('value' in descriptor)) {
          throw new Error('world outbox requires dense arrays');
        }
        array.push(visit(descriptor.value, depth + 1));
      }
      normalized = array;
    } else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new Error('world outbox requires plain JSON evidence');
      }
      const entries: [string, unknown][] = [];
      for (const key of Reflect.ownKeys(item)) {
        if (typeof key !== 'string') {
          throw new Error('world outbox rejects symbol keys');
        }
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        if (!descriptor || !descriptor.enumerable
          || !('value' in descriptor)) {
          throw new Error('world outbox rejects accessors');
        }
        entries.push([key, visit(descriptor.value, depth + 1)]);
      }
      normalized = Object.fromEntries(entries.sort((a, b) =>
        a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    }
    ancestors.delete(item);
    return normalized;
  };
  return JSON.stringify(visit(value, 0));
};

type Row = { application_id: string; status: string;
  request_json: string; result_json: string | null };

/**
 * Open this on the world SQLite file. Intake commits before Match finalization;
 * completion commits only after the separate Match and world writes succeed.
 * A pending row is replayable after any crash between these transactions.
 */
export const openSqliteOfficialWorldSettlementOutbox = (
  databasePath: string,
): SqliteOfficialWorldSettlementOutbox => {
  if (!id(databasePath)) throw new Error('invalid world outbox path');
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_settlement_outbox (
    application_id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK(status IN ('PENDING', 'COMPLETED')),
    request_json TEXT NOT NULL,
    result_json TEXT,
    CHECK ((status='PENDING' AND result_json IS NULL)
      OR (status='COMPLETED' AND result_json IS NOT NULL))
  );`);
  const get = db.prepare(`SELECT application_id, status, request_json,
    result_json FROM world_settlement_outbox WHERE application_id=?`);
  const pending = db.prepare(`SELECT application_id, status, request_json,
    result_json FROM world_settlement_outbox WHERE status='PENDING'
    ORDER BY application_id`);
  const row = (applicationId: string): Row | null =>
    (get.get(applicationId) as Row | undefined) ?? null;
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
  const decode = (stored: Row): OfficialWorldOutboxEntry => {
    try {
      const request = JSON.parse(stored.request_json) as
        DurableOfficialWorldSettlementRequest;
      const result = stored.result_json === null ? null
        : JSON.parse(stored.result_json) as OfficialWorldSettlementResult;
      if (!id(stored.application_id)
        || request.finalInput.applicationId !== stored.application_id
        || !revision(request.expectedSeasonRevision)
        || !revision(request.expectedClubRevision)
        || canonicalJson(request) !== stored.request_json
        || !((stored.status === 'PENDING' && result === null)
          || (stored.status === 'COMPLETED' && result !== null))
        || (result !== null && (
          canonicalJson(result) !== stored.result_json
          || result.final.result.applicationId !== stored.application_id
          || result.world.applicationId !== stored.application_id
          || result.world.settlement.gameResult.applicationId
            !== stored.application_id))) {
        throw new Error('outbox row mismatch');
      }
      return { applicationId: stored.application_id,
        status: stored.status as OfficialWorldOutboxEntry['status'],
        request, result };
    } catch (cause) {
      throw new Error('corrupt official world outbox entry', { cause });
    }
  };
  let closed = false;
  const api: SqliteOfficialWorldSettlementOutbox = Object.freeze({
    enqueue(request): OfficialWorldOutboxEntry {
      const applicationId = request?.finalInput?.applicationId;
      if (!id(applicationId)
        || !revision(request.expectedSeasonRevision)
        || !revision(request.expectedClubRevision)) {
        throw new Error('invalid official world outbox intake');
      }
      const requestJson = canonicalJson(request);
      return transaction(() => {
        const current = row(applicationId);
        if (current) {
          const entry = decode(current);
          if (current.request_json !== requestJson) {
            throw new Error('applicationId was used for different outbox evidence');
          }
          return entry;
        }
        db.prepare(`INSERT INTO world_settlement_outbox
          (application_id, status, request_json, result_json)
          VALUES (?, 'PENDING', ?, NULL)`).run(applicationId, requestJson);
        return decode(row(applicationId)!);
      });
    },
    read(applicationId): OfficialWorldOutboxEntry | null {
      if (!id(applicationId)) throw new Error('invalid outbox applicationId');
      const current = row(applicationId);
      return current ? decode(current) : null;
    },
    listPending(): readonly OfficialWorldOutboxEntry[] {
      return (pending.all() as Row[]).map(decode);
    },
    resume(applicationId, stores): OfficialWorldSettlementResult {
      const entry = api.read(applicationId);
      if (!entry) throw new Error('official world outbox intake is missing');
      if (entry.status === 'COMPLETED') return entry.result!;
      const result = applyAndSettleOfficialRegularSeasonGame({
        ...entry.request, ...stores });
      const resultJson = canonicalJson(result);
      return transaction(() => {
        const current = row(applicationId);
        if (!current) throw new Error('official world outbox intake is missing');
        const latest = decode(current);
        if (latest.status === 'COMPLETED') {
          if (current.result_json !== resultJson) {
            throw new Error('official world outbox completion mismatch');
          }
          return latest.result!;
        }
        if (current.request_json !== canonicalJson(entry.request)) {
          throw new Error('official world outbox intake changed');
        }
        const update = db.prepare(`UPDATE world_settlement_outbox
          SET status='COMPLETED', result_json=?
          WHERE application_id=? AND status='PENDING' AND request_json=?`)
          .run(resultJson, applicationId, current.request_json);
        if (update.changes !== 1) {
          throw new Error('official world outbox completion CAS failed');
        }
        return decode(row(applicationId)!).result!;
      });
    },
    submit(request, stores): OfficialWorldSettlementResult {
      const entry = api.enqueue(request);
      return api.resume(entry.applicationId, stores);
    },
    close(): void {
      if (!closed) { db.close(); closed = true; }
    },
  });
  return api;
};
