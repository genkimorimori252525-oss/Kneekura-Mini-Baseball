import { afterEach, expect, it } from 'vitest';
import { practiceHash } from './PitchPracticeAttempt';
import { practiceOrderFixture } from './OwnedPitchPracticeOrder.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

it('does not reinterpret an ordinary durable attempt when a later order generates the same Source ID', async () => {
  const f = await practiceOrderFixture(cleanup), executionId = 'future-colliding-order';
  const sourceId = `practice-order:${practiceHash(['career-a', executionId])}`;
  const legacy = { ...f.base.opportunity, sourceId, opportunityId: 'legacy-before-owned-order' };
  f.base.opportunities.set(sourceId, legacy);
  // A real ordinary attempt owns this unrestricted Source first. The current
  // prefix defect blocks this setup; its separate RED must be repaired first.
  const complete = f.base.complete(sourceId); f.base.assess(complete);
  expect(f.base.owner.settle(complete.attemptId).kind).toBe('complete');
  const original = f.base.owner.read(complete.attemptId);
  const later = f.makePrescription(1, { atDay: 14 }), issued = f.prepare(f.request(later, 1));
  const before = f.snapshot();
  expect(() => f.issue(issued, executionId)).toThrow(/source|identity|already|collision|owned/i);
  expect(f.snapshot()).toBe(before);
  expect(f.base.owner.read(complete.attemptId)).toEqual(original);
  expect(f.owner.readOrder(sourceId)).toBeNull();
  expect(f.rows('pitch_practice_orders')).toHaveLength(0);
  expect(f.rows('world_player_workload_activities')).toHaveLength(1);
  expect(f.base.sources.episodes.read('episode')!.episode.practiceSourceEventIds).toHaveLength(1);
});
