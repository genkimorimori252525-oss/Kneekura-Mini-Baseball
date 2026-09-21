import type { ClubBudgets, ClubFinanceOperation, ClubFinanceState, ClubFinanceSummary, FinancialRegulationProfile } from './ClubFinanceTypes';
export type ClubIssueCode = 'INVALID_INPUT' | 'DUPLICATE_ID' | 'CAREER_ALREADY_RUNNING' | 'CLUB_ALREADY_EXISTS'
  | 'STATE_INCONSISTENT' | 'WRONG_CLUB' | 'STALE_REVISION' | 'BACKDATED_COMMAND' | 'OVERFLOW'
  | 'NO_CHANGE' | 'SEASON_CLOSED' | 'SEASON_NOT_CLOSED' | 'WRONG_SEASON' | 'PROFILE_VERSION_CONFLICT'
  | 'CURRENCY_MISMATCH' | 'UNKNOWN_COMMITMENT' | 'INSUFFICIENT_CASH' | 'AMOUNT_EXCEEDS_OUTSTANDING'
  | 'AMOUNT_EXCEEDS_DEBT' | 'EVENT_MISMATCH';
export type ClubIssue = Readonly<{ code: ClubIssueCode; path?: string }>;
export type ClubResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; reason: ClubIssue }>;
export type ClubIdentity = Readonly<{
  clubId: string; canonicalOriginId: string; foundingIdentityRef: string; originCountryId: string;
  historicalHomeCityId: string; sourceArchetype: 'REAL_BASEBALL_CLUB' | 'REAL_FOOTBALL_CLUB_AS_BASEBALL_CLUB';
}>;
export type ClubSeedTargets = Readonly<{ finance: number; popularity: number; development: number; scouting: number; venue: number }>;
export type ClubSeedMetadata = Readonly<{
  catalogVersion: string; datasetVersion: string; financeSnapshotSeason: string | null;
  sourceSnapshotIds: readonly string[]; confidenceClass: 'VERIFIED' | 'SUPPORTED' | 'DESIGN_ESTIMATE'; overrideReason: string | null;
}>;
export type ClubSeedRecord = Readonly<{
  targets: ClubSeedTargets; metadata: ClubSeedMetadata; transformVersion: 'club-seed-direct-v1'; financeNormalizationVersion: string;
}>;
export type ClubOwner = Readonly<{ ownerId: string | null; modelRef: string }>;
export type ClubStadium = Readonly<{
  stadiumId: string; geometryRef: string; capacity: number; quality: number; ageSeasons: number;
  ownedByClub: boolean; leaseCost: number; renovationLevel: number;
}>;
export type ClubFacilities = Readonly<{
  trainingQuality: number; academyQuality: number; scoutingInfrastructure: number;
  medicalQuality: number; analyticsInfrastructure: number; stadiumOperationsQuality: number;
}>;
export type ClubStructuralCapital = Readonly<{
  supporterCapital: number; brandCapital: number; commercialNetworkCapital: number; stadiumAssetCapital: number;
  institutionalKnowHow: number; recruitmentNetworkCapital: number; academyKnowHow: number;
  financingAccess: number; ownershipBackingCapacity: number;
}>;
export type ClubInstitutionalState = Readonly<{
  brand: Readonly<{ displayName: string; shortName: string; brandVersion: number }>;
  homeCityId: string; owner: ClubOwner; governanceRef: string; stadium: ClubStadium;
  facilities: ClubFacilities; capital: ClubStructuralCapital; structuralRevenueCapacity: number;
}>;
export type ClubManagerAppointment = Readonly<{ managerId: string; appointmentId: string }>;
export type ClubReferences = Readonly<{
  playerClubStateRefs: readonly Readonly<{ playerId: string; stateRef: string }>[];
  staffRoleLinks: readonly Readonly<{ roleId: string; roleKind: 'MANAGER' | 'COACH' | 'SCOUT' | 'OTHER'; personId: string; appointmentId: string }>[];
  rivalryStateRefs: readonly Readonly<{ fromClubId: string; toClubId: string; stateRef: string }>[];
  competitiveThreatRefs: readonly string[]; standingsRef: string | null; fanDemandRef: string | null;
}>;
export type ClubSeasonPlan = Readonly<{
  season: number; startsOnDay: number; minimumCashReserve: number; approvedBudgets: ClubBudgets;
  objectives: readonly string[]; competitionEditionIds: readonly string[]; openingRegistrationSnapshotId: string | null;
  financialProfile: FinancialRegulationProfile;
}>;
export type ClubWorldState = Readonly<{
  schemaVersion: 1; careerId: string; revision: number; effectiveDay: number;
  identity: ClubIdentity; initialSeed: ClubSeedRecord; institutional: ClubInstitutionalState;
  season: Readonly<{ plan: ClubSeasonPlan; openingManager: ClubManagerAppointment | null; closureRef: string | null }>;
  live: Readonly<{ finance: ClubFinanceState; references: ClubReferences; managerAppointmentEventIds: readonly string[] }>;
}>;
export type ClubCreationInput = Readonly<{
  context: Readonly<{ phase: 'CREATION' | 'RUNNING'; careerId: string; effectiveDay: number; existingClubIds: readonly string[] }>;
  seed: Readonly<{ identity: ClubIdentity; metadata: ClubSeedMetadata; targets: ClubSeedTargets }>;
  initial: Readonly<{
    brand: Readonly<{ displayName: string; shortName: string }>; homeCityId: string; owner: ClubOwner; governanceRef: string;
    stadium: Omit<ClubStadium, 'quality'>; cash: number; debt: number; structuralRevenueCapacity: number;
    financeNormalizationVersion: string; season: ClubSeasonPlan; references: ClubReferences;
  }>;
}>;
export type ClubSeasonResultRefs = Readonly<{
  domesticResultRef: string; continentalResultRef: string | null; rosterSummaryRef: string;
  fanbaseSummaryRef: string; derivedSummaryRef: string | null;
}>;
export type ClubOperation = ClubFinanceOperation
  | Readonly<{ kind: 'RENAME_CLUB'; displayName: string; shortName: string }>
  | Readonly<{ kind: 'RELOCATE_CLUB'; homeCityId: string }>
  | Readonly<{ kind: 'CHANGE_OWNER'; owner: ClubOwner; ownershipBackingCapacity: number }>
  | Readonly<{ kind: 'REFORM_GOVERNANCE'; governanceRef: string }>
  | Readonly<{ kind: 'REPLACE_STADIUM'; stadium: ClubStadium }>
  | Readonly<{ kind: 'UPDATE_FACILITIES'; facilities: ClubFacilities }>
  | Readonly<{ kind: 'UPDATE_STRUCTURAL_CAPITAL'; capital: ClubStructuralCapital; structuralRevenueCapacity: number }>
  | Readonly<{ kind: 'UPDATE_REFERENCES'; references: ClubReferences }>
  | Readonly<{ kind: 'CLOSE_SEASON'; snapshotId: string; resultRefs: ClubSeasonResultRefs }>
  | Readonly<{ kind: 'OPEN_SEASON'; plan: ClubSeasonPlan }>;
export type ClubCommand = Readonly<{
  eventId: string; careerId: string; clubId: string; expectedRevision: number; effectiveDay: number;
  causeEventIds: readonly string[]; operations: readonly ClubOperation[];
}>;
/** History only, emitted to the host. Never accepted as current causal state. */
export type ClubSeasonSnapshot = Readonly<{
  snapshotId: string; careerId: string; clubId: string; season: number; effectiveDay: number;
  plan: ClubSeasonPlan; finance: ClubFinanceState; financeSummary: ClubFinanceSummary;
  institutional: ClubInstitutionalState; resultRefs: ClubSeasonResultRefs;
  openingManager: ClubManagerAppointment | null; closingManager: ClubManagerAppointment | null;
  managerAppointmentEventIds: readonly string[];
}>;
export type ClubTransitionEvent = Readonly<{
  kind: 'CLUB_CHANGED'; command: ClubCommand; afterRevision: number; historySnapshots: readonly ClubSeasonSnapshot[];
}>;
export type ClubChangeResult = Readonly<{ ok: true; state: ClubWorldState; event: ClubTransitionEvent }>
  | Readonly<{ ok: false; state: ClubWorldState; reason: ClubIssue }>;
