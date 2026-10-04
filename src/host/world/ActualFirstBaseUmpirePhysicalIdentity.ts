import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import { actualObservationPhysicalPrefixEvidence } from './ActualObservationPhysicalPrefixHash';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import type { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';

type Prefix = Parameters<typeof battedWorldFieldPhysicalPrefix>[0];
type Reduction = ReturnType<typeof battedWorldFieldPhysicalPrefix>;
export type ActualFirstBaseUmpirePhysicalPrefixIdentity = Readonly<{
  physicalPrefixHash: string; physicalPrefixHashConvention?: 'owned_motion_observation_prefix_manifest_v1';
}>;
/** Internal identity adapter; the Native owner must first rederive the original bounded prefix. */
export const actualFirstBaseUmpireExecutionHash = (snapshot: DurableBattedWorldFieldExecution): string => ownedScheduledMotionArchiveHash(snapshot);
export const actualFirstBaseUmpirePhysicalPrefixIdentity = (prefix: Prefix, reduction: Reduction): ActualFirstBaseUmpirePhysicalPrefixIdentity => {
  const family = ['owned_motion_v2', 'owned_acquisition_plan_v1', 'owned_throw_plan_v1'];
  // This adapter was introduced after legacy/v1 umpire receipts. Preserve their
  // original reduction bytes even though the Player observer uses a v1 manifest.
  // Only the new physical family opts into its existing owner-qualified identity.
  if (!prefix.executions.some(value => value.history.some(source => family.includes(source.action.kind)))) {
    return { physicalPrefixHash: hash(reduction) };
  }
  return actualObservationPhysicalPrefixEvidence(prefix);
};
