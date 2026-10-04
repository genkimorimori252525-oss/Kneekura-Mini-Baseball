import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { actualFieldObservationEvidenceFromSqlite, openSqliteActualFieldObservationStore } from './SqliteActualFieldObservationStore';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
it('keeps absent optional communication metadata from rejecting opaque future legacy rows', () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-legacy-opaque-')), path = join(dir, 'state.sqlite');
  const owner = openSqliteActualFieldObservationStore(path), db = new DatabaseSync(path);
  try {
    expect(db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    db.exec(`CREATE TABLE batted_world_field_actions(source_id TEXT,physical_pitch_source_id TEXT,revision INTEGER,game_id TEXT);
      INSERT INTO batted_world_field_actions VALUES('field','pitch',1,'game');`);
    const first = { sourceId: 'first', sourceVersion: 'v1', physicalPitchSourceId: 'pitch', playerId: 'p1', baseFieldSourceId: 'field', executionSourceId: null,
      observationModelSourceId: 'model', previousObservationSourceId: null,
      view: { poseVersion: 'v1', bodyRelativeEyeOffset: { x: 0, y: 1, z: 0 }, forward: { x: 1, y: 0, z: 0 }, attentionTarget: { kind: 'ball' } } };
    const snapshot = { source: first, history: [first], revision: 1 };
    const insert = db.prepare('INSERT INTO actual_field_observations VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
    insert.run('first','pitch','p1','field',null,'model',null,1,json(first),hash(first),json(snapshot),hash(snapshot));
    insert.run('future','pitch','p1','field',null,'model','first',2,'invalid-future-source','opaque-hash','invalid-future-snapshot','opaque-hash');
    db.prepare('INSERT INTO actual_field_observation_heads VALUES(?,?,?,?)').run('pitch','p1','future',2);
    // A deliberately schema-only test: we require reaching bounded original physical replay,
    // not accepting a mock observation. That replay then fails parsing the deliberately absent Native source JSON.
    expect(() => actualFieldObservationEvidenceFromSqlite(db).read('first')).toThrow(SyntaxError);
  } finally { db.close(); owner.close(); rmSync(dir, { recursive: true }); }
});
