import { expect, it } from 'vitest';
import {
  appendManagerCandidateObservation,
  createManagerCandidateEvidenceLedger,
  getManagerCandidateEstimate,
} from './ManagerCandidateEvidence';

const rating = (mean: number, uncertainty = 0.4) =>
  ({ mean, uncertainty, evidence: 1 });
const skills = {
  tacticalJudgment: rating(0.4), analysis: rating(0.5),
  adaptation: rating(0.3), playerEvaluation: rating(0.4),
  operations: rating(0.5), leadership: rating(0.3),
};
const fit = {
  philosophyFit: rating(0.5), rosterFit: rating(0.4),
  staffFit: rating(0.3), clubCultureFit: rating(0.5),
  publicAcceptance: rating(0.2),
};
const observation = {
  eventId: 'interview-1', careerId: 'career-a', clubId: 'club-a',
  managerId: 'manager-b', kind: 'INTERVIEW' as const,
  observedAtDay: 11, projectedSkills: skills, fit,
};

it('derives a club-specific estimate only from available recorded observations', () => {
  const initial = createManagerCandidateEvidenceLedger('career-a', 'club-a');
  const observed = appendManagerCandidateObservation(initial, 0, observation);
  expect(getManagerCandidateEstimate(observed, 'manager-b', 10)).toBeNull();
  const first = getManagerCandidateEstimate(observed, 'manager-b', 11)!;
  expect(first).toMatchObject({ clubId: 'club-a', managerId: 'manager-b',
    sourceEventIds: ['interview-1'], projectedSkills: skills, fit });
  expect(first).not.toHaveProperty('trueSkill');

  const revised = appendManagerCandidateObservation(observed, 1, {
    ...observation, eventId: 'reference-1', kind: 'REFERENCE',
    observedAtDay: 12, projectedSkills: { leadership: rating(0.6, 0.2) },
    fit: {},
  });
  const latest = getManagerCandidateEstimate(revised, 'manager-b', 12)!;
  expect(latest.sourceEventIds).toEqual(['interview-1', 'reference-1']);
  expect(latest.projectedSkills.leadership).toEqual(rating(0.6, 0.2));
  expect(latest.projectedSkills.analysis).toEqual(skills.analysis);
  expect(getManagerCandidateEstimate(revised, 'manager-b', 11))
    .toEqual(first);
});

it('keeps different clubs separate and rejects hidden truth, stale revisions and duplicate sources', () => {
  const initial = createManagerCandidateEvidenceLedger('career-a', 'club-a');
  const observed = appendManagerCandidateObservation(initial, 0, observation);
  expect(() => appendManagerCandidateObservation(observed, 0, {
    ...observation, eventId: 'interview-2', observedAtDay: 12,
  })).toThrow('revision');
  expect(() => appendManagerCandidateObservation(observed, 1, observation))
    .toThrow('duplicate');
  expect(() => appendManagerCandidateObservation(initial, 0, {
    ...observation, clubId: 'club-b',
  })).toThrow('scope');
  expect(() => appendManagerCandidateObservation(initial, 0, {
    ...observation, trueSkill: 99,
  } as typeof observation)).toThrow('observation');
  expect(() => appendManagerCandidateObservation(initial, 0, {
    ...observation, projectedSkills: { ...skills,
      analysis: rating(0.5, 0) },
  })).toThrow('uncertainty');
  const other = appendManagerCandidateObservation(
    createManagerCandidateEvidenceLedger('career-a', 'club-b'), 0,
    { ...observation, clubId: 'club-b', projectedSkills: {
      ...skills, analysis: rating(-0.2),
    } });
  expect(getManagerCandidateEstimate(other, 'manager-b', 11)
    ?.projectedSkills.analysis.mean).toBe(-0.2);
});

it('keeps recorded evidence stable when a caller mutates its input', () => {
  const mutableRating = { mean: 0.4, uncertainty: 0.3, evidence: 1 };
  const observed = appendManagerCandidateObservation(
    createManagerCandidateEvidenceLedger('career-a', 'club-a'), 0,
    { ...observation, projectedSkills: {
      ...skills, analysis: mutableRating,
    } });
  mutableRating.mean = -0.8;
  expect(getManagerCandidateEstimate(observed, 'manager-b', 11)
    ?.projectedSkills.analysis.mean).toBe(0.4);
});
