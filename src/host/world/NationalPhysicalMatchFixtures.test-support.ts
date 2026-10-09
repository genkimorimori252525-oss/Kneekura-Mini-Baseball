import { createCompetitionSourceReader } from './CompetitionSourceReadScope';
import { openSqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { openSqlitePlayerPitchTimingStore } from './SqlitePlayerPitchTimingStore';
import { openSqlitePlayerReleaseGeometryStore } from './SqlitePlayerReleaseGeometryStore';
import { openSqlitePitchFatiguePolicyStore } from './SqlitePitchFatiguePolicyStore';
import { openSqlitePhysicalPlateAppearanceActorStore } from './SqlitePhysicalPlateAppearanceActorStore';
import { openSqlitePhysicalPitchProgressStore, type AcceptedPhysicalPitchActionSource } from './SqlitePhysicalPitchProgressStore';
import { openSqlitePhysicalPlayClosureStore, type AcceptedPhysicalPlayClosure } from './SqlitePhysicalPlayClosureStore';
import { createRequire } from 'node:module';
import { nationalCallupFixture } from './NationalCallupFixtures.test-support';
import { regionalNationalInput } from './RegionalNationalFixtures.test-support';
import { openSqliteNationalCallupStore } from './SqliteNationalCallupStore';
import { openSqliteRegionalNationalGroupStore } from './SqliteRegionalNationalGroupStore';
import { openSqliteRegionalNationalKnockoutStore } from './SqliteRegionalNationalKnockoutStore';
import { openSqliteRegionalNationalScheduleStore } from './SqliteRegionalNationalScheduleStore';
import { registerRegionalNationalFixtureFromWorld } from './RegionalNationalFixtureFromWorld';
import { createNationalParticipationAuthority } from './SqliteNationalParticipationAuthority';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { match, worldSetup } from './OfficialParticipationPlayFixtures.test-support';
import { openSqliteNationalMatchOriginStore, type NationalMatchOriginSource } from './NationalMatchOriginFromSqlite';

/** Existing explicit Regional policy fixture, 18 actual team members, one unused reserve and an unregistered replacement candidate. */
export const nationalPhysicalPregameFixture = (options: Readonly<{ initializeMatch?: boolean; groupCount?: number }> = {}) => {
  const input = regionalNationalInput('ASIA_PACIFIC', options.groupCount ?? 2, { startsOnDay: 121, endsOnDay: 130 });
  const edition = { ...input.edition, groups: input.edition.groups.map((g, i) => i ? g : { ...g, nationIds: ['JP', 'AP-2', 'AP-3', 'KR'] }) };
  const playerNationIds = Array.from({ length: 20 }, (_, i) => i < 9 || i >= 18 ? 'JP' : 'KR');
  const nationIds = [...new Set([...edition.groups.flatMap(g => g.nationIds), ...edition.hostNationIds])];
  const f = nationalCallupFixture([], { playerNationIds, nations: nationIds.map(nationId => ({ nationId, region: 'ASIA_PACIFIC' as const })) });
  const stores: { close(): void }[] = [];
  const track = <T extends { close(): void }>(s: T): T => { stores.push(s); return s; };
  const official = track(new SqliteOfficialStateStore(f.path));
  f.selections.initialize({ careerId: 'career-a', editionId: edition.editionId, kind: 'REGIONAL_NATIONAL', region: edition.region,
    cycleOrdinal: 0, careerDayOne: '2031-01-01', cutoffDay: 100 });
  const matches = { getMatch: createCompetitionSourceReader((id: string) => official.getMatch(id)),
    getOfficialFixture: createCompetitionSourceReader((id: string) => official.getOfficialFixture(id)) };
  const groups = track(openSqliteRegionalNationalGroupStore(f.path, { regions: f.nations, selections: f.selections, matches }));
  const knockout = track(openSqliteRegionalNationalKnockoutStore(f.path, { groups, regions: f.nations, matches }));
  const schedules = track(openSqliteRegionalNationalScheduleStore(f.path, { groups, selections: f.selections }));
  groups.initialize('career-a', edition);
  const schedule = schedules.initialize({ careerId: 'career-a', editionId: edition.editionId, knockoutEdition: input.knockoutEdition,
    policy: { version: 'regional-schedule-fixture-v1', gamesPerVenuePerDay: 2, minimumOffDaysBetweenRounds: 0 } });
  const slot = schedule.games.find(g => g.stage === 'GROUP')!;
  const fixture = registerRegionalNationalFixtureFromWorld({ groups, knockout, schedules, matches: official },
    { careerId: 'career-a', editionId: edition.editionId, gameId: slot.gameId, gameDay: slot.gameDay });
  const registrations = track(openSqliteNationalCallupStore(f.path, f.sources));
  playerNationIds.slice(0, 19).forEach((nationId, i) => registrations.register({ ...f.request(i), nationId, editionId: edition.editionId,
    registeredAtDay: 120, callupPolicy: { ...f.request(i).callupPolicy, rosterLimit: 10, initialRegistrationCutoffDay: 120, replacementCutoffDay: 124 } }));
  const authority = createNationalParticipationAuthority({ careerId: 'career-a', editionId: edition.editionId,
    fixtures: { kind: 'REGIONAL_NATIONAL', groups, knockout, schedules }, matches: official,
    callups: registrations, roster: f.roster, rosterSnapshots: f.snapshots, personLinks: f.links });
  const participation = track(new SqliteOfficialParticipationStore(f.path, authority));
  const callupSources = { ...f.sources, games: authority, participation };
  const callups = track(openSqliteNationalCallupStore(f.path, callupSources));
  const roster = f.snapshots.capture('career-a', 'club-a');
  playerNationIds.slice(0, 19).forEach((nationId, i) => participation.bindPregame({ gameId: slot.gameId, careerId: 'career-a', competitionEditionId: edition.editionId,
    gameDay: slot.gameDay, clubId: nationId, side: fixture.game.homeNationId === nationId ? 'HOME' : 'AWAY',
    playerId: `p${i}`, personId: `person-${i}`, personLinkSourceId: `link-${i}`, rosterRevision: roster.revision,
    fixtureEventId: fixture.binding.fixtureEventId, nationalRegistrationEventId: `call-${i}`, nationalRosterSnapshotId: roster.snapshotId }));
  if (options.initializeMatch !== false) official.initializeMatch(slot.gameId, match());
  const origins = track(openSqliteNationalMatchOriginStore(f.path));
  const source: NationalMatchOriginSource = { sourceId: 'national-origin', sourceVersion: 'national-regional-group-origin-v1',
    careerId: 'career-a', editionId: edition.editionId, gameId: slot.gameId };
  const setup = { ...worldSetup('p0'), defenders: worldSetup('p0').defenders.map((d, i) => ({ ...d, playerId: `p${i}` })) };
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(f.path);
  return { ...f, track, official, participation, callups, callupSources, fixture, source, origins, setup, db, edition, knockoutEdition: input.knockoutEdition, groups, knockout, schedules, schedule, fixtureMatches: matches,
    close() { db.close(); stores.reverse().forEach(s => s.close()); f.close(); } };
};

/** Same explicit synthetic calibration as ContinuousPitchFixtures; no National fatigue reset. */
export const nationalPhysicalFixture = () => {
  const f = nationalPhysicalPregameFixture();
  const origin = f.origins.capture(f.source), gameId = f.source.gameId;
  const setup = { sourceId: 'initial-world', sourceVersion: 'fixture-v1', gameId,
    fixtureEventId: f.fixture.binding.fixtureEventId, startedAtTick: 0, worldSetup: f.setup };
  const initialWorlds = f.track(openSqliteOfficialInitialWorldStore(f.path, { matches: f.official, participation: f.participation }, { readAcceptedSetup: () => setup }));
  const initial = initialWorlds.accept(setup.sourceId);
  const baseline = { sourceId: 'workload', sourceVersion: 'fixture-v1', personLinkSourceId: 'link-0', careerId: 'career-a', playerId: 'p0',
    createdAtDay: 10, fatigue: 0, recoveryCapacity: 1, policy: { policyId: 'workload', version: 'v1', availableAtDay: 10,
      workloadFatiguePerUnit: 0.1, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } };
  const workload = f.track(openSqlitePlayerWorkloadRecoveryStore(f.path, f.links, { readAcceptedBaseline: () => baseline,
    readAcceptedActivity: () => null }));
  workload.initialize(baseline.sourceId);
  const timingInput = { sourceId: 'timing', sourceVersion: 'fixture-v1', personLinkSourceId: 'link-0', careerId: 'career-a', playerId: 'p0', acceptedAtDay: 10,
    profile: { baseStartIntervalUs: 10_000_000, normalMotionToReleaseUs: 600_000, followThroughUs: 200_000, quickSpeedFactor: 1.8,
      cadenceExecutionControl: 0.8, cadenceTimingKnowledge: 0.8, quickRepeatability: 0.8, naturalVariationUs: 50_000,
      normalPhaseWeights: { gather: 2, transition: 3, stride: 5 }, quickPhaseWeights: { gather: 1, transition: 2, stride: 3 } } };
  const timing = f.track(openSqlitePlayerPitchTimingStore(f.path, f.links, { readAcceptedBaseline: () => timingInput, readAcceptedLearning: () => null })); timing.initialize('timing');
  const releaseInput = { ...timingInput, sourceId: 'release',
    body: { heightMeters: 1.8, shoulderHeightMeters: 1.5, armReachMeters: 0.8, postureDropMeters: 0.1, throwingSide: 'RIGHT' as const },
    profile: { armSlotClass: 'OVERHAND' as const, releaseHeightTier: 'HIGH' as const, releaseHeightRatio: 0.9,
      releaseLateralRatio: 0.1, releaseExtensionRatio: 0.2, armSlotElevationDeg: 70, armSlotAzimuthDeg: 0 }, tierBoundaries: [0.65, 0.7, 0.75, 0.8, 0.85, 0.95] };
  const release = f.track(openSqlitePlayerReleaseGeometryStore(f.path, f.links, { readAcceptedBaseline: () => releaseInput, readAcceptedChange: () => null })); release.initialize('release');
  const response = { sourceId: 'response', sourceVersion: 'fixture-v1', policyId: 'response', version: 'v1', availableAtDay: 10,
    motionDurationScaleAtFullFatigue: 1.5, velocityRetentionAtFullFatigue: 0.5, spinRetentionAtFullFatigue: 0.75 };
  const policies = f.track(openSqlitePitchFatiguePolicyStore(f.path, { readAcceptedPolicy: () => response })); policies.accept(response.sourceId);
  const effort = { sourceId: 'effort', sourceVersion: 'fixture-v1', policyId: 'effort', version: 'v1', availableAtDay: 10, effortUnitsPerPhysicalPitch: 2 };

  const actorSource = { sourceId: 'batter-1', sourceVersion: 'fixture-v1', gameId, playerId: 'p9', initialWorldSourceId: 'initial-world' };
  const actorSources = { matches: f.official, initialWorlds, participation: f.participation };
  const actors = f.track(openSqlitePhysicalPlateAppearanceActorStore(f.path, actorSources, { readAcceptedActor: () => actorSource }));
  const actor = actors.accept(actorSource.sourceId);
  const stores = { workload, timing, release, policies, effortPolicies: { readAcceptedPolicy: () => effort } };
  const actions = new Map<string, AcceptedPhysicalPitchActionSource>();
  const pitches = f.track(openSqlitePhysicalPitchProgressStore(f.path, { ...actorSources, runtime: stores }, { readAcceptedAction: id => actions.get(id) ?? null }));
  const pitch = (index: number, readyAtUs: number) => {
    const source: AcceptedPhysicalPitchActionSource = { sourceId: `pitch-${index}`, sourceVersion: 'fixture-v1', gameId,
      initialWorldSourceId: 'initial-world', effortPolicy: effort, request: { workloadRevision: 0, policySourceId: response.sourceId,
        delivery: { careerId: 'career-a', playerId: 'p0', gameDay: origin.fixture.gameDay, matchSeed: 19,
          moundReference: { x: 0, y: 0, z: 18 }, outingId: 'outing-1', readyAtUs,
          timingIntent: { deliveryMode: 'NORMAL', cadenceIntent: 'STANDARD' }, physics: { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } } },
        flight: { durationUs: 1_500_000, acceleration: { x: 0, y: 0, z: 0 } },
        batter: { action: { kind: 'take' }, plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.8 }, ballRadiusMeters: 0.0366 } } };
    actions.set(source.sourceId, source); return pitches.accept(source.sourceId, index);
  };
  const closes = new Map<string, AcceptedPhysicalPlayClosure>();
  const closure = f.track(openSqlitePhysicalPlayClosureStore(f.path, { physicalPitches: pitches, initialWorlds, participation: f.participation, personLinks: f.links },
    { readAcceptedClosure: id => closes.get(id) ?? null }));
  const close = () => {
    let tick = 0; for (let i = 0; i < 3; i++) tick = pitch(i, tick).result.pitch.resolution.timeline.lastEventTick;
    const source: AcceptedPhysicalPlayClosure = { sourceId: 'close-1', sourceVersion: 'fixture-v1', physicalPitchSourceId: 'pitch-2',
      applicationId: 'application-1', scoringApplicationId: 'scoring-1', snapshotId: 'rule-1', ruleTick: tick + 1, closureTick: tick + 2,
      nextStartedAtTick: tick + 3, batterRunnerId: null, worldSetup: f.setup,
      game: { seasonId: origin.fixture.competitionEditionId, homeClubId: origin.fixture.homeClubId, awayClubId: origin.fixture.awayClubId,
        policy: { version: 'fixture-v1', minimumInnings: 9, maximumInnings: 9, tiesAllowed: true } } };
    closes.set(source.sourceId, source); return closure.submit(source.sourceId);
  };
  return { ...f, origin, actor, actors, actorSources, initialWorlds, initial, workload, closePlay: close, closure, pitches, pitch };
};
