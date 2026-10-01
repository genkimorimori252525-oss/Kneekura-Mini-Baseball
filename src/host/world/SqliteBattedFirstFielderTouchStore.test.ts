import { expect, it } from 'vitest';
import { battedFirstFielderTouchFixture as fixture } from './BattedFirstFielderTouchFixtures.test-support';
import { openSqliteBattedFirstFielderTouchStore } from './SqliteBattedFirstFielderTouchStore';

it.each(['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const)('owns original actual %s contact and its territory without caller outcome or fake retention', (role) => {
  const { f, worldContact, touchSource, touches, touchSources, contacts } = fixture(undefined, role);
  try {
    expect(worldContact.result).toMatchObject({ kind: 'contact', contacts: [{ kind: 'actor', playerId: 'p2', role }] });
    const value = touches.accept(touchSource.sourceId);
    expect(value.worldContact).toEqual(worldContact);
    expect(value.result.kind).toBe('recorded');
    if (value.result.kind !== 'recorded' || worldContact.result.kind !== 'contact') throw new Error('actual Native fixture must touch');
    expect(value.result.evidence).toMatchObject({ fielderId: 'p2', tick: worldContact.result.tick, ballCenter: worldContact.result.ball.position });
    expect(value.result.territory).toBe('fair');
    expect(value.result.timeline.status.kind).toBe('live_ball');
    expect(value.result.timeline.events.some((e) => /Catch|Out|Ended/.test(e.kind))).toBe(false);
    expect(f.official.getMatch('game-1')!.durableRevision).toBe(0);
    expect(f.workload.readHead('career-a', 'p2')!.revision).toBe(0);
    touchSources.clear();
    const reopened = f.track(openSqliteBattedFirstFielderTouchStore(f.path, contacts));
    expect(reopened.read(touchSource.sourceId)).toEqual(value);
    expect(reopened.accept(touchSource.sourceId)).toEqual(value);
  } finally { f.close(); }
});

it.each(['ground', 'surface', 'batter', 'simultaneous', 'airborne'] as const)('persists explicit %s boundary without inventing defender or territory', (kind) => {
  const { f, worldContact, touches, touchSource } = fixture(undefined, kind);
  try {
    const value = touches.accept(touchSource.sourceId);
    expect(value.result).toMatchObject({ kind: 'unresolved', reason: kind === 'batter' ? 'non_defender' : kind });
    if (kind === 'batter') expect(worldContact.result).toMatchObject({ kind: 'contact', contacts: [{ kind: 'actor',
      playerId: worldContact.flight.physicalPitch.frame.batterActor!.binding.playerId, role: 'body' }] });
    if (kind === 'simultaneous') expect(worldContact.result).toMatchObject({ kind: 'contact', contacts: [
      { kind: 'actor', playerId: 'p2', role: 'body' }, { kind: 'actor', playerId: 'p2', role: 'glove' }] });
    expect(value.result.timeline).toEqual(worldContact.timeline);
    expect(value.result.timeline.events.some((e) => e.kind === 'BattedBallFirstFielderTouch')).toBe(false);
  } finally { f.close(); }
});

it('retains the original airborne interpretation while the actual World advances to its next physical contact', () => {
  const { f, touchSource, touchSources, touches, source, sources, contacts } = fixture(undefined, 'airborne');
  try {
    const original = touches.accept(touchSource.sourceId);
    const next = { ...source, sourceId: 'next-world', previousContactSourceId: source.sourceId };
    sources.set(next.sourceId, next); contacts.accept(next.sourceId);
    touchSources.set('next-touch', { ...touchSource, sourceId: 'next-touch', worldContactSourceId: next.sourceId });
    expect(touches.accept('next-touch').result).toMatchObject({ kind: 'unresolved', reason: 'ground' });
    expect(touches.read(touchSource.sourceId)).toEqual(original);
    expect(touches.accept(touchSource.sourceId)).toEqual(original);
  } finally { f.close(); }
});

it.each(['missing', 'caller_territory', 'changed_original', 'duplicate_contact'] as const)('rejects %s Source without changing the original physical World', (kind) => {
  const { f, touchSource, touchSources, touches, worldContact } = fixture();
  try {
    if (kind === 'missing') touchSources.set(touchSource.sourceId, { ...touchSource, worldContactSourceId: 'absent' });
    if (kind === 'caller_territory') touchSources.set(touchSource.sourceId, { ...touchSource, territory: 'fair' } as typeof touchSource);
    if (kind === 'changed_original') f.db.prepare("UPDATE batted_world_contacts SET snapshot_hash='changed'").run();
    if (kind === 'duplicate_contact') {
      touches.accept(touchSource.sourceId);
      touchSources.set('duplicate', { ...touchSource, sourceId: 'duplicate' });
    }
    expect(() => touches.accept(kind === 'duplicate_contact' ? 'duplicate' : touchSource.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_first_fielder_touches').get()).toEqual({ n: kind === 'duplicate_contact' ? 1 : 0 });
    expect(f.official.getMatch(worldContact.model.gameId)!.durableRevision).toBe(0);
  } finally { f.close(); }
});
