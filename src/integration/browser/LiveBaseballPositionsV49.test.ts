import { expect, it, vi } from 'vitest';
import { simulateLiveFieldPlayV1 } from '../../core/sim/fielding/LiveFieldPlayV1';
import { createLiveBaseballMatchV1, type LivePositionV1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';

vi.mock('../../core/sim/fielding/LiveFieldPlayV1', async importOriginal => {
  const actual = await importOriginal<typeof import('../../core/sim/fielding/LiveFieldPlayV1')>();
  return { ...actual, simulateLiveFieldPlayV1: vi.fn(actual.simulateLiveFieldPlayV1) };
});

it('passes the actual defensive lineup positions to the physical field controller', () => {
  const input = liveMatchFixture(2468), host = createLiveBaseballMatchV1(input),
    spy = vi.mocked(simulateLiveFieldPlayV1), positions: LivePositionV1[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  spy.mockClear();
  for (let i = 0; i < 30 && spy.mock.calls.length === 0; i++)
    host.issuePitch({ batting: 'balanced', pitchType: 'auto', location: 'auto', managedTeam: 0 });
  expect(spy.mock.calls.length).toBeGreaterThan(0);
  const physical = spy.mock.calls[0][0], lineup = input.teams[1].defense;
  expect(physical.fielders).toHaveLength(9);
  for (const position of positions) expect(physical.fielders.find(f => f.playerId === lineup[position])?.defensivePosition).toBe(position);
  expect(new Set(physical.fielders.map(f => f.defensivePosition)).size).toBe(9);
});
