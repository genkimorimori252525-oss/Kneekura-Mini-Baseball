import { expect, it } from 'vitest';
import { continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import type { AcceptedPhysicalPitchActionSource } from './SqlitePhysicalPitchProgressStore';
import { openSqlitePhysicalPlateAppearanceActorStore } from './SqlitePhysicalPlateAppearanceActorStore';

import { physicalPlateAppearanceActorFixture as fixture } from './PhysicalPlateAppearanceActorFixtures.test-support';

it('freezes the actual offensive Player/Person before physical pitches and retains original completed participation after offline reopen', () => {
  const { f, source, sources, accepted, actors, close } = fixture();
  try {
    const actor = actors.accept(source.sourceId);
    expect(actor.binding).toMatchObject({ playerId: 'away-1', personId: 'person-away-1', side: 'AWAY', gameDay: 10 });
    expect(actors.readCompletedAppearance(source.sourceId)).toBeNull();
    const closed = close();
    expect(actors.readCompletedAppearance(source.sourceId)).toMatchObject({ actor, playedPlayId: 7,
      officialApplicationId: 'application-1', scoringApplicationId: 'scoring-1', durableRevision: 1, record: closed.scoring.record });
    accepted.clear();
    const reopened = f.track(openSqlitePhysicalPlateAppearanceActorStore(f.path, sources));
    expect(reopened.accept(source.sourceId)).toEqual(actor);
    expect(reopened.readCompletedAppearance(source.sourceId)).toEqual(actors.readCompletedAppearance(source.sourceId));
  } finally { f.close(); }
});

it('rejects a defending actor or another batter alias for the same play and changes after the first pitch', () => {
  const { f, source, accepted, actors, pitch } = fixture();
  try {
    accepted.set(source.sourceId, { ...source, playerId: 'home-1' });
    expect(() => actors.accept(source.sourceId)).toThrow('actor');
    accepted.set(source.sourceId, source); actors.accept(source.sourceId);
    accepted.set('alias', { ...source, sourceId: 'alias', playerId: 'away-2' });
    expect(() => actors.accept('alias')).toThrow();
    pitch(0, 0);
    accepted.set(source.sourceId, { ...source, playerId: 'away-2' });
    expect(() => actors.accept(source.sourceId)).toThrow('frozen');
    expect(actors.read(source.sourceId)!.binding.playerId).toBe('away-1');
  } finally { f.close(); }
});

it('requires a newly accepted batter before the next physical play in a game that owns its actors', () => {
  const { f, source, accepted, actors, close, actions, pitches } = fixture();
  try {
    actors.accept(source.sourceId); close();
    const current = f.official.getMatch('game-1')!;
    const { initialWorldSourceId: _initial, ...action } = continuousPitchAction(f, 0, current.nextWorld!.tick) as AcceptedPhysicalPitchActionSource & { initialWorldSourceId: string };
    const next = { ...action, sourceId: 'next-pitch', activationApplicationId: 'application-1', request: { ...action.request, workloadRevision: 1 } };
    actions.set(next.sourceId, next);
    expect(() => pitches.accept(next.sourceId, 0)).toThrow('batter');
    accepted.set('batter-2', { sourceId: 'batter-2', sourceVersion: 'fixture-v1', gameId: 'game-1', playerId: 'away-2', activationApplicationId: 'application-1' });
    actors.accept('batter-2');
    expect(pitches.accept(next.sourceId, 0).frame.batterActor!.binding.playerId).toBe('away-2');
  } finally { f.close(); }
});

it('rejects introducing a batter into physical actions already accepted without actor ownership', () => {
  const { f, source, actors, pitch } = fixture();
  try {
    pitch(0, 0);
    expect(() => actors.accept(source.sourceId)).toThrow('started');
    expect(f.db.prepare('SELECT count(*) AS n FROM physical_plate_appearance_actors').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});

it('retains the started-play guard when actual physical action history remains after its head is missing', () => {
  const { f, source, actors, pitch } = fixture();
  try {
    pitch(0, 0); f.db.prepare("DELETE FROM physical_pitch_progress_heads WHERE game_id='game-1'").run();
    expect(() => actors.accept(source.sourceId)).toThrow('started');
    expect(f.db.prepare('SELECT count(*) AS n FROM physical_plate_appearance_actors').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});

it('ties an actual physical walk and its runner to the originally accepted batter instead of another registered offensive Player', () => {
  const { f, source, actors, actions, pitches, closeInput, closes, closure } = fixture();
  try {
    actors.accept(source.sourceId);
    let tick = 0;
    for (let index = 0; index < 4; index++) {
      const action = continuousPitchAction(f, index, tick);
      actions.set(action.sourceId, { ...action, request: { ...action.request,
        delivery: { ...action.request.delivery, moundReference: { ...action.request.delivery.moundReference, x: 1 } } } });
      tick = pitches.accept(action.sourceId, index).result.pitch.resolution.timeline.lastEventTick;
    }
    const input = closeInput(tick, 'pitch-3', 'away-2'); closes.set(input.sourceId, input);
    expect(() => closure.submit(input.sourceId)).toThrow('actual batter');
    expect(f.official.getMatch('game-1')!.durableRevision).toBe(0);
    closes.set(input.sourceId, { ...input, batterRunnerId: 'away-1' });
    expect(closure.submit(input.sourceId).official.receipt.appliedMatchState.bases.first).toBe('away-1');
    expect(actors.readCompletedAppearance(source.sourceId)).toMatchObject({ actor: { binding: { playerId: 'away-1' } }, record: { classification: 'base_on_balls' } });
  } finally { f.close(); }
});

it('rejects an ordinary activation with altered actual scoring before accepting its next batter', () => {
  const { f, accepted, actors } = fixture();
  try {
    f.official.applyAndActivate(f.firstInput);
    f.scoring.apply({ scoringApplicationId: 'scoring-ordinary', officialApplication: f.firstInput });
    accepted.set('batter-next', { sourceId: 'batter-next', sourceVersion: 'fixture-v1', gameId: 'game-1', playerId: 'away-1', activationApplicationId: 'application-1' });
    const row = f.db.prepare('SELECT result_json FROM official_scoring_applications').get() as { result_json: string };
    f.db.prepare("UPDATE official_scoring_applications SET result_json='{}'").run();
    expect(() => actors.accept('batter-next')).toThrow('scoring');
    expect(f.db.prepare('SELECT count(*) AS n FROM physical_plate_appearance_actors').get()).toEqual({ n: 0 });
    f.db.prepare('UPDATE official_scoring_applications SET result_json=?').run(row.result_json);
    expect(actors.accept('batter-next').match.playId).toBe(8);
  } finally { f.close(); }
});
