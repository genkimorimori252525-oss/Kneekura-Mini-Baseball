import { composeDefenderPhysicalPrimitiveSegment } from '../../core/sim/fielding/DefenderPhysicalPrimitive';
import { continuousPitchMoundReference } from './ContinuousPitchFixtures.test-support';
import { worldSetup } from './OfficialParticipationPlayFixtures.test-support';
import type { directNativeDispatchFixture } from './SamePlateAppearanceDirectNative.test-support';
import { deriveSamePaDispatchRoles } from './SamePlateAppearanceDispatchRoles';
import { readSamePaOriginalParticipants } from './SamePlateAppearanceOriginalParticipants';
import { readSamePaOccupiedRunnerHoldFromSqlite } from './SqliteSamePlateAppearanceOccupiedRunnerHoldStore';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaOfficialSourceReference as originalReference, type AcceptedSamePaOfficialPerson } from './SamePlateAppearanceCatchCommunicationSource';
import type { AcceptedSamePaLiveBallAssignment } from './SamePlateAppearanceLiveBallStateSource';
import { initialBallTables, type AcceptedSamePaInitialVenue, type AcceptedSamePaInitialBallSetup, type AcceptedSamePaInitialPlay } from './SamePlateAppearanceInitialBallSource';
import type { AcceptedBattingInvocationPosture } from './NativeBattingPerception';
import { openSqliteBattingPerceptionStore } from './SqliteBattingPerceptionStore';
import { openSqliteSamePlateAppearanceInitialBallStore } from './SqliteSamePlateAppearanceInitialBallStore';

/** Geometry and official authority are explicit caller inputs. This hook supplies
 * only the new fixture's original scope; it never chooses a stadium or umpire. */
export type SamePaInitialPlayFixtureInputs = Readonly<{
  /** The plate plane must match the accepted foot contact point. The existing
   * Native pose places that point at bodyOriginHeightMeters + foot.offset.y;
   * this hook does not move the feet or derive a replacement venue surface. */
  venue: Pick<AcceptedSamePaInitialVenue, 'pitcherPlate' | 'rulePolicy'>;
  officialPerson: AcceptedSamePaOfficialPerson;
  assignmentPolicy: AcceptedSamePaLiveBallAssignment['policy'];
}>;

/** Applied upstream of initialWorlds.accept, never to an already accepted actor. */
export const samePaInitialPlayDefenders = (originalDefenders = worldSetup('p2').defenders): typeof originalDefenders =>
  originalDefenders.map(defender => defender.registeredPosition === 'P'
    ? { ...defender, position: { x: continuousPitchMoundReference.x, z: continuousPitchMoundReference.z } } : defender);

/** Accept the actual prospective posture, secure held-ball instant and separate
 * plate-umpire Play. No hand-to-release path or historical World is rewritten. */
type InitialPlayFixtureContext = Pick<ReturnType<typeof directNativeDispatchFixture>,
  'actor' | 'view' | 'acceptedAction' | 'request' | 'db' | 'path' | 'x'> & Readonly<{
    stance: Pick<ReturnType<typeof directNativeDispatchFixture>['stance'], 'handedness' | 'centerOfMass' | 'eyePosition'>;
  }>;

export const prepareSamePaInitialPlayFixture = (f: InitialPlayFixtureContext,
  accepted: Map<string, unknown>, sceneBodyReferences: AcceptedBattingInvocationPosture['sceneBodyReferences'],
  inputs: SamePaInitialPlayFixtureInputs, label = 'physical-fixture') => {
  const save = <T extends { sourceId: string }>(source: T): T => { accepted.set(source.sourceId, source); return source; };
  const get = (id: string) => accepted.get(id), track = f.x.f.track, original = f.acceptedAction.source;
  const at = f.actor.world.tick, readyAtUs = original.nominalPitch.delivery.readyAtUs;
  const holdReferences = original.occupiedRunnerHoldReferences;
  const validUntilTick = Math.min(readyAtUs + 20_000_000, ...(holdReferences ?? [])
    .map(pin => readSamePaOccupiedRunnerHoldFromSqlite(f.db, pin).source.coverageThroughTick));
  const perception = track(openSqliteBattingPerceptionStore(f.path, { readAcceptedPosture: get }));
  const originals = f.actor.world.runners.length ? readSamePaOriginalParticipants(f.db, f.actor) : undefined;
  const postureSource: AcceptedBattingInvocationPosture = save({ sourceId: label + ':initial-posture', sourceVersion: 'fixture-only-v1',
    capability: 'owned_batting_invocation_posture_v1', viewReference: original.viewReference,
    member: deriveSamePaDispatchRoles(f.actor, f.view, originals)[0].member, actionReference: f.request.actionReference,
    modelReference: original.batterModelReference, sceneBodyReferences,
    ...(holdReferences === undefined ? {} : { occupiedRunnerHoldReferences: holdReferences }),
    // Reuse the existing explicit lifecycle posture and its twenty-second window.
    geometry: { kind: 'stationary_pre_pitch_scene_v1', startedAtTick: at, validUntilTick, ticksPerSecond: 1_000_000,
      handedness: f.stance.handedness, centerOfMass: f.stance.centerOfMass, eyePosition: f.stance.eyePosition,
      observerForward: { x: 0, y: 0, z: 1 }, attention: { target: { kind: 'ball' }, focusedSinceTick: at },
      bodyReadyTick: readyAtUs, latestMotorStartTick: readyAtUs, plateZ: original.nominalPitch.batter.plateZ,
      strikeZone: original.nominalPitch.batter.strikeZone },
    provenance: { assessmentSourceId: label + ':initial-posture-assessment', assessmentVersion: 'fixture-only-v1',
      calibrationSourceId: 'existing-explicit-Core-fixture', calibrationVersion: 'fixture-only-v1' } });
  const posture = perception.acceptPosture(postureSource.sourceId);
  if (posture.kind !== 'batting_invocation_posture') throw new Error('real initial posture pending');
  const pitcher = f.actor.world.defenders.find(d => d.registeredPosition === 'P');
  const body = posture.sceneBodies.find(b => b.source.playerId === pitcher?.playerId);
  const glove = body?.actor.primitives.find(p => p.role === 'glove');
  if (!pitcher || !body || !glove) throw new Error('real initial pitcher glove missing');
  const zero = { x: 0, y: 0, z: 0 }, clock = { startTick: at, endTick: at, ticksPerSecond: 1_000_000 };
  const held = composeDefenderPhysicalPrimitiveSegment({ ...clock,
    startPosition: { x: pitcher.position.x, y: body.actor.bodyOriginHeightMeters, z: pitcher.position.z }, startVelocity: zero, acceleration: zero },
  { ...clock, role: glove.role, radius: glove.radius, startOffset: glove.offset, offsetVelocity: zero, offsetAcceleration: zero });
  const fixture = f.db.prepare('SELECT venue_id FROM main.official_fixtures WHERE game_id=?').get(f.actor.source.gameId);
  if (!fixture || typeof fixture.venue_id !== 'string') throw new Error('real initial fixture venue missing');
  const venue: AcceptedSamePaInitialVenue = save({ sourceId: label + ':initial-venue', sourceVersion: 'fixture-only-v1',
    capability: 'same_pa_initial_ball_venue_v1', careerId: f.actor.binding.careerId, gameId: f.actor.source.gameId,
    playId: f.actor.match.playId, fixtureEventId: f.actor.binding.fixtureEventId, venueId: fixture.venue_id,
    availableAtDay: f.actor.binding.gameDay, pitcherPlate: inputs.venue.pitcherPlate, rulePolicy: inputs.venue.rulePolicy });
  const setupSource: AcceptedSamePaInitialBallSetup = save({ sourceId: label + ':initial-setup', sourceVersion: 'fixture-only-v1',
    capability: 'same_pa_initial_ball_setup_v1', enrollmentReference: original.enrollmentReference, viewReference: original.viewReference,
    actionReference: f.request.actionReference, postureReference: reference('batting_observation_v1_postures', posture),
    venueReference: originalReference(venue), firstPhysicalPitchSourceId: original.firstPhysicalPitchSourceId, pitcherPlayerId: pitcher.playerId,
    custody: { kind: 'explicit_initial_secure_custody_v1', role: 'glove', ball: { tick: at, position: held.startCenter, velocity: zero, spin: zero } } });
  const initial = track(openSqliteSamePlateAppearanceInitialBallStore(f.path, { readAcceptedSetup: get, readAcceptedVenue: get,
    readAcceptedPlay: get, readAcceptedAssignment: get, readAcceptedOfficialPerson: get }));
  const setup = initial.acceptSetup(setupSource.sourceId);
  if (setup.kind !== 'same_pa_initial_ball_setup_v1') throw new Error('real initial ball setup pending');
  const person = save(inputs.officialPerson);
  const assignment: AcceptedSamePaLiveBallAssignment = save({ sourceId: label + ':initial-assignment', sourceVersion: 'fixture-only-v1',
    capability: 'same_pa_explicit_live_ball_assignment_v1', role: 'plate_umpire', enrollmentReference: original.enrollmentReference,
    gameId: f.actor.source.gameId, playId: f.actor.match.playId, physicalPitchSourceId: original.firstPhysicalPitchSourceId,
    officialId: person.officialId, personId: person.personId, personReference: originalReference(person), policy: inputs.assignmentPolicy });
  const playSource: AcceptedSamePaInitialPlay = save({ sourceId: label + ':initial-play', sourceVersion: 'fixture-only-v1',
    capability: 'same_pa_initial_play_v1', setupReference: reference(initialBallTables.setup, setup), assignmentReference: originalReference(assignment),
    officialId: person.officialId, personId: person.personId, declaration: 'play' });
  const play = initial.acceptPlay(playSource.sourceId);
  if (play.kind !== 'same_pa_initial_play_v1') throw new Error('real initial Play pending');
  return { initial, posture, setup, play, initialPlayReference: reference(initialBallTables.play, play), venue, person, assignment };
};
