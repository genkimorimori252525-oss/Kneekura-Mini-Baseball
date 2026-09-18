import { describe, expect, it } from 'vitest';
import {
  createBatterTrueTendency,
} from './BatterTendency';

describe('BatterTendency', () => {
  it('creates normalized true direction and trajectory distributions', () => {
    expect(createBatterTrueTendency({
      directionDistribution: {
        pull: 0.6,
        middle: 0.25,
        opposite: 0.15,
      },
      trajectoryDistribution: {
        ground: 0.45,
        line: 0.25,
        fly: 0.25,
        popup: 0.05,
      },
      contextAdjustments: [],
    })).toEqual({
      directionDistribution: {
        pull: 0.6,
        middle: 0.25,
        opposite: 0.15,
      },
      trajectoryDistribution: {
        ground: 0.45,
        line: 0.25,
        fly: 0.25,
        popup: 0.05,
      },
      contextAdjustments: [],
    });
  });

  it('rejects distributions that do not sum to one', () => {
    expect(() => createBatterTrueTendency({
      directionDistribution: {
        pull: 0.7,
        middle: 0.3,
        opposite: 0.2,
      },
      trajectoryDistribution: {
        ground: 0.45,
        line: 0.25,
        fly: 0.25,
        popup: 0.05,
      },
      contextAdjustments: [],
    })).toThrow(
      'directionDistribution probabilities must sum to 1',
    );
  });

  it('allows context-specific latent tendencies without exposing them to scouting code', () => {
    const result = createBatterTrueTendency({
      directionDistribution: {
        pull: 0.5,
        middle: 0.3,
        opposite: 0.2,
      },
      trajectoryDistribution: {
        ground: 0.5,
        line: 0.2,
        fly: 0.25,
        popup: 0.05,
      },
      contextAdjustments: [{
        contextKey: 'vs-left-handed-pitcher',
        directionDistribution: {
          pull: 0.35,
          middle: 0.35,
          opposite: 0.3,
        },
        trajectoryDistribution: {
          ground: 0.4,
          line: 0.3,
          fly: 0.25,
          popup: 0.05,
        },
      }],
    });

    expect(result.contextAdjustments[0].contextKey)
      .toBe('vs-left-handed-pitcher');
  });
});
