import { expect, it } from 'vitest';
import * as api from './SpinMotorQualificationV123';
const contact = (profileId: string, spinX: number) => ({ profileRef: { profileId, version: 'test-v1' },
  velocityMps: { x: 0, y: 0, z: 40 }, spinRadPerSecond: { x: spinX, y: 0, z: 0 }, bats: 'R' as const });
const input = () => ({ technique: 'BACKSPIN' as const, minimumIntentionalContacts: 3,
  minimumDirectionalSpinRadPerSecond: 100, minimumSuccessFraction: 0.5,
  contacts: [contact('qualified', -200), contact('qualified', -210), contact('qualified', -190),
    contact('wrong-direction', 200), contact('wrong-direction', 180), contact('wrong-direction', 210), contact('too-few', -200)] });

it('binds only individually reproduced motor profiles; pooled success never certifies a failing or underexposed profile', () => {
  const i = input(), before = structuredClone(i);
  expect(api.assessSpinMotorProfilesV123).toBeTypeOf('function');
  const result = api.assessSpinMotorProfilesV123(i);
  expect(result).toMatchObject({ qualifiedProfiles: [{ profileId: 'qualified', version: 'test-v1' }],
    totalContacts: 7, successfulContacts: 4,
    rejectedProfiles: [{ profileRef: { profileId: 'too-few' }, reason: 'INSUFFICIENT_CONTACTS' },
      { profileRef: { profileId: 'wrong-direction' }, reason: 'DIRECTIONAL_CONTROL_NOT_REPRODUCED' }] });
  expect(api.assessSpinMotorProfilesV123({ ...i, contacts: [...i.contacts].reverse() })).toEqual(result);
  expect(i).toEqual(before);
});

it('keeps vertical unclassified observations and invalid vectors from proving a motor skill', () => {
  const i = input();
  expect(api.assessSpinMotorProfilesV123({ ...i, contacts: Array.from({ length: 3 }, () => ({ ...contact('vertical', -200),
    velocityMps: { x: 0, y: 40, z: 0 } })) }).qualifiedProfiles).toEqual([]);
  expect(() => api.assessSpinMotorProfilesV123({ ...i, minimumSuccessFraction: 0 })).toThrow();
  expect(() => api.assessSpinMotorProfilesV123({ ...i, contacts: [{ ...contact('bad', -200),
    spinRadPerSecond: { x: NaN, y: 0, z: 0 } }] })).toThrow();
});
