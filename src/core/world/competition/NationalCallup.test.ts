import { expect, it } from 'vitest';
import { evaluateNationalCallup, snapshotNationalCallupPolicy } from './NationalCallup';
import type { NationalEligibilityDecision } from './NationalEligibility';

const eligibility: NationalEligibilityDecision = { eligible: true, reason: null, policyVersion: 'eligibility-v1', evidenceIds: ['citizenship'] };
const policy = { version: 'callup-test-v1', rosterLimit: 30, initialRegistrationCutoffDay: 400, replacementCutoffDay: 420,
  allowedDeclineReasons: ['INJURY', 'PERSONAL', 'NATIONAL_RETIREMENT', 'MOTIVATION_OR_RELATIONSHIP', 'ELIGIBILITY_DISPUTE'] as const };
const input = { eligibility, policy, availability: 'AVAILABLE' as const,
  response: { decision: 'ACCEPT' as const, reason: null, evidenceId: 'player-response-1' },
  activePlayerCount: 29, alreadyRegistered: false, isReplacement: false, asOfDay: 400 };

it('creates an official release obligation only for an eligible and available consenting player', () => {
  expect(evaluateNationalCallup(input)).toMatchObject({ accepted: true, registrationStatus: 'ACTIVE', clubMustRelease: true });
  expect(evaluateNationalCallup({ ...input, eligibility: { ...eligibility, eligible: false, reason: 'NO_ELIGIBILITY_BASIS' } }))
    .toMatchObject({ accepted: false, reason: 'NATIONAL_INELIGIBLE', clubMustRelease: false });
  expect(evaluateNationalCallup({ ...input, availability: 'INJURED' }))
    .toMatchObject({ accepted: false, reason: 'MEDICALLY_UNAVAILABLE', clubMustRelease: false });
});

it('honors allowed player refusals without permitting a club veto', () => {
  expect(evaluateNationalCallup({ ...input, response: { decision: 'DECLINE', reason: 'PERSONAL', evidenceId: 'decline-1' } }))
    .toMatchObject({ accepted: true, registrationStatus: 'DECLINED', clubMustRelease: false });
  expect(() => evaluateNationalCallup({ ...input, response: { decision: 'DECLINE', reason: 'CLUB_VETO', evidenceId: 'club-veto' } } as never))
    .toThrow('response');
  expect(evaluateNationalCallup({ ...input, policy: { ...policy, allowedDeclineReasons: ['INJURY'] },
    response: { decision: 'DECLINE', reason: 'PERSONAL', evidenceId: 'decline-2' } }))
    .toMatchObject({ accepted: false, reason: 'DECLINE_NOT_PERMITTED' });
});

it('enforces the supplied capacity and replacement cutoff without changing either', () => {
  expect(evaluateNationalCallup({ ...input, activePlayerCount: 30 })).toMatchObject({ accepted: false, reason: 'ROSTER_LIMIT' });
  expect(evaluateNationalCallup({ ...input, activePlayerCount: 30, alreadyRegistered: true }).accepted).toBe(true);
  expect(evaluateNationalCallup({ ...input, isReplacement: true, asOfDay: 421 }))
    .toMatchObject({ accepted: false, reason: 'REPLACEMENT_CUTOFF' });
  expect(evaluateNationalCallup({ ...input, asOfDay: 401 }))
    .toMatchObject({ accepted: false, reason: 'INITIAL_ROSTER_CUTOFF' });
  expect(() => snapshotNationalCallupPolicy({ ...policy, rosterLimit: 0 })).toThrow('policy');
  expect(() => evaluateNationalCallup({ ...input, response: { ...input.response, reason: 'PERSONAL' } })).toThrow('response');
});
