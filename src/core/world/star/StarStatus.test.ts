import { describe, expect, it } from 'vitest';
import { projectStarStatus, type StarStatusInput, type StarSeasonEvidence } from './StarStatus';

const measure = (value: number, id: string) => ({ value, sourceIds: [id] });
const season = (seasonId: string, atDay: number, level = 0.9): StarSeasonEvidence => ({
  seasonId, atDay, evidencePolicyVersion: 'career-v1',
  prominence: measure(level, `${seasonId}-production`),
  roleCentrality: measure(level, `${seasonId}-role`),
  opponentAttention: measure(level, `${seasonId}-opponents`),
  leagueAwareness: measure(level, `${seasonId}-league`),
  crossAudienceRecognition: measure(level, `${seasonId}-audience`),
  historicalDominance: measure(level, `${seasonId}-dominance`),
  iconicSalience: measure(level, `${seasonId}-iconic`),
});
const policy: StarStatusInput['policy'] = {
  policyId: 'star', version: 'v1', effectiveDay: 0,
  currentWindowDays: 900, maxCurrentEvidenceAgeDays: 370,
  minimumStarSeasons: 2, minimumStarSpanDays: 300,
  minimumProminence: 0.8, minimumRoleCentrality: 0.7,
  minimumOpponentAttention: 0.7, minimumLeagueAwareness: 0.7,
  minimumSuperstarSeasons: 2, minimumSuperstarSpanDays: 300,
  minimumEliteProminence: 0.85, minimumCrossAudienceRecognition: 0.85,
  minimumHistoricalDominance: 0.9, minimumIconicSalience: 0.9,
  minimumHighStageSuccesses: 2, minimumHighStageSpanDays: 100,
};
const input = (seasons: readonly StarSeasonEvidence[], asOfDay = 800): StarStatusInput => ({
  careerId: 'career', playerId: 'player', asOfDay, policy, seasons,
  highStageEvents: [],
});

describe('projectStarStatus', () => {
  it('requires sustained competitive evidence rather than one hot month or popularity', () => {
    expect(projectStarStatus(input([season('hot', 700)] )).current).toBe('NONE');
    const popular = [season('a', 100, 0.9), season('b', 500, 0.9)]
      .map(s => ({ ...s, prominence: measure(0.4, `${s.seasonId}-production`) }));
    expect(projectStarStatus(input(popular)).current).toBe('NONE');
  });

  it('recognizes a sustained Star without high-stage success or publicity as a tactical fact', () => {
    const seasons = [season('a', 100), season('b', 500)]
      .map(s => ({ ...s, crossAudienceRecognition: measure(0.1, `${s.seasonId}-audience`) }));
    const result = projectStarStatus(input(seasons));
    expect(result.current).toBe('STAR');
    expect(result.legacy).toBe('STAR');
    expect(result.provenance.currentSeasonIds).toEqual(['a', 'b']);
    expect(result.provenance.policy).toEqual({ policyId: 'star', version: 'v1' });
    expect(result.provenance.seasonEvidencePolicies).toEqual([
      { seasonId: 'a', version: 'career-v1' },
      { seasonId: 'b', version: 'career-v1' },
    ]);
  });

  it('requires multiple high-stage successes and exceptional evidence for Superstar', () => {
    const base = input([season('a', 100), season('b', 500)]);
    const one = { ...base, highStageEvents: [{ eventId: 'final-1', atDay: 520,
      seasonId: 'b', resultSourceId: 'result-1', successful: true }] };
    expect(projectStarStatus(one).current).toBe('STAR');
    const two = { ...one, highStageEvents: [...one.highStageEvents, {
      eventId: 'final-2', atDay: 700, seasonId: 'b',
      resultSourceId: 'result-2', successful: true }] };
    const result = projectStarStatus(two);
    expect(result.current).toBe('SUPERSTAR');
    expect(result.provenance.highStageEventIds).toEqual(['final-1', 'final-2']);
    expect(result.provenance.exceptionalBasis).toEqual(['HISTORICAL_DOMINANCE', 'ICONIC_SALIENCE']);
  });

  it('allows iconic elite evidence without historic statistical dominance', () => {
    const seasons = [season('a', 100), season('b', 500)].map(s => ({
      ...s, historicalDominance: measure(0.2, `${s.seasonId}-dominance`),
    }));
    const result = projectStarStatus({ ...input(seasons), highStageEvents: [
      { eventId: 'e1', atDay: 510, seasonId: 'b', resultSourceId: 'r1', successful: true },
      { eventId: 'e2', atDay: 710, seasonId: 'b', resultSourceId: 'r2', successful: true },
    ] });
    expect(result.current).toBe('SUPERSTAR');
    expect(result.provenance.exceptionalBasis).toEqual(['ICONIC_SALIENCE']);
  });

  it('does not promote years of Star evidence without cross-audience recognition', () => {
    const seasons = [season('a', 100), season('b', 500), season('c', 800)]
      .map(s => ({ ...s, crossAudienceRecognition: measure(0.2,
        `${s.seasonId}-audience`) }));
    const result = projectStarStatus({ ...input(seasons, 850), highStageEvents: [
      { eventId: 'e1', atDay: 510, seasonId: 'b', resultSourceId: 'r1', successful: true },
      { eventId: 'e2', atDay: 710, seasonId: 'b', resultSourceId: 'r2', successful: true },
    ] });
    expect(result.current).toBe('STAR');
  });

  it('does not turn genesis candidacy or failed high-stage chances into status', () => {
    const candidateOnly = { ...input([season('hot', 700)]),
      superstarCandidate: true };
    expect(projectStarStatus(candidateOnly).current).toBe('NONE');
    const starInput = { ...input([season('a', 100), season('b', 500)]),
      highStageEvents: [
        { eventId: 'e1', atDay: 510, seasonId: 'b', resultSourceId: 'r1', successful: false },
        { eventId: 'e2', atDay: 710, seasonId: 'b', resultSourceId: 'r2', successful: false },
      ] };
    expect(projectStarStatus(starInput).current).toBe('STAR');
  });

  it('lets current status fade while preserving evidence-backed legacy', () => {
    const peak = [season('a', 100), season('b', 500)];
    const events = [
      { eventId: 'e1', atDay: 510, seasonId: 'b', resultSourceId: 'r1', successful: true },
      { eventId: 'e2', atDay: 710, seasonId: 'b', resultSourceId: 'r2', successful: true },
    ];
    const result = projectStarStatus({ ...input([...peak, season('c', 1200, 0.2)], 1250),
      highStageEvents: events });
    expect(result.current).toBe('NONE');
    expect(result.legacy).toBe('SUPERSTAR');
  });

  it('rejects duplicate, future, and unsourced evidence', () => {
    const base = input([season('a', 100), season('b', 500)]);
    expect(() => projectStarStatus({ ...base, seasons: [...base.seasons, base.seasons[0]!] }))
      .toThrow();
    expect(() => projectStarStatus({ ...base, seasons: [
      { ...base.seasons[0]!, atDay: 900 }, base.seasons[1]!,
    ] })).toThrow();
    expect(() => projectStarStatus({ ...base, seasons: [
      { ...base.seasons[0]!, prominence: measure(0.9, '') }, base.seasons[1]!,
    ] })).toThrow();
  });

  it('rejects a policy that would let a single season or moment confer status', () => {
    const base = input([season('a', 100)]);
    expect(() => projectStarStatus({ ...base, policy: {
      ...policy, minimumStarSeasons: 1,
    } })).toThrow();
    expect(() => projectStarStatus({ ...base, policy: {
      ...policy, minimumHighStageSuccesses: 1,
    } })).toThrow();
  });
});
