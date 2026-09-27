import { describe, expect, it } from 'vitest';
import { applyRosterChange } from '../roster/RosterCommands';
import { createRosterState } from '../roster/RosterState';
import { rosterFixture } from '../roster/RosterTestFixtures';
import { appendDevelopmentLearningEvent,
  startDevelopmentLearningEpisode } from '../development/DevelopmentLearningEpisode';
import type { StarGenesisProfile } from '../development/StarGenesis';
import { applyRealizedSpotlightEvidence,
  createRealizedSpotlightSource,
  selectRealizedSpotlightResponse,
  type RealizedSpotlightObservation,
  type RealizedSpotlightPolicy } from './RealizedSpotlightSource';

const genesis = (candidateTier: StarGenesisProfile['candidateTier'] =
  'SUPERSTAR_CANDIDATE'): StarGenesisProfile => ({
  careerId: 'career-1', playerId: 'p2', createdAtDay: 1,
  profileVersion: 'genesis-v1', candidateTier,
  spotlightPotential: 0.9, pressureStabilityPotential: 0.8,
  pressureConversionPotential: 0.7,
  iconicPotential: 0.9, publicMagnetismPotential: 0.9,
  generation: { rngVersion: 'star-genesis-xorshift32-v1',
    seed: 42, drawCount: 6, policyId: 'genesis-policy' },
});
const policy: RealizedSpotlightPolicy = {
  policyId: 'spotlight-learning', version: 'v1',
  profileVersion: 'realized-v1', availableAtDay: 1,
  initialResponse: { activation: 0.5, stability: 0.5,
    pressureConversion: 0.5 },
  minimumImportance: 0.7, minimumMatches: 2,
  minimumObservationSpanDays: 60,
  learningFraction: 0.5, potentialSensitivity: 0.5,
};
const episode = () => {
  const before = createRosterState(rosterFixture());
  const changed = applyRosterChange(before, { commandId: 'promote-1',
    causeEventId: 'selection-1', expectedRevision: 0,
    effectiveDay: 10, changes: [{ playerId: 'p2',
      assignment: { clubId: 'a', unitId: 'a-first' } }],
  });
  if (!changed.ok) throw new Error(JSON.stringify(changed.rejection));
  let current = startDevelopmentLearningEpisode('episode-1', before,
    changed.state, changed.event, 'p2', {
      careerId: 'career-1', playerId: 'p2', createdAtDay: 1,
      profileVersion: 'learning-profile-v1',
    }, { policyId: 'learning', version: 'v1', availableAtDay: 10,
      minimumPracticeEvents: 2, minimumFeedbackEvents: 1,
      minimumElapsedDays: 5 });
  const steps = [
    ['APPRAISAL_ENGAGED', 10], ['HYPOTHESIS_FORMED', 11],
    ['PRACTICE_RECORDED', 12], ['PRACTICE_RECORDED', 13],
    ['FEEDBACK_RECORDED', 14], ['CONSOLIDATION_RECORDED', 15],
  ] as const;
  for (const [index, [kind, atDay]] of steps.entries()) {
    current = appendDevelopmentLearningEvent(current, current.revision, {
      eventId: `episode-event-${index}`,
      sourceEventId: `source-${index}`, atDay, kind,
      ...(index >= 1 ? { domain: 'BEHAVIOR' as const } : {}),
    });
  }
  return current;
};
const observations: readonly RealizedSpotlightObservation[] = [
  { observationId: 'o1', matchId: 'major-1', sourceEventId: 'appraisal-1',
    atDay: 20, importance: 0.9, activation: 0.9,
    stability: 0.8, pressureConversion: 0.7 },
  { observationId: 'o2', matchId: 'major-2', sourceEventId: 'appraisal-2',
    atDay: 100, importance: 0.95, activation: 0.9,
    stability: 0.8, pressureConversion: 0.7 },
];

describe('realized spotlight Career source', () => {
  it('keeps hidden genesis separate from the Match-readable realized response', () => {
    const source = createRealizedSpotlightSource(genesis(), policy);
    const realized = selectRealizedSpotlightResponse(source, 10);
    expect(realized).toEqual({ careerId: 'career-1', playerId: 'p2',
      profileVersion: 'realized-v1', effectiveDay: 1,
      activation: 0.5, stability: 0.5, pressureConversion: 0.5 });
    expect(realized).not.toHaveProperty('candidateTier');
    expect(realized).not.toHaveProperty('spotlightPotential');
    expect(source).not.toHaveProperty('candidateTier');
  });

  it('updates after consolidated learning and repeated high-stage observations', () => {
    const initial = createRealizedSpotlightSource(genesis(), policy);
    const changed = applyRealizedSpotlightEvidence(initial, 0,
      episode(), observations, policy, 100);
    expect(changed.profile.activation).toBeGreaterThan(0.5);
    expect(changed.profile.stability).toBeGreaterThan(0.5);
    expect(changed.profile.pressureConversion).toBeGreaterThan(0.5);
    expect(changed.profile.effectiveDay).toBe(100);
    expect(changed.records[0]).toMatchObject({ episodeId: 'episode-1',
      policyId: 'spotlight-learning', policyVersion: 'v1',
      genesisProfileVersion: 'genesis-v1',
      observationSourceEventIds: ['appraisal-1', 'appraisal-2'],
      consolidationSourceEventId: 'source-5' });
    expect(selectRealizedSpotlightResponse(initial, 100).activation).toBe(0.5);
    expect(() => selectRealizedSpotlightResponse(changed, 99)).toThrow();
  });

  it('does not turn a single important match or a short streak into a response change', () => {
    const source = createRealizedSpotlightSource(genesis(), policy);
    expect(() => applyRealizedSpotlightEvidence(source, 0,
      episode(), observations.slice(0, 1), policy, 100)).toThrow();
    expect(() => applyRealizedSpotlightEvidence(source, 0,
      episode(), [observations[0]!, { ...observations[1]!, atDay: 25 }],
      policy, 100)).toThrow();
    expect(source.profile.activation).toBe(0.5);
  });

  it('uses potential only after evidence, independently of candidate tier', () => {
    const a = createRealizedSpotlightSource(genesis('ORDINARY'), policy);
    const b = createRealizedSpotlightSource(genesis('SUPERSTAR_CANDIDATE'), policy);
    expect(a.profile).toEqual(b.profile);
    expect(applyRealizedSpotlightEvidence(a, 0, episode(), observations,
      policy, 100).profile).toEqual(applyRealizedSpotlightEvidence(b, 0,
      episode(), observations, policy, 100).profile);
  });

  it('rejects wrong player, future evidence, and episode reuse', () => {
    const source = createRealizedSpotlightSource(genesis(), policy);
    expect(() => applyRealizedSpotlightEvidence(source, 0,
      { ...episode(), playerId: 'other' }, observations, policy, 100)).toThrow();
    expect(() => applyRealizedSpotlightEvidence(source, 0,
      episode(), [observations[0]!, { ...observations[1]!, atDay: 9 }],
      policy, 100)).toThrow();
    expect(() => applyRealizedSpotlightEvidence(source, 0,
      episode(), observations, policy, 99)).toThrow();
    const changed = applyRealizedSpotlightEvidence(source, 0,
      episode(), observations, policy, 100);
    expect(() => applyRealizedSpotlightEvidence(changed, 1,
      episode(), observations, policy, 100)).toThrow();
  });

  it('rejects tampered Career potential and realized profile scope', () => {
    const source = createRealizedSpotlightSource(genesis(), policy);
    expect(() => applyRealizedSpotlightEvidence({ ...source,
      hiddenPotential: { ...source.hiddenPotential, activation: 2 },
    }, 0, episode(), observations, policy, 100)).toThrow();
    expect(() => applyRealizedSpotlightEvidence({ ...source,
      profile: { ...source.profile, playerId: 'other' },
    }, 0, episode(), observations, policy, 100)).toThrow();
  });
});
