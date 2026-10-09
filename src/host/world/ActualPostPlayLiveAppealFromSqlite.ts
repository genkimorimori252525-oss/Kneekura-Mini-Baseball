import { createRequire } from 'node:module';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { deriveSamePaCatchReviewNativeSeed } from './SamePlateAppearanceCatchReviewFromSqlite';
import { readSamePaFieldRuleEvidenceWithInputsFromSqlite } from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import { readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { PostPlayReviewDb, PostPlayReviewNativeScope } from './ActualPostPlayReviewNativeScope';
import type { AcceptedActualPostPlayReviewEvent } from './ActualPostPlayReviewSource';
import type { ActualPostPlayReviewProjection, PostPlayLiveAppealImport } from './ActualPostPlayReviewState';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type PostPlayLiveAppealAdmission = Readonly<{
  version: 'actual_post_play_live_appeal_admission_v1'; kind: 'live_appeal_import';
  gameId: string; playId: number; physicalPitchSourceId: string;
  sourceId: string; sourceHash: string; originalSeedHash: string;
  liveAppealImport: PostPlayLiveAppealImport;
}>;
const pending = (reason: string) => freeze({ kind: 'intent_pending' as const, reason });

/** Import a historical execution, never execute a new appeal after PlayEnd.
 * Both the receipt and its independently owned end are replayed in the Native
 * session proof bracket. The receipt cannot provide its own PlayEnd or rights. */
export const capturePostPlayLiveAppeal = (db: PostPlayReviewDb, scope: PostPlayReviewNativeScope,
  previous: ActualPostPlayReviewProjection, source: AcceptedActualPostPlayReviewEvent, current: boolean) => {
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  if (!(db instanceof Native) || !db.isTransaction) throw new Error('live appeal import requires the Native read transaction');
  if (source.action.kind !== 'import_live_appeal') throw new Error('original live appeal import action differs');
  const reserved = previous.source.reservedCatchSeed;
  if (!reserved) return pending('original_live_appeal_independent_play_end_owner_required');
  const original = deriveSamePaCatchReviewNativeSeed(db, reserved, current);
  if (json(original.seed) !== json(previous.seed) || json(original.scope) !== json(scope))
    throw new Error('live appeal original end, ledger or scope differs');
  const pair = readSamePaFieldRuleEvidenceWithInputsFromSqlite(db, reserved.viewReference, current ? 'current' : 'historical');
  if (pair.kind !== 'same_pa_field_rule_read_pair_v1') return pending('original_live_appeal_owned_end_prefix_required');
  const { actor, fields, value, view } = pair, root = fields[0], last = fields.at(-1);
  if (root?.kind !== 'same_pa_physical_field_root_v1' || !last
    || json(actor.match) !== json(scope.originalMatch) || json(value.physicalOperationReference) !== json(reserved.physicalOperationReference)
    || json(root.lineage) !== json(view.lineage)) throw new Error('live appeal original root or end prefix differs');

  const executionReference = source.action.executionReference;
  const proof = readSamePaPhysicalOperationFromSqlite(db, executionReference), receipt = proof.record;
  if (receipt.kind !== 'same_pa_physical_field_step_v1' || receipt.actionResult?.kind !== 'appeal_contact_v1'
    || receipt.source.action?.kind !== 'appeal_contact_v1') throw new Error('original live appeal execution receipt required');
  if (json(receipt.source.action.indicationReference) !== json(receipt.actionResult.indicationReference)
    || json(receipt.source.action.throwPlanReference) !== json(receipt.actionResult.throwPlanReference))
    throw new Error('live appeal original execution references differ');
  if (json(proof.actor) !== json(actor) || json(proof.lineage) !== json(view.lineage)
    || json(proof.physicalPitchReference) !== json(value.physicalPitchReference)
    || proof.lineage.careerId !== scope.careerId || proof.lineage.gameId !== scope.gameId || proof.lineage.playId !== scope.playId
    || receipt.physicalPitchSourceId !== scope.physicalPitchSourceId
    || json(receipt.source.fieldRootReference) !== json(reference('pa_physical_v1_field_roots', root)))
    throw new Error('live appeal original scope, root or participants differ');
  const index = fields.findIndex(f => json(reference(f.kind === 'same_pa_physical_field_root_v1'
    ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f)) === json(executionReference));
  const predecessor = fields[index - 1];
  if (index < 1 || !predecessor || json(fields[index]) !== json(receipt))
    throw new Error('live appeal execution is outside the independently owned end prefix');
  const predecessorReference = reference(predecessor.kind === 'same_pa_physical_field_root_v1'
    ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', predecessor);
  if (json(receipt.source.previousFieldReference) !== json(predecessorReference)
    || json(receipt.source.previousOperationReference) !== json(predecessorReference)
    || receipt.evaluationTick !== predecessor.evaluationTick || json(receipt.field) !== json(predecessor.field))
    throw new Error('live appeal receipt must preserve its original physical contact frame');

  const result = receipt.actionResult, execution = result.execution;
  if (execution.kind === 'pending') return pending(execution.reason);
  const at = execution.moment, end = previous.seed.exactEnd, clock = previous.cursor;
  const horizon = receipt.field.motion.world.moment;
  if (at.originTick !== end.originTick || at.originTick !== clock.originTick
    || at.tick !== receipt.evaluationTick || at.elapsedSeconds !== horizon.elapsedSeconds
    || horizon.originTick !== at.originTick || horizon.ball.tick !== at.tick
    || quantizeEventTick(at.originTick, at.elapsedSeconds, clock.ticksPerSecond) !== at.tick
    || at.tick > end.tick || at.elapsedSeconds > end.elapsedSeconds
    || fields.some(f => f.evaluationTick > end.tick || f.field.motion.world.moment.elapsedSeconds > end.elapsedSeconds)
    || last.evaluationTick !== end.tick || last.field.motion.world.moment.elapsedSeconds !== end.elapsedSeconds)
    throw new Error('live appeal execution or physical action exceeds its original exact PlayEnd');
  const base = ({ 1: 'first', 2: 'second', 3: 'third' } as const)[execution.attempt.base as 1 | 2 | 3];
  if (!base || actor.match.bases[base] !== execution.attempt.runnerId
    || !actor.defenderBindings.some(b => b.playerId === execution.attempt.defenderId))
    throw new Error('live appeal original occupied runner or defender differs');
  const ownedStep = (ref: SamePaReference<'pa_physical_v1_field_steps'>, kind: 'appeal_indication_v1' | 'throw_plan_v1') => {
    const original = readSamePaPhysicalOperationFromSqlite(db, ref), record = original.record;
    if (record.kind !== 'same_pa_physical_field_step_v1' || record.actionResult?.kind !== kind
      || json(original.lineage) !== json(proof.lineage) || json(original.physicalPitchReference) !== json(proof.physicalPitchReference)
      || json(record.source.fieldRootReference) !== json(receipt.source.fieldRootReference)
      || !fields.slice(0, index).some(f => json(f) === json(record)))
      throw new Error('live appeal original indication or throw plan is outside the owned prefix');
    return { record, reference: { ...ref, sourceVersion: record.source.sourceVersion } };
  };
  const indication = ownedStep(result.indicationReference, 'appeal_indication_v1');
  const throwPlan = ownedStep(result.throwPlanReference, 'throw_plan_v1');
  const indicated = indication.record.actionResult, plan = throwPlan.record.actionResult;
  if (indicated?.kind !== 'appeal_indication_v1' || plan?.kind !== 'throw_plan_v1'
    || indication.record.source.action?.kind !== 'appeal_indication_v1' || throwPlan.record.source.action?.kind !== 'throw_plan_v1'
    || indicated.defenderId !== execution.attempt.defenderId || indicated.runnerId !== execution.attempt.runnerId
    || indicated.base !== base || indicated.contact !== execution.contact.kind
    || json(indicated.indicatedAt) !== json(execution.indicatedAt)
    || execution.indicatedAt.originTick !== at.originTick || execution.indicatedAt.elapsedSeconds > at.elapsedSeconds
    || quantizeEventTick(at.originTick, execution.indicatedAt.elapsedSeconds, clock.ticksPerSecond) !== execution.indicatedAt.tick
    || throwPlan.record.operationOrdinal <= indication.record.operationOrdinal
    || json(plan.appealIndicationReference) !== json(result.indicationReference)
    || json(throwPlan.record.source.action.appealIndicationReference) !== json(result.indicationReference))
    throw new Error('live appeal original indication, throw purpose or execution target differs');
  const liveAppealImport: PostPlayLiveAppealImport = { attempt: execution.attempt, complianceEvidence: execution.complianceEvidence,
    provenance: { version: 'owned_live_appeal_import_v1', playId: scope.playId, gameId: scope.gameId,
      physicalPitchSourceId: scope.physicalPitchSourceId, clock: { originTick: clock.originTick, ticksPerSecond: clock.ticksPerSecond },
      indicatedAtElapsedSeconds: execution.indicatedAt.elapsedSeconds, executedAtElapsedSeconds: at.elapsedSeconds,
      importedAtElapsedSeconds: end.elapsedSeconds + clock.offsetTicks / clock.ticksPerSecond,
      indication: indication.reference, throwPlan: throwPlan.reference,
      execution: { ...executionReference, sourceVersion: receipt.source.sourceVersion } }, rights: execution.rights };
  const evidence: PostPlayLiveAppealAdmission = { version: 'actual_post_play_live_appeal_admission_v1', kind: 'live_appeal_import',
    gameId: scope.gameId, playId: scope.playId, physicalPitchSourceId: scope.physicalPitchSourceId,
    sourceId: source.sourceId, sourceHash: hash(source), originalSeedHash: previous.seed.snapshotHash, liveAppealImport };
  return freeze({ kind: 'admitted' as const, evidence });
};
