import { expect, it } from 'vitest';
import { ownedBattedWorldMotionFixture as fixture } from './OwnedBattedWorldMotionFixtures.test-support';
it('discovers off-namespace execution forks claiming an original predecessor through each ownership mirror', () => {
  const x = fixture();
  try {
    const row = x.f.db.prepare('SELECT * FROM batted_world_field_executions WHERE source_id=?').get(x.bootstrap.sourceId)!;
    const source = { sourceId: 'foreign-index', sourceVersion: 'v1', baseFieldSourceId: 'foreign-field', previousExecutionSourceId: null as string | null };
    const original = JSON.parse((row.snapshot_json as string).replaceAll(row.physical_pitch_source_id as string, 'foreign-pitch')
      .replaceAll(row.base_field_source_id as string, 'foreign-field'));
    for (const claim of ['index', 'source', 'snapshot_source', 'history']) {
      const indexedPrevious = claim === 'index' ? x.bootstrap.sourceId : null;
      const claimed = { ...source, previousExecutionSourceId: x.bootstrap.sourceId };
      const snapshot = { ...original, source: claim === 'snapshot_source' ? claimed : source,
        history: [claim === 'history' ? claimed : source] };
      x.f.db.prepare('INSERT INTO batted_world_field_executions VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run('foreign-index', 'foreign-pitch', 'foreign-field', indexedPrevious, 1, 'foreign-game',
          JSON.stringify(claim === 'source' ? claimed : source), 'opaque', JSON.stringify(snapshot), 'opaque');
      x.f.db.prepare('INSERT INTO batted_world_field_execution_heads VALUES (?,?,?,?)').run('foreign-pitch', 'foreign-field', 'foreign-index', 1);
      expect(() => x.executions.read(x.bootstrap.sourceId), claim).toThrow(/ownership|metadata|prefix|identity/);
      x.f.db.prepare('DELETE FROM batted_world_field_execution_heads WHERE source_id=?').run('foreign-index');
      x.f.db.prepare('DELETE FROM batted_world_field_executions WHERE source_id=?').run('foreign-index');
    }
  } finally { x.f.close(); }
});

it('discovers a foreign execution claiming the original base field only through its nested Source mirror', () => {
  const x = fixture();
  try {
    const row = x.f.db.prepare('SELECT * FROM batted_world_field_executions WHERE source_id=?').get(x.bootstrap.sourceId)!;
    const source = { sourceId: 'foreign-index', sourceVersion: 'v1', baseFieldSourceId: 'foreign-field', previousExecutionSourceId: null };
    const snapshot = JSON.parse(row.snapshot_json as string);
    snapshot.source = source; snapshot.history = [source];
    snapshot.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId = 'foreign-pitch';
    x.f.db.prepare('INSERT INTO batted_world_field_executions VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run('foreign-index', 'foreign-pitch', 'foreign-field', null, 1, 'foreign-game', JSON.stringify(source), 'opaque', JSON.stringify(snapshot), 'opaque');
    x.f.db.prepare('INSERT INTO batted_world_field_execution_heads VALUES (?,?,?,?)').run('foreign-pitch', 'foreign-field', 'foreign-index', 1);
    expect(snapshot.baseField.source.sourceId).toBe(x.baseField.source.sourceId);
    expect(() => x.executions.read(x.bootstrap.sourceId)).toThrow(/ownership|metadata|prefix|identity/);
    // A second escaped-key container cannot hide the same ownership claim.
    const duplicated = JSON.stringify(snapshot).replace('"baseField":', '"baseField":{"source":{"sourceId":"foreign-field"}},"base\\u0046ield":');
    x.f.db.prepare('UPDATE batted_world_field_executions SET snapshot_json=? WHERE source_id=?').run(duplicated, 'foreign-index');
    expect(() => x.executions.read(x.bootstrap.sourceId)).toThrow(/ownership|metadata|prefix|identity/);
  } finally { x.f.close(); }
});

it('rejects ambiguous future physical ownership before an earlier bounded replay', () => {
  const x = fixture();
  try {
    const future = { ...x.bootstrap, sourceId: 'later-raw-checkpoint', previousExecutionSourceId: x.bootstrap.sourceId,
      action: { kind: 'retained_motion_checkpoint_v1' as const, checkpointThroughTick: x.at + 200 } };
    x.sources.set(future.sourceId, future); x.executions.accept(future.sourceId);
    const row = x.f.db.prepare('SELECT source_json FROM batted_world_field_executions WHERE source_id=?').get(future.sourceId)!;
    const text = row.source_json as string;
    x.f.db.prepare('UPDATE batted_world_field_executions SET source_json=? WHERE source_id=?')
      .run(text.replace('"previousExecutionSourceId":', '"previousExecutionSourceId":"foreign","previousExecutionSourceId":'), future.sourceId);
    expect(() => x.executions.read(x.bootstrap.sourceId)).toThrow(/metadata/);
  } finally { x.f.close(); }
});

it('rejects foreign physical rows claiming an original Source identity through body metadata', () => {
  const x = fixture();
  try {
    const sourceId = x.bootstrap.sourceId;
    const row = x.f.db.prepare('SELECT * FROM batted_world_field_executions WHERE source_id=?').get(sourceId)!;
    const foreign = (raw: string) => raw.replaceAll(row.physical_pitch_source_id as string, 'foreign-pitch').replaceAll(row.base_field_source_id as string, 'foreign-field');
    x.f.db.prepare('INSERT INTO batted_world_field_executions VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run('foreign-index', 'foreign-pitch', 'foreign-field', null, 1, 'foreign-game', foreign(row.source_json as string), 'opaque', foreign(row.snapshot_json as string), 'opaque');
    x.f.db.prepare('INSERT INTO batted_world_field_execution_heads VALUES (?,?,?,?)').run('foreign-pitch', 'foreign-field', 'foreign-index', 1);
    expect(() => x.executions.read(sourceId)).toThrow(/identity|ownership/);
    const foreignSource = { sourceId: 'foreign-index', sourceVersion: 'v1', baseFieldSourceId: 'foreign-field', previousExecutionSourceId: null };
    for (const end of [foreignSource, null]) {
      const snapshot = JSON.parse(foreign(row.snapshot_json as string));
      snapshot.source = foreignSource; snapshot.history = [JSON.parse(foreign(row.source_json as string)), end];
      x.f.db.prepare('UPDATE batted_world_field_executions SET source_json=?,snapshot_json=? WHERE source_id=?')
        .run(JSON.stringify(foreignSource), JSON.stringify(snapshot), 'foreign-index');
      expect(() => x.executions.read(sourceId)).toThrow(/identity|ownership/);
    }
  } finally { x.f.close(); }
});
