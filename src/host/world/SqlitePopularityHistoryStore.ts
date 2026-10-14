import { officialParticipationEvidenceFromSqlite, officialParticipationCareerEvent, type OfficialParticipationReceipt } from './SqliteOfficialParticipationStore';
import { readClinicalPersonLink } from './HealthRehabEvidenceFromSqlite';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { createRequire } from 'node:module';
import { adaptFreeAgentRightsEvent, appendPopularityExposure,
  createPopularityHistory, type AudienceResponseEvidence,
  type PopularityHistory, type PopularityUpdatePolicy,
} from '../../core/world/popularity/PopularityObservationSource';
import type { FreeAgentRightsEvent } from
  '../../core/world/roster/FreeAgentContract';

/** Must read a durable accepted roster event, never echo a caller-supplied claim. */
export type AcceptedFreeAgentRightsSource = Readonly<{
  rightsEvent: FreeAgentRightsEvent;
  personId: string;
  playerId: string;
  personLinkSourceId: string;
}>;
export type AcceptedFreeAgentRightsAuthority = Readonly<{
  readAcceptedFreeAgentRightsEvent(eventId: string):
    AcceptedFreeAgentRightsSource | null;
}>;
export type PopularityStoreRequest = Readonly<{
  eventId: string;
  careerId: string;
  personId: string;
  playerId: string;
  expectedRevision: number;
  asOfDay: number;
  evidence: readonly AudienceResponseEvidence[];
  policy: PopularityUpdatePolicy;
}>;
export type DurablePopularityApplication = Readonly<{
  eventId: string;
  history: PopularityHistory;
  source: Readonly<{
    kind: 'FREE_AGENT_RIGHTS_ACQUIRED';
    sourceClubEventId: string;
    personLinkSourceId: string;
  }>;
}>;
export type DurableOfficialGamePopularityApplication = Readonly<{
  eventId: string; history: PopularityHistory;
  source: Readonly<{ kind: 'OFFICIAL_GAME'; participationReceiptId: string;
    personLinkSourceId: string; gameId: string; competitionEditionId: string }>;
}>;
export type DurablePopularityEventApplication = DurablePopularityApplication | DurableOfficialGamePopularityApplication;
type OfficialPopularitySource = Readonly<{ kind: 'OFFICIAL_PARTICIPATION_V1'; receipt: OfficialParticipationReceipt;
  personLink: ReturnType<typeof readClinicalPersonLink> }>;
export type SqlitePopularityHistoryStore = Readonly<{
  initialize(careerId: string, personId: string,
    initialClubId: string | null): PopularityHistory;
  readHead(careerId: string, personId: string): PopularityHistory | null;
  readApplication(eventId: string): DurablePopularityEventApplication | null;
  apply(request: PopularityStoreRequest): DurablePopularityApplication;
  applyOfficialParticipation(request: PopularityStoreRequest): DurableOfficialGamePopularityApplication;
  close(): void;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const revision = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Stable inert JSON keeps idempotency comparisons independent of key order. */
const canonicalJson = (value: unknown): string => {
  const ancestors = new Set<object>();
  let nodes = 0;
  const visit = (item: unknown, depth: number): unknown => {
    nodes += 1;
    if (nodes > 100_000 || depth > 64) {
      throw new Error('popularity evidence exceeds size limit');
    }
    if (item === null || typeof item === 'string'
      || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) {
      return item === 0 ? 0 : item;
    }
    if (typeof item !== 'object' || ancestors.has(item)) {
      throw new Error('popularity evidence must be inert JSON');
    }
    ancestors.add(item);
    let normalized: unknown;
    if (Array.isArray(item)) {
      const array: unknown[] = [];
      if (Reflect.ownKeys(item).length !== item.length + 1) {
        throw new Error('popularity evidence requires dense arrays');
      }
      for (let index = 0; index < item.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(item,
          String(index));
        if (!descriptor || !descriptor.enumerable
          || !('value' in descriptor)) {
          throw new Error('popularity evidence requires dense arrays');
        }
        array.push(visit(descriptor.value, depth + 1));
      }
      normalized = array;
    } else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new Error('popularity evidence must be plain JSON');
      }
      const entries: [string, unknown][] = [];
      for (const key of Reflect.ownKeys(item)) {
        if (typeof key !== 'string') {
          throw new Error('popularity evidence rejects symbol keys');
        }
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        if (!descriptor || !descriptor.enumerable
          || !('value' in descriptor)) {
          throw new Error('popularity evidence rejects accessors');
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

type HeadRow = { revision: number; state_json: string };
type ApplicationRow = { event_id: string; career_id: string;
  person_id: string; from_revision: number; to_revision: number;
  before_json: string; request_json: string; source_json: string;
  result_json: string };

/** Owns only popularity state. Match/Club settlement and gate counts stay separate. */
export const openSqlitePopularityHistoryStore = (databasePath: string,
  authority?: AcceptedFreeAgentRightsAuthority | null): SqlitePopularityHistoryStore => {
  if (!id(databasePath) || authority != null
    && typeof authority.readAcceptedFreeAgentRightsEvent !== 'function') {
    throw new Error('popularity store requires an accepted source authority');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS popularity_heads (
    career_id TEXT NOT NULL, person_id TEXT NOT NULL,
    revision INTEGER NOT NULL, state_json TEXT NOT NULL,
    PRIMARY KEY (career_id, person_id)
  );
  CREATE TABLE IF NOT EXISTS popularity_event_applications (
    event_id TEXT PRIMARY KEY, career_id TEXT NOT NULL,
    person_id TEXT NOT NULL, from_revision INTEGER NOT NULL,
    to_revision INTEGER NOT NULL, before_json TEXT NOT NULL,
    request_json TEXT NOT NULL, source_json TEXT NOT NULL,
    result_json TEXT NOT NULL
  );`);
  const getHead = db.prepare(`SELECT revision, state_json
    FROM popularity_heads WHERE career_id=? AND person_id=?`);
  const getApplication = db.prepare(`SELECT event_id, career_id,
    person_id, from_revision, to_revision, before_json,
    request_json, source_json, result_json
    FROM popularity_event_applications WHERE event_id=?`);
  const headRow = (careerId: string, personId: string): HeadRow | null =>
    (getHead.get(careerId, personId) as HeadRow | undefined) ?? null;
  const applicationRow = (eventId: string): ApplicationRow | null =>
    (getApplication.get(eventId) as ApplicationRow | undefined) ?? null;
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
  const readSnapshot = <T>(read: () => T): T => {
    if (db.isTransaction) return read();
    db.exec('BEGIN');
    try { const result = read(); db.exec('COMMIT'); return result; }
    catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  };
  const decodeHead = (row: HeadRow, careerId: string,
    personId: string): PopularityHistory => {
    try {
      const state = JSON.parse(row.state_json) as PopularityHistory;
      if (!revision(row.revision) || state.careerId !== careerId
        || state.personId !== personId || state.revision !== row.revision
        || state.processedEvents.length !== row.revision
        || canonicalJson(state) !== row.state_json) {
        throw new Error('head row mismatch');
      }
      return state;
    } catch (cause) {
      throw new Error('corrupt durable popularity head', { cause });
    }
  };
  const decodeApplicationRow = (row: ApplicationRow):
  DurablePopularityEventApplication => {
    try {
      const source = JSON.parse(row.source_json);
      if (source?.kind === 'OFFICIAL_PARTICIPATION_V1') return decodeOfficialApplication(row);
      const before = JSON.parse(row.before_json) as PopularityHistory;
      const request = JSON.parse(row.request_json) as PopularityStoreRequest;
      const accepted = JSON.parse(row.source_json) as
        AcceptedFreeAgentRightsSource;
      const rights = accepted.rightsEvent;
      const stored = JSON.parse(row.result_json) as DurablePopularityApplication;
      const head = headRow(row.career_id, row.person_id);
      const event = adaptFreeAgentRightsEvent(rights,
        accepted.personId, accepted.playerId);
      const recomputed = appendPopularityExposure(before,
        request.expectedRevision, event, request.evidence,
        request.policy, request.asOfDay);
      if (!head || !revision(row.from_revision)
        || row.to_revision !== row.from_revision + 1
        || head.revision < row.to_revision
        || request.eventId !== row.event_id
        || request.careerId !== row.career_id
        || request.personId !== row.person_id
        || accepted.personId !== request.personId
        || accepted.playerId !== request.playerId
        || !id(accepted.personLinkSourceId)
        || request.expectedRevision !== row.from_revision
        || before.revision !== row.from_revision
        || stored.eventId !== row.event_id
        || stored.history.revision !== row.to_revision
        || stored.source.kind !== rights.type
        || stored.source.sourceClubEventId !== rights.sourceClubEventId
        || stored.source.personLinkSourceId !== accepted.personLinkSourceId
        || canonicalJson(before) !== row.before_json
        || canonicalJson(request) !== row.request_json
        || canonicalJson(accepted) !== row.source_json
        || canonicalJson(stored) !== row.result_json
        || canonicalJson(recomputed) !== canonicalJson(stored.history)
        || (head.revision === row.to_revision
          && head.state_json !== canonicalJson(stored.history))) {
        throw new Error('application row mismatch');
      }
      return stored;
    } catch (cause) {
      throw new Error('corrupt durable popularity application', { cause });
    }
  };
  const readOfficialSource = (eventId: string): OfficialPopularitySource => withBattedVenueLegalReadSnapshot(db, () => {
    const receipt = officialParticipationEvidenceFromSqlite(db).readReceipt(eventId);
    if (!receipt) throw new Error('accepted official participation source is absent');
    const binding = receipt.binding, personLink = readClinicalPersonLink(db, binding.personLinkSourceId);
    if (personLink.careerId !== binding.careerId || personLink.playerId !== binding.playerId
      || personLink.personId !== binding.personId || personLink.acceptedAtDay > binding.gameDay) {
      throw new Error('official popularity original Person link differs');
    }
    return Object.freeze({ kind: 'OFFICIAL_PARTICIPATION_V1', receipt, personLink });
  });
  const officialApplication = (request: PopularityStoreRequest, source: OfficialPopularitySource,
    before: PopularityHistory): DurableOfficialGamePopularityApplication => {
    const receipt = source.receipt, binding = receipt.binding;
    if (request.eventId !== receipt.receiptId || request.careerId !== binding.careerId
      || request.personId !== binding.personId || request.playerId !== binding.playerId) {
      throw new Error('official popularity request differs from original participation');
    }
    return Object.freeze({ eventId: request.eventId,
      history: appendPopularityExposure(before, request.expectedRevision, officialParticipationCareerEvent(receipt),
        request.evidence, request.policy, request.asOfDay),
      source: Object.freeze({ kind: 'OFFICIAL_GAME', participationReceiptId: receipt.receiptId,
        personLinkSourceId: binding.personLinkSourceId, gameId: binding.gameId, competitionEditionId: binding.competitionEditionId }) });
  };
  const decodeOfficialApplication = (row: ApplicationRow): DurableOfficialGamePopularityApplication => {
    const request = JSON.parse(row.request_json) as PopularityStoreRequest;
    const before = JSON.parse(row.before_json) as PopularityHistory;
    const head = headRow(row.career_id, row.person_id);
    const source = readOfficialSource(row.event_id), expected = officialApplication(request, source, before);
    if (!head || !revision(row.from_revision) || row.to_revision !== row.from_revision + 1
      || head.revision < row.to_revision || request.eventId !== row.event_id || request.careerId !== row.career_id
      || request.personId !== row.person_id || request.expectedRevision !== row.from_revision || before.revision !== row.from_revision
      || expected.history.revision !== row.to_revision || canonicalJson(request) !== row.request_json
      || canonicalJson(before) !== row.before_json || canonicalJson(source) !== row.source_json
      || canonicalJson(expected) !== row.result_json || head.revision === row.to_revision && head.state_json !== canonicalJson(expected.history)) {
      throw new Error('official popularity source or application replay differs');
    }
    return expected;
  };
  const verifyOfficialHistory = (state: PopularityHistory): PopularityHistory => {
    for (let index = 0; index < state.processedEvents.length; index++) {
      const event = state.processedEvents[index];
      if (event.kind !== 'OFFICIAL_GAME') continue;
      const row = applicationRow(event.eventId);
      if (!row) throw new Error('official popularity application is missing');
      const saved = decodeOfficialApplication(row), history = saved.history;
      if (row.to_revision !== index + 1 || canonicalJson({ ...state, revision: history.revision, effectiveDay: history.effectiveDay,
        processedEvents: state.processedEvents.slice(0, index + 1), observations: state.observations.slice(0, history.observations.length),
        transfers: state.transfers.slice(0, history.transfers.length) }) !== canonicalJson(history)) {
        throw new Error('official popularity history prefix differs');
      }
    }
    return state;
  };
  const decodeApplication = (row: ApplicationRow): DurablePopularityEventApplication => {
    const application = decodeApplicationRow(row);
    // The row decoder authenticates this event; also authenticate its entire
    // official BEFORE prefix on reads, retries and after INSERT. Do not replay
    // the current physical receipt twice or depend on later current-head events.
    verifyOfficialHistory(JSON.parse(row.before_json) as PopularityHistory);
    return application;
  };
  let closed = false;
  return Object.freeze({
    initialize(careerId: string, personId: string,
      initialClubId: string | null): PopularityHistory {
      const state = createPopularityHistory(careerId, personId,
        initialClubId);
      return transaction(() => {
        const row = headRow(careerId, personId);
        if (row) {
          const existing = verifyOfficialHistory(decodeHead(row, careerId, personId));
          if (existing.initialClubId !== initialClubId) {
            throw new Error('popularity head identity already initialized differently');
          }
          return existing;
        }
        db.prepare(`INSERT INTO popularity_heads
          (career_id, person_id, revision, state_json)
          VALUES (?, ?, ?, ?)`).run(careerId, personId,
          0, canonicalJson(state));
        return state;
      });
    },
    readHead(careerId: string, personId: string): PopularityHistory | null {
      if (!id(careerId) || !id(personId)) {
        throw new Error('invalid popularity head identity');
      }
      return readSnapshot(() => {
        const row = headRow(careerId, personId);
        return row ? verifyOfficialHistory(decodeHead(row, careerId, personId)) : null;
      });
    },
    readApplication(eventId: string): DurablePopularityEventApplication | null {
      if (!id(eventId)) throw new Error('invalid popularity eventId');
      return readSnapshot(() => {
        const row = applicationRow(eventId);
        return row ? decodeApplication(row) : null;
      });
    },
    apply(request: PopularityStoreRequest): DurablePopularityApplication {
      if (!request || !id(request.eventId) || !id(request.careerId)
        || !id(request.personId) || !id(request.playerId)
        || !revision(request.expectedRevision)) {
        throw new Error('invalid popularity store request');
      }
      const requestJson = canonicalJson(request);
      return transaction(() => {
        const prior = applicationRow(request.eventId);
        if (prior) {
          const durable = decodeApplication(prior);
          if (prior.request_json !== requestJson) {
            throw new Error('eventId was used for different popularity evidence');
          }
          if (durable.source.kind !== 'FREE_AGENT_RIGHTS_ACQUIRED') throw new Error('eventId belongs to official participation');
          return durable as DurablePopularityApplication;
        }
        const row = headRow(request.careerId, request.personId);
        if (!row) throw new Error('popularity head is not initialized');
        const before = verifyOfficialHistory(decodeHead(row, request.careerId, request.personId));
        if (row.revision !== request.expectedRevision) {
          throw new Error('stale popularity revision');
        }
        const accepted = authority?.readAcceptedFreeAgentRightsEvent(
          request.eventId);
        if (!accepted
          || accepted.rightsEvent?.eventId !== request.eventId) {
          throw new Error('accepted free-agent rights source is absent');
        }
        if (accepted.personId !== request.personId
          || accepted.playerId !== request.playerId
          || !id(accepted.personLinkSourceId)) {
          throw new Error('accepted source person link mismatch');
        }
        const rights = accepted.rightsEvent;
        const event = adaptFreeAgentRightsEvent(rights,
          accepted.personId, accepted.playerId);
        const next = appendPopularityExposure(before,
          request.expectedRevision, event, request.evidence,
          request.policy, request.asOfDay);
        const nextJson = canonicalJson(next);
        const updated = db.prepare(`UPDATE popularity_heads
          SET revision=?, state_json=?
          WHERE career_id=? AND person_id=? AND revision=?
          AND state_json=?`).run(next.revision, nextJson,
          request.careerId, request.personId,
          request.expectedRevision, row.state_json);
        if (updated.changes !== 1) {
          throw new Error('popularity compare-and-swap failed');
        }
        const durable: DurablePopularityApplication = Object.freeze({
          eventId: request.eventId, history: next,
          source: Object.freeze({ kind: rights.type,
            sourceClubEventId: rights.sourceClubEventId,
            personLinkSourceId: accepted.personLinkSourceId }),
        });
        db.prepare(`INSERT INTO popularity_event_applications
          (event_id, career_id, person_id, from_revision,
           to_revision, before_json, request_json, source_json, result_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(request.eventId,
          request.careerId, request.personId, request.expectedRevision,
          next.revision, row.state_json, requestJson,
          canonicalJson(accepted), canonicalJson(durable));
        return decodeApplication(applicationRow(request.eventId)!) as DurablePopularityApplication;
      });
    },
    applyOfficialParticipation(request: PopularityStoreRequest): DurableOfficialGamePopularityApplication {
      if (!request || !id(request.eventId) || !id(request.careerId) || !id(request.personId)
        || !id(request.playerId) || !revision(request.expectedRevision)) throw new Error('invalid official popularity request');
      const requestJson = canonicalJson(request);
      return transaction(() => {
        const prior = applicationRow(request.eventId);
        if (prior) {
          const durable = decodeApplication(prior);
          if (durable.source.kind !== 'OFFICIAL_GAME' || prior.request_json !== requestJson) {
            throw new Error('eventId was used for different popularity evidence');
          }
          return durable as DurableOfficialGamePopularityApplication;
        }
        const row = headRow(request.careerId, request.personId);
        if (!row) throw new Error('popularity head is not initialized');
        const before = verifyOfficialHistory(decodeHead(row, request.careerId, request.personId));
        if (before.revision !== request.expectedRevision) throw new Error('stale popularity revision');
        const source = readOfficialSource(request.eventId), durable = officialApplication(request, source, before);
        const updated = db.prepare(`UPDATE popularity_heads SET revision=?, state_json=?
          WHERE career_id=? AND person_id=? AND revision=? AND state_json=?`).run(durable.history.revision,
          canonicalJson(durable.history), request.careerId, request.personId, request.expectedRevision, row.state_json);
        if (updated.changes !== 1) throw new Error('popularity compare-and-swap failed');
        db.prepare(`INSERT INTO popularity_event_applications
          (event_id, career_id, person_id, from_revision, to_revision, before_json, request_json, source_json, result_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(request.eventId, request.careerId, request.personId,
          request.expectedRevision, durable.history.revision, row.state_json, requestJson, canonicalJson(source), canonicalJson(durable));
        // Authenticate again after the real INSERT; a trigger cannot substitute the original receipt or Person.
        return decodeApplication(applicationRow(request.eventId)!) as DurableOfficialGamePopularityApplication;
      });
    },
    close(): void {
      if (!closed) { db.close(); closed = true; }
    },
  });
};
