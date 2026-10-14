import { afterEach, expect, it } from 'vitest';
import { practiceOriginOwnedOrderFixture } from './PracticeOriginOwnedOrder.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

it.each(['Human', 'Manager'] as const)('issues and reopens a genuine %s practice-origin order with zero roster executions', route => {
  const f = practiceOriginOwnedOrderFixture(cleanup, route), order = f.issue();
  expect(order.opportunity.episode).toEqual({ episodeId: f.f.packet.request.episodeId, revision: 2, domain: 'TECHNICAL' });
  expect(order.projection.managerSelfChosenEvidence === null).toBe(route === 'Human');
  expect(order.execution.worldRevision).toBe(1);
  expect(f.f.base.count('world_roster_executions')).toBe(0);
  expect(f.f.base.count('world_player_workload_activities')).toBe(1);
  expect(f.f.base.count('pitch_practice_attempts')).toBe(1);
  expect(f.f.episodes.read(f.f.packet.request.episodeId)!.episode.stage).toBe('HYPOTHESIS');
  const before = f.snapshot();
  expect(f.issue()).toEqual(order);
  expect(f.owner.readOrder(order.sourceId)).toEqual(order);
  f.reopen();
  expect(f.readDecision()).toEqual(f.prepared.decision);
  expect(f.prepare()).toEqual(f.prepared);
  expect(f.owner.readOrder(order.sourceId)).toEqual(order);
  expect(f.issue()).toEqual(order);
  expect(f.snapshot()).toBe(before);
});
