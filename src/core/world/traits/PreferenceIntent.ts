import type { ActionWeight, PreferenceIntent, TraitResult } from './TraitTypes';
import { attempt, obj, record, text, list, fraction, bool, family, readScope, fail, order, oneOf } from './TraitValidation';

function weights(input: unknown, legal: readonly string[], path: string): ActionWeight[] {
  const values = list(input, (v, p) => {
    const r = obj(v, ['actionId', 'weight'], p);
    return { actionId: text(r.actionId, p + '.actionId'), weight: fraction(r.weight, p + '.weight') };
  }, path).sort((a, b) => order(a.actionId, b.actionId));
  if (new Set(values.map(x => x.actionId)).size !== values.length) fail('INVALID_INPUT', path);
  if (values.length !== legal.length || values.some(x => !legal.includes(x.actionId))) fail('ILLEGAL_ACTION', path);
  const total = values.reduce((sum, x) => sum + x.weight, 0);
  if (total === 0 || !Number.isFinite(total)) fail('INVALID_INPUT', path);
  return values.map(x => ({ actionId: x.actionId, weight: x.weight / total }));
}

/** Numeric intent arbitration. Does not execute, sample an outcome, or mutate a stored preference. */
export const resolvePreferenceIntent = (input: unknown): TraitResult<PreferenceIntent> => attempt(() => {
  const r = obj(input, ['scope', 'familyId', 'decisionId', 'contextId', 'sourceSnapshotId', 'legalActionIds', 'playerWeights', 'directive'], 'intent');
  const f = family(r.familyId, 'intent.familyId');
  if (f.lifecycleClass !== 'GREEN_SLOW_PREFERENCE') fail('INVALID_INPUT', 'intent.familyId');
  const legal = list(r.legalActionIds, text, 'intent.legalActionIds').sort(order);
  if (!legal.length || new Set(legal).size !== legal.length) fail('INVALID_INPUT', 'intent.legalActionIds');
  const player = weights(r.playerWeights, legal, 'intent.playerWeights');
  const d = record(r.directive, 'intent.directive');
  const kind = oneOf(d.kind, ['NONE', 'SOFT', 'HARD'], 'intent.directive.kind');
  let selected = player, mode: PreferenceIntent['mode'] = 'PLAYER_DEFAULT', hardActionId: string | null = null;
  if (kind === 'NONE') obj(d, ['kind'], 'intent.directive');
  else {
    obj(d, kind === 'HARD' ? ['kind', 'understood', 'accepted', 'actionId'] : ['kind', 'understood', 'accepted', 'managerInfluence', 'weights'], 'intent.directive');
    const understood = bool(d.understood, 'intent.directive.understood');
    const accepted = bool(d.accepted, 'intent.directive.accepted');
    if (kind === 'HARD') {
      hardActionId = text(d.actionId, 'intent.directive.actionId');
      if (!legal.includes(hardActionId)) fail('ILLEGAL_ACTION', 'intent.directive.actionId');
      selected = legal.map(actionId => ({ actionId, weight: actionId === hardActionId ? 1 : 0 })); mode = 'HARD_COMMAND';
    } else {
      const influence = fraction(d.managerInfluence, 'intent.directive.managerInfluence');
      const manager = weights(d.weights, legal, 'intent.directive.weights');
      selected = player.map((x, i) => ({ actionId: x.actionId, weight: (1 - influence) * x.weight + influence * manager[i]!.weight }));
      mode = 'SOFT_BLEND';
    }
    if (!understood || !accepted) fail('COMMAND_NOT_ACCEPTED', 'intent.directive');
  }
  return { boundary: 'PREFERENCE_INTENT_ONLY', scope: readScope(r.scope, 'intent.scope'), familyId: f.familyId,
    decisionId: text(r.decisionId, 'intent.decisionId'), contextId: text(r.contextId, 'intent.contextId'),
    sourceSnapshotId: text(r.sourceSnapshotId, 'intent.sourceSnapshotId'), mode, hardActionId, weights: selected };
});
