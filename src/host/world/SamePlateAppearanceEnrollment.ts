import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { PlayerWorkloadRecoveryState } from '../../core/world/development/PlayerWorkloadRecovery';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
export type SamePlateAppearanceBaselineReference = Readonly<{ playerId: string; baselineSourceId: string; revision: number; stateHash: string }>;
export type AcceptedSamePlateAppearanceEnrollment = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'reserved_same_pa_enrollment_v1' | 'reserved_same_pa_enrollment_v2';
  actorReference: Readonly<{ owner: 'physical_plate_appearance_actors'; sourceId: string; sourceHash: string; snapshotHash: string }>;
  firstPhysicalPitchSourceId: string; executionBasis: 'reserved_cumulative_actual_role_total_v1';
  participantBaselineReferences: readonly SamePlateAppearanceBaselineReference[];
}>;
export type ReservedSamePlateAppearanceEnrollment = Readonly<{
  kind: 'reserved'; source: AcceptedSamePlateAppearanceEnrollment; careerId: string; gameId: string; playId: number;
  actorHash: string; officialRevision: number; worldHash: string; fixtureHash: string;
  participants: readonly Readonly<{ binding: OfficialParticipantBinding; personHash: string; baselineSourceId: string; baselineSourceHash: string; state: PlayerWorkloadRecoveryState }>[];
  firstPitch: Readonly<{ physicalPitchSourceId: string; state: 'blocked_execution_basis'; predecessorResumeSourceId: null; consumingSourceId: null }>;
}>;
export type SamePlateAppearanceEnrollmentResult = ReservedSamePlateAppearanceEnrollment | Readonly<{ kind: 'pending'; missingBaselinePlayerIds: readonly string[] }>;
export const samePaId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const sha = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const fields = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...keys].sort().join('|');
export const samePlateAppearanceEnrollmentInput = (raw: unknown, sourceId?: string): AcceptedSamePlateAppearanceEnrollment => {
  const s = cloneInert(raw) as AcceptedSamePlateAppearanceEnrollment;
  if (!fields(s, ['sourceId','sourceVersion','capability','actorReference','firstPhysicalPitchSourceId','executionBasis','participantBaselineReferences'])
    || ![s.sourceId,s.sourceVersion,s.firstPhysicalPitchSourceId].every(samePaId) || sourceId !== undefined && s.sourceId !== sourceId
    || !['reserved_same_pa_enrollment_v1','reserved_same_pa_enrollment_v2'].includes(s.capability) || s.executionBasis !== 'reserved_cumulative_actual_role_total_v1'
    || !fields(s.actorReference,['owner','sourceId','sourceHash','snapshotHash']) || s.actorReference.owner !== 'physical_plate_appearance_actors'
    || !samePaId(s.actorReference.sourceId) || !sha(s.actorReference.sourceHash) || !sha(s.actorReference.snapshotHash)
    || !Array.isArray(s.participantBaselineReferences) || (s.capability === 'reserved_same_pa_enrollment_v1' ? s.participantBaselineReferences.length !== 10 : s.participantBaselineReferences.length < 11 || s.participantBaselineReferences.length > 13)
    || new Set(s.participantBaselineReferences.map(p => p.playerId)).size !== s.participantBaselineReferences.length
    || s.participantBaselineReferences.some(p => !fields(p,['playerId','baselineSourceId','revision','stateHash'])
      || !samePaId(p.playerId) || !samePaId(p.baselineSourceId) || !Number.isSafeInteger(p.revision) || p.revision < 0 || !sha(p.stateHash))) {
    throw new Error('invalid accepted same-PA enrollment Source');
  }
  return freeze(s);
};
