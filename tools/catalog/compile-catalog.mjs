// Offline compiler only. Runtime consumes literals, never current catalogs from disk.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const dir = 'data/world-club-catalog-v1/';
const manifest = JSON.parse(readFileSync(dir + 'source-manifest.json', 'utf8'));
const registry = JSON.parse(readFileSync(dir + 'identity-registry.json', 'utf8'));
const documents = new Map();
for (const source of manifest.sources) {
  const bytes = readFileSync(dir + 'sources/' + source.path.split('/').pop());
  const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(hash, source.blobSha, `Source changed: ${source.path}; do not reseed an existing dataset version`);
  documents.set(source.sourceId, bytes.toString('utf8').split(/\r?\n/));
}
const cells = line => line.startsWith('|') ? line.split('|').slice(1, -1).map(s => s.trim()) : [];
const seeds = new Map(), identities = new Map(), policies = new Map();
for (const line of documents.get('doc21')) {
  const c = cells(line); if (c.length === 3 && /^REAL_/.test(c[2])) policies.set(c[1], c[2]);
}
for (const id of ['doc27', 'doc28', 'doc29']) {
  let league;
  documents.get(id).forEach((line, index) => {
    if (line.startsWith('## ')) league = line.slice(3);
    const c = cells(line);
    if (c.length === 6 && c.slice(1).every(x => /^\d+\([A-GS]\)$/.test(x))) {
      assert.ok(!seeds.has(c[0]), `duplicate seed name ${c[0]}`);
      seeds.set(c[0], { league, sourceId: id, line: index + 1, values: c.slice(1).map(x => Number(x.split('(')[0])) });
    }
  });
}
for (const id of ['doc17','doc22','doc23','doc24','doc25']) {
  let header = [];
  documents.get(id).forEach((line, index) => {
    const c = cells(line);
    if (c[0] === 'Club') header = c;
    else if (seeds.has(c[0]) && header[0] === 'Club') {
      assert.ok(!identities.has(c[0]), `duplicate identity ${c[0]}`);
      const bandIndex = header.findIndex(x => /Band|Economic|Resource/.test(x));
      assert.ok(bandIndex >= 0);
      assert.match(c[bandIndex], /^(MEGA|ELITE|HIGH|UPPER|MID|LOW)$/);
      identities.set(c[0], [header[1], c[1], c[bandIndex], id, index + 1]);
    }
  });
}
assert.equal(registry.schemaVersion, 1); assert.equal(seeds.size, 234); assert.equal(identities.size, 234);
assert.equal(registry.clubs.length, 234); assert.equal(registry.leagues.length, 21);
const leagueNames = new Map(registry.leagues.map(([id, name]) => [id, name]));
const clubRows = [], ids = new Set(), origins = new Set(), names = new Set(), lookup = new Map();
const normalize = name => name.normalize('NFC').trim().toLowerCase();
for (const [id, origin, league, name] of registry.clubs) {
  assert.match(id, /^[A-Za-z0-9][A-Za-z0-9._:-]*$/, 'invalid registry club ID');
  assert.match(origin, /^[A-Za-z0-9][A-Za-z0-9._:-]*$/, 'invalid registry origin ID');
  assert.ok(!ids.has(id) && !origins.has(origin) && !names.has(name), 'registry identity collision');
  ids.add(id); origins.add(origin); names.add(name);
  const seed = seeds.get(name), identity = identities.get(name);
  assert.ok(seed && identity, `Unresolved registry row ${id}`);
  assert.equal(seed.league, leagueNames.get(league), `registry league differs: ${id}`);
  clubRows.push([id, origin, league, name, ...identity, seed.sourceId, seed.line, seed.values]);
  for (const alias of new Set([name, ...name.split(' / ')])) {
    const key = normalize(alias);
    assert.ok(!lookup.has(key) || lookup.get(key) === id, `ambiguous source name ${alias}`);
    lookup.set(key, id);
  }
}
const leagueRows = registry.leagues.map(([id, name, count]) => {
  assert.equal(clubRows.filter(x => x[2] === id).length, count);
  const policy = policies.get(name); assert.ok(policy, `missing source policy ${name}`);
  return [id, name, count, policy];
});
const rivalryRows = []; const pairs = new Set();
documents.get('doc30').forEach((line, index) => {
  const c = cells(line); if (c.length !== 4 || !/^\d+$/.test(c[2])) return;
  const from = lookup.get(normalize(c[0])), to = lookup.get(normalize(c[1]));
  assert.ok(from && to && from !== to, `unresolved endpoints at doc30:${index+1}`);
  const key = JSON.stringify([from,to]); assert.ok(!pairs.has(key), 'duplicate pair'); pairs.add(key);
  rivalryRows.push([`rivalry:${from}:${to}`, from, to, Number(c[2]), c[3], index + 1]);
});
assert.equal(rivalryRows.length, 148);
const ordered = rows => rows.sort((a,b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
const literal = rows => '[\n' + ordered(rows).map(row => '  ' + JSON.stringify(row)).join(',\n') + '\n] as const;\n';
const header = { schemaVersion: 1, catalogVersion: 'world-club-catalog-v1', datasetVersion: 'club-initial-seeds-v1',
  sourceRevision: manifest.sourceRevision, sources: manifest.sources };
const output = '// Generated from pinned source blobs and an explicit persistent identity registry.\n'
  + '// Edit the versioned registry/compiler, not these rows. No runtime ID derivation from names.\n'
  + 'export const CATALOG_HEADER = ' + JSON.stringify(header, null, 2) + ' as const;\n'
  + 'export const LEAGUE_ROWS = ' + literal(leagueRows)
  + 'export const CLUB_ROWS = ' + literal(clubRows)
  + 'export const RIVALRY_ROWS = ' + literal(rivalryRows);
const target = 'src/core/world/catalog/GeneratedClubCatalog.ts';
if (process.argv.includes('--check')) assert.equal(readFileSync(target,'utf8'), output, 'compiled catalog differs from source');
else writeFileSync(target, output);
console.log('Verified 234 identities, 1170 seed values, 21 leagues and 148 directed source rows.');
