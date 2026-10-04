import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { openSqliteActualLocomotionStore } from './SqliteActualLocomotionStore';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

/** Metadata-only archive probes: no physical/decision tables exist, so ownership rejection
 * must occur before a domain dependency can be deserialized or executed. */
const fixture = () => {
  const path = join(mkdtempSync(join(tmpdir(), 'locomotion-metadata-')), 'state.sqlite');
  const store = openSqliteActualLocomotionStore(path), db = new DatabaseSync(path);
  db.exec('CREATE TABLE actual_defensive_decisions (source_id TEXT,physical_pitch_source_id TEXT,player_id TEXT)');
  const source = { sourceId: 'original', sourceVersion: 'v1', capability: 'initial_defender_step_v1' as const,
    physicalPitchSourceId: 'pitch', playerId: 'player', decisionSourceId: 'decision', locomotionModelSourceId: 'model',
    baseFieldSourceId: 'field', executionSourceId: null };
  const snapshot = (s: typeof source) => ({ source: s, revision: 1, history: [s], receipt: {
    self: { physicalPitchSourceId: s.physicalPitchSourceId, playerId: s.playerId, cut: { physicalPitchSourceId: s.physicalPitchSourceId,
      playerId: s.playerId, baseFieldSourceId: s.baseFieldSourceId, executionSourceId: s.executionSourceId, mode: 'original' } },
    command: { playerId: s.playerId } } });
  const insert = (s: typeof source, value: unknown) => db.prepare('INSERT INTO actual_locomotion_receipts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(s.sourceId, s.sourceVersion, s.capability, s.physicalPitchSourceId, s.playerId, s.decisionSourceId, s.locomotionModelSourceId,
      s.baseFieldSourceId, s.executionSourceId, JSON.stringify(s), 'unread-source-hash', JSON.stringify(value), 'unread-snapshot-hash');
  return { store, db, source, snapshot, insert, close() { db.close(); store.close(); } };
};

it('discovers malformed v1 multi-entry history claims while preserving the valid last-history identity convention', () => {
  const x = fixture();
  try {
    const hidden = { ...x.source, sourceId: 'hidden', physicalPitchSourceId: 'foreign-pitch', playerId: 'foreign-player', decisionSourceId: 'foreign-decision' };
    x.insert(hidden, { ...x.snapshot(hidden), history: [{ ...hidden, sourceId: 'original' }, hidden] });
    expect(() => x.store.read('original')).toThrow(/identity.*scope/);
  } finally { x.close(); }
});

it('discovers the command Player ownership mirror paired with the original Source pitch before domain replay', () => {
  const x = fixture();
  try {
    x.insert(x.source, x.snapshot(x.source)); x.db.prepare('INSERT INTO actual_locomotion_heads VALUES (?,?,?,1)').run('pitch', 'player', 'original');
    const hidden = { ...x.source, sourceId: 'hidden', playerId: 'foreign-player', decisionSourceId: 'foreign-decision' };
    const snapshot = x.snapshot(hidden); snapshot.receipt.command.playerId = 'player'; x.insert(hidden, snapshot);
    expect(() => x.store.read('original')).toThrow(/ownership\/head scope/);
  } finally { x.close(); }
});

it.each(['duplicate-container', 'wrong-container'] as const)('discovers %s malformed history without decoding string payloads', kind => {
  const x = fixture();
  try {
    const hidden = { ...x.source, sourceId: 'hidden', physicalPitchSourceId: 'foreign-pitch', playerId: 'foreign-player', decisionSourceId: 'foreign-decision' };
    const claimed = { ...hidden, sourceId: 'original' };
    x.insert(hidden, x.snapshot(hidden));
    const raw = kind === 'duplicate-container'
      ? JSON.stringify(x.snapshot(hidden)).replace('"history":', `"history":${JSON.stringify([claimed, hidden])},"history":`)
      : JSON.stringify({ ...x.snapshot(hidden), history: claimed });
    x.db.prepare('UPDATE actual_locomotion_receipts SET snapshot_json=?').run(raw);
    expect(() => x.store.read('original')).toThrow(/identity.*scope/);
    x.db.prepare('UPDATE actual_locomotion_receipts SET snapshot_json=?').run(JSON.stringify({ ...x.snapshot(hidden), history: JSON.stringify(claimed) }));
    expect(x.store.read('original')).toBeNull();
  } finally { x.close(); }
});
