import type { TraitResult } from '../TraitTypes';
import { attempt } from '../TraitValidation';
import { readClassification } from './TwoStrikeValidation';
import type { TwoStrikeClassification } from './TwoStrikeTypes';

/** Numerical recognition only: never writes technique, outcome, or an execution penalty. */
export function classifyTwoStrikeWeakness(input: unknown): TraitResult<TwoStrikeClassification> {
  return attempt(() => {
    const q = readClassification(input), m = q.model;
    const observations = q.observations.filter(o => q.time.day - o.time.day < m.windowDays);
    const episodes = new Map<string, { failed: boolean; extreme: boolean }>();
    for (const o of observations) {
      const old = episodes.get(o.episodeId) ?? { failed: false, extreme: false };
      episodes.set(o.episodeId, {
        failed: old.failed || o.recognitionErrorTicks >= m.redRecognitionTicks || o.adjustmentErrorM >= m.redAdjustmentM,
        extreme: old.extreme || o.recognitionErrorTicks >= m.extremeRecognitionTicks || o.adjustmentErrorM >= m.extremeAdjustmentM,
      });
    }
    const failedEpisodes = [...episodes.values()].filter(x => x.failed).length;
    const extremeEpisodes = [...episodes.values()].filter(x => x.extreme).length;
    const spanDays = observations.length ? observations[observations.length - 1]!.time.day - observations[0]!.time.day : 0;
    const failedFraction = episodes.size ? failedEpisodes / episodes.size : 0;
    const extremeFraction = episodes.size ? extremeEpisodes / episodes.size : 0;
    const common = { boundary: 'TWO_STRIKE_RECOGNITION_ONLY' as const, algorithmVersion: 'two-strike-residual-incidence-v1' as const,
      familyId: 'two_strike_weakness' as const, lifecycleClass: 'CAUSAL_NEGATIVE_DYNAMIC' as const, request: q,
      metrics: { samples: observations.length, episodes: episodes.size, spanDays, failedEpisodes, extremeEpisodes, failedFraction, extremeFraction } };
    const reasons: ('STALE_SOURCE' | 'INSUFFICIENT_EVIDENCE' | 'INSUFFICIENT_FAILURE_EVIDENCE')[] = [];
    if (q.time.day - q.source.time.day > m.maximumSourceAgeDays) reasons.push('STALE_SOURCE');
    if (episodes.size < m.minimumEpisodes || spanDays < m.minimumDays) reasons.push('INSUFFICIENT_EVIDENCE');
    if (failedFraction >= m.redEpisodeFraction && failedEpisodes < m.minimumFailedEpisodes) reasons.push('INSUFFICIENT_FAILURE_EVIDENCE');
    if (reasons.length) return { ...common, status: 'UNAVAILABLE' as const, stateId: null, reasons };
    const extreme = extremeEpisodes >= m.minimumExtremeEpisodes && extremeFraction >= m.extremeEpisodeFraction;
    const red = failedEpisodes >= m.minimumFailedEpisodes && failedFraction >= m.redEpisodeFraction;
    return { ...common, status: 'READY' as const, stateId: extreme ? 'RED_EXTREME' : red ? 'RED' : null, reasons: [] as const };
  });
}
