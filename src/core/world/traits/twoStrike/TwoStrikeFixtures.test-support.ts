import assert from 'node:assert/strict';
import { createTraitState, evaluateTrait } from '../index';
import { createEmotionState, evaluateEmotion } from '../../psychology/index';
import { EMOTIONS } from '../../psychology/EmotionTypes';
import type { TraitResult } from '../TraitTypes';
import type { EmotionState } from '../../psychology/EmotionTypes';
import type { TwoStrikeClassificationRequest, TwoStrikeInputRequest, CurrentTwoStrikeTechnique } from './TwoStrikeTypes';
export const scope = { careerId: 'career', playerId: 'player' };
export function value<T>(r: Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; reason: { code: string; path: string } }>): T {
  assert.equal(r.ok, true, JSON.stringify(r)); if (!r.ok) throw new Error('unexpected rejection'); return r.value;
}
export function code(r: TraitResult<unknown>, expected: string): void {
  assert.equal(r.ok, false); if (!r.ok) assert.equal(r.reason.code, expected);
}
export type Mutable<T> = T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
export const mutable = <T>(x: T): Mutable<T> => structuredClone(x) as Mutable<T>;
export function current(): Mutable<CurrentTwoStrikeTechnique> {
  return { source: { ...scopeRef(), time: { season: 1, day: 12, sequence: 0 },
    owner: 'TWO_STRIKE_TECHNIQUE', effectBasis: 'TECHNICAL_ONLY', scope: { ...scope } },
    recognitionDelayTicks: 3, adjustmentSpreadM: 0.02,
    techniques: ['cut_contact','two_strike_adjustment'].map(f => ({ familyId: f as 'cut_contact'|'two_strike_adjustment',
      source: { sourceKey: 'skill/' + f, revision: 3, snapshotId: 'current/' + f }, feasible: true })) };
}
function scopeRef() { return { sourceKey: 'baseline', revision: 5, snapshotId: 'baseline/5' }; }
export function request(): Mutable<TwoStrikeClassificationRequest> {
  return { classificationId: 'classification', scope: { ...scope }, time: { season: 1, day: 12, sequence: 1 }, source: current().source,
    model: { modelId: 'synthetic-only', version: '1', minimumEpisodes: 3, minimumDays: 2, windowDays: 10,
      maximumSourceAgeDays: 1, redRecognitionTicks: 5, extremeRecognitionTicks: 10,
      redAdjustmentM: 0.05, extremeAdjustmentM: 0.1, redEpisodeFraction: 0.5, extremeEpisodeFraction: 0.75,
      minimumFailedEpisodes: 2, minimumExtremeEpisodes: 3 },
    observations: [9,10,11,12].map((day, i) => ({ scope: { ...scope }, episodeId: 'ab/' + i,
      eventId: 'pitch/' + i, time: { season: 1, day, sequence: 0 }, strikes: 2,
      recognitionErrorTicks: 0, adjustmentErrorM: 0 })) };
}
export function input(acquired = true): Mutable<TwoStrikeInputRequest> {
  let traits = value(createTraitState({ scope, policy: { policyId: 'mastery-fixture', version: '1', green: [],
    learned: ['cut_contact','two_strike_adjustment'].map(familyId => ({ familyId, tiers: [
      { stateId: 'LEARNED', minimumRepetitions: 10, minimumPracticeDays: 3, minimumDistinctiveness: 0.8 }] })) } }));
  if (acquired) for (const familyId of ['cut_contact','two_strike_adjustment']) {
    traits = value(evaluateTrait(traits, { scope, policyRef: { policyId: 'mastery-fixture', version: '1' },
      evaluationId: 'learned/' + familyId, expectedRevision: traits.revision, time: { season: 1, day: traits.revision + 1, sequence: 0 }, familyId,
      source: { sourceKey: 'skill/' + familyId, sourceRevision: 1, sourceSnapshotId: 'proof/' + familyId,
        evidenceRevision: 1, episodeId: 'practice/' + familyId, eventIds: ['training/' + familyId], changeKind: 'BOTH' },
      assessment: { kind: 'LEARNED_TECHNIQUE', stateId: 'LEARNED', stage: 'CONSOLIDATED', relevantRepetitions: 20, practiceDays: 5, distinctiveness: 0.9 } })).state;
  }
  const e = createEmotionState({ scope: { ...scope, matchId: 'match' }, policy: { policyId: 'emotion-fixture', version: '1', clearAfterCalmEvents: 2,
    thresholds: EMOTIONS.map(emotion => ({ emotion, activation: 0.6, sustain: 0.3 })) } });
  assert.equal(e.ok, true); if (!e.ok) throw new Error('bad emotion fixture');
  return mutable({ frame: { scope, matchId: 'match', decisionId: 'decision', contextId: 'context', worldRevision: 100,
    time: { season: 1, day: 12, sequence: 2 }, emotionTime: { tick: 100, sequence: 1 }, strikes: 2,
    expectedTraitRevision: traits.revision, expectedEmotionRevision: 0, currentSource: scopeRef(),
    emotionSourceSnapshotId: 'appraisal-sources/100', recognitionModel: { modelId: 'synthetic-only', version: '1' } },
    traits, emotion: e.value, current: current(), classificationRequest: request() });
}
export function withEmotion(r: Mutable<TwoStrikeInputRequest>, active = true): void {
  const result = evaluateEmotion(r.emotion, { scope: r.emotion.scope, policyRef: { policyId: 'emotion-fixture', version: '1' },
    appraisalId: 'appraisal', contextId: r.frame.contextId, appraisalModelVersion: 'test1', sourceSnapshotId: r.frame.emotionSourceSnapshotId,
    evidenceEventIds: ['pressure-event'], expectedRevision: 0, time: { tick: 100, sequence: 0 },
    candidates: EMOTIONS.map((emotion, i) => ({ emotion, candidateId: 'candidate/' + emotion,
      pressure: active && i === 2 ? 0.9 : 0.1, behavioralImpact: active && i === 2 ? 0.7 : 0,
      effects: { swingDecisionShiftTicks: active && i === 2 ? 2 : 0, throwIntentShiftTicks: 0, defenseReplanShiftTicks: 0,
        swingAggressionDelta: 0, throwAggressionDelta: 0, runningRiskDelta: 0 } })) });
  assert.equal(result.ok, true); if (!result.ok) throw new Error('emotion rejected');
  r.emotion = mutable(result.state as EmotionState); r.frame.expectedEmotionRevision = result.state.revision;
}
