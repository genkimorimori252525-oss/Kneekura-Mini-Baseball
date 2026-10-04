import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { actualCommunicationEvidenceFromSqlite, openSqliteActualCommunicationStore } from './SqliteActualCommunicationStore';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), 'call-identity-')), path = join(dir, 'state.sqlite');
  const owner = openSqliteActualCommunicationStore(path), db = new DatabaseSync(path);
  expect(db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
  expect(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')?.file).toBe(path);
  const source = { sourceId: 'foreign', sourceVersion: 'v1', callSourceId: 'foreign-call', modelSourceId: null,
    currentExecutionSourceId: 'opaque-exec', previousCommunicationSourceId: null as string | null };
  const insert = (s: typeof source, snapshot: string, revision = 1) => {
    db.prepare('INSERT INTO actual_call_communications VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(s.sourceId, s.sourceVersion,
      'game', 1, 'pitch', s.callSourceId, null, 'opaque-exec', s.previousCommunicationSourceId, revision, json(s), hash(s), snapshot, hash(snapshot));
  };
  return { source, db, insert, reader: actualCommunicationEvidenceFromSqlite(db), close() { db.close(); owner.close(); rmSync(dir, { recursive: true }); } };
};
it.each(['plain', 'escaped-key', 'escaped-value', 'duplicate-history-container', 'duplicate-source-id'] as const)(
  'rejects a foreign %s last-history Source alias before treating the requested identity as absent', variant => {
    const x = fixture();
    try {
      const tail = { ...x.source, sourceId: 'victim' };
      let snapshot = json({ source: x.source, history: [tail], revision: 1, gameId: 'game', playId: 1, physicalPitchSourceId: 'pitch' });
      if (variant === 'escaped-key') snapshot = snapshot.replace('"sourceId":"victim"', '"source\\u0049d":"victim"');
      if (variant === 'escaped-value') snapshot = snapshot.replace('"sourceId":"victim"', '"sourceId":"v\\u0069ctim"');
      if (variant === 'duplicate-history-container') snapshot = snapshot.replace('"history":', `"history":[${json(x.source)}],"history":`);
      if (variant === 'duplicate-source-id') snapshot = snapshot.replace('"sourceId":"victim"', '"sourceId":"foreign","sourceId":"victim"');
      x.insert(x.source, snapshot);
      x.db.prepare('INSERT INTO actual_call_communication_heads VALUES (?,?,?)').run(x.source.callSourceId, x.source.sourceId, 1);
      expect(() => x.reader.read('victim')).toThrow(/ownership|identity/);
    } finally { x.close(); }
  });
it('keeps a genuine earlier ancestor in later history without treating that ancestor as the later Source identity', () => {
  const x = fixture();
  try {
    const first = { ...x.source, sourceId: 'ancestor' }, second = { ...x.source, previousCommunicationSourceId: first.sourceId };
    x.insert(first, json({ source: first, history: [first], revision: 1, gameId: 'game', playId: 1, physicalPitchSourceId: 'pitch' }));
    x.insert(second, json({ source: second, history: [first, second], revision: 2, gameId: 'game', playId: 1, physicalPitchSourceId: 'pitch' }), 2);
    x.db.prepare('INSERT INTO actual_call_communication_heads VALUES (?,?,?)').run(second.callSourceId, second.sourceId, 2);
    expect(() => x.reader.scope(second.callSourceId, 'absent-cut')).toThrow('actual communication requested bound is not owned');
  } finally { x.close(); }
});
