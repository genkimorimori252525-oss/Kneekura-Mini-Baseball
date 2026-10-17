import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { actorHash } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readCurrentSamePaLifecycleViewFromSqlite, readSamePaLifecycleRecordFromSqlite, readSamePaLifecycleSetFromSqlite } from '../../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { readSamePaPhysicalOperationFromSqlite } from '../../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { withSqliteReadTransaction } from '../../../src/host/world/SqliteReadTransaction.test-support';

// Authenticate effects committed before the bounded lifecycle worker timed out.
// This does not open a writer, repeat an admission, or replace an old Source.
const directory = resolve(process.argv[2]!);
const databasePath = join(directory, 'retained-cut11-partial.sqlite');
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const databaseHash = sha(readFileSync(databasePath));
assert.equal(databaseHash, 'd30a50dc87f54a6c4a1b65017f6772ed35a283c86851516da6b82d2d5f1675d2');
const sourceBytes = readFileSync(join(directory, 'accepted-sources.json'));
const sources = new Map<string, unknown>(JSON.parse(sourceBytes.toString('utf8')));
const started = Date.now();
const read = () => {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return withSqliteReadTransaction(db, () => {
      assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
      const viewRow = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('aero-retained:cut11:view');
      assert.ok(viewRow);
      const viewRef = reference('pa_lifecycle_v1_execution_views', JSON.parse(String(viewRow.snapshot_json)));
      const basis = readCurrentSamePaLifecycleViewFromSqlite(db, viewRef);
      const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', basis.view.source.prefixReference.sourceId);
      assert.ok(prefix?.kind === 'same_pa_lifecycle_prefix');
      const totalIds = basis.view.source.participantTotalReferences.map(item => item.assessmentReference.sourceId);
      assert.equal(totalIds.length, 10);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', totalIds);
      const originalRows = [
        { table: 'pa_lifecycle_v1_execution_views', value: basis.view },
        { table: 'pa_lifecycle_v1_work_prefixes', value: prefix },
        ...totals.map(value => { assert.ok(value?.kind === 'same_pa_lifecycle_total'); return { table: 'pa_lifecycle_v1_total_assessments', value }; }),
      ];
      const refs = originalRows.map(({ table, value }) => {
        const row = db.prepare('SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM ' + table + ' WHERE source_id=?').get(value.source.sourceId);
        assert.ok(row);
        assert.deepEqual(value.source, sources.get(value.source.sourceId));
        assert.deepEqual(value.source, JSON.parse(String(row.source_json)));
        assert.equal(actorHash(value.source), row.source_hash);
        assert.equal(actorHash(value), row.snapshot_hash);
        assert.deepEqual(value, JSON.parse(String(row.snapshot_json)));
        return { owner: table, sourceId: value.source.sourceId, sourceHash: row.source_hash, snapshotHash: row.snapshot_hash };
      });
      const physicalRef = basis.view.cut.physicalOperationReference;
      assert.equal(physicalRef.owner, 'pa_physical_v1_resolutions');
      if (physicalRef.owner !== 'pa_physical_v1_resolutions') throw new Error('expected original resolution');
      const physical = readSamePaPhysicalOperationFromSqlite(db, physicalRef);
      assert.equal(physical.kind, 'same_pa_physical_resolution_v1');
      if (physical.kind !== 'same_pa_physical_resolution_v1') throw new Error('expected original resolution');
      assert.ok(physical.record.contact);
      assert.equal(physical.evaluationTick, 34054636);
      assert.equal(physical.evaluationTick, basis.view.cut.evaluationTick);
      assert.equal(db.prepare('SELECT count(*) AS n FROM pa_lifecycle_v1_execution_calibrations WHERE view_source_id=?').get('aero-retained:cut11:view')!.n, 0);
      assert.equal(db.prepare('SELECT count(*) AS n FROM pa_physical_v1_field_roots').get()!.n, 0);
      return { references: refs, currentViewReference: viewRef, currentPhysicalReference: physical.reference,
        evaluationTick: physical.evaluationTick, actualContact: true, totalCount: totals.length, cut11CalibrationCount: 0, fieldRootCount: 0 };
    });
  } finally { db.close(); }
};
const first = read();
console.log(JSON.stringify({ stage: 'original-owner-cold-read-completed', elapsedMilliseconds: Date.now() - started }));
const reopened = read();
assert.deepEqual(reopened, first);
assert.equal(sha(readFileSync(databasePath)), databaseHash);
assert.equal(sha(readFileSync(join(directory, 'accepted-sources.json'))), sha(sourceBytes));
const receipt = { status: 'PASS_ORIGINAL_OWNER_COMMITTED_CUT11_COLD_READ_REOPEN', databaseHash, sourceFileHash: sha(sourceBytes),
  ...first, independentlyReopened: true, databaseBytesUnchanged: true, elapsedMilliseconds: Date.now() - started,
  nodeVersion: process.version, sqliteVersion: process.versions.sqlite, originalAdvanceAttempt: 'TIMEOUT_240_SECONDS_AFTER_COMMIT',
  rootCause: 'UNKNOWN_STAGE_COST_OR_PROGRESS', newAdmissions: 0, actualAeroFieldRootProven: false, officialResult: null };
writeFileSync(join(directory, 'original-owner-cut11-read-reopen.json'), JSON.stringify(receipt, null, 2), { flag: 'wx' });
console.log(JSON.stringify(receipt));
