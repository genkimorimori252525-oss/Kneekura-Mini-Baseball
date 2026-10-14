import { applyClubCommand } from '../../core/world/club/ClubLifecycle';
import { command, state } from
  '../../core/world/club/ClubFixtures.test-support';
import { appendManagerCandidateObservation,
  createManagerCandidateEvidenceLedger,
  getManagerCandidateEstimate } from
  '../../core/world/manager/ManagerCandidateEvidence';

export const managerHireFixture = () => {
  const vacantClub = () => {
    const initial = state();
    const vacancy = applyClubCommand(initial,
      command([{ kind: 'UPDATE_REFERENCES', references: {
        ...initial.live.references, staffRoleLinks: [],
      } }], initial, 'manager-vacancy'));
    if (!vacancy.ok) throw new Error('vacancy fixture failed');
    return vacancy.state;
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
  const brief = { briefId: 'hire-brief-1', careerId: 'career-a',
    clubId: 'club-a', effectiveDay: 11,
    priorityAxes: ['analysis' as const],
    minimumLowerBounds: { analysis: 0.05 },
    maximumAnnualSalaryMinorUnits: 30 };
  const terms = { careerId: 'career-a', clubId: 'club-a',
    managerId: 'manager-b', interestSourceEventId: 'interest-1',
    interestObservedAtDay: 11, willingToNegotiate: true,
    desiredAnnualSalaryMinorUnits: 20, termSeasons: 3 };
  const offer = { offerId: 'offer-1', estimateId: estimate.estimateId,
    careerId: 'career-a', clubId: 'club-a', managerId: 'manager-b',
    roleId: 'manager-role', appointmentId: 'appointment-b',
    contractId: 'manager-contract-b', offeredAtDay: 11,
    currency: 'SIM', annualSalaryMinorUnits: 20, termSeasons: 3 };
  const acceptance = { acceptanceId: 'acceptance-1',
    sourceEventId: 'manager-acceptance-1', offerId: offer.offerId,
    managerId: 'manager-b', acceptedAtDay: 12,
    accepted: true as const };
  const request = () => ({ applicationId: 'manager-hire-1',
    careerId: 'career-a', clubId: 'club-a',
    expectedClubRevision: vacantClub().revision,
    expectedWageRevision: 0,
    evidence, brief, candidates: [terms], offer, acceptance,
    ids: { clubEventId: 'hire-atomic-1',
      commitmentId: 'manager-wage-1', effectiveDay: 12 } });
  return { vacantClub, evidence, offer, acceptance, request };
};
