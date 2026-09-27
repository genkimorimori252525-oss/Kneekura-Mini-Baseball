import type { CompetitionEditionInput,
  CompetitionEditionSnapshot,
  CompetitionFormatProfile } from
  '../../core/world/competition/CompetitionEdition';
import type { CompetitionDrawPolicyRegistry } from
  '../../core/world/competition/CompetitionDraw';
import type { SqliteCompetitionEditionStore } from
  './SqliteCompetitionEditionStore';
import type { SqliteContinentalQualificationStore } from
  './SqliteContinentalQualificationStore';

export type ContinentalEditionFromDomesticInput = Readonly<{
  careerId: string;
  profile: CompetitionFormatProfile;
  edition: Omit<CompetitionEditionInput,
    'qualificationSnapshotId' | 'participantIds'>;
  drawPolicyRegistry: CompetitionDrawPolicyRegistry;
}>;

/** Edition entrants and qualification ID come from durable domestic titles. */
export const initializeContinentalEditionFromDomesticQualification = (
  stores: Readonly<{
    qualification: Pick<SqliteContinentalQualificationStore,
      'readSnapshot'>;
    edition: Pick<SqliteCompetitionEditionStore, 'initialize'>;
  }>,
  input: ContinentalEditionFromDomesticInput,
): CompetitionEditionSnapshot => {
  const expectedCount = input.profile.canonicalRole === 'AFBCL' ? 8
    : input.profile.canonicalRole === 'CONTINENTAL_CL' ? 16 : null;
  if (expectedCount === null) {
    throw new Error('domestic qualification belongs to a continental Edition');
  }
  const qualification = stores.qualification.readSnapshot(
    input.careerId, input.edition.editionId);
  if (!qualification
    || qualification.competitionEditionId !== input.edition.editionId
    || qualification.participantIds.length !== expectedCount) {
    throw new Error('continental Edition lacks its complete qualification source');
  }
  return stores.edition.initialize(input.careerId, input.profile,
    { ...input.edition,
      qualificationSnapshotId: qualification.qualificationSnapshotId,
      participantIds: qualification.participantIds },
    input.drawPolicyRegistry);
};
