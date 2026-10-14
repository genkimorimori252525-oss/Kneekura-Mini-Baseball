import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type SamePaCurrentExecutionViewReference = SamePaReference<'pa_continuation_v1_execution_views'>;
export type SamePaInvocationViewReference = SamePaReference<'reserved_pa_execution_views'> | SamePaCurrentExecutionViewReference;
/** The participant and original reserved revision survive a new cumulative
 * view. Its projected hash is deliberately compared by the current view owner,
 * never inherited from the original posture or previous projected state. */
export const assertSamePaOriginalMember = (original: SamePaDispatchMember, current: SamePaDispatchMember) => {
  const { projectedStateHash: _old, ...a } = original, { projectedStateHash: _new, ...b } = current;
  if (json(a) !== json(b)) throw new Error('same-PA current invocation changed original participant or reserved state');
};
