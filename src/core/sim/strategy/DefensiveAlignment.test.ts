import { describe, expect, it } from 'vitest';
import {
  createDefensiveAlignment,
} from './DefensiveAlignment';

const defenders = [
  ['p', 'P', 0, 18],
  ['c', 'C', 0, -2],
  ['1b', '1B', 20, 20],
  ['2b', '2B', 8, 24],
  ['3b', '3B', -20, 20],
  ['ss', 'SS', -8, 24],
  ['lf', 'LF', -30, 55],
  ['cf', 'CF', 0, 60],
  ['rf', 'RF', 30, 55],
] as const;

describe('DefensiveAlignment', () => {
  it('stores nine registered positions separately from arbitrary continuous-world start coordinates', () => {
    const alignment = createDefensiveAlignment(
      defenders.map(
        ([playerId, registeredPosition, x, z]) => ({
          playerId,
          registeredPosition,
          start: { x, z },
        }),
      ),
    );

    expect(alignment.defenders).toHaveLength(9);
    expect(
      alignment.defenders.find(
        (defender) => defender.playerId === 'cf',
      ),
    ).toEqual({
      playerId: 'cf',
      registeredPosition: 'CF',
      start: { x: 0, z: 60 },
    });
  });

  it('allows a registered center fielder to start in an infield-like coordinate without changing registration', () => {
    const alignment = createDefensiveAlignment(
      defenders.map(
        ([playerId, registeredPosition, x, z]) => ({
          playerId,
          registeredPosition,
          start: playerId === 'cf'
            ? { x: 0, z: 22 }
            : { x, z },
        }),
      ),
    );

    const cf = alignment.defenders.find(
      (defender) => defender.playerId === 'cf',
    );
    expect(cf?.registeredPosition).toBe('CF');
    expect(cf?.start).toEqual({ x: 0, z: 22 });
  });

  it('requires exactly one defender for each registered defensive position', () => {
    expect(() => createDefensiveAlignment(
      defenders.slice(0, 8).map(
        ([playerId, registeredPosition, x, z]) => ({
          playerId,
          registeredPosition,
          start: { x, z },
        }),
      ),
    )).toThrow(
      'defensive alignment must contain exactly nine defenders',
    );

    const duplicateCf = defenders.map(
      ([playerId, registeredPosition, x, z]) => ({
        playerId,
        registeredPosition:
          playerId === 'rf'
            ? 'CF' as const
            : registeredPosition,
        start: { x, z },
      }),
    );

    expect(() => createDefensiveAlignment(
      duplicateCf,
    )).toThrow(
      'defensive alignment must contain each registered defensive position exactly once',
    );
  });

  it('rejects duplicate player identities and non-finite coordinates', () => {
    const duplicatePlayer = defenders.map(
      ([playerId, registeredPosition, x, z]) => ({
        playerId:
          playerId === 'rf' ? 'cf' : playerId,
        registeredPosition,
        start: { x, z },
      }),
    );

    expect(() => createDefensiveAlignment(
      duplicatePlayer,
    )).toThrow(
      'defensive alignment playerIds must be unique',
    );

    const invalid = defenders.map(
      ([playerId, registeredPosition, x, z]) => ({
        playerId,
        registeredPosition,
        start: {
          x: playerId === 'cf' ? Number.NaN : x,
          z,
        },
      }),
    );

    expect(() => createDefensiveAlignment(
      invalid,
    )).toThrow(
      'defender start coordinates must be finite',
    );
  });
});
