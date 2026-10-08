import { expect, it } from 'vitest';
import { applyRosterChange } from '../roster/RosterCommands';
import { createRosterState } from '../roster/RosterState';
import { rosterFixture } from '../roster/RosterTestFixtures';
import { CATALYST_FAMILIES } from './DevelopmentCatalyst';
import { startDevelopmentLearningEpisode, startPracticeDevelopmentLearningEpisode, type DevelopmentLearningEpisode } from './DevelopmentLearningEpisode';
import { deriveDevelopmentInitiationHistory } from './DevelopmentInitiationHistory';
import { resolveDevelopmentEpisodeInitiation } from './DevelopmentEpisodeInitiation';

const profile = { careerId: 'career-1', playerId: 'p2', createdAtDay: 1, profileVersion: 'catalyst-v1' };
const learning = { policyId: 'learning-v1', version: 'v1', availableAtDay: 1,
  minimumPracticeEvents: 2, minimumFeedbackEvents: 1, minimumElapsedDays: 5 };
const discovery = { careerId: 'career-1', playerId: 'p2', occurredAtDay: 10,
  sourceEventId: 'accepted-discovery', causeEventId: 'actual-practice-workload', motifId: 'accepted-motif' };
const resolve = (episode: DevelopmentLearningEpisode, engaged: boolean) => resolveDevelopmentEpisodeInitiation({ episode,
  catalystProfile: { ...profile, sensitivityByFamily: Object.fromEntries(CATALYST_FAMILIES.map(family => [family, 1])) as Record<typeof CATALYST_FAMILIES[number], number> },
  prior: { careerId: profile.careerId, playerId: profile.playerId, atDay: 10, domain: 'TECHNICAL', receptivity: 1,
    profileVersion: 'trajectory-v1', policyId: 'receptivity-v1', policyVersion: 'v1' },
  appraisal: { sourceEventId: `appraisal:${episode.episodeId}`, atDay: 10, salience: 1, learningDisposition: 1, novelty: 1, consolidationCapacity: 1 },
  policy: { policyId: 'initiation-v1', version: 'v1', availableAtDay: 1, baseChance: engaged ? 1 : 0, maximumChance: 1,
    sameMotifSaturation: 0.5, cooldownDays: 30, maximumOpenHypotheses: 2 },
  careerDevelopmentSeed: 1729, priorSameMotifAttempts: 0, openHypotheses: 0, competingLearningLoad: 0, lastInitiatedDay: null });

it('starts only a technical catalyst and rejects a future Person or learning policy', () => {
  const episode = startPracticeDevelopmentLearningEpisode('practice-episode', discovery, profile, learning);
  expect(episode).toMatchObject({ stage: 'CATALYST', revision: 0, domain: null, startedAtDay: 10,
    catalyst: { family: 'TECHNICAL_DISCOVERY', ...discovery } });
  expect(episode.events).toHaveLength(1);
  expect(() => startPracticeDevelopmentLearningEpisode('practice-episode', discovery, { ...profile, createdAtDay: 11 }, learning)).toThrow(/profile|policy/);
  expect(() => startPracticeDevelopmentLearningEpisode('practice-episode', discovery, profile, { ...learning, availableAtDay: 11 })).toThrow(/profile|policy/);
});

it('uses technical motif equality for dismissals while preserving shared cross-family cooldown and open counts', () => {
  const before = createRosterState(rosterFixture());
  const promoted = applyRosterChange(before, { commandId: 'promote', causeEventId: 'selection', expectedRevision: 0, effectiveDay: 10,
    changes: [{ playerId: 'p2', assignment: { clubId: 'a', unitId: 'a-first' } }] });
  if (!promoted.ok) throw new Error('fixture promotion failed');
  const roster = resolve(startDevelopmentLearningEpisode('roster-episode', before, promoted.state, promoted.event, 'p2', profile, learning), true);
  const dismissed = resolve(startPracticeDevelopmentLearningEpisode('dismissed', discovery, profile, learning), false);
  const same = startPracticeDevelopmentLearningEpisode('candidate', { ...discovery, sourceEventId: 'distinct-discovery' }, profile, learning);
  const different = startPracticeDevelopmentLearningEpisode('candidate-other', { ...discovery, sourceEventId: 'third-discovery', motifId: 'other-motif' }, profile, learning);
  expect(deriveDevelopmentInitiationHistory(same, 10, [roster, dismissed])).toEqual({ priorSameMotifAttempts: 1, openHypotheses: 1, lastInitiatedDay: 10 });
  expect(deriveDevelopmentInitiationHistory(different, 10, [roster, dismissed])).toEqual({ priorSameMotifAttempts: 0, openHypotheses: 1, lastInitiatedDay: 10 });
});

it('retains the single salted draw when only engagement probability changes', () => {
  const candidate = startPracticeDevelopmentLearningEpisode('practice-episode', discovery, profile, learning);
  const engaged = resolve(candidate, true), dismissed = resolve(candidate, false);
  expect(engaged.assessment.drawCount).toBe(1);
  expect(dismissed.assessment.drawCount).toBe(1);
  expect(engaged.assessment.draw).toBe(dismissed.assessment.draw);
  expect(engaged.assessment.seed).toBe(dismissed.assessment.seed);
  expect(engaged.episode.stage).toBe('ENGAGED');
  expect(dismissed.episode.stage).toBe('ABANDONED');
});
