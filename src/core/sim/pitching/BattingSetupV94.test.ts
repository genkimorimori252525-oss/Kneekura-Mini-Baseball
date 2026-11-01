import { describe, expect, it } from 'vitest';
import { resolveLiveBattingSetupV94, validateBattingSetupV94 } from './BattingSetupV94';

describe('V94 normal batting setup', () => {
  it('preserves omitted source values and labels the old position separately from middle', () => {
    const source = { heightMeters: 1.8, bats: 'R' as const }, before = JSON.stringify(source), setup = resolveLiveBattingSetupV94(source);
    expect(setup.boxPosition).toBe('legacy');
    expect(setup.bodyPosition).toEqual({ x: -.85, y: 0, z: -.2 });
    expect(setup.contactPlaneZ).toBe(.15); expect(setup.cameraOffsetZ).toBe(0);
    expect(setup.region.lowerY).toBeCloseTo(1.8 * .27, 12);
    expect(setup.region.upperY).toBeCloseTo(1.8 * .535, 12);
    expect(setup.normalPose.basis).toBe('PROVISIONAL_LEGACY_HEIGHT_FALLBACK');
    expect(JSON.stringify(source)).toBe(before);
  });

  it('places ready and stepped feet inside the rule box for all positions and both sides', () => {
    for (const bats of ['R', 'L'] as const) {
      const positions = (['back', 'middle', 'front'] as const).map(boxPosition => resolveLiveBattingSetupV94({ heightMeters: 1.8, bats, battingSetupV94: { boxPosition } }));
      expect(positions[0].bodyZ).toBeLessThan(positions[1].bodyZ); expect(positions[1].bodyZ).toBeLessThan(positions[2].bodyZ);
      for (const setup of positions) {
        for (const foot of [...setup.readyFeet, ...setup.contactFeet]) {
          expect(foot.minX).toBeGreaterThanOrEqual(setup.legalBox.minX - 1e-12); expect(foot.maxX).toBeLessThanOrEqual(setup.legalBox.maxX + 1e-12);
          expect(foot.minZ).toBeGreaterThanOrEqual(setup.legalBox.minZ - 1e-12); expect(foot.maxZ).toBeLessThanOrEqual(setup.legalBox.maxZ + 1e-12);
        }
        expect(setup.contactPlaneZ).toBeCloseTo(.15 + setup.stanceOffsetZ, 12);
        expect(setup.cameraOffsetZ).toBe(setup.stanceOffsetZ);
        expect(setup.volume).toEqual(positions[0].volume);
      }
      expect(positions[0].readyFeet[0].minZ).toBeCloseTo(positions[0].legalBox.minZ, 12);
      expect(positions[2].contactFeet[1].maxZ).toBeCloseTo(positions[2].legalBox.maxZ, 12);
    }
  });

  it('uses authored normal-pose landmarks and player height in the shared zone', () => {
    const battingSetupV94 = { normalPose: { shoulderTopRatio: .68, uniformPantsTopRatio: .46, kneecapBottomRatio: .24 } };
    const short = resolveLiveBattingSetupV94({ heightMeters: 1.6, bats: 'L', battingSetupV94 }), tall = resolveLiveBattingSetupV94({ heightMeters: 2, bats: 'R', battingSetupV94 });
    expect(short.region.upperY).toBeCloseTo(1.6 * .57, 12); expect(short.region.lowerY).toBeCloseTo(1.6 * .24, 12);
    expect(tall.region.upperY).toBeGreaterThan(short.region.upperY); expect(tall.region.halfWidth).toBe(short.region.halfWidth);
    expect(short.normalPose.basis).toBe('AUTHORED_NORMAL_BATTING_POSE');
    expect(short.volume.lowerY).toBe(short.region.lowerY); expect(short.volume.upperY).toBe(short.region.upperY);
  });

  it('rejects unknown fields, invalid body landmarks and feet that cannot fit without clipping', () => {
    for (const value of [{ boxPosition: 'legacy' }, { extra: 1 }, { strideMeters: -1 }, { footWidthMeters: NaN },
      { normalPose: { shoulderTopRatio: .4, uniformPantsTopRatio: .5, kneecapBottomRatio: .2 } },
      { footSeparationMeters: 1.5, strideMeters: .5 }]) expect(() => validateBattingSetupV94(value)).toThrow();
    expect(() => resolveLiveBattingSetupV94({ heightMeters: 1.8, bats: 'R', battingSetupV94: { footSeparationMeters: 1.1 } })).toThrow('legacy');
  });
});
