import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { battedWorldFrameBaseCenters } from './SqliteBattedWorldBaseGeometryStore';
import { prepareActualLiveBaseGeometryContinuation, geometryClosed, geometryRows } from './ActualLiveBaseGeometryContinuation.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

it('GEO-R01 reads the authenticated actual-live setup after a genuine new SWING and zero-horizon flight', () => {
  const input = process.env.ACTUAL_LIVE_GEOMETRY_INPUT;
  if (!input) throw new Error('explicit pinned actual-live geometry input required');
  const directory = mkdtempSync(join(tmpdir(), 'actual-live-geometry-'));
  const prepared = prepareActualLiveBaseGeometryContinuation(input, directory);
  const db = new DatabaseSync(prepared.path, { readOnly: true });
  try {
    const before = geometryRows(db);
    withSqliteReadTransaction(db, () => {
      expect(battedWorldFrameBaseCenters(db, prepared.flight)).toEqual(prepared.expectedBaseCenters);
    });
    expect(geometryRows(db)).toEqual(before);
  } finally { db.close(); geometryClosed(prepared.path); }
});
