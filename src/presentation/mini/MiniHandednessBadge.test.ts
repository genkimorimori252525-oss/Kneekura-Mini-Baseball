import { describe, expect, it } from 'vitest';
import {
  buildMiniHandednessBadge,
} from './MiniHandednessBadge';

describe('MiniHandednessBadge', () => {
  it('renders right-handed batter as red right-bat label', () => {
    expect(buildMiniHandednessBadge(
      'batter',
      'R',
    )).toEqual({
      role: 'batter',
      handedness: 'R',
      label: '右打',
      accent: 'red',
    });
  });

  it('renders left-handed batter as blue left-bat label', () => {
    expect(buildMiniHandednessBadge(
      'batter',
      'L',
    )).toEqual({
      role: 'batter',
      handedness: 'L',
      label: '左打',
      accent: 'blue',
    });
  });

  it('uses 投 for pitcher labels while preserving the same color rule', () => {
    expect(buildMiniHandednessBadge(
      'pitcher',
      'R',
    )).toEqual({
      role: 'pitcher',
      handedness: 'R',
      label: '右投',
      accent: 'red',
    });

    expect(buildMiniHandednessBadge(
      'pitcher',
      'L',
    )).toEqual({
      role: 'pitcher',
      handedness: 'L',
      label: '左投',
      accent: 'blue',
    });
  });
});
