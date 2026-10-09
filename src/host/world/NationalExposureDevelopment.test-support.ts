// Explicit synthetic policy values for tests only; no production calibration.
import { CATALYST_FAMILIES } from '../../core/world/development/DevelopmentCatalyst';
import { CURVE_SHAPES, DEVELOPMENT_DOMAINS, MATURITY_TIMINGS } from '../../core/world/development/DevelopmentTrajectory';
import { STAR_GENESIS_POTENTIALS } from '../../core/world/development/StarGenesis';
import type { PlayerPersonPriorPolicies } from '../../core/world/development/PlayerPersonPriors';
import type { AcceptedDevelopmentPolicies } from './DevelopmentEpisodeFromAcceptedAppraisal';
import type { AcceptedNationalExposureAppraisal } from './NationalExposureDevelopmentOrigin';
export const nationalExposureGenesisPolicies = (): PlayerPersonPriorPolicies => {
  const ranges = <T extends string>(keys: readonly T[], value: number) =>
    Object.fromEntries(keys.map(k => [k, { min: value, max: value }])) as Record<T, { min: number; max: number }>;
  return {
    trajectory: { policyId: 'fixture-trajectory', profileVersion: 'v1', availableAtDay: 10,
      timingWeights: { VERY_EARLY: 0, EARLY: 0, NORMAL: 1, LATE: 0, VERY_LATE: 0 },
      shapeWeights: { SHARP_PEAK: 0, BROAD_PLATEAU: 1, STEPWISE_WAVES: 0 }, domainOffsetRanges: ranges(DEVELOPMENT_DOMAINS, 0) },
    catalyst: { policyId: 'fixture-catalyst', profileVersion: 'v1', availableAtDay: 10,
      sensitivityRanges: ranges(CATALYST_FAMILIES, 1), signatureMotifs: [], signatureMotifCount: 0 },
    star: { policyId: 'fixture-star', profileVersion: 'v1', availableAtDay: 10,
      tierWeights: { ORDINARY: 1, STAR_CANDIDATE: 0, SUPERSTAR_CANDIDATE: 0 }, potentialRanges: {
        ORDINARY: ranges(STAR_GENESIS_POTENTIALS, 0), STAR_CANDIDATE: ranges(STAR_GENESIS_POTENTIALS, 0),
        SUPERSTAR_CANDIDATE: ranges(STAR_GENESIS_POTENTIALS, 0) } },
  };
};
export const nationalExposurePolicies = (chance = 1): AcceptedDevelopmentPolicies => ({ sourceId: `fixture-policy-${chance}`, careerId: 'career-a',
  learning: { policyId: 'learning', version: 'fixture-v1', availableAtDay: 10, minimumPracticeEvents: 2, minimumFeedbackEvents: 1, minimumElapsedDays: 5 },
  receptivity: { policyId: 'receptivity', version: 'fixture-v1', availableAtDay: 10, profileVersion: 'v1',
    templateCurves: Object.fromEntries(MATURITY_TIMINGS.map(t => [t, Object.fromEntries(CURVE_SHAPES.map(s => [s,
      [{ ageYears: 0, receptivity: 1, declinePressure: 0 }, { ageYears: 40, receptivity: 1, declinePressure: 0 }]]))])) as unknown as
        AcceptedDevelopmentPolicies['receptivity']['templateCurves'] },
  initiation: { policyId: 'initiation', version: 'fixture-v1', availableAtDay: 10, baseChance: chance, maximumChance: 1,
    sameMotifSaturation: 0.5, cooldownDays: 30, maximumOpenHypotheses: 2 },
});
export const nationalExposureAppraisal = (playerId: string, atDay: number, suffix = ''): AcceptedNationalExposureAppraisal => ({
  sourceId: `appraisal-${playerId}${suffix}`, sourceVersion: 'fixture-v1', motifId: 'observed-international-pitch-timing',
  episodeId: `episode-${playerId}${suffix}`, careerId: 'career-a', playerId, domain: 'TECHNICAL', ageYears: 20, competingLearningLoad: 0,
  appraisal: { sourceEventId: `personal-response-${playerId}${suffix}`, atDay, salience: 1, learningDisposition: 1, novelty: 1, consolidationCapacity: 1 },
});
