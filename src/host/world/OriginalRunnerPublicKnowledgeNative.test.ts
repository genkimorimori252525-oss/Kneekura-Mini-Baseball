import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import * as knowledge from './SqliteActualFieldObservationStore';
import { originalRunnerPublicKnowledgeFixture, requireOriginalRunnerPublicKnowledgeStore } from './OriginalRunnerPublicKnowledgeContracts.test-support';

it('persists the original public baseline and reopens every dependency from a fully closed real file', () => {
  const x = originalRunnerPublicKnowledgeFixture(), handles: { close(): void }[] = [];
  try {
    const open = requireOriginalRunnerPublicKnowledgeStore(knowledge);
    expect(x.f.db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(x.f.path);
    expect(x.f.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    const originals = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>) => ({
      matches: db.prepare('SELECT * FROM matches ORDER BY match_id').all(),
      actors: db.prepare('SELECT * FROM physical_plate_appearance_actors ORDER BY source_id').all(),
      pitches: db.prepare('SELECT * FROM physical_pitch_progress_actions ORDER BY source_id').all(),
      pitchHeads: db.prepare('SELECT * FROM physical_pitch_progress_heads ORDER BY game_id,play_id').all(),
      participants: db.prepare('SELECT * FROM official_participant_bindings ORDER BY game_id,player_id').all(),
      rosters: db.prepare('SELECT * FROM world_roster_heads ORDER BY career_id').all(),
      people: db.prepare('SELECT * FROM world_player_person_links ORDER BY source_id').all(),
    });
    const before = originals(x.f.db);
    const store = x.f.track(open(x.f.path, { readAcceptedKnowledge: id => id === x.knowledgeSource.sourceId ? x.knowledgeSource : null }));
    const value = store.accept(x.knowledgeSource.sourceId); expect(value.known.outs).toBe(x.actor.match.outs);
    expect(value.known.score).toEqual(x.actor.match.score); expect(value.known.startingBase).toBe(1);
    expect(store.accept(x.knowledgeSource.sourceId)).toEqual(value);
    expect(originals(x.f.db)).toEqual(before);
    x.closeHandles(); expect(() => x.f.db.prepare('SELECT 1')).toThrow();
    const reader = open(x.f.path); handles.push(reader);
    expect(reader.read(x.knowledgeSource.sourceId)).toEqual(value); expect(reader.accept(x.knowledgeSource.sourceId)).toEqual(value);
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    const db = new DatabaseSync(x.f.path, { readOnly: true }); handles.push(db);
    expect(originals(db)).toEqual(before);
    expect(value.liveContext).toEqual({ status: 'pending', knownContext: null, force: 'unavailable', tagUp: 'unavailable', consumedSignals: [] });
  } finally { try { while (handles.length) handles.pop()!.close(); } finally { x.close(); } }
}, 180_000);
