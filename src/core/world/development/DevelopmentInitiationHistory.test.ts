import { expect, it } from 'vitest';
import { applyRosterChange } from '../roster/RosterCommands';
import { createRosterState } from '../roster/RosterState';
import { rosterFixture } from '../roster/RosterTestFixtures';
import { CATALYST_FAMILIES } from './DevelopmentCatalyst';
import { appendDevelopmentLearningEvent,
  startDevelopmentLearningEpisode } from './DevelopmentLearningEpisode';
import { resolveDevelopmentEpisodeInitiation } from './DevelopmentEpisodeInitiation';
import { deriveDevelopmentInitiationHistory } from './DevelopmentInitiationHistory';

const candidate = (episodeId: string, atDay: number) => {
  const before = createRosterState(rosterFixture());
  const promoted = applyRosterChange(before, {
    commandId: `promotion-${episodeId}`,
    causeEventId: `selection-${episodeId}`,
    expectedRevision: 0, effectiveDay: atDay,
    changes: [{ playerId: 'p2',
      assignment: { clubId: 'a', unitId: 'a-first' } }],
  });
  if (!promoted.ok) throw new Error('fixture promotion failed');
  return startDevelopmentLearningEpisode(episodeId, before,
    promoted.state, promoted.event, 'p2', {
      careerId: before.careerId, playerId: 'p2',
      createdAtDay: 1, profileVersion: 'catalyst-v1',
    }, { policyId: 'learning-v1', version: 'v1',
      availableAtDay: 1, minimumPracticeEvents: 2,
      minimumFeedbackEvents: 1, minimumElapsedDays: 5 });
};

const resolved = (episodeId: string, atDay: number,
  initiated: boolean) => {
  const episode = candidate(episodeId, atDay);
  return resolveDevelopmentEpisodeInitiation({ episode,
    catalystProfile: { careerId: episode.careerId,
      playerId: episode.playerId, createdAtDay: 1,
      profileVersion: 'catalyst-v1',
      sensitivityByFamily: Object.fromEntries(CATALYST_FAMILIES.map(
        family => [family, 1])) as Record<
          typeof CATALYST_FAMILIES[number], number> },
    prior: { careerId: episode.careerId,
      playerId: episode.playerId, atDay, domain: 'TECHNICAL',
      receptivity: 1, profileVersion: 'trajectory-v1',
      policyId: 'receptivity-v1', policyVersion: 'v1' },
    appraisal: { sourceEventId: `appraisal-${episodeId}`,
      atDay, salience: 1, learningDisposition: 1,
      novelty: 1, consolidationCapacity: 1 },
    policy: { policyId: 'initiation-v1', version: 'v1',
      availableAtDay: 1, baseChance: initiated ? 1 : 0,
      maximumChance: 1, sameMotifSaturation: 0.5,
      cooldownDays: 30, maximumOpenHypotheses: 2 },
    careerDevelopmentSeed: 1729,
    priorSameMotifAttempts: 0, openHypotheses: 0,
    competingLearningLoad: 0, lastInitiatedDay: null,
  });
};

it('derives saturation, unresolved cap and cooldown from prior episode outcomes', () => {
  const first = resolved('episode-1', 10, true);
  const dismissed = resolved('episode-2', 20, false);
  const history = deriveDevelopmentInitiationHistory(
    candidate('episode-3', 30), 30, [first, dismissed]);
  expect(history).toEqual({ priorSameMotifAttempts: 2,
    openHypotheses: 1, lastInitiatedDay: 10 });
  expect(() => deriveDevelopmentInitiationHistory(
    candidate('episode-3', 30), 30, [first, first]))
    .toThrow('duplicate');
  expect(() => deriveDevelopmentInitiationHistory(
    candidate('episode-3', 30), 30, [
      { ...first, assessment: { ...first.assessment,
        playerId: 'other' } }])).toThrow('history');
});

it('does not count a consolidated episode as an open hypothesis', () => {
  const first = resolved('episode-1', 10, true);
  let episode = first.episode;
  for (const [kind, atDay] of [
    ['HYPOTHESIS_FORMED', 11], ['PRACTICE_RECORDED', 12],
    ['PRACTICE_RECORDED', 13], ['FEEDBACK_RECORDED', 14],
    ['CONSOLIDATION_RECORDED', 15],
  ] as const) {
    episode = appendDevelopmentLearningEvent(episode,
      episode.revision, { eventId: `episode-1:${kind}:${atDay}`,
        sourceEventId: `source-${atDay}`, atDay,
        kind, domain: 'TECHNICAL' });
  }
  const closed = { ...first, episode };
  expect(deriveDevelopmentInitiationHistory(
    candidate('episode-2', 50), 50, [closed]))
    .toEqual({ priorSameMotifAttempts: 1,
      openHypotheses: 0, lastInitiatedDay: 10 });
});
