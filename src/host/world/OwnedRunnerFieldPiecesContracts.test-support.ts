import type { BallWorldMoment } from '../../core/sim/ball/BallWorldContinuation';
import type { BallWorldPlayerBaseContactSegment } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { createBattedWorldBaseGeometry } from '../../core/sim/ball/BattedWorldBaseGeometry';
import { createBattedWorldFieldGeometry, type BattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import { deriveAndRecordBattedWorldFirstFielderTouch } from '../../core/sim/plateAppearance/BattedWorldFirstFielderTouch';
import { deriveBattedBallContactResponse } from '../../core/sim/ball/BattedBallContactResponse';
import { ownedRunnerFieldInputs } from './OwnedRunnerFieldFixtures.test-support';
import { buildPrePitchRunnerController } from './PrePitchRunnerExecution';
import { battedWorldContactEvidenceFromSqlite } from './SqliteBattedWorldContactStore';
import { battedWorldFieldEvidenceFromSqlite, type AcceptedBattedWorldFieldAction, type DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import type { ActualOwnedRunnerFieldKinematics } from './ActualPlayerKinematicsFromOwnedRunnerField';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Proposed interfaces only. Every physical result must come from the production owner. */
// This original-runner fixture has legacy geometry only. Preserve that variant
// before Omit, which otherwise erases the episode root's discriminated pairing.
type LegacyFieldSource = Extract<AcceptedBattedWorldFieldAction, Readonly<{ episodeFieldBinding?: never }>>;
type LegacyFieldAction = Extract<DurableBattedWorldFieldAction, Readonly<{ rootKind?: never }>>;
export type RunnerPiecesSource = Omit<LegacyFieldSource, 'kind' | 'prePitchRunnerSourceId'> & Readonly<{
  kind: 'owned_runner_field_pieces_v1'; prePitchRunnerSourceId: string }>;
export type RunnerFieldPiece = Readonly<{ ordinal: number; controllerSegmentIndex: number; startMoment: BallWorldMoment;
  throughElapsedSeconds: number; coverageThroughElapsedSeconds: number; field: BattedWorldFieldMotion }>;
export type DurableRunnerFieldPieces = Omit<LegacyFieldAction, 'source' | 'history'> & Readonly<{
  source: RunnerPiecesSource; history: readonly (AcceptedBattedWorldFieldAction | RunnerPiecesSource)[];
  pieceExecution: Readonly<{ version: 'owned_runner_field_pieces_execution_v1'; pieces: readonly RunnerFieldPiece[] }> }>;
type PieceOwner = { derive(source: RunnerPiecesSource): DurableRunnerFieldPieces; read(sourceId: string): DurableRunnerFieldPieces | null };
export type RunnerPiecesCut = Readonly<{ kind: 'owned_runner_field_pieces_v1'; physicalPitchSourceId: string; fieldSourceId: string; playerId: string }>;
export type RunnerPiecesKinematics = Omit<ActualOwnedRunnerFieldKinematics, 'version' | 'physicalPrefix'> & Readonly<{
  version: 'owned_runner_field_pieces_kinematics_v1'; cut: RunnerPiecesCut;
  physicalPrefix: Readonly<{ version: 'owned_runner_field_pieces_prefix_v1'; at: ActualOwnedRunnerFieldKinematics['at'];
    participants: ActualOwnedRunnerFieldKinematics['physicalPrefix']['participants'];
    segments: readonly (BallWorldPlayerBaseContactSegment & Readonly<{ execution: Readonly<{
      owner: 'batted_world_contacts' | 'batted_world_field_actions'; sourceId: string; revision: number; pieceOrdinal: number | null }> }>)[] }>;
  dependencyHashes: Readonly<{ physicalPrefix: string; physicalPitch: string; worldContact: string; model: string; field: string }>;
}>;
type PieceReader = { readOwnedRunnerFieldPieces(cut: RunnerPiecesCut): RunnerPiecesKinematics };
export const requireRunnerPiecesRead = (reader: unknown): PieceReader['readOwnedRunnerFieldPieces'] => {
  const read = (reader as Partial<PieceReader>)?.readOwnedRunnerFieldPieces;
  if (typeof read !== 'function') throw new Error('owned runner field-pieces reader capability is not implemented');
  return read.bind(reader);
};
export const deriveRunnerPieces = (owner: unknown, source: RunnerPiecesSource): DurableRunnerFieldPieces => {
  const value = (owner as PieceOwner).derive(source);
  if (value?.pieceExecution?.version !== 'owned_runner_field_pieces_execution_v1') throw new Error('owned runner field-pieces execution capability is not implemented');
  return value;
};

/** Small source fixture. Flight/response/base readers are explicitly substituted by
 * each suite; contact, geometry and all field outcomes use existing Core owners. */
export const runnerFieldPiecesFixture = (state: { flight: unknown; response: unknown; bases: unknown }, options: Readonly<{
  path?: string; phase?: 'fractional' | 'integer' | 'reaction' | 'braking'; collision?: 'before' | 'coincident' | 'after'; zeroBag?: boolean; rootZ?: number;
  originalContext?: Readonly<{ startingBase: 1 | 2 | 3; officialRevision: number; matchSeed: number }>;
}> = {}) => {
  const x = ownedRunnerFieldInputs(options.path), originalRunner = x.flight.physicalPitch.frame.prePitchRunner;
  const phase = options.phase ?? 'fractional';
  const route = options.rootZ === undefined ? originalRunner.source.route : { segments: originalRunner.source.route.segments.map(segment => {
    if (segment.kind !== 'line') throw new Error('fixture requires the original straight runner route');
    return { ...segment, start: { ...segment.start, z: options.rootZ! }, end: { ...segment.end, z: options.rootZ! } };
  }) };
  const canonical = { ...originalRunner.canonical, position: { ...originalRunner.canonical.position,
    ...(options.rootZ === undefined ? {} : { z: options.rootZ }) }, velocity: { x: phase === 'braking' ? 4.25 : originalRunner.canonical.velocity.x, z: 0 } };
  const runnerSource = { ...originalRunner.source, route, startMotion: { ...originalRunner.source.startMotion,
    driveDirection: phase === 'reaction' ? 0 as const : 1 as const, speedMps: phase === 'braking' ? 4.25 : 0 },
    intent: { ...originalRunner.source.intent, kind: phase === 'braking' ? 'hold' as const : 'advance' as const },
    parameters: { ...originalRunner.source.parameters, topSpeedMps: phase === 'fractional' ? 4.2469134 : phase === 'integer' ? 4.25 : 8,
      brakingMps2: phase === 'braking' ? 2 : originalRunner.source.parameters.brakingMps2, reactionDelayTicks: phase === 'reaction' ? 2_125_000 : 0 } };
  const runner = { ...originalRunner, source: runnerSource, canonical, controller: buildPrePitchRunnerController(runnerSource, canonical) };
  const originalWorld = x.flight.physicalPitch.frame.world;
  const context = options.originalContext;
  const match = context ? { ...x.flight.physicalPitch.frame.match, bases: {
    first: context.startingBase === 1 ? runner.source.playerId : null,
    second: context.startingBase === 2 ? runner.source.playerId : null,
    third: context.startingBase === 3 ? runner.source.playerId : null,
  } } : x.flight.physicalPitch.frame.match;
  const actorWorld = { ...originalWorld, runners: originalWorld.runners.map(actor => ({ ...actor, position: canonical.position, velocity: canonical.velocity })) };
  const binaryRadii = options.collision !== undefined;
  const parameters = { ...x.flight.source.execution.ballFlightParameters, ...(binaryRadii ? { ballRadius: 0.125 } : {}) };
  const originalContact = x.flight.flight.contact;
  const ballX = options.collision === 'before' ? 14.5 : options.collision === 'coincident' ? 14.765625 : 16;
  const contact = { ...originalContact, ballCenter: { ...originalContact.ballCenter, x: ballX },
    point: { ...originalContact.point, x: ballX }, batPoint: { ...originalContact.batPoint, x: ballX } };
  const physicalPitch = { ...x.flight.physicalPitch, source: { ...x.flight.physicalPitch.source, prePitchRunner: runnerSource },
    frame: { ...x.flight.physicalPitch.frame, world: actorWorld,
      ...(context ? { match, matchSeed: context.matchSeed, officialRevision: context.officialRevision } : {}),
      batterActor: { ...x.flight.physicalPitch.frame.batterActor, world: actorWorld,
        ...(context ? { match, officialRevision: context.officialRevision } : {}) }, prePitchRunner: runner }, result: { pitch: { resolution: {
      ...x.flight.physicalPitch.result.pitch.resolution, timeline: { ...x.flight.physicalPitch.result.pitch.resolution.timeline,
        events: x.flight.physicalPitch.result.pitch.resolution.timeline.events.map(event => ({ ...event, payload: { ...event.payload, contact } })) } } } } };
  const flight = { ...x.flight, physicalPitch, source: { ...x.flight.source,
    execution: { ...x.flight.source.execution, ballFlightParameters: parameters } },
    flight: createBattedBallFlightEvidence({ contact, parameters, searchDurationTicks: 0 }) };
  const model = { ...x.model, actors: x.model.actors.map(actor => ({ ...actor,
    primitives: actor.primitives.map(part => ({ ...part, radius: binaryRadii && actor.playerId === 'runner' ? 0.125 : part.radius })) })) };
  const center = x.bases.source.bases.first.region.center, point = flight.flight.initialBall.position;
  const baseSource = { ...x.bases.source, bases: { ...x.bases.source.bases, first: options.zeroBag ? { ...x.bases.source.bases.first,
    region: { ...x.bases.source.bases.first.region, halfSize: { x: Math.abs(point.x - center.x) + 1, z: Math.abs(point.z - center.z) + 1 } },
    surfaceHeightMeters: point.y + 1 } : x.bases.source.bases.first } };
  const bases = { ...x.bases, source: baseSource, flight,
    geometry: createBattedWorldBaseGeometry({ field: x.bases.geometry.field, bases: baseSource.bases }) };
  const geometry = { ...x.geometry, baseGeometry: bases,
    geometry: createBattedWorldFieldGeometry({ baseGeometry: bases.geometry, baseModels: x.geometry.source.baseModels }) };
  x.db.prepare('UPDATE batted_world_field_geometries SET snapshot_json=?,snapshot_hash=?').run(json(geometry), hash(geometry));
  state.flight = flight; state.bases = bases;
  const world = battedWorldContactEvidenceFromSqlite(x.db).derive(x.contactSource, model, null);
  const worldInput = { flight: flight.flight, parameters, throughTick: flight.flight.contact.tick, actors: world.actors, surfaces: model.surfaces };
  const touch = { source: x.touchSource, worldContact: world, result: deriveAndRecordBattedWorldFirstFielderTouch({ timeline: world.timeline,
    world: worldInput, defenderIds: physicalPitch.frame.batterActor.defenderBindings.map(binding => binding.playerId), field: flight.source.execution.field }) };
  const responseModel = { ...x.responseModel, actors: x.responseModel.actors.map(actor => ({ ...actor,
    primitives: actor.primitives.map(profile => profile.role !== 'glove' ? profile : { ...profile,
      parameters: { ...profile.parameters, ballRadiusMeters: parameters.ballRadius } }) })) };
  const responseInput = { world: worldInput, actors: responseModel.actors.filter(actor => world.actors.some(part => part.playerId === actor.playerId))
    .flatMap(actor => actor.primitives.map(profile => ({ playerId: actor.playerId, profile }))), surfaces: responseModel.surfaces };
  const response = { source: x.responseSource, model: responseModel, touch, result: deriveBattedBallContactResponse(responseInput) };
  state.response = response;
  const own = battedWorldFieldEvidenceFromSqlite(x.db);
  const source: RunnerPiecesSource = { ...x.source, kind: 'owned_runner_field_pieces_v1', sourceId: 'runner-pieces-1', throughTick: x.source.availableAtTick + 600_000 };
  const archive = (value: DurableBattedWorldFieldAction | DurableRunnerFieldPieces) => {
    const s = value.source, pitchId = flight.source.physicalPitchSourceId;
    x.db.prepare('INSERT INTO batted_world_field_actions VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(s.sourceId, pitchId, s.responseSourceId, s.geometrySourceId,
      s.previousFieldSourceId, value.revision, model.gameId, json(s), hash(s), json(value), hash(value));
    x.db.prepare('DELETE FROM batted_world_field_heads').run();
    x.db.prepare('INSERT INTO batted_world_field_heads VALUES(?,?,?,?,?)').run(pitchId, s.responseSourceId, s.geometrySourceId, s.sourceId, value.revision);
  };
  return { ...x, v1Source: x.source, source, flight, world, runner, model, bases, geometry, response, responseInput, own, archive };
};
export const appendRunnerPieceRow = (x: ReturnType<typeof runnerFieldPiecesFixture>) => {
  const first = x.own.derive(x.v1Source); x.archive(first);
  const source: RunnerPiecesSource = { ...x.source, previousFieldSourceId: first.source.sourceId, throughTick: x.source.availableAtTick + 300_000,
    commands: x.source.commands.map(command => command.playerId !== 'defender-0' ? command : { ...command,
      bodyAcceleration: { x: 2, y: 0, z: 0 }, primitiveMotions: command.primitiveMotions.map(part => part.role !== 'right_foot' ? part
        : { ...part, offsetAcceleration: { x: 0, y: 0, z: 0.4 } }) }) };
  const second = deriveRunnerPieces(x.own, source); x.archive(second);
  const cut: RunnerPiecesCut = { kind: 'owned_runner_field_pieces_v1', physicalPitchSourceId: x.flight.source.physicalPitchSourceId,
    fieldSourceId: second.source.sourceId, playerId: 'runner' };
  return { first, second, cut };
};
