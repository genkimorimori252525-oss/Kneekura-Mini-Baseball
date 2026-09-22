import { getEmotionInfluence, restoreEmotionState } from '../../psychology/index';
import { restoreTraitState } from '../TraitState';
import type { TraitResult } from '../TraitTypes';
import { attempt, fail, obj, same } from '../TraitValidation';
import { classifyTwoStrikeWeakness } from './TwoStrikeWeakness';
import { noLater, readCurrent, readFrame } from './TwoStrikeValidation';
import type { TechniqueReference, TwoStrikeClassification, TwoStrikeInputBundle, TwoStrikeWeaknessView } from './TwoStrikeTypes';

/** References of one source may advance, but identity/revision mappings cannot silently change. */
function checkSuccessor(old: TechniqueReference, current: TechniqueReference, path: string): void {
  if (old.sourceKey !== current.sourceKey || current.revision < old.revision
    || ((old.revision === current.revision) !== (old.snapshotId === current.snapshotId))) fail('SOURCE_CONFLICT', path);
}

/**
 * Assemble one read-only input proposal from the owners' validated current states.
 * This does not execute a swing, authorize an action, write mastery, or sample a result.
 * Technical values remain unchanged; the single emotion channel is not pre-added to them.
 */
export function prepareTwoStrikeInput(input: unknown): TraitResult<TwoStrikeInputBundle> {
  return attempt(() => {
    const r = obj(input, ['frame', 'traits', 'emotion', 'current', 'classificationRequest'], 'input');
    const frame = readFrame(r.frame), current = readCurrent(r.current);
    const tr = restoreTraitState(r.traits);
    if (!tr.ok) fail(tr.reason.code, 'traits.' + tr.reason.path);
    const er = restoreEmotionState(r.emotion);
    if (!er.ok) fail(er.reason.code === 'INVALID_INPUT' ? 'INVALID_INPUT' : 'INCONSISTENT_STATE', 'emotion.' + er.reason.path);
    const traits = tr.value, emotion = er.value;
    if (!same(frame.scope, traits.scope) || !same(frame.scope, current.source.scope)
      || frame.scope.careerId !== emotion.scope.careerId || frame.scope.playerId !== emotion.scope.playerId
      || frame.matchId !== emotion.scope.matchId) fail('SCOPE_MISMATCH', 'input.scope');
    if (frame.expectedTraitRevision !== traits.revision || frame.expectedEmotionRevision !== emotion.revision)
      fail('STALE_REVISION', 'frame.expectedRevisions');
    const currentRef = { sourceKey: current.source.sourceKey, revision: current.source.revision, snapshotId: current.source.snapshotId };
    if (!same(frame.currentSource, currentRef)) fail('SOURCE_CONFLICT', 'frame.currentSource');
    if (!noLater(current.source.time, frame.time) || (traits.time && !noLater(traits.time, frame.time)))
      fail('BACKDATED_EVALUATION', 'frame.time');
    const a = emotion.lastAppraisal;
    if (a) {
      if (a.contextId !== frame.contextId || a.sourceSnapshotId !== frame.emotionSourceSnapshotId)
        fail('SOURCE_CONFLICT', 'frame.emotionSource');
      if (a.time.tick > frame.emotionTime.tick || (a.time.tick === frame.emotionTime.tick && a.time.sequence > frame.emotionTime.sequence))
        fail('BACKDATED_EVALUATION', 'frame.emotionTime');
    }
    const influence = getEmotionInfluence(emotion);
    if (!influence.ok) fail('INCONSISTENT_STATE', 'emotion.' + influence.reason.path);
    const learnedTechniques = current.techniques.map(t => {
      const entry = traits.entries.find(e => e.familyId === t.familyId);
      for (const known of [entry?.lastEvaluation, entry?.masteryProof]) if (known) {
        checkSuccessor({ sourceKey: known.source.sourceKey, revision: known.source.sourceRevision, snapshotId: known.source.sourceSnapshotId }, t.source, 'current.techniques.' + t.familyId);
      }
      return { familyId: t.familyId, acquired: entry?.masteryProof !== null && entry?.masteryProof !== undefined,
        masteryProof: entry?.masteryProof ?? null, feasible: t.feasible, currentSource: t.source };
    });
    let classification: TwoStrikeClassification | null = null;
    const invalid: TwoStrikeWeaknessView['reasons'][number][] = [];
    if (r.classificationRequest !== null) {
      const cr = classifyTwoStrikeWeakness(r.classificationRequest);
      if (!cr.ok) fail(cr.reason.code, cr.reason.path);
      classification = cr.value;
      const q = classification.request;
      if (!same(frame.scope, q.scope)) fail('SCOPE_MISMATCH', 'classification.scope');
      if (!noLater(q.time, frame.time)) fail('BACKDATED_EVALUATION', 'classification.time');
      checkSuccessor(q.source, current.source, 'classification.source');
      if (!noLater(q.source.time, current.source.time)) fail('SOURCE_CONFLICT', 'classification.source.time');
      if (q.source.revision === current.source.revision && !same(q.source, current.source)) fail('SOURCE_CONFLICT', 'classification.source');
      if (!same(q.source, current.source)) invalid.push('SOURCE_CHANGED');
      if (q.model.modelId !== frame.recognitionModel.modelId || q.model.version !== frame.recognitionModel.version) invalid.push('MODEL_CHANGED');
      if (q.time.day !== frame.time.day || q.time.season !== frame.time.season) invalid.push('ASSESSMENT_EXPIRED');
      if (classification.status === 'UNAVAILABLE') invalid.push(...classification.reasons);
    }
    const weakness: TwoStrikeWeaknessView = frame.strikes !== 2
      ? { status: 'OUT_OF_CONTEXT', stateId: null, reasons: [], classification }
      : classification === null ? { status: 'UNASSESSED', stateId: null, reasons: [], classification: null }
        : invalid.length ? { status: 'UNAVAILABLE', stateId: null, reasons: invalid, classification }
          : { status: 'READY', stateId: classification.stateId, reasons: [], classification };
    return { boundary: 'TWO_STRIKE_INPUT_ONLY', frame, technical: frame.strikes === 2 ? current : null,
      learnedTechniques, weakness, emotion: influence.value };
  });
}
