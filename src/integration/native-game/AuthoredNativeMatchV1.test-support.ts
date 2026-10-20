import { authoredClockFixture } from './AuthoredMatchClockV1.test-support';
import type { AuthoredMatchClockManifestV1 } from './AuthoredMatchClockV1';
import type { AuthoredNativeMatchDeclarationV1 } from './AuthoredNativeMatchV1';
import { bootstrap, value } from '../../core/world/club/ClubFixtures.test-support';
import { createClubFromSeed } from '../../core/world/club';
import { createRosterState } from '../../core/world/roster/RosterState';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import type { AcceptedBodySource, AcceptedPoseSource, BodyMaterializationRequest } from '../../host/world/PlayerBodyCapabilityMaterialization';
import type { AcceptedReleaseGeometryBaseline } from '../../host/world/SqlitePlayerReleaseGeometryStore';

/** Explicit synthetic SI test world. Numerical declarations are the published
 * body/release/clock fixtures, not measured people, league translations or
 * production defaults. IDs are authored before any Native owner accepts them. */
export const authoredNativeMatchFixture = (): AuthoredNativeMatchDeclarationV1 => {
  const ns = 'authored-native-match', careerId = ns + ':career', gameId = ns + ':game', fixtureEventId = ns + ':fixture', day = 10;
  const clock = (side: string): AuthoredMatchClockManifestV1 => {
    const original = authoredClockFixture();
    return { ...original, version: 'authored_match_si_clock_v1', authority: 'AUTHORED_SYNTHETIC_NOT_EMPIRICAL', units: 'SI',
      namespace: ns, careerId, clock: { ticksPerSecond: 1_000_000 }, defenders: original.defenders.map((p, i) => ({ ...p,
        playerId: ns + ':' + side + ':player:' + i, personLinkSourceId: ns + ':' + side + ':intake:' + i,
        fieldingModelSourceId: ns + ':' + side + ':fielding:' + i })) };
  };
  const clocks = [clock('home'), clock('away')] as const, players = clocks.flatMap(c => c.defenders);
  const home = clocks[0].defenders.map(p => p.playerId), side = (id: string) => home.includes(id) ? 'home' : 'away';
  const club = (id: string) => home.includes(id) ? 'club-a' : 'club-b', unit = (id: string) => 'first-' + side(id);
  const intakes = players.map((p, i) => ({ sourceId: p.personLinkSourceId, careerId, playerId: p.playerId,
    personId: ns + ':person:' + i, sourceRecordId: ns + ':record:' + i, sourceVersion: 'authored-synthetic-intake-v1',
    acceptedRevision: 1, acceptedAtDay: 0, rosterRevision: 0 }));
  const roster = createRosterState({ careerId, effectiveDay: 0,
    profiles: [{ profileId: ns + ':league', version: 'v1', season: 1, competitionEditionId: 'league-season-1', activeLimit: null,
      allowedAssignmentKinds: ['FIRST_TEAM'], rehabParticipationAllowed: false }],
    units: [{ unitId: 'first-home', clubId: 'club-a', kind: 'FIRST_TEAM' }, { unitId: 'first-away', clubId: 'club-b', kind: 'FIRST_TEAM' }],
    players: players.map(p => ({ playerId: p.playerId, clubRights: { rightsHolderClubId: club(p.playerId), contractId: ns + ':contract:' + p.playerId },
      assignment: { unitId: unit(p.playerId), clubId: club(p.playerId) },
      registrations: [{ competitionEditionId: 'league-season-1', clubId: club(p.playerId), status: 'ACTIVE', eligibility: 'ELIGIBLE', evidenceId: ns + ':registration' }],
      availability: { status: 'AVAILABLE', evidenceId: ns + ':health' } })) });
  const clubs = ['club-a', 'club-b'].map((clubId, i) => {
    const seed = bootstrap();
    return value(createClubFromSeed({ ...seed, context: { ...seed.context, careerId, existingClubIds: i ? ['club-a'] : [] },
      seed: { ...seed.seed, identity: { ...seed.seed.identity, clubId, canonicalOriginId: ns + ':origin:' + i, foundingIdentityRef: ns + ':founding:' + i } },
      initial: { ...seed.initial, references: { ...seed.initial.references, rivalryStateRefs: [], staffRoleLinks: [
        { roleId: 'manager-role', roleKind: 'MANAGER', personId: ns + ':manager:' + i, appointmentId: ns + ':appointment:' + i }] } } }));
  });
  const ratings = { positionSuitability: { P: .5, C: .5, '1B': .5, '2B': .5, '3B': .5, SS: .5, LF: .5, CF: .5, RF: .5 },
    firstStep: .5, acceleration: .5, battedBallRead: .5, routeEfficiency: .5, catching: .5, transfer: .5, armStrength: .5,
    throwingAccuracy: .5, situationalAwareness: .5, tagSkill: .5 };
  const version = 'authored-synthetic-si-body-v1', ref = (source: { sourceId: string; sourceVersion: string }) => ({ sourceId: source.sourceId, sourceVersion: source.sourceVersion });
  const bodies: AcceptedBodySource[] = [], poses: AcceptedPoseSource[] = [], releases: AcceptedReleaseGeometryBaseline[] = [], materializations: BodyMaterializationRequest[] = [];
  const reach = { sourceId: ns + ':reach', sourceVersion: version, acceptedAtDay: 0,
    baseline: { bodyOriginHeightMeters: .95, maximumLegReachMeters: 1.5, maximumGloveReachMeters: 1.3, maximumTagReachMeters: 1.1 } };
  players.forEach((p, i) => {
    const scope = { careerId, playerId: p.playerId, personId: intakes[i].personId, personLinkSourceId: p.personLinkSourceId };
    const body: AcceptedBodySource = { ...scope, sourceId: ns + ':body:' + i, sourceVersion: version, acceptedAtDay: day, physicalProfile: { heightMeters: 1.8 } };
    const pose: AcceptedPoseSource = { ...scope, sourceId: ns + ':pose:' + i, sourceVersion: version, acceptedAtDay: day, bodyRef: ref(body), primitives: [
      { role: 'body', radius: .2, offset: { x: 0, y: 0, z: 0 } }, { role: 'glove', radius: .08, offset: { x: .3, y: .15, z: .1 } },
      { role: 'tag_hand', radius: .06, offset: { x: -.3, y: .1, z: .1 } },
      { role: 'left_foot', radius: .07, offset: { x: -.1, y: -.88, z: 0 } }, { role: 'right_foot', radius: .07, offset: { x: .1, y: -.88, z: 0 } }] };
    const pitcher = i === 0 || i === 9;
    const release: AcceptedReleaseGeometryBaseline = { careerId, playerId: p.playerId, personLinkSourceId: p.personLinkSourceId,
      sourceId: ns + ':release:' + i, sourceVersion: version, acceptedAtDay: 0,
      body: { heightMeters: 1.8, shoulderHeightMeters: 1.5, armReachMeters: .8, postureDropMeters: .1, throwingSide: 'RIGHT' },
      profile: { armSlotClass: 'OVERHAND', releaseHeightTier: 'HIGH', releaseHeightRatio: .9,
        releaseLateralRatio: .1, releaseExtensionRatio: .2, armSlotElevationDeg: 70, armSlotAzimuthDeg: 0 }, tierBoundaries: [.65, .7, .75, .8, .85, .95] };
    bodies.push(body); poses.push(pose); if (pitcher) releases.push(release);
    materializations.push({ ...scope, sourceId: ns + ':materialization:' + i, sourceVersion: version, atDay: day, role: pitcher ? 'pitcher' : 'defender',
      bodyRef: ref(body), poseRef: ref(pose), reachCalibrationRef: ref(reach), fieldingModelRef: { sourceId: p.fieldingModelSourceId, sourceVersion: 'authored_si_clock_1000000_v1' },
      releaseGeometryRef: pitcher ? { ...ref(release), effectiveDay: 0 } : null });
  });
  const batterMaterialization = { ...materializations[9], sourceId: ns + ':materialization:batter', role: 'batter' as const,
    fieldingModelRef: null, releaseGeometryRef: null };
  materializations.push(batterMaterialization);
  const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
  const centers = [{ x: 0, z: 18.44 }, { x: 0, z: -1.2 }, { x: 26, z: 28 }, { x: 12, z: 40 }, { x: -26, z: 28 },
    { x: -12, z: 40 }, { x: -42, z: 80 }, { x: 0, z: 95 }, { x: 42, z: 80 }];
  return { version: 'authored_native_match_genesis_v1', authority: 'AUTHORED_SYNTHETIC_NOT_EMPIRICAL', clocks,
    world: { careerId, clubs, schedule: { leagueId: 'league-a', seasonId: 'league-season-1', memberClubIds: ['club-a', 'club-b'],
      regularSeasonGamesPerClub: 1, revisionEventIds: [], games: [{ gameId, homeClubId: 'club-a', awayClubId: 'club-b' }] },
      standingsPolicy: { version: 'authored-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 } },
    rosters: ['club-a', 'club-b'].map(clubId => ({ careerId, clubId, mood: null, roster })), intakes,
    ratings: Object.fromEntries(players.map(p => [p.playerId, structuredClone(ratings)])), fixture: { gameId, venueId: ns + ':venue', fixtureEventId, fixtureRevision: 0 },
    match: { ruleProfileId: NPB_2026_RULE_PROFILE.id, inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0, bases: { first: null, second: null, third: null },
      score: { home: 0, away: 0 }, playId: 1 }, gameDay: day,
    bindings: intakes.map(p => ({ gameId, careerId, competitionEditionId: 'league-season-1', gameDay: day, clubId: club(p.playerId),
      side: home.includes(p.playerId) ? 'HOME' : 'AWAY', playerId: p.playerId, personId: p.personId, personLinkSourceId: p.sourceId, rosterRevision: 0, fixtureEventId })),
    initialWorld: { sourceId: ns + ':initial-world', sourceVersion: 'authored-synthetic-initial-world-v1', gameId, fixtureEventId, startedAtTick: 0,
      worldSetup: { baseCenters: { first: { x: 27.432 / Math.SQRT2, z: 27.432 / Math.SQRT2 }, second: { x: 0, z: 27.432 * Math.SQRT2 }, third: { x: -27.432 / Math.SQRT2, z: 27.432 / Math.SQRT2 } },
        defenders: home.map((playerId, i) => ({ playerId, registeredPosition: positions[i], position: centers[i] })), activePreviousPlayControllerIds: [] } },
    actor: { sourceId: ns + ':batter-actor', sourceVersion: 'authored-synthetic-actor-v1', gameId, playerId: players[9].playerId, initialWorldSourceId: ns + ':initial-world' },
    bodies, poses, releases, reaches: [reach], materializations,
    assembly: { sourceId: ns + ':scene', sourceVersion: version, kind: 'body_materialized_batted_model_v1', gameId, careerId,
      fixtureEventId, venueId: ns + ':venue', availableAtDay: day, atDay: day,
      actors: [...materializations.slice(0, 9), batterMaterialization].map(m => ({ playerId: m.playerId, personId: m.personId, materializationRef: ref(m) })),
      batterGripOffset: { x: 0, y: .3, z: .15 }, surfaces: [] } };
};
