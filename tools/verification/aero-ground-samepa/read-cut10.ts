import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { actorHash } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readCurrentSamePaLifecycleViewFromSqlite, readSamePaLifecycleSetFromSqlite } from '../../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { samePaExecutionReference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { readSamePaPhysicalOperationFromSqlite } from '../../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { withSqliteReadTransaction } from '../../../src/host/world/SqliteReadTransaction.test-support';

// Read the uncertain writer's closed backup. No store opener, Source callback,
// admission or writer transaction participates in this recovery proof.
const directory = resolve(process.argv[2]!);
const databasePath = join(directory, 'retained-cut10.sqlite');
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const databaseHash = sha(readFileSync(databasePath));
assert.equal(databaseHash, '58e0302b3ccc54252b2cd68f485492fc7d2024be14c42abeed43dc5130e6fe9b');
const sourceBytes = readFileSync(join(directory, 'accepted-sources.json'));
const sources = new Map<string, unknown>(JSON.parse(sourceBytes.toString('utf8')));
const started = Date.now();
const read = () => {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return withSqliteReadTransaction(db, () => {
      assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
      const rows = db.prepare('SELECT source_id,source_json,source_hash,snapshot_json,snapshot_hash FROM pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid')
        .all('aero-retained:cut10:view');
      assert.equal(rows.length, 32);
      const values = readSamePaLifecycleSetFromSqlite(db, 'calibration', rows.map(row => String(row.source_id)));
      const references = values.map((value, index) => {
        assert.ok(value?.kind === 'same_pa_lifecycle_calibration');
        const row = rows[index]!;
        assert.deepEqual(value.source, sources.get(String(row.source_id)));
        assert.deepEqual(value.source, JSON.parse(String(row.source_json)));
        assert.equal(actorHash(value.source), row.source_hash);
        assert.equal(actorHash(value), row.snapshot_hash);
        assert.deepEqual(value, JSON.parse(String(row.snapshot_json)));
        return samePaExecutionReference('pa_lifecycle_v1_execution_calibrations', value);
      });
      const viewRow = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('aero-retained:cut10:view');
      assert.ok(viewRow);
      const viewReference = samePaExecutionReference('pa_lifecycle_v1_execution_views', JSON.parse(String(viewRow.snapshot_json)));
      const basis = readCurrentSamePaLifecycleViewFromSqlite(db, viewReference);
      const physicalReference = basis.view.cut.physicalOperationReference;
      assert.equal(physicalReference.owner, 'pa_physical_v1_commitments');
      if (physicalReference.owner !== 'pa_physical_v1_commitments') throw new Error('expected original commitment');
      const physical = readSamePaPhysicalOperationFromSqlite(db, physicalReference);
      assert.equal(physical.kind, 'same_pa_physical_commitment_v1');
      assert.equal(physical.evaluationTick, basis.view.cut.evaluationTick);
      assert.equal(db.prepare('SELECT count(*) AS n FROM pa_physical_v1_resolutions').get()!.n, 0);
      assert.equal(db.prepare('SELECT count(*) AS n FROM pa_physical_v1_field_roots').get()!.n, 0);
      return { calibrationCount: values.length, calibrationSetHash: actorHash(values), references,
        currentViewReference: viewReference, currentPhysicalReference: physical.reference,
        evaluationTick: physical.evaluationTick, resolutionCount: 0, fieldRootCount: 0 };
    });
  } finally { db.close(); }
};
const first = read();
console.log(JSON.stringify({ stage: 'original-owner-cold-read-completed', elapsedMilliseconds: Date.now() - started }));
const reopened = read();
assert.deepEqual(reopened, first);
assert.equal(sha(readFileSync(databasePath)), databaseHash);
assert.equal(sha(readFileSync(join(directory, 'accepted-sources.json'))), sha(sourceBytes));
const receipt = { status: 'PASS_ORIGINAL_OWNER_CAL10_COMMITTED_SET_COLD_READ_REOPEN', databaseHash,
  sourceFileHash: sha(sourceBytes), ...first, independentlyReopened: true, databaseBytesUnchanged: true,
  elapsedMilliseconds: Date.now() - started, nodeVersion: process.version, sqliteVersion: process.versions.sqlite,
  uncertainWriterResult: 'FAIL_POST_COMMIT_MALFORMED_JSON', rootCause: 'UNKNOWN', newAdmissions: 0,
  actualAeroFieldRootProven: false, officialResult: null, scoringResult: null };
writeFileSync(join(directory, 'original-owner-cut10-read-reopen.json'), JSON.stringify(receipt, null, 2), { flag: 'wx' });
console.log(JSON.stringify(receipt));
