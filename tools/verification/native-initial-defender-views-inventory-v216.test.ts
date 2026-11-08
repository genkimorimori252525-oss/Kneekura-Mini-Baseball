import assert from 'node:assert/strict';
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { it } from 'vitest';
import { actorJson, actorHash } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { classifyInitialDefenderInventoryV216, inventoryNativeInitialDefenderViewsV216, readNormalScopedCalibrationInventoryV216,
  type InitialDefenderInventoryCellV216, type NativeInitialDefenderInventoryInputV216 } from './native-initial-defender-views-inventory-v216';

const absent = (): InitialDefenderInventoryCellV216 => ({ observation: 0, prefix: 0, totals: 0, view: 0, calibration: 0 });
const complete = (): InitialDefenderInventoryCellV216 => ({ observation: 1, prefix: 1, totals: 10, view: 1, calibration: 1 });
const cells = (...prefix: InitialDefenderInventoryCellV216[]) => [...prefix, ...Array.from({ length: 9 - prefix.length }, absent)];

it('NII216-P01 resumes only missing lifecycle work after an accepted observation', () => {
  for (const [cell, phase] of [
    [{ observation: 1, prefix: 0, totals: 0, view: 0, calibration: 0 }, 'PREFIX_PENDING'],
    [{ observation: 1, prefix: 1, totals: 0, view: 0, calibration: 0 }, 'TOTALS_PENDING'],
    [{ observation: 1, prefix: 1, totals: 10, view: 0, calibration: 0 }, 'VIEW_PENDING'],
    [{ observation: 1, prefix: 1, totals: 10, view: 1, calibration: 0 }, 'SCOPED_CALIBRATION_PENDING'],
  ] as const) {
    const result = classifyInitialDefenderInventoryV216(cells(complete(), complete(), cell));
    assert.equal(result.phase, phase); assert.equal(result.completedCount, 2); assert.equal(result.acceptedObservationCount, 3);
    assert.equal(result.nextIndex, 2); assert.equal(result.acceptedViewCount, phase === 'SCOPED_CALIBRATION_PENDING' ? 3 : 2);
  }
});
it('NII216-P02 skips complete actors and permits all-complete inventory without writes', () => {
  assert.equal(classifyInitialDefenderInventoryV216(cells()).phase, 'OBSERVATION_PENDING');
  assert.equal(classifyInitialDefenderInventoryV216(cells(complete(), complete())).nextIndex, 2);
  const result = classifyInitialDefenderInventoryV216(Array.from({ length: 9 }, complete));
  assert.equal(result.phase, 'COMPLETE'); assert.equal(result.completedCount, 9); assert.equal(result.remainingAppendRows, 0);
});
it('NII216-P03 refuses partial atomic TOTALs and noncontiguous or impossible states', () => {
  for (const partial of [1, 5, 9]) assert.throws(() => classifyInitialDefenderInventoryV216(cells({ ...complete(), totals: partial })), /inventory phase/);
  assert.throws(() => classifyInitialDefenderInventoryV216(cells(absent(), complete())), /inventory phase/);
  assert.throws(() => classifyInitialDefenderInventoryV216(cells({ ...absent(), prefix: 1 })), /inventory phase/);
  assert.throws(() => classifyInitialDefenderInventoryV216(cells({ ...complete(), view: 0 })), /inventory phase/);
});

const databasePath = process.env.BASEBALL_NATIVE_INITIAL_DEFENDER_INVENTORY_V216_DATABASE;
const inputPath = process.env.BASEBALL_NATIVE_INITIAL_DEFENDER_INVENTORY_V216_INPUT;
const outputPath = process.env.BASEBALL_NATIVE_INITIAL_DEFENDER_INVENTORY_V216_OUTPUT;
it.skipIf(!databasePath || !inputPath || !outputPath)('NII216-S01 authenticates committed V214 state using only normal readers on a fresh backup', () => {
  const output = resolve(outputPath!); mkdirSync(output, { recursive: false });
  const codec = createRequire(import.meta.url)('./live-debug-record.mjs') as {
    parseDebugRecord(value: string): NativeInitialDefenderInventoryInputV216; stringifyDebugRecord(value: unknown): string;
  };
  const input = codec.parseDebugRecord(readFileSync(inputPath!, 'utf8'));
  const result = inventoryNativeInitialDefenderViewsV216(databasePath!, input);
  assert.equal(result.readOnly, true); assert.equal(result.acceptOperationCalls, 0); assert.equal(result.lifecycleAcceptCalls, 0);
  writeFileSync(resolve(output, 'inventory.lossless.json'), codec.stringifyDebugRecord(result) + '\n', { flag: 'wx' });
  const calibration = result.iterations.find(item => item.cell.calibration)?.scopedCalibration;
  assert(calibration?.kind === 'same_pa_lifecycle_calibration', 'normal accepted scoped calibration required for locator regression');
  const sourceId = calibration.source.sourceId, viewId = calibration.source.viewReference.sourceId;
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  const probe = (path: string) => { const db = new Native(path, { readOnly: true }); db.exec('PRAGMA query_only=1; BEGIN');
    try { return readNormalScopedCalibrationInventoryV216(db, sourceId, viewId); }
    finally { db.exec('ROLLBACK'); db.close(); } };
  assert.equal(actorJson(probe(databasePath!)), actorJson(calibration));
  for (const suffix of ['-wal', '-journal']) assert(!existsSync(databasePath! + suffix) || statSync(databasePath! + suffix).size === 0, 'guard copy requires a complete main image');
  const guards = [];
  for (const kind of ['hidden-sql-view-locator', 'rehashed-source-snapshot-view-alias']) {
    const path = resolve(output, kind + '.sqlite'); copyFileSync(databasePath!, path, constants.COPYFILE_EXCL);
    const db = new Native(path);
    try {
      if (kind === 'hidden-sql-view-locator') assert.equal(db.prepare('UPDATE main.pa_lifecycle_v1_execution_calibrations SET view_source_id=? WHERE source_id=?').run('v216-hidden-view', sourceId).changes, 1);
      else {
        const row = db.prepare('SELECT source_json,snapshot_json FROM main.pa_lifecycle_v1_execution_calibrations WHERE source_id=?').get(sourceId)!;
        const source = JSON.parse(String(row.source_json)), snapshot = JSON.parse(String(row.snapshot_json));
        source.viewReference.sourceId = 'v216-hidden-view'; snapshot.source = source;
        assert.equal(db.prepare('UPDATE main.pa_lifecycle_v1_execution_calibrations SET source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=? WHERE source_id=?')
          .run(actorJson(source), actorHash(source), actorJson(snapshot), actorHash(snapshot), sourceId).changes, 1);
      }
    } finally { db.close(); }
    assert.throws(() => probe(path), /lifecycle|Source|identity|prerequisite/);
    guards.push({ kind, rejectedByNormalCalibrationReader: true, originalAndInventoryDatabaseMutated: false });
  }
  writeFileSync(resolve(output, 'locator-guards.json'), JSON.stringify({ pass: true, guards }) + '\n', { flag: 'wx' });
}, 285_000);
