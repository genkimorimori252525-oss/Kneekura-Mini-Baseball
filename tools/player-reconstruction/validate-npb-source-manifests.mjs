/**
 * NPB historical source discovery manifest validator.
 *
 * NON-SCRAPING / OFFLINE ONLY. Does not download or copy 3rd-party baseball data.
 *
 * Run: node tools/player-reconstruction/validate-npb-source-manifests.mjs
 * Contract: historical 1936 spring/fall era + 1945 gap + 1950 CL/PL + 2026 as-of.
 * Only validates metadata/consistency, not historical correctness or URL existence.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const sourcesDir = resolve(here, '../../docs/player-reconstruction/sources');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseJson(path) {
  return readFile(resolve(sourcesDir, path), 'utf8').then(JSON.parse);
}

const [yearIndex, registry] = await Promise.all([
  parseJson('npb-official-season-index.json'),
  parseJson('npb-evidence-source-registry.json'),
]);

assert(yearIndex.dataIncluded === false, 'year-index accidentally claims player data was ingested');
assert(yearIndex.perPlayerStatistics === false, 'year-index incorrectly reports full player statistics');
assert(yearIndex.source === 'https://npb.jp/bis/yearly/', 'unexpected source origin');

const seasons = yearIndex.seasonKeys;
const ids = seasons.map(x => x.id);
const urls = seasons.filter(x => x.url !== null).map(x => x.url);
const historical = seasons.filter(x => x.status === 'COMPLETE_HISTORICAL_INDEX');
const live = seasons.filter(x => x.status === 'AS_OF_CHECK_REQUIRED');
const suspended = seasons.filter(x => x.status === 'NO_REGULAR_LEAGUE_SEASON');
assert(seasons.length === 171, 'unexpected season count');
assert(new Set(ids).size === ids.length, 'duplicate league-season IDs');
assert(new Set(urls).size === urls.length, 'duplicate source URLs');
assert(historical.length === 168, 'expected 168 completed historical league-season source references');
assert(live.length === 2, 'expected two unverified 2026 live snapshot source references');
assert(suspended.length === 1 && suspended[0].year === 1945 && suspended[0].url === null,
  '1945 must be a suspended regular-league year with no fake URL');

const required = [
  'JBL-1936-INITIAL_TOURNAMENT', 'JBL-1936-FALL',
  'JBL-1937-SPRING','JBL-1937-FALL',
  'JBL-1938-SPRING','JBL-1938-FALL',
  'JBL-1944-FULL','JBL-1945-SUSPENDED','JBL-1946-FULL',
  'CL-1950-FULL','PL-1950-FULL',
  'CL-1973-FULL','PL-1973-FULL',
  'CL-1975-FULL','PL-1975-FULL',
  'CL-2025-FULL','PL-2025-FULL',
  'CL-2026-FULL','PL-2026-FULL',
];
const seen = new Set(ids);
for (const id of required) assert(seen.has(id), \`missing historical season: \${id}\`);

for(const x of seasons) {
 assert(x.year >= 1936 && x.year <= 2026, 'invalid year ' + x.id);
 if(x.status === 'AS_OF_CHECK_REQUIRED') assert(x.year === 2026, 'noncurrent year marked live');
 if(x.url) {
  assert(x.url.startsWith('https://npb.jp/bis/yearly/'), 'foreign URL ' + x.id);
  assert(x.urlEvidence === 'SAMPLED_IN_WEB_SEARCH_2026_10_16' ||
    x.urlEvidence === 'PATTERN_INFERRED_NOT_INDIVIDUALLY_FETCHED',
    'year index URL provenance missing ' + x.id);
 }
}
const sourceRows = registry.records;
assert(sourceRows.length === 19, 'expected 19 sources');
assert(new Set(sourceRows.map(x => x.id)).size === sourceRows.length, 'source registry duplicate IDs');
for(const x of sourceRows) {
 assert(x.canBulkImport === false, 'a research source was incorrectly granted automatic bulk-ingestion rights: '+x.id);
 assert(x.copyAssetsWithoutPermission === false, 'unapproved asset copying '+x.id);
 assert(x.url.startsWith('https://'), 'source must use https '+x.id);
 assert(x.rights && x.quality && x.checkedAt, 'insufficient provenance '+x.id);
}

const metrics = {
  sourceSources: sourceRows.length,
  seasonReferences: seasons.length,
  completedHistoricalReferences: historical.length,
  liveAsOfReferences: live.length,
  suspendedRegularLeagues: suspended.length,
  sampledSearchURLs: seasons.filter(x => x.urlEvidence === 'SAMPLED_IN_WEB_SEARCH_2026_10_16').length,
  unverifiedPatternURLs: seasons.filter(x => x.urlEvidence === 'PATTERN_INFERRED_NOT_INDIVIDUALLY_FETCHED').length,
  importedHistoricalPlayerRows: 0,
  permittedAutomaticBulkImports: 0,
  mode: 'OFFLINE_REFERENCE_METADATA_VALIDATION_ONLY',
};
console.log('NPB_SOURCE_MANIFEST_METADATA_CHECK=PASS');
console.log(JSON.stringify(metrics, null, 2));
