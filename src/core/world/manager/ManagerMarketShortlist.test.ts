import { expect, it } from 'vitest';
import { applyClubCommand } from '../club/ClubLifecycle';
import { command, state } from '../club/ClubFixtures.test-support';
import { appendManagerCandidateObservation,
  createManagerCandidateEvidenceLedger } from './ManagerCandidateEvidence';
import { shortlistManagerCandidates } from './ManagerMarketShortlist';

const rating = (mean: number, uncertainty: number) =>
  ({ mean, uncertainty, evidence: 1 });
const observed = (managerId: string, analysis: number,
  uncertainty: number) => ({
  eventId: `report-${managerId}`, careerId: 'career-a',
  clubId: 'club-a', managerId, kind: 'CAREER_EVIDENCE' as const,
  observedAtDay: 10,
  projectedSkills: {
    tacticalJudgment: rating(0.5, 0.2),
    analysis: rating(analysis, uncertainty),
    adaptation: rating(0.5, 0.2),
    playerEvaluation: rating(0.5, 0.2),
    operations: rating(0.5, 0.2),
    leadership: rating(0.5, 0.2),
  },
  fit: { philosophyFit: rating(0.5, 0.2),
    rosterFit: rating(0.5, 0.2),
    staffFit: rating(0.5, 0.2),
    clubCultureFit: rating(0.5, 0.2),
    publicAcceptance: rating(0.5, 0.2) },
});
const vacancy = () => {
  const initial = state();
  const changed = applyClubCommand(initial,
    command([{ kind: 'UPDATE_REFERENCES', references: {
      ...initial.live.references, staffRoleLinks: [],
    } }], initial, 'vacancy-1'));
  if (!changed.ok) throw new Error('vacancy fixture failed');
  return changed.state;
};
const evidence = () => {
  const initial = createManagerCandidateEvidenceLedger('career-a',
    'club-a');
  const first = appendManagerCandidateObservation(initial, 0,
    observed('manager-a', 0.8, 0.5));
  return appendManagerCandidateObservation(first, 1,
    observed('manager-b', 0.6, 0.1));
};
const terms = (managerId: string, willingToNegotiate = true) => ({
  careerId: 'career-a', clubId: 'club-a', managerId,
  interestSourceEventId: `interest-${managerId}`,
  interestObservedAtDay: 11, willingToNegotiate,
  desiredAnnualSalaryMinorUnits: 20, termSeasons: 2,
});
const brief = {
  briefId: 'brief-1', careerId: 'career-a', clubId: 'club-a',
  effectiveDay: 11, priorityAxes: ['analysis' as const],
  minimumLowerBounds: { analysis: 0.3 },
  maximumAnnualSalaryMinorUnits: 30,
};

it('shortlists willing affordable candidates by conservative observed fit', () => {
  const result = shortlistManagerCandidates(vacancy(), evidence(),
    brief, [terms('manager-a'), terms('manager-b')]);
  expect(result.shortlist.map((candidate) => candidate.managerId))
    .toEqual(['manager-b', 'manager-a']);
  expect(result.shortlist[0]?.estimate.projectedSkills.analysis)
    .toEqual(rating(0.6, 0.1));
  expect(result.shortlist[0]?.interestSourceEventId)
    .toBe('interest-manager-b');
  expect(result).not.toHaveProperty('trueSkill');
});

it('excludes unwilling, unaffordable, insufficiently observed and out-of-scope candidates', () => {
  const result = shortlistManagerCandidates(vacancy(), evidence(),
    brief, [terms('manager-a', false),
      { ...terms('manager-b'), desiredAnnualSalaryMinorUnits: 40 },
      terms('manager-unknown')]);
  expect(result.shortlist).toEqual([]);
  expect(result.rejected).toEqual([
    { managerId: 'manager-a', reason: 'NO_INTEREST' },
    { managerId: 'manager-b', reason: 'COST' },
    { managerId: 'manager-unknown', reason: 'NO_ESTIMATE' },
  ]);
  expect(() => shortlistManagerCandidates(vacancy(), evidence(),
    { ...brief, clubId: 'club-b' }, [terms('manager-a')]))
    .toThrow('scope');
  expect(() => shortlistManagerCandidates(state(), evidence(),
    brief, [terms('manager-a')])).toThrow('vacancy');
  expect(() => shortlistManagerCandidates(vacancy(), evidence(),
    brief, [{ ...terms('manager-a'), clubId: 'club-b' }]))
    .toThrow('scope');
  expect(() => shortlistManagerCandidates(vacancy(), evidence(),
    { ...brief, effectiveDay: 0 }, [terms('manager-a')]))
    .toThrow('day');
});
