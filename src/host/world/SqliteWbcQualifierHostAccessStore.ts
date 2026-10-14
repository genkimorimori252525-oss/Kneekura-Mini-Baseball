import type { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { QUALIFIER_ACCESS_METRICS, type QualifierHostAccessAssessment,
  type WbcQualifierHostAccessSnapshot } from '../../core/world/competition/WbcQualifierHostCandidates';

export type WorldQualifierHostAccessEvent = QualifierHostAccessAssessment & Readonly<{
  careerId: string; qualifierEditionId: string; drawSnapshotId: string;
}>;
export type SqliteWbcQualifierHostAccessStore = Readonly<{
  record(event: WorldQualifierHostAccessEvent): WorldQualifierHostAccessEvent;
  readAccess(careerId: string, qualifierEditionId: string, drawSnapshotId: string, beforeDay: number): WbcQualifierHostAccessSnapshot;
  close(): void;
}>;
type Row = { revision: number; effective_day: number; source_event_id: string; event_json: string; chain_hash: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const canonical = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) =>
  item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const digest = (value: unknown): string => createHash('sha256').update(canonical(value)).digest('hex');
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const assertEvent = (event: WorldQualifierHostAccessEvent): void => {
  if (!event || ![event.careerId, event.qualifierEditionId, event.drawSnapshotId, event.venueId, event.sourceEventId].every(id)
    || !day(event.podIndex) || event.podIndex > 3 || !day(event.effectiveFromDay)
    || !QUALIFIER_ACCESS_METRICS.every((metric) => typeof event[metric] === 'number'
      && Number.isFinite(event[metric]) && event[metric] >= 0)) throw new Error('invalid accepted qualifier host access event');
};

/** World owns calibrated access assessments; each assessment is bound to the actual pod draw. */
const createSqliteWbcQualifierHostAccessStore = (databasePath: string | DatabaseSync): SqliteWbcQualifierHostAccessStore => {
  if (typeof databasePath === 'string' && !id(databasePath)) throw new Error('invalid qualifier host access database path');
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const borrowed = typeof databasePath !== 'string';
  const db = borrowed ? databasePath : new DatabaseSync(databasePath);
  if (!(db instanceof DatabaseSync)) throw new Error('National evidence requires a Native connection');
  if (!borrowed) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_wbc_qualifier_host_access_events (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL, draw_snapshot_id TEXT NOT NULL,
    pod_index INTEGER NOT NULL, venue_id TEXT NOT NULL, revision INTEGER NOT NULL,
    effective_day INTEGER NOT NULL, source_event_id TEXT NOT NULL, event_json TEXT NOT NULL, chain_hash TEXT NOT NULL,
    PRIMARY KEY(career_id, edition_id, draw_snapshot_id, pod_index, venue_id, revision),
    UNIQUE(career_id, source_event_id)
  );`);
  }
  const rows = db.prepare(`SELECT revision, effective_day, source_event_id, event_json, chain_hash
    FROM world_wbc_qualifier_host_access_events WHERE career_id=? AND edition_id=? AND draw_snapshot_id=?
    AND pod_index=? AND venue_id=? AND effective_day<=? ORDER BY revision`);
  const pairs = db.prepare(`SELECT DISTINCT pod_index, venue_id FROM world_wbc_qualifier_host_access_events
    WHERE career_id=? AND edition_id=? AND draw_snapshot_id=? AND effective_day<=? ORDER BY pod_index, venue_id`);
  const byEvent = db.prepare(`SELECT event_json FROM world_wbc_qualifier_host_access_events WHERE career_id=? AND source_event_id=?`);
  const replay = (careerId: string, qualifierEditionId: string, drawSnapshotId: string,
    podIndex: number, venueId: string, beforeDay: number) => {
    let priorHash = 'GENESIS';
    const history: { event: WorldQualifierHostAccessEvent; chainHash: string }[] = [];
    for (const row of rows.all(careerId, qualifierEditionId, drawSnapshotId, podIndex, venueId, beforeDay) as Row[]) {
      try {
        const event = JSON.parse(row.event_json) as WorldQualifierHostAccessEvent;
        assertEvent(event);
        const hash = digest([priorHash, row.event_json]);
        if (event.careerId !== careerId || event.qualifierEditionId !== qualifierEditionId || event.drawSnapshotId !== drawSnapshotId
          || event.podIndex !== podIndex || event.venueId !== venueId || row.revision !== history.length + 1
          || row.effective_day !== event.effectiveFromDay || row.source_event_id !== event.sourceEventId
          || (history.length > 0 && event.effectiveFromDay <= history[history.length - 1].event.effectiveFromDay)
          || canonical(event) !== row.event_json || hash !== row.chain_hash) throw new Error('qualifier access prefix differs');
        history.push({ event: freeze(event), chainHash: hash }); priorHash = hash;
      } catch (cause) { throw new Error(`corrupt qualifier host access for ${venueId}`, { cause }); }
    }
    return history;
  };
  let closed = false;
  const scope = (careerId: string, editionId: string, drawSnapshotId: string): void => {
    if (closed || ![careerId, editionId, drawSnapshotId].every(id)) throw new Error('invalid qualifier host access scope');
  };
  return Object.freeze({
    record(raw: WorldQualifierHostAccessEvent): WorldQualifierHostAccessEvent {
      const event = cloneInert(raw); assertEvent(event); scope(event.careerId, event.qualifierEditionId, event.drawSnapshotId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const history = replay(event.careerId, event.qualifierEditionId, event.drawSnapshotId,
          event.podIndex, event.venueId, Number.MAX_SAFE_INTEGER);
        const existing = byEvent.get(event.careerId, event.sourceEventId) as { event_json: string } | undefined;
        if (existing) {
          if (existing.event_json !== canonical(event)
            || !history.some((item) => item.event.sourceEventId === event.sourceEventId)) throw new Error('qualifier access is frozen differently');
          db.exec('COMMIT'); return freeze(event);
        }
        const prior = history[history.length - 1];
        if (prior && event.effectiveFromDay <= prior.event.effectiveFromDay) throw new Error('qualifier access events must advance World day');
        const json = canonical(event), hash = digest([prior?.chainHash ?? 'GENESIS', json]);
        db.prepare(`INSERT INTO world_wbc_qualifier_host_access_events
          (career_id, edition_id, draw_snapshot_id, pod_index, venue_id, revision,
            effective_day, source_event_id, event_json, chain_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(event.careerId, event.qualifierEditionId, event.drawSnapshotId, event.podIndex, event.venueId,
            history.length + 1, event.effectiveFromDay, event.sourceEventId, json, hash);
        db.exec('COMMIT'); return freeze(event);
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readAccess(careerId: string, qualifierEditionId: string, drawSnapshotId: string, beforeDay: number): WbcQualifierHostAccessSnapshot {
      scope(careerId, qualifierEditionId, drawSnapshotId);
      if (!day(beforeDay)) throw new Error('invalid qualifier host access cutoff');
      // Exclude current/future facts before parsing their payload or following their prefix.
      const latest = (pairs.all(careerId, qualifierEditionId, drawSnapshotId, beforeDay) as { pod_index: number; venue_id: string }[])
        .map((pair) => {
          const history = replay(careerId, qualifierEditionId, drawSnapshotId, pair.pod_index, pair.venue_id, beforeDay);
          if (history.length === 0) throw new Error('corrupt qualifier host access has empty eligible prefix');
          return history[history.length - 1];
        });
      const assessments = latest.map((item) => item.event);
      const snapshotId = `world-qualifier-access:${digest({ careerId, qualifierEditionId, drawSnapshotId,
        asOfDay: beforeDay, assessments, prefixHashes: latest.map((item) => item.chainHash) })}`;
      return freeze({ snapshotId, qualifierEditionId, drawSnapshotId, asOfDay: beforeDay, assessments });
    },
    close(): void { if (!closed && !borrowed) db.close(); closed = true; },
  });
};

/** Existing path facade retains connection/schema ownership. */
export const openSqliteWbcQualifierHostAccessStore = (databasePath: string): SqliteWbcQualifierHostAccessStore =>
  createSqliteWbcQualifierHostAccessStore(databasePath);

/** Same owner replay on a consuming Native connection; only read capabilities escape. */
export const wbcQualifierHostAccessEvidenceFromSqlite = (db: DatabaseSync): Pick<SqliteWbcQualifierHostAccessStore, 'readAccess'> => {
  const owner = createSqliteWbcQualifierHostAccessStore(db);
  return Object.freeze({ readAccess: owner.readAccess });
};
