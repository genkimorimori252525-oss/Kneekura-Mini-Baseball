import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { CATALYST_FAMILIES } from '../../core/world/development/DevelopmentCatalyst';
import { DEVELOPMENT_DOMAINS } from '../../core/world/development/DevelopmentTrajectory';
import { STAR_GENESIS_POTENTIALS } from '../../core/world/development/StarGenesis';
import { createRosterState } from '../../core/world/roster/RosterState';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { projectReleaseHeightTier } from '../../core/sim/pitch/PitcherReleaseGeometry';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqlitePersonGenesisStore } from './SqlitePersonGenesisStore';
import { openSqlitePlayerIntakeStore } from './SqlitePlayerIntakeStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqlitePlayerReleaseGeometryStore, type AcceptedReleaseGeometryChange } from './SqlitePlayerReleaseGeometryStore';
import { openSqlitePlayerPitchTimingStore } from './SqlitePlayerPitchTimingStore';
import { resolvePlayerPitchAgainstBatterFromWorld } from './PlayerPitchDeliveryRuntime';
import { match } from './OfficialParticipationPlayFixtures.test-support';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqlitePitcherReleaseGenerationStore, materializeGeneratedPitcherRelease,
  type AcceptedPitcherReleaseCreation } from './SqlitePitcherReleaseGenerationStore';

const creation = (n: number): AcceptedPitcherReleaseCreation => ({ sourceId: `release-create-${n}`, sourceVersion: 'fixture-creation-v1',
  careerId: 'career-a', playerId: `player-${n}`, personSourceId: `intake-${n}`, bodySourceId: `accepted-body-${n}`, createdAtDay: 10 + n,
  body: { heightMeters: 1.8, shoulderHeightMeters: 1.5, armReachMeters: 0.8, postureDropMeters: 0.1, throwingSide: 'RIGHT' },
  policy: { policyId: 'fixture-release-prior', version: 'fixture-v1', availableAtDay: 10, maximumAttempts: 128,
    tierBoundaries: [0.65, 0.7, 0.75, 0.8, 0.85, 0.95], slots: [{ armSlotClass: 'OVERHAND', weight: 1,
      ranges: { releaseHeightRatio: { min: 0.72, max: 0.96 }, releaseLateralRatio: { min: 0.05, max: 0.2 }, releaseExtensionRatio: { min: 0.1, max: 0.4 },
        armSlotElevationDeg: { min: 55, max: 80 }, armSlotAzimuthDeg: { min: -10, max: 10 } } }] },
});
const timingProfile = { baseStartIntervalUs: 10_000_000, normalMotionToReleaseUs: 600_000, followThroughUs: 200_000, quickSpeedFactor: 1.8,
  cadenceExecutionControl: 0.8, cadenceTimingKnowledge: 0.8, quickRepeatability: 0.8, naturalVariationUs: 50_000,
  normalPhaseWeights: { gather: 2, transition: 3, stride: 5 }, quickPhaseWeights: { gather: 1, transition: 2, stride: 3 } };
const setup = () => {
  const path = `file:release-genesis-${randomUUID()}?mode=memory&cache=shared`;
  const world = openSqliteWorldSettlementStore(path);
  const roster = openSqliteManagerRosterDecisionStore(path);
  world.initialize({ careerId: 'career-a', clubs: [state()], schedule: { seasonId: 'league-season-1', leagueId: 'league-a', memberClubIds: ['club-a', 'club-b'],
    regularSeasonGamesPerClub: 1, games: [{ gameId: 'game-1', homeClubId: 'club-a', awayClubId: 'club-b' }], revisionEventIds: [] },
    standingsPolicy: { version: 'standings-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 } });
  roster.initialize({ careerId: 'career-a', clubId: 'club-a', mood: null, roster: createRosterState({ careerId: 'career-a', effectiveDay: 10,
    profiles: [{ profileId: 'fixture-league', version: 'v1', season: 1, competitionEditionId: 'league-season-1', activeLimit: null, allowedAssignmentKinds: ['FIRST_TEAM'], rehabParticipationAllowed: false }],
    units: [{ unitId: 'first-a', clubId: 'club-a', kind: 'FIRST_TEAM' }], players: [] }) });
  const intake = openSqlitePlayerIntakeStore(path, { readAcceptedPlayerIntake: (sourceId) => [1, 2].map((n) => ({ sourceId: `intake-${n}`, careerId: 'career-a', playerId: `player-${n}`, personId: `person-${n}`,
    sourceRecordId: `accepted-intake-${n}`, sourceVersion: 'fixture-intake-v1', acceptedRevision: n, acceptedAtDay: 10 + n, rosterRevision: n })).find((item) => item.sourceId === sourceId) ?? null });
  let genesis = openSqlitePersonGenesisStore(path);
  const range = { min: 0.2, max: 0.8 };
  const offsets = Object.fromEntries(DEVELOPMENT_DOMAINS.map((key) => [key, { min: 0, max: 0 }])) as Record<typeof DEVELOPMENT_DOMAINS[number], typeof range>;
  const sensitivities = Object.fromEntries(CATALYST_FAMILIES.map((key) => [key, range])) as Record<typeof CATALYST_FAMILIES[number], typeof range>;
  const potentials = Object.fromEntries(STAR_GENESIS_POTENTIALS.map((key) => [key, range])) as Record<typeof STAR_GENESIS_POTENTIALS[number], typeof range>;
  genesis.initializeCareer({ careerId: 'career-a', initializedAtDay: 10, careerSeed: 12345, policies: {
    trajectory: { policyId: 'fixture-trajectory', profileVersion: 'v1', availableAtDay: 10, timingWeights: { VERY_EARLY: 1, EARLY: 1, NORMAL: 1, LATE: 1, VERY_LATE: 1 },
      shapeWeights: { SHARP_PEAK: 1, BROAD_PLATEAU: 1, STEPWISE_WAVES: 1 }, domainOffsetRanges: offsets },
    catalyst: { policyId: 'fixture-catalyst', profileVersion: 'v1', availableAtDay: 10, sensitivityRanges: sensitivities, signatureMotifs: [], signatureMotifCount: 0 },
    star: { policyId: 'fixture-star', profileVersion: 'v1', availableAtDay: 10, tierWeights: { ORDINARY: 1, STAR_CANDIDATE: 0, SUPERSTAR_CANDIDATE: 0 },
      potentialRanges: { ORDINARY: potentials, STAR_CANDIDATE: potentials, SUPERSTAR_CANDIDATE: potentials } },
  } });
  let links = openSqlitePlayerPersonLinkStore(path);
  let timing = openSqlitePlayerPitchTimingStore(path, links, { readAcceptedBaseline: (sourceId) => [1, 2].map((n) => ({
    sourceId: `timing-${n}`, sourceVersion: 'fixture-v1', careerId: 'career-a', playerId: `player-${n}`, personLinkSourceId: `intake-${n}`,
    acceptedAtDay: 10 + n, profile: timingProfile })).find((item) => item.sourceId === sourceId) ?? null, readAcceptedLearning: () => null });
  let current = [creation(1), creation(2)];
  let change: AcceptedReleaseGeometryChange | null = null;
  let generated = openSqlitePitcherReleaseGenerationStore(path, genesis, { readAcceptedCreation: (sourceId) => current.find((item) => item.sourceId === sourceId) ?? null });
  let release = openSqlitePlayerReleaseGeometryStore(path, links, { readAcceptedBaseline: (sourceId) => generated.readAcceptedBaseline(sourceId),
    readAcceptedChange: (sourceId) => change?.sourceId === sourceId ? change : null });
  return { path, intake, get generated() { return generated; }, get release() { return release; }, get stores() { return { timing, release }; },
    replace: (record: AcceptedPitcherReleaseCreation) => { current = [record, creation(2)]; },
    replaceAll: (records: AcceptedPitcherReleaseCreation[]) => { current = records; },
    formChange: (record: AcceptedReleaseGeometryChange) => { change = record; return release.apply(record.sourceId, 0); },
    person: (n: number) => { intake.accept(`intake-${n}`); const person = genesis.materialize(`intake-${n}`); timing.initialize(`timing-${n}`); return person; },
    reopen: () => { release.close(); generated.close(); timing.close(); links.close(); genesis.close();
      genesis = openSqlitePersonGenesisStore(path); links = openSqlitePlayerPersonLinkStore(path); timing = openSqlitePlayerPitchTimingStore(path, links);
      generated = openSqlitePitcherReleaseGenerationStore(path, genesis);
      release = openSqlitePlayerReleaseGeometryStore(path, links, { readAcceptedBaseline: (sourceId) => generated.readAcceptedBaseline(sourceId), readAcceptedChange: () => null }); },
    close: () => { release.close(); generated.close(); timing.close(); links.close(); genesis.close(); intake.close(); roster.close(); world.close(); },
  };
};

it('materializes actual accepted Persons into frozen Native release histories and replays them without a live prior authority', () => {
  const f = setup();
  try {
    expect(() => f.generated.initialize('release-create-1')).toThrow('Person');
    expect(f.generated.readAcceptedBaseline('release-create-1')).toBeNull();
    f.person(1); f.person(2);
    const first = materializeGeneratedPitcherRelease({ generation: f.generated, release: f.release }, 'release-create-1');
    const second = materializeGeneratedPitcherRelease({ generation: f.generated, release: f.release }, 'release-create-2');
    expect(first.baseline.profile).not.toEqual(second.baseline.profile);
    expect(first.baseline.personLinkSourceId).toBe('intake-1');
    expect(first.history.baseline.profile).toEqual(first.baseline.profile);
    expect(f.generated.readGeneration('release-create-1')!.input.bodySourceId).toBe('accepted-body-1');
    const pitches = Array.from({ length: 101 }, (_, pitchIndex) => {
      const result = resolvePlayerPitchAgainstBatterFromWorld(f.stores, {
        timeline: createCanonicalPlateAppearanceTimeline({ ...match(), strikes: 2 }, 0),
        delivery: { careerId: 'career-a', playerId: 'player-1', gameDay: 11, root: new SeedRoot(19), outingId: 'outing-1', playId: 7, pitchIndex, readyAtUs: 0,
          moundReference: { x: 0, y: 0, z: 18 }, timingIntent: { deliveryMode: pitchIndex % 2 ? 'QUICK' : 'NORMAL', cadenceIntent: 'STANDARD' },
          physics: { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } } },
        flight: { durationUs: 700_000, acceleration: { x: 0, y: -0.5, z: 0 } },
        batter: { action: { kind: 'take' }, plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 0.5, upperY: 2 }, ballRadiusMeters: 0.0366 },
      });
      expect(result.resolution).toMatchObject({ kind: 'recorded', physical: { kind: 'taken', result: { kind: 'called_strike' } }, timeline: { status: { kind: 'strikeout' } } });
      return result.trajectory;
    });
    expect(pitches.every((pitch) => JSON.stringify(pitch.start.position) === JSON.stringify(pitches[0].start.position))).toBe(true);
    const evidence = f.generated.readGeneration('release-create-1');
    f.replace({ ...creation(1), policy: { ...creation(1).policy, version: 'new-prior', slots: [{ ...creation(1).policy.slots[0],
      ranges: { ...creation(1).policy.slots[0].ranges, releaseHeightRatio: { min: 0.8, max: 0.9 } } }] } });
    expect(() => f.generated.initialize('release-create-1')).toThrow('frozen');
    expect(f.generated.readGeneration('release-create-1')).toEqual(evidence);
    const profile = { ...first.baseline.profile, releaseHeightRatio: first.baseline.profile.releaseHeightRatio - 0.02 };
    const changed = f.formChange({ sourceId: 'accepted-form-change', sourceVersion: 'fixture-v1', careerId: 'career-a', playerId: 'player-1',
      effectiveDay: 20, causeEventId: 'accepted-form-rebuild', causeKind: 'FORM_REBUILD', body: first.baseline.body,
      profile: { ...profile, releaseHeightTier: projectReleaseHeightTier(profile.releaseHeightRatio, first.baseline.tierBoundaries) } });
    expect(changed.revision).toBe(1);
    f.reopen();
    expect(materializeGeneratedPitcherRelease({ generation: f.generated, release: f.release }, 'release-create-1')).toEqual({ ...first, history: changed });
    expect(f.generated.readGeneration('release-create-1')).toEqual(evidence);
    expect(f.release.positionAtDay('career-a', 'player-1', 19, { x: 0, y: 0, z: 18 })).toEqual(pitches[0].start.position);
    expect(f.release.positionAtDay('career-a', 'player-1', 50, { x: 0, y: 0, z: 18 }).y).toBeCloseTo(pitches[0].start.position.y - 0.036);
  } finally { f.close(); }
});

it('recovers a gap before release initialization and rejects mismatched, future or corrupt accepted creation evidence', () => {
  const f = setup();
  try {
    f.person(1);
    const raw = creation(1);
    for (const wrong of [{ ...raw, playerId: 'other' }, { ...raw, createdAtDay: 12 }, { ...raw, policy: { ...raw.policy, availableAtDay: 12 } }]) {
      f.replace(wrong);
      expect(() => f.generated.initialize(raw.sourceId)).toThrow();
      expect(f.generated.readGeneration(raw.sourceId)).toBeNull();
    }
    f.replace(raw);
    const generated = f.generated.initialize(raw.sourceId);
    expect(f.release.readHead('career-a', 'player-1')).toBeNull();
    f.reopen();
    const completed = materializeGeneratedPitcherRelease({ generation: f.generated, release: f.release }, raw.sourceId);
    expect(completed.baseline).toEqual(generated.baseline);
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    const observer = new DatabaseSync(f.path);
    try {
      observer.prepare('UPDATE world_pitcher_release_generations SET generated_json=? WHERE source_id=?').run('{}', raw.sourceId);
      expect(() => f.generated.readAcceptedBaseline(raw.sourceId)).toThrow('corrupt');
    } finally { observer.close(); }
  } finally { f.close(); }
});

it('freezes prior versions across Players and rolls back new policy records when generation persistence fails', () => {
  const f = setup();
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const observer = new DatabaseSync(f.path);
  try {
    f.person(1); f.person(2);
    const first = f.generated.initialize('release-create-1');
    const second = creation(2);
    f.replaceAll([creation(1), { ...second, policy: { ...second.policy, maximumAttempts: 64 } }]);
    expect(() => f.generated.initialize(second.sourceId)).toThrow('policy version');
    expect(f.generated.readGeneration(second.sourceId)).toBeNull();
    f.replaceAll([{ ...creation(1), sourceId: 'replacement-create-1' }]);
    expect(() => f.generated.initialize('replacement-create-1')).toThrow('frozen');
    expect(f.generated.readGeneration('release-create-1')).toEqual(first);

    const next = { ...second, policy: { ...second.policy, policyId: 'another-explicit-prior' } };
    f.replaceAll([next]);
    observer.exec(`CREATE TRIGGER fixture_release_generation_abort BEFORE INSERT ON world_pitcher_release_generations
      WHEN NEW.source_id='release-create-2' BEGIN SELECT RAISE(ABORT, 'fixture creation abort'); END`);
    expect(() => f.generated.initialize(next.sourceId)).toThrow('fixture creation abort');
    expect(f.generated.readGeneration(next.sourceId)).toBeNull();
    expect((observer.prepare('SELECT count(*) AS count FROM world_pitcher_release_generation_policies WHERE policy_id=?')
      .get(next.policy.policyId) as { count: number }).count).toBe(0);
    observer.exec('DROP TRIGGER fixture_release_generation_abort');
    expect(f.generated.initialize(next.sourceId).baseline.playerId).toBe('player-2');
    expect(f.generated.readGeneration('release-create-1')).toEqual(first);
  } finally { observer.close(); f.close(); }
});
