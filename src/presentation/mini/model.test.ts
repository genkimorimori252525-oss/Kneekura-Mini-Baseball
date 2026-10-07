import { describe, expect, it } from 'vitest';
import type { CanonicalPresentationSample } from './model';
import { MINI_PRESENTATION_CADENCE_MICROS } from './model';

describe('mini presentation runtime model', () => {
  it('keeps the established 55ms presentation cadence', () => {
    expect(MINI_PRESENTATION_CADENCE_MICROS).toBe(55_000);
  });

  it('represents bunt state without changing canonical world data', () => {
    const world = { tick: 1000, defenders: [], runners: [], ball: null } as const;
    const sample: CanonicalPresentationSample = {
      world,
      batter: {
        handedness: 'L',
        action: 'bunt_hold',
        bat: {
          grip: { x: -0.45, y: 1.05, z: 0.0 },
          tip: { x: 0.45, y: 1.1, z: 0.2 },
        },
      },
    };

    expect(sample.world).toBe(world);
    expect(sample.batter.action).toBe('bunt_hold');
  });
});
