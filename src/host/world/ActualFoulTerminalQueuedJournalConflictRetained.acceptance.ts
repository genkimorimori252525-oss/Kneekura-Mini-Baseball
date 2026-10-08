import { expect, it } from 'vitest';
import { assertNoOwnerWrites, withRetainedQueuedJournal } from './ActualFoulTerminalQueuedJournalRetained.test-support';

it('Q07c retained QUEUED original journal rejects changed same-ID accepted event and intent bytes without writes', async () => {
  await withRetainedQueuedJournal(f => {
    const called = f.accepted[0], intent = called.intent;
    if (!intent || called.source.action.kind !== 'record_call') throw new Error('authenticated original call intent is missing');
    const rejectExactly = (message: string) => {
      assertNoOwnerWrites(() => {
        let caught: unknown;
        try { f.official.acceptEvent(called.source.sourceId); } catch (error) { caught = error; }
        expect(caught).toBeInstanceOf(Error); expect((caught as Error).message).toBe(message);
      });
      f.assertUnchanged();
    };
    // Only the test authority callback values change. Archived Source bytes,
    // original journal rows, QUEUED state and physical roots remain untouched.
    try {
      f.sources.events.set(called.source.sourceId, { ...called.source, sourceVersion: 'changed-after-retained-queue' });
      rejectExactly('foul official event Source is frozen differently');
    } finally { f.sources.events.set(called.source.sourceId, called.source); }
    try {
      f.sources.intents.set(intent.sourceId, { ...intent, sourceVersion: 'changed-after-retained-queue' });
      rejectExactly('foul official intent Source is frozen differently');
    } finally { f.sources.intents.set(intent.sourceId, intent); }
    expect(f.sources.events.get(called.source.sourceId)).toEqual(called.source);
    expect(f.sources.intents.get(intent.sourceId)).toEqual(intent);
  });
}, 1_200_000);
