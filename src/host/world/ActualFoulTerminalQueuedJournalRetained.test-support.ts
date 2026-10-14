// Acceptance-only adapter for a closed, explicitly pinned QUEUED producer.
// It never manufactures physical roots or moves a later durable stage backward.
import type { DatabaseSync as Database } from 'node:sqlite';
import { expect } from 'vitest';
import { openSqliteActualFoulOfficialStore } from './SqliteActualFoulOfficialStore';
import { openSqliteActualFoulTerminalApplicationStore } from './SqliteActualFoulTerminalApplicationStore';
import type { AcceptedFoulOfficialEvent, AcceptedFoulOfficialIntent, AcceptedFoulOfficialSession,
  FoulOfficialProjection } from './ActualFoulOfficial';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { assertClosedTerminalSidecars } from './ActualFoulTerminalCutover.test-support';
import { fileHash, rawCensus, schemaCensus, terminalRows } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { assertNoOwnerWrites, DatabaseSync, finishOwned, prepareCapableQueuedCopy, sourceId }
  from './ActualFoulTerminalAcknowledgementIntegrity.test-support';

/** Pass-through constructor observation; the real Native connection is kept
 * solely to verify restoration and actual close, never to supply reader data. */
export const openObservedQueuedJournalOwner = <T extends { close(): void }>(open: () => T) => {
  const prototype = DatabaseSync.prototype, descriptor = Object.getOwnPropertyDescriptor(prototype, 'prepare');
  if (!descriptor || typeof descriptor.value !== 'function') throw new Error('Native prepare descriptor is missing');
  let connection: Database | undefined, owner: T | undefined, failed = false, primary: unknown;
  const installed = { ...descriptor, value: function(this: Database, ...args: unknown[]) {
    if (connection && connection !== this) throw new Error('journal opener unexpectedly used multiple connections');
    connection = this; return Reflect.apply(descriptor.value, this, args);
  } };
  Object.defineProperty(prototype, 'prepare', installed);
  try {
    owner = open();
    if (!connection) throw new Error('journal opener connection was not observed');
    return { owner, connection };
  } catch (error) { failed = true; primary = error; throw error; }
  finally {
    const current = Object.getOwnPropertyDescriptor(prototype, 'prepare');
    const intact = current !== undefined && (['configurable', 'enumerable', 'value', 'writable', 'get', 'set'] as const)
      .every(key => current[key] === installed[key]);
    finishOwned(failed, primary, [
      () => {
        if (!intact) throw new Error('later Native prepare interceptor was preserved');
        Object.defineProperty(prototype, 'prepare', descriptor);
      },
      () => { if (failed || !intact) owner?.close(); },
    ]);
  }
};

const prepareRetainedQueuedJournal = () => {
  const prepared = prepareCapableQueuedCopy();
  let observer: Database | undefined;
  let journal: ReturnType<typeof openObservedQueuedJournalOwner<ReturnType<typeof openSqliteActualFoulOfficialStore>>> | undefined;
  let queue: ReturnType<typeof openObservedQueuedJournalOwner<ReturnType<typeof openSqliteActualFoulTerminalApplicationStore>>> | undefined;
  let failed = false, primary: unknown, transferred = false;
  try {
    observer = new DatabaseSync(prepared.path);
    const rows = rawCensus(observer), schema = schemaCensus(observer);
    const sources = { sessions: new Map<string, AcceptedFoulOfficialSession>(),
      events: new Map<string, AcceptedFoulOfficialEvent>(), intents: new Map<string, AcceptedFoulOfficialIntent>() };
    queue = openObservedQueuedJournalOwner(() => openSqliteActualFoulTerminalApplicationStore(prepared.path));
    journal = openObservedQueuedJournalOwner(() => openSqliteActualFoulOfficialStore(prepared.path, {
      readAcceptedSession: id => sources.sessions.get(id) ?? null,
      readAcceptedEvent: id => sources.events.get(id) ?? null,
      readAcceptedIntent: id => sources.intents.get(id) ?? null,
    }));
    const queued = queue.owner.read(sourceId);
    if (!queued || queued.status !== 'QUEUED') throw new Error('RETAINED_QUEUED_JOURNAL_PREREQUISITE_MISSING');
    expect(queued.officialApplied).toBe(false); expect(queued.result).toBeNull();
    expect(terminalRows(observer)).toHaveLength(1);
    expect(terminalRows(observer)[0]).toMatchObject({ source_id: sourceId, status: 'QUEUED', result_json: null,
      source_json: json(queued.source), source_hash: hash(queued.source),
      proposal_json: json(queued.proposal), proposal_hash: hash(queued.proposal) });
    expect(observer.prepare('SELECT * FROM main.applications WHERE application_id=?').all(queued.source.applicationId)).toEqual([]);

    const reference = queued.source.officialReference;
    const current = journal.owner.readCurrent(reference.sessionSourceId);
    if (!current) throw new Error('RETAINED_ORIGINAL_JOURNAL_PREREQUISITE_MISSING');
    expect(current).toMatchObject({ revision: 3, headSourceId: reference.headSourceId, headHash: reference.headHash,
      kind: 'terminal_foul_application_pending', handoff: null });
    expect(reference.revision).toBe(3);
    expect(current.source.physicalEndReference).toEqual(queued.source.physicalEndReference);
    const session = current.source;
    const sessionRows = observer.prepare('SELECT * FROM main.actual_foul_official_sessions ORDER BY source_id').all();
    expect(sessionRows).toHaveLength(1);
    expect(sessionRows[0]).toMatchObject({ source_id: session.sourceId, source_json: json(session), source_hash: hash(session) });
    const eventRows = observer.prepare('SELECT * FROM main.actual_foul_official_events ORDER BY revision').all();
    expect(eventRows.map(row => row.revision)).toEqual([1, 2, 3]);
    expect(observer.prepare('SELECT * FROM main.actual_foul_official_heads').all()).toEqual([{
      session_source_id: session.sourceId, revision: 3, head_source_id: current.headSourceId, head_hash: current.headHash,
    }]);
    expect(observer.prepare('SELECT * FROM main.actual_foul_official_handoffs').all()).toEqual([]);

    // Native readCurrent replays and authenticates all accepted event and intent
    // bytes. Native readAt separately authenticates each original earlier head.
    const snapshots: FoulOfficialProjection[] = [];
    for (let revision = 0; revision < 3; revision++) {
      const snapshot = journal.owner.readAt(session.sourceId, revision);
      if (!snapshot) throw new Error('retained original journal revision is missing: ' + revision);
      const row = revision === 0 ? sessionRows[0] : eventRows[revision - 1];
      expect(row.snapshot_json).toBe(json(snapshot)); expect(row.snapshot_hash).toBe(hash(snapshot));
      snapshots.push(snapshot);
    }
    expect(eventRows[2].snapshot_json).toBe(json(current)); expect(eventRows[2].snapshot_hash).toBe(hash(current));
    snapshots.push(current);
    const accepted = eventRows.map((row, index) => {
      const source = JSON.parse(String(row.source_json)) as AcceptedFoulOfficialEvent;
      const intent = row.intent_json === null ? null : JSON.parse(String(row.intent_json)) as AcceptedFoulOfficialIntent;
      expect(row.source_json).toBe(json(source)); expect(row.source_hash).toBe(hash(source));
      expect(source).toMatchObject({ sessionSourceId: session.sourceId, expectedRevision: index,
        parent: { sourceId: snapshots[index].headSourceId, snapshotHash: snapshots[index].headHash } });
      expect(source.action.kind).toBe(['record_call', 'advance_tick', 'next_pitch_fence'][index]);
      expect(snapshots[index + 1].headSourceId).toBe(source.sourceId);
      if (intent) {
        expect(row.intent_json).toBe(json(intent)); expect(snapshots[index + 1].callIntent).toEqual(intent);
        sources.intents.set(intent.sourceId, intent);
      }
      sources.events.set(source.sourceId, source);
      return { source, intent, value: snapshots[index + 1] };
    });
    sources.sessions.set(session.sourceId, session);
    expect(sources.intents.size).toBe(1);
    const ownedObserver = observer, ownedJournal = journal, ownedQueue = queue;
    const assertUnchanged = () => {
      expect(rawCensus(ownedObserver)).toEqual(rows); expect(schemaCensus(ownedObserver)).toEqual(schema);
      for (const connection of [ownedObserver, ownedJournal.connection, ownedQueue.connection]) {
        expect(connection.isTransaction).toBe(false);
        expect(connection.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
        expect(connection.prepare('SELECT total_changes() AS n').get()!.n).toBe(0);
      }
      expect(fileHash(prepared.producer.sourcePath)).toBe(prepared.producer.sourceSha256);
    };
    assertUnchanged();
    let closed = false;
    const close = () => {
      if (closed) return; closed = true;
      finishOwned(false, undefined, [
        () => ownedJournal.owner.close(), () => ownedQueue.owner.close(), () => ownedObserver.close(),
        ...[ownedObserver, ownedJournal.connection, ownedQueue.connection].map(connection =>
          () => expect(() => connection.prepare('SELECT 1')).toThrow()),
        () => expect(() => ownedJournal.owner.readCurrent(session.sourceId)).toThrow('closed foul official store'),
        () => expect(() => ownedQueue.owner.read(sourceId)).toThrow('closed foul terminal queue store'),
        () => assertClosedTerminalSidecars(prepared.path),
        () => expect(fileHash(prepared.producer.sourcePath)).toBe(prepared.producer.sourceSha256),
      ]);
    };
    transferred = true;
    return { ...prepared, observer: ownedObserver, official: ownedJournal.owner, queue: ownedQueue.owner,
      sources, queued, session, accepted, snapshots, current, assertUnchanged, close };
  } catch (error) { failed = true; primary = error; throw error; }
  finally {
    if (!transferred) finishOwned(failed, primary, [() => journal?.owner.close(), () => queue?.owner.close(),
      () => observer?.close(), () => assertClosedTerminalSidecars(prepared.path),
      () => expect(fileHash(prepared.producer.sourcePath)).toBe(prepared.producer.sourceSha256)]);
  }
};

export type RetainedQueuedJournal = ReturnType<typeof prepareRetainedQueuedJournal>;
export const withRetainedQueuedJournal = async (body: (fixture: RetainedQueuedJournal) => void | Promise<void>) => {
  const fixture = prepareRetainedQueuedJournal();
  let failed = false, primary: unknown;
  try { await body(fixture); }
  catch (error) { failed = true; primary = error; throw error; }
  finally { finishOwned(failed, primary, [() => fixture.assertUnchanged(), () => fixture.close()]); }
};

export { assertNoOwnerWrites };
