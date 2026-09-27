import { expect, it } from 'vitest';
import { applyRosterChange } from '../roster/RosterCommands';
import { createRosterState } from '../roster/RosterState';
import { rosterFixture } from '../roster/RosterTestFixtures';
import { CATALYST_FAMILIES } from './DevelopmentCatalyst';
import { startDevelopmentLearningEpisode } from './DevelopmentLearningEpisode';
import { assessDevelopmentEpisodeInitiation,
  resolveDevelopmentEpisodeInitiation,
  type DevelopmentInitiationRequest } from './DevelopmentEpisodeInitiation';

const request = (): DevelopmentInitiationRequest => {
  const before = createRosterState(rosterFixture());
  const promoted = applyRosterChange(before, { commandId: 'promote-1',
    causeEventId: 'selection-1', expectedRevision: 0,
    effectiveDay: 10, changes: [{ playerId: 'p2',
      assignment: { clubId: 'a', unitId: 'a-first' } }],
  });
  if (!promoted.ok) throw new Error(JSON.stringify(promoted.rejection));
  const episode = startDevelopmentLearningEpisode('episode-1', before,
    promoted.state, promoted.event, 'p2', {
      careerId: before.careerId, playerId: 'p2',
      createdAtDay: 1, profileVersion: 'catalyst-v1',
    }, { policyId: 'learning-v1', version: 'v1',
      availableAtDay: 10, minimumPracticeEvents: 2,
      minimumFeedbackEvents: 1, minimumElapsedDays: 5 });
  return { episode,
    catalystProfile: { careerId: episode.careerId,
      playerId: 'p2', createdAtDay: 1,
      profileVersion: 'catalyst-v1',
      sensitivityByFamily: Object.fromEntries(
        CATALYST_FAMILIES.map((family) => [family, 0.8])) as
        Record<typeof CATALYST_FAMILIES[number], number> },
    prior: { careerId: episode.careerId, playerId: 'p2',
      atDay: 10, domain: 'TECHNICAL', receptivity: 0.5,
      profileVersion: 'trajectory-v1', policyId: 'receptivity-v1',
      policyVersion: 'v1' },
    appraisal: { sourceEventId: 'personal-appraisal-1',
      atDay: 10, salience: 0.9, learningDisposition: 0.9,
      novelty: 0.8, consolidationCapacity: 0.9 },
    policy: { policyId: 'initiation-v1', version: 'v1',
      availableAtDay: 10, baseChance: 0.3,
      maximumChance: 0.5, sameMotifSaturation: 0.5,
      cooldownDays: 30, maximumOpenHypotheses: 2 },
    careerDevelopmentSeed: 1729,
    priorSameMotifAttempts: 0, openHypotheses: 0,
    competingLearningLoad: 0,
    lastInitiatedDay: null,
  } as DevelopmentInitiationRequest;
};

it('draws once per eligible episode from the career stream and is replayable', () => {
  const input = request();
  const first = assessDevelopmentEpisodeInitiation(input);
  expect(first).toEqual(assessDevelopmentEpisodeInitiation(input));
  expect(first).toMatchObject({ episodeId: 'episode-1',
    probability: 0.069984, reason: 'ELIGIBLE',
    rngVersion: 'development-xorshift32-v1', drawCount: 1,
    policyId: 'initiation-v1', catalystProfileVersion: 'catalyst-v1' });
  expect(first.draw).toBeGreaterThanOrEqual(0);
  expect(first.draw).toBeLessThan(1);
  expect(first).not.toHaveProperty('ability');
  expect(Object.isFrozen(first)).toBe(true);
  expect(assessDevelopmentEpisodeInitiation({ ...input,
    careerDevelopmentSeed: 1730 }).draw).not.toBe(first.draw);
});

it('honors cooldown, unresolved cap, novelty and repeated motif saturation', () => {
  const input = request();
  const base = assessDevelopmentEpisodeInitiation(input);
  expect(assessDevelopmentEpisodeInitiation({ ...input,
    priorSameMotifAttempts: 4 }).probability)
    .toBeCloseTo(base.probability / 3);
  expect(assessDevelopmentEpisodeInitiation({ ...input,
    lastInitiatedDay: 9 })).toMatchObject({
    probability: 0, reason: 'COOLDOWN', initiated: false });
  expect(assessDevelopmentEpisodeInitiation({ ...input,
    openHypotheses: 2 })).toMatchObject({
    probability: 0, reason: 'OPEN_HYPOTHESIS_CAP', initiated: false });
  expect(assessDevelopmentEpisodeInitiation({ ...input,
    competingLearningLoad: 0.5 }).probability)
    .toBeCloseTo(base.probability / 2);
  expect(assessDevelopmentEpisodeInitiation({ ...input,
    appraisal: { ...input.appraisal, novelty: 0 } }).probability)
    .toBe(0);
});

it('turns one actual appraisal into engagement or dismissal without ability gain', () => {
  const input = request();
  const guaranteed = { ...input,
    catalystProfile: { ...input.catalystProfile,
      sensitivityByFamily: { ...input.catalystProfile.sensitivityByFamily,
        PROMOTION_DEMOTION: 1 } },
    prior: { ...input.prior, receptivity: 1 },
    appraisal: { ...input.appraisal, salience: 1,
      learningDisposition: 1, novelty: 1,
      consolidationCapacity: 1 },
    policy: { ...input.policy, baseChance: 1,
      maximumChance: 1 },
  };
  const engaged = resolveDevelopmentEpisodeInitiation(guaranteed);
  expect(engaged.assessment.initiated).toBe(true);
  expect(engaged.episode.stage).toBe('ENGAGED');
  expect(engaged.episode).not.toHaveProperty('ability');
  const dismissed = resolveDevelopmentEpisodeInitiation({ ...input,
    appraisal: { ...input.appraisal,
      consolidationCapacity: 0 } });
  expect(dismissed.assessment.initiated).toBe(false);
  expect(dismissed.episode.stage).toBe('ABANDONED');
  expect(input.episode.stage).toBe('CATALYST');
});

it('rejects mismatched identity, future policy and stale appraisal', () => {
  const input = request();
  expect(() => assessDevelopmentEpisodeInitiation({ ...input,
    prior: { ...input.prior, playerId: 'other' } })).toThrow('scope');
  expect(() => assessDevelopmentEpisodeInitiation({ ...input,
    prior: { ...input.prior, domain: 'OTHER' as 'TECHNICAL' } }))
    .toThrow('scope');
  expect(() => assessDevelopmentEpisodeInitiation({ ...input,
    policy: { ...input.policy, availableAtDay: 11 } }))
    .toThrow('future');
  expect(() => assessDevelopmentEpisodeInitiation({ ...input,
    appraisal: { ...input.appraisal, atDay: 9 } })).toThrow('appraisal');
  expect(() => assessDevelopmentEpisodeInitiation({ ...input,
    careerDevelopmentSeed: 0 })).toThrow('seed');
});
