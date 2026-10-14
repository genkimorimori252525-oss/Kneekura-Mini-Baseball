import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { bodySourceFields as fields, bodySourceId as id, type BodySourceRef } from './PlayerBodyCapabilityMaterialization';
import type { DurablePlayerFieldingModel } from './SqlitePlayerFieldingModelStore';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type AcceptedFieldingModelRebinding = Readonly<{
  kind: 'accepted_fielding_model_rebinding_v1';
  originalModelRef: BodySourceRef; originalModelSourceHash: string; originalModelSnapshotHash: string;
}>;
export const fieldingModelRebindingInput = (raw: AcceptedFieldingModelRebinding) => {
  const p = cloneInert(raw);
  if (!fields(p, ['kind', 'originalModelRef', 'originalModelSourceHash', 'originalModelSnapshotHash'])
    || p.kind !== 'accepted_fielding_model_rebinding_v1' || !fields(p.originalModelRef, ['sourceId', 'sourceVersion'])
    || !id(p.originalModelRef.sourceId) || !id(p.originalModelRef.sourceVersion)
    || ![p.originalModelSourceHash, p.originalModelSnapshotHash].every(v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v))) {
    throw new Error('invalid accepted fielding model rebinding');
  }
  return freeze(p);
};
type Source = BodySourceRef & Readonly<{ careerId: string; playerId: string; personLinkSourceId: string;
  fieldingModelSourceId: string; acceptedAtDay: number; calibration: unknown; fieldingRebinding?: AcceptedFieldingModelRebinding }>;
/** Rebind an explicitly named existing calibration to an independently
 * authenticated developed fielding model. No parameter value is inferred. */
export const assertFieldingModelRebinding = (value: Readonly<{ source: Source; fieldingModel: DurablePlayerFieldingModel }>,
  original: Readonly<{ source: Source; fieldingModel: DurablePlayerFieldingModel }>): void => {
  const s = value.source, p = fieldingModelRebindingInput(s.fieldingRebinding!);
  if (s.sourceId === original.source.sourceId || p.originalModelRef.sourceId !== original.source.sourceId
    || p.originalModelRef.sourceVersion !== original.source.sourceVersion || p.originalModelSourceHash !== hash(original.source)
    || p.originalModelSnapshotHash !== hash(original) || !value.fieldingModel.source.developmentProvenance
    || s.fieldingModelSourceId === original.source.fieldingModelSourceId || s.acceptedAtDay <= original.source.acceptedAtDay
    || value.fieldingModel.source.acceptedAtDay <= original.fieldingModel.source.acceptedAtDay
    || s.acceptedAtDay < value.fieldingModel.source.acceptedAtDay || json(value.fieldingModel.person) !== json(original.fieldingModel.person)
    || ['careerId', 'playerId', 'personLinkSourceId'].some(key => s[key as keyof Source] !== original.source[key as keyof Source])
    || json(s.calibration) !== json(original.source.calibration)) throw new Error('original fielding rebinding or explicit calibration differs');
};
