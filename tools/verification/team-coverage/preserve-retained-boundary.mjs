import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const [directoryArgument, attemptArgument, failedMode = 'defender-observation-2'] = process.argv.slice(2); assert.ok(directoryArgument && attemptArgument);
assert.match(attemptArgument, /^[a-z0-9-]+$/);
assert.match(failedMode, /^[a-z0-9-]+$/);
const directory = resolve(directoryArgument), resume = join(directory, 'retained-resume');
const destination = join(directory, attemptArgument); assert.ok(!existsSync(destination));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashFile = path => sha(readFileSync(path));
mkdirSync(destination); mkdirSync(join(destination, 'original-files'));
const files = [];
const preserve = current => {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const from = join(current, entry.name), rel = relative(resume, from), to = join(destination, 'original-files', rel);
    assert.ok(!rel.startsWith('..') && !entry.isSymbolicLink(), 'preserve only exact workspace files');
    if (entry.isDirectory()) { mkdirSync(to); preserve(from); }
    else if (entry.isFile()) {
      const before = hashFile(from); copyFileSync(from, to, constants.COPYFILE_EXCL);
      assert.equal(hashFile(to), before); assert.equal(hashFile(from), before);
      files.push({ relativePath: rel, sha256: before });
    }
  }
};
preserve(resume);
const path = join(resume, 'resume.sqlite'), closedPath = join(destination, 'closed-prefix.sqlite');
const db = new DatabaseSync(path, { readOnly: true });
try { db.prepare('VACUUM INTO ?').run(closedPath); } finally { db.close(); }
const closed = new DatabaseSync(closedPath, { readOnly: true });
let census;
try {
  assert.equal(closed.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  const target = closed.prepare('SELECT source_id,source_hash,snapshot_hash FROM pa_physical_v1_field_steps WHERE source_id=?')
    .get('team-retained:field:defender-observation-2') ?? null;
  const views = closed.prepare('SELECT source_id,source_hash,snapshot_hash FROM pa_lifecycle_v1_execution_views ORDER BY rowid DESC LIMIT 1').get();
  const fields = closed.prepare('SELECT source_id,source_hash,snapshot_hash FROM pa_physical_v1_field_steps ORDER BY rowid DESC LIMIT 1').get();
  const targetSource = new Map(JSON.parse(readFileSync(join(resume, 'accepted-sources.json'), 'utf8'))).get('team-retained:field:defender-observation-2') ?? null;
  census = { target, latestView: views, latestFieldStep: fields, targetSourcePublished: targetSource !== null,
    observation2OwnerReceiptExists: existsSync(join(resume, 'defender-observation-2-receipt.json')),
    observation2InitialReadReceiptExists: existsSync(join(resume, 'read-reopen-defender-observation-2-receipt.json')),
    calibration17Rows: closed.prepare('SELECT count(*) AS n FROM pa_lifecycle_v1_execution_calibrations WHERE view_source_id=?').get('team-retained:cut17:view').n };
} finally { closed.close(); }
for (const f of files) assert.equal(hashFile(join(resume, f.relativePath)), f.sha256);
const failedLog = JSON.parse(readFileSync(join(resume, 'stage-child-logs', failedMode + '.json'), 'utf8'));
const manifest = { status: 'PRESERVED_RAW_BOUNDARY_CLOSED_BACKUP_OWNER_AUTHENTICATION_REQUIRED', destination, closedPath,
  closedDatabaseHash: hashFile(closedPath), sourceMapPath: join(destination, 'original-files', 'accepted-sources.json'),
  sourceMapHash: hashFile(join(destination, 'original-files', 'accepted-sources.json')), files, census,
  failedStage: { mode: failedMode, exitCode: failedLog.exitCode, elapsedMilliseconds: failedLog.elapsedMilliseconds,
    stderr: failedLog.stderr, cause: 'UNKNOWN' },
  teamExecutionCredit: 0, officialResult: null };
writeFileSync(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ ...manifest, files: { count: files.length } }));
