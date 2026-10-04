import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { actualCommunicationEvidenceFromSqlite, openSqliteActualCommunicationStore } from './SqliteActualCommunicationStore';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
it('checks exact ownership metadata and bounded lineage before attempting any physical replay', () => {
  const dir = mkdtempSync(join(tmpdir(), 'communication-metadata-')), path = join(dir, 'state.sqlite');
  const owner = openSqliteActualCommunicationStore(path), db = new DatabaseSync(path);
  try {
    expect(db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    const source = { sourceId: 'future', sourceVersion: 'v1', callSourceId: 'call', modelSourceId: null,
      currentExecutionSourceId: 'opaque-exec', previousCommunicationSourceId: null };
    const snapshot = { source, history: [source], revision: 1, gameId: 'game', playId: 1, physicalPitchSourceId: 'pitch', futureOpaqueDomain: { untouched: true } };
    db.prepare('INSERT INTO actual_call_communications VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(source.sourceId, source.sourceVersion,
      'game', 1, 'pitch', 'call', null, 'opaque-exec', null, 1, json(source), hash(source), json(snapshot), hash(snapshot));
    db.prepare('INSERT INTO actual_call_communication_heads VALUES (?,?,?)').run('call', 'future', 1);
    const reader = actualCommunicationEvidenceFromSqlite(db);
    expect(() => reader.scope('call', 'absent-cut')).toThrow('actual communication requested bound is not owned');
    const duplicate = json(source).replace('"callSourceId":"call"', '"callSourceId":"call","callSourceId":"other"');
    db.prepare('UPDATE actual_call_communications SET source_json=? WHERE source_id=?').run(duplicate, 'future');
    expect(() => reader.scope('call', 'absent-cut')).toThrow('ambiguous actual communication ownership metadata');
  } finally { db.close(); owner.close(); rmSync(dir, { recursive: true }); }
});
