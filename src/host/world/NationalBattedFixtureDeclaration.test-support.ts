import assert from 'node:assert/strict';
import { prepareBetweenPlayWorld, type BetweenPlayWorldSetup } from '../../core/adjudication/BetweenPlayWorldReset';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { createPlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { samplePitchTrajectorySegment } from '../../core/sim/pitching/PitchTrajectory';
import { sampleBatterSwingState } from '../../core/sim/contact/BatBallContact';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from '../../core/sim/ball/BallFlight';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { deriveBallWorldFieldTerritory } from '../../core/rules/BallWorldFieldTerritory';
import { createFairTerritoryWedge } from '../../core/sim/ball/FairTerritoryGeometry';
import { composeDefenderPhysicalPrimitiveSegment } from '../../core/sim/fielding/DefenderPhysicalPrimitive';
import { deriveInitialBattedWorldFieldMotion, deriveBattedWorldFieldMotion, createBattedWorldFieldGeometry } from '../../core/sim/ball/BattedWorldFieldMotion';
import { nationalPhysicalPitchCalibration, nationalPhysicalPitchFixtureSource } from './NationalPhysicalPitchCalibration.test-support';
import { resolveContinuousPlayerPitchAgainstBatterFromWorld } from './ContinuousPlayerPitchRuntime';
import { calculateActualFirstBaseFixtureInputs } from './ActualFirstBasePlayEndFixtures.test-support';
import type { AcceptedBattedWorldModel, AcceptedBattedWorldContact } from './SqliteBattedWorldContactStore';
import type { AcceptedBattedContactResponseModel } from './SqliteBattedContactResponseStore';
import type { AcceptedBattedWorldBaseGeometry } from './SqliteBattedWorldBaseGeometryStore';
import type { AcceptedBattedWorldFieldGeometry } from './SqliteBattedWorldFieldStore';
import type { AcceptedPhysicalPitchActionSource } from './SqlitePhysicalPitchProgressStore';
import type { BattedBallContactResponseInput } from '../../core/sim/ball/BattedBallContactResponse';

export type NationalBattedFixtureScope = Readonly<{
  gameId: string; careerId: string; fixtureEventId: string; venueId: string; gameDay: number;
  roster: readonly Readonly<{ playerId: string; personId: string }>[];
  match: CanonicalMatchState; setup: BetweenPlayWorldSetup;
}>;
const roles = ['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const;
const zero = { x: 0, y: 0, z: 0 };
export const nationalBattedFixtureBallParameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, groundRollingDecelerationMps2: 4 };
/** The original W02 TOTAL vector is sorted by player ID; p0 is its zero-effort entry. */
export const nationalFoulTotalEffortUnits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Shared original swing recipe; used by both pure planning and actual pitch admission. */
export const nationalBattedPitchFixtureSource = (recipe: AcceptedPhysicalPitchActionSource,
  timeline: Parameters<typeof resolveContinuousPlayerPitchAgainstBatterFromWorld>[1]['timeline'],
  stores: Parameters<typeof resolveContinuousPlayerPitchAgainstBatterFromWorld>[0],
  actorSourceId: string, kind: 'terminal_foul' | 'first_base', index: number): AcceptedPhysicalPitchActionSource => {
  const physics = { ...recipe.request.delivery.physics, velocity: { x: kind === 'terminal_foul' ? 3 : 0, y: 0, z: -30 } };
  const preview = resolveContinuousPlayerPitchAgainstBatterFromWorld(stores, { ...recipe.request, timeline,
    effortPolicySourceId: recipe.effortPolicy.sourceId,
    delivery: { ...recipe.request.delivery, physics, playId: timeline.playId, pitchIndex: index } });
  const startTick = preview.pitch.trajectory.start.tick + 590_000, ball = samplePitchTrajectorySegment(preview.pitch.trajectory, startTick).position;
  return { ...recipe, battingIntent: { version: 'original_batting_intent_v1', actorSourceId,
    attempt: kind === 'terminal_foul' ? 'bunt' : 'ordinary_swing' },
    request: { ...recipe.request, delivery: { ...recipe.request.delivery, physics }, batter: { action: { kind: 'swing', swing: {
      startTick, endTick: startTick + 10_000, ticksPerSecond: 1_000_000,
      stateAtStart: { pose: { grip: { ...ball, x: ball.x - .4 }, tip: { ...ball, x: ball.x + .4 } }, linearVelocity: zero, angularVelocity: zero },
    } } } } };
};

const plannedPitch = (scope: NationalBattedFixtureScope, kind: 'terminal_foul' | 'first_base', startedAtTick: number) => {
  const c = nationalPhysicalPitchCalibration(), { sourceId: _id, sourceVersion: _v, personLinkSourceId: _link, ...baseline } = c.baseline;
  // This is a prospective numerical scene only. No returned value is supplied to a Native evidence reader.
  const workload = createPlayerWorkloadRecovery(baseline);
  assert.equal(nationalFoulTotalEffortUnits[0], 0, 'next planned pitcher fatigue must reflect the declared original TOTAL');
  const stores = { workload: { selectAtRevision: () => workload }, timing: { selectProfileAtDay: () => c.timingInput.profile },
    release: { selectAtDay: () => ({ ...c.releaseInput, effectiveDay: c.releaseInput.acceptedAtDay }) },
    policies: { readAcceptedPolicy: () => c.response }, effortPolicies: { readAcceptedPolicy: () => c.effort } };
  const match = kind === 'terminal_foul' ? scope.match : { ...scope.match, playId: scope.match.playId + 1, outs: 1 as const };
  let timeline = createCanonicalPlateAppearanceTimeline(match, startedAtTick), index = 0;
  const recipe = () => nationalPhysicalPitchFixtureSource(scope.gameId, scope.gameDay, c.effort, c.response.sourceId, index, timeline.lastEventTick);
  if (kind === 'terminal_foul') for (; index < 2; index++) {
    const source = recipe();
    timeline = resolveContinuousPlayerPitchAgainstBatterFromWorld(stores, { ...source.request, timeline, effortPolicySourceId: c.effort.sourceId,
      delivery: { ...source.request.delivery, playId: match.playId, pitchIndex: index } }).pitch.resolution.timeline;
  }
  const source = nationalBattedPitchFixtureSource(recipe(), timeline, stores, kind === 'terminal_foul' ? 'batter-1' : 'national-live:batter', kind, index);
  const result = resolveContinuousPlayerPitchAgainstBatterFromWorld(stores, { ...source.request, timeline, effortPolicySourceId: c.effort.sourceId,
    delivery: { ...source.request.delivery, playId: match.playId, pitchIndex: index } });
  const physical = result.pitch.resolution;
  if (physical.kind !== 'recorded' || physical.physical.kind !== 'swing' || physical.physical.result.kind !== 'contact'
    || physical.timeline.status.kind !== 'batted_ball_pending' || source.request.batter.action.kind !== 'swing') throw new Error('planned National bat contact missing');
  const flight = createBattedBallFlightEvidence({ contact: physical.physical.result.contact, parameters: nationalBattedFixtureBallParameters, searchDurationTicks: 0 });
  const action = source.request.batter.action;
  return { source, flight, world: prepareBetweenPlayWorld(match, startedAtTick, scope.setup),
    batterPlayerId: kind === 'terminal_foul' ? 'p9' : 'p10',
    swing: sampleBatterSwingState(action.swing.stateAtStart, flight.contact.tick - action.swing.startTick, action.swing.ticksPerSecond) };
};

export const nationalBattedFixtureCommands = (model: AcceptedBattedWorldModel, playerIds: readonly string[], sourceId: string, flightSourceId: string): AcceptedBattedWorldContact => ({
  sourceId, sourceVersion: 'fixture-v1', flightSourceId, modelSourceId: model.sourceId, previousContactSourceId: null,
  commands: playerIds.map(playerId => {
    const actor = model.actors.find(a => a.playerId === playerId);
    if (!actor) throw new Error('planned National active player is missing from the common model');
    return { playerId, bodyAcceleration: zero, primitiveMotions: actor.primitives.map(p => ({ role: p.role, offsetVelocity: zero, offsetAcceleration: zero })) };
  }),
});

export type NationalBattedFixtureDeclaration = Readonly<{
  scope: NationalBattedFixtureScope; model: Extract<AcceptedBattedWorldModel, { kind?: never }>; responseModel: AcceptedBattedContactResponseModel;
  baseSource: AcceptedBattedWorldBaseGeometry; geometrySource: AcceptedBattedWorldFieldGeometry;
}>;
/** Declare the complete game before its first model admission. The first foul now
 * shares the existing first-base glove calibration and 100 MW capture profile.
 * Those prospective input changes are deliberate; old accepted models remain immutable. */
export const declareNationalBattedFixture = (rawScope: NationalBattedFixtureScope): NationalBattedFixtureDeclaration => {
  const scope = structuredClone(rawScope);
  const next = plannedPitch(scope, 'first_base', 0), p = nationalBattedFixtureBallParameters;
  const model: AcceptedBattedWorldModel = { sourceId: 'national-common:world-model', sourceVersion: 'fixture-v1', gameId: scope.gameId,
    careerId: scope.careerId, fixtureEventId: scope.fixtureEventId, venueId: scope.venueId, availableAtDay: 1,
    actors: scope.roster.map(a => ({ ...a, heightMeters: 1.8, bodyOriginHeightMeters: 0, primitives: roles.map(role => ({ role, radius: .05,
      offset: { x: role === 'left_foot' ? -.1 : role === 'right_foot' ? .1 : 0, y: role.endsWith('foot') ? .05 : .9, z: 0 } })) })),
    batterGripOffset: { x: .5, y: .9, z: 0 }, surfaces: [] };
  const active = ['p10', ...scope.setup.defenders.map(d => d.playerId)];
  const calibrated = calculateActualFirstBaseFixtureInputs({ ...next, parameters: p, model,
    commandSource: nationalBattedFixtureCommands(model, active, 'national-live:world-contact', 'national-live:flight'), firstBase: scope.setup.baseCenters.first });
  const material = { restitution: .5, tangentialDamping: .25, spinDamping: .2 };
  const responseModel: AcceptedBattedContactResponseModel = { sourceId: 'national-common:response-model', sourceVersion: 'fixture-v1', gameId: scope.gameId,
    careerId: scope.careerId, fixtureEventId: scope.fixtureEventId, venueId: scope.venueId, availableAtDay: 1,
    actors: calibrated.model.actors.map(a => ({ playerId: a.playerId, personId: a.personId, primitives: a.primitives.map(s => s.role !== 'glove' ? { role: s.role, material } : {
      role: 'glove', pocketCenterOffset: { x: 0, y: 0, z: -.08 }, bodyStability: 1,
      parameters: { ticksPerSecond: p.ticksPerSecond, ballMassKg: .145, ballRadiusMeters: p.ballRadius, pocketRadiusMeters: .2,
        centerRetentionCapacityJ: 1_000_000, captureDissipationPowerW: 100_000_000, failedContactRestitution: material.restitution,
        failedTangentialDamping: material.tangentialDamping, failedSpinDamping: material.spinDamping } } ) })), surfaces: [] };
  const surface = (center: { x: number; z: number }) => ({ region: { center, halfSize: { x: .01, z: .2 }, rotationRadians: 0 }, surfaceHeightMeters: .1 });
  const baseSource: AcceptedBattedWorldBaseGeometry = { sourceId: 'national-foul:bases', sourceVersion: 'synthetic-v1', flightSourceId: 'national-foul:flight',
    geometryRef: 'synthetic-field-contact-v1', availableAtDay: 1, bases: { home: surface({ x: 0, z: 0 }), first: surface(scope.setup.baseCenters.first),
      second: surface(scope.setup.baseCenters.second), third: surface(scope.setup.baseCenters.third) } };
  const bag = { bottomY: 0, material }, geometrySource: AcceptedBattedWorldFieldGeometry = { sourceId: 'national-foul:geometry', sourceVersion: 'synthetic-v1',
    baseGeometrySourceId: baseSource.sourceId, baseModels: { home: bag, first: bag, second: bag, third: bag } };
  return { scope, model: calibrated.model, responseModel, baseSource, geometrySource };
};

/** Small fixture-specific consistency boundary, before either actual scene writes.
 * Checks both complete physical scenes with Core; forecasts never become Native evidence. */
export const checkNationalBattedFixture = (declaration: NationalBattedFixtureDeclaration) => {
  const { scope, model, responseModel, baseSource, geometrySource } = declaration;
  const expectedIds = Array.from({ length: 19 }, (_, i) => `p${i}`).sort();
  assert.deepEqual(scope.roster.map(a => a.playerId).sort(), expectedIds, 'National full eligible roster differs');
  assert.deepEqual(model.actors.map(a => ({ playerId: a.playerId, personId: a.personId })), scope.roster, 'National shared world roster differs');
  assert.deepEqual(responseModel.actors.map(a => ({ playerId: a.playerId, personId: a.personId })), scope.roster, 'National shared response roster differs');
  assert.equal(new Set(scope.roster.map(a => a.personId)).size, 19, 'National Person roster differs');
  for (const m of [model, responseModel]) {
    for (const key of ['gameId', 'careerId', 'fixtureEventId', 'venueId'] as const) assert.equal(m[key], scope[key], 'National immutable model scope differs');
    assert.equal(m.availableAtDay, 1);
  }
  for (const a of responseModel.actors) for (const primitive of a.primitives) if (primitive.role === 'glove') {
    assert.equal(primitive.parameters.captureDissipationPowerW, 100_000_000, 'National common capture calibration differs');
    assert.equal(primitive.parameters.ballRadiusMeters, nationalBattedFixtureBallParameters.ballRadius);
  }
  assert.equal(model.sourceId, 'national-common:world-model'); assert.equal(responseModel.sourceId, 'national-common:response-model');
  assert.equal(baseSource.sourceId, 'national-foul:bases'); assert.equal(baseSource.flightSourceId, 'national-foul:flight');
  assert.equal(geometrySource.sourceId, 'national-foul:geometry'); assert.equal(geometrySource.baseGeometrySourceId, baseSource.sourceId);
  for (const base of ['first', 'second', 'third'] as const) assert.deepEqual(baseSource.bases[base].region.center, scope.setup.baseCenters[base], 'National common base center differs');
  const ray = (v: { x: number; z: number }) => { const n = Math.hypot(v.x, v.z); return { x: v.x / n, z: v.z / n }; };
  const field = createFairTerritoryWedge({ homePlate: { x: 0, z: 0 }, firstBaseLineUnit: ray(scope.setup.baseCenters.first), thirdBaseLineUnit: ray(scope.setup.baseCenters.third) });
  const geometry = createBattedWorldFieldGeometry({ baseGeometry: { field, bases: baseSource.bases }, baseModels: geometrySource.baseModels });
  const scene = (kind: 'terminal_foul' | 'first_base', startedAtTick: number) => {
    const planned = plannedPitch(scope, kind, startedAtTick), { flight, world, swing, batterPlayerId } = planned;
    const at = flight.contact.tick, p = nationalBattedFixtureBallParameters, active = [batterPlayerId, ...scope.setup.defenders.map(d => d.playerId)];
    let source = nationalBattedFixtureCommands(model, active, kind + ':contact', kind + ':flight');
    if (kind === 'first_base') {
      const calibrated = calculateActualFirstBaseFixtureInputs({ ...planned, parameters: p, model, commandSource: source, firstBase: scope.setup.baseCenters.first });
      assert.deepEqual(calibrated.model, model, 'prospective National common calibration differs from planned next play');
      source = calibrated.source;
    }
    const actors = active.flatMap(playerId => {
      const a = model.actors.find(v => v.playerId === playerId)!, command = source.commands.find(c => c.playerId === playerId)!;
      const defender = world.defenders.find(d => d.playerId === playerId);
      const body = { startTick: at, endTick: at, ticksPerSecond: p.ticksPerSecond,
        startPosition: defender ? { ...defender.position, y: a.bodyOriginHeightMeters }
          : { x: swing.pose.grip.x - model.batterGripOffset.x, y: swing.pose.grip.y - model.batterGripOffset.y, z: swing.pose.grip.z - model.batterGripOffset.z },
        startVelocity: defender ? { ...defender.velocity, y: 0 } : swing.linearVelocity, acceleration: command.bodyAcceleration };
      return a.primitives.map(primitive => { const motion = command.primitiveMotions.find(m => m.role === primitive.role)!;
        return { playerId, primitive: composeDefenderPhysicalPrimitiveSegment(body, { ...motion, radius: primitive.radius,
          startTick: at, endTick: at, ticksPerSecond: p.ticksPerSecond, startOffset: primitive.offset }) }; });
    });
    const response: BattedBallContactResponseInput = { world: { flight, parameters: p, throughTick: at, actors, surfaces: model.surfaces },
      actors: responseModel.actors.filter(a => active.includes(a.playerId)).flatMap(a => a.primitives.map(profile => ({ playerId: a.playerId, profile }))), surfaces: responseModel.surfaces };
    const commands = source.commands.map(c => ({ playerId: c.playerId, bodyAcceleration: c.bodyAcceleration,
      primitiveMotions: c.primitiveMotions.map(m => ({ role: m.role, offsetAcceleration: m.offsetAcceleration })) }));
    const coreCommands = commands.flatMap(c => c.primitiveMotions.map(m => ({ playerId: c.playerId, role: m.role,
      acceleration: { x: c.bodyAcceleration.x + m.offsetAcceleration.x, y: c.bodyAcceleration.y + m.offsetAcceleration.y, z: c.bodyAcceleration.z + m.offsetAcceleration.z } })));
    let current = deriveInitialBattedWorldFieldMotion({ response, geometry, availableAtTick: at, throughTick: at + 2_000_000, commands: coreCommands });
    const history = [current];
    assert.equal(current.motion.world.kind, 'boundary');
    if (current.motion.world.kind !== 'boundary') throw new Error('planned National first ground missing');
    assert.deepEqual(current.motion.world.contacts.map(c => c.kind), ['ground'], 'planned National ground must precede actor contact');
    for (let i = 0; i < 32 && current.motion.response.kind !== 'capture_candidate'
      && !(current.motion.world.kind === 'boundary' && current.motion.world.contacts.some(c => c.kind === 'rolling_stop')); i++) {
      assert.ok(current.motion.cursor, 'planned National unresolved contact');
      current = deriveBattedWorldFieldMotion({ response, geometry, availableAtTick: at, throughTick: at + (kind === 'terminal_foul' ? 100_000_000 : 2_000_000),
        commands: coreCommands, cursor: current.motion.cursor, actors: current.motion.actors, carrierPlayerId: current.motion.carrierPlayerId });
      history.push(current);
    }
    if (kind === 'terminal_foul') {
      assert.equal(current.motion.world.kind, 'boundary');
      if (current.motion.world.kind !== 'boundary') throw new Error('planned National foul stop missing');
      assert.deepEqual(current.motion.world.contacts.map(c => c.kind), ['rolling_stop'], 'common model interrupts the original foul stop');
      const territory = deriveBallWorldFieldTerritory({ evidence: { batterRunnerId: batterPlayerId,
        defenderIds: scope.setup.defenders.map(d => d.playerId), field, bases: geometry.baseGeometry.gates, ballRadiusMeters: p.ballRadius,
        originTick: at, ticksPerSecond: p.ticksPerSecond, horizon: current.motion.world.moment, acquisitions: [],
        contacts: history.flatMap(h => h.motion.world.kind === 'boundary' ? [{ moment: h.motion.world.moment,
          contacts: h.motion.world.contacts.map(c => c.kind === 'actor' ? { kind: c.kind, playerId: c.playerId, role: c.role }
            : c.kind === 'surface' ? { kind: c.kind, surfaceId: c.surfaceId } : { kind: c.kind }) }] : []) },
        baseContacts: history.flatMap(h => h.baseContacts) });
      assert.deepEqual({ kind: territory.kind, ...('territory' in territory ? { territory: territory.territory, basis: territory.basis } : {}) },
        { kind: 'resolved', territory: 'foul', basis: 'settling' }, 'common model changes the original foul rule scene');
    } else assert.equal(current.motion.response.kind, 'capture_candidate', 'common model has no original first-base capture');
    return { kind, contactTick: at, history, commands: source.commands };
  };
  return { foul: scene('terminal_foul', 0), firstBase: scene('first_base', 0), translatedFirstBase: scene('first_base', 36_354_083) };
};
