import { describe, expect, it } from 'vitest';
import {
  buildMiniPlayerCardState,
} from './MiniPlayerCardState';

describe('MiniPlayerCardState', () => {
  it('builds a batter card from explicit public identity metadata and handedness only', () => {
    expect(buildMiniPlayerCardState({
      role: 'batter',
      playerId: 'batter-1',
      displayName: 'Batter One',
      jerseyNumber: 7,
      publicMetrics: [
        { label: '打撃', value: 82 },
        { label: '走力', value: 74 },
      ],
      handedness: 'R',
    })).toEqual({
      role: 'batter',
      playerId: 'batter-1',
      displayName: 'Batter One',
      jerseyNumber: 7,
      publicMetrics: [
        { label: '打撃', value: 82 },
        { label: '走力', value: 74 },
      ],
      handedness: {
        role: 'batter',
        handedness: 'R',
        label: '右打',
        accent: 'red',
      },
    });
  });

  it('supports a pitcher card with left-handed blue badge', () => {
    expect(buildMiniPlayerCardState({
      role: 'pitcher',
      playerId: 'pitcher-1',
      handedness: 'L',
    })).toEqual({
      role: 'pitcher',
      playerId: 'pitcher-1',
      displayName: null,
      jerseyNumber: null,
      publicMetrics: [],
      handedness: {
        role: 'pitcher',
        handedness: 'L',
        label: '左投',
        accent: 'blue',
      },
    });
  });

  it('rejects empty public identity values instead of inventing names', () => {
    expect(() => buildMiniPlayerCardState({
      role: 'batter',
      playerId: '',
      handedness: 'R',
    })).toThrow(
      'playerId must not be empty',
    );

    expect(() => buildMiniPlayerCardState({
      role: 'batter',
      playerId: 'batter-1',
      displayName: '',
      handedness: 'R',
    })).toThrow(
      'displayName must not be empty when provided',
    );
  });
});
