import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actualCommunicationModelInput, type AcceptedActualCommunicationModel } from './ActualCallCommunication';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaReferenceValid as ref, samePaText as text, samePaHash, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaCatchCommunicationInput, samePaCatchActionInput, samePaCatchAssignmentInput, samePaOfficialPersonInput,
  assertSamePaAcceptedOfficialSource, type SamePaAcceptedOfficialSourceReference, type SamePaCatchCommunicationAuthority,
  type AcceptedSamePaCatchCommunication, type AcceptedSamePaCatchAction, type AcceptedSamePaCatchAssignment, type AcceptedSamePaOfficialPerson } from './SamePlateAppearanceCatchCommunicationSource';

export type SamePaCatchWorkReference = SamePaReference<'pa_catch_v1_work'>;
export type AcceptedSamePaCatchWork = Readonly<{ sourceId: string; sourceVersion: string; capability: 'same_pa_catch_work_v1';
  enrollmentReference: SamePaReference<'same_pa_enrollments'>; viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  communicationReference: SamePaAcceptedOfficialSourceReference; priorWorkReference: SamePaCatchWorkReference | null }>;
export type SamePaCatchWorkOriginals = Readonly<{ source: AcceptedSamePaCatchCommunication; action: AcceptedSamePaCatchAction | null;
  assignment: AcceptedSamePaCatchAssignment | null; person: AcceptedSamePaOfficialPerson | null; model: AcceptedActualCommunicationModel | null }>;
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('same-PA catch original action or reception model changed'); };
export const samePaCatchWorkInput = (raw: unknown, id?: string): AcceptedSamePaCatchWork => {
  const s = cloneInert(raw) as AcceptedSamePaCatchWork;
  if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'enrollmentReference', 'viewReference', 'communicationReference', 'priorWorkReference'])
    || !text(s.sourceId) || !text(s.sourceVersion) || id !== undefined && s.sourceId !== id || s.capability !== 'same_pa_catch_work_v1'
    || !ref(s.enrollmentReference, 'same_pa_enrollments') || !ref(s.viewReference, 'pa_lifecycle_v1_execution_views')
    || s.priorWorkReference !== null && (!ref(s.priorWorkReference, 'pa_catch_v1_work') || s.priorWorkReference.sourceId === s.sourceId)
    || !fields(s.communicationReference, ['sourceId', 'sourceVersion', 'sourceHash'])
    || !text(s.communicationReference.sourceId) || !text(s.communicationReference.sourceVersion)
    || !samePaHash(s.communicationReference.sourceHash)) throw new Error('invalid same-PA catch work Source');
  return freeze(s);
};
export const samePaCatchWorkOriginalsInput = (raw: SamePaCatchWorkOriginals, source: AcceptedSamePaCatchWork): SamePaCatchWorkOriginals => {
  const r = cloneInert(raw);
  if (!fields(r, ['source', 'action', 'assignment', 'person', 'model'])) throw new Error('invalid same-PA catch original inputs');
  const s = samePaCatchCommunicationInput(r.source, source.communicationReference.sourceId);
  assertSamePaAcceptedOfficialSource(s, source.communicationReference); same(s.viewReference, source.viewReference);
  const action = r.action === null ? null : samePaCatchActionInput(r.action, r.action.sourceId);
  const assignment = r.assignment === null ? null : samePaCatchAssignmentInput(r.assignment, r.assignment.sourceId);
  const person = r.person === null ? null : samePaOfficialPersonInput(r.person, r.person.sourceId);
  const model = r.model === null ? null : actualCommunicationModelInput(r.model, r.model.sourceId);
  if (action) { if (!s.actionReference) throw new Error('unrequested catch action'); assertSamePaAcceptedOfficialSource(action, s.actionReference); }
  if (assignment) { if (!action) throw new Error('unrequested catch assignment'); assertSamePaAcceptedOfficialSource(assignment, action.assignmentReference); }
  if (person) { if (!assignment) throw new Error('unrequested catch Person'); assertSamePaAcceptedOfficialSource(person, assignment.personReference); }
  if (model) { if (!s.modelReference) throw new Error('unrequested catch reception model'); assertSamePaAcceptedOfficialSource(model, s.modelReference); }
  return freeze({ source: s, action, assignment, person, model });
};
/** A later physical cut observes the same transmission. It cannot replace its
 * judgment, sender or an already accepted stochastic reception model. */
export const assertSamePaCatchWorkContinuation = (previous: SamePaCatchWorkOriginals, current: SamePaCatchWorkOriginals): void => {
  same(previous.action, current.action); same(previous.assignment, current.assignment); same(previous.person, current.person);
  if (previous.model) same(previous.model, current.model);
};
export const samePaCatchOriginalAuthority = (r: SamePaCatchWorkOriginals): SamePaCatchCommunicationAuthority => ({
  readAcceptedCommunication: id => id === r.source.sourceId ? r.source : null,
  readAcceptedAction: id => id === r.action?.sourceId ? r.action : null,
  readAcceptedAssignment: id => id === r.assignment?.sourceId ? r.assignment : null,
  readAcceptedOfficialPerson: id => id === r.person?.sourceId ? r.person : null,
  readAcceptedReceptionModel: id => id === r.model?.sourceId ? r.model : null,
});
export const captureSamePaCatchOriginals = (s: AcceptedSamePaCatchWork, authority: SamePaCatchCommunicationAuthority): SamePaCatchWorkOriginals | null => {
  const raw = authority.readAcceptedCommunication(s.communicationReference.sourceId); if (raw == null) return null;
  const source = samePaCatchCommunicationInput(raw, s.communicationReference.sourceId);
  const a = source.actionReference && authority.readAcceptedAction(source.actionReference.sourceId);
  const action = a == null ? null : samePaCatchActionInput(a, source.actionReference!.sourceId);
  const b = action && authority.readAcceptedAssignment(action.assignmentReference.sourceId);
  const assignment = b == null ? null : samePaCatchAssignmentInput(b, action!.assignmentReference.sourceId);
  const p = assignment && authority.readAcceptedOfficialPerson(assignment.personReference.sourceId);
  const person = p == null ? null : samePaOfficialPersonInput(p, assignment!.personReference.sourceId);
  const m = source.modelReference && authority.readAcceptedReceptionModel(source.modelReference.sourceId);
  const model = m == null ? null : actualCommunicationModelInput(m, source.modelReference!.sourceId);
  return samePaCatchWorkOriginalsInput({ source, action, assignment, person, model }, s);
};
