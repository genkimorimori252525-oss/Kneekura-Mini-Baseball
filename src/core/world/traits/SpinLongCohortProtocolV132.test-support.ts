import { createHash } from 'node:crypto';
import { CATALYST_FAMILIES } from '../development/DevelopmentCatalyst';
import { startPracticeDevelopmentLearningEpisode, appendDevelopmentLearningEvent, type DevelopmentLearningEpisode } from '../development/DevelopmentLearningEpisode';
import { assessDevelopmentEpisodeInitiation, resolveDevelopmentEpisodeInitiation, type DevelopmentInitiationRequest } from '../development/DevelopmentEpisodeInitiation';
import { assessDevelopmentPracticeExposure } from '../development/DevelopmentPracticeExposure';
import { practiceBundleForEpisode } from '../development/DevelopmentPracticeExposure.test-support';
import { projectSpinControlMasteryV123, SPIN_TECHNIQUES_V123, type SpinTechniqueV123, type SpinTechniqueQualificationV123 } from './SpinControlMasteryV123';

export const SPIN_COHORT_BOUNDARY_V132 = 'SYNTHETIC_AUTHOR_PROTOCOL_ONLY';
export const SPIN_COHORT_SCENARIOS_V132 = ['TRAINED', 'UNSTIMULATED', 'UNCONSOLIDATED', 'NO_OPPORTUNITY', 'UNVERIFIED_CALIBRATION'] as const;
type Scenario = typeof SPIN_COHORT_SCENARIOS_V132[number];
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const equal = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error('synthetic protocol replay differs'); };
const policy = { policyId: 'synthetic-cohort-mastery-v132', version: 'v1', availableAtDay: 1,
  minimumEffectiveExposure: 0.5, minimumDistinctPracticeDays: 2, minimumDistinctiveness: 0.8 };
export const SPIN_COHORT_AUTHOR_POLICY_V132 = { boundary: SPIN_COHORT_BOUNDARY_V132,
  calibratedRarity: false, defaultFactor: 0.8, baseChance: 0.3, maximumChance: 0.5,
  cooldownDays: 30, maximumOpenHypotheses: 2, sameMotifSaturation: 0.5,
  minimumPracticeEvents: 3, minimumFeedbackEvents: 1, minimumElapsedDays: 7,
  exposureTemplate: 'DevelopmentPracticeExposure.test-support:practiceBundleForEpisode', mastery: policy } as const;
export type SpinCohortAttemptV132 = Readonly<{
  technique: SpinTechniqueV123; request: DevelopmentInitiationRequest;
  assessment: ReturnType<typeof assessDevelopmentEpisodeInitiation>; episode: DevelopmentLearningEpisode;
  proof: SpinTechniqueQualificationV123;
}>;

/** Pure authored protocol. The discovery and practice events below are declared
 * test inputs, never Native physical evidence. MODEL_VERIFIED is an explicit
 * synthetic projection input; no Native calibration/admission is fabricated. */
export function spinCohortRecordV132(seed: number, year: number, personIndex: number, scenario: Scenario,
  guaranteedInitiation = false, techniqueLimit: 3 | 4 = 4) {
  const scope = { careerId: 'synthetic-cohort:' + seed, playerId: `person:${year}:${personIndex}` };
  const id = `${scope.careerId}:${scope.playerId}`, baseDay = year * 365 + 1, atDay = (year + 1) * 365;
  const attempts: SpinCohortAttemptV132[] = [];
  let lastInitiatedDay: number | null = null, openHypotheses = 0;
  if (scenario !== 'UNSTIMULATED') for (const [index, technique] of SPIN_TECHNIQUES_V123.slice(0, techniqueLimit).entries()) {
    const start = baseDay + index * 40, episodeId = id + ':' + technique;
    const initial = startPracticeDevelopmentLearningEpisode(episodeId, { ...scope, occurredAtDay: start,
      sourceEventId: episodeId + ':discovery', causeEventId: episodeId + ':authored-practice-origin', motifId: 'synthetic:' + technique },
    { ...scope, createdAtDay: baseDay, profileVersion: 'synthetic-catalyst-v132' },
    { policyId: 'synthetic-learning-v132', version: 'v1', availableAtDay: 1,
      minimumPracticeEvents: SPIN_COHORT_AUTHOR_POLICY_V132.minimumPracticeEvents,
      minimumFeedbackEvents: SPIN_COHORT_AUTHOR_POLICY_V132.minimumFeedbackEvents,
      minimumElapsedDays: SPIN_COHORT_AUTHOR_POLICY_V132.minimumElapsedDays });
    const factor = guaranteedInitiation ? 1 : SPIN_COHORT_AUTHOR_POLICY_V132.defaultFactor;
    const request: DevelopmentInitiationRequest = { episode: initial,
      catalystProfile: { ...scope, createdAtDay: baseDay, profileVersion: 'synthetic-catalyst-v132',
        sensitivityByFamily: Object.fromEntries(CATALYST_FAMILIES.map(family => [family, factor])) as Record<typeof CATALYST_FAMILIES[number], number> },
      prior: { ...scope, atDay: start, domain: 'TECHNICAL', receptivity: factor, profileVersion: 'synthetic-trajectory-v132', policyId: 'synthetic-receptivity-v132', policyVersion: 'v1' },
      appraisal: { sourceEventId: episodeId + ':appraisal', atDay: start, salience: factor, learningDisposition: factor, novelty: factor, consolidationCapacity: factor },
      // Explicit fixture coefficients, not a calibrated occurrence/rarity law.
      policy: { policyId: guaranteedInitiation ? 'synthetic-guaranteed-positive-control' : 'synthetic-initiation-protocol', version: 'v1', availableAtDay: 1,
        baseChance: guaranteedInitiation ? 1 : SPIN_COHORT_AUTHOR_POLICY_V132.baseChance,
        maximumChance: guaranteedInitiation ? 1 : SPIN_COHORT_AUTHOR_POLICY_V132.maximumChance,
        sameMotifSaturation: SPIN_COHORT_AUTHOR_POLICY_V132.sameMotifSaturation,
        cooldownDays: SPIN_COHORT_AUTHOR_POLICY_V132.cooldownDays,
        maximumOpenHypotheses: SPIN_COHORT_AUTHOR_POLICY_V132.maximumOpenHypotheses },
      careerDevelopmentSeed: seed, priorSameMotifAttempts: 0, openHypotheses, competingLearningLoad: 0, lastInitiatedDay };
    const resolved = resolveDevelopmentEpisodeInitiation(request);
    equal(resolved.assessment, assessDevelopmentEpisodeInitiation(request));
    let episode = resolved.episode;
    if (resolved.assessment.initiated) {
      lastInitiatedDay = start;
      const event = (name: string, kind: 'HYPOTHESIS_FORMED' | 'PRACTICE_RECORDED' | 'FEEDBACK_RECORDED' | 'CONSOLIDATION_RECORDED', offset: number) => {
        episode = appendDevelopmentLearningEvent(episode, episode.revision,
          { eventId: episodeId + ':' + name, sourceEventId: episodeId + ':' + name, atDay: start + offset, kind, domain: 'TECHNICAL' });
      };
      event('hypothesis', 'HYPOTHESIS_FORMED', 1);
      for (let repetition = 0; repetition < 3; repetition++) event('practice-' + repetition, 'PRACTICE_RECORDED', 2 + repetition);
      event('feedback', 'FEEDBACK_RECORDED', 5);
      if (scenario !== 'UNCONSOLIDATED') event('consolidation', 'CONSOLIDATION_RECORDED', 7);
      else openHypotheses++;
    }
    const template = practiceBundleForEpisode(episode), bundle = scenario === 'NO_OPPORTUNITY'
      ? { ...template, repetitions: template.repetitions.map(r => ({ ...r, opportunity: 0 })) } : template;
    const proof: SpinTechniqueQualificationV123 = { technique, sourceId: episodeId + ':qualification', sourceVersion: 'synthetic-author-v132',
      sourceEffectIdentity: episodeId + ':independent-effect', acceptedAtDay: start + 8, episode, bundle, distinctiveness: 0.9,
      repertoireRef: { sourceId: id + ':authored-repertoire', sourceVersion: 'synthetic-v132' },
      calibration: { sourceId: episodeId + ':authored-calibration', sourceVersion: 'synthetic-v132',
        status: scenario === 'UNVERIFIED_CALIBRATION' ? 'UNVERIFIED' : 'MODEL_VERIFIED' } };
    attempts.push({ technique, request, assessment: resolved.assessment, episode, proof });
  }
  const proofs = attempts.map(a => a.proof), projection = projectSpinControlMasteryV123({ scope, atDay, policy, proofs });
  return { boundary: SPIN_COHORT_BOUNDARY_V132, nativeAdmission: false as const, measuredHumanRate: false as const,
    scope, seed, year, personIndex, scenario, atDay, ageYears: 18, attempts, projection };
}
export type SpinCohortRecordV132 = ReturnType<typeof spinCohortRecordV132>;

/** Re-read JSON data through existing initiation/event/exposure/projection
 * functions. This is protocol replay, never a substitute for Native owners. */
export function replaySpinCohortRecordV132(record: SpinCohortRecordV132, atDay = record.atDay, reverse = false) {
  for (const attempt of record.attempts) {
    const resolved = resolveDevelopmentEpisodeInitiation(attempt.request);
    equal(resolved.assessment, attempt.assessment);
    let episode = resolved.episode;
    for (const event of attempt.episode.events.slice(episode.events.length)) episode = appendDevelopmentLearningEvent(episode, episode.revision, event);
    equal(episode, attempt.episode); equal(episode, attempt.proof.episode);
    if (episode.stage === 'CONSOLIDATED') assessDevelopmentPracticeExposure(episode, attempt.proof.bundle);
  }
  const proofs = record.attempts.map(a => a.proof);
  return projectSpinControlMasteryV123({ scope: record.scope, atDay, policy, proofs: reverse ? proofs.reverse() : proofs });
}

export type SpinCohortOptionsV132 = Readonly<{ years: 100 | 300; seeds: readonly number[]; personsPerYear: number }>;
export type SpinCohortCheckpointV132 = {
  boundary: typeof SPIN_COHORT_BOUNDARY_V132; nativeAdmission: false; measuredHumanRate: false;
  options: SpinCohortOptionsV132; nextYear: number; persons: number; episodes: number; initiated: number; gold: number;
  techniques: Record<SpinTechniqueV123, number>; kinds: number[]; combinations: Record<string, number>;
  scenarios: Record<Scenario, number>; digest: string; sample: { scope: SpinCohortRecordV132['scope']; year: number; projectionHash: string }[];
  topPerformerGoldConcentration: 'NOT_CONNECTED_NO_PERFORMANCE_OWNER';
};
export function startSpinCohortV132(options: SpinCohortOptionsV132): SpinCohortCheckpointV132 {
  if (![100, 300].includes(options.years) || options.seeds.length < 2 || options.seeds.length > 4
    || new Set(options.seeds).size !== options.seeds.length || options.seeds.some(seed => !Number.isSafeInteger(seed) || seed <= 0)
    || !Number.isSafeInteger(options.personsPerYear) || options.personsPerYear < 2 || options.personsPerYear > 4) throw Error('invalid bounded synthetic cohort protocol');
  return { boundary: SPIN_COHORT_BOUNDARY_V132, nativeAdmission: false, measuredHumanRate: false, options,
    nextYear: 0, persons: 0, episodes: 0, initiated: 0, gold: 0,
    techniques: { SLICE: 0, HOOK: 0, BACKSPIN: 0, TOPSPIN: 0 }, kinds: [0, 0, 0, 0, 0], combinations: {},
    scenarios: { TRAINED: 0, UNSTIMULATED: 0, UNCONSOLIDATED: 0, NO_OPPORTUNITY: 0, UNVERIFIED_CALIBRATION: 0 },
    digest: sha(['synthetic-spin-cohort-v132', options]), sample: [], topPerformerGoldConcentration: 'NOT_CONNECTED_NO_PERFORMANCE_OWNER' };
}

/** Stream one entrant at a time. Bounded output: fixed histograms, at most 15
 * technique sets and 8 samples. Checkpoint is test protocol JSON, not a Career
 * ledger or completed centuries-long Native incremental checkpoint design. */
export function advanceSpinCohortV132(input: SpinCohortCheckpointV132, throughYear: number): SpinCohortCheckpointV132 {
  const checkpoint = JSON.parse(JSON.stringify(input)) as SpinCohortCheckpointV132;
  if (!Number.isSafeInteger(throughYear) || throughYear < checkpoint.nextYear || throughYear > checkpoint.options.years) throw Error('invalid cohort protocol cursor');
  for (let year = checkpoint.nextYear; year < throughYear; year++) for (const seed of checkpoint.options.seeds) {
    for (let person = 0; person < checkpoint.options.personsPerYear; person++) {
      const scenario = SPIN_COHORT_SCENARIOS_V132[(year + person + seed) % SPIN_COHORT_SCENARIOS_V132.length];
      const record = spinCohortRecordV132(seed, year, person, scenario);
      const saved = JSON.parse(JSON.stringify(record)) as SpinCohortRecordV132;
      const replay = replaySpinCohortRecordV132(saved);
      equal(record.projection, replay);
      checkpoint.persons++; checkpoint.episodes += record.attempts.length;
      checkpoint.initiated += record.attempts.filter(a => a.assessment.initiated).length;
      checkpoint.scenarios[scenario]++; checkpoint.kinds[replay.masteredTechniqueSet.length]++;
      for (const technique of replay.masteredTechniqueSet) checkpoint.techniques[technique]++;
      if (replay.effectiveStateId === 'GOLD') checkpoint.gold++;
      if (replay.masteredTechniqueSet.length) {
        const combination = replay.masteredTechniqueSet.join('+');
        checkpoint.combinations[combination] = (checkpoint.combinations[combination] ?? 0) + 1;
      }
      checkpoint.digest = sha([checkpoint.digest, saved]);
      if (checkpoint.sample.length < 8) checkpoint.sample.push({ scope: saved.scope, year, projectionHash: sha(replay) });
    }
  }
  checkpoint.nextYear = throughYear;
  return checkpoint;
}
