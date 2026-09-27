import { describe, expect, it } from 'vitest';
import { state as clubState } from '../club/ClubFixtures.test-support';
import { createRosterState } from '../roster/RosterState';
import { appendPlayerKnowledgeReport, appendScoutingEvidence,
  createClubScoutingKnowledge } from '../scouting/ScoutingKnowledge';
import { type HeadlineRatingPolicy } from './HeadlinePlayerRating';
import { createPublicProjectionSnapshot, createWorldHeadlineReferenceSnapshot,
  projectScoutingHeadlineAtWorldSnapshot } from './WorldHeadlineRatingAdapter';

const policy: HeadlineRatingPolicy = {
  policyId: 'headline', version: 'v1', projectionVersion: 'public-v1',
  availableAtDay: 0, minimumRolePopulation: 2, pointsPerRatingPoint: 10,
  roles: [{ roleId: 'BATTER', domains: [{ domainId: 'contact', weight: 1 }] }],
};
const club = clubState();
const roster = createRosterState({ careerId: 'career-a', revision: 2,
  effectiveDay: 11, profiles: [], units: [], players: [
    { playerId: 'p1', clubRights: { rightsHolderClubId: 'club-a', contractId: 'c1' },
      assignment: null, registrations: [], availability: { status: 'AVAILABLE', evidenceId: 'a1' } },
    { playerId: 'p2', clubRights: { rightsHolderClubId: 'club-a', contractId: 'c2' },
      assignment: null, registrations: [], availability: { status: 'AVAILABLE', evidenceId: 'a2' } },
  ] });
const linkedClub = { ...club, live: { ...club.live,
  references: { ...club.live.references, playerClubStateRefs: [
    { playerId: 'p1', stateRef: 'roster-p1' },
    { playerId: 'p2', stateRef: 'roster-p2' },
  ] } } };
const rawProjections = [
  { projectionId: 'projection-p1', playerId: 'p1', roleId: 'BATTER',
    observedAtDay: 12, availableAtDay: 13,
    sourceEventIds: ['performance-p1'], ratings: { contact: 40 } },
  { projectionId: 'projection-p2', playerId: 'p2', roleId: 'BATTER',
    observedAtDay: 12, availableAtDay: 13,
    sourceEventIds: ['performance-p2'], ratings: { contact: 60 } },
];
const publicSnapshot = () => createPublicProjectionSnapshot({
  snapshotId: 'public-snapshot-1', careerId: 'career-a',
  projectionVersion: 'public-v1', atDay: 15, records: rawProjections,
});
const world = () => createWorldHeadlineReferenceSnapshot({
  snapshotId: 'world-headline-1', asOfDay: 20,
  roster, clubs: [linkedClub], publicProjectionSnapshot: publicSnapshot(),
}, policy);
const knowledge = () => {
  let state = createClubScoutingKnowledge('career-a', 'club-a');
  state = appendScoutingEvidence(state, 0, { evidenceId: 'e1',
    careerId: 'career-a', clubId: 'club-a', playerId: 'target',
    observedAtDay: 15, availableAtDay: 16, sourceEventId: 'observed-target' });
  return appendPlayerKnowledgeReport(state, 1, { reportId: 'report-1',
    careerId: 'career-a', clubId: 'club-a', playerId: 'target',
    observedAtDay: 15, availableAtDay: 21, evidenceSourceIds: ['e1'],
    evaluatorPersonIds: ['scout-1'],
    estimate: [{ domainId: 'contact', lower: 60, upper: 80 }],
    confidence: 'LOW' });
};

describe('world headline rating snapshot adapter', () => {
  it('derives league population from rights-held roster and club league source', () => {
    const snapshot = world();
    expect(snapshot.references).toHaveLength(1);
    expect(snapshot.references[0]?.roleBenchmarks).toEqual([
      { roleId: 'BATTER', playerCount: 2, aggregateMean: 50 },
    ]);
    expect(snapshot.references[0]?.provenance).toMatchObject({
      leagueId: 'league-a', projectionVersion: 'public-v1',
      sourceSnapshotIds: ['projection-p1', 'projection-p2'],
    });
    expect(snapshot.provenance).toMatchObject({
      snapshotId: 'world-headline-1', careerId: 'career-a',
      rosterRevision: 2, publicProjectionSnapshotId: 'public-snapshot-1',
      clubRevisions: [{ clubId: 'club-a', revision: club.revision }],
    });
    expect(snapshot).not.toHaveProperty('population');
    expect(snapshot).not.toHaveProperty('hiddenRatings');
  });

  it('rejects duplicate, future, or hidden public projection fields', () => {
    expect(() => createPublicProjectionSnapshot({ snapshotId: 'x',
      careerId: 'career-a', projectionVersion: 'public-v1', atDay: 15,
      records: [...rawProjections, rawProjections[0]!] })).toThrow();
    expect(() => createPublicProjectionSnapshot({ snapshotId: 'x',
      careerId: 'career-a', projectionVersion: 'public-v1', atDay: 15,
      records: [{ ...rawProjections[0]!, availableAtDay: 16 }] })).toThrow();
    const hiddenProjection = { ...rawProjections[0]!,
      hiddenTrueRatings: { contact: 100 } };
    expect(() => createPublicProjectionSnapshot({ snapshotId: 'x',
      careerId: 'career-a', projectionVersion: 'public-v1', atDay: 15,
      records: [hiddenProjection] })).toThrow();
  });

  it('rejects missing, mismatched, or later world sources', () => {
    const input = { snapshotId: 'world-headline-1', asOfDay: 20,
      roster, clubs: [linkedClub], publicProjectionSnapshot: publicSnapshot() };
    expect(() => createWorldHeadlineReferenceSnapshot({ ...input,
      publicProjectionSnapshot: createPublicProjectionSnapshot({
        snapshotId: 'incomplete', careerId: 'career-a',
        projectionVersion: 'public-v1', atDay: 15,
        records: [rawProjections[0]!] }),
    }, policy)).toThrow();
    expect(() => createWorldHeadlineReferenceSnapshot({ ...input,
      clubs: [{ ...linkedClub, careerId: 'other-career' }],
    }, policy)).toThrow();
    expect(() => createWorldHeadlineReferenceSnapshot({ ...input,
      asOfDay: 10,
    }, policy)).toThrow();
  });

  it('uses only a report available by the pinned world day for a scouting target', () => {
    const snapshot = world();
    expect(projectScoutingHeadlineAtWorldSnapshot(snapshot,
      { evaluatingClubId: 'club-a', targetPlayerId: 'p2',
        roleId: 'BATTER',
        knowledge: createClubScoutingKnowledge('career-a', 'club-a') },
      policy)).toBeNull();
    expect(projectScoutingHeadlineAtWorldSnapshot(snapshot,
      { evaluatingClubId: 'club-a', targetPlayerId: 'target',
        roleId: 'BATTER', knowledge: knowledge() }, policy)).toBeNull();
    const later = createWorldHeadlineReferenceSnapshot({
      snapshotId: 'world-headline-2', asOfDay: 22,
      roster, clubs: [linkedClub], publicProjectionSnapshot: publicSnapshot(),
    }, policy);
    expect(projectScoutingHeadlineAtWorldSnapshot(later,
      { evaluatingClubId: 'club-a', targetPlayerId: 'target',
        roleId: 'BATTER', knowledge: knowledge() }, policy))
      .toMatchObject({ headline: 700, range: [600, 800], reportId: 'report-1',
        ratingContextLeagueId: 'league-a' });
  });

  it('rejects a forged report that claims future observation was already available', () => {
    const honest = knowledge();
    const forged = { ...honest, reports: honest.reports.map((report) => ({
      ...report, observedAtDay: 30, availableAtDay: 19,
    })) };
    expect(() => projectScoutingHeadlineAtWorldSnapshot(world(),
      { evaluatingClubId: 'club-a', targetPlayerId: 'target',
        roleId: 'BATTER', knowledge: forged }, policy)).toThrow();
  });
});
