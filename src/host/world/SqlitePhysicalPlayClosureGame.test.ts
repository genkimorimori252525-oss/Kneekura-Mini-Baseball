import { expect, it } from 'vitest';
import { continuousPitchAction, continuousPitchFixture } from './ContinuousPitchFixtures.test-support';
import { worldSetup } from './OfficialParticipationPlayFixtures.test-support';
import { openSqlitePhysicalPitchProgressStore, type AcceptedPhysicalPitchActionSource } from './SqlitePhysicalPitchProgressStore';
import { openSqlitePhysicalPlayClosureStore, type AcceptedPhysicalPlayClosure } from './SqlitePhysicalPlayClosureStore';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';

it('plays both sides through nine actual physical innings and derives the official final line score', () => {
  const f = continuousPitchFixture(undefined, true), actions = new Map<string, AcceptedPhysicalPitchActionSource>();
  const closures = new Map<string, AcceptedPhysicalPlayClosure>();
  const pitches = f.track(openSqlitePhysicalPitchProgressStore(f.path, { matches: f.official, initialWorlds: f.initialWorlds,
    participation: f.participation, runtime: f.stores }, { readAcceptedAction: (id) => actions.get(id) ?? null }));
  const driver = f.track(openSqlitePhysicalPlayClosureStore(f.path, { physicalPitches: pitches, initialWorlds: f.initialWorlds,
    participation: f.participation, personLinks: f.links }, { readAcceptedClosure: (id) => closures.get(id) ?? null }));
  const home = worldSetup('p2'), away = { ...home, defenders: home.defenders.map((d, index) => ({ ...d,
    playerId: index === 0 ? 'p-away' : `away-${index}` })) };
  let activationApplicationId: string | null = null, startedAtTick = 0;
  try {
    for (let appearance = 0; appearance < 54; appearance++) {
      const current = f.official.getMatch('game-1')!, match = current.matchState;
      expect(current.finalResult).toBeNull();
      const playerId = match.half === 'top' ? 'p2' : 'p-away';
      const revision = f.workload.readHead('career-a', playerId)!.revision;
      let timeline = createCanonicalPlateAppearanceTimeline(match, startedAtTick);
      for (let index = 0; index < 3; index++) {
        const { initialWorldSourceId: _initial, ...action } = continuousPitchAction(f, index, timeline.lastEventTick) as AcceptedPhysicalPitchActionSource & { initialWorldSourceId: string };
        const source = { ...action, sourceId: `game-pitch-${appearance}-${index}`,
          ...(activationApplicationId === null ? { initialWorldSourceId: 'initial-world' } : { activationApplicationId }),
          request: { ...action.request, workloadRevision: revision, delivery: { ...action.request.delivery, playerId, outingId: `outing-${playerId}` } } };
        actions.set(source.sourceId, source);
        timeline = pitches.accept(source.sourceId, index).result.pitch.resolution.timeline;
      }
      expect(timeline.status.kind).toBe('strikeout');
      const nextHalf = match.outs === 2 ? match.half === 'top' ? 'bottom' : 'top' : match.half;
      const source: AcceptedPhysicalPlayClosure = { sourceId: `game-close-${appearance}`, sourceVersion: 'fixture-v1', physicalPitchSourceId: `game-pitch-${appearance}-2`,
        applicationId: `game-application-${appearance}`, scoringApplicationId: `game-scoring-${appearance}`, snapshotId: `game-rule-${appearance}`,
        ruleTick: timeline.lastEventTick + 1, closureTick: timeline.lastEventTick + 2, nextStartedAtTick: timeline.lastEventTick + 3,
        batterRunnerId: null, worldSetup: nextHalf === 'top' ? home : away,
        game: { seasonId: 'league-season-1', homeClubId: 'club-a', awayClubId: 'club-b', policy: { version: 'fixture-v1', minimumInnings: 9, maximumInnings: 9, tiesAllowed: true } } };
      closures.set(source.sourceId, source);
      const result = driver.submit(source.sourceId);
      expect(result.official.receipt.durableRevision).toBe(appearance + 1);
      expect(result.workload.activity.kind === 'MATCH' ? result.workload.activity.effortUnits : null).toBe(6);
      expect(result.workload.before.revision).toBe(revision);
      expect('result' in result.official).toBe(appearance === 53);
      activationApplicationId = source.applicationId; startedAtTick = source.nextStartedAtTick;
    }
    const final = f.official.getMatch('game-1')!.finalResult!;
    expect(final).toMatchObject({ winnerClubId: null, awayRuns: 0, homeRuns: 0, completionReason: 'TIE_LIMIT' });
    expect(final.lineScore.innings).toEqual(Array.from({ length: 9 }, (_v, index) => ({ inning: index + 1, awayRuns: 0, homeRuns: 0 })));
    expect(f.db.prepare('SELECT count(*) AS n FROM physical_pitch_progress_actions').get()).toEqual({ n: 162 });
    expect(f.db.prepare("SELECT count(*) AS n FROM physical_play_closures WHERE status='COMPLETED'").get()).toEqual({ n: 54 });
    expect(f.workload.readHead('career-a', 'p2')!.revision).toBe(27);
    expect(f.workload.readHead('career-a', 'p-away')!.revision).toBe(27);
    expect(driver.resume('game-close-0').workload.after.revision).toBe(1);
  } finally { f.close(); }
}, 120_000);

it('derives consecutive physical walks, actual offensive actors and a bases-loaded forced run without injected counts', () => {
  const f = continuousPitchFixture(undefined, true), actions = new Map<string, AcceptedPhysicalPitchActionSource>();
  const closures = new Map<string, AcceptedPhysicalPlayClosure>();
  const pitches = f.track(openSqlitePhysicalPitchProgressStore(f.path, { matches: f.official, initialWorlds: f.initialWorlds,
    participation: f.participation, runtime: f.stores }, { readAcceptedAction: (id) => actions.get(id) ?? null }));
  const driver = f.track(openSqlitePhysicalPlayClosureStore(f.path, { physicalPitches: pitches, initialWorlds: f.initialWorlds,
    participation: f.participation, personLinks: f.links }, { readAcceptedClosure: (id) => closures.get(id) ?? null }));
  let activationApplicationId: string | null = null, startedAtTick = 0;
  try {
    for (let appearance = 0; appearance < 4; appearance++) {
      const match = f.official.getMatch('game-1')!.matchState;
      let timeline = createCanonicalPlateAppearanceTimeline(match, startedAtTick);
      for (let index = 0; index < 4; index++) {
        const { initialWorldSourceId: _initial, ...action } = continuousPitchAction(f, index, timeline.lastEventTick) as AcceptedPhysicalPitchActionSource & { initialWorldSourceId: string };
        const source = { ...action, sourceId: `walk-pitch-${appearance}-${index}`,
          ...(activationApplicationId === null ? { initialWorldSourceId: 'initial-world' } : { activationApplicationId }),
          request: { ...action.request, workloadRevision: appearance,
            delivery: { ...action.request.delivery, moundReference: { ...action.request.delivery.moundReference, x: 1 } } } };
        actions.set(source.sourceId, source); timeline = pitches.accept(source.sourceId, index).result.pitch.resolution.timeline;
      }
      expect(timeline.status.kind).toBe('walk');
      const source: AcceptedPhysicalPlayClosure = { sourceId: `walk-close-${appearance}`, sourceVersion: 'fixture-v1', physicalPitchSourceId: `walk-pitch-${appearance}-3`,
        applicationId: `walk-application-${appearance}`, scoringApplicationId: `walk-scoring-${appearance}`, snapshotId: `walk-rule-${appearance}`,
        ruleTick: timeline.lastEventTick + 1, closureTick: timeline.lastEventTick + 2, nextStartedAtTick: timeline.lastEventTick + 3,
        batterRunnerId: `away-${appearance + 1}`, worldSetup: worldSetup('p2'),
        game: { seasonId: 'league-season-1', homeClubId: 'club-a', awayClubId: 'club-b', policy: { version: 'fixture-v1', minimumInnings: 9, maximumInnings: 9, tiesAllowed: true } } };
      if (appearance === 0) {
        closures.set(source.sourceId, { ...source, batterRunnerId: 'home-1' });
        expect(() => driver.enqueue(source.sourceId)).toThrow('actor');
        expect(f.db.prepare('SELECT count(*) AS n FROM physical_play_closures').get()).toEqual({ n: 0 });
      }
      closures.set(source.sourceId, source);
      const result = driver.submit(source.sourceId);
      expect(result.scoring.record.classification).toBe('base_on_balls');
      expect(result.scoring.record.runsScored).toBe(appearance === 3 ? 1 : 0);
      expect(result.workload.activity.kind === 'MATCH' ? result.workload.activity.effortUnits : null).toBe(8);
      activationApplicationId = source.applicationId; startedAtTick = source.nextStartedAtTick;
    }
    expect(f.official.getMatch('game-1')!.matchState).toMatchObject({ outs: 0, balls: 0, strikes: 0, score: { away: 1, home: 0 },
      bases: { first: 'away-4', second: 'away-3', third: 'away-2' } });
    expect(driver.resume('walk-close-0').workload.after.revision).toBe(1);
  } finally { f.close(); }
}, 30_000);
