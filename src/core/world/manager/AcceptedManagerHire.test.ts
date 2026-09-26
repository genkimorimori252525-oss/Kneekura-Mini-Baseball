import { expect, it } from 'vitest';
import { applyClubCommand } from '../club/ClubLifecycle';
import { command, state } from '../club/ClubFixtures.test-support';
import type { ClubWorldState } from '../club/ClubTypes';
import { appendClubWageSchedule,
  createClubWageScheduleLedger,
  getClubSeasonStaffWageAllocations,
  getClubSeasonWageAllocations } from '../club/ClubWageScheduleLedger';
import { applyAcceptedManagerHire } from './AcceptedManagerHire';
import { appendManagerCandidateObservation,
  createManagerCandidateEvidenceLedger,
  getManagerCandidateEstimate } from './ManagerCandidateEvidence';
import { applyShortlistedManagerHire } from './ShortlistedManagerHire';
import { executeManagerHireTransaction } from './ManagerHireTransaction';

const vacancy = (): ClubWorldState => {
  const initial = state();
  const vacant = applyClubCommand(initial,
    command([{ kind: 'UPDATE_REFERENCES', references: {
      ...initial.live.references, staffRoleLinks: [],
    } }], initial, 'vacancy-1'));
  if (!vacant.ok) throw new Error('failed to create manager vacancy');
  return vacant.state;
};
const rating = { mean: 0.5, uncertainty: 0.4, evidence: 1 };
const evidence = appendManagerCandidateObservation(
  createManagerCandidateEvidenceLedger('career-a', 'club-a'), 0, {
    eventId: 'interview-1', careerId: 'career-a', clubId: 'club-a',
    managerId: 'manager-b', kind: 'INTERVIEW', observedAtDay: 11,
    projectedSkills: {
      tacticalJudgment: rating, analysis: rating, adaptation: rating,
      playerEvaluation: rating, operations: rating, leadership: rating,
    },
    fit: { philosophyFit: rating, rosterFit: rating,
      staffFit: rating, clubCultureFit: rating,
      publicAcceptance: rating },
  });
const estimate = getManagerCandidateEstimate(evidence,
  'manager-b', 11)!;
const offer = { offerId: 'offer-1', estimateId: estimate.estimateId,
  careerId: 'career-a', clubId: 'club-a', managerId: 'manager-b',
  roleId: 'manager-role', appointmentId: 'appointment-b',
  contractId: 'manager-contract-b', offeredAtDay: 11,
  currency: 'SIM', annualSalaryMinorUnits: 20,
  termSeasons: 3 };
const acceptance = { acceptanceId: 'acceptance-1',
  sourceEventId: 'manager-acceptance-1', offerId: 'offer-1',
  managerId: 'manager-b', acceptedAtDay: 12,
  accepted: true as const };
const hire = (before: ClubWorldState) => {
  const references = { ...before.live.references,
    staffRoleLinks: [{ roleId: offer.roleId,
      roleKind: 'MANAGER' as const, personId: offer.managerId,
      appointmentId: offer.appointmentId }] };
  const changed = applyClubCommand(before, {
    ...command([{ kind: 'RECORD_COMMITMENT',
      commitmentId: 'manager-wage-1',
      contractRef: offer.contractId, category: 'staffWages',
      budgetBucket: 'coaching', amount: 60,
      currency: offer.currency },
    { kind: 'UPDATE_REFERENCES', references }], before, 'hire-1'),
    causeEventIds: [estimate.estimateId, offer.offerId,
      acceptance.sourceEventId, 'hire-brief-1', 'interest-1'],
  });
  if (!changed.ok) throw new Error('failed to create manager hire');
  return changed;
};
const schedules = (after: ReturnType<typeof hire>) => {
  const beforeSchedules = createClubWageScheduleLedger('career-a',
    'club-a');
  const afterSchedules = appendClubWageSchedule(beforeSchedules, 0,
    after.state, after.event, {
      commitmentId: 'manager-wage-1',
      contractRef: offer.contractId,
      annualAmounts: [1, 2, 3].map((season) => ({
        season, amount: offer.annualSalaryMinorUnits,
      })),
    });
  return { beforeSchedules, afterSchedules };
};

it('requires bilateral acceptance before a vacancy receives a manager and wage liability', () => {
  const before = vacancy();
  const after = hire(before);
  const { beforeSchedules, afterSchedules } = schedules(after);
  const result = applyAcceptedManagerHire(before, after.state,
    after.event, estimate, offer, acceptance,
    beforeSchedules, afterSchedules, evidence);
  expect(result.state).toBe(after.state);
  expect(result.event).toMatchObject({
    type: 'MANAGER_HIRED', managerId: 'manager-b',
    acceptanceId: 'acceptance-1', estimateId: estimate.estimateId,
    contractId: 'manager-contract-b',
    commitmentId: 'manager-wage-1',
    afterRevision: after.state.revision,
  });
  expect(result.state.live.finance.commitments.at(-1))
    .toMatchObject({ category: 'staffWages',
      budgetBucket: 'coaching', amount: 60 });
  expect(result.state).not.toHaveProperty('managerTrueSkill');
  expect(getClubSeasonStaffWageAllocations(afterSchedules,
    after.state)).toMatchObject([{ annualMinorUnits: 20 }]);
  expect(getClubSeasonWageAllocations(afterSchedules,
    after.state)).toEqual([]);
});

it('rejects missing candidate consent, mismatched terms and forged club history', () => {
  const before = vacancy();
  const after = hire(before);
  const { beforeSchedules, afterSchedules } = schedules(after);
  expect(() => applyAcceptedManagerHire(before, after.state,
    after.event, estimate, offer,
    { ...acceptance, accepted: false as true },
    beforeSchedules, afterSchedules, evidence)).toThrow('acceptance');
  expect(() => applyAcceptedManagerHire(before, after.state,
    after.event, estimate, { ...offer,
      annualSalaryMinorUnits: 25 }, acceptance,
    beforeSchedules, afterSchedules, evidence)).toThrow('liability');
  expect(() => applyAcceptedManagerHire(before, after.state,
    { ...after.event, afterRevision: 999 }, estimate,
    offer, acceptance, beforeSchedules,
    afterSchedules, evidence)).toThrow('club event');
  const forgedEstimate = { ...estimate, trueSkill: 100 };
  expect(() => applyAcceptedManagerHire(before, after.state,
    after.event, forgedEstimate,
    offer, acceptance, beforeSchedules,
    afterSchedules, evidence)).toThrow('estimate');
  const wrongAnnual = { ...afterSchedules,
    schedules: [{ ...afterSchedules.schedules[0]!,
      annualAmounts: [{ season: 1, amount: 25 },
        { season: 2, amount: 15 },
        { season: 3, amount: 20 }] }] };
  expect(() => applyAcceptedManagerHire(before, after.state,
    after.event, estimate, offer, acceptance,
    beforeSchedules, wrongAnnual, evidence)).toThrow('schedule');
});

it('rejects an occupied job and estimates unavailable when the offer was made', () => {
  const before = vacancy();
  const after = hire(before);
  const { beforeSchedules, afterSchedules } = schedules(after);
  expect(() => applyAcceptedManagerHire(state(), after.state,
    after.event, estimate, offer, acceptance,
    beforeSchedules, afterSchedules, evidence)).toThrow('vacancy');
  expect(() => applyAcceptedManagerHire(before, after.state,
    after.event, { ...estimate, availableAtDay: 12 },
    offer, acceptance, beforeSchedules,
    afterSchedules, evidence)).toThrow('estimate');
  expect(() => applyAcceptedManagerHire(before, after.state,
    after.event, { ...estimate,
      projectedSkills: { ...estimate.projectedSkills,
        analysis: { ...rating, mean: 1 } } },
    offer, acceptance, beforeSchedules,
    afterSchedules, evidence)).toThrow('estimate');
});

it('links the accepted hire to a dated bilateral market shortlist', () => {
  const before = vacancy();
  const after = hire(before);
  const { beforeSchedules, afterSchedules } = schedules(after);
  const brief = { briefId: 'hire-brief-1', careerId: 'career-a',
    clubId: 'club-a', effectiveDay: 11,
    priorityAxes: ['analysis' as const],
    minimumLowerBounds: { analysis: 0.05 },
    maximumAnnualSalaryMinorUnits: 30 };
  const terms = { careerId: 'career-a', clubId: 'club-a',
    managerId: 'manager-b', interestSourceEventId: 'interest-1',
    interestObservedAtDay: 11, willingToNegotiate: true,
    desiredAnnualSalaryMinorUnits: 20, termSeasons: 3 };
  const result = applyShortlistedManagerHire(before, after.state,
    after.event, offer, acceptance, beforeSchedules,
    afterSchedules, evidence, brief, [terms]);
  expect(result.event).toMatchObject({ type: 'MANAGER_HIRED',
    managerId: 'manager-b' });
  expect(result.selection).toEqual({ briefId: 'hire-brief-1',
    estimateId: estimate.estimateId,
    interestSourceEventId: 'interest-1' });
  expect(() => applyShortlistedManagerHire(before, after.state,
    after.event, offer, acceptance, beforeSchedules,
    afterSchedules, evidence, brief,
    [{ ...terms, willingToNegotiate: false }]))
    .toThrow('shortlist');
  expect(() => applyShortlistedManagerHire(before, after.state,
    after.event, offer, acceptance, beforeSchedules,
    afterSchedules, evidence, { ...brief, effectiveDay: 12 },
    [terms])).toThrow('day');
  expect(() => applyShortlistedManagerHire(before, after.state,
    { ...after.event, command: { ...after.event.command,
      causeEventIds: [estimate.estimateId, offer.offerId,
        acceptance.sourceEventId, brief.briefId] } },
    offer, acceptance, beforeSchedules, afterSchedules,
    evidence, brief, [terms])).toThrow('provenance');
  expect(applyShortlistedManagerHire(before, after.state,
    after.event, offer, acceptance, beforeSchedules,
    afterSchedules, evidence, brief,
    [{ ...terms, desiredAnnualSalaryMinorUnits: 21 }])
    .event.type).toBe('MANAGER_HIRED');
});

it('constructs club, wage and manager records as one replayable hire transition', () => {
  const before = vacancy();
  const beforeSchedules = createClubWageScheduleLedger('career-a',
    'club-a');
  const brief = { briefId: 'hire-brief-1', careerId: 'career-a',
    clubId: 'club-a', effectiveDay: 11,
    priorityAxes: ['analysis' as const],
    minimumLowerBounds: { analysis: 0.05 },
    maximumAnnualSalaryMinorUnits: 30 };
  const terms = { careerId: 'career-a', clubId: 'club-a',
    managerId: 'manager-b', interestSourceEventId: 'interest-1',
    interestObservedAtDay: 11, willingToNegotiate: true,
    desiredAnnualSalaryMinorUnits: 20, termSeasons: 3 };
  const result = executeManagerHireTransaction(before,
    beforeSchedules, evidence, brief, [terms], offer,
    acceptance, { clubEventId: 'hire-atomic-1',
      commitmentId: 'manager-wage-atomic-1', effectiveDay: 12 });
  expect(result.club.live.references.staffRoleLinks)
    .toMatchObject([{ roleKind: 'MANAGER', personId: 'manager-b' }]);
  expect(result.schedules.schedules[0]?.annualAmounts)
    .toEqual([1, 2, 3].map((season) => ({ season, amount: 20 })));
  expect(result.hire.event).toMatchObject({ type: 'MANAGER_HIRED',
    commitmentId: 'manager-wage-atomic-1' });
  expect(result.clubEvent.command.causeEventIds)
    .toContain('interest-1');
  expect(before.live.references.staffRoleLinks).toEqual([]);
  expect(beforeSchedules.schedules).toEqual([]);
  expect(() => executeManagerHireTransaction(before,
    beforeSchedules, evidence, brief, [terms],
    { ...offer, annualSalaryMinorUnits: 100 }, acceptance,
    { clubEventId: 'hire-atomic-2',
      commitmentId: 'manager-wage-atomic-2', effectiveDay: 12 }))
    .toThrow();
  expect(beforeSchedules.schedules).toEqual([]);
});
