import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import { asRuleProfileId } from '../model/RuleProfileRef';
import { prepareBetweenPlayWorld, type BetweenPlayWorldSetup } from './BetweenPlayWorldReset';

const match = (): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 1, half: 'top', outs: 1, balls: 0, strikes: 0,
  bases: { first: 'r1', second: null, third: 'r3' },
  score: { away: 0, home: 0 }, playId: 8,
});
const setup = (): BetweenPlayWorldSetup => ({
  baseCenters: {
    first: { x: 27, z: 0 }, second: { x: 27, z: 27 }, third: { x: 0, z: 27 },
  },
  defenders: (['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const).map(
    (registeredPosition, index) => ({
      playerId: `defender-${index}`, registeredPosition,
      position: { x: index, z: index },
    }),
  ),
  activePreviousPlayControllerIds: [],
});

describe('between-play world reset', () => {
  it('builds only official base occupants with idle defenders and no old ball', () => {
    const world = prepareBetweenPlayWorld(match(), 503, setup());
    expect(world).toMatchObject({
      tick: 503, ball: null,
      runners: [
        { playerId: 'r1', position: { x: 27, z: 0 }, velocity: { x: 0, z: 0 } },
        { playerId: 'r3', position: { x: 0, z: 27 }, velocity: { x: 0, z: 0 } },
      ],
    });
    expect(world.defenders).toHaveLength(9);
    expect(world.defenders.every((defender) => defender.assignment.kind === 'hold'
      && defender.velocity.x === 0 && defender.velocity.z === 0)).toBe(true);
  });

  it('rejects stale controllers and ambiguous or overlapping actor placement', () => {
    expect(() => prepareBetweenPlayWorld(match(), 503, {
      ...setup(), activePreviousPlayControllerIds: ['old-runner-controller'],
    })).toThrow('previous-play controllers must be retired');
    expect(() => prepareBetweenPlayWorld(match(), 503, {
      ...setup(), baseCenters: { ...setup().baseCenters, third: { x: 27, z: 0 } },
    })).toThrow('base centers must be distinct');
    expect(() => prepareBetweenPlayWorld(match(), 503, {
      ...setup(), defenders: setup().defenders.slice(0, 8),
    })).toThrow('all nine defensive positions');
    expect(() => prepareBetweenPlayWorld(match(), 503, {
      ...setup(), defenders: [
        { ...setup().defenders[0], playerId: 'r1' }, ...setup().defenders.slice(1),
      ],
    })).toThrow('runner actors must be unique and distinct');
  });
});
