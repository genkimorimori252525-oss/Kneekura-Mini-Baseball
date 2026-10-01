import { expect, it } from 'vitest';
import { generatePitcherReleaseGeometry, type PitcherReleaseGenerationPolicy } from './PitcherReleaseGeneration';
import { projectReleaseHeightTier, resolvePitcherReleasePosition } from '../../sim/pitch/PitcherReleaseGeometry';

const ranges = { releaseHeightRatio: { min: 0.72, max: 0.96 },
  releaseLateralRatio: { min: 0.05, max: 0.2 }, releaseExtensionRatio: { min: 0.1, max: 0.4 },
  armSlotElevationDeg: { min: 55, max: 80 }, armSlotAzimuthDeg: { min: -10, max: 10 } };
export const releaseGenerationPolicy: PitcherReleaseGenerationPolicy = { policyId: 'fixture-release-prior', version: 'fixture-v1',
  availableAtDay: 10, maximumAttempts: 128, tierBoundaries: [0.65, 0.7, 0.75, 0.8, 0.85, 0.95],
  slots: [{ armSlotClass: 'OVERHAND', weight: 1, ranges }] };
const input = { careerId: 'career-a', playerId: 'player-a', createdAtDay: 11, careerSeed: 12345,
  body: { heightMeters: 1.8, shoulderHeightMeters: 1.5, armReachMeters: 0.8, postureDropMeters: 0.1, throwingSide: 'RIGHT' as const },
  policy: releaseGenerationPolicy };

it('generates distinct reproducible continuous geometry per accepted Player, with projected tiers and body validation', () => {
  const first = generatePitcherReleaseGeometry(input);
  expect(generatePitcherReleaseGeometry(input)).toEqual(first);
  const players = Array.from({ length: 200 }, (_, n) => generatePitcherReleaseGeometry({ ...input, playerId: `player-${n}` }));
  expect(new Set(players.map((player) => player.profile.releaseHeightRatio)).size).toBe(200);
  expect(new Set(players.map((player) => player.profile.releaseHeightTier)).size).toBeGreaterThan(1);
  for (const player of players) {
    expect(player.profile.armSlotClass).toBe('OVERHAND');
    expect(player.profile.releaseHeightTier).toBe(projectReleaseHeightTier(player.profile.releaseHeightRatio, input.policy.tierBoundaries));
    const point = resolvePitcherReleasePosition({ ...player.body, moundReference: { x: 0, y: 0, z: 18 } }, player.profile);
    expect(Number.isFinite(point.y)).toBe(true);
    expect(player.generation.version).toBe('pitcher-release-generation-v1');
  }
  expect(Object.isFrozen(first.profile)).toBe(true);
  expect(Object.isFrozen(first.body)).toBe(true);
  expect(first).not.toHaveProperty('ability');
  expect(first).not.toHaveProperty('batterPenalty');
});

it('permits overlapping slot priors and isolates classification from the continuous truth', () => {
  const overhand = generatePitcherReleaseGeometry(input);
  const otherClass = generatePitcherReleaseGeometry({ ...input, policy: { ...input.policy,
    slots: [{ ...input.policy.slots[0], armSlotClass: 'THREE_QUARTER' }] } });
  expect({ ...otherClass.profile, armSlotClass: 'OVERHAND' }).toEqual(overhand.profile);
  const two = { ...input.policy, slots: [...input.policy.slots, { ...input.policy.slots[0], armSlotClass: 'THREE_QUARTER' as const }] };
  const sampled = Array.from({ length: 100 }, (_, n) => generatePitcherReleaseGeometry({ ...input, playerId: `weighted-${n}`, policy: two }));
  expect(new Set(sampled.map((player) => player.profile.armSlotClass)).size).toBe(2);
  expect(sampled.every((player) => player.profile.releaseHeightRatio >= ranges.releaseHeightRatio.min && player.profile.releaseHeightRatio <= ranges.releaseHeightRatio.max)).toBe(true);
});

it('rejects impossible selected priors without clamping or falling back to a different class', () => {
  const impossible = { ...input.policy.slots[0], ranges: { ...ranges, releaseHeightRatio: { min: 5, max: 6 } } };
  expect(() => generatePitcherReleaseGeometry({ ...input, policy: { ...input.policy,
    maximumAttempts: 4, slots: [impossible, { ...input.policy.slots[0], armSlotClass: 'SIDEARM', weight: 0 }] } })).toThrow('plausible');
  const clipped = { ...input.policy.slots[0], ranges: { ...ranges, releaseExtensionRatio: { min: 0.9, max: 1.2 } } };
  const partial = Array.from({ length: 100 }, (_, n) => generatePitcherReleaseGeometry({ ...input, playerId: `bounded-${n}`,
    policy: { ...input.policy, maximumAttempts: 1024, slots: [clipped] } }));
  expect(partial.some((player) => player.generation.attempts > 1)).toBe(true);
  expect(partial.every((player) => player.profile.releaseExtensionRatio >= 0.9 && player.profile.releaseExtensionRatio < 1)).toBe(true);
});

it('rejects malformed, future and unsafe generation inputs before sampling', () => {
  expect(() => generatePitcherReleaseGeometry({ ...input, careerSeed: 0 })).toThrow('seed');
  expect(() => generatePitcherReleaseGeometry({ ...input, createdAtDay: 9 })).toThrow('policy');
  expect(() => generatePitcherReleaseGeometry({ ...input, body: { ...input.body, armReachMeters: 0 } })).toThrow();
  expect(() => generatePitcherReleaseGeometry({ ...input, policy: { ...input.policy, maximumAttempts: 0 } })).toThrow('policy');
  expect(() => generatePitcherReleaseGeometry({ ...input, policy: { ...input.policy, slots: [] } })).toThrow('policy');
  expect(() => generatePitcherReleaseGeometry({ ...input, policy: { ...input.policy, slots: [{ ...input.policy.slots[0], weight: NaN }] } })).toThrow();
  expect(() => generatePitcherReleaseGeometry({ ...input, policy: { ...input.policy, slots: [{ ...input.policy.slots[0],
    ranges: { ...ranges, releaseHeightRatio: { min: 1, max: 0 } } }] } })).toThrow('range');
  expect(() => generatePitcherReleaseGeometry({ ...input, policy: { ...input.policy, tierBoundaries: [1, 1, 1, 1, 1, 1] } })).toThrow('boundaries');
  let reads = 0;
  const getter = Object.defineProperty({ ...input.policy }, 'maximumAttempts', { get: () => { reads++; return 4; }, enumerable: true });
  expect(() => generatePitcherReleaseGeometry({ ...input, policy: getter })).toThrow();
  expect(reads).toBe(0);
});
