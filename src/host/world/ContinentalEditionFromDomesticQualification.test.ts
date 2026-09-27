import { expect, it } from 'vitest';
import { EMPTY_COMPETITION_DRAW_POLICY_REGISTRY,
  registerCompetitionDrawPolicy } from
  '../../core/world/competition/CompetitionDraw';
import { initializeContinentalEditionFromDomesticQualification } from
  './ContinentalEditionFromDomesticQualification';
import { openSqliteCompetitionEditionStore } from
  './SqliteCompetitionEditionStore';

const participants = Array.from({ length: 16 }, (_, index) =>
  `club-${index + 1}`);
const qualification = { qualificationSnapshotId: 'qualified-source-2027',
  competitionEditionId: 'continental-2027',
  participantIds: participants, leagueSources: [] };
const profile = { competitionId: 'continental-a',
  formatVersion: 'continental-16-v1',
  ruleProfileVersion: 'continental-rules-v1',
  hostingPolicyVersion: 'final-four-host-v1',
  drawPolicyVersion: 'draw-v1',
  drawPolicy: { version: 'draw-v1', relaxationOrder: [
    'REMATCH_AVOIDANCE', 'REGIONAL_DIVERSITY',
    'SAME_LEAGUE_AVOIDANCE',
  ] as const },
  awardPolicyVersion: 'award-v1', canonicalRole: 'CONTINENTAL_CL',
};
const registry = registerCompetitionDrawPolicy(
  EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, profile.drawPolicy);
const input = { careerId: 'career-1', profile,
  edition: { editionId: 'continental-2027',
    host: { nationId: 'nation-1', cityIds: ['city-1'],
      venueIds: ['venue-1'] },
    calendarWindow: { startsOnDay: 1, endsOnDay: 30 },
    drawSnapshotId: 'draw-2027', prestigeAtEdition: 1,
    finalFourHostCandidates: [{ venueId: 'venue-1',
      nationId: 'nation-1', cityId: 'city-1', regionId: 'region-1',
      eligible: true, suitabilityScore: 10, rotationScore: 1 }],
    finalFourPairingPolicy: { version: 'sf-v1',
      semifinalPairs: [[0, 1], [2, 3]] as const },
  }, drawPolicyRegistry: registry,
};

it('fixes continental participants and qualification ref from durable authority', () => {
  let current = qualification;
  const source = { readSnapshot: () => current };
  const edition = openSqliteCompetitionEditionStore(':memory:',
    source);
  try {
    const accepted = initializeContinentalEditionFromDomesticQualification(
      { qualification: source, edition }, input);
    expect(accepted.participantIds).toEqual(participants);
    expect(accepted.qualificationSnapshotId)
      .toBe('qualified-source-2027');
    expect(edition.readEdition('career-1', 'continental-2027'))
      .toEqual(accepted);
    current = { ...qualification,
      participantIds: participants.slice(0, 15) };
    expect(() => edition.readEdition('career-1', 'continental-2027'))
      .toThrow('corrupt competition edition');
    expect(() => initializeContinentalEditionFromDomesticQualification(
      { qualification: source, edition }, input))
      .toThrow('complete qualification');
  } finally {
    edition.close();
  }
});
