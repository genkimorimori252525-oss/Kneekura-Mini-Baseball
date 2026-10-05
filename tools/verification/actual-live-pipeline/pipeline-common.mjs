import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, openSync, readFileSync, readSync, readdirSync, readlinkSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isAbsolute, join, relative, resolve } from 'node:path';

export const digest = value => createHash('sha256').update(value).digest('hex');
export const fileHash = path => {
  const hash = createHash('sha256'), buffer = Buffer.allocUnsafe(1024 * 1024), fd = openSync(path, 'r');
  try { for (;;) { const count = readSync(fd, buffer, 0, buffer.length, null); if (!count) break; hash.update(buffer.subarray(0, count)); } }
  finally { closeSync(fd); }
  return hash.digest('hex');
};
export const jsonRead = path => JSON.parse(readFileSync(path, 'utf8'));
export const writeNewJson = (path, value) => {
  const fd = openSync(path, 'wx');
  try { writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`); fsyncSync(fd); } finally { closeSync(fd); }
};
export const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
export const requireAbsolute = (value, name) => { assert(typeof value === 'string' && isAbsolute(value), `${name} must be absolute`); return resolve(value); };
export const requireHash = (value, name) => { assert.match(value, /^[a-f0-9]{64}$/, `${name} must be an exact SHA-256`); return value; };
export const sourceFiles = root => {
  const files = new Set(git(root, 'ls-files', '-z').split('\0').filter(Boolean));
  const walk = path => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      assert(!entry.isSymbolicLink(), `runtime Source symlink requires explicit review: ${full}`);
      if (entry.isDirectory()) walk(full); else if (entry.isFile()) files.add(relative(root, full));
    }
  };
  walk(join(root, 'src'));
  return [...files].sort().map(path => {
    assert(!isAbsolute(path) && !path.split('/').includes('..'));
    const full = join(root, path); assert(lstatSync(full).isFile(), `non-file Source: ${path}`);
    return { path, sha256: fileHash(full) };
  });
};
export const verifySource = (manifestPath, expectedSha256, expectedRoot, expectedCommit) => {
  assert.equal(fileHash(manifestPath), requireHash(expectedSha256, 'sourceManifestSha256'));
  const manifest = jsonRead(manifestPath), root = realpathSync(requireAbsolute(expectedRoot, 'sourceRoot'));
  assert.equal(manifest.schema, 'actual_artifact_pipeline_source_v1');
  assert.equal(manifest.sourceRoot, root); assert.equal(manifest.sourceCommit, expectedCommit);
  assert.equal(git(root, 'rev-parse', 'HEAD'), expectedCommit);
  assert.equal(git(root, 'diff', '--name-only', 'HEAD'), '', 'tracked Source changed');
  assert.equal(git(root, 'rev-parse', 'HEAD^{tree}'), manifest.sourceTree);
  const tracked = new Set(git(root, 'ls-files', '-z').split('\0').filter(Boolean));
  for (const name of ['pipeline.mjs', 'pipeline-common.mjs', 'physical-producer-evidence.mjs', 'physical-producer-files.mjs', 'known-profile-producer-evidence.mjs', 'known-profile-producer-files.mjs',
    'inherited-official-evidence.mjs', 'inherited-official-files.mjs', 'inherited-role-evidence.mjs', 'inherited-role-files.mjs',
    'official-read-replay.mjs', 'official-read-replay-helper.ts', 'official-read-replay-evidence.mjs', 'replay_scope_contract.py', 'run-official-read-replay.py',
    'admit-official-read-replay-only.mjs', 'official-read-replay-files.mjs', 'role-input-preflight.ts', 'run-role-stage.py', 'admit-role-only.mjs',
    'next-input-preflight.ts', 'run-next-stage.py', 'admit-next-only.mjs', 'role-read-replay.mjs', 'role-read-replay-evidence.mjs', 'role-read-replay-files.mjs', 'role-read-replay-helper.ts', 'admit-role-read-replay-only.mjs', 'run-role-read-replay.py',
    'runtime-probe.cjs', 'run-pipeline.sh', 'supervise-pipeline.py', 'pipeline-scope.mjs', 'scope_contract.py', 'vite.config.mjs']) {
    assert(tracked.has(`tools/verification/actual-live-pipeline/${name}`), 'the executed wrapper must be committed with the Source cut');
  }
  const current = sourceFiles(root);
  assert.deepEqual(current, manifest.files, 'Source file names or bytes changed');
  return { sourceRoot: root, sourceCommit: expectedCommit, sourceTree: git(root, 'rev-parse', 'HEAD^{tree}'), sourceManifestSha256: expectedSha256,
    runtimeFileCount: current.length, sourceFilesDigest: digest(JSON.stringify(current)) };
};
export const openSqliteHandles = paths => readdirSync('/proc/self/fd').flatMap(fd => {
  try { const target = readlinkSync(`/proc/self/fd/${fd}`); return paths.some(path => target === path || target === `${path}-wal` || target === `${path}-shm`) ? [{ fd, target }] : []; }
  catch { return []; }
});
export const assertClosedMainFile = path => {
  assert(statSync(path).isFile());
  assert(!existsSync(`${path}-wal`) || statSync(`${path}-wal`).size === 0, `nonempty WAL remains: ${path}`);
  assert.deepEqual(openSqliteHandles([path]), [], `SQLite handle remains open: ${path}`);
};
