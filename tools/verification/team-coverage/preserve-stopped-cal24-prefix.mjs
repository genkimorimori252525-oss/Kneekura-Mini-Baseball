import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const directory = resolve(process.argv[2]), resume = join(directory, 'retained-resume');
const destination = join(directory, 'legacy-cal24-stopped-checkpoint');
assert.ok(!existsSync(destination));
const stop = JSON.parse(readFileSync(join(directory, 'stop-controls', 'stop-after-cal24.json'), 'utf8'));
assert.equal(stop.kind, 'STOP_CONTROL'); assert.equal(stop.nextMode, 'defender-decision-5');
const terminal = JSON.parse(readFileSync(join(resume, 'stage-child-logs', 'declare-cut24-calibrations.json'), 'utf8'));
assert.equal(terminal.exitCode, 0); assert.equal(terminal.childPid, stop.currentChildPid);
assert.ok(!existsSync(join(resume, 'stage-child-logs', 'defender-decision-5.json')));
mkdirSync(destination); const files = [];
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), fileHash = path => sha(readFileSync(path));
const preserve = (source, target, relative = '') => {
  mkdirSync(target);
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    assert.ok(!entry.isSymbolicLink());
    const from = join(source, entry.name), to = join(target, entry.name), rel = join(relative, entry.name);
    if (entry.isDirectory()) preserve(from, to, rel);
    else if (entry.isFile()) {
      const before = fileHash(from); copyFileSync(from, to, constants.COPYFILE_EXCL);
      assert.equal(fileHash(to), before); assert.equal(fileHash(from), before); files.push({ path: rel, sha256: before });
    }
  }
};
preserve(resume, join(destination, 'original-files'));
writeFileSync(join(destination, 'STOP_CONTROL.json'), JSON.stringify(stop, null, 2), { flag: 'wx' });
const originalPath = join(resume, 'resume.sqlite'), originalDatabaseHash = fileHash(originalPath);
const closedPath = join(destination, 'closed-prefix.sqlite'), db = new DatabaseSync(originalPath, { readOnly: true });
try { db.prepare('VACUUM INTO ?').run(closedPath); } finally { db.close(); }
assert.equal(fileHash(originalPath), originalDatabaseHash);
const sourceMapPath = join(destination, 'original-files', 'accepted-sources.json');
const sources = new Map(JSON.parse(readFileSync(sourceMapPath, 'utf8')));
const closed = new DatabaseSync(closedPath, { readOnly: true }); let census;
try {
  assert.equal(closed.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  const view = closed.prepare('SELECT source_id,source_hash,snapshot_hash FROM pa_lifecycle_v1_execution_views ORDER BY rowid DESC LIMIT 1').get();
  assert.equal(view.source_id, 'team-retained:cut24:view');
  const rows = closed.prepare('SELECT source_id,source_hash,snapshot_hash,snapshot_json FROM pa_physical_v1_field_steps ORDER BY rowid').all();
  const observations = rows.filter(row => /^team-retained:field:defender-observation-\d+$/.test(row.source_id));
  const decisions = rows.filter(row => /^team-retained:field:defender-decision-\d+$/.test(row.source_id));
  assert.equal(observations.length, 6); assert.equal(decisions.length, 5);
  assert.equal(sources.has('team-retained:field:defender-decision-5'), false);
  assert.equal(sources.has('team-retained:field:motion'), false);
  assert.equal(rows.at(-1).source_id, 'team-retained:field:defender-observation-5');
  const references = list => list.map(({ source_id, source_hash, snapshot_hash }) => ({ owner: 'pa_physical_v1_field_steps', sourceId: source_id, sourceHash: source_hash, snapshotHash: snapshot_hash }));
  census = { viewReference: { owner: 'pa_lifecycle_v1_execution_views', sourceId: view.source_id, sourceHash: view.source_hash, snapshotHash: view.snapshot_hash },
    observationReferences: references(observations), decisionReferences: references(decisions),
    calibrationRows: closed.prepare('SELECT count(*) AS n FROM pa_lifecycle_v1_execution_calibrations WHERE view_source_id=?').get(view.source_id).n,
    decision5SourcePublished: false, decision5OwnerAttemptStarted: false, groupedMotionIssued: false };
  assert.equal(census.calibrationRows, 32);
} finally { closed.close(); }
for (const file of files) assert.equal(fileHash(join(resume, file.path)), file.sha256);
const manifest = { status: 'IMMUTABLE_LEGACY_CAL24_PREFIX_CAPTURED_ORIGINAL_OWNER_AUTHENTICATION_PENDING',
  directory: destination, closedPath, closedDatabaseHash: fileHash(closedPath), sourceMapPath, sourceMapHash: fileHash(sourceMapPath),
  originalDatabaseHash, census, stopControl: stop, lastOwnerTerminal: { mode: terminal.mode, childPid: terminal.childPid, exitCode: terminal.exitCode, elapsedMilliseconds: terminal.elapsedMilliseconds },
  files, mechanicalNextStage: 'defender-decision-5', continuationAuthorized: false,
  limitation: 'legacy synthetic observation override nominal1000/effective1e6 with non-equivalent refresh ticks; not empirical AI or Native-body adoption',
  supervisorExitMeaning: 'INTENTIONAL_STOP_CONTROL_GUARD_NOT_NATIVE_FAILURE', teamExecutionCredit: 0, mixedNineInningsCredit: 0, officialResult: null };
writeFileSync(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ ...manifest, files: { count: files.length } }));
