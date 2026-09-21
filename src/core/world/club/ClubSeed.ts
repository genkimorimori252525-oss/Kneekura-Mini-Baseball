import type { ClubManagerAppointment, ClubReferences, ClubResult, ClubWorldState } from './ClubTypes';
import { creationReader, readState } from './ClubSchemas';
import { attempt, fail } from './ClubValidation';

/** Selects an external Person appointment; never copies a manager's skills or memory. */
export function managerFromReferences(references: ClubReferences): ClubManagerAppointment | null {
  const link = references.staffRoleLinks.find(x => x.roleKind === 'MANAGER');
  return link ? { managerId: link.personId, appointmentId: link.appointmentId } : null;
}
export const restoreClubState = (input: unknown): ClubResult<ClubWorldState> => attempt(() => readState(input));
/** Creation-only calibration v1. Physical geometry and monetary values are supplied independently. */
export function createClubFromSeed(input: unknown): ClubResult<ClubWorldState> {
  return attempt(() => {
    const { context, seed, initial } = creationReader(input, 'creation');
    if (context.phase !== 'CREATION') fail('CAREER_ALREADY_RUNNING');
    if (context.existingClubIds.includes(seed.identity.clubId)) fail('CLUB_ALREADY_EXISTS');
    const t = seed.targets;
    return readState({
      schemaVersion: 1, careerId: context.careerId, revision: 0, effectiveDay: context.effectiveDay, identity: seed.identity,
      initialSeed: { targets: t, metadata: seed.metadata, transformVersion: 'club-seed-direct-v1', financeNormalizationVersion: initial.financeNormalizationVersion },
      institutional: { brand: { ...initial.brand, brandVersion: 0 }, homeCityId: initial.homeCityId, owner: initial.owner,
        governanceRef: initial.governanceRef, stadium: { ...initial.stadium, quality: t.venue },
        facilities: { trainingQuality: t.development, academyQuality: t.development, scoutingInfrastructure: t.scouting,
          medicalQuality: t.venue, analyticsInfrastructure: t.scouting, stadiumOperationsQuality: t.venue },
        capital: { supporterCapital: t.popularity, brandCapital: t.popularity, commercialNetworkCapital: t.finance,
          stadiumAssetCapital: t.venue, institutionalKnowHow: t.development, recruitmentNetworkCapital: t.scouting,
          academyKnowHow: t.development, financingAccess: t.finance, ownershipBackingCapacity: t.finance },
        structuralRevenueCapacity: initial.structuralRevenueCapacity },
      season: { plan: initial.season, openingManager: managerFromReferences(initial.references), closureRef: null },
      live: { finance: { openingCash: initial.cash, openingDebt: initial.debt, cash: initial.cash, debt: initial.debt,
        revenue: { matchday: 0, broadcasting: 0, commercial: 0, merchandise: 0, prizeMoney: 0, transferIncome: 0, ownerFunding: 0, other: 0 },
        commitments: [], receipts: [] }, references: initial.references, managerAppointmentEventIds: [] },
    });
  });
}
