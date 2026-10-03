import { expect, it } from 'vitest';
import { battedWorldMotionFixture as fixture } from './BattedWorldMotionFixtures.test-support';
import { openSqliteBattedWorldMotionStore } from './SqliteBattedWorldMotionStore';
import { openSqliteBattedWorldContinuationStore } from './SqliteBattedWorldContinuationStore';

it.each(['free', 'carried', 'later'] as const)('owns %s motion from the actual original evidence and reopens its immutable archive', (kind) => {
  const { f, responses, response, acquisition, motions, motionSource: source } = fixture(undefined, kind);
  try {
    const value = motions.accept(source.sourceId);
    expect(value.response).toEqual(response); expect(value.acquisition).toEqual(acquisition); expect(value.motion.actors).toHaveLength(50);
    expect(value.motion.response.kind).toBe(kind === 'free' ? 'moving' : 'carried');
    expect(value.motion.cursor?.moment.ball.tick).toBe(source.throughTick);
    expect(value).not.toHaveProperty('official'); expect(value).not.toHaveProperty('playEnd');
    const reopened = f.track(openSqliteBattedWorldMotionStore(f.path, responses));
    expect(reopened.read(source.sourceId)).toEqual(value); expect(reopened.accept(source.sourceId)).toEqual(value);
  } finally { f.close(); }
});
it('appends from the exact preceding actor/ball state and preserves all original physical archives', () => {
  const { f, responses, response, motions, motionSources: sources, motionSource: source } = fixture();
  try {
    const first = motions.accept(source.sourceId), next = { ...source, sourceId: 'motion-2', previousMotionSourceId: source.sourceId,
      availableAtTick: source.throughTick, throughTick: source.throughTick + 1000,
      commands: source.commands.map((command) => ({ ...command, bodyAcceleration: { x: 1, y: 0, z: 0 } })) };
    sources.set(next.sourceId, next); const second = motions.accept(next.sourceId);
    expect(second.revision).toBe(2); expect(second.history).toEqual([source, next]);
    expect(second.motion.actors[0].startElapsedSeconds).toBe(first.motion.cursor?.moment.elapsedSeconds);
    expect(motions.read(source.sourceId)).toEqual(first); expect(motions.accept(source.sourceId)).toEqual(first);
    expect(responses.read(response.source.sourceId)).toEqual(response);
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_motions').get()).toEqual({ n: 2 });
    expect(() => motions.accept(source.sourceId)).not.toThrow();
  } finally { f.close(); }
});
it('rejects caller state/possession/outcome and incomplete or velocity-changing commands', () => {
  const { f, motions, motionSources: sources, motionSource: source } = fixture();
  try {
    for (const field of ['ball', 'actors', 'world', 'possession', 'secureTick', 'result', 'timeline']) {
      sources.set(source.sourceId, { ...source, [field]: true }); expect(() => motions.accept(source.sourceId)).toThrow();
    }
    sources.set(source.sourceId, { ...source, commands: source.commands.slice(1) }); expect(() => motions.accept(source.sourceId)).toThrow();
    sources.set(source.sourceId, { ...source, commands: source.commands.map((command) => ({ ...command,
      primitiveMotions: command.primitiveMotions.map((motion) => ({ ...motion, offsetVelocity: { x: 5, y: 0, z: 0 } })) })) });
    expect(() => motions.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_motions').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it.each([
  "UPDATE batted_world_motions SET source_hash='changed'",
  "UPDATE batted_world_motions SET snapshot_hash='changed'",
  "UPDATE batted_world_motions SET physical_pitch_source_id='wrong'",
  'UPDATE batted_world_motions SET revision=revision+1',
  "UPDATE batted_world_motion_heads SET source_id='missing'",
  'DELETE FROM batted_world_motion_heads',
  "UPDATE batted_contact_responses SET snapshot_hash='changed'",
])('replays its own complete prefix and rejects corruption: %s', (sql) => {
  const { f, motions, motionSource: source } = fixture();
  try { motions.accept(source.sourceId); f.db.exec(sql); expect(() => motions.read(source.sourceId)).toThrow(); }
  finally { f.close(); }
});
it('rejects an orphan original continuation before executing a null-prefix motion Source', () => {
  const { f, responses, response, motions, motionSource: source } = fixture();
  try {
    f.track(openSqliteBattedWorldContinuationStore(f.path, responses));
    f.db.prepare('INSERT INTO batted_world_continuations VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('orphan', response.source.sourceId, null,
      'orphan', response.touch.worldContact.flight.source.physicalPitchSourceId, response.model.gameId, 1, '{}', 'invalid', '{}', 'invalid');
    expect(() => motions.accept(source.sourceId)).toThrow(/prefix head/);
  } finally { f.close(); }
});
it('rejects fresh original continuation when a later actual motion owner already executes that future', () => {
  const { f, responses, response, motions, motionSource: source } = fixture();
  try {
    motions.accept(source.sourceId);
    const original = { sourceId: 'stale-original', sourceVersion: 'fixture-v1', responseSourceId: response.source.sourceId,
      previousContinuationSourceId: null, throughTick: response.touch.worldContact.actors[0].primitive.endTick };
    const continuations = f.track(openSqliteBattedWorldContinuationStore(f.path, responses, { readAcceptedContinuation: () => original }));
    expect(() => continuations.accept(original.sourceId)).toThrow(/motion owner/);
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_continuations').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('rejects fresh original World execution after the actual motion owner while preserving original reads', () => {
  const { f, response, responses, contacts, worldContact, sources, motions, motionSource: source } = fixture();
  try {
    motions.accept(source.sourceId);
    const stale = { ...worldContact.source, sourceId: 'stale-original-world' }; sources.set(stale.sourceId, stale);
    expect(() => contacts.accept(stale.sourceId)).toThrow(/motion owner/);
    expect(contacts.read(worldContact.source.sourceId)).toEqual(worldContact);
    expect(responses.read(response.source.sourceId)).toEqual(response);
  } finally { f.close(); }
});
it('rejects competing predecessors, root rebinding and immutable command rebinding', () => {
  const { f, motions, motionSources: sources, motionSource: source } = fixture();
  try {
    const value = motions.accept(source.sourceId);
    sources.set(source.sourceId, { ...source, throughTick: source.throughTick + 1 }); expect(() => motions.accept(source.sourceId)).toThrow(/frozen/);
    sources.set('competing', { ...source, sourceId: 'competing' }); expect(() => motions.accept('competing')).toThrow(/predecessor/);
    sources.set('rebound-root', { ...source, sourceId: 'rebound-root', previousMotionSourceId: source.sourceId, acquisitionSourceId: 'missing' });
    expect(() => motions.accept('rebound-root')).toThrow();
    expect(motions.read(source.sourceId)).toEqual(value);
  } finally { f.close(); }
});
