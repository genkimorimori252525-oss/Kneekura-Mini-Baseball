import type { ClubCreationInput, ClubSeedTargets, ClubWorldState } from '../club/ClubTypes';
import type { DirectedCompetitiveThreatSignal, InitialRivalryReason, RivalrySparseGraph } from '../rivalry/RivalryLifecycle';
export type CatalogSource = Readonly<{ sourceId: string; path: string; blobSha: string }>;
export type CatalogLocation = Readonly<{ sourceId: string; line: number }>;
export type CatalogLeague = Readonly<{
  leagueId: string; displayName: string; clubCount: number;
  sourceArchetype: 'REAL_BASEBALL_CLUB' | 'REAL_FOOTBALL_CLUB_AS_BASEBALL_CLUB';
}>;
export type CatalogClub = Readonly<{
  clubId: string; canonicalOriginId: string; leagueId: string; displayName: string; aliases: readonly string[];
  /** Source label, not an inferred precise city/country or global place ID. */
  homeIdentity: Readonly<{ kind: string; label: string }>;
  initialEconomicBand: 'MEGA' | 'ELITE' | 'HIGH' | 'UPPER' | 'MID' | 'LOW';
  targets: ClubSeedTargets;
  provenance: Readonly<{ identity: CatalogLocation; seed: CatalogLocation;
    confidenceClass: 'VERIFIED' | 'SUPPORTED' | 'DESIGN_ESTIMATE'; overrideReason: string | null }>;
}>;
export type CatalogRivalry = Readonly<{
  edgeId: string; fromClubId: string; toClubId: string; intensity: number;
  reason: InitialRivalryReason; source: CatalogLocation;
}>;
export type ClubCatalog = Readonly<{
  schemaVersion: 1; catalogVersion: string; datasetVersion: string; sourceRevision: string;
  sources: readonly CatalogSource[]; leagues: readonly CatalogLeague[];
  clubs: readonly CatalogClub[]; rivalries: readonly CatalogRivalry[];
}>;
export type CatalogLookup = Readonly<{ status: 'FOUND' | 'NOT_FOUND' | 'AMBIGUOUS'; clubIds: readonly string[] }>;
export type CareerClubSetup = Readonly<{
  clubId: string;
  identityLinks: Readonly<{ foundingIdentityRef: string; originCountryId: string; historicalHomeCityId: string }>;
  /** Actual money, physical geometry and external references; never generated from rank. */
  initial: ClubCreationInput['initial'];
}>;
export type CareerClubCreation = Readonly<{
  context: ClubCreationInput['context']; season: number; clubs: readonly CareerClubSetup[];
}>;
export type CareerClubBundle = Readonly<{
  careerId: string; season: number; effectiveDay: number;
  provenance: Readonly<{ catalogVersion: string; datasetVersion: string; sourceRevision: string;
    sourceSnapshots: readonly CatalogSource[]; clubTransformVersion: 'club-seed-direct-v1' }>;
  clubs: readonly ClubWorldState[];
  rivalryGraph: RivalrySparseGraph;
  rivalryReferences: readonly Readonly<{ stateRef: string; fromClubId: string; toClubId: string }>[];
  competitiveThreats: readonly Readonly<{ stateRef: string; signal: DirectedCompetitiveThreatSignal }>[];
}>;
