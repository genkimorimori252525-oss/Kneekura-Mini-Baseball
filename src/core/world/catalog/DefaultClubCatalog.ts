import { CATALOG_HEADER, CLUB_ROWS, LEAGUE_ROWS, RIVALRY_ROWS } from './GeneratedClubCatalog';
import { createClubCatalog } from './ClubCatalog';
import type { ClubCatalog } from './CatalogTypes';
const result = createClubCatalog({ ...CATALOG_HEADER,
  leagues: LEAGUE_ROWS.map(([leagueId, displayName, clubCount, sourceArchetype]) => ({ leagueId, displayName, clubCount, sourceArchetype })),
  clubs: CLUB_ROWS.map(([clubId, canonicalOriginId, leagueId, displayName, kind, label, initialEconomicBand,
    identitySource, identityLine, seedSource, seedLine, [finance, popularity, development, scouting, venue]]) => ({
    clubId, canonicalOriginId, leagueId, displayName,
    aliases: displayName.includes(' / ') ? displayName.split(' / ') : [],
    homeIdentity: { kind, label }, initialEconomicBand, targets: { finance, popularity, development, scouting, venue },
    provenance: { identity: { sourceId: identitySource, line: identityLine }, seed: { sourceId: seedSource, line: seedLine },
      confidenceClass: 'DESIGN_ESTIMATE', overrideReason: null },
  })),
  rivalries: RIVALRY_ROWS.map(([edgeId, fromClubId, toClubId, intensity, reason, line]) => ({
    edgeId, fromClubId, toClubId, intensity, reason, source: { sourceId: 'doc30', line },
  })),
});
if (!result.ok) throw new Error('Invalid compiled club catalog: ' + JSON.stringify(result.reason));
const defaultCatalog = result.value;
/** Immutable v1 snapshot. Never consults a network, disk, current roster, or running career. */
export const getDefaultClubCatalog = (): ClubCatalog => defaultCatalog;
