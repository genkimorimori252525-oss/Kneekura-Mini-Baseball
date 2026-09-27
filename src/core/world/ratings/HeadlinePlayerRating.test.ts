import { describe, expect, it } from 'vitest';
import { appendPlayerKnowledgeReport, appendScoutingEvidence,
  createClubScoutingKnowledge } from '../scouting/ScoutingKnowledge';
import { createLeagueRatingReference, projectAffiliatedHeadline,
  projectScoutingTargetHeadline,
  type HeadlineRatingPolicy,
  type LeaguePopulationPlayer } from './HeadlinePlayerRating';

const policy: HeadlineRatingPolicy = {
  policyId: 'headline', version: 'v1', projectionVersion: 'public-v1',
  availableAtDay: 0, minimumRolePopulation: 2,
  pointsPerRatingPoint: 10,
  roles: [
    { roleId: 'BATTER', domains: [
      { domainId: 'contact', weight: 3 }, { domainId: 'power', weight: 1 },
    ] },
    { roleId: 'PITCHER', domains: [
      { domainId: 'command', weight: 3 }, { domainId: 'velocity', weight: 1 },
    ] },
  ],
};
const population: readonly LeaguePopulationPlayer[] = [
  { playerId: 'b1', affiliationLeagueId: 'league-a', roleId: 'BATTER',
    publicProjectionSourceId: 'public-b1', ratings: { contact: 40, power: 40 } },
  { playerId: 'b2', affiliationLeagueId: 'league-a', roleId: 'BATTER',
    publicProjectionSourceId: 'public-b2', ratings: { contact: 60, power: 60 } },
  { playerId: 'p1', affiliationLeagueId: 'league-a', roleId: 'PITCHER',
    publicProjectionSourceId: 'public-p1', ratings: { command: 40, velocity: 80 } },
  { playerId: 'p2', affiliationLeagueId: 'league-a', roleId: 'PITCHER',
    publicProjectionSourceId: 'public-p2', ratings: { command: 60, velocity: 20 } },
];
const reference = (players = population, leagueId = 'league-a', atDay = 20) =>
  createLeagueRatingReference({ leagueId,
    playerPopulationSnapshotId: 'population-1', projectionVersion: 'public-v1',
    atDay, population: players }, policy);
const knowledge = (clubId: string, contact: readonly [number, number],
  power: readonly [number, number]) => {
  let state = createClubScoutingKnowledge('career', clubId);
  state = appendScoutingEvidence(state, 0, {
    evidenceId: `${clubId}-e1`, careerId: 'career', clubId,
    playerId: 'target', observedAtDay: 10, availableAtDay: 11,
    sourceEventId: `${clubId}-match-1`,
  });
  return appendPlayerKnowledgeReport(state, 1, {
    reportId: `${clubId}-report`, careerId: 'career', clubId,
    playerId: 'target', observedAtDay: 10, availableAtDay: 12,
    evidenceSourceIds: [`${clubId}-e1`],
    evaluatorPersonIds: [`${clubId}-scout`],
    estimate: [
      { domainId: 'contact', lower: contact[0], upper: contact[1] },
      { domainId: 'power', lower: power[0], upper: power[1] },
    ], confidence: 'LOW',
  });
};

describe('dynamic league Headline Player Rating', () => {
  it('builds role benchmarks from current players and places their mean at ☆500', () => {
    const ref = reference();
    expect(ref.roleBenchmarks).toEqual([
      { roleId: 'BATTER', playerCount: 2, aggregateMean: 50 },
      { roleId: 'PITCHER', playerCount: 2, aggregateMean: 50 },
    ]);
    expect(ref.provenance).toEqual({ leagueId: 'league-a',
      playerPopulationSnapshotId: 'population-1',
      projectionVersion: 'public-v1', policyId: 'headline',
      policyVersion: 'v1', sourceSnapshotIds: [
        'public-b1', 'public-b2', 'public-p1', 'public-p2',
      ] });
    expect(ref).not.toHaveProperty('population');
  });

  it('uses role relevance and affiliation league context without a league-name buff', () => {
    const candidates: readonly LeaguePopulationPlayer[] = [
      { playerId: 'candidate-b', affiliationLeagueId: 'league-a', roleId: 'BATTER',
        publicProjectionSourceId: 'candidate-b-public',
        ratings: { contact: 70, power: 30, command: 30, velocity: 70 } },
      { playerId: 'mirror-b', affiliationLeagueId: 'league-a', roleId: 'BATTER',
        publicProjectionSourceId: 'mirror-b-public', ratings: { contact: 30, power: 70 } },
      { playerId: 'candidate-p', affiliationLeagueId: 'league-a', roleId: 'PITCHER',
        publicProjectionSourceId: 'candidate-p-public',
        ratings: { contact: 70, power: 30, command: 30, velocity: 70 } },
      { playerId: 'mirror-p', affiliationLeagueId: 'league-a', roleId: 'PITCHER',
        publicProjectionSourceId: 'mirror-p-public', ratings: { command: 70, velocity: 30 } },
    ];
    const ref = reference([...population, ...candidates]);
    const batter = projectAffiliatedHeadline({ playerId: 'candidate-b',
      affiliationLeagueId: 'league-a', roleId: 'BATTER',
      publicProjectionSourceId: 'candidate-b-public',
      ratings: { contact: 70, power: 30, command: 30, velocity: 70 },
    }, ref, policy);
    const pitcher = projectAffiliatedHeadline({ playerId: 'candidate-p',
      affiliationLeagueId: 'league-a', roleId: 'PITCHER',
      publicProjectionSourceId: 'candidate-p-public',
      ratings: { contact: 70, power: 30, command: 30, velocity: 70 },
    }, ref, policy);
    expect(batter.headline).toBe(600);
    expect(pitcher.headline).toBe(400);
    expect(batter.ratingContextLeagueId).toBe('league-a');
    expect(() => projectAffiliatedHeadline({ playerId: 'candidate-b',
      affiliationLeagueId: 'league-b', roleId: 'BATTER',
      publicProjectionSourceId: 'candidate-b-public',
      ratings: { contact: 70, power: 30 } }, ref, policy)).toThrow();
    const renamed = reference([...population, ...candidates].map(player => ({ ...player,
      affiliationLeagueId: 'league-z' })), 'league-z');
    expect(projectAffiliatedHeadline({ playerId: 'candidate-b',
      affiliationLeagueId: 'league-z', roleId: 'BATTER',
      publicProjectionSourceId: 'candidate-b-public',
      ratings: { contact: 70, power: 30 } }, renamed, policy).headline)
      .toBe(600);
  });

  it('changes the same public player summary when the actual league population changes', () => {
    const player = population[0]!;
    const original = projectAffiliatedHeadline(player, reference(), policy);
    const stronger = reference(population.map(item => item.playerId === 'b2'
      ? { ...item, ratings: { contact: item.ratings.contact + 30,
        power: item.ratings.power + 30 } } : item));
    const shifted = projectAffiliatedHeadline(player, stronger, policy);
    expect(original.headline).toBe(400);
    expect(shifted.headline).toBe(250);
  });

  it('rejects nonmembers and altered projections even with a real source ID', () => {
    const ref = reference();
    expect(() => projectAffiliatedHeadline({ ...population[0]!,
      playerId: 'forged-player' }, ref, policy)).toThrow();
    expect(() => projectAffiliatedHeadline({ ...population[0]!,
      publicProjectionSourceId: 'not-in-reference' }, ref, policy)).toThrow();
    expect(() => projectAffiliatedHeadline({ ...population[0]!,
      ratings: { contact: 100, power: 100 } }, ref, policy)).toThrow();
  });

  it('rates scouting targets only from each club report and retains uncertainty', () => {
    const ref = reference();
    const a = projectScoutingTargetHeadline({ careerId: 'career',
      evaluatingClubId: 'club-a', evaluatingClubLeagueId: 'league-a',
      targetPlayerId: 'target', roleId: 'BATTER', asOfDay: 20,
      knowledge: knowledge('club-a', [60, 80], [20, 40]) }, ref, policy);
    const b = projectScoutingTargetHeadline({ careerId: 'career',
      evaluatingClubId: 'club-b', evaluatingClubLeagueId: 'league-a',
      targetPlayerId: 'target', roleId: 'BATTER', asOfDay: 20,
      knowledge: knowledge('club-b', [50, 60], [20, 40]) }, ref, policy);
    expect(a).toMatchObject({ headline: 600, range: [500, 700],
      confidence: 'LOW', reportId: 'club-a-report',
      ratingContextLeagueId: 'league-a' });
    expect(b?.headline).toBeLessThan(a!.headline);
    expect(a).not.toHaveProperty('trueRatings');
  });

  it('does not fall back to hidden truth without an available complete club report', () => {
    const ref = reference();
    const base = { careerId: 'career', evaluatingClubId: 'club-a',
      evaluatingClubLeagueId: 'league-a', targetPlayerId: 'target',
      roleId: 'BATTER', asOfDay: 11,
      knowledge: knowledge('club-a', [60, 80], [20, 40]) };
    expect(projectScoutingTargetHeadline(base,
      reference(population, 'league-a', 10), policy)).toBeNull();
    const hidden = { ...base, asOfDay: 20,
      hiddenTrueRatings: { contact: 100, power: 100 } };
    expect(projectScoutingTargetHeadline(hidden, ref, policy))
      .toEqual(projectScoutingTargetHeadline({ ...base, asOfDay: 20 },
        ref, policy));
    expect(() => createLeagueRatingReference({ leagueId: 'league-a',
      playerPopulationSnapshotId: 'population-1',
      projectionVersion: 'public-v1', atDay: 20,
      population: [...population, population[0]!] }, policy)).toThrow();
  });
});
