import { closeSync, openSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute } from 'node:path';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { compileAuthoredMatchClockV1, type AuthoredMatchClockManifestV1 } from './AuthoredMatchClockV1';
import { SqliteOfficialStateStore } from '../../host/SqliteOfficialStateStore';
import { openSqliteWorldSettlementStore, type InitializeWorldSeason } from '../../host/world/SqliteWorldSettlementStore';
import { openSqliteManagerRosterDecisionStore } from '../../host/world/SqliteManagerRosterDecisionStore';
import { openSqlitePlayerPersonLinkStore, type AcceptedPlayerIntakeSource } from '../../host/world/SqlitePlayerPersonLinkStore';
import { openSqlitePlayerFieldingModelStore, type AcceptedPlayerFieldingModel } from '../../host/world/SqlitePlayerFieldingModelStore';
import { openSqlitePlayerObservationModelStore } from '../../host/world/SqlitePlayerObservationModelStore';
import { openSqlitePlayerDecisionModelStore } from '../../host/world/SqlitePlayerDecisionModelStore';
import { openSqlitePlayerLocomotionModelStore } from '../../host/world/SqlitePlayerLocomotionModelStore';
import { openSqlitePlayerReleaseGeometryStore, type AcceptedReleaseGeometryBaseline } from '../../host/world/SqlitePlayerReleaseGeometryStore';
import { SqliteOfficialParticipationStore, type OfficialParticipantBinding } from '../../host/world/SqliteOfficialParticipationStore';
import { openSqliteOfficialInitialWorldStore, type AcceptedInitialWorldSetup } from '../../host/world/SqliteOfficialInitialWorldStore';
import { openSqlitePhysicalPlateAppearanceActorStore, type AcceptedPhysicalPlateAppearanceActor } from '../../host/world/SqlitePhysicalPlateAppearanceActorStore';
import { openSqlitePlayerBodyCapabilityMaterializationStore } from '../../host/world/SqlitePlayerBodyCapabilityMaterializationStore';
import type { AcceptedBodySource, AcceptedPoseSource, AcceptedReachSource, BodyMaterializationRequest,
  BattedBodyModelAssembly } from '../../host/world/PlayerBodyCapabilityMaterialization';

type RosterInitialization = Parameters<ReturnType<typeof openSqliteManagerRosterDecisionStore>['initialize']>[0];
export type AuthoredNativeMatchDeclarationV1 = Readonly<{
  version: 'authored_native_match_genesis_v1'; authority: 'AUTHORED_SYNTHETIC_NOT_EMPIRICAL';
  clocks: readonly [AuthoredMatchClockManifestV1, AuthoredMatchClockManifestV1];
  world: InitializeWorldSeason; rosters: readonly RosterInitialization[]; intakes: readonly AcceptedPlayerIntakeSource[];
  ratings: Readonly<Record<string, AcceptedPlayerFieldingModel['ratings']>>;
  fixture: Parameters<SqliteOfficialStateStore['registerOfficialFixture']>[0];
  match: CanonicalMatchState; gameDay: number; bindings: readonly OfficialParticipantBinding[]; initialWorld: AcceptedInitialWorldSetup;
  actor: Extract<AcceptedPhysicalPlateAppearanceActor, { initialWorldSourceId: string }>;
  bodies: readonly AcceptedBodySource[]; poses: readonly AcceptedPoseSource[]; reaches: readonly AcceptedReachSource[];
  releases: readonly AcceptedReleaseGeometryBaseline[]; materializations: readonly BodyMaterializationRequest[]; assembly: BattedBodyModelAssembly;
}>;
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export type AuthoredNativeMatchReadPinsV1 = Readonly<{
  initialWorldSourceId: string; sceneSourceId: string; actorSourceId: string;
  game: Readonly<{ gameId: string; careerId: string; competitionEditionId: string; gameDay: number;
    homeClubId: string; awayClubId: string; fixtureEventId: string }>;
  models: readonly Readonly<{ playerId: string; observation: string; decision: string; locomotion: string }>[];
  materializations: readonly string[];
}>;

/** Original saved-row owners and the pinned original accepted game scope.
 * Participation's mandatory game authority is retained. No new parameter
 * authors, model acceptance or regenerated bodies participate in readback. */
export const readAuthoredNativeMatchV1 = (databasePath: string, rawPins: AuthoredNativeMatchReadPinsV1) => {
  const pins = cloneInert(rawPins);
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const guard = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const tables = new Set(guard.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => String(r.name)));
    for (const table of ['official_initial_world_sources', 'world_player_observation_models', 'world_player_decision_models',
      'world_player_locomotion_models', 'world_player_body_materializations', 'world_batted_body_materializations',
      'world_season_heads', 'world_club_heads', 'world_roster_heads', 'world_player_person_links', 'physical_plate_appearance_actors']) {
      if (!tables.has(table)) throw new Error('original authored Native match schema is missing');
    }
  } finally { guard.close(); }
  const stores: { close(): void }[] = [], track = <T extends { close(): void }>(s: T): T => { stores.push(s); return s; };
  const required = <T>(value: T | null): T => { if (value === null) throw new Error('original authored Native match record is missing'); return value; };
  try {
    const official = track(new SqliteOfficialStateStore(databasePath)), world = track(openSqliteWorldSettlementStore(databasePath));
    const roster = track(openSqliteManagerRosterDecisionStore(databasePath)), links = track(openSqlitePlayerPersonLinkStore(databasePath));
    const participation = track(new SqliteOfficialParticipationStore(databasePath, {
      readGame: id => {
        const season = world.readSeason(pins.game.careerId, pins.game.competitionEditionId), fixture = official.getOfficialFixture(id);
        const scheduled = season?.schedule.games.find(g => g.gameId === id);
        return id === pins.game.gameId && fixture?.fixtureEventId === pins.game.fixtureEventId
          && scheduled?.homeClubId === pins.game.homeClubId && scheduled.awayClubId === pins.game.awayClubId ? pins.game : null;
      },
      readRoster: (career, club) => roster.readHead(career, club)?.roster ?? null,
      readPersonLink: (player, id) => { const p = links.readLink(id); return p?.playerId === player ? { personId: p.personId, sourceId: p.sourceId } : null; },
    }));
    const initialWorlds = track(openSqliteOfficialInitialWorldStore(databasePath, { matches: official, participation }));
    const initial = required(initialWorlds.readAcceptedSource(pins.initialWorldSourceId));
    const actor = required(track(openSqlitePhysicalPlateAppearanceActorStore(databasePath, { matches: official, participation, initialWorlds })).read(pins.actorSourceId));
    const observation = track(openSqlitePlayerObservationModelStore(databasePath)), decision = track(openSqlitePlayerDecisionModelStore(databasePath));
    const locomotion = track(openSqlitePlayerLocomotionModelStore(databasePath)), body = track(openSqlitePlayerBodyCapabilityMaterializationStore(databasePath));
    const models = pins.models.map(p => ({ playerId: p.playerId, observation: required(observation.read(p.observation)),
      decision: required(decision.read(p.decision)), locomotion: required(locomotion.read(p.locomotion)) }));
    if (models.some(p => [p.observation.source.playerId, p.decision.source.playerId, p.locomotion.source.playerId].some(id => id !== p.playerId)))
      throw new Error('original authored Native model player differs');
    const materializations = pins.materializations.map(id => required(body.read(id))), scene = required(body.readAcceptedModel(pins.sceneSourceId));
    return freeze({ initial, actor, models, materializations, scene });
  } finally { stores.reverse().forEach(s => s.close()); }
};

/** Fresh Native world only. Every SI/profile/pose/game value is an explicit
 * caller declaration. There are no copied legacy rows, ID substitutions,
 * default bodies, elapsed-time conversions, mock owners or game outcomes.
 * On failure the new partial DB is retained for diagnosis, never deleted. */
export const initializeAuthoredNativeMatchV1 = (databasePath: string, raw: AuthoredNativeMatchDeclarationV1) => {
  const d = cloneInert(raw), expected = ['version', 'authority', 'clocks', 'world', 'rosters', 'intakes', 'ratings', 'fixture', 'match',
    'gameDay', 'bindings', 'initialWorld', 'actor', 'bodies', 'poses', 'reaches', 'releases', 'materializations', 'assembly'];
  if (!isAbsolute(databasePath) || !d || Object.keys(d).sort().join('|') !== expected.sort().join('|')
    || d.version !== 'authored_native_match_genesis_v1' || d.authority !== 'AUTHORED_SYNTHETIC_NOT_EMPIRICAL'
    || !Array.isArray(d.clocks) || d.clocks.length !== 2) throw new Error('invalid authored Native match declaration');
  const clocks = d.clocks.map(compileAuthoredMatchClockV1), careerId = clocks[0].manifest.careerId, namespace = clocks[0].manifest.namespace;
  if (clocks.some(c => c.manifest.careerId !== careerId || c.manifest.namespace !== namespace)
    || d.world.careerId !== careerId || d.assembly.careerId !== careerId || !Number.isSafeInteger(d.gameDay) || d.gameDay < 0
    || d.initialWorld.gameId !== d.fixture.gameId || d.assembly.gameId !== d.fixture.gameId
    || d.initialWorld.fixtureEventId !== d.fixture.fixtureEventId || d.assembly.fixtureEventId !== d.fixture.fixtureEventId
    || d.assembly.venueId !== d.fixture.venueId || d.assembly.atDay !== d.gameDay
    || d.actor.gameId !== d.fixture.gameId || d.actor.initialWorldSourceId !== d.initialWorld.sourceId)
    throw new Error('authored Native match scope differs');
  const defenders = clocks.flatMap(c => c.plannedDefenders), ids = defenders.map(p => p.playerId);
  if (new Set(ids).size !== 18 || d.intakes.length !== 18 || new Set(d.intakes.map(p => p.playerId)).size !== 18 || new Set(d.intakes.map(p => p.personId)).size !== 18
    || d.intakes.some(p => !ids.includes(p.playerId) || p.careerId !== careerId)
    || Object.keys(d.ratings).length !== 18 || ids.some(id => !Object.hasOwn(d.ratings, id))
    || d.bindings.length !== 18 || new Set(d.bindings.map(b => b.playerId)).size !== 18
    || d.bindings.some(b => !ids.includes(b.playerId) || b.careerId !== careerId || b.gameId !== d.fixture.gameId || b.gameDay !== d.gameDay))
    throw new Error('authored Native match requires eighteen original participants');
  if (d.match.inning !== 1 || d.match.half !== 'top' || [d.match.outs, d.match.balls, d.match.strikes, d.match.score.home, d.match.score.away].some(n => n !== 0)
    || Object.values(d.match.bases).some(p => p !== null)) throw new Error('authored Native genesis requires an unplayed match');
  const game = d.world.schedule.games.find(g => g.gameId === d.fixture.gameId);
  if (!game || !d.rosters.some(r => r.clubId === game.homeClubId) || !d.rosters.some(r => r.clubId === game.awayClubId)
    || d.rosters.some(r => r.careerId !== careerId)) throw new Error('authored Native match fixture/roster schedule differs');
  const sources = new Map<string, unknown>();
  const publish = <T extends { sourceId: string }>(source: T): T => {
    if (!source.sourceId.startsWith(namespace + ':') || sources.has(source.sourceId)) throw new Error('authored Native source identity is duplicate or outside namespace');
    sources.set(source.sourceId, source); return source;
  };
  for (const s of [...d.intakes, ...d.bodies, ...d.poses, ...d.reaches, ...d.releases, ...d.materializations, d.assembly, d.initialWorld, d.actor]) publish(s);
  const fieldings = defenders.map(p => {
    const authored = clocks.flatMap(c => c.manifest.defenders).find(a => a.playerId === p.playerId)!;
    const intake = d.intakes.find(a => a.playerId === p.playerId)!;
    if (intake.sourceId !== authored.personLinkSourceId) throw new Error('authored Native intake/model identity differs');
    const fielding: AcceptedPlayerFieldingModel = { sourceId: authored.fieldingModelSourceId, sourceVersion: 'authored_si_clock_1000000_v1',
      careerId, playerId: p.playerId, personLinkSourceId: intake.sourceId, acceptedAtDay: p.plannedModelSources.observation.acceptedAtDay,
      ratings: d.ratings[p.playerId], ...p.effectiveValues.defender_throw };
    publish(fielding); Object.values(p.plannedModelSources).forEach(publish); return fielding;
  });
  // Reserve exclusively after preflight. A pre-existing SQLite file is never
  // opened, overwritten, migrated or resumed by this fresh-world entry point.
  const file = openSync(databasePath, 'wx'); closeSync(file);
  const stores: { close(): void }[] = [], track = <T extends { close(): void }>(s: T): T => { stores.push(s); return s; };
  const source = <T>(id: string) => (sources.get(id) ?? null) as T | null;
  try {
    const world = track(openSqliteWorldSettlementStore(databasePath)), roster = track(openSqliteManagerRosterDecisionStore(databasePath));
    world.initialize(d.world); for (const r of d.rosters) roster.initialize(r);
    const links = track(openSqlitePlayerPersonLinkStore(databasePath, { readAcceptedPlayerIntake: source }));
    links.acceptBatch(d.intakes.map(p => p.sourceId));
    const fielding = track(openSqlitePlayerFieldingModelStore(databasePath, { readAcceptedModel: source }));
    const observation = track(openSqlitePlayerObservationModelStore(databasePath, { readAcceptedModel: source }));
    const decision = track(openSqlitePlayerDecisionModelStore(databasePath, { readAcceptedModel: source }));
    const locomotion = track(openSqlitePlayerLocomotionModelStore(databasePath, { readAcceptedModel: source }));
    fieldings.forEach(p => fielding.accept(p.sourceId));
    const models = defenders.map(p => ({ playerId: p.playerId, observation: observation.accept(p.plannedModelSources.observation.sourceId),
      decision: decision.accept(p.plannedModelSources.decision.sourceId), locomotion: locomotion.accept(p.plannedModelSources.locomotion.sourceId) }));
    const official = track(new SqliteOfficialStateStore(databasePath));
    official.registerOfficialFixture(d.fixture);
    const participation = track(new SqliteOfficialParticipationStore(databasePath, {
      readGame: id => id === d.fixture.gameId && world.readSeason(careerId, d.world.schedule.seasonId) ? {
        careerId, competitionEditionId: d.world.schedule.seasonId, gameDay: d.gameDay, homeClubId: game.homeClubId,
        awayClubId: game.awayClubId, fixtureEventId: d.fixture.fixtureEventId } : null,
      readRoster: (career, club) => roster.readHead(career, club)?.roster ?? null,
      readPersonLink: (playerId, id) => { const p = links.readLink(id); return p?.playerId === playerId ? { sourceId: p.sourceId, personId: p.personId } : null; },
    }));
    d.bindings.forEach(b => participation.bindPregame(b));
    official.initializeMatch(d.fixture.gameId, d.match);
    const initialWorlds = track(openSqliteOfficialInitialWorldStore(databasePath, { matches: official, participation }, { readAcceptedSetup: source }));
    const initial = initialWorlds.accept(d.initialWorld.sourceId);
    const release = track(openSqlitePlayerReleaseGeometryStore(databasePath, links, { readAcceptedBaseline: source, readAcceptedChange: () => null }));
    d.releases.forEach(r => release.initialize(r.sourceId));
    const bodies = track(openSqlitePlayerBodyCapabilityMaterializationStore(databasePath, { readAcceptedMaterialization: source,
      readAcceptedBody: source, readAcceptedPose: source, readAcceptedReachCalibration: source, readAcceptedModelAssembly: source }));
    const materializations = d.materializations.map(s => {
      const result = bodies.accept(s.sourceId);
      if (result.kind !== 'materialized') throw new Error('authored Native body is pending: ' + result.missing.join(','));
      return result.value;
    });
    const scene = bodies.acceptModel(d.assembly.sourceId);
    const actor = track(openSqlitePhysicalPlateAppearanceActorStore(databasePath, { matches: official, participation, initialWorlds }, { readAcceptedActor: source })).accept(d.actor.sourceId);
    const readPins: AuthoredNativeMatchReadPinsV1 = { initialWorldSourceId: d.initialWorld.sourceId, sceneSourceId: d.assembly.sourceId, actorSourceId: d.actor.sourceId,
      game: { gameId: d.fixture.gameId, careerId, competitionEditionId: d.world.schedule.seasonId, gameDay: d.gameDay,
        homeClubId: game.homeClubId, awayClubId: game.awayClubId, fixtureEventId: d.fixture.fixtureEventId },
      models: defenders.map(p => ({ playerId: p.playerId, observation: p.plannedModelSources.observation.sourceId,
        decision: p.plannedModelSources.decision.sourceId, locomotion: p.plannedModelSources.locomotion.sourceId })),
      materializations: d.materializations.map(m => m.sourceId) };
    return freeze({ authority: d.authority, ticksPerSecond: 1_000_000 as const, initial, actor, models, materializations, scene,
      acceptedSources: [...sources], readPins, nativeInitialWorldReady: true as const, nativeLiveExecution: false as const, nativeMatchReady: false as const, officialResult: null });
  } finally { stores.reverse().forEach(s => s.close()); }
};
