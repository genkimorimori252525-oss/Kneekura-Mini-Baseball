import { expect, it } from 'vitest';
import { pitchSpinFromControlsV77, pitchSpinToControlsV77, validatePitchingMotionV77, validatePitchRepertoireV77 } from './LivePitchAuthoringV77';

it('validates an inert seven-pitch repertoire, retaining explicit world spin and individual speed', () => {
  const rows = ['fastball', 'slider', 'curve', 'changeup', 'cutter', 'sinker', 'splitter'].map(pitchType => ({
    pitchType, releaseSpeedMps: 37, spinRadPerSecond: { x: -200, y: 20, z: 40 } }));
  const snapshot = JSON.stringify(rows), accepted = validatePitchRepertoireV77(rows, 40);
  expect(accepted).toEqual(rows); expect(JSON.stringify(rows)).toBe(snapshot); expect(Object.isFrozen(accepted)).toBe(true);
  expect(() => validatePitchRepertoireV77(rows, 36)).toThrow();
  for (const value of [[], [...rows, rows[0]], [{ ...rows[0], pitchType: 'unknown' }], [{ ...rows[0], releaseSpeedMps: NaN }],
    [{ ...rows[0], releaseSpeedMps: 86 }], [{ ...rows[0], spinRadPerSecond: { x: 1201, y: 0, z: 0 } }], [{ ...rows[0], extra: 1 }]])
    expect(() => validatePitchRepertoireV77(value)).toThrow();
  let reads = 0; const row = { ...rows[0] };
  Object.defineProperty(row, 'releaseSpeedMps', { enumerable: true, get() { reads++; return 40; } });
  expect(() => validatePitchRepertoireV77([row])).toThrow(); expect(reads).toBe(0);
});

it('round-trips physical spin without silently changing world handedness or gyro direction', () => {
  for (const spin of [{ x: -230, y: 15, z: 10 }, { x: 200, y: -40, z: -90 }, { x: 0, y: 0, z: 240 }, { x: 0, y: 0, z: 0 }]) {
    const roundtrip = pitchSpinFromControlsV77(pitchSpinToControlsV77(spin));
    for (const axis of ['x', 'y', 'z'] as const) expect(roundtrip[axis]).toBeCloseTo(spin[axis], 10);
  }
  const up = pitchSpinFromControlsV77({ spinRpm: 2400, breakDirectionDegrees: 0, gyroFraction: 0 }),
    right = pitchSpinFromControlsV77({ spinRpm: 2400, breakDirectionDegrees: 90, gyroFraction: 0 });
  expect(up.x).toBeGreaterThan(0); expect(right.y).toBeLessThan(0);
  expect(() => pitchSpinFromControlsV77({ spinRpm: 3000, breakDirectionDegrees: 0, gyroFraction: 1.01 })).toThrow();
});

it('stores an explicitly authored delivery clock and head amount without claiming measured motion', () => {
  expect(validatePitchingMotionV77({ preparationMs: 1540, headMotionScale: 1 })).toEqual({ preparationMs: 1540, headMotionScale: 1 });
  for (const value of [{ preparationMs: 499, headMotionScale: 1 }, { preparationMs: 4001, headMotionScale: 1 },
    { preparationMs: 1540, headMotionScale: 2.01 }, { preparationMs: Infinity, headMotionScale: 1 },
    { preparationMs: 1540, headMotionScale: 1, measured: true }]) expect(() => validatePitchingMotionV77(value)).toThrow();
});
