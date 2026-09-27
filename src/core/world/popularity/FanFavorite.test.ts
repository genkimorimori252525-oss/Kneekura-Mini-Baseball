import { expect, it } from 'vitest';
import { projectFanFavorite, type FanFavoriteInput,
  type AudienceObservation } from './FanFavorite';

const clubFans = (clubId: string) => ({ kind: 'CLUB_FANS' as const,
  scopeId: clubId });
const leagueFans = { kind: 'LEAGUE_WIDE' as const, scopeId: 'league-a' };
const observation = (evidenceId: string, audience: AudienceObservation['audience'],
  metric: AudienceObservation['metric'], value: number,
  atDay = 10): AudienceObservation => ({ evidenceId,
  sourceCareerEventId: `career-${evidenceId}`, atDay, availableAtDay: atDay,
  evidencePolicyVersion: 'observation-v1', audience, metric, value });
const policy: FanFavoriteInput['policy'] = {
  policyId: 'fan-favorite', version: 'v1', effectiveDay: 0,
  minimumAwareness: 0.5, minimumFavorability: 0.8,
};
const input = (observations: readonly AudienceObservation[],
  asOfDay = 30): FanFavoriteInput => ({ careerId: 'career-a',
  personId: 'person-a', asOfDay, initialClubId: 'club-a',
  transfers: [], observations, policy });

it('recognizes a local fan favorite independently of league recognition or competitive status', () => {
  const result = projectFanFavorite(input([
    observation('a-awareness', clubFans('club-a'), 'AWARENESS', 0.7),
    observation('a-favorability', clubFans('club-a'), 'FAVORABILITY', 0.95),
    observation('league-awareness', leagueFans, 'AWARENESS', 0.1),
  ]));
  expect(result.boundary).toBe('CAREER_AUDIENCE_DESCRIPTOR_ONLY');
  expect(result.currentClubId).toBe('club-a');
  expect(result.audiences).toMatchObject([
    { audience: clubFans('club-a'), awareness: 0.7,
      favorability: 0.95, fanFavorite: true },
    { audience: leagueFans, awareness: 0.1,
      favorability: null, fanFavorite: false },
  ]);
  expect(result.provenance.policy).toEqual({ policyId: 'fan-favorite',
    version: 'v1' });
  expect(result.provenance.evidenceIds).toEqual([
    'a-awareness', 'a-favorability', 'league-awareness',
  ]);
});

it('preserves former club affection and requires independent new club fan response after a transfer', () => {
  const base = input([
    observation('old-awareness', clubFans('club-a'), 'AWARENESS', 0.9, 10),
    observation('old-favorability', clubFans('club-a'), 'FAVORABILITY', 0.9, 10),
    { ...observation('arrival-awareness', clubFans('club-b'),
      'AWARENESS', 0.8, 21),
    sourceCareerEventId: 'official-transfer-a-b' },
  ], 30);
  const transferred = { ...base, transfers: [{ transferId: 'move-a-b',
    sourceCareerEventId: 'official-transfer-a-b', atDay: 20,
    fromClubId: 'club-a', toClubId: 'club-b' }] };
  const afterMove = projectFanFavorite(transferred);
  expect(afterMove.currentClubId).toBe('club-b');
  expect(afterMove.audiences).toMatchObject([
    { audience: clubFans('club-a'), fanFavorite: true },
    { audience: clubFans('club-b'), awareness: 0.8,
      favorability: null, fanFavorite: false },
  ]);
  expect(afterMove.provenance.transferIds).toEqual(['move-a-b']);
  const welcomed = projectFanFavorite({ ...transferred, observations: [
    ...base.observations,
    observation('new-favorability', clubFans('club-b'), 'FAVORABILITY',
      0.85, 25),
  ] });
  expect(welcomed.audiences.find((standing) =>
    standing.audience.scopeId === 'club-b')?.fanFavorite).toBe(true);
  expect(welcomed.audiences.find((standing) =>
    standing.audience.scopeId === 'club-a')?.fanFavorite).toBe(true);
});

it('uses the pinned threshold policy version and only evidence available by the query day', () => {
  const observations = [
    observation('awareness', clubFans('club-a'), 'AWARENESS', 0.6, 10),
    observation('favorability', clubFans('club-a'), 'FAVORABILITY', 0.82, 10),
    { ...observation('later', clubFans('club-a'), 'FAVORABILITY', 0.95,
      15), availableAtDay: 40 },
  ];
  const early = projectFanFavorite(input(observations, 30));
  expect(early.audiences[0]?.favorability).toBe(0.82);
  expect(early.audiences[0]?.fanFavorite).toBe(true);
  const stricter = projectFanFavorite({ ...input(observations, 50),
    policy: { ...policy, version: 'v2', effectiveDay: 40,
      minimumFavorability: 0.96 } });
  expect(stricter.audiences[0]?.favorability).toBe(0.95);
  expect(stricter.audiences[0]?.fanFavorite).toBe(false);
  expect(stricter.provenance.policy.version).toBe('v2');
});

it('rejects unsourced, future, duplicate and contradictory transfer evidence', () => {
  const valid = input([
    observation('a', clubFans('club-a'), 'AWARENESS', 0.7),
  ]);
  expect(() => projectFanFavorite({ ...valid, observations: [
    valid.observations[0]!, valid.observations[0]!,
  ] })).toThrow();
  expect(() => projectFanFavorite({ ...valid, observations: [
    { ...valid.observations[0]!, sourceCareerEventId: '' },
  ] })).toThrow();
  expect(() => projectFanFavorite({ ...valid, observations: [
    { ...valid.observations[0]!, atDay: 31 },
  ] })).toThrow();
  expect(() => projectFanFavorite({ ...valid, transfers: [{
    transferId: 'invalid', sourceCareerEventId: 'move', atDay: 20,
    fromClubId: 'club-c', toClubId: 'club-b',
  }] })).toThrow();
  expect(() => projectFanFavorite({ ...valid, policy: {
    ...policy, effectiveDay: 31,
  } })).toThrow();
});
