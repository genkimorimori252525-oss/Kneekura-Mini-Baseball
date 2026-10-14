// Preparation only: never imports a Native owner or launches Vitest.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const SOURCE_TREE = 'b8e99a25cb5aa9afce821f27071687d13893c225';
const GIT_INPUTS = Object.freeze({
  src: SOURCE_TREE,
  'package.json': '91198b2a82000f9d999c0f646b0adaae76afe171',
  'package-lock.json': 'e72b7f40e205200e30b576e66c8790d33030d7fd',
  'tsconfig.json': '22265b6c561489e99322b8479121a5cc18c9da80',
  data: 'fd48cc7b33290ae89abbc0686f65d9ecb68d2408',
  'tools/catalog': 'dbbf0901cc4b185f979499399e048959c3a43b0e',
});
const PIN = Object.freeze({
  gzipBytes: 1_402_518,
  gzipSha256: '18605d0643eb51e69c9e290fef93c436a77275c16b172d059ce869dcd83fcd50',
  databaseBytes: 22_654_976,
  databaseSha256: '60b73b1f5f5289cb9c86f128f129bde0d5ea7d8bda4be9805566589198082ee3',
  headHash: '9da947d628e0f4bffd6d4b6c1ea2a5c6ae7405f37c577f98f2b7de10615c2f2a',
  projectionSha256: 'e9f260dd6d7688dac9483142855a9af0747c452a40d11d470b3d039fa3751d18',
});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const root = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const outsideCheckout = path => {
  const suffix = relative(root, path);
  assert(suffix === '..' || suffix.startsWith('..' + sep) || isAbsolute(suffix),
    'owner input and run output must be outside the checkout');
};
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });

assert.equal(process.version, 'v26.10.0', 'use the reviewed Node 26.10.0 runtime');
const [descriptorArgument, ...extra] = process.argv.slice(2);
assert(descriptorArgument && extra.length === 0,
  'usage: node tools/handoff/prepare-lan01-cp1.mjs <descriptor.json>');
const descriptorPath = realpathSync(resolve(descriptorArgument));
outsideCheckout(descriptorPath);
assert(lstatSync(descriptorPath).isFile(), 'descriptor must be a regular file');
const descriptor = JSON.parse(readFileSync(descriptorPath, 'utf8'));
assert.deepEqual(Object.keys(descriptor).sort(), ['checkpointGzip', 'destinationDirectory', 'nativeReleased']);
assert.equal(typeof descriptor.nativeReleased, 'boolean', 'nativeReleased must be an explicit boolean');
for (const key of ['checkpointGzip', 'destinationDirectory'])
  assert(typeof descriptor[key] === 'string' && descriptor[key].length > 0, 'descriptor paths are required');
const inputPath = resolve(dirname(descriptorPath), descriptor.checkpointGzip);
assert.equal(realpathSync(inputPath), inputPath, 'gzip path must be canonical; symlinks are not accepted');
assert(lstatSync(inputPath).isFile(), 'gzip must be a regular file');
outsideCheckout(inputPath);
const destinationDirectory = resolve(dirname(descriptorPath), descriptor.destinationDirectory);
assert.equal(destinationDirectory.split(sep).at(-1), 'suffix', 'use the suffix subdirectory for the original loader');
const runDirectory = dirname(destinationDirectory);
assert.equal(realpathSync(dirname(runDirectory)), dirname(runDirectory), 'run parent must exist and be canonical');
outsideCheckout(runDirectory);
assert(!existsSync(runDirectory), 'run directory must be new; never reuse an interrupted output');

// Pin both the Git object and the working files; a later source requires its
// own reviewed qualification, not an override flag or relaxed byte expectations.
const sourceTree = git(['rev-parse', 'HEAD:src']);
for (const [path, object] of Object.entries(GIT_INPUTS))
  assert.equal(git(['rev-parse', 'HEAD:' + path]), object, 'Git input identity differs: ' + path);
const scope = Object.keys(GIT_INPUTS);
git(['diff', '--exit-code', 'HEAD', '--', ...scope]);
const extraInputs = git(['ls-files', '--others', '--', ...scope]).split('\n').filter(Boolean)
  .filter(path => path !== 'src/core/world/catalog/GeneratedClubCatalog.ts');
assert.deepEqual(extraInputs, [], 'untracked source input is not allowed');
const versions = {
  '@types/node': '26.6.1', typescript: '5.6.3', vitest: '2.1.9',
  vite: '5.4.21', rollup: '4.63.3', esbuild: '0.21.5',
};
for (const [name, version] of Object.entries(versions))
  assert.equal(JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version, version,
    'installed dependency differs: ' + name);
execFileSync(process.execPath, ['tools/catalog/compile-catalog.mjs', '--check'], { cwd: root, stdio: 'pipe' });

const compressed = readFileSync(inputPath);
assert.equal(compressed.length, PIN.gzipBytes);
assert.equal(hash(compressed), PIN.gzipSha256, 'wrong owner-supplied gzip');
const bytes = gunzipSync(compressed, { maxOutputLength: PIN.databaseBytes });
assert.equal(bytes.length, PIN.databaseBytes);
assert.equal(hash(bytes), PIN.databaseSha256, 'wrong decompressed database');
mkdirSync(runDirectory, { mode: 0o700 });
const inspectionCopy = join(runDirectory, 'preflight.sqlite');
writeFileSync(inspectionCopy, bytes, { flag: 'wx', mode: 0o400 });
assert.equal(hash(readFileSync(inspectionCopy)), PIN.databaseSha256);
const db = new DatabaseSync(inspectionCopy, { readOnly: true });
try {
  db.exec('PRAGMA query_only=ON');
  assert.deepEqual(db.prepare('PRAGMA integrity_check').all().map(row => row.integrity_check), ['ok']);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all();
  assert.equal(tables.length, 121);
  const count = table => Number(db.prepare('SELECT count(*) n FROM "' + table.replaceAll('"', '""') + '"').get().n);
  assert.equal(tables.reduce((sum, row) => sum + count(row.name), 0), 1985);
  assert.equal(count('actual_post_play_review_sessions'), 1);
  assert.equal(count('actual_post_play_review_heads'), 1);
  assert.equal(count('actual_post_play_review_events'), 1);
  assert.deepEqual({ ...db.prepare('SELECT * FROM actual_post_play_review_heads').get() }, {
    session_source_id: 'lan01:journal:session', revision: 1,
    head_source_id: 'lan01:journal:import', head_hash: PIN.headHash,
  });
  const event = db.prepare('SELECT * FROM actual_post_play_review_events').get();
  assert.equal(event.source_id, 'lan01:journal:import');
  assert.equal(event.revision, 1);
  assert.equal(event.snapshot_hash, PIN.projectionSha256);
  assert.equal(hash(event.snapshot_json), PIN.projectionSha256);
  const projection = JSON.parse(event.snapshot_json);
  assert.equal(projection.revision, 1);
  assert.equal(projection.events.length, 1);
  assert.equal(projection.ledger.revision, 4);
  assert.equal(projection.kind, 'official_pending');
  assert.equal(projection.events[0].liveAppealImport.rights.kind, 'pending');
  assert(projection.pendingReasons.includes('original_live_ball_and_appeal_rights_required'));
  const match = db.prepare('SELECT durable_revision,state_json FROM matches WHERE match_id=?').get('game-1');
  assert.equal(match.durable_revision, 1);
  assert.equal(JSON.parse(match.state_json).outs, 0);
  assert.equal(count('applications'), 1); // Prior walk, not the pending appeal.
  assert.equal(count('official_scoring_applications'), 1);
  assert.equal(count('physical_play_closures'), 0);
  assert.equal(db.prepare('SELECT count(*) n FROM pa_lifecycle_v1_outcomes WHERE source_id=?').get('lan01:terminal:outcome').n, 0);
} finally {
  db.close();
}
assert.equal(hash(readFileSync(inputPath)), PIN.gzipSha256, 'supplied gzip changed during preparation');
assert.equal(hash(readFileSync(inspectionCopy)), PIN.databaseSha256, 'inspection copy changed');
mkdirSync(join(runDirectory, 'tmp'), { mode: 0o700 });
writeJson(join(runDirectory, 'preflight.json'), {
  kind: 'lan01_cp1_byte_and_sqlite_preflight_v1', sourceCommit: git(['rev-parse', 'HEAD']), sourceTree,
  nodeVersion: process.version, dependencies: versions, ...PIN,
  integrity: 'ok', foreignKeyViolations: 0, tables: 121, rows: 1985,
  reviewRevision: 1, reviewEvents: 1, ledgerRevision: 4, rights: 'pending',
  matchRevision: 1, matchOuts: 0, nativeAuthenticationCompleted: false, wholeCasePass: false,
});
writeJson(join(runDirectory, 'retained-input.json'), {
  nativeReleased: descriptor.nativeReleased,
  checkpointGzip: inputPath,
  destinationDirectory,
});
console.log('Prepared an independent inspection copy and retained-input.json. Native execution has not started.');
if (!descriptor.nativeReleased) console.log('Native release remains false, as supplied in the descriptor.');
