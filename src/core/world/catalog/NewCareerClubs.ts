import type { ClubCreationInput, ClubResult, ClubWorldState } from '../club/ClubTypes';
import { createClubFromSeed } from '../club';
import { creationReader } from '../club/ClubSchemas';
import { attempt, enumeration, fail, ids, integer, list, object, record, same, text } from '../club/ClubValidation';
import { adaptInitialDirectedRivalrySeed, createRivalrySparseGraph, type DirectedRivalryState } from '../rivalry/RivalryLifecycle';
import { readCatalog } from './ClubCatalog';
import type { CareerClubBundle } from './CatalogTypes';
const inputReader = object({
  context: object({ phase: enumeration(['CREATION','RUNNING']), careerId: text, effectiveDay: integer, existingClubIds: ids }),
  season: integer,
  clubs: list(object({ clubId: text, identityLinks: object({ foundingIdentityRef: text, originCountryId: text,
    historicalHomeCityId: text }), initial: record }), x => x.clubId, true),
});

/**
 * New-career transaction proposal only. No I/O, allocation from ranks, runtime re-seeding,
 * event authenticity claims, or modification of caller-owned world/player/person state.
 * The host must atomically persist the complete bundle and assert the career is still empty.
 */
export function createCareerClubs(catalogInput: unknown, input: unknown): ClubResult<CareerClubBundle> {
  return attempt(() => {
    const catalog = readCatalog(catalogInput), request = inputReader(input, 'creation');
    const { context, season } = request;
    if (context.phase !== 'CREATION') fail('CAREER_ALREADY_RUNNING', 'creation.context.phase');
    if (context.existingClubIds.length) fail('CLUB_ALREADY_EXISTS', 'creation.context.existingClubIds');
    if (request.clubs.length !== catalog.clubs.length) fail('STATE_INCONSISTENT', 'creation.clubs.coverage');
    const setups = new Map(request.clubs.map(x => [x.clubId,x]));
    const profiles = new Map<string, ClubCreationInput['initial']['season']['financialProfile']>();
    const profileVersions = new Map<string, ClubCreationInput['initial']['season']['financialProfile']>();
    const sources = new Map(catalog.sources.map(x => [x.sourceId,x]));
    const edges: DirectedRivalryState[] = [];
    const rivalryReferences: { stateRef: string; fromClubId: string; toClubId: string }[] = [];
    const competitiveThreats: Array<CareerClubBundle['competitiveThreats'][number]> = [];
    for (const edge of catalog.rivalries) {
      const stateRef = JSON.stringify(['career-club-relation-v1',context.careerId,edge.edgeId]);
      const adapted = adaptInitialDirectedRivalrySeed({ ...edge, currentSeason: season,
        sourceEventId: JSON.stringify(['initial-catalog-context-v1',context.careerId,catalog.catalogVersion,catalog.datasetVersion,edge.edgeId]) });
      if (adapted.kind === 'HISTORICAL_EDGE') {
        edges.push(adapted.edge); rivalryReferences.push({ stateRef, fromClubId: edge.fromClubId, toClubId: edge.toClubId });
      } else competitiveThreats.push({ stateRef, signal: adapted.threat });
    }
    const clubs: ClubWorldState[] = [];
    for (const club of catalog.clubs) {
      const setup = setups.get(club.clubId);
      if (!setup) fail('STATE_INCONSISTENT', 'creation.clubs.coverage:' + club.clubId);
      const league = catalog.leagues.find(x => x.leagueId === club.leagueId)!;
      const sourceSnapshotIds = [club.provenance.identity,club.provenance.seed].map(location => {
        const source = sources.get(location.sourceId)!;
        return JSON.stringify([catalog.sourceRevision,source.path,source.blobSha,location.line]);
      });
      const parsed = creationReader({ context, seed: {
        identity: { clubId: club.clubId, canonicalOriginId: club.canonicalOriginId, ...setup.identityLinks, sourceArchetype: league.sourceArchetype },
        metadata: { catalogVersion: catalog.catalogVersion, datasetVersion: catalog.datasetVersion, financeSnapshotSeason: null,
          sourceSnapshotIds: [...new Set(sourceSnapshotIds)], confidenceClass: club.provenance.confidenceClass,
          overrideReason: club.provenance.overrideReason }, targets: club.targets }, initial: setup.initial }, 'creation.clubs:' + club.clubId);
      const initial = parsed.initial;
      if (initial.brand.displayName !== club.displayName) fail('STATE_INCONSISTENT', 'creation.clubs.brand:' + club.clubId);
      if (initial.season.season !== season) fail('WRONG_SEASON', 'creation.clubs.season:' + club.clubId);
      const profile = initial.season.financialProfile;
      if (profile.leagueId !== league.leagueId) fail('STATE_INCONSISTENT', 'creation.clubs.profile.league:' + club.clubId);
      const known = profiles.get(league.leagueId), versionKey = JSON.stringify([profile.profileId,profile.version]);
      const knownVersion = profileVersions.get(versionKey);
      if ((known && !same(known,profile)) || (knownVersion && !same(knownVersion,profile)))
        fail('PROFILE_VERSION_CONFLICT', 'creation.clubs.financialProfile:' + club.clubId);
      profiles.set(league.leagueId,profile); profileVersions.set(versionKey,profile);
      if (initial.references.rivalryStateRefs.length || initial.references.competitiveThreatRefs.length)
        fail('STATE_INCONSISTENT', 'creation.clubs.preexistingRelations:' + club.clubId);
      const created = createClubFromSeed({ ...parsed, initial: { ...initial, references: {
        ...initial.references, rivalryStateRefs: rivalryReferences.filter(x => x.fromClubId === club.clubId),
        competitiveThreatRefs: competitiveThreats.filter(x => x.signal.fromClubId === club.clubId).map(x => x.stateRef),
      } } });
      if (!created.ok) fail(created.reason.code, 'creation.clubs:' + club.clubId + (created.reason.path ? ':' + created.reason.path : ''));
      clubs.push(created.value);
    }
    return { careerId: context.careerId, season, effectiveDay: context.effectiveDay,
      provenance: { catalogVersion: catalog.catalogVersion, datasetVersion: catalog.datasetVersion,
        sourceRevision: catalog.sourceRevision, sourceSnapshots: catalog.sources, clubTransformVersion: 'club-seed-direct-v1' },
      clubs, rivalryGraph: createRivalrySparseGraph(edges), rivalryReferences, competitiveThreats };
  });
}
