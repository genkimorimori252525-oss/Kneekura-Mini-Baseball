import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import type { ActualObservationMoment } from './ActualFieldObservation';
import type { AcceptedActualCommunicationModel } from './ActualCallCommunication';
import { actorFreeze as freeze, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText as id, samePaHash, samePaReferenceValid as ref, type SamePaReference } from './SamePlateAppearanceWorkPrefix';

/** Original external Source references, not claims about a Native table. */
export type SamePaAcceptedOfficialSourceReference = Readonly<{ sourceId: string; sourceVersion: string; sourceHash: string }>;
export type AcceptedSamePaOfficialPerson = Readonly<{ sourceId: string; sourceVersion: string;
  capability: 'accepted_original_umpire_person_v1'; careerId: string; officialId: string; personId: string }>;
export type AcceptedSamePaCatchAssignment = Readonly<{ sourceId: string; sourceVersion: string;
  capability: 'same_pa_explicit_catch_assignment_v1'; enrollmentReference: SamePaReference<'same_pa_enrollments'>;
  gameId: string; playId: number; physicalPitchSourceId: string; officialId: string; personId: string;
  personReference: SamePaAcceptedOfficialSourceReference;
  policy: Readonly<{ sourceId: string; sourceVersion: string; ruleProfileId: string;
    kind: 'accepted_original_official_action_v1' }> | null;
  pose: Readonly<{ position: Vec3; validFromElapsedSeconds: number; validThroughElapsedSeconds: number }> | null }>;
export type AcceptedSamePaCatchAction = Readonly<{ sourceId: string; sourceVersion: string;
  capability: 'same_pa_explicit_catch_action_v1'; assignmentReference: SamePaAcceptedOfficialSourceReference;
  officialId: string; personId: string; viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  judgment: 'caught' | 'not_caught'; calledAt: ActualObservationMoment }>;
export type AcceptedSamePaCatchCommunication = Readonly<{ sourceId: string; sourceVersion: string;
  capability: 'same_pa_explicit_catch_communication_v1'; viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  actionReference: SamePaAcceptedOfficialSourceReference | null; modelReference: SamePaAcceptedOfficialSourceReference | null }>;
export type SamePaCatchCommunicationAuthority = Readonly<{
  readAcceptedCommunication(sourceId: string): unknown;
  readAcceptedAction(sourceId: string): unknown;
  readAcceptedAssignment(sourceId: string): unknown;
  readAcceptedOfficialPerson(sourceId: string): unknown;
  readAcceptedReceptionModel(sourceId: string): AcceptedActualCommunicationModel | null;
}>;
const elapsed = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const integer = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
const originalRef = (v: unknown) => fields(v, ['sourceId', 'sourceVersion', 'sourceHash'])
  && id(v.sourceId) && id(v.sourceVersion) && samePaHash(v.sourceHash);
const base = (s: { sourceId: string; sourceVersion: string; capability: string }, sourceId: string, capability: string) =>
  s.sourceId === sourceId && id(s.sourceId) && id(s.sourceVersion) && s.capability === capability;
export const samePaOfficialSourceReference = (source: Readonly<{ sourceId: string; sourceVersion: string }>): SamePaAcceptedOfficialSourceReference =>
  freeze({ sourceId: source.sourceId, sourceVersion: source.sourceVersion, sourceHash: hash(source) });
export const assertSamePaAcceptedOfficialSource = (source: Readonly<{ sourceId: string; sourceVersion: string }>, r: SamePaAcceptedOfficialSourceReference): void => {
  if (!originalRef(r) || source.sourceId !== r.sourceId || source.sourceVersion !== r.sourceVersion || hash(source) !== r.sourceHash)
    throw new Error('same-PA accepted original official Source changed');
};
export const samePaOfficialPersonInput = (raw: unknown, sourceId: string): AcceptedSamePaOfficialPerson => {
  const s = cloneInert(raw) as AcceptedSamePaOfficialPerson;
  if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'careerId', 'officialId', 'personId'])
    || !base(s, sourceId, 'accepted_original_umpire_person_v1') || ![s.careerId, s.officialId, s.personId].every(id)) throw new Error('invalid accepted original umpire Person Source');
  return freeze(s);
};
export const samePaCatchAssignmentInput = (raw: unknown, sourceId: string): AcceptedSamePaCatchAssignment => {
  const s = cloneInert(raw) as AcceptedSamePaCatchAssignment;
  if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'enrollmentReference', 'gameId', 'playId', 'physicalPitchSourceId',
    'officialId', 'personId', 'personReference', 'policy', 'pose']) || !base(s, sourceId, 'same_pa_explicit_catch_assignment_v1')
    || !ref(s.enrollmentReference, 'same_pa_enrollments') || ![s.gameId, s.physicalPitchSourceId, s.officialId, s.personId].every(id)
    || !integer(s.playId) || !originalRef(s.personReference)) throw new Error('invalid accepted catch assignment Source');
  const p = s.policy, pose = s.pose;
  if (p !== null && (!fields(p, ['sourceId', 'sourceVersion', 'ruleProfileId', 'kind'])
    || ![p.sourceId, p.sourceVersion, p.ruleProfileId].every(id) || p.kind !== 'accepted_original_official_action_v1')) throw new Error('invalid accepted catch action policy');
  if (pose !== null && (!fields(pose, ['position', 'validFromElapsedSeconds', 'validThroughElapsedSeconds'])
    || !fields(pose.position, ['x', 'y', 'z']) || !Object.values(pose.position).every(Number.isFinite)
    || !elapsed(pose.validFromElapsedSeconds) || !elapsed(pose.validThroughElapsedSeconds)
    || pose.validThroughElapsedSeconds < pose.validFromElapsedSeconds)) throw new Error('invalid accepted catch sender pose');
  return freeze(s);
};
export const samePaCatchActionInput = (raw: unknown, sourceId: string): AcceptedSamePaCatchAction => {
  const s = cloneInert(raw) as AcceptedSamePaCatchAction, at = s?.calledAt;
  if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'assignmentReference', 'officialId', 'personId', 'viewReference', 'judgment', 'calledAt'])
    || !base(s, sourceId, 'same_pa_explicit_catch_action_v1') || !originalRef(s.assignmentReference)
    || ![s.officialId, s.personId].every(id) || !ref(s.viewReference, 'pa_lifecycle_v1_execution_views')
    || !['caught', 'not_caught'].includes(s.judgment) || !fields(at, ['originTick', 'elapsedSeconds', 'tick'])
    || !integer(at.originTick) || !integer(at.tick) || !elapsed(at.elapsedSeconds)) throw new Error('invalid accepted original catch action');
  return freeze(s);
};
export const samePaCatchCommunicationInput = (raw: unknown, sourceId: string): AcceptedSamePaCatchCommunication => {
  const s = cloneInert(raw) as AcceptedSamePaCatchCommunication;
  if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'viewReference', 'actionReference', 'modelReference'])
    || !base(s, sourceId, 'same_pa_explicit_catch_communication_v1') || !ref(s.viewReference, 'pa_lifecycle_v1_execution_views')
    || s.actionReference !== null && !originalRef(s.actionReference) || s.modelReference !== null && !originalRef(s.modelReference)) throw new Error('invalid accepted catch communication Source');
  return freeze(s);
};
