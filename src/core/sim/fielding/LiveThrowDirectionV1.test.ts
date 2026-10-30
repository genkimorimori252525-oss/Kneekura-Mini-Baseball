import { expect, it } from 'vitest';
import { applyLiveThrowDirectionV1 } from './LiveThrowDirectionV1';
const fixture = () => ({ velocity: { x: 8, y: 3, z: 25 }, bodyVelocity: { x: 2, y: 0, z: -1 }, spin: { x: 100, y: 3, z: -40 },
  standardDeviationRadians: .03, seed: 1234, releaseOrdinal: 0 });
it('keeps zero-error initial velocity and spin exactly unchanged, independently of seed', () => {
  const raw = fixture();
  expect(applyLiveThrowDirectionV1({ ...raw, standardDeviationRadians: 0 }).velocity).toEqual(raw.velocity);
  expect(applyLiveThrowDirectionV1({ ...raw, standardDeviationRadians: 0, seed: 999 }).velocity).toEqual(raw.velocity);
  expect(applyLiveThrowDirectionV1({ ...raw, standardDeviationRadians: 0 }).spin).toEqual(raw.spin);
});
it('changes actual direction deterministically while retaining relative speed and explicit spin', () => {
  const raw = fixture(), a = applyLiveThrowDirectionV1(raw), b = applyLiveThrowDirectionV1(raw);
  expect(a).toEqual(b); expect(a.velocity).not.toEqual(raw.velocity); expect(a.spin).toEqual(raw.spin);
  const speed = (p: typeof raw.velocity) => Math.hypot(p.x - raw.bodyVelocity.x, p.y - raw.bodyVelocity.y, p.z - raw.bodyVelocity.z);
  expect(speed(a.velocity)).toBeCloseTo(speed(raw.velocity), 12);
  expect(Math.abs(a.yawRadians)).toBeLessThanOrEqual(Math.sqrt(3) * raw.standardDeviationRadians);
  expect(Math.abs(a.pitchRadians)).toBeLessThanOrEqual(Math.sqrt(3) * raw.standardDeviationRadians);
  expect(applyLiveThrowDirectionV1({ ...raw, seed: 1235 }).velocity).not.toEqual(a.velocity);
  expect(applyLiveThrowDirectionV1({ ...raw, releaseOrdinal: 1 }).velocity).not.toEqual(a.velocity);
});
it('retains a vertical relative velocity magnitude without a singular heading', () => {
  const raw = fixture(), a = applyLiveThrowDirectionV1({ ...raw, bodyVelocity: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 20, z: 0 } });
  expect(Math.hypot(a.velocity.x, a.velocity.y, a.velocity.z)).toBeCloseTo(20, 12);
});
it('is invariant under player renaming because no identity participates in the error stream', () => {
  const raw = fixture();
  expect(Object.keys(raw)).not.toContain('playerId');
  // Actor labels live outside this physical command. The same release ordinal
  // and seed therefore have exactly the same command regardless of labels.
  const run = (_name: string) => applyLiveThrowDirectionV1(raw);
  expect(run('player-A')).toEqual(run('other-name'));
});
it('rejects nonfinite or excessive authored angles and invalid random stream identities', () => {
  const raw = fixture();
  for (const standardDeviationRadians of [-1, .121, Infinity, NaN]) expect(() => applyLiveThrowDirectionV1({ ...raw, standardDeviationRadians })).toThrow();
  for (const seed of [-1, .5, 2 ** 32]) expect(() => applyLiveThrowDirectionV1({ ...raw, seed })).toThrow();
  expect(() => applyLiveThrowDirectionV1({ ...raw, releaseOrdinal: -.1 })).toThrow();
});
