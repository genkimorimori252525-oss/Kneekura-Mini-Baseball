import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Capture only: raw pins/copy integrity are not independent Native-owner proof.
// VACUUM INTO reads a consistent SQLite snapshot while the separate source-only
// suffix may continue. No application writer or new Source is invoked here.
const [directoryArgument] = process.argv.slice(2); assert.ok(directoryArgument);
const directory = resolve(directoryArgument), resume = join(directory, 'retained-resume');
const path = join(resume, 'resume.sqlite'), mapPath = join(resume, 'accepted-sources.json');
const destination = join(directory, 'accepted-one-decision-checkpoint');
assert.ok(!existsSync(destination), 'preserve the prior immutable snapshot');
const decisionId = 'team-retained:field:defender-decision-0', viewId = 'team-retained:cut15:view';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => JSON.stringify(value, (_key, item) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const hash = value => sha(Buffer.from(canonical(value)));
const sourcesBytes = readFileSync(mapPath), sources = new Map(JSON.parse(sourcesBytes.toString('utf8')));
const preservedOriginalDatabaseHash = sha(readFileSync(join(directory, 'retained-prefix.sqlite')));
const preservedOriginalSourceHash = sha(readFileSync(join(directory, 'accepted-sources-0.json')));
const originalDecisionReceipt = JSON.parse(readFileSync(join(resume, 'defender-decision-0-receipt.json'), 'utf8'));
const originalAdvanceReceipt = JSON.parse(readFileSync(join(resume, 'advance-defender-decision-0-receipt.json'), 'utf8'));
assert.ok(originalDecisionReceipt.status.startsWith('PASS_') && originalAdvanceReceipt.status.startsWith('PASS_'));
assert.equal(originalDecisionReceipt.stepReference.sourceId, decisionId);
assert.equal(originalAdvanceReceipt.viewReference.sourceId, viewId);
mkdirSync(destination);
const snapshotPath = join(destination, 'accepted-one-decision.sqlite'), sourcePath = join(destination, 'accepted-sources.json');
let db = new DatabaseSync(path, { readOnly: true });
try { db.prepare('VACUUM INTO ?').run(snapshotPath); } finally { db.close(); }
// If publication raced capture, fail closed and preserve this attempt; do not
// overwrite/delete it or claim its Map is the matching Source authority.
assert.equal(sha(readFileSync(mapPath)), sha(sourcesBytes), 'Source Map changed during snapshot capture');
copyFileSync(mapPath, sourcePath, constants.COPYFILE_EXCL);
db = new DatabaseSync(snapshotPath, { readOnly: true });
let manifest;
try {
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  const row = db.prepare('SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM pa_physical_v1_field_steps WHERE source_id=?').get(decisionId);
  const viewRow = db.prepare('SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get(viewId);
  assert.ok(row && viewRow, 'capture requires admitted decision and immediate lifecycle advance');
  assert.equal(db.prepare('SELECT source_id FROM pa_lifecycle_v1_execution_views ORDER BY rowid DESC LIMIT 1').get().source_id, viewId,
    'capture requires exact current cut15, not a later decision lineage');
  for (const [id, value] of [[decisionId, row], [viewId, viewRow]]) {
    assert.equal(hash(sources.get(id)), value.source_hash);
    assert.deepEqual(JSON.parse(value.source_json), sources.get(id));
    assert.equal(hash(JSON.parse(value.snapshot_json)), value.snapshot_hash);
  }
  const decisionReference = { owner: 'pa_physical_v1_field_steps', sourceId: decisionId, sourceHash: row.source_hash, snapshotHash: row.snapshot_hash };
  const viewReference = { owner: 'pa_lifecycle_v1_execution_views', sourceId: viewId, sourceHash: viewRow.source_hash, snapshotHash: viewRow.snapshot_hash };
  assert.deepEqual(decisionReference, originalDecisionReceipt.stepReference);
  assert.deepEqual(viewReference, originalAdvanceReceipt.viewReference);
  const decision = JSON.parse(row.snapshot_json), view = JSON.parse(viewRow.snapshot_json);
  assert.equal(decision.actionResult.kind, 'defender_decision_v1');
  assert.deepEqual(view.cut.physicalOperationReference, decisionReference);
  manifest = { status: 'FIXED_SINGLE_DECISION_CAPTURED_ORIGINAL_OWNER_AUTHENTICATION_REQUIRED',
    snapshotPath, sourcePath, databaseHash: sha(readFileSync(snapshotPath)), authorityMapHash: sha(readFileSync(sourcePath)),
    sourceCount: sources.size, decisionReference, viewReference, currentViewId: viewId,
    evaluationTick: view.cut.evaluationTick, playerId: decision.actionResult.playerId,
    selectionScope: 'accepted_individual_selected_only', sourceMapMayIncludePublishedUnadmittedDeclarations: true,
    priorOwnerAdmissionAndReopenReceipts: ['defender-decision-0-receipt.json', 'advance-defender-decision-0-receipt.json'],
    groupedMotionIssued: false, teamExecutionCredit: 0, officialResult: null,
    preservedOriginalDatabaseHash, preservedOriginalSourceHash };
} finally { db.close(); }
copyFileSync(join(resume, 'defender-decision-0-receipt.json'), join(destination, 'defender-decision-0-receipt.json'), constants.COPYFILE_EXCL);
copyFileSync(join(resume, 'advance-defender-decision-0-receipt.json'), join(destination, 'advance-defender-decision-0-receipt.json'), constants.COPYFILE_EXCL);
writeFileSync(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2));
assert.equal(sha(readFileSync(join(directory, 'retained-prefix.sqlite'))), preservedOriginalDatabaseHash);
assert.equal(sha(readFileSync(join(directory, 'accepted-sources-0.json'))), preservedOriginalSourceHash);
console.log(JSON.stringify(manifest));
