import type { TraitTime } from '../TraitTypes';
import { bool, fail, fraction, integer, list, obj, oneOf, order, readScope, readTime, same, text, timeAfter, unique } from '../TraitValidation';
import type { CurrentTwoStrikeTechnique, TechniqueReference, TwoStrikeClassificationRequest,
  TwoStrikeFrame, TwoStrikeModel, TwoStrikeSnapshot } from './TwoStrikeTypes';

export const TECHNIQUES = ['cut_contact', 'two_strike_adjustment'] as const;
export function nonnegative(input: unknown, path: string, strictlyPositive = false): number {
  if (typeof input !== 'number' || !Number.isFinite(input) || input < 0 || (strictlyPositive && input === 0)) fail('INVALID_INPUT', path);
  return input === 0 ? 0 : input;
}
export function noLater(a: TraitTime, b: TraitTime): boolean { return same(a, b) || timeAfter(b, a); }
export function reference(input: unknown, path: string): TechniqueReference {
  const r = obj(input, ['sourceKey', 'revision', 'snapshotId'], path);
  return { sourceKey: text(r.sourceKey, path + '.sourceKey'), revision: integer(r.revision, path + '.revision'), snapshotId: text(r.snapshotId, path + '.snapshotId') };
}
export function snapshot(input: unknown, path: string): TwoStrikeSnapshot {
  const r = obj(input, ['sourceKey', 'revision', 'snapshotId', 'scope', 'time', 'owner', 'effectBasis'], path);
  const ref = reference({ sourceKey: r.sourceKey, revision: r.revision, snapshotId: r.snapshotId }, path);
  return { ...ref, scope: readScope(r.scope, path + '.scope'), time: readTime(r.time, path + '.time'),
    owner: oneOf(r.owner, ['TWO_STRIKE_TECHNIQUE'], path + '.owner'), effectBasis: oneOf(r.effectBasis, ['TECHNICAL_ONLY'], path + '.effectBasis') };
}
function model(input: unknown, path: string): TwoStrikeModel {
  const r = obj(input, ['modelId', 'version', 'minimumEpisodes', 'minimumDays', 'windowDays', 'maximumSourceAgeDays',
    'redRecognitionTicks', 'extremeRecognitionTicks', 'redAdjustmentM', 'extremeAdjustmentM',
    'redEpisodeFraction', 'extremeEpisodeFraction', 'minimumFailedEpisodes', 'minimumExtremeEpisodes'], path);
  const m: TwoStrikeModel = {
    modelId: text(r.modelId, path + '.modelId'), version: text(r.version, path + '.version'),
    minimumEpisodes: integer(r.minimumEpisodes, path + '.minimumEpisodes', 2), minimumDays: integer(r.minimumDays, path + '.minimumDays', 1),
    windowDays: integer(r.windowDays, path + '.windowDays', 1), maximumSourceAgeDays: integer(r.maximumSourceAgeDays, path + '.maximumSourceAgeDays'),
    redRecognitionTicks: integer(r.redRecognitionTicks, path + '.redRecognitionTicks', 1), extremeRecognitionTicks: integer(r.extremeRecognitionTicks, path + '.extremeRecognitionTicks', 1),
    redAdjustmentM: nonnegative(r.redAdjustmentM, path + '.redAdjustmentM', true), extremeAdjustmentM: nonnegative(r.extremeAdjustmentM, path + '.extremeAdjustmentM', true),
    redEpisodeFraction: fraction(r.redEpisodeFraction, path + '.redEpisodeFraction'), extremeEpisodeFraction: fraction(r.extremeEpisodeFraction, path + '.extremeEpisodeFraction'),
    minimumFailedEpisodes: integer(r.minimumFailedEpisodes, path + '.minimumFailedEpisodes', 2), minimumExtremeEpisodes: integer(r.minimumExtremeEpisodes, path + '.minimumExtremeEpisodes', 2),
  };
  if (m.extremeRecognitionTicks <= m.redRecognitionTicks || m.extremeAdjustmentM <= m.redAdjustmentM
    || m.redEpisodeFraction === 0 || m.extremeEpisodeFraction < m.redEpisodeFraction
    || m.minimumExtremeEpisodes < m.minimumFailedEpisodes || m.windowDays <= m.minimumDays) fail('INVALID_INPUT', path);
  return m;
}
export function readClassification(input: unknown): TwoStrikeClassificationRequest {
  const p = 'classification', r = obj(input, ['classificationId', 'scope', 'time', 'source', 'model', 'observations'], p);
  const scope = readScope(r.scope, p + '.scope'), time = readTime(r.time, p + '.time'), source = snapshot(r.source, p + '.source');
  if (!same(scope, source.scope)) fail('SCOPE_MISMATCH', p + '.source.scope');
  if (!noLater(source.time, time)) fail('BACKDATED_EVALUATION', p + '.time');
  const observations = list(r.observations, (v, path) => {
    const o = obj(v, ['scope', 'episodeId', 'eventId', 'time', 'strikes', 'recognitionErrorTicks', 'adjustmentErrorM'], path);
    const s = readScope(o.scope, path + '.scope'), t = readTime(o.time, path + '.time');
    if (!same(scope, s)) fail('SCOPE_MISMATCH', path + '.scope');
    if (!noLater(t, source.time)) fail('BACKDATED_EVALUATION', path + '.time');
    return { scope: s, time: t, episodeId: text(o.episodeId, path + '.episodeId'), eventId: text(o.eventId, path + '.eventId'),
      strikes: oneOf(o.strikes, [2], path + '.strikes'), recognitionErrorTicks: integer(o.recognitionErrorTicks, path + '.recognitionErrorTicks'),
      adjustmentErrorM: nonnegative(o.adjustmentErrorM, path + '.adjustmentErrorM') };
  }, p + '.observations').sort((a, b) => a.time.day - b.time.day || a.time.sequence - b.time.sequence || order(a.eventId, b.eventId));
  unique(observations, o => o.eventId, p + '.observations.eventId');
  unique(observations, o => JSON.stringify([o.time.day, o.time.sequence]), p + '.observations.time');
  for (let i = 1; i < observations.length; i++) if (!timeAfter(observations[i]!.time, observations[i - 1]!.time)) fail('INCONSISTENT_STATE', p + '.observations.time');
  return { classificationId: text(r.classificationId, p + '.classificationId'), scope, time, source, model: model(r.model, p + '.model'), observations };
}
export function readCurrent(input: unknown): CurrentTwoStrikeTechnique {
  const p = 'current', r = obj(input, ['source', 'recognitionDelayTicks', 'adjustmentSpreadM', 'techniques'], p);
  const techniques = list(r.techniques, (v, path) => {
    const t = obj(v, ['familyId', 'source', 'feasible'], path);
    return { familyId: oneOf(t.familyId, TECHNIQUES, path + '.familyId'), source: reference(t.source, path + '.source'), feasible: bool(t.feasible, path + '.feasible') };
  }, p + '.techniques').sort((a, b) => order(a.familyId, b.familyId));
  unique(techniques, t => t.familyId, p + '.techniques.familyId');
  unique(techniques, t => t.source.sourceKey, p + '.techniques.sourceKey');
  if (techniques.length !== TECHNIQUES.length) fail('INVALID_INPUT', p + '.techniques');
  return { source: snapshot(r.source, p + '.source'), recognitionDelayTicks: integer(r.recognitionDelayTicks, p + '.recognitionDelayTicks'),
    adjustmentSpreadM: nonnegative(r.adjustmentSpreadM, p + '.adjustmentSpreadM'), techniques };
}
export function readFrame(input: unknown): TwoStrikeFrame {
  const p = 'frame', r = obj(input, ['scope', 'matchId', 'decisionId', 'contextId', 'worldRevision', 'time', 'emotionTime', 'strikes',
    'expectedTraitRevision', 'expectedEmotionRevision', 'currentSource', 'emotionSourceSnapshotId', 'recognitionModel'], p);
  const e = obj(r.emotionTime, ['tick', 'sequence'], p + '.emotionTime'), m = obj(r.recognitionModel, ['modelId', 'version'], p + '.recognitionModel');
  return { scope: readScope(r.scope, p + '.scope'), matchId: text(r.matchId, p + '.matchId'), decisionId: text(r.decisionId, p + '.decisionId'), contextId: text(r.contextId, p + '.contextId'),
    worldRevision: integer(r.worldRevision, p + '.worldRevision'), time: readTime(r.time, p + '.time'),
    emotionTime: { tick: integer(e.tick, p + '.emotionTime.tick'), sequence: integer(e.sequence, p + '.emotionTime.sequence') },
    strikes: oneOf(r.strikes, [0,1,2], p + '.strikes'), expectedTraitRevision: integer(r.expectedTraitRevision, p + '.expectedTraitRevision'),
    expectedEmotionRevision: integer(r.expectedEmotionRevision, p + '.expectedEmotionRevision'), currentSource: reference(r.currentSource, p + '.currentSource'),
    emotionSourceSnapshotId: text(r.emotionSourceSnapshotId, p + '.emotionSourceSnapshotId'),
    recognitionModel: { modelId: text(m.modelId, p + '.recognitionModel.modelId'), version: text(m.version, p + '.recognitionModel.version') } };
}
