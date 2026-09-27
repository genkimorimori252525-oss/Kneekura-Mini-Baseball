import { expect, it } from 'vitest';
import { appraisalInput } from '../psychology/appraisal/AppraisalFixtures.test-support';
import { appraiseEmotion } from '../psychology/appraisal/SourceAppraisal';
import { projectSpotlightAppraisalResponse } from './SpotlightAppraisal';

const request = () => {
  const appraisal = appraisalInput();
  return { importance: appraisal.importance, player: appraisal.player,
    atDay: 10,
    profile: { careerId: 'career', playerId: 'player',
      profileVersion: 'realized-spotlight-v1', effectiveDay: 0,
      activation: 0.9, stability: 0.9, pressureConversion: 0.9 },
    policy: { policyId: 'spotlight-response', version: 'v1',
      availableAtDay: 0, activationScale: 0.4,
      stabilityScale: 0.4, conversionScale: 0.4 },
  } as const;
};

it('projects realized spotlight response into the existing appraisal source', () => {
  const input = request();
  const high = projectSpotlightAppraisalResponse(input);
  const low = projectSpotlightAppraisalResponse({ ...input,
    profile: { ...input.profile, activation: 0.1,
      stability: 0.1, pressureConversion: 0.1 } });
  expect(high.player.response.concentration)
    .toBeGreaterThan(low.player.response.concentration);
  expect(high.player.response.stability)
    .toBeGreaterThan(low.player.response.stability);
  expect(high.player.response.competitiveness)
    .toBeGreaterThan(low.player.response.competitiveness);
  expect(high.player).not.toHaveProperty('ability');
  expect(high.provenance.importanceModelVersion).toBe('test-v1');
  const baseline = appraiseEmotion(appraisalInput());
  const influenced = appraiseEmotion({ ...appraisalInput(),
    player: high.player });
  expect(baseline.ok && influenced.ok).toBe(true);
  if (baseline.ok && influenced.ok) {
    const motivation = (result: typeof baseline.value) =>
      result.appraisal.candidates.find(c => c.emotion === 'MOTIVATION')!;
    expect(motivation(influenced.value).pressure)
      .toBeGreaterThan(motivation(baseline.value).pressure);
  }
});

it('requires same player and available realized profile; no Star label input exists', () => {
  const input = request();
  expect(() => projectSpotlightAppraisalResponse({ ...input,
    profile: { ...input.profile, playerId: 'other' } })).toThrow('scope');
  expect(() => projectSpotlightAppraisalResponse({ ...input,
    profile: { ...input.profile, effectiveDay: 11 } })).toThrow('future');
  expect(() => projectSpotlightAppraisalResponse({ ...input,
    profile: { ...input.profile, activation: 2 } })).toThrow('profile');
  expect(() => projectSpotlightAppraisalResponse({ ...input,
    player: { ...input.player, stamp: { ...input.player.stamp,
      time: { tick: 101, sequence: 0 } } } })).toThrow();
});
