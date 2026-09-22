import type { ClubResult } from '../club/ClubTypes';
import { targetsReader } from '../club/ClubSchemas';
import { attempt, enumeration, fail, index, list, nullable, object, positive, text, type Reader } from '../club/ClubValidation';
import { historicalFloorForReason } from '../rivalry/RivalryLifecycle';
import type { ClubCatalog, CatalogLookup } from './CatalogTypes';

export const normalizeCatalogName = (value: string): string => value.normalize('NFC').trim().toLowerCase();
const order = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
/** Catalog identifiers exclude control characters, including the legacy graph's NUL separator. */
const identifier: Reader<string> = (value, path) => {
  const out = text(value, path);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(out)) fail('INVALID_INPUT', path);
  return out;
};
const sha: Reader<string> = (value, path) => {
  const out = text(value, path); if (!/^[a-f0-9]{40}$/.test(out)) fail('INVALID_INPUT', path); return out;
};
const location = object({ sourceId: identifier, line: positive });
const source = object({ sourceId: identifier, path: text, blobSha: sha });
const league = object({ leagueId: identifier, displayName: text, clubCount: positive,
  sourceArchetype: enumeration(['REAL_BASEBALL_CLUB', 'REAL_FOOTBALL_CLUB_AS_BASEBALL_CLUB']) });
const club = object({ clubId: identifier, canonicalOriginId: identifier, leagueId: identifier, displayName: text,
  aliases: list(text, normalizeCatalogName), homeIdentity: object({ kind: text, label: text }),
  initialEconomicBand: enumeration(['MEGA', 'ELITE', 'HIGH', 'UPPER', 'MID', 'LOW']), targets: targetsReader,
  provenance: object({ identity: location, seed: location,
    confidenceClass: enumeration(['VERIFIED', 'SUPPORTED', 'DESIGN_ESTIMATE']), overrideReason: nullable(text) }) });
const rivalry = object({ edgeId: identifier, fromClubId: identifier, toClubId: identifier, intensity: index,
  reason: enumeration(['ICONIC_HISTORICAL', 'HISTORICAL_RIVAL', 'LOCAL_DERBY', 'NATIONAL_RIVAL',
    'CONTINENTAL_RIVAL', 'COMPETITIVE_RIVAL', 'TITLE_RIVAL', 'DOMINANT_CLUB_TARGET']), source: location });
const catalogReader: Reader<ClubCatalog> = object({ schemaVersion: enumeration([1]), catalogVersion: identifier,
  datasetVersion: identifier, sourceRevision: sha, sources: list(source, x => x.sourceId, true),
  leagues: list(league, x => x.leagueId, true), clubs: list(club, x => x.clubId, true), rivalries: list(rivalry, x => x.edgeId) });

/** Validates only the catalog contract, not external evidence authenticity or current-world facts. */
export function readCatalog(input: unknown): ClubCatalog {
  const c = catalogReader(input, 'catalog');
  const sources = new Set(c.sources.map(x => x.sourceId));
  const leagues = new Set(c.leagues.map(x => x.leagueId));
  const clubs = new Set(c.clubs.map(x => x.clubId));
  const origins = new Set<string>(); const pairs = new Set<string>();
  for (const x of c.clubs) {
    if (!leagues.has(x.leagueId)) fail('STATE_INCONSISTENT', 'catalog.clubs.leagueId');
    if (origins.has(x.canonicalOriginId)) fail('DUPLICATE_ID', 'catalog.clubs.canonicalOriginId');
    origins.add(x.canonicalOriginId);
    if (!sources.has(x.provenance.identity.sourceId) || !sources.has(x.provenance.seed.sourceId))
      fail('STATE_INCONSISTENT', 'catalog.clubs.provenance');
  }
  for (const x of c.leagues) if (c.clubs.filter(y => y.leagueId === x.leagueId).length !== x.clubCount)
    fail('STATE_INCONSISTENT', 'catalog.leagues.clubCount');
  for (const x of c.rivalries) {
    if (!clubs.has(x.fromClubId) || !clubs.has(x.toClubId) || x.fromClubId === x.toClubId)
      fail('STATE_INCONSISTENT', 'catalog.rivalries.endpoints');
    if (!sources.has(x.source.sourceId)) fail('STATE_INCONSISTENT', 'catalog.rivalries.source');
    const key = JSON.stringify([x.fromClubId, x.toClubId]);
    if (pairs.has(key)) fail('DUPLICATE_ID', 'catalog.rivalries.pair'); pairs.add(key);
    if (x.reason !== 'DOMINANT_CLUB_TARGET' && x.intensity < historicalFloorForReason(x.reason))
      fail('STATE_INCONSISTENT', 'catalog.rivalries.historicalFloor');
  }
  return { ...c, sources: [...c.sources].sort((a, b) => order(a.sourceId, b.sourceId)),
    leagues: [...c.leagues].sort((a, b) => order(a.leagueId, b.leagueId)),
    clubs: [...c.clubs].sort((a, b) => order(a.clubId, b.clubId)),
    rivalries: [...c.rivalries].sort((a, b) => order(a.edgeId, b.edgeId)) };
}
export const createClubCatalog = (input: unknown): ClubResult<ClubCatalog> => attempt(() => readCatalog(input));

/** No fuzzy spelling, inferred alias, ID-as-name shortcut, or first-match tie breaking. */
export function findCatalogClub(catalog: unknown, input: unknown): ClubResult<CatalogLookup> {
  return attempt(() => {
    const c = readCatalog(catalog);
    const q = object({ name: text, leagueId: nullable(identifier) })(input, 'query');
    const name = normalizeCatalogName(q.name);
    const clubIds = c.clubs.filter(x => (q.leagueId === null || x.leagueId === q.leagueId)
      && [x.displayName, ...x.aliases].some(alias => normalizeCatalogName(alias) === name)).map(x => x.clubId);
    return { status: clubIds.length === 0 ? 'NOT_FOUND' : clubIds.length === 1 ? 'FOUND' : 'AMBIGUOUS', clubIds };
  });
}
