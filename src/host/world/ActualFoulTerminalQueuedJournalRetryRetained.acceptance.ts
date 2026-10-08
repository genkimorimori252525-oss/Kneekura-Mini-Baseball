import { expect, it } from 'vitest';
import { openSqliteActualFoulOfficialStore } from './SqliteActualFoulOfficialStore';
import { finishOwned } from './ActualFoulTerminalAcknowledgementIntegrity.test-support';
import { assertNoOwnerWrites, openObservedQueuedJournalOwner, withRetainedQueuedJournal }
  from './ActualFoulTerminalQueuedJournalRetained.test-support';

it('Q07b retained QUEUED original journal preserves offline session event retries and exact historical snapshots without writes', async () => {
  await withRetainedQueuedJournal(f => {
    // No Source callbacks are supplied: retries must authenticate the original
    // archived session, event and intent bytes through the real Native owner.
    const offline = openObservedQueuedJournalOwner(() => openSqliteActualFoulOfficialStore(f.path));
    let failed = false, primary: unknown;
    try {
      assertNoOwnerWrites(() => {
        expect(offline.owner.acceptSession(f.session.sourceId)).toEqual(f.snapshots[0]);
        expect(offline.owner.readAt(f.session.sourceId, 0)).toEqual(f.snapshots[0]);
        f.assertUnchanged();
        for (const accepted of f.accepted) {
          expect(offline.owner.acceptEvent(accepted.source.sourceId)).toEqual(accepted.value);
          expect(offline.owner.readAt(f.session.sourceId, accepted.value.revision)).toEqual(accepted.value);
          f.assertUnchanged();
        }
      });
      expect(offline.connection.isTransaction).toBe(false);
      expect(offline.connection.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
      expect(offline.connection.prepare('SELECT total_changes() AS n').get()!.n).toBe(0);
    } catch (error) { failed = true; primary = error; throw error; }
    finally { finishOwned(failed, primary, [
      () => offline.owner.close(),
      () => expect(() => offline.connection.prepare('SELECT 1')).toThrow(),
      () => expect(() => offline.owner.readAt(f.session.sourceId, 0)).toThrow('closed foul official store'),
    ]); }
  });
}, 1_200_000);
