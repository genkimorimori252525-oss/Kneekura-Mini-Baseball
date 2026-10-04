import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { assertOwnedMotionPhysicalMetadata } from './OwnedMotionPhysicalMetadata';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fixture = () => {
  const source = { sourceId: 'e1', sourceVersion: 'v1', baseFieldSourceId: 'f1', previousExecutionSourceId: null, action: { opaque: true } };
  const envelope = { sourceId: 'e1', sourceVersion: 'v1', baseFieldSourceId: 'f1', previousExecutionSourceId: null, sourceHash: 'opaque-original-digest' };
  const snapshot = { snapshotFormat: 'owned_scheduled_field_execution_manifest_v1', source, revision: 1, history: [envelope], execution: { opaque: true },
    baseField: { source: { sourceId: 'f1', sourceVersion: 'v1' }, sourceHash: 'opaque-field-source-digest', snapshotHash: 'opaque-field-snapshot-digest',
      physicalPitchSourceId: 'p1', gameId: 'g1' } };
  const row = { source_id: 'e1', physical_pitch_source_id: 'p1', base_field_source_id: 'f1', previous_source_id: null,
    revision: 1, game_id: 'g1', source_json: JSON.stringify(source), snapshot_json: JSON.stringify(snapshot) };
  return { row, snapshot };
};

it('validates explicit manifest ownership without requiring or replaying opaque future domain payload', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const { row } = fixture();
    expect(() => assertOwnedMotionPhysicalMetadata(db, row, [row])).not.toThrow();
    const opaque = { ...row, source_json: '{future opaque payload' };
    expect(() => assertOwnedMotionPhysicalMetadata(db, opaque, [opaque])).not.toThrow();
  } finally { db.close(); }
});

it('rejects unknown, duplicated, escaped, missing and mistyped explicit format discriminators', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const { row } = fixture();
    const original = row.snapshot_json;
    const variants = [
      original.replace('owned_scheduled_field_execution_manifest_v1', 'unknown-v2'),
      original.replace('"snapshotFormat":', '"snapshotFormat":"legacy","snapshotFormat":'),
      original.replace('"snapshotFormat":', '"snapshot\\u0046ormat":"owned_scheduled_field_execution_manifest_v1","snapshotFormat":'),
      original.replace('"snapshotFormat":"owned_scheduled_field_execution_manifest_v1",', ''),
      original.replace('"owned_scheduled_field_execution_manifest_v1"', 'null'),
      original.replace('"owned_scheduled_field_execution_manifest_v1"', '{}'),
    ];
    for (const snapshot_json of variants) {
      const bad = { ...row, snapshot_json };
      expect(() => assertOwnedMotionPhysicalMetadata(db, bad, [bad])).toThrow(/metadata/);
    }
  } finally { db.close(); }
});

it('rejects duplicate manifest ownership containers and compact pitch/game/source/history mirror changes', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const { row } = fixture();
    expect(() => assertOwnedMotionPhysicalMetadata(db, row, [row])).not.toThrow();
    const original = row.snapshot_json;
    const variants = [
      original.replace('"baseField":', '"baseField":{},"base\\u0046ield":'),
      original.replace('"history":', '"history":[],"history":'),
      original.replace('"physicalPitchSourceId":"p1"', '"physicalPitchSourceId":"foreign","physicalPitchSourceId":"p1"'),
      original.replace('"physicalPitchSourceId":"p1"', '"physicalPitchSourceId":"foreign"'),
      original.replace('"gameId":"g1"', '"gameId":"foreign"'),
      original.replace('"sourceId":"f1"', '"sourceId":"foreign"'),
      original.replace('"history":[{"sourceId":"e1"', '"history":[{"sourceId":"foreign"'),
      original.replace('"history":[{"sourceId":', '"history":[{"sourceId":"foreign","sourceId":'),
      original.replace('"history":[{"sourceId":"e1","sourceVersion":"v1"', '"history":[{"sourceId":"e1","sourceVersion":"wrong"'),
      original.replace('"baseField":{', '"baseField":{"response":{"touch":{"worldContact":{"flight":{"source":{"physicalPitchSourceId":"hidden"}}}}},'),
      original.replace('"baseField":{', '"baseField":{"extraFormatField":null,'),
      original.replace('"snapshotFormat":', '"extraFormatField":null,"snapshotFormat":'),
    ];
    for (const snapshot_json of variants) {
      const bad = { ...row, snapshot_json };
      expect(() => assertOwnedMotionPhysicalMetadata(db, bad, [bad])).toThrow(/metadata/);
    }
  } finally { db.close(); }
});

it('validates every original history envelope in prefix order and never permits a foreign owner alias', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const { row, snapshot } = fixture();
    const secondSource = { ...snapshot.source, sourceId: 'e2', previousExecutionSourceId: 'e1' };
    const second = { ...row, source_id: 'e2', previous_source_id: 'e1', revision: 2, source_json: JSON.stringify(secondSource),
      snapshot_json: JSON.stringify({ ...snapshot, revision: 2, source: secondSource,
        history: [...snapshot.history, { ...snapshot.history[0], sourceId: 'e2', previousExecutionSourceId: 'e1' }] }) };
    expect(() => assertOwnedMotionPhysicalMetadata(db, second, [row, second])).not.toThrow();
    for (const mutate of [
      (saved: any) => saved.history.reverse(),
      (saved: any) => { saved.history[0].owner = 'foreign_table'; },
      (saved: any) => { saved.history[0].baseFieldSourceId = 'foreign'; },
      (saved: any) => { saved.history[1].previousExecutionSourceId = null; },
      (saved: any) => { saved.history[0].sourceHash = {}; },
    ]) {
      const saved = JSON.parse(second.snapshot_json); mutate(saved);
      const bad = { ...second, snapshot_json: JSON.stringify(saved) };
      expect(() => assertOwnedMotionPhysicalMetadata(db, bad, [row, bad])).toThrow(/metadata/);
    }
  } finally { db.close(); }
});
