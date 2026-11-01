import { expect, it, vi } from 'vitest';
import { applyLiveThrowDirectionV1 } from './LiveThrowDirectionV1';
import { SeedRoot } from '../../rng/SeedRoot';
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

it('retains the exact pre-V95 random command when no execution override is supplied', () => {
  // Captured from the unchanged function in the V95 RED receipt 06cf2d538c4243d6b0f6ef7dd7e3c134.
  const result = applyLiveThrowDirectionV1(fixture());
  expect(result.velocity).toEqual({ x: 7.315376737175434, y: 2.6579154924957176, z: 25.1855352318154 });
  expect(result.distribution).toBe('INDEPENDENT_ZERO_MEAN_BOUNDED_UNIFORM_YAW_PITCH_V1');
});

it('executes a specified physical angular error independently of the authored accuracy and seed', () => {
  const raw = fixture(), yawRadians = .2, angularErrorOverride = { yawRadians, pitchRadians: 0 };
  const result = applyLiveThrowDirectionV1({ ...raw, standardDeviationRadians: 0, angularErrorOverride });
  const x = raw.velocity.x - raw.bodyVelocity.x, z = raw.velocity.z - raw.bodyVelocity.z;
  expect(result.velocity.x).toBeCloseTo(raw.bodyVelocity.x + Math.cos(yawRadians) * x + Math.sin(yawRadians) * z, 12);
  expect(result.velocity.y).toBe(raw.velocity.y);
  expect(result.velocity.z).toBeCloseTo(raw.bodyVelocity.z - Math.sin(yawRadians) * x + Math.cos(yawRadians) * z, 12);
  expect(result.distribution).toBe('EXPLICIT_EXECUTION_ANGULAR_ERROR_V95');
  expect(result.standardDeviationRadians).toBe(0);
  expect(result.yawRadians).toBe(yawRadians); expect(result.pitchRadians).toBe(0);
  expect(applyLiveThrowDirectionV1({ ...raw, seed: 4321, angularErrorOverride }).velocity).toEqual(result.velocity);
});

it('retains body motion and relative speed/spin for combined override angles and vertical velocity', () => {
  for (const velocity of [fixture().velocity, { x: 2, y: 20, z: -1 }]) {
    const raw = { ...fixture(), velocity, angularErrorOverride: { yawRadians: -.35, pitchRadians: .35 } },
      before = JSON.stringify(raw), result = applyLiveThrowDirectionV1(raw);
    const speed = (p: typeof velocity) => Math.hypot(p.x - raw.bodyVelocity.x, p.y - raw.bodyVelocity.y, p.z - raw.bodyVelocity.z);
    expect(speed(result.velocity)).toBeCloseTo(speed(velocity), 12);
    expect(result.spin).toEqual(raw.spin); expect(result.speedBasis).toBe('THROWER_BODY_RELATIVE');
    expect(JSON.stringify(raw)).toBe(before);
  }
});

it('keeps a zero override exact and does not consume the random stream for an override', () => {
  const raw = fixture(), before = applyLiveThrowDirectionV1({ ...raw, releaseOrdinal: 1 });
  const spy = vi.spyOn(SeedRoot.prototype, 'streamRng');
  try {
    const result = applyLiveThrowDirectionV1({ ...raw, angularErrorOverride: { yawRadians: 0, pitchRadians: 0 } });
    expect(result.velocity).toEqual(raw.velocity);
    applyLiveThrowDirectionV1({ ...raw, angularErrorOverride: { yawRadians: .1, pitchRadians: .1 } });
    expect(spy).not.toHaveBeenCalled();
  } finally { spy.mockRestore(); }
  expect(applyLiveThrowDirectionV1({ ...raw, releaseOrdinal: 1 })).toEqual(before);
});

it('rejects nonfinite, incomplete or out-of-bounds execution overrides without relaxing original validation', () => {
  const raw = fixture();
  for (const angularErrorOverride of [null, {}, { yawRadians: 0 }, { yawRadians: 0, pitchRadians: NaN },
    { yawRadians: Infinity, pitchRadians: 0 }, { yawRadians: -.350001, pitchRadians: 0 }, { yawRadians: 0, pitchRadians: .350001 }]) {
    expect(() => applyLiveThrowDirectionV1({ ...raw, angularErrorOverride } as Parameters<typeof applyLiveThrowDirectionV1>[0])).toThrow();
  }
  expect(() => applyLiveThrowDirectionV1({ ...raw, standardDeviationRadians: -1,
    angularErrorOverride: { yawRadians: 0, pitchRadians: 0 } })).toThrow(/SI/);
});
