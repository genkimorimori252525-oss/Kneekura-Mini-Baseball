import { expect, it } from 'vitest';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import type { CompetitionEditionSnapshot } from
  '../../core/world/competition/CompetitionEdition';
import type { CompetitionDraw } from
  '../../core/world/competition/CompetitionDraw';
import { assignContinentalGroupHomeSeries,
  createHomeFairnessLedger } from
  '../../core/world/competition/ContinentalHomeFairness';
import { createContinentalGroupGamePlan } from
  '../../core/world/competition/ContinentalGroupResults';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { registerContinentalGroupFixtureFromWorld } from
  './ContinentalGroupFixtureFromWorld';

const draw: CompetitionDraw = {
  editionId: 'league-season-1', drawPolicyVersion: 'draw-v1',
  drawSeed: 'seed-1', relaxationOrder: ['REMATCH_AVOIDANCE',
    'REGIONAL_DIVERSITY', 'SAME_LEAGUE_AVOIDANCE'],
  groups: [['club-a', 'club-b', 'club-c', 'club-d'],
    ['e', 'f', 'g', 'h'], ['i', 'j', 'k', 'l'],
    ['m', 'n', 'o', 'p']].map((members) =>
    members.map((teamId, index) => ({ teamId, pot: index + 1,
      leagueId: `league-${teamId}`, regionId: `region-${teamId}` }))),
  appliedConstraints: [], relaxedConstraints: [],
  softViolationCounts: { sameLeague: 0, sameRegion: 0, rematch: 0 },
};
const assignment = assignContinentalGroupHomeSeries({
  competitionId: 'continental-a', editionId: draw.editionId,
  editionOrdinal: 0, expectedRevision: 0, draw,
  ledger: createHomeFairnessLedger('continental-a'),
  policy: { version: 'home-v1', recentEditionWeights: [1] },
});
const groupGamePlan = createContinentalGroupGamePlan(assignment);
const edition: CompetitionEditionSnapshot = {
  competitionId: 'continental-a', editionId: 'league-season-1',
  canonicalRole: 'CONTINENTAL_CL',
  formatVersion: 'format-v1', ruleProfileVersion: 'rules-v1',
  hostingPolicyVersion: 'hosting-v1',
  drawPolicyVersion: 'draw-v1', drawPolicy: {
    version: 'draw-v1', relaxationOrder: draw.relaxationOrder },
  awardPolicyVersion: 'award-v1',
  qualificationSnapshotId: 'qualifiers-v1',
  participantIds: groupGamePlan.groups.flatMap((group) =>
    group.memberClubIds),
  host: { nationId: 'nation-1', cityIds: ['city-1'],
    venueIds: ['venue-1'] },
  calendarWindow: { startsOnDay: 100, endsOnDay: 120 },
  drawSnapshotId: 'draw-edition-1', prestigeAtEdition: 1,
};

it('pins the planned home Club stadium and rejects changed or unscheduled fixtures', () => {
  const game = groupGamePlan.groups[0].games.find((item) =>
    item.homeClubId === 'club-a')!;
  const club = state();
  const checkpoint = club;
  const match = new SqliteOfficialStateStore(':memory:');
  const stores = {
    editions: { readEdition: () => edition },
    homes: { readAssignment: () => ({ assignment,
      groupGamePlan }) },
    world: { readClubHistory: () => ({ checkpoint,
      acceptedEvents: [] }) },
    matches: match,
  };
  const input = { careerId: club.careerId,
    editionId: 'league-season-1', gameId: game.gameId,
    gameDay: 110 };
  try {
    const fixture = registerContinentalGroupFixtureFromWorld(
      stores, input);
    expect(fixture.binding.venueId).toBe('stadium-a');
    expect(fixture.basis.homeClubId).toBe(game.homeClubId);
    expect(match.getOfficialFixture(game.gameId))
      .toEqual(fixture.binding);
    expect(registerContinentalGroupFixtureFromWorld(stores, input))
      .toEqual(fixture);
    expect(() => registerContinentalGroupFixtureFromWorld(
      stores, { ...input, gameDay: 111 }))
      .toThrow('already pinned differently');
    expect(() => registerContinentalGroupFixtureFromWorld(
      stores, { ...input, gameDay: 121 }))
      .toThrow('accepted Edition');
    expect(() => registerContinentalGroupFixtureFromWorld(
      stores, { ...input, gameId: 'unknown' }))
      .toThrow('game is absent');
    const changed = { ...stores,
      world: { readClubHistory: () => null } };
    expect(() => registerContinentalGroupFixtureFromWorld(
      changed, input)).toThrow('home Club history is missing');
  } finally {
    match.close();
  }
});
