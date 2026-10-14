import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText as text, samePaHash, samePaReferenceValid as ref, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { assertSamePaAcceptedOfficialSource, samePaOfficialPersonInput,
  type AcceptedSamePaOfficialPerson, type SamePaAcceptedOfficialSourceReference } from './SamePlateAppearanceCatchCommunicationSource';

export const samePaLiveBallStateTable = 'pa_live_ball_v1_actions' as const;
export type SamePaLiveBallStateReference = SamePaReference<typeof samePaLiveBallStateTable>;
/** A separate, bounded plate-umpire assignment. A catch assignment is not this capability. */
export type AcceptedSamePaLiveBallAssignment = Readonly<{ sourceId: string; sourceVersion: string;
  capability: 'same_pa_explicit_live_ball_assignment_v1'; role: 'plate_umpire';
  enrollmentReference: SamePaReference<'same_pa_enrollments'>; gameId: string; playId: number;
  physicalPitchSourceId: string; officialId: string; personId: string; personReference: SamePaAcceptedOfficialSourceReference;
  policy: Readonly<{ sourceId: string; sourceVersion: string; ruleProfileId: string; kind: 'accepted_original_live_ball_action_v1' }> }>;
/** Intent only. Native supplies the moment, physical facts, prior state and execution proof. */
export type AcceptedSamePaLiveBallAction = Readonly<{ sourceId: string; sourceVersion: string;
  capability: 'same_pa_explicit_live_ball_action_v1'; enrollmentReference: SamePaReference<'same_pa_enrollments'>;
  viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>; assignmentReference: SamePaAcceptedOfficialSourceReference;
  officialId: string; personId: string; declaration: 'play' | 'time'; priorStateReference: SamePaLiveBallStateReference | null }>;
export type SamePaLiveBallOriginals = Readonly<{ assignment: AcceptedSamePaLiveBallAssignment; person: AcceptedSamePaOfficialPerson }>;
export type SamePaLiveBallStateAuthority = Readonly<{ readAcceptedAction(id: string): unknown;
  readAcceptedAssignment(id: string): unknown; readAcceptedOfficialPerson(id: string): unknown }>;
const originalRef = (v: unknown) => fields(v, ['sourceId', 'sourceVersion', 'sourceHash'])
  && text(v.sourceId) && text(v.sourceVersion) && samePaHash(v.sourceHash);
export const samePaLiveBallAssignmentInput = (raw: unknown, id?: string): AcceptedSamePaLiveBallAssignment => {
  const s = cloneInert(raw) as AcceptedSamePaLiveBallAssignment;
  if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'role', 'enrollmentReference', 'gameId', 'playId',
    'physicalPitchSourceId', 'officialId', 'personId', 'personReference', 'policy'])
    || ![s.sourceId, s.sourceVersion, s.gameId, s.physicalPitchSourceId, s.officialId, s.personId].every(text)
    || id !== undefined && s.sourceId !== id || s.capability !== 'same_pa_explicit_live_ball_assignment_v1'
    || s.role !== 'plate_umpire' || !ref(s.enrollmentReference, 'same_pa_enrollments')
    || !Number.isSafeInteger(s.playId) || s.playId < 0 || !originalRef(s.personReference)
    || !fields(s.policy, ['sourceId', 'sourceVersion', 'ruleProfileId', 'kind'])
    || ![s.policy.sourceId, s.policy.sourceVersion, s.policy.ruleProfileId].every(text)
    || s.policy.kind !== 'accepted_original_live_ball_action_v1') throw new Error('invalid original plate-umpire live-ball assignment');
  return freeze(s);
};
export const samePaLiveBallActionInput = (raw: unknown, id?: string): AcceptedSamePaLiveBallAction => {
  const s = cloneInert(raw) as AcceptedSamePaLiveBallAction;
  if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'enrollmentReference', 'viewReference', 'assignmentReference',
    'officialId', 'personId', 'declaration', 'priorStateReference'])
    || ![s.sourceId, s.sourceVersion, s.officialId, s.personId].every(text) || id !== undefined && s.sourceId !== id
    || s.capability !== 'same_pa_explicit_live_ball_action_v1' || !ref(s.enrollmentReference, 'same_pa_enrollments')
    || !ref(s.viewReference, 'pa_lifecycle_v1_execution_views') || !originalRef(s.assignmentReference)
    || !['play', 'time'].includes(s.declaration) || s.priorStateReference !== null
      && (!ref(s.priorStateReference, samePaLiveBallStateTable) || s.priorStateReference.sourceId === s.sourceId))
    throw new Error('invalid original live-ball action; occurrence is Native-owned');
  return freeze(s);
};
export const samePaLiveBallOriginalsInput = (raw: unknown, s: AcceptedSamePaLiveBallAction): SamePaLiveBallOriginals => {
  const r = cloneInert(raw) as SamePaLiveBallOriginals;
  if (!fields(r, ['assignment', 'person'])) throw new Error('invalid live-ball original inputs');
  const assignment = samePaLiveBallAssignmentInput(r.assignment, s.assignmentReference.sourceId);
  const person = samePaOfficialPersonInput(r.person, assignment.personReference.sourceId);
  assertSamePaAcceptedOfficialSource(assignment, s.assignmentReference);
  assertSamePaAcceptedOfficialSource(person, assignment.personReference);
  if (assignment.officialId !== s.officialId || assignment.personId !== s.personId || person.officialId !== s.officialId
    || person.personId !== s.personId || json(assignment.enrollmentReference) !== json(s.enrollmentReference))
    throw new Error('live-ball original official assignment differs');
  return freeze({ assignment, person });
};
export const captureSamePaLiveBallOriginals = (s: AcceptedSamePaLiveBallAction, authority: SamePaLiveBallStateAuthority): SamePaLiveBallOriginals | null => {
  const raw = authority.readAcceptedAssignment(s.assignmentReference.sourceId); if (raw == null) return null;
  const assignment = samePaLiveBallAssignmentInput(raw, s.assignmentReference.sourceId);
  const person = authority.readAcceptedOfficialPerson(assignment.personReference.sourceId); if (person == null) return null;
  return samePaLiveBallOriginalsInput({ assignment, person }, s);
};
