import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { simulatePitcherWorkbenchV77 } from './PitcherWorkbenchV77';
import { simulateLivePitchV1, type LiveMeasuredClipV1, type LivePitchInputV1 } from './LivePitchV1';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_MOUND_SURFACE_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { LIVE_PITCH_TYPES_V77, pitchSpinFromControlsV77 } from './LivePitchAuthoringV77';
const clips = JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json', import.meta.url), 'utf8')).clips as LiveMeasuredClipV1[];
const input = (): LivePitchInputV1 => ({ originTick: 1_000_000, seed: 3,
  batter: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, heightMeters: 1.8, bats: 'R' },
  pitcher: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, commandStdMeters: 0, heightMeters: 1.9, moundPosition: LIVE_MATCH_MOUND_SURFACE_V1 },
  measuredClips: clips, batting: 'take', pitchType: 'fastball', location: 'zone', physics: LIVE_MATCH_PHYSICS_V1 });

it('observes the same live pitch and compares a zero-spin ball with the identical initial velocity', () => {
  const i = input(), snapshot = JSON.stringify(i), result = simulatePitcherWorkbenchV77({ pitch: i }), live = simulateLivePitchV1(i);
  expect(result.pitch.diagnostics.sourceDescriptor).toEqual(live.diagnostics.sourceDescriptor);
  expect(result.fixedInitial).toEqual(live.diagnostics.sourceDescriptor.initial.ball);
  expect(result.metrics.platePosition.z).toBeCloseTo(.15, 8);
  expect(result.baselineInitial.position).toEqual(result.fixedInitial.position);
  expect(result.baselineInitial.velocity).toEqual(result.fixedInitial.velocity);
  expect(result.baselineInitial.spin).toEqual({ x: 0, y: 0, z: 0 });
  expect(result.metrics.verticalBreakCm).toBeLessThan(0);
  expect(result.sampleAtPitchElapsedSeconds(0)!.position).toEqual(result.fixedInitial.position);
  expect(JSON.stringify(i)).toBe(snapshot);
});

it('applies authored pitch speed and spin to the actual Source and leaves unselected pitches exact', () => {
  const i = input(), row = { pitchType: 'curve' as const, releaseSpeedMps: 30, spinRadPerSecond: { x: -280, y: 50, z: -30 } },
    changed = { ...i, pitcher: { ...i.pitcher, pitchRepertoire: [row] } };
  expect(JSON.stringify(simulateLivePitchV1(changed))).toBe(JSON.stringify(simulateLivePitchV1(i)));
  const curve = simulateLivePitchV1({ ...changed, pitchType: 'curve' });
  expect(curve.diagnostics.sourceDescriptor.initial.ball.spin).toEqual(row.spinRadPerSecond);
  expect(curve.speedKmh).toBeLessThanOrEqual(30 * 3.6); expect(curve.speedKmh).toBeGreaterThan(29.4 * 3.6);
  expect(() => simulateLivePitchV1({ ...i, pitcher: { ...i.pitcher, maximumPitchSpeedMps: 29, pitchRepertoire: [row] } })).toThrow();
});

it('zero physical spin produces exactly zero aerodynamic-break measurement', () => {
  const i = input(), result = simulatePitcherWorkbenchV77({ pitch: { ...i, pitcher: { ...i.pitcher, spinRadPerSecond: { x: 0, y: 0, z: 0 } } } });
  expect(result.metrics.horizontalBreakCm).toBe(0); expect(result.metrics.verticalBreakCm).toBe(0);
});

it('executes seven authored pitches on both throwing sides with observed spin and break directions', () => {
  for (const throws of ['R', 'L'] as const) for (const [index, pitchType] of LIVE_PITCH_TYPES_V77.entries()) {
    const i = input(), spin = pitchSpinFromControlsV77({ spinRpm: 1800 + index * 100, breakDirectionDegrees: index % 2 ? 90 : 0, gyroFraction: .1 }),
      row = { pitchType, releaseSpeedMps: 34 + index, spinRadPerSecond: spin },
      result = simulatePitcherWorkbenchV77({ pitch: { ...i, pitchType, pitcher: { ...i.pitcher, throws, maximumPitchSpeedMps: 45, pitchRepertoire: [row] } } });
    expect(result.fixedInitial.spin).toEqual(spin);
    expect(Math.sign(result.fixedInitial.position.x)).toBe(throws === 'R' ? -1 : 1);
    expect(result.metrics.spinRpm).toBeCloseTo(1800 + index * 100, 10);
    if (index % 2) expect(result.metrics.horizontalBreakCm).toBeGreaterThan(0); else expect(result.metrics.verticalBreakCm).toBeGreaterThan(0);
    expect(result.input.pitcher.pitchRepertoire).toEqual([row]);
  }
});
