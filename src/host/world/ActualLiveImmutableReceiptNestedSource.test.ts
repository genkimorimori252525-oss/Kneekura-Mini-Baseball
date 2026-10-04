// Isolates structured Source metadata on real SQLite; no physical derivation is claimed.
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openActualLiveImmutableReceiptStore } from './ActualLiveImmutableReceiptStore';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { AcceptedActualLivePlayQueue } from './SqliteActualLivePlayQueueStore';

it.each([{ kind: 'original_pitch' }, { kind: 'field_execution', baseFieldSourceId: 'field', executionSourceId: null }] as const)(
  'accepts canonical nested cut $kind and rejects changed or duplicate mirrors', cut => {
  const directory = mkdtempSync(join(tmpdir(), 'live-nested-source-')), path = join(directory, 'state.sqlite');
  const source: AcceptedActualLivePlayQueue = { sourceId: 'checkpoint', sourceVersion: 'v1', capability: 'actual_live_play_queue_v1',
    physicalPitchSourceId: 'pitch', cut };
  const owner = { input: (raw: typeof source) => raw,
    derive: (raw: typeof source) => ({ source: raw, revision: 1 as const, history: [raw], ownershipKey: json(['queue', raw.sourceId]) }) };
  const store = openActualLiveImmutableReceiptStore(path, 'actual_live_play_queue_checkpoints', () => owner, () => source);
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  try {
    const saved = store.accept(source.sourceId);
    expect(saved.source.cut).toEqual(source.cut);
    expect(store.read(source.sourceId)).toEqual(saved); expect(store.accept(source.sourceId)).toEqual(saved);
    const original = db.prepare('SELECT snapshot_json FROM actual_live_play_queue_checkpoints').get()!.snapshot_json as string;
    const malformedCut = (cutValue: unknown) => { const value = JSON.parse(original); value.history[0].cut = cutValue; return json(value); };
    const malformed = [original.replace('"cut":', '"cut":{},"cut":'), original.replace(`"kind":"${cut.kind}"`, '"kind":"foreign"'),
      malformedCut(null), malformedCut([]), malformedCut({ ...cut, callerComplete: true })];
    if (cut.kind === 'field_execution') malformed.push(malformedCut({ ...cut, baseFieldSourceId: 'foreign' }),
      malformedCut({ ...cut, executionSourceId: 'foreign' }));
    for (const snapshot of malformed) {
      db.prepare('UPDATE actual_live_play_queue_checkpoints SET snapshot_json=?').run(snapshot);
      expect(() => store.read(source.sourceId)).toThrow(/metadata|archive/);
    }
    db.prepare('UPDATE actual_live_play_queue_checkpoints SET snapshot_json=?').run(original);
    const reopened = openActualLiveImmutableReceiptStore(path, 'actual_live_play_queue_checkpoints', () => owner);
    try { expect(reopened.read(source.sourceId)).toEqual(saved); } finally { reopened.close(); }
  } finally { db.close(); store.close(); rmSync(directory, { recursive: true, force: true }); }
});
