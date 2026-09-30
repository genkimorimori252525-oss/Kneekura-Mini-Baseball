import { expect, it } from 'vitest';
import { evaluateNationalEligibility, snapshotNationalEligibilityPolicy } from './NationalEligibility';

const policy = { version: 'eligibility-test-v1', acceptedBases: ['CITIZENSHIP', 'BIRTH'] as const,
  allowNationSwitch: true, seniorOfficialAppearanceLocksNation: true };
const fact = { evidenceId: 'citizenship-1', playerId: 'player-1', personId: 'person-1',
  nationId: 'JP', basis: 'CITIZENSHIP' as const, effectiveFromDay: 10 };
const input = { playerId: 'player-1', personId: 'person-1', editionId: 'wbc-2032', nationId: 'JP',
  asOfDay: 20, policy, facts: [fact], representation: [] };

it('uses dated World eligibility facts and never club or rating affiliation', () => {
  expect(evaluateNationalEligibility(input)).toMatchObject({ eligible: true, evidenceIds: ['citizenship-1'] });
  expect(evaluateNationalEligibility({ ...input, asOfDay: 9 })).toMatchObject({ eligible: false, reason: 'NO_ELIGIBILITY_BASIS' });
  expect(evaluateNationalEligibility({ ...input, facts: [{ ...fact, basis: 'RESIDENCE' }] }))
    .toMatchObject({ eligible: false, reason: 'NO_ELIGIBILITY_BASIS' });
  expect(() => evaluateNationalEligibility({ ...input, facts: [{ ...fact, personId: 'another-person' }] })).toThrow('identity');
});

it('keeps one representative per edition and applies explicitly versioned switching and senior locks', () => {
  const registered = { editionId: input.editionId, nationId: 'US', registeredAtDay: 15,
    seniorOfficialAppearanceDay: null, evidenceId: 'registration-1' };
  expect(evaluateNationalEligibility({ ...input, representation: [registered] }))
    .toMatchObject({ eligible: false, reason: 'EDITION_ALREADY_REPRESENTED' });
  const previous = { ...registered, editionId: 'regional-2031' };
  expect(evaluateNationalEligibility({ ...input, representation: [previous] }).eligible).toBe(true);
  expect(evaluateNationalEligibility({ ...input, policy: { ...policy, allowNationSwitch: false }, representation: [previous] }))
    .toMatchObject({ eligible: false, reason: 'NATION_SWITCH_FORBIDDEN' });
  expect(evaluateNationalEligibility({ ...input, representation: [{ ...previous, seniorOfficialAppearanceDay: 16 }] }))
    .toMatchObject({ eligible: false, reason: 'SENIOR_NATION_LOCKED' });
});

it('excludes future registrations and future appearances from earlier eligibility decisions', () => {
  const future = { editionId: input.editionId, nationId: 'US', registeredAtDay: 25,
    seniorOfficialAppearanceDay: 26, evidenceId: 'future-registration' };
  expect(evaluateNationalEligibility({ ...input, representation: [future] }).eligible).toBe(true);
  const pendingAppearance = { ...future, editionId: 'regional-2031', registeredAtDay: 15 };
  expect(evaluateNationalEligibility({ ...input, representation: [pendingAppearance] }).eligible).toBe(true);
  expect(evaluateNationalEligibility({ ...input, asOfDay: 26, representation: [pendingAppearance] }).reason)
    .toBe('SENIOR_NATION_LOCKED');
});

it('rejects ambiguous policy, duplicate evidence and inconsistent representation before evaluation', () => {
  expect(() => snapshotNationalEligibilityPolicy({ ...policy, acceptedBases: ['CITIZENSHIP', 'CITIZENSHIP'] })).toThrow('policy');
  expect(() => evaluateNationalEligibility({ ...input, facts: [fact, fact] })).toThrow('evidence');
  expect(() => evaluateNationalEligibility({ ...input, representation: [{ editionId: 'prior', nationId: 'US',
    registeredAtDay: 18, seniorOfficialAppearanceDay: 17, evidenceId: 'invalid-history' }] })).toThrow('representation');
});
