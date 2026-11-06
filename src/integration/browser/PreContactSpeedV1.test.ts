import { expect, it } from 'vitest';
import { preContactSweetSpotSpeedV1 } from './PreContactSpeedV1';
import { AUTHORED_LIVE_BATTER_OBSERVATION_V151, validateLiveBatterObservationPolicyV151 } from './LiveBatterObservationV151';

const contact = 32;   // m/s at the clip's contact moment

it('a bat met before its contact pose is slower the earlier in the swing it is met', () => {
  expect(preContactSweetSpotSpeedV1(contact, 0, .005)).toBe(contact);
  const speeds = [0, .002, .005, .010, .020].map(s => preContactSweetSpotSpeedV1(contact, s, .005));
  for (let i = 1; i < speeds.length; i++) expect(speeds[i]!).toBeLessThan(speeds[i - 1]!);
  // 10 ms deep: 5% slower, within MLB's bat speed by depth (72.2 -> 69.1 mph from 0..6 in to -12..-6 in, 4%; 66.6 below -12 in, 8%).
  expect(preContactSweetSpotSpeedV1(contact, .010, .005) / contact).toBeCloseTo(.95, 10);
  // Never faster than the contact moment, never below half of it.
  expect(preContactSweetSpotSpeedV1(contact, 1, .005)).toBe(contact * .5);
  expect(preContactSweetSpotSpeedV1(contact, .010, 0)).toBe(contact);
});

it('rejects non-physical inputs', () => {
  for (const [v, s, k] of [[-1, 0, .005], [contact, -.001, .005], [contact, 0, -.001], [contact, 0, .06], [NaN, 0, .005]] as const)
    expect(() => preContactSweetSpotSpeedV1(v, s, k)).toThrow('invalid pre-contact speed input');
});

it('the policy key is optional, bounded and off by default', () => {
  const base = { ...AUTHORED_LIVE_BATTER_OBSERVATION_V151, memoryPolicy: { ...AUTHORED_LIVE_BATTER_OBSERVATION_V151.memoryPolicy } };
  expect(Object.hasOwn(AUTHORED_LIVE_BATTER_OBSERVATION_V151, 'preContactSpeedLossV1')).toBe(false);
  expect(validateLiveBatterObservationPolicyV151({ ...base, preContactSpeedLossV1: .005 }).preContactSpeedLossV1).toBe(.005);
  for (const bad of [-.001, .051]) expect(() => validateLiveBatterObservationPolicyV151({ ...base, preContactSpeedLossV1: bad })).toThrow('invalid pre-contact speed loss');
  expect(() => validateLiveBatterObservationPolicyV151({ ...base, preContactSpeedLossV1: Number.NaN })).toThrow();   // caught by the generic finiteness check first
});
