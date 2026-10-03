import { expect, it } from 'vitest';
import { battedWorldContinuationFixture as fixture } from './BattedWorldContinuationFixtures.test-support';
import { openSqliteBattedWorldContinuationStore } from './SqliteBattedWorldContinuationStore';

it.each(['body', 'failed_glove', 'surface', 'ground'] as const)('owns actual %s continuation and reopens the original history without a caller ball', (kind) => {
  const { f, response, continuationSource: source, continuations, responses } = fixture(undefined, kind);
  try {
    const value = continuations.accept(source.sourceId);
    expect(value.response).toEqual(response); expect(value.revision).toBe(1);
    expect(value.result.steps).toHaveLength(1); expect(value.result.steps[0].world.kind).toBe('boundary');
    expect(value).not.toHaveProperty('match'); expect(value).not.toHaveProperty('playEnd');
    const reopened = f.track(openSqliteBattedWorldContinuationStore(f.path, responses));
    expect(reopened.read(source.sourceId)).toEqual(value); expect(reopened.accept(source.sourceId)).toEqual(value);
  } finally { f.close(); }
});
it('appends actual prefixes and keeps earlier immutable snapshots readable after a later head', () => {
  const { f, continuationSource: source, continuationSources: sources, continuations } = fixture();
  try {
    const first = continuations.accept(source.sourceId);
    const next = { ...source, sourceId: 'continuation-2', previousContinuationSourceId: source.sourceId };
    sources.set(next.sourceId, next);
    const second = continuations.accept(next.sourceId);
    expect(second.revision).toBe(2); expect(second.result.steps).toHaveLength(2);
    expect(continuations.read(source.sourceId)).toEqual(first);
    expect(continuations.accept(source.sourceId)).toEqual(first);
    expect(f.db.prepare('SELECT source_id,revision FROM batted_world_continuation_heads').get()).toEqual({ source_id: next.sourceId, revision: 2 });
  } finally { f.close(); }
});
it.each(['glove', 'simultaneous', 'airborne'] as const)('does not turn a pending/no-progress %s source into acquired possession or closure', (kind) => {
  const { f, continuationSource: source, continuations } = fixture(undefined, kind);
  try {
    expect(() => continuations.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_continuations').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('rejects caller ball/result/territory, unknown predecessors and motion horizons beyond the original coverage', () => {
  const { f, continuationSource: source, continuationSources: sources, continuations } = fixture();
  try {
    for (const field of ['ball', 'catchResult', 'timeline', 'territory', 'playEnd']) {
      sources.set(source.sourceId, { ...source, [field]: true }); expect(() => continuations.accept(source.sourceId)).toThrow();
    }
    sources.set(source.sourceId, { ...source, previousContinuationSourceId: 'unknown' }); expect(() => continuations.accept(source.sourceId)).toThrow();
    sources.set(source.sourceId, { ...source, throughTick: source.throughTick + 1 }); expect(() => continuations.accept(source.sourceId)).toThrow();
  } finally { f.close(); }
});
it('rejects competing successors, self-cycles and source rebinding on retries', () => {
  const { f, continuationSource: source, continuationSources: sources, continuations } = fixture();
  try {
    continuations.accept(source.sourceId);
    sources.set('competing', { ...source, sourceId: 'competing' }); expect(() => continuations.accept('competing')).toThrow();
    sources.set('cycle', { ...source, sourceId: 'cycle', previousContinuationSourceId: 'cycle' }); expect(() => continuations.accept('cycle')).toThrow();
    sources.set(source.sourceId, { ...source, throughTick: source.throughTick - 1 }); expect(() => continuations.accept(source.sourceId)).toThrow('frozen');
    continuations.close(); expect(() => continuations.read(source.sourceId)).toThrow('closed');
  } finally { f.close(); }
});
it.each([
  "UPDATE batted_world_continuations SET source_hash='changed'",
  "UPDATE batted_world_continuations SET snapshot_hash='changed'",
  "UPDATE batted_world_continuations SET physical_pitch_source_id='wrong'",
  'UPDATE batted_world_continuations SET revision=revision+1',
  "UPDATE batted_world_continuation_heads SET source_id='missing'",
  'DELETE FROM batted_world_continuation_heads',
])('rejects corrupted own prefix/head: %s', (sql) => {
  const { f, continuationSource: source, continuations } = fixture();
  try {
    continuations.accept(source.sourceId); f.db.exec(sql); expect(() => continuations.read(source.sourceId)).toThrow();
  } finally { f.close(); }
});
