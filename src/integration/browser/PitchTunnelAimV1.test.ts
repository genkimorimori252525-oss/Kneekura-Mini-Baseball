import { expect, it } from 'vitest';
import { LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { pitchSpinFromControlsV77 } from './LivePitchAuthoringV77';
import { solvePitchTunnelAimV1 } from './PitchTunnelAimV1';
import { sampleAerodynamicPitchStateAtElapsedSeconds } from '../../core/sim/pitching/AerodynamicPitchTrajectory';

const air = LIVE_MATCH_PHYSICS_V1.air, MPH = .44704, release = { x: -.55, y: 1.8, z: 16.54 }, target = { x: 0, y: .75, z: .4318 };
const fastball = { speedMps: 94 * MPH, spinRadPerSecond: pitchSpinFromControlsV77({ spinRpm: 2300, breakDirectionDegrees: -35, gyroFraction: .1 }) };
const slider = { speedMps: 85 * MPH, spinRadPerSecond: pitchSpinFromControlsV77({ spinRpm: 2450, breakDirectionDegrees: 120, gyroFraction: .9 }) };
const solve = (share: number) => solvePitchTunnelAimV1({ release, target, air, originTick: 0, pitch: slider, fastball, share });
const crossAt = (velocity: { x: number; y: number; z: number }, z: number) => {
  const initial = { tick: 0, position: release, velocity, spin: slider.spinRadPerSecond };
  let t = (release.z - z) / slider.speedMps, at = sampleAerodynamicPitchStateAtElapsedSeconds(initial, t, air);
  for (let i = 0; i < 6; i++) { t += (z - at.position.z) / at.velocity.z; at = sampleAerodynamicPitchStateAtElapsedSeconds(initial, t, air); }
  return at.position;
};

it('keeps the pitch on its own target at share 0', () => {
  const plate = crossAt(solve(0).velocity, target.z);
  expect(Math.hypot(plate.x - target.x, plate.y - target.y)).toBeLessThan(.005);
});

it('sends a full tunnel through the fastball point 7.25 m short of the plate, and the slider then leaves the zone low and glove side', () => {
  const full = solve(1), atTunnel = crossAt(full.velocity, full.tunnelZ);
  expect(full.tunnelZ).toBeCloseTo(target.z + 7.25, 12);
  expect(Math.hypot(atTunnel.x - full.fastballTunnelPoint.x, atTunnel.y - full.fastballTunnelPoint.y)).toBeLessThan(.005);
  expect(full.plate.x).toBeGreaterThan(target.x + .15); expect(full.plate.y).toBeLessThan(target.y - .2);
});

it('moves the tunnel point linearly with the share, with the release speed unchanged', () => {
  const none = solve(0), half = solve(.5), full = solve(1);
  expect(half.tunnelPoint.x).toBeCloseTo((none.tunnelPoint.x + full.tunnelPoint.x) / 2, 9);
  expect(half.tunnelPoint.y).toBeCloseTo((none.tunnelPoint.y + full.tunnelPoint.y) / 2, 9);
  for (const s of [none, half, full]) expect(Math.hypot(s.velocity.x, s.velocity.y, s.velocity.z)).toBeCloseTo(slider.speedMps, 9);
});

it('rejects a share outside [0, 1]', () => {
  expect(() => solve(1.2)).toThrow(/share/);
});
