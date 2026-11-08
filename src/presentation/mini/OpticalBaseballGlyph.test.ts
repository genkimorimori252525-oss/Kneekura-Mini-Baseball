import { describe, expect, it } from 'vitest';
import { createOpticalBaseballGlyph, opticalBallDiameterPx } from './OpticalBaseballGlyph';

const observations = [0.01, 0.02, 0.05, 0.1, 0.2, 0.4, 0.8, 1, 2, 4, 8, 16, 40, 80];

describe('read-only optical ball enlarger independent of Native physics', () => {
  it('preserves strictly continuous increasing apparent diameter instead of a fixed minimum', () => {
    for (const camera of ['batter', 'pitcher', 'runner', 'catcher', 'overhead'] as const) {
      const diameters = observations.map(d => opticalBallDiameterPx(d, camera));
      expect(diameters.every(value => value > 0)).toBe(true);
      expect(diameters.every((value, index) => index === 0 || value > diameters[index - 1]))
        .toBe(true);
      expect(opticalBallDiameterPx(0, camera)).toBe(0);
      expect(opticalBallDiameterPx(0.1, camera))
        .toBeLessThan(opticalBallDiameterPx(1, camera));
      expect(opticalBallDiameterPx(1, camera))
        .toBeLessThan(opticalBallDiameterPx(4, camera));
    }
  });

  it('maintains distant ball legibility with an optical, not physical, larger glyph', () => {
    expect(opticalBallDiameterPx(0.15, 'batter')).toBeGreaterThan(2);
    expect(opticalBallDiameterPx(0.25, 'overhead')).toBeGreaterThan(2);
    expect(opticalBallDiameterPx(4, 'overhead')).toBeGreaterThan(opticalBallDiameterPx(4, 'batter'));
    expect(createOpticalBaseballGlyph({
      camera: 'batter', projectedDiameterPx: 4, hasCanonicalOrientation: true,
    })).toMatchObject({ authority: 'PRESENTATION_ONLY', showSeams: true });
    expect(createOpticalBaseballGlyph({
      camera: 'overhead', projectedDiameterPx: 4, hasCanonicalOrientation: true,
    }).showSeams).toBe(false);
  });

  it('does not invent seam rotation without real physical orientation and rejects illegal projections', () => {
    expect(createOpticalBaseballGlyph({
      camera: 'catcher', projectedDiameterPx: 9, hasCanonicalOrientation: false,
    }).showSeams).toBe(false);
    expect(() => opticalBallDiameterPx(-1, 'overhead')).toThrow();
    expect(() => opticalBallDiameterPx(Number.POSITIVE_INFINITY, 'overhead')).toThrow();
    expect(() => opticalBallDiameterPx(Number.NaN, 'batter')).toThrow();
    expect(() => opticalBallDiameterPx(2, 'unknown' as 'overhead')).toThrow();
  });
});
