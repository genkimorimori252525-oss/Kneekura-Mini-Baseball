import { expect, it } from 'vitest';
import { appendDevelopmentLearningEvent } from '../development/DevelopmentLearningEpisode';
import { assessDevelopmentEpisodeInitiation } from '../development/DevelopmentEpisodeInitiation';
import { projectSpinControlMasteryV123, SPIN_TECHNIQUES_V123 } from './SpinControlMasteryV123';
import { SPIN_COHORT_AUTHOR_POLICY_V132, SPIN_COHORT_BOUNDARY_V132, spinCohortRecordV132, replaySpinCohortRecordV132,
  startSpinCohortV132, advanceSpinCohortV132, type SpinCohortCheckpointV132 } from './SpinLongCohortProtocolV132.test-support';

const saved = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

it('re-reads independent three/four-technique authored event histories as one Gold without unlocking absent techniques', () => {
  // Guaranteed initiation is a named positive control, not a rarity estimate.
  const four = saved(spinCohortRecordV132(1729, 0, 0, 'TRAINED', true));
  expect(four.boundary).toBe(SPIN_COHORT_BOUNDARY_V132); expect(four.nativeAdmission).toBe(false);
  expect(four.attempts).toHaveLength(4);
  expect(new Set(four.attempts.map(a => a.episode.episodeId)).size).toBe(4);
  expect(new Set(four.attempts.map(a => a.proof.sourceId)).size).toBe(4);
  expect(new Set(four.attempts.map(a => a.proof.calibration.sourceId)).size).toBe(4);
  expect(new Set(four.attempts.flatMap(a => a.episode.practiceSourceEventIds)).size).toBe(12);
  expect(replaySpinCohortRecordV132(four, four.attempts[0].proof.acceptedAtDay - 1).masteredTechniqueSet).toEqual([]);
  expect(replaySpinCohortRecordV132(four, four.attempts[0].proof.acceptedAtDay).masteredTechniqueSet).toEqual(['SLICE']);
  expect(replaySpinCohortRecordV132(four, four.attempts[2].proof.acceptedAtDay).masteredTechniqueSet).toEqual(SPIN_TECHNIQUES_V123.slice(0, 3));
  for (const count of [3, 4] as const) {
    const record = saved(spinCohortRecordV132(1729, 0, 0, 'TRAINED', true, count));
    const projection = replaySpinCohortRecordV132(record);
    expect(projection).toMatchObject({ nativeAdmission: false, effectiveStateId: 'GOLD', masteredTechniqueSet: SPIN_TECHNIQUES_V123.slice(0, count) });
    expect(projection.qualified).toHaveLength(count);
    expect(replaySpinCohortRecordV132(saved(record), record.atDay, true)).toEqual(projection);
    const aged = replaySpinCohortRecordV132(saved(record), 300 * 365);
    expect(aged.masteredTechniqueSet).toEqual(projection.masteredTechniqueSet);
    expect(aged.qualified).toEqual(projection.qualified);
  }
});

it('calendar length, age metadata, missing stimulus/consolidation/opportunity and unverified calibration never create mastery', () => {
  const noStimulus = saved(spinCohortRecordV132(1729, 0, 1, 'UNSTIMULATED'));
  expect(noStimulus.attempts).toEqual([]);
  for (const years of [100, 300]) {
    const aged = { ...noStimulus, ageYears: noStimulus.ageYears + years };
    expect(replaySpinCohortRecordV132(aged, years * 365)).toMatchObject({ effectiveStateId: 'NONE', masteredTechniqueSet: [] });
  }
  for (const scenario of ['UNCONSOLIDATED', 'NO_OPPORTUNITY', 'UNVERIFIED_CALIBRATION'] as const) {
    const record = saved(spinCohortRecordV132(1730, 0, 2, scenario, true));
    expect(replaySpinCohortRecordV132(record)).toMatchObject({ effectiveStateId: 'NONE', masteredTechniqueSet: [] });
    expect(record.projection.rejected.length).toBeGreaterThan(0);
  }
});

it('reprocesses each episode draw/event deterministically and isolates aliased evidence from independent techniques', () => {
  const record = saved(spinCohortRecordV132(1729, 0, 0, 'TRAINED', true));
  for (const attempt of record.attempts) {
    expect(assessDevelopmentEpisodeInitiation(attempt.request)).toEqual(attempt.assessment);
    expect(attempt.assessment.drawCount).toBe(1);
    const duplicate = attempt.episode.events.find(event => event.kind === 'PRACTICE_RECORDED')!;
    expect(() => appendDevelopmentLearningEvent(attempt.episode, attempt.episode.revision, duplicate)).toThrow(/duplicate/);
  }
  const proofs = record.attempts.map(a => a.proof);
  const aliased = proofs.map((proof, index) => index === 1 ? { ...proof, sourceEffectIdentity: proofs[0].sourceEffectIdentity } : proof);
  const result = projectSpinControlMasteryV123({ scope: record.scope, atDay: record.atDay,
    policy: SPIN_COHORT_AUTHOR_POLICY_V132.mastery, proofs: aliased });
  expect(result.masteredTechniqueSet).toEqual(SPIN_TECHNIQUES_V123.slice(2));
  expect(result.rejected).toHaveLength(2); expect(result.rejected.every(r => r.reason === 'ALIASED_SOURCE')).toBe(true);
});

it('keeps a bounded 100-calendar-year multi-seed entrant protocol identical after a JSON checkpoint restart', () => {
  const initial = startSpinCohortV132({ years: 100, seeds: [1729, 1730], personsPerYear: 2 });
  const uninterrupted = advanceSpinCohortV132(initial, 100);
  const checkpoint = saved(advanceSpinCohortV132(initial, 37));
  expect(advanceSpinCohortV132(checkpoint, 100)).toEqual(uninterrupted);
  expect(initial.nextYear).toBe(0); expect(uninterrupted.persons).toBe(400);
  expect(uninterrupted.episodes).toBe(1280); // 4 independent attempts for 4/5 authored scenarios.
  expect(uninterrupted.kinds.reduce((sum, count) => sum + count, 0)).toBe(400);
  expect(uninterrupted.sample.length).toBeLessThanOrEqual(8);
  expect(Object.keys(uninterrupted.combinations).length).toBeLessThanOrEqual(15);
  expect(uninterrupted).toMatchObject({ nativeAdmission: false, measuredHumanRate: false,
    topPerformerGoldConcentration: 'NOT_CONNECTED_NO_PERFORMANCE_OWNER' });
  // No Gold/4-kind frequency target: these fixture coefficients are uncalibrated.
  console.info('SPIN_AUTHOR_PROTOCOL_100', JSON.stringify({ syntheticPolicy: SPIN_COHORT_AUTHOR_POLICY_V132, result: uninterrupted }));
}, 30_000);

const diagnostic300 = process.env.BASEBALL_SPIN_COHORT_300_YEARS === '1' ? it : it.skip;
diagnostic300('diagnostic: streams 300 authored calendar cohorts with bounded checkpoint/report output', () => {
  let checkpoint = startSpinCohortV132({ years: 300, seeds: [1729, 1730, 1731], personsPerYear: 2 });
  for (const year of [100, 200, 300]) checkpoint = saved(advanceSpinCohortV132(checkpoint, year));
  expect(checkpoint.persons).toBe(1800);
  expect(checkpoint.sample.length).toBeLessThanOrEqual(8);
  const reread: SpinCohortCheckpointV132 = saved(checkpoint);
  expect(advanceSpinCohortV132(reread, 300)).toEqual(checkpoint);
  console.info('SPIN_AUTHOR_PROTOCOL_300_UNCALIBRATED', JSON.stringify({ syntheticPolicy: SPIN_COHORT_AUTHOR_POLICY_V132, result: checkpoint }));
}, 60_000);

