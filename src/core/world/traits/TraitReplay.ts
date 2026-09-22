import type { TraitReceipt, TraitResult, TraitState } from './TraitTypes';
import { readState } from './TraitState';
import { evaluateTrait } from './TraitLifecycle';
import { attempt, obj, oneOf, integer, readEvaluation, family, stateId, list, same, fail } from './TraitValidation';

function receipt(input: unknown, path: string): TraitReceipt {
  const r = obj(input, ['type', 'beforeRevision', 'afterRevision', 'evaluation', 'beforeStateId', 'afterStateId', 'transition', 'diagnostics'], path);
  oneOf(r.type, ['TRAIT_EVALUATION_ACCEPTED'], path + '.type');
  const evaluation = readEvaluation(r.evaluation, path + '.evaluation');
  const f = family(evaluation.familyId, path + '.familyId');
  return { type: 'TRAIT_EVALUATION_ACCEPTED', beforeRevision: integer(r.beforeRevision, path + '.beforeRevision'),
    afterRevision: integer(r.afterRevision, path + '.afterRevision'), evaluation,
    beforeStateId: stateId(r.beforeStateId, f, path + '.beforeStateId'), afterStateId: stateId(r.afterStateId, f, path + '.afterStateId'),
    transition: oneOf(r.transition, ['UNCHANGED', 'ACQUIRED', 'CHANGED', 'REMOVED', 'MASTERY_RETAINED'], path + '.transition'),
    diagnostics: list(r.diagnostics, (v, p) => oneOf(v, ['GREEN_CHURN_CALIBRATION'], p), path + '.diagnostics') };
}

/** Consistency replay, not historical authentication. Global deduplication before a checkpoint stays with the host. */
export const replayTraitEvents = (checkpoint: unknown, input: unknown): TraitResult<TraitState> => attempt(() => {
  let state = readState(checkpoint);
  const events = list(input, receipt, 'events');
  const evaluations = new Set<string>(), episodes = new Set<string>();
  for (const entry of state.entries) {
    for (const e of [entry.lastEvaluation, entry.masteryProof, entry.preferenceProof?.evaluation]) if (e) {
      evaluations.add(e.evaluationId); episodes.add(JSON.stringify([e.familyId, e.source.episodeId]));
    }
  }
  for (let i = 0; i < events.length; i++) {
    const event = events[i]!, e = event.evaluation, episode = JSON.stringify([e.familyId, e.source.episodeId]);
    if (evaluations.has(e.evaluationId) || episodes.has(episode)) fail('DUPLICATE_EVIDENCE', 'events[' + i + ']');
    const result = evaluateTrait(state, e);
    if (!result.ok) fail(result.reason.code, 'events[' + i + '].' + result.reason.path);
    if (!same(result.value.receipt, event)) fail('REPLAY_MISMATCH', 'events[' + i + ']');
    evaluations.add(e.evaluationId); episodes.add(episode); state = result.value.state;
  }
  return state;
});
