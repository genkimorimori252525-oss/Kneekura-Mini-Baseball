import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { applyStrikeoutPlateAppearanceToMatchState } from '../../core/sim/plateAppearance/PlateAppearanceMatchState';
import { samplePitchTrajectorySegment } from '../../core/sim/pitching/PitchTrajectory';
import { closeOfficialPlay, createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { createRosterState } from '../../core/world/roster/RosterState';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { match, worldSetup } from './OfficialParticipationPlayFixtures.test-support';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqlitePlayerPitchTimingStore } from './SqlitePlayerPitchTimingStore';
import { openSqlitePlayerReleaseGeometryStore } from './SqlitePlayerReleaseGeometryStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { resolvePlayerPitchAgainstBatterFromWorld, type PlayerPitchAgainstBatterRequest } from './PlayerPitchDeliveryRuntime';

// All bodies, timing, physics and legal facts are explicit synthetic inputs.
const setup = () => {
  const path = `file:pitch-physical-${randomUUID()}?mode=memory&cache=shared`;
  const world = openSqliteWorldSettlementStore(path);
  const roster = openSqliteManagerRosterDecisionStore(path);
  world.initialize({ careerId: 'career-a', clubs: [state()], schedule: {
    seasonId: 'league-season-1', leagueId: 'league-a', memberClubIds: ['club-a', 'club-b'],
    regularSeasonGamesPerClub: 1, games: [{ gameId: 'game-1', homeClubId: 'club-a', awayClubId: 'club-b' }], revisionEventIds: [],
  }, standingsPolicy: { version: 'standings-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 } });
  roster.initialize({ careerId: 'career-a', clubId: 'club-a', mood: null,
    roster: createRosterState({ careerId: 'career-a', effectiveDay: 1,
      profiles: [{ profileId: 'fixture-league', version: 'v1', season: 1,
        competitionEditionId: 'league-season-1', activeLimit: null, allowedAssignmentKinds: ['FIRST_TEAM'], rehabParticipationAllowed: false }],
      units: [{ unitId: 'first-a', clubId: 'club-a', kind: 'FIRST_TEAM' }],
      players: [{ playerId: 'p2', clubRights: { rightsHolderClubId: 'club-a', contractId: 'contract-p2' },
        assignment: { unitId: 'first-a', clubId: 'club-a' }, registrations: [], availability: { status: 'AVAILABLE', evidenceId: 'health-p2' } }],
    }) });
  let link = openSqlitePlayerPersonLinkStore(path, { readAcceptedPlayerIntake: (sourceId) => sourceId === 'intake-p2' ? {
    sourceId, careerId: 'career-a', playerId: 'p2', personId: 'person-p2', sourceRecordId: 'accepted-intake-p2', sourceVersion: 'intake-v1',
    acceptedRevision: 1, acceptedAtDay: 1, rosterRevision: 0,
  } : null });
  link.accept('intake-p2');
  const timingBaseline = { sourceId: 'timing-baseline', sourceVersion: 'fixture-v1', careerId: 'career-a', playerId: 'p2', personLinkSourceId: 'intake-p2', acceptedAtDay: 1,
    profile: { baseStartIntervalUs: 10_000_000, normalMotionToReleaseUs: 600_000, followThroughUs: 200_000,
      quickSpeedFactor: 1.8, cadenceExecutionControl: 0.8, cadenceTimingKnowledge: 0.8, quickRepeatability: 0.8, naturalVariationUs: 50_000,
      normalPhaseWeights: { gather: 2, transition: 3, stride: 5 }, quickPhaseWeights: { gather: 1, transition: 2, stride: 3 } } };
  const releaseBaseline = { ...timingBaseline, sourceId: 'release-baseline',
    body: { heightMeters: 1.8, shoulderHeightMeters: 1.5, armReachMeters: 0.8, postureDropMeters: 0.1, throwingSide: 'RIGHT' as const },
    profile: { armSlotClass: 'OVERHAND' as const, releaseHeightTier: 'HIGH' as const, releaseHeightRatio: 0.9,
      releaseLateralRatio: 0.1, releaseExtensionRatio: 0.2, armSlotElevationDeg: 70, armSlotAzimuthDeg: 0 },
    tierBoundaries: [0.65, 0.7, 0.75, 0.8, 0.85, 0.95] };
  const change = { sourceId: 'form-change', sourceVersion: 'fixture-v1', careerId: 'career-a', playerId: 'p2',
    causeEventId: 'accepted-form-change', causeKind: 'FORM_REBUILD' as const, effectiveDay: 20, body: releaseBaseline.body,
    profile: { ...releaseBaseline.profile, releaseHeightRatio: 0.8, releaseHeightTier: 'HIGH_MID' as const } };
  const labelChange = { ...change, sourceId: 'classification-change', causeEventId: 'accepted-classification-change', effectiveDay: 30,
    profile: { ...change.profile, armSlotClass: 'UNDERHAND' as const } };
  let timing = openSqlitePlayerPitchTimingStore(path, link, { readAcceptedBaseline: (sourceId) => sourceId === timingBaseline.sourceId ? timingBaseline : null, readAcceptedLearning: () => null });
  let release = openSqlitePlayerReleaseGeometryStore(path, link, { readAcceptedBaseline: (sourceId) => sourceId === releaseBaseline.sourceId ? releaseBaseline : null,
    readAcceptedChange: (sourceId) => sourceId === change.sourceId ? change : sourceId === labelChange.sourceId ? labelChange : null });
  timing.initialize(timingBaseline.sourceId);
  release.initialize(releaseBaseline.sourceId);
  let official = new SqliteOfficialStateStore(path);
  return { path, get stores() { return { timing, release }; }, get official() { return official; },
    change: () => { release.apply(change.sourceId, 0); release.apply(labelChange.sourceId, 1); },
    reopen: () => {
      official.close(); timing.close(); release.close(); link.close();
      link = openSqlitePlayerPersonLinkStore(path);
      timing = openSqlitePlayerPitchTimingStore(path, link);
      release = openSqlitePlayerReleaseGeometryStore(path, link);
      official = new SqliteOfficialStateStore(path);
    },
    close: () => { official.close(); timing.close(); release.close(); link.close(); roster.close(); world.close(); },
  };
};
const before = () => ({ ...match(), outs: 1, strikes: 2 });
const request = (): PlayerPitchAgainstBatterRequest => ({
  timeline: createCanonicalPlateAppearanceTimeline(before(), 0),
  delivery: { careerId: 'career-a', playerId: 'p2', gameDay: 10,
    moundReference: { x: 0, y: 0, z: 18 }, root: new SeedRoot(19), outingId: 'outing-1', playId: 7, pitchIndex: 0, readyAtUs: 0,
    timingIntent: { deliveryMode: 'NORMAL', cadenceIntent: 'STANDARD' },
    physics: { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } },
  },
  flight: { durationUs: 700_000, acceleration: { x: 0, y: -0.5, z: 0 } },
  batter: { action: { kind: 'take' }, plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.6 }, ballRadiusMeters: 0.0366 },
});

it('starts physical flights from Native history and persists the resulting strikeout without fabricated counted-pitch events', () => {
  const f = setup();
  try {
    const input = request();
    const first = resolvePlayerPitchAgainstBatterFromWorld(f.stores, input);
    expect(first.trajectory.start).toMatchObject({ tick: first.delivery.release.releaseAtUs,
      position: first.delivery.release.position, velocity: input.delivery.physics.velocity, spin: input.delivery.physics.spin });
    expect(first.resolution).toMatchObject({ kind: 'recorded', physical: { kind: 'taken', result: { kind: 'called_strike' } }, timeline: { status: { kind: 'strikeout' } } });
    const repeated = Array.from({ length: 120 }, (_, pitchIndex) => resolvePlayerPitchAgainstBatterFromWorld(f.stores, {
      ...input, delivery: { ...input.delivery, pitchIndex, timingIntent: { deliveryMode: pitchIndex % 3 === 1 ? 'QUICK' : 'NORMAL', cadenceIntent: pitchIndex % 3 === 2 ? 'DELIBERATE' : 'STANDARD' } },
    }));
    expect(repeated.every((pitch) => JSON.stringify(pitch.trajectory.start.position) === JSON.stringify(first.trajectory.start.position))).toBe(true);
    expect(new Set(repeated.map((pitch) => pitch.trajectory.start.tick)).size).toBeGreaterThan(100);
    expect(repeated.every((pitch) => pitch.resolution.kind === 'recorded' && pitch.resolution.physical.kind === 'taken' && pitch.resolution.physical.result.kind === 'called_strike')).toBe(true);

    const timeline = first.resolution.timeline;
    const next = applyStrikeoutPlateAppearanceToMatchState(before(), timeline);
    let adjudication = createPlayAdjudicationLedger({ playId: 7, ruleProfileId: before().ruleProfileId, playEnd: null });
    adjudication = recordCorrectRuleSnapshot(adjudication, 0, { eventId: 'physical-strikeout-rule', tick: timeline.lastEventTick + 1,
      snapshotId: 'physical-strikeout-rule', evidenceRevision: 1, ruling: { outsAfter: next.outs, basesAfter: next.bases, scoredRunnerIds: [] } });
    adjudication = closeOfficialPlay(adjudication, 1, { eventId: 'close-physical-strikeout', closureId: 'physical-strikeout', tick: timeline.lastEventTick + 2 });
    f.official.initializeMatch('game-1', before());
    const application = { kind: 'non_live' as const, matchId: 'game-1', applicationId: 'physical-strikeout', expectedDurableRevision: 0,
      match: before(), timeline, adjudication, context: { kind: 'strikeout' as const }, nextStartedAtTick: timeline.lastEventTick + 3, worldSetup: worldSetup('p2') };
    const durable = f.official.applyAndActivate(application);
    expect(durable.activation.nextMatchState).toEqual(next);
    expect(durable.nextWorld.defenders[0].playerId).toBe('p2');

    f.change();
    const later = resolvePlayerPitchAgainstBatterFromWorld(f.stores, { ...input, delivery: { ...input.delivery, gameDay: 20 } });
    expect(later.trajectory.start.position.y).toBeCloseTo(first.trajectory.start.position.y - 0.18);
    expect(later.trajectory.start.velocity).toEqual(first.trajectory.start.velocity);
    expect(later.resolution).toMatchObject({ kind: 'recorded', physical: { kind: 'taken', result: { kind: 'ball' } }, timeline: { status: { kind: 'active', count: { balls: 1, strikes: 2 } } } });
    expect(resolvePlayerPitchAgainstBatterFromWorld(f.stores, { ...input, delivery: { ...input.delivery, gameDay: 30 } })).toEqual(later);
    f.reopen();
    expect(resolvePlayerPitchAgainstBatterFromWorld(f.stores, input)).toEqual(first);
    expect(f.official.applyAndActivate(application)).toEqual(durable);
    expect(f.official.getMatch('game-1')!.matchState).toEqual(next);
  } finally { f.close(); }
});

it('keeps physical contact, missed swing and unresolved flight on their existing Core paths', () => {
  const f = setup();
  try {
    const input = request();
    const preview = resolvePlayerPitchAgainstBatterFromWorld(f.stores, input);
    const swingStart = preview.trajectory.start.tick + 590_000;
    const ball = samplePitchTrajectorySegment(preview.trajectory, swingStart).position;
    const swing = { startTick: swingStart, endTick: swingStart + 10_000, ticksPerSecond: 1_000_000,
      stateAtStart: { pose: { grip: { ...ball, x: ball.x - 0.4 }, tip: { ...ball, x: ball.x + 0.4 } },
        linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } } };
    const contact = resolvePlayerPitchAgainstBatterFromWorld(f.stores, { ...input, batter: { action: { kind: 'swing', swing } } });
    expect(contact.resolution).toMatchObject({ kind: 'recorded', physical: { kind: 'swing', result: { kind: 'contact' } }, timeline: { status: { kind: 'batted_ball_pending' } } });
    const miss = resolvePlayerPitchAgainstBatterFromWorld(f.stores, { ...input, batter: { action: { kind: 'swing', swing: { ...swing,
      stateAtStart: { ...swing.stateAtStart, pose: { grip: { ...ball, x: 10 }, tip: { ...ball, x: 11 } } } } } } });
    expect(miss.resolution).toMatchObject({ kind: 'recorded', physical: { kind: 'swing', result: { kind: 'swinging_miss' } }, timeline: { status: { kind: 'strikeout' } } });
    const unresolved = resolvePlayerPitchAgainstBatterFromWorld(f.stores, { ...input, flight: { ...input.flight, durationUs: 10_000 } });
    expect(unresolved.resolution).toEqual({ kind: 'unresolved', reason: 'pitch_did_not_reach_plate', timeline: input.timeline });
  } finally { f.close(); }
});

it('rejects invalid play and microsecond scope before reading Native source histories', () => {
  const f = setup();
  try {
    const input = request();
    let reads = 0;
    const stores = { timing: { selectProfileAtDay: (...args: Parameters<typeof f.stores.timing.selectProfileAtDay>) => { reads++; return f.stores.timing.selectProfileAtDay(...args); } }, release: f.stores.release };
    expect(() => resolvePlayerPitchAgainstBatterFromWorld(stores, { ...input, delivery: { ...input.delivery, playId: 8 } })).toThrow('playId');
    expect(() => resolvePlayerPitchAgainstBatterFromWorld(stores, { ...input, timeline: { ...input.timeline, lastEventTick: 1 } })).toThrow('ready');
    expect(() => resolvePlayerPitchAgainstBatterFromWorld(stores, { ...input, flight: { ...input.flight, durationUs: 0 } })).toThrow('duration');
    const terminal = resolvePlayerPitchAgainstBatterFromWorld(f.stores, input).resolution.timeline;
    expect(() => resolvePlayerPitchAgainstBatterFromWorld(stores, { ...input, timeline: terminal })).toThrow('active');
    expect(reads).toBe(0);
    expect(() => resolvePlayerPitchAgainstBatterFromWorld(f.stores, { ...input, delivery: { ...input.delivery, playerId: 'missing' } })).toThrow();
    expect(() => resolvePlayerPitchAgainstBatterFromWorld(f.stores, { ...input, delivery: { ...input.delivery, gameDay: 0 } })).toThrow();
    expect(() => resolvePlayerPitchAgainstBatterFromWorld(f.stores, { ...input, flight: { ...input.flight, durationUs: Number.MAX_SAFE_INTEGER } })).toThrow('safe integer');
  } finally { f.close(); }
});
