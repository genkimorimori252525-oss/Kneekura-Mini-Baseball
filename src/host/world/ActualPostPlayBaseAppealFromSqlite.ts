import { createRequire } from 'node:module';
import { deriveSamePaBaseAppealExecution } from './SamePlateAppearanceBaseAppealExecution';
import { deriveSamePaCatchReviewNativeSeed } from './SamePlateAppearanceCatchReviewFromSqlite';
import { readSamePaFieldRuleEvidenceWithInputsFromSqlite } from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import type { PostPlayReviewDb, PostPlayReviewNativeScope } from './ActualPostPlayReviewNativeScope';
import type { AcceptedActualPostPlayReviewEvent } from './ActualPostPlayReviewSource';
import type { ActualPostPlayReviewProjection, PostPlayBaseAppealExecution } from './ActualPostPlayReviewState';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type PostPlayBaseAppealAdmission = Readonly<{
  version: 'actual_post_play_base_appeal_admission_v1'; kind: 'base_appeal';
  gameId: string; playId: number; physicalPitchSourceId: string;
  sourceId: string; sourceHash: string; originalSeedHash: string;
  execution: PostPlayBaseAppealExecution;
}>;
const pending = (reason: string) => freeze({ kind: 'intent_pending' as const, reason });

/** The accepted event expresses the targeted appeal. Native executes it only
 * where original secure custody and base contact still concur. Its clock is the
 * original cut, never the time the caller happened to submit a request. */
export const capturePostPlayBaseAppeal = (db: PostPlayReviewDb, scope: PostPlayReviewNativeScope,
  previous: ActualPostPlayReviewProjection, source: AcceptedActualPostPlayReviewEvent, current: boolean) => {
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  if (!(db instanceof Native) || !db.isTransaction) throw new Error('base appeal requires the Native read transaction');
  const action = source.action;
  if (action.kind !== 'defender_base_appeal' || previous.source.baseAppealMode !== 'original_catch_end_v1')
    throw new Error('original base appeal action or enabled owner differs');
  const reserved = previous.source.reservedCatchSeed;
  if (!reserved) return pending('original_base_appeal_reserved_catch_end_required');
  if (previous.cursor.offsetTicks !== 0 || previous.cursor.tick !== previous.seed.exactEnd.tick)
    return pending('original_base_appeal_current_physical_contact_required');
  // Other post-play actions may need independent live/dead-ball interpretation.
  // This bounded first-event owner does not recycle an older physical snapshot.
  if (previous.events.length) return pending('original_base_appeal_first_post_play_event_required');
  const original = deriveSamePaCatchReviewNativeSeed(db, reserved, current);
  if (json(original.seed) !== json(previous.seed) || json(original.scope) !== json(scope))
    throw new Error('base appeal original end, ledger or scope differs');
  const pair = readSamePaFieldRuleEvidenceWithInputsFromSqlite(db, reserved.viewReference, current ? 'current' : 'historical');
  if (pair.kind !== 'same_pa_field_rule_read_pair_v1') return pending('original_base_appeal_field_cut_required');
  const { actor, fields, value } = pair, root = fields[0];
  if (root.kind !== 'same_pa_physical_field_root_v1' || !actor.defenderBindings.some(b => b.playerId === action.defenderId)
    || actor.match.bases[action.base] !== action.runnerId || json(actor.match) !== json(scope.originalMatch)
    || json(value.physicalOperationReference) !== json(reserved.physicalOperationReference))
    throw new Error('base appeal original defender, occupied runner or field differs');
  const execution = deriveSamePaBaseAppealExecution({ indication: { defenderId: action.defenderId, runnerId: action.runnerId, base: action.base },
    match: actor.match, root, fields, evidence: value.evidence });
  if (execution.kind === 'pending') return pending(execution.reason);
  if (json(execution.moment) !== json(previous.seed.exactEnd)) throw new Error('base appeal execution differs from exact original cut');
  const evidence: PostPlayBaseAppealAdmission = { version: 'actual_post_play_base_appeal_admission_v1', kind: 'base_appeal',
    gameId: scope.gameId, playId: scope.playId, physicalPitchSourceId: scope.physicalPitchSourceId,
    sourceId: source.sourceId, sourceHash: hash(source), originalSeedHash: previous.seed.snapshotHash, execution };
  return freeze({ kind: 'admitted' as const, evidence });
};
