import assert from 'node:assert/strict';
import { test } from 'vitest';
import { resolveEventQueueWatermark } from './EventQueueWatermark';

test('global event watermark is the lowest settled source bound capped at current tick', () => {
  assert.equal(resolveEventQueueWatermark(100, [
    { sourceId: 'batting', settledThroughTick: 100, nextPendingTick: null },
    { sourceId: 'throw', settledThroughTick: 98, nextPendingTick: 99 },
    { sourceId: 'runner', settledThroughTick: 120, nextPendingTick: null },
  ]).settledThroughTick, 98);
});

test('empty event sources are settled through the current tick', () => {
  assert.deepEqual(resolveEventQueueWatermark(55, []), { tick: 55, settledThroughTick: 55, sources: [] });
});

test('source cannot claim settlement through or beyond its next pending event', () => {
  assert.throws(() => resolveEventQueueWatermark(100, [
    { sourceId: 'bad', settledThroughTick: 99, nextPendingTick: 99 },
  ]));
});

test('duplicate source ids are rejected', () => {
  assert.throws(() => resolveEventQueueWatermark(100, [
    { sourceId: 'x', settledThroughTick: 80, nextPendingTick: 90 },
    { sourceId: 'x', settledThroughTick: 81, nextPendingTick: 91 },
  ]));
});
