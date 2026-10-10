import type { DatabaseSync } from 'node:sqlite';
import { buildPlayerPerceivedWorldState } from '../../core/sim/perception/PlayerPerceivedWorldState';
import type { ActualFieldObservationReceipt } from './ActualFieldObservation';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readSamePaCatchWorkFromSqlite } from './SamePlateAppearanceCatchWorkFromSqlite';
import type { SamePaCatchWorkReference } from './SamePlateAppearanceCatchWork';
import { samePaCatchCommunicationObservationAt } from './SamePlateAppearanceCatchCommunication';
import { readSamePaLifecycleRecordFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaLifecycleViewBasis } from './SamePlateAppearanceLifecycle';
import { samePaCaughtOutReception } from './SamePlateAppearanceCatchOperativeRuling';
export type SamePaCatchObservationEvidence = Readonly<{ workReference: SamePaCatchWorkReference; sourceId: string; snapshotHash: string;
  result: ReturnType<typeof samePaCatchCommunicationObservationAt>; operativeReception: ReturnType<typeof samePaCaughtOutReception> }>;

/** Bind received information to an actual sensory invocation. This has no
 * decision, motor, retirement or rule-truth effect. */
export const readSamePaCatchObservationFromSqlite = (db: DatabaseSync, workReference: SamePaCatchWorkReference,
  basis: SamePaLifecycleViewBasis, previous: SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep, receipt: ActualFieldObservationReceipt):
  Readonly<{ receipt: ActualFieldObservationReceipt; catchCommunication: SamePaCatchObservationEvidence }> => {
  const work = readSamePaCatchWorkFromSqlite(db, workReference);
  const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', basis.view.source.prefixReference.sourceId);
  if (!prefix || prefix.kind !== 'same_pa_lifecycle_prefix' || !prefix.source.eventReferences.some(r => json(r) === json(workReference))
    || json(work.lineage) !== json(basis.view.lineage) || json(work.physicalPitchReference) !== json(basis.view.cut.physicalPitchReference)
    || receipt.at.tick !== work.evaluationTick || json(receipt.at) !== json(work.communication.evaluatedThrough))
    throw new Error('same-PA received catch is outside the exact original observation prefix');
  const physicalReference = work.physicalOperationReference;
  if (physicalReference.owner !== 'pa_physical_v1_field_roots' && physicalReference.owner !== 'pa_physical_v1_field_steps')
    throw new Error('same-PA received catch requires an original field operation');
  const physical = readSamePaPhysicalOperationFromSqlite(db, { ...physicalReference, owner: physicalReference.owner }).record;
  if ((physical.kind !== 'same_pa_physical_field_root_v1' && physical.kind !== 'same_pa_physical_field_step_v1')
    || json(physical.field) !== json(previous.field)) throw new Error('same-PA received catch body changed after evaluated reception');
  const result = samePaCatchCommunicationObservationAt(work.communication, receipt.perceived.observerId, receipt.at);
  const communications = result.kind === 'received' ? [result.received] : [];
  const perceived = buildPlayerPerceivedWorldState({ ...receipt.perceived, communications: [...receipt.perceived.communications, ...communications] });
  return freeze({ receipt: { ...receipt, perceived }, catchCommunication: { workReference, sourceId: work.originalInputs.source.sourceId,
    snapshotHash: hash(work), result, operativeReception: samePaCaughtOutReception(work.operative, result) } });
};
