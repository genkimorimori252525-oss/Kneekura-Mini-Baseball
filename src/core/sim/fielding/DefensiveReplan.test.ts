import { describe, expect, it } from 'vitest';
import {
  findNextDefensiveReplanTick,
  type DefensiveReplanTrigger,
} from './DefensiveReplan';

const trigger = (
  kind: DefensiveReplanTrigger['kind'],
  perceivedAt: number,
): DefensiveReplanTrigger => ({ kind, perceivedAt });

describe('DefensiveReplan', () => {
  it('returns the earliest meaningful perceived trigger after the last decision', () => {
    const triggers: readonly DefensiveReplanTrigger[] = [
      trigger('communication_received', 1_180_000),
      trigger('teammate_commitment_recognized', 1_120_000),
      trigger('runner_motion_recognized', 1_160_000),
    ];

    expect(findNextDefensiveReplanTick(1_100_000, triggers)).toBe(1_120_000);
  });

  it('does not replan again for triggers already consumed at or before the last decision', () => {
    const triggers: readonly DefensiveReplanTrigger[] = [
      trigger('batted_ball_recognized', 1_000_000),
      trigger('teammate_commitment_recognized', 1_040_000),
    ];

    expect(findNextDefensiveReplanTick(1_040_000, triggers)).toBeNull();
  });

  it('preserves physical simultaneity instead of using array order as precedence', () => {
    const a: readonly DefensiveReplanTrigger[] = [
      trigger('coverage_need_changed', 2_250_000),
      trigger('throw_start_recognized', 2_250_000),
    ];
    const b = [...a].reverse();

    expect(findNextDefensiveReplanTick(2_000_000, a)).toBe(2_250_000);
    expect(findNextDefensiveReplanTick(2_000_000, b)).toBe(2_250_000);
  });

  it('supports every approved meaningful replan category', () => {
    const kinds: readonly DefensiveReplanTrigger['kind'][] = [
      'batted_ball_recognized',
      'teammate_commitment_recognized',
      'catch_outcome_recognized',
      'ball_direction_change_recognized',
      'throw_start_recognized',
      'runner_motion_recognized',
      'communication_received',
      'coverage_need_changed',
    ];

    expect(kinds).toHaveLength(8);
    for (const [index, kind] of kinds.entries()) {
      expect(
        findNextDefensiveReplanTick(null, [trigger(kind, 10_000 + index)]),
      ).toBe(10_000 + index);
    }
  });

  it('rejects invalid authoritative ticks', () => {
    expect(() => findNextDefensiveReplanTick(1.5, [])).toThrow();
    expect(() => findNextDefensiveReplanTick(null, [
      trigger('batted_ball_recognized', -1),
    ])).toThrow();
  });
});
