import { expect, it } from 'vitest';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import { openSqliteActualLivePlayStore } from './SqliteActualLivePlayStore';
import type { AcceptedActualLivePlayScope } from './ActualLivePlayScope';

it('keeps an original Native runner explicitly unsupported without assigning any field body or motion', () => {
  const x = physicalPlateAppearanceActorFixture();
  try {
    x.actors.accept(x.source.sourceId); let tick = 0;
    for (let i = 0; i < 4; i++) {
      const a = continuousPitchAction(x.f, i, tick);
      x.actions.set(a.sourceId, { ...a, request: { ...a.request, delivery: { ...a.request.delivery,
        moundReference: { ...a.request.delivery.moundReference, x: 1 } } } });
      tick = x.pitches.accept(a.sourceId, i).result.pitch.resolution.timeline.lastEventTick;
    }
    const closing = x.closeInput(tick, 'pitch-3', 'away-1'); x.closes.set(closing.sourceId, closing); x.closure.submit(closing.sourceId);
    x.accepted.set('batter-2', { sourceId: 'batter-2', sourceVersion: 'v1', gameId: 'game-1', playerId: 'away-2', activationApplicationId: 'application-1' });
    x.actors.accept('batter-2');
    const current = x.f.official.getMatch('game-1')!, a = continuousPitchAction(x.f, 0, current.nextWorld!.tick);
    const { initialWorldSourceId: _initial, ...rest } = a as typeof a & { initialWorldSourceId: string };
    const next = { ...rest, sourceId: 'pitch-with-runner', activationApplicationId: 'application-1', request: { ...a.request, workloadRevision: 1 } };
    x.actions.set(next.sourceId, next); const pitch = x.pitches.accept(next.sourceId, 0);
    expect(pitch.frame.match.bases.first).toBe('away-1'); expect(pitch.frame.world.runners).toHaveLength(1);
    const source: AcceptedActualLivePlayScope = { sourceId: 'unsupported-scope', sourceVersion: 'v1', capability: 'actual_live_play_scope_v1',
      physicalPitchSourceId: pitch.source.sourceId, cut: { kind: 'original_pitch' } };
    const store = x.f.track(openSqliteActualLivePlayStore(x.f.path, { readAcceptedScope: () => source }));
    const saved = store.accept(source.sourceId), result = store.evaluate(source.sourceId);
    expect(saved.scope.participation).toBe('unsupported_pre_pitch_participation');
    expect(saved.scope.unsupportedParticipantIds).toEqual(['away-1']);
    expect(saved.scope.participants.every(p => p.bodyModel === null)).toBe(true);
    expect(saved.scope.physicalReferences).toEqual([]);
    expect(result.kind).toBe('pending'); expect(result.playEnd).toBe(null);
    expect(result.registry.frontier.physical).toEqual([]);
    expect(x.f.db.prepare("SELECT name FROM sqlite_master WHERE name='batted_world_field_executions'").all()).toEqual([]);
  } finally { x.f.close(); }
});
