import { continuousPitchAction, continuousPitchFixture } from './ContinuousPitchFixtures.test-support';
import { openSqlitePhysicalPitchProgressStore, type AcceptedPhysicalPitchActionSource } from './SqlitePhysicalPitchProgressStore';
import { openSqlitePhysicalPlayClosureStore, type AcceptedPhysicalPlayClosure } from './SqlitePhysicalPlayClosureStore';
import { openSqlitePhysicalPlateAppearanceActorStore, type AcceptedPhysicalPlateAppearanceActor } from './SqlitePhysicalPlateAppearanceActorStore';

export const physicalPlateAppearanceActorFixture = (databasePath?: string, fixture?: Parameters<typeof continuousPitchFixture>[2], profile?: Parameters<typeof continuousPitchFixture>[3]) => {
  const f = continuousPitchFixture(databasePath, true, fixture, profile);
  const source: AcceptedPhysicalPlateAppearanceActor = { sourceId: 'batter-1', sourceVersion: 'fixture-v1', gameId: 'game-1', playerId: 'away-1', initialWorldSourceId: 'initial-world' };
  const accepted = new Map<string, AcceptedPhysicalPlateAppearanceActor>([[source.sourceId, source]]);
  const sources = { matches: f.official, initialWorlds: f.initialWorlds, participation: f.participation };
  const actors = f.track(openSqlitePhysicalPlateAppearanceActorStore(f.path, sources, { readAcceptedActor: (id) => accepted.get(id) ?? null }));
  const actions = new Map<string, AcceptedPhysicalPitchActionSource>();
  const pitches = f.track(openSqlitePhysicalPitchProgressStore(f.path, { ...sources, runtime: f.stores }, { readAcceptedAction: (id) => actions.get(id) ?? null }));
  const pitch = (index: number, readyAtUs: number) => { const action = continuousPitchAction(f, index, readyAtUs); actions.set(action.sourceId, action); return pitches.accept(action.sourceId, index); };
  const closes = new Map<string, AcceptedPhysicalPlayClosure>();
  const closure = f.track(openSqlitePhysicalPlayClosureStore(f.path, { physicalPitches: pitches, initialWorlds: f.initialWorlds,
    participation: f.participation, personLinks: f.links }, { readAcceptedClosure: (id) => closes.get(id) ?? null }));
  const closeInput = (tick: number, physicalPitchSourceId = 'pitch-2', batterRunnerId: string | null = null): AcceptedPhysicalPlayClosure => ({
      sourceId: 'close-1', sourceVersion: 'fixture-v1', physicalPitchSourceId,
      applicationId: 'application-1', scoringApplicationId: 'scoring-1', snapshotId: 'rule-1', ruleTick: tick + 1, closureTick: tick + 2,
      nextStartedAtTick: tick + 3, batterRunnerId, worldSetup: f.firstInput.worldSetup,
      game: { seasonId: 'league-season-1', homeClubId: 'club-a', awayClubId: 'club-b', policy: { version: 'fixture-v1', minimumInnings: 9, maximumInnings: 9, tiesAllowed: true } } });
  const close = () => {
    let tick = 0; for (let i = 0; i < 3; i++) tick = pitch(i, tick).result.pitch.resolution.timeline.lastEventTick;
    const source = closeInput(tick);
    closes.set(source.sourceId, source); return closure.submit(source.sourceId);
  };
  return { f, source, accepted, sources, actors, actions, pitches, pitch, close, closeInput, closes, closure };
};
