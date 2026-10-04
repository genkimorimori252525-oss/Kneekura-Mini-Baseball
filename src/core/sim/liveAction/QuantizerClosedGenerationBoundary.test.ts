import { describe, expect, it } from 'vitest';
import { quantizeEventTick } from '../ExactEventTime';
import { deriveQuantizerClosedGenerationBoundary as derive, type QuantizerClosedGenerationBoundaryInput } from './QuantizerClosedGenerationBoundary';

const nextFloat = (value: number, direction: -1 | 1): number => {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) + BigInt(direction));
  return view.getFloat64(0);
};

describe('quantizer-closed arithmetic generation boundary', () => {
  it('includes root-noise events after the nominal integer boundary without inventing a new epsilon', () => {
    const input = { originTick: 2_000_000, throughTick: 2_002_000, ticksPerSecond: 1_000_000 };
    const nominal = (input.throughTick - input.originTick) / input.ticksPerSecond;
    expect(quantizeEventTick(input.originTick, nextFloat(nominal, 1), input.ticksPerSecond)).toBe(input.throughTick);
    const boundary = derive(input);
    expect(boundary.version).toBe('quantizer_closed_generation_boundary_v1');
    expect(boundary.lastIncludedElapsedSeconds).toBeGreaterThan(nominal);
    expect(boundary.firstExcludedElapsedSeconds).toBe(nextFloat(boundary.lastIncludedElapsedSeconds, 1));
    expect(quantizeEventTick(input.originTick, boundary.lastIncludedElapsedSeconds, input.ticksPerSecond)).toBe(input.throughTick);
    expect(boundary.firstExcludedTick).toBe(input.throughTick + 1);
    expect(quantizeEventTick(input.originTick, boundary.firstExcludedElapsedSeconds, input.ticksPerSecond)).toBe(boundary.firstExcludedTick);
    expect(Object.isFrozen(boundary)).toBe(true);
    expect(Object.keys(boundary).sort()).toEqual(['firstExcludedElapsedSeconds', 'firstExcludedTick', 'lastIncludedElapsedSeconds',
      'originTick', 'throughTick', 'ticksPerSecond', 'version'].sort());
  });

  it('handles the root tick, non-binary clocks, and large authoritative clocks with adjacent-float proof', () => {
    for (const originTick of [0, 7, 2_000_000, Number.MAX_SAFE_INTEGER - 1024]) {
      for (const ticksPerSecond of [1, 3, 60, 1_000_000, Number.MAX_SAFE_INTEGER]) {
        for (const offset of [0, 1, 19, 511]) {
          const throughTick = originTick + offset;
          const boundary = derive({ originTick, throughTick, ticksPerSecond });
          expect(boundary.firstExcludedElapsedSeconds).toBeGreaterThan(boundary.lastIncludedElapsedSeconds);
          expect(nextFloat(boundary.firstExcludedElapsedSeconds, -1)).toBe(boundary.lastIncludedElapsedSeconds);
          expect(quantizeEventTick(originTick, boundary.lastIncludedElapsedSeconds, ticksPerSecond)).toBeLessThanOrEqual(throughTick);
          expect(boundary.firstExcludedTick).not.toBeNull();
          expect(quantizeEventTick(originTick, boundary.firstExcludedElapsedSeconds, ticksPerSecond)).toBeGreaterThan(throughTick);
          let before = boundary.lastIncludedElapsedSeconds, after = boundary.firstExcludedElapsedSeconds;
          for (let i = 0; i < 16; i++) {
            expect(quantizeEventTick(originTick, before, ticksPerSecond)).toBeLessThanOrEqual(throughTick);
            expect(quantizeEventTick(originTick, after, ticksPerSecond)).toBeGreaterThan(throughTick);
            before = nextFloat(before, -1); after = nextFloat(after, 1);
          }
          expect(derive({ ticksPerSecond, throughTick, originTick })).toEqual(boundary);
        }
      }
    }
  });

  it('labels safe-clock overflow without fabricating a later authoritative tick', () => {
    const boundary = derive({ originTick: Number.MAX_SAFE_INTEGER - 2, throughTick: Number.MAX_SAFE_INTEGER, ticksPerSecond: 3 });
    expect(quantizeEventTick(boundary.originTick, boundary.lastIncludedElapsedSeconds, 3)).toBe(Number.MAX_SAFE_INTEGER);
    expect(boundary.firstExcludedElapsedSeconds).toBe(nextFloat(boundary.lastIncludedElapsedSeconds, 1));
    expect(boundary.firstExcludedTick).toBeNull();
    expect(() => quantizeEventTick(boundary.originTick, boundary.firstExcludedElapsedSeconds, 3)).toThrow(/eventTick/);
  });

  it('uses the actual quantizer when relative root tolerance exceeds a fraction of a tick', () => {
    for (const throughTick of [1_000_000, 1_000_000_000, 1_000_000_000_000, 2 ** 48, 2 ** 50, 2 ** 52, Number.MAX_SAFE_INTEGER]) {
      for (const ticksPerSecond of [1, 3, 60, 1_000_000, Number.MAX_SAFE_INTEGER]) {
        const boundary = derive({ originTick: 0, throughTick, ticksPerSecond });
        expect(nextFloat(boundary.lastIncludedElapsedSeconds, 1)).toBe(boundary.firstExcludedElapsedSeconds);
        expect(quantizeEventTick(0, boundary.lastIncludedElapsedSeconds, ticksPerSecond)).toBeLessThanOrEqual(throughTick);
        if (boundary.firstExcludedTick === null) {
          expect(() => quantizeEventTick(0, boundary.firstExcludedElapsedSeconds, ticksPerSecond)).toThrow(/eventTick/);
        } else {
          expect(boundary.firstExcludedTick).toBeGreaterThan(throughTick);
          expect(quantizeEventTick(0, boundary.firstExcludedElapsedSeconds, ticksPerSecond)).toBe(boundary.firstExcludedTick);
        }
      }
    }
  });

  it('rejects unsafe clocks, incomplete input, result injection and active properties', () => {
    const input = { originTick: 0, throughTick: 1, ticksPerSecond: 3 };
    for (const candidate of [null, [], {}, { ...input, throughTick: -1 }, { ...input, throughTick: 0.5 },
      { ...input, originTick: 2 }, { ...input, originTick: Number.MAX_SAFE_INTEGER + 1 },
      { ...input, ticksPerSecond: 0 }, { ...input, ticksPerSecond: 1.5 }, { ...input, ticksPerSecond: Infinity },
      { ...input, ticksPerSecond: Number.MAX_SAFE_INTEGER + 1 }, { ...input, throughTick: NaN },
      { ...input, settledThroughTick: 1 }, { ...input, generatedThrough: 1 }, { ...input, playEnd: true }]) {
      expect(() => derive(candidate as QuantizerClosedGenerationBoundaryInput)).toThrow();
    }
    let read = false;
    const active = { ...input, get throughTick() { read = true; return 1; } };
    expect(() => derive(active)).toThrow();
    expect(read).toBe(false);
  });
});
