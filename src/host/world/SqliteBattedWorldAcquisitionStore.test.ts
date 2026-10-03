import { expect, it } from 'vitest';
import { battedWorldAcquisitionFixture as fixture } from './BattedWorldAcquisitionFixtures.test-support';
import { openSqliteBattedWorldAcquisitionStore } from './SqliteBattedWorldAcquisitionStore';
import { openSqliteBattedWorldContinuationStore } from './SqliteBattedWorldContinuationStore';

it('owns actual uninterrupted acquisition from original response evidence and reopens the immutable archive', () => {
  const { f, response, acquisitionSource: source, acquisitions, responses } = fixture();
  try {
    const value = acquisitions.accept(source.sourceId);
    expect(value.response).toEqual(response); expect(value.continuation).toBeNull();
    expect(value.result.kind).toBe('secured'); expect(value.result.acquirerPlayerId).toBe('p2');
    expect(value).not.toHaveProperty('match'); expect(value).not.toHaveProperty('official'); expect(value).not.toHaveProperty('playEnd');
    const reopened = f.track(openSqliteBattedWorldAcquisitionStore(f.path, responses));
    expect(reopened.read(source.sourceId)).toEqual(value); expect(reopened.accept(source.sourceId)).toEqual(value);
  } finally { f.close(); }
});
it('rejects caller possession/ball/result predicates and missing or unrelated continuation Sources', () => {
  const { f, acquisitionSource: source, acquisitionSources: sources, acquisitions } = fixture();
  try {
    for (const key of ['ball', 'playerId', 'stillRetained', 'secureTick', 'timeline', 'result']) {
      sources.set(source.sourceId, { ...source, [key]: true }); expect(() => acquisitions.accept(source.sourceId)).toThrow();
    }
    sources.set(source.sourceId, { ...source, continuationSourceId: 'missing' }); expect(() => acquisitions.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_acquisitions').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('owns a different later acquirer from the complete actual World prefix and preserves original first touch', () => {
  const { f, response, continuation, laterAcquirerPlayerId, acquisitionSource: source, acquisitions } = fixture(undefined, 'later');
  try {
    expect(response.result.kind).toBe('rebound');
    expect(continuation?.result.steps.at(-1)?.response.kind).toBe('capture_candidate');
    const value = acquisitions.accept(source.sourceId);
    expect(value.continuation).toEqual(continuation); expect(value.result.kind).toBe('secured');
    expect(value.result.acquirerPlayerId).toBe(laterAcquirerPlayerId);
    expect(value.result.acquirerPlayerId).not.toBe('p2');
    expect(value.response.touch).toEqual(response.touch);
    expect(acquisitions.read(source.sourceId)).toEqual(value);
  } finally { f.close(); }
});
it.each([
  "UPDATE batted_world_continuations SET source_hash='changed'",
  "UPDATE batted_world_continuations SET snapshot_hash='changed'",
  "UPDATE batted_world_continuation_heads SET source_id='missing'",
])('re-derives every actual acquisition prefix row/head: %s', (sql) => {
  const { f, acquisitionSource: source, acquisitions } = fixture(undefined, 'later');
  try { acquisitions.accept(source.sourceId); f.db.exec(sql); expect(() => acquisitions.read(source.sourceId)).toThrow(); }
  finally { f.close(); }
});
it('rejects competing ownership of the same physical acquisition and immutable Source rebinding', () => {
  const { f, acquisitionSource: source, acquisitionSources: sources, acquisitions } = fixture();
  try {
    const value = acquisitions.accept(source.sourceId);
    sources.set(source.sourceId, { ...source, continuationSourceId: 'changed' }); expect(() => acquisitions.accept(source.sourceId)).toThrow();
    const competing = { ...source, sourceId: 'competing' }; sources.set(competing.sourceId, competing);
    expect(() => acquisitions.accept(competing.sourceId)).toThrow();
    expect(acquisitions.read(source.sourceId)).toEqual(value);
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_acquisitions').get()).toEqual({ n: 1 });
  } finally { f.close(); }
});
it.each([false, true])('rejects orphan same-pitch continuation evidence with existing acquisition=%s', (saved) => {
  const { f, response, responses, acquisitionSource: source, acquisitions } = fixture();
  try {
    if (saved) acquisitions.accept(source.sourceId);
    f.track(openSqliteBattedWorldContinuationStore(f.path, responses));
    f.db.prepare('INSERT INTO batted_world_continuations VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
      'orphan', response.source.sourceId, null, 'orphan-predecessor', response.touch.worldContact.flight.source.physicalPitchSourceId,
      response.model.gameId, 1, '{}', 'invalid', '{}', 'invalid');
    if (saved) expect(() => acquisitions.read(source.sourceId)).toThrow(/prefix head/);
    expect(() => acquisitions.accept(source.sourceId)).toThrow(/prefix head/);
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_acquisitions').get()).toEqual({ n: saved ? 1 : 0 });
  } finally { f.close(); }
});
it.each([
  "UPDATE batted_world_acquisitions SET response_source_id='missing'",
  "UPDATE batted_world_acquisitions SET physical_pitch_source_id='wrong'",
  "UPDATE batted_world_acquisitions SET snapshot_hash='changed'",
  "UPDATE batted_contact_responses SET snapshot_hash='changed'",
  "UPDATE batted_contact_response_models SET source_hash='changed'",
])('rejects own original/archive corruption: %s', (sql) => {
  const { f, acquisitionSource: source, acquisitions } = fixture();
  try { acquisitions.accept(source.sourceId); f.db.exec(sql); expect(() => acquisitions.read(source.sourceId)).toThrow(); }
  finally { f.close(); }
});
