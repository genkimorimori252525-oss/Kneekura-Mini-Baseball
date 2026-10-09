import type { DatabaseSync } from 'node:sqlite';
import { composeDefenderPhysicalPrimitiveSegment } from '../../core/sim/fielding/DefenderPhysicalPrimitive';
import { findBallWorldFootBaseContact } from '../../core/sim/ball/BallWorldFootBaseContact';
import { findMovingSphereContactTime } from '../../core/sim/collision/MovingSphereContact';
import { deriveBallWorldVenueLegalCoverage } from '../../core/rules/BallWorldVenueLegalCoverage';
import type { CanonicalPitchDelivery } from '../../core/sim/pitch/CanonicalPitchDelivery';
import type { PitchTrajectorySegment } from '../../core/sim/pitching/PitchTrajectory';
import { actorFreeze as freeze, actorHash as hash, actorJson as json, readPhysicalPlateAppearanceActorFromSqlite,
  type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { DurableBattingInvocationPosture } from './NativeBattingPerception';
import type { SamePaPreparedAction } from './SamePlateAppearanceDispatchRecords';
import { samePaExecutionReference as reference, proveSamePaExecution } from './SamePlateAppearanceExecutionFromSqlite';
import { readHistoricalSamePaExecutionView } from './SamePlateAppearanceHistoricalExecutionEvidenceFromSqlite';
import { assertFreshPaDispatchEnrollment } from './SamePlateAppearanceDispatchClaimGuard';
import { readSamePaPreparedActionFromSqlite } from './SqliteSamePlateAppearanceDispatchStore';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import { samePaLiveBallAssignmentInput, type AcceptedSamePaLiveBallAssignment } from './SamePlateAppearanceLiveBallStateSource';
import { samePaOfficialPersonInput, assertSamePaAcceptedOfficialSource, type AcceptedSamePaOfficialPerson } from './SamePlateAppearanceCatchCommunicationSource';
import { initialBallTables as tables, samePaInitialVenueInput, type AcceptedSamePaInitialBallSetup, type AcceptedSamePaInitialPlay,
  type AcceptedSamePaInitialVenue, type SamePaInitialPlayReference } from './SamePlateAppearanceInitialBallSource';
const zero = Object.freeze({ x: 0, y: 0, z: 0 });
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('initial ball original physical scope differs'); };

/** One original instant only: no movement, carry offset or hand-to-release
 * trajectory is invented. The separate accepted custody state supplies control. */
export const deriveSamePaInitialSetup = (source: AcceptedSamePaInitialBallSetup, venue: AcceptedSamePaInitialVenue,
  actor: DurablePhysicalPlateAppearanceActor, action: SamePaPreparedAction, posture: DurableBattingInvocationPosture) => {
  const lineage = action.lineage, at = actor.world.tick;
  same(source.enrollmentReference, lineage.enrollmentReference); same(source.viewReference, action.source.viewReference);
  same(source.actionReference, reference('pa_dispatch_v1_action_plans', action)); same(posture.lineage, lineage);
  same(posture.source.viewReference, source.viewReference); same(posture.source.actionReference, source.actionReference);
  same(posture.source.modelReference, action.source.batterModelReference); assertSamePaAcceptedOfficialSource(venue, source.venueReference);
  const pitchers = actor.world.defenders.filter(d => d.registeredPosition === 'P'), pitcher = pitchers[0];
  const binding = actor.defenderBindings.find(d => d.playerId === source.pitcherPlayerId), person = actor.defenderPersons.find(p => p.playerId === source.pitcherPlayerId);
  const body = posture.sceneBodies.find(b => b.source.playerId === source.pitcherPlayerId);
  if (posture.source.capability !== 'owned_batting_invocation_posture_v1' || posture.physicalPitchSourceId !== source.firstPhysicalPitchSourceId
    || source.firstPhysicalPitchSourceId !== lineage.firstPhysicalPitchSourceId || pitchers.length !== 1 || pitcher.playerId !== source.pitcherPlayerId
    || action.source.pitcherPlayerId !== pitcher.playerId || !binding || !person || !body || body.source.role !== 'pitcher'
    || body.source.careerId !== actor.binding.careerId || body.source.atDay > actor.binding.gameDay
    || body.person.personId !== binding.personId || body.person.sourceId !== binding.personLinkSourceId
    || source.custody.ball.tick !== at || posture.source.geometry.startedAtTick !== at || posture.source.geometry.ticksPerSecond !== 1_000_000
    || posture.source.geometry.validUntilTick < at || action.source.nominalPitch.delivery.readyAtUs < at
    || pitcher.velocity.x !== 0 || pitcher.velocity.z !== 0
    || venue.careerId !== actor.binding.careerId || venue.gameId !== actor.source.gameId || venue.playId !== actor.match.playId
    || venue.fixtureEventId !== actor.binding.fixtureEventId || venue.availableAtDay > actor.binding.gameDay
    || venue.rulePolicy.ruleProfileId !== actor.match.ruleProfileId) throw new Error('initial ball original pitcher, clock or venue differs');
  same(body.person, person);
  if (actor.world.ball !== null && actor.world.ball !== undefined) same(actor.world.ball, { position: source.custody.ball.position, velocity: source.custody.ball.velocity, spin: source.custody.ball.spin });
  const ball = source.custody.ball, equipment = posture.model.equipment.values.ball;
  if (!(equipment.radiusM > 0) || !(equipment.massKg > 0) || equipment.radiusM !== action.source.nominalPitch.batter.ballRadiusMeters)
    throw new Error('initial ball original equipment differs');
  const clock = { startTick: at, endTick: at, ticksPerSecond: 1_000_000 };
  const primitives = body.actor.primitives.map(shape => ({ playerId: pitcher.playerId,
    primitive: composeDefenderPhysicalPrimitiveSegment({ ...clock,
      startPosition: { x: pitcher.position.x, y: body.actor.bodyOriginHeightMeters, z: pitcher.position.z }, startVelocity: zero, acceleration: zero },
    { ...clock, role: shape.role, radius: shape.radius, startOffset: shape.offset, offsetVelocity: zero, offsetAcceleration: zero }) }));
  const feet = primitives.filter(a => a.primitive.role === 'left_foot' || a.primitive.role === 'right_foot');
  if (feet.length !== 2 || new Set(feet.map(a => a.primitive.role)).size !== 2) throw new Error('initial ball original pitcher feet missing');
  const footContacts = feet.map(actor => findBallWorldFootBaseContact({ actor, originTick: at, searchStartElapsedSeconds: 0,
    searchEndElapsedSeconds: 0, base: venue.pitcherPlate.region, baseSurfaceHeightMeters: venue.pitcherPlate.surfaceHeightMeters })).filter(v => v !== null);
  if (!footContacts.length) throw new Error('initial ball actual pitcher plate contact missing');
  const holders = primitives.filter(a => a.primitive.role === source.custody.role);
  if (holders.length !== 1) throw new Error('initial ball original custody primitive missing');
  const p = holders[0].primitive;
  const contact = findMovingSphereContactTime({ tick: at, center: ball.position, velocity: ball.velocity, radius: equipment.radiusM },
    { tick: at, center: p.startCenter, velocity: p.startVelocity, radius: p.radius }, 0, { ticksPerSecond: 1_000_000 });
  if (!contact) throw new Error('initial ball custody has no actual body contact');
  const occurredAt = { originTick: at, elapsedSeconds: 0, tick: at };
  const legalAt = (position: typeof ball.position, radius: number) => {
    const moment = { originTick: at, elapsedSeconds: 0, ball: { tick: at, position, velocity: zero, spin: zero } };
    return deriveBallWorldVenueLegalCoverage({ policy: venue.rulePolicy, originTick: at, ticksPerSecond: 1_000_000, ballRadiusMeters: radius,
      segments: [{ startElapsedSeconds: 0, endElapsedSeconds: 0, basis: moment, endpoint: moment, acceleration: zero }] });
  };
  const legalCoverage = [legalAt(ball.position, equipment.radiusM), ...primitives.filter(a => ['body','left_foot','right_foot'].includes(a.primitive.role))
    .map(a => legalAt(a.primitive.startCenter, a.primitive.radius))];
  if (legalCoverage.length !== 4 || legalCoverage.some(v => v.intervals[0].end.classification !== 'inside_playable_region'))
    throw new Error('initial ball original pitcher or ball playable interior missing');
  return freeze({ kind: 'same_pa_initial_ball_setup_v1' as const, source, lineage, originalVenue: venue, occurredAt,
    actorReference: lineage.actorReference, worldHash: hash(actor.world), pitcherPerson: person,
    bodyReference: reference('world_player_body_materializations', body), equipmentHash: hash(posture.model.equipment),
    ball, ballRadiusMeters: equipment.radiusM, ballMassKg: equipment.massKg, primitives, footContacts, custodyContact: contact, legalCoverage });
};
export type SamePaInitialBallSetup = ReturnType<typeof deriveSamePaInitialSetup>;
export type SamePaInitialPlayOriginals = Readonly<{ assignment: AcceptedSamePaLiveBallAssignment; person: AcceptedSamePaOfficialPerson }>;
export const deriveSamePaInitialPlay = (source: AcceptedSamePaInitialPlay, setup: SamePaInitialBallSetup, raw: SamePaInitialPlayOriginals) => {
  const assignment = samePaLiveBallAssignmentInput(raw.assignment, source.assignmentReference.sourceId);
  const person = samePaOfficialPersonInput(raw.person, assignment.personReference.sourceId);
  assertSamePaAcceptedOfficialSource(assignment, source.assignmentReference); assertSamePaAcceptedOfficialSource(person, assignment.personReference);
  same(source.setupReference, reference(tables.setup, setup)); same(assignment.enrollmentReference, setup.lineage.enrollmentReference);
  if (assignment.gameId !== setup.lineage.gameId || assignment.playId !== setup.lineage.playId
    || assignment.physicalPitchSourceId !== setup.source.firstPhysicalPitchSourceId || assignment.policy.ruleProfileId !== setup.originalVenue.rulePolicy.ruleProfileId
    || assignment.officialId !== source.officialId || assignment.personId !== source.personId || person.officialId !== source.officialId
    || person.personId !== source.personId || person.careerId !== setup.lineage.careerId) throw new Error('initial Play original plate-umpire scope differs');
  return freeze({ kind: 'same_pa_initial_play_v1' as const, source, lineage: setup.lineage, setupReference: source.setupReference,
    originalInputs: { assignment, person }, occurredAt: setup.occurredAt, state: 'live' as const, setupHash: hash(setup) });
};
export type SamePaInitialPlay = ReturnType<typeof deriveSamePaInitialPlay>;
export const deriveSamePaInitialSetupFromSqlite = (db: DatabaseSync, source: AcceptedSamePaInitialBallSetup, rawVenue: unknown, fresh: boolean) => {
  const venue = samePaInitialVenueInput(rawVenue), b = readHistoricalSamePaExecutionView(db, source.viewReference);
  if (fresh) { same(proveSamePaExecution(db, { kind: 'view', sourceId: source.viewReference.sourceId }), b.view);
    assertFreshPaDispatchEnrollment(db, source.enrollmentReference.sourceId); }
  const actor = readPhysicalPlateAppearanceActorFromSqlite(db, b.view.lineage.actorReference.sourceId);
  if (!actor) throw new Error('initial ball original actor missing');
  same(reference('physical_plate_appearance_actors', actor), b.view.lineage.actorReference);
  const fixture = db.prepare('SELECT * FROM main.official_fixtures WHERE game_id=?').get(actor.source.gameId);
  if (!fixture || hash(fixture) !== actor.fixtureHash || fixture.venue_id !== venue.venueId || fixture.fixture_event_id !== venue.fixtureEventId)
    throw new Error('initial ball original fixture differs');
  const action = readSamePaPreparedActionFromSqlite(db, source.actionReference), posture = readBattingPerceptionFromSqlite(db, 'posture', source.postureReference);
  if (posture.kind !== 'batting_invocation_posture') throw new Error('initial ball original posture missing');
  return deriveSamePaInitialSetup(source, venue, actor, action, posture);
};

/** The approved pitch abstraction adopts flight from the executed canonical
 * release. The original initial Play clock and all release vectors remain intact. */
export const bindSamePaInitialPlayToPitch = (play: SamePaInitialPlay, setup: SamePaInitialBallSetup, input: Readonly<{
  sourceId: string; actionReference: AcceptedSamePaInitialBallSetup['actionReference'];
  playReference: SamePaInitialPlayReference; delivery: CanonicalPitchDelivery; trajectory: PitchTrajectorySegment }>) => {
  same(reference(tables.play, play), input.playReference); same(play.setupReference, reference(tables.setup, setup));
  same(setup.source.actionReference, input.actionReference);
  const { release, timeline } = input.delivery;
  if (input.sourceId !== setup.source.firstPhysicalPitchSourceId || timeline.readyAtUs < play.occurredAt.tick || release.releaseAtUs !== timeline.releaseUs
    || release.releaseAtUs < play.occurredAt.tick || input.trajectory.ticksPerSecond !== 1_000_000
    || input.trajectory.start.tick !== release.releaseAtUs) throw new Error('initial Play canonical pitch clock or scope differs');
  same(input.trajectory.start.position, release.position); same(input.trajectory.start.velocity, release.velocity); same(input.trajectory.start.spin, release.spin);
  return freeze({ kind: 'same_pa_initial_pitch_live_binding_v1' as const, playReference: input.playReference, setupReference: play.setupReference,
    playDeclaration: { ...input.playReference, sourceVersion: play.source.sourceVersion },
    occurredAt: play.occurredAt, initialCustody: setup.source.custody, release, trajectoryHash: hash(input.trajectory) });
};
export type SamePaInitialPitchLiveBinding = ReturnType<typeof bindSamePaInitialPlayToPitch>;
