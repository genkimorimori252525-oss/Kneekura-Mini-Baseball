import assert from 'node:assert/strict';
import { bootstrap } from '../club/ClubFixtures.test-support';
import type { ClubResult } from '../club/ClubTypes';
import type { CareerClubCreation, ClubCatalog } from './CatalogTypes';
import { getDefaultClubCatalog } from './DefaultClubCatalog';
export type Mutable<T> = T extends readonly (infer U)[] ? Mutable<U>[]
  : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
export const copy = <T>(input: T): Mutable<T> => structuredClone(input) as Mutable<T>;
export function ok<T>(result: ClubResult<T>): T { assert.ok(result.ok, JSON.stringify(result)); return result.value; }
export function rejected(result: ClubResult<unknown>, code?: string): void {
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected rejection');
  if (code) assert.equal(result.reason.code, code);
  assert.equal(Object.hasOwn(result, 'value'), false);
}
/** Synthetic financial/geometry fixture only; not calibrated world data or real finances. */
export function setup(catalog: ClubCatalog = getDefaultClubCatalog()): Mutable<CareerClubCreation> {
  return {
    context: { phase: 'CREATION', careerId: 'fixture-career', effectiveDay: 10, existingClubIds: [] }, season: 1,
    clubs: catalog.clubs.map(club => {
      const initial = bootstrap().initial;
      initial.brand = { displayName: club.displayName, shortName: club.clubId };
      initial.references.rivalryStateRefs = []; initial.references.competitiveThreatRefs = [];
      initial.references.playerClubStateRefs = [{ playerId: 'fixture-player-' + club.clubId, stateRef: 'fixture-player-state-' + club.clubId }];
      initial.references.staffRoleLinks = [{ roleId: 'manager-role', roleKind: 'MANAGER', personId: 'fixture-manager-' + club.clubId, appointmentId: 'appointment-' + club.clubId }];
      initial.season.financialProfile.leagueId = club.leagueId;
      initial.season.financialProfile.profileId = 'profile-' + club.leagueId;
      initial.season.competitionEditionIds = ['fixture-edition-' + club.leagueId];
      initial.stadium.stadiumId = 'fixture-stadium-' + club.clubId;
      return { clubId: club.clubId, identityLinks: { foundingIdentityRef: 'founding-' + club.clubId,
        originCountryId: 'fixture-country', historicalHomeCityId: 'fixture-historical-city' }, initial };
    }),
  };
}
