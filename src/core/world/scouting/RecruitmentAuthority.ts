import { readState } from '../club/ClubSchemas';
import type { ClubWorldState } from '../club/ClubTypes';
import { frozenScoutingCopy, rejectUnknownScoutingFields } from './ScoutingKnowledge';

export type RecruitmentAuthorityProfile = Readonly<{
  profileId: string;
  version: string;
  careerId: string;
  clubId: string;
  season: number;
  governanceRef: string;
  availableAtDay: number;
  finalAuthorityKind: 'GM' | 'SPORTING_DIRECTOR';
  authorityRoleId: string;
}>;
export type SourceBackedRecruitmentAuthority = Readonly<{
  clubRevision: number;
  authorityPersonId: string;
  profile: RecruitmentAuthorityProfile;
  appointment: Readonly<{
    roleId: string;
    roleKind: 'OTHER';
    personId: string;
    appointmentId: string;
  }>;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/** Final recruitment authority follows governance and the live staff appointment. */
export const deriveRecruitmentAuthority = (
  input: ClubWorldState,
  source: RecruitmentAuthorityProfile,
  authorityPersonId: string,
  governanceProfileVersion: string,
  decidedAtDay: number,
): SourceBackedRecruitmentAuthority => {
  const club = readState(input);
  rejectUnknownScoutingFields(source, ['profileId', 'version',
    'careerId', 'clubId', 'season', 'governanceRef',
    'availableAtDay', 'finalAuthorityKind', 'authorityRoleId'],
  'recruitment authority profile');
  if (!id(source.profileId) || !id(source.version)
    || !id(source.governanceRef) || !id(source.authorityRoleId)
    || !['GM', 'SPORTING_DIRECTOR'].includes(source.finalAuthorityKind)
    || !Number.isSafeInteger(source.availableAtDay)
    || source.availableAtDay < 0
    || !Number.isSafeInteger(decidedAtDay)
    || decidedAtDay < 0) {
    throw new Error('invalid recruitment authority profile');
  }
  if (source.careerId !== club.careerId
    || source.clubId !== club.identity.clubId
    || source.season !== club.season.plan.season
    || source.governanceRef !== club.institutional.governanceRef
    || source.version !== governanceProfileVersion) {
    throw new Error('recruitment authority governance mismatch');
  }
  if (club.season.closureRef !== null
    || source.availableAtDay > club.effectiveDay
    || club.effectiveDay > decidedAtDay) {
    throw new Error('future or closed recruitment authority is unavailable');
  }
  const appointment = club.live.references.staffRoleLinks.find((link) =>
    link.roleId === source.authorityRoleId);
  if (!appointment || appointment.roleKind !== 'OTHER'
    || appointment.personId !== authorityPersonId) {
    throw new Error('recruitment authority person is not appointed');
  }
  return frozenScoutingCopy({ clubRevision: club.revision,
    authorityPersonId, profile: source,
    appointment: { roleId: appointment.roleId,
      roleKind: 'OTHER' as const, personId: appointment.personId,
      appointmentId: appointment.appointmentId } });
};
