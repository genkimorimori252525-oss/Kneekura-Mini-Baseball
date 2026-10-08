import { expect, it } from 'vitest';
import type { AcceptedFoulOfficialEvent } from './ActualFoulOfficial';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { assertNoOwnerWrites, withRetainedQueuedJournal } from './ActualFoulTerminalQueuedJournalRetained.test-support';

it('Q07a retained QUEUED original journal rejects fresh advance new fence and old-head fence before event or head writes', async () => {
  await withRetainedQueuedJournal(f => {
    const witness = witnessSqliteWrite(/^(?:INSERT INTO main\.actual_foul_official_events\b|UPDATE main\.actual_foul_official_heads\b)/, () => true);
    try {
      for (const [sourceId, kind, prior] of [
        ['retained-q07-new-advance', 'advance_tick', f.current],
        ['retained-q07-new-fence', 'next_pitch_fence', f.current],
        ['retained-q07-old-head-fence', 'next_pitch_fence', f.snapshots[1]],
      ] as const) {
        const source: AcceptedFoulOfficialEvent = { sourceId, sourceVersion: 'retained-q07-v1',
          capability: 'actual_post_play_foul_official_event_v1', sessionSourceId: f.session.sourceId,
          expectedRevision: prior.revision, parent: { sourceId: prior.headSourceId, snapshotHash: prior.headHash },
          action: { kind, schedulerId: f.session.assignment.schedulerId } };
        f.sources.events.set(sourceId, source);
        assertNoOwnerWrites(() => {
          let caught: unknown;
          try { f.official.acceptEvent(sourceId); } catch (error) { caught = error; }
          expect(caught).toBeInstanceOf(Error);
          expect((caught as Error).message).toBe('foul official terminal ownership already claimed');
        });
        expect(witness.wasReached()).toBe(false);
        f.assertUnchanged();
      }
    } finally { witness.close(); }
  });
}, 1_200_000);
