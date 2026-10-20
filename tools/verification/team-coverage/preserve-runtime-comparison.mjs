import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Raw boundary preservation only. Does not authenticate an owner or retry admission.
const directory = resolve(process.argv[2]);
const boundaryName = process.argv[3] ?? 'failure-preservation';
assert.match(boundaryName, /^[a-z0-9-]+$/);
const destination = join(directory, boundaryName);
assert.ok(!existsSync(destination)); mkdirSync(destination);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fileHash = path => hash(readFileSync(path));
const files = [];
const preserve = (from, to, relative = '') => {
  mkdirSync(to);
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    assert.ok(!entry.isSymbolicLink());
    const source = join(from, entry.name), target = join(to, entry.name), rel = join(relative, entry.name);
    if (entry.isDirectory()) preserve(source, target, rel);
    else if (entry.isFile()) {
      const before = fileHash(source); copyFileSync(source, target, constants.COPYFILE_EXCL);
      assert.equal(fileHash(target), before); assert.equal(fileHash(source), before);
      files.push({ path: rel, sha256: before });
    }
  }
};
preserve(join(directory, 'retained-resume'), join(destination, 'original-files'));
const attempt = JSON.parse(readFileSync(join(directory, 'runtime-result.json'), 'utf8'));
for (const name of ['runtime-attempt.json', 'runtime-result.json', 'child.stdout.log', 'child.stderr.log']) {
  const source = join(directory, name);
  if (existsSync(source)) { copyFileSync(source, join(destination, name), constants.COPYFILE_EXCL); files.push({ path: name, sha256: fileHash(source) }); }
}
const original = join(directory, 'retained-resume', 'resume.sqlite');
const originalHash = fileHash(original), closedPath = join(destination, 'closed-prefix.sqlite');
const db = new DatabaseSync(original, { readOnly: true });
try { db.prepare('VACUUM INTO ?').run(closedPath); } finally { db.close(); }
assert.equal(fileHash(original), originalHash);
const closed = new DatabaseSync(closedPath, { readOnly: true });
let census;
try {
  census = {
    integrity: closed.prepare('PRAGMA integrity_check').get().integrity_check,
    cal19Rows: closed.prepare('SELECT count(*) AS n FROM pa_lifecycle_v1_execution_calibrations WHERE view_source_id=?').get('team-retained:cut19:view').n,
    latestView: closed.prepare('SELECT source_id,source_hash,snapshot_hash FROM pa_lifecycle_v1_execution_views ORDER BY rowid DESC LIMIT 1').get(),
    latestField: closed.prepare('SELECT source_id,source_hash,snapshot_hash FROM pa_physical_v1_field_steps ORDER BY rowid DESC LIMIT 1').get(),
  };
} finally { closed.close(); }
const sourceMapPath = join(destination, 'original-files', 'accepted-sources.json');
const sourceMapHash = fileHash(sourceMapPath);
assert.equal(sourceMapHash, attempt.parentSourceMapHash);
const manifest = {
  status: attempt.exitCode === 0 ? 'PRESERVED_DIAGNOSTIC_ADMISSION_BOUNDARY_OWNER_AUTHENTICATION_REQUIRED'
    : 'PRESERVED_FAILED_ADMISSION_RAW_BOUNDARY_OWNER_AUTHENTICATION_NOT_CLAIMED',
  attempt, destination, closedPath, closedDatabaseHash: fileHash(closedPath), originalDatabaseHash: originalHash,
  sourceMapPath, sourceMapHash, census, files,
  stdoutPresent: existsSync(join(directory, 'child.stdout.log')), stderrPresent: existsSync(join(directory, 'child.stderr.log')),
  cause: 'UNKNOWN', teamExecutionCredit: 0, officialResult: null,
};
writeFileSync(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ ...manifest, files: { count: files.length } }));
