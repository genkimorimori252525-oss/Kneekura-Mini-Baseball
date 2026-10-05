import { withSqliteMetadataStatementScope } from './SqliteMetadataStatementScope';
import { createRequire } from 'node:module';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
import { expect, it } from 'vitest';
import { assertOwnedMotionPhysicalMetadata } from './OwnedMotionPhysicalMetadata';
it('rejects duplicated physical ownership ancestor containers even when only one contains a full pitch claim', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const source = { sourceId: 'e1', sourceVersion: 'v1', baseFieldSourceId: 'f1', previousExecutionSourceId: null };
    const baseField = { source: { sourceId: 'f1' }, response: { model: { gameId: 'g1' }, touch: { worldContact: { flight: { source: { physicalPitchSourceId: 'p1' } } } } } };
    const row = { source_id: 'e1', physical_pitch_source_id: 'p1', base_field_source_id: 'f1', previous_source_id: null,
      revision: 1, game_id: 'g1', source_json: JSON.stringify(source), snapshot_json: JSON.stringify({ source, revision: 1, history: [source], baseField }) };
    expect(() => assertOwnedMotionPhysicalMetadata(db, row, [row])).not.toThrow();
    for (const key of ['response', 'touch', 'worldContact', 'flight']) {
      const bad = { ...row, snapshot_json: row.snapshot_json.replace(`"${key}":`, `"${key}":{},"${key}":`) };
      expect(() => assertOwnedMotionPhysicalMetadata(db, bad, [bad])).toThrow(/metadata/);
    }
  } finally { db.close(); }
});

it('retains legacy raw bytes and rejects changed mirrors after repeated metadata statement reuse', () => {
  const db = new DatabaseSync(':memory:');
  const source = { sourceId: 'e1', sourceVersion: 'v1', baseFieldSourceId: 'f1', previousExecutionSourceId: null };
  const baseField = { source: { sourceId: 'f1' }, response: { model: { gameId: 'g1' }, touch: { worldContact: { flight: { source: { physicalPitchSourceId: 'p1' } } } } } };
  const row = { source_id: 'e1', physical_pitch_source_id: 'p1', base_field_source_id: 'f1', previous_source_id: null,
    revision: 1, game_id: 'g1', source_json: JSON.stringify(source, null, 2),
    snapshot_json: JSON.stringify({ source, revision: 1, history: [source], baseField }, null, 2) };
  const bytes = JSON.stringify(row);
  try {
    withSqliteMetadataStatementScope(db, () => {
      for (let i = 0; i < 2; i++) assertOwnedMotionPhysicalMetadata(db, row, [row]);
      const changes = [
        { ...row, source_json: row.source_json.replace('"v1"', '"v2"') },
        { ...row, snapshot_json: row.snapshot_json.replace('"revision": 1', '"revision": 2') },
        { ...row, snapshot_json: row.snapshot_json.replace('"baseField":', '"base\\u0046ield": {}, "baseField":') },
        { ...row, snapshot_json: row.snapshot_json.replace('"history":', '"history": [], "history":') },
      ];
      for (const changed of changes) {
        expect(() => assertOwnedMotionPhysicalMetadata(db, changed, [changed])).toThrow(/metadata|Source version mirror differs/);
        expect(() => assertOwnedMotionPhysicalMetadata(db, row, [row])).not.toThrow();
      }
      // Existing future-opaque compatibility remains outside domain replay.
      const opaque = { ...row, source_json: 'future-opaque-source', snapshot_json: 'future-opaque-snapshot' };
      expect(() => assertOwnedMotionPhysicalMetadata(db, opaque, [opaque])).not.toThrow();
    });
    expect(JSON.stringify(row)).toBe(bytes);
  } finally { db.close(); }
});
