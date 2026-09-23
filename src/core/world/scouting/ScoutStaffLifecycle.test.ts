import { expect, it } from 'vitest';
import { appendPlayerKnowledgeReport, appendScoutingEvidence,
  createClubScoutingKnowledge, readPlayerKnowledgeAt } from './ScoutingKnowledge';
import { appendDepartmentKnowledgeReport, appendDepartmentScoutingEvidence,
  createScoutStaffState, hireScout, releaseScout, retireScout,
  transferScout } from './ScoutStaffLifecycle';

const clubKnowledge = () => appendPlayerKnowledgeReport(appendScoutingEvidence(
  createClubScoutingKnowledge('career-1', 'club-a'), 0, {
    evidenceId: 'evidence-1', careerId: 'career-1', clubId: 'club-a',
    playerId: 'player-1', observedAtDay: 4, availableAtDay: 5,
    sourceEventId: 'game-1',
  }), 1, {
  reportId: 'report-1', careerId: 'career-1', clubId: 'club-a',
  playerId: 'player-1', observedAtDay: 4, availableAtDay: 5,
  evidenceSourceIds: ['evidence-1'], evaluatorPersonIds: ['scout-1'],
  estimate: [{ domainId: 'contact', lower: 60, upper: 80 }],
  confidence: 'MEDIUM',
});
const scout = () => ({ personId: 'scout-1', careerId: 'career-1',
  careerState: 'ACTIVE' as const, employmentClubId: null,
  personalNetwork: [{ regionId: 'japan', sourceEventId: 'contact-1',
    lastActiveDay: 3 }],
  experience: [{ regionId: 'japan', sourceEventId: 'assignment-1',
    occurredAtDay: 2 }],
});
const initial = () => createScoutStaffState('career-1', [scout()],
  [clubKnowledge(), createClubScoutingKnowledge('career-1', 'club-b')]);

it('hires a global scout without turning personal history into club reports', () => {
  const source = scout();
  const state = createScoutStaffState('career-1', [source],
    [clubKnowledge(), createClubScoutingKnowledge('career-1', 'club-b')]);
  const hired = hireScout(state, 0, 'scout-1', 'club-a', 6);
  source.personalNetwork[0].regionId = 'elsewhere';
  expect(hired.scouts[0]).toMatchObject({ employmentClubId: 'club-a',
    personalNetwork: [{ regionId: 'japan', sourceEventId: 'contact-1' }],
    experience: [{ sourceEventId: 'assignment-1' }] });
  expect(hired.departments[0].scoutIds).toEqual(['scout-1']);
  expect(hired.departments[0].knowledge.reports).toHaveLength(1);
  expect(hired.departments[1].knowledge.reports).toHaveLength(0);
  expect(Object.isFrozen(hired.scouts[0].personalNetwork[0])).toBe(true);
  expect(state.scouts[0].employmentClubId).toBeNull();
});

it('transfers the person and personal history while reports remain with their club', () => {
  const hired = hireScout(initial(), 0, 'scout-1', 'club-a', 6);
  const moved = transferScout(hired, 1, 'scout-1', 'club-b', 8);
  expect(moved.scouts[0]).toMatchObject({ employmentClubId: 'club-b',
    personalNetwork: [{ regionId: 'japan', lastActiveDay: 3 }],
    experience: [{ sourceEventId: 'assignment-1', occurredAtDay: 2 }] });
  expect(moved.departments[0].scoutIds).toEqual([]);
  expect(moved.departments[1].scoutIds).toEqual(['scout-1']);
  expect(readPlayerKnowledgeAt(moved.departments[0].knowledge,
    'player-1', 8)).toMatchObject({ report: { reportId: 'report-1' },
    freshnessDays: 4 });
  expect(readPlayerKnowledgeAt(moved.departments[1].knowledge,
    'player-1', 8)).toBeNull();
});

it('keeps a report created during employment when its evaluator transfers', () => {
  const state = createScoutStaffState('career-1', [scout()], [
    createClubScoutingKnowledge('career-1', 'club-a'),
    createClubScoutingKnowledge('career-1', 'club-b'),
  ]);
  const hired = hireScout(state, 0, 'scout-1', 'club-a', 4);
  const observed = appendDepartmentScoutingEvidence(hired, 1, 'club-a', {
    evidenceId: 'e1', careerId: 'career-1', clubId: 'club-a',
    playerId: 'player-1', observedAtDay: 4, availableAtDay: 5,
    sourceEventId: 'game-1',
  });
  const reported = appendDepartmentKnowledgeReport(observed, 2, 'club-a', {
    reportId: 'r1', careerId: 'career-1', clubId: 'club-a',
    playerId: 'player-1', observedAtDay: 4, availableAtDay: 5,
    evidenceSourceIds: ['e1'], evaluatorPersonIds: ['scout-1'],
    estimate: [{ domainId: 'contact', lower: 60, upper: 80 }],
    confidence: 'MEDIUM',
  });
  const moved = transferScout(reported, 3, 'scout-1', 'club-b', 8);
  expect(readPlayerKnowledgeAt(moved.departments[0].knowledge,
    'player-1', 8)?.report.reportId).toBe('r1');
  expect(readPlayerKnowledgeAt(moved.departments[1].knowledge,
    'player-1', 8)).toBeNull();
  expect(reported.departments[0].knowledge.reports).toHaveLength(1);
  expect(() => appendDepartmentKnowledgeReport(moved, 4, 'club-b', {
    reportId: 'leak', careerId: 'career-1', clubId: 'club-b',
    playerId: 'player-1', observedAtDay: 4, availableAtDay: 8,
    evidenceSourceIds: ['e1'], evaluatorPersonIds: ['scout-1'],
    estimate: [{ domainId: 'contact', lower: 60, upper: 80 }],
    confidence: 'MEDIUM',
  })).toThrow('evidence');
});

it('releases or retires a scout without erasing institutional knowledge', () => {
  const hired = hireScout(initial(), 0, 'scout-1', 'club-a', 6);
  const released = releaseScout(hired, 1, 'scout-1', 7);
  expect(released.scouts[0]).toMatchObject({ careerState: 'ACTIVE',
    employmentClubId: null, experience: [{ sourceEventId: 'assignment-1' }] });
  expect(released.departments[0].scoutIds).toEqual([]);
  expect(released.departments[0].knowledge.reports).toHaveLength(1);
  const rehired = hireScout(released, 2, 'scout-1', 'club-b', 8);
  const retired = retireScout(rehired, 3, 'scout-1', 9);
  expect(retired.scouts[0]).toMatchObject({ careerState: 'RETIRED',
    employmentClubId: null, personalNetwork: [{ sourceEventId: 'contact-1' }] });
  expect(retired.departments[1].scoutIds).toEqual([]);
  expect(retired.departments[0].knowledge.reports).toHaveLength(1);
  expect(() => hireScout(retired, 4, 'scout-1', 'club-a', 10))
    .toThrow('retired');
});

it('rejects invalid employment transitions and stale revisions', () => {
  const state = initial();
  expect(() => hireScout(state, 1, 'scout-1', 'club-a', 6))
    .toThrow('revision');
  expect(() => hireScout(state, 0, 'scout-1', 'missing', 6))
    .toThrow('department');
  const hired = hireScout(state, 0, 'scout-1', 'club-a', 6);
  expect(() => hireScout(hired, 1, 'scout-1', 'club-b', 7))
    .toThrow('employed');
  expect(() => transferScout(hired, 1, 'scout-1', 'club-a', 7))
    .toThrow('different');
  expect(() => transferScout(hired, 1, 'scout-1', 'club-b', 5))
    .toThrow('backdated');
  expect(() => releaseScout(state, 0, 'scout-1', 6))
    .toThrow('employed');
});
