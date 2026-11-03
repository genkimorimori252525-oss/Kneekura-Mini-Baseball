import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const [inputArgument, proofArgument, outputArgument] = process.argv.slice(2);
assert.ok(inputArgument && proofArgument && outputArgument);
const input = JSON.parse(readFileSync(resolve(inputArgument), 'utf8'));
const proof = JSON.parse(readFileSync(resolve(proofArgument), 'utf8'));
const output = resolve(outputArgument), closed = proof.closedCheckpoint;
const sha = data => createHash('sha256').update(data).digest('hex');
const fileHash = path => sha(readFileSync(path));
const unchanged = () => {
  assert.equal(fileHash(input.databasePath), input.databaseHash); assert.equal(fileHash(input.sourceMapPath), input.sourceMapHash);
  assert.equal(fileHash(closed.databasePath), closed.databaseHash); assert.equal(fileHash(closed.sourceMapPath), closed.sourceMapHash);
};
unchanged();
// Do not open even a read-only SQLite connection on the immutable original.
const originalCopy = join(dirname(output), 'old-input-schema-copy-' + basename(output) + '.sqlite');
copyFileSync(input.databasePath, originalCopy, constants.COPYFILE_EXCL); assert.equal(fileHash(originalCopy), input.databaseHash);
const before = new DatabaseSync(originalCopy, { readOnly: true }), after = new DatabaseSync(closed.databasePath, { readOnly: true });
try {
  const schema = db => db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name').all();
  const schemaBefore = schema(before), schemaAfter = schema(after); assert.deepEqual(schemaAfter, schemaBefore);
  const tables = schemaBefore.filter(row => row.type === 'table' && !row.name.startsWith('sqlite_')).map(row => row.name);
  const id = proof.checkpointReference.sourceId;
  const newArchive = after.prepare('SELECT rowid AS proof_rowid,* FROM pa_physical_v1_field_steps WHERE source_id=?').get(id); assert.ok(newArchive);
  const step = JSON.parse(newArchive.snapshot_json); assert.equal(step.source.sourceId, id); assert.equal(newArchive.snapshot_hash, proof.checkpointHash);
  let retainedRows = 0, headCas = 0, newRows = 0;
  for (const table of tables) {
    assert.match(table, /^[A-Za-z_][A-Za-z_0-9]*$/);
    const query = 'SELECT rowid AS proof_rowid,* FROM main.' + table + ' ORDER BY rowid';
    const oldRows = before.prepare(query).all(), currentRows = after.prepare(query).all();
    for (const old of oldRows) {
      const current = currentRows.find(row => row.proof_rowid === old.proof_rowid);
      if (table === 'pa_physical_v1_heads' && old.enrollment_source_id === step.lineage.enrollmentReference.sourceId) {
        assert.deepEqual({ ...current }, { ...old, pitch_ordinal: step.pitchOrdinal, launch_source_id: step.physicalPitchSourceId,
          operation_ordinal: step.operationOrdinal, last_owner: 'pa_physical_v1_field_steps', last_source_id: id, last_snapshot_hash: newArchive.snapshot_hash });
        headCas++;
      } else { assert.deepEqual(current, old, 'old row bytes differ: ' + table); retainedRows++; }
    }
    const added = currentRows.filter(row => !oldRows.some(old => old.proof_rowid === row.proof_rowid));
    assert.deepEqual(added.map(row => row.source_id), table === 'pa_physical_v1_field_steps' ? [id] : []); newRows += added.length;
  }
  assert.equal(headCas, 1); assert.equal(newRows, 1);
  const oldMap = new Map(JSON.parse(readFileSync(input.sourceMapPath, 'utf8'))), newMap = new Map(JSON.parse(readFileSync(closed.sourceMapPath, 'utf8')));
  for (const [key, value] of oldMap) assert.deepEqual(newMap.get(key), value);
  assert.deepEqual([...newMap.keys()].filter(key => !oldMap.has(key)), [id]); assert.deepEqual(newMap.get(id), step.source);
  assert.equal(after.prepare('PRAGMA integrity_check').get().integrity_check, 'ok'); unchanged();
  const result = { status: 'PASS_INDEPENDENT_ALL_SCHEMA_AND_OLD_ROW_BYTES', schemaEntries: schemaBefore.length,
    schemaHash: sha(JSON.stringify(schemaBefore)), tables: tables.length, retainedRows, exactlyOneHeadCas: true, exactlyOneNewPhysicalRow: true,
    oldSourceMapEntries: oldMap.size, exactlyOneNewSource: true, immutableOriginalInputOpened: false,
    originalDatabaseHash: input.databaseHash, finalDatabaseHash: closed.databaseHash, checkpointReference: proof.checkpointReference,
    originalHeadersAndArchiveJsonBytesUnchanged: true, bodyExecution: false, official: null };
  writeFileSync(output, JSON.stringify(result, null, 2), { flag: 'wx' }); process.stdout.write(JSON.stringify(result) + '\n');
} finally { before.close(); after.close(); }
unchanged();
