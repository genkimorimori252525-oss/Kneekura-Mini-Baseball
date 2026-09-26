import { expect, it } from 'vitest';
import { applyClubCommand } from '../club/ClubLifecycle';
import { command, state } from '../club/ClubFixtures.test-support';
import type { ClubWorldState } from '../club/ClubTypes';
import { appendClubWageSchedule,
  createClubWageScheduleLedger,
  getClubSeasonStaffWageAllocations,
  getClubSeasonWageAllocations } from '../club/ClubWageScheduleLedger';
import { applyAcceptedManagerHire } from './AcceptedManagerHire';

const vacancy = (): ClubWorldState => {
  const initial = state();
  const vacant = applyClubCommand(initial,
    command([{ kind: 'UPDATE_REFERENCES', references: {
      ...initial.live.references, staffRoleLinks: [],
    } }], initial, 'vacancy-1'));
  if (!vacant.ok) throw new Error('failed to create manager vacancy');
  return vacant.state;
};
const estimate = { estimateId: 'estimate-1',
  clubId: 'club-a', managerId: 'manager-b',
  availableAtDay: 11,
  sourceEventIds: ['interview-1', 'reference-1'] };
const offer = { offerId: 'offer-1', estimateId: 'estimate-1',
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
      acceptance.sourceEventId],
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
    beforeSchedules, afterSchedules);
  expect(result.state).toBe(after.state);
  expect(result.event).toMatchObject({
    type: 'MANAGER_HIRED', managerId: 'manager-b',
    acceptanceId: 'acceptance-1', estimateId: 'estimate-1',
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
    beforeSchedules, afterSchedules)).toThrow('acceptance');
  expect(() => applyAcceptedManagerHire(before, after.state,
    after.event, estimate, { ...offer,
      annualSalaryMinorUnits: 25 }, acceptance,
    beforeSchedules, afterSchedules)).toThrow('liability');
  expect(() => applyAcceptedManagerHire(before, after.state,
    { ...after.event, afterRevision: 999 }, estimate,
    offer, acceptance, beforeSchedules,
    afterSchedules)).toThrow('club event');
  const forgedEstimate = { ...estimate, trueSkill: 100 };
  expect(() => applyAcceptedManagerHire(before, after.state,
    after.event, forgedEstimate,
    offer, acceptance, beforeSchedules,
    afterSchedules)).toThrow('estimate');
  const wrongAnnual = { ...afterSchedules,
    schedules: [{ ...afterSchedules.schedules[0]!,
      annualAmounts: [{ season: 1, amount: 25 },
        { season: 2, amount: 15 },
        { season: 3, amount: 20 }] }] };
  expect(() => applyAcceptedManagerHire(before, after.state,
    after.event, estimate, offer, acceptance,
    beforeSchedules, wrongAnnual)).toThrow('schedule');
});

it('rejects an occupied job and estimates unavailable when the offer was made', () => {
  const before = vacancy();
  const after = hire(before);
  const { beforeSchedules, afterSchedules } = schedules(after);
  expect(() => applyAcceptedManagerHire(state(), after.state,
    after.event, estimate, offer, acceptance,
    beforeSchedules, afterSchedules)).toThrow('vacancy');
  expect(() => applyAcceptedManagerHire(before, after.state,
    after.event, { ...estimate, availableAtDay: 12 },
    offer, acceptance, beforeSchedules,
    afterSchedules)).toThrow('estimate');
});
