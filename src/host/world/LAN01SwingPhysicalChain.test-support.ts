import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { createDefensiveRatings } from '../../core/model/DefensiveRatings';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import type { BattedActorResponseProfile, BattedBallContactResponseInput } from '../../core/sim/ball/BattedBallContactResponse';
import { createBattedWorldFieldGeometry, deriveBattedWorldFieldMotionAdoption,
  advanceBattedWorldFieldMotionCheckpoint } from '../../core/sim/ball/BattedWorldFieldMotion';
import { prepareBattedWorldScheduledFieldAcquisition } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import { createFairTerritoryWedge } from '../../core/sim/ball/FairTerritoryGeometry';
import { shiftSwingKinematicsTrajectoryV1 } from '../../core/sim/contact/SwingKinematicsV1';
import { NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1 } from '../../core/sim/contact/WoodBatProductionProfileV1';
import { resolveWoodBatSpeedResponse } from '../../core/sim/contact/WoodBatSpeedResponseProfile';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { planAerodynamicCourseAwareSwingV1 } from '../../core/sim/pitching/AerodynamicCourseAwareSwingV1';
import type { AerodynamicPitchTrajectory } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { resolveAndRecordAerodynamicRigidPitchAgainstBatter } from '../../core/sim/pitching/AerodynamicRigidPitchAgainstBatter';
import { createRigidBatSwingWindowFromKinematicsV1 } from '../../core/sim/pitching/AerodynamicRigidBatSwingingPitchPhysicalResult';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { fixture as battingFixture } from '../../core/world/psychology/batting/BattingFixtures.test-support';
import { assertSwingSpeedEnvelope } from '../../core/world/psychology/batting/BattingSpeedEnvelope';
import { resolveMotorStart, selectPredictionAt } from '../../core/world/psychology/batting/BattingTiming';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep,
  SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import { liveAppealSceneFixture } from './SamePlateAppearanceLiveAppealScene.test-support';
import { deriveSamePaPhysicalFieldCapture } from './SamePlateAppearancePhysicalFieldCapture';
import { deriveSamePaPhysicalThrowPlan, deriveSamePaPhysicalThrowCheckpoint } from './SamePlateAppearancePhysicalFieldThrow';
import { deriveSamePaLiveAppealIndication, bindSamePaAppealThrow, deriveSamePaLiveAppealContact } from './SamePlateAppearanceLiveAppeal';
import { deriveSamePaFieldRuleEvidence } from './SamePlateAppearanceFieldRuleEvidence';
import { deriveSamePaStationaryOccupiedRunners, type SamePaStationaryHoldBasis } from './SamePlateAppearanceStationaryOccupiedRunners';
import { deriveSamePaFairCatchRuleBasis } from './SamePlateAppearanceFairCatchRuleBasis';
import { lan01SwingCalibration } from './LAN01SwingCalibration.test-support';

type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
const v = (x: number, y: number, z: number) => ({ x, y, z });
const fixtureReference = <Owner extends string>(owner: Owner, sourceId: string): SamePaReference<Owner> =>
  ({ owner, sourceId, sourceHash: hash(sourceId), snapshotHash: hash(['synthetic', sourceId]) });
const fieldReference = (f: Field) => reference(f.kind === 'same_pa_physical_field_root_v1'
  ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
const member = (playerId: string) => ({ playerId, bindingHash: hash(playerId), personHash: hash(playerId),
  baselineSourceId: playerId, reservedRevision: 0, reservedStateHash: hash(playerId), projectedStateHash: hash(playerId) });

/** Public synthetic declarations, not a retained frame or an owner receipt.
 * The observer sample is declared separately from the actual pitch. The pure
 * planner uses it with the original decision/motor gates and equipment; all
 * contact, ball motion, capture and throw results are calculated by Core. */
export const lan01SwingPhysicalFixture = (mode: 'original' | 'calibrated') => {
  const scene = liveAppealSceneFixture(), nominal = dispatchCalibrationValues(), equipment = battingFixture().source;
  const pitchParameters = { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81,
    aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS };
  const actualTrajectory: AerodynamicPitchTrajectory = { start: { tick: 102_464_647,
    position: v(0.08000000000000002, 1.52, 17.84), velocity: v(0, 2.4499999999999997, -28), spin: v(0, 0, 0) },
    endTick: 103_964_647, parameters: pitchParameters };
  const observedTrajectory: AerodynamicPitchTrajectory = { start: { tick: 102_514_647,
    position: v(0.08000000000000002, 1.6297407787435305, 16.446082327461387),
    velocity: v(0, 1.940402114481132, -27.75746585754014), spin: v(0, 0, 0) },
    endTick: 103_314_647, parameters: pitchParameters };
  const roles = [
    { role: 'body' as const, radius: 0.2, offset: v(0, 0, 0) },
    { role: 'glove' as const, radius: 0.08, offset: v(0.3, 0.15, 0.1) },
    { role: 'tag_hand' as const, radius: 0.06, offset: v(-0.3, 0.1, 0.1) },
    { role: 'left_foot' as const, radius: 0.07, offset: v(-0.1, -0.88, 0) },
    { role: 'right_foot' as const, radius: 0.07, offset: v(0.1, -0.88, 0) },
  ];
  const defenderIds = ['p2', ...Array.from({ length: 8 }, (_, i) => 'home-' + (i + 1))];
  const bodies = ['away-2', ...defenderIds, 'away-1'].map(playerId => ({ playerId,
    center: playerId === 'away-2' ? v(-0.78, 1, -0.16) : playerId === 'p2' ? v(0, 0.95, 0)
      : playerId === 'away-1' ? v(1, 0.95, 1) : v(Number(playerId.slice(5)), 0.95, Number(playerId.slice(5))),
    primitives: roles.map(p => ({ ...p, offset: p.role === 'glove' && playerId === 'p2' ? scene.throwScene.gloveOffsets.p2
      : p.role === 'glove' && playerId === 'home-1' ? scene.throwScene.gloveOffsets['home-1'] : p.offset })) }));
  const fieldParameters = { ticksPerSecond: 1_000_000, gravityY: -9.81, ballRadius: 0.0366,
    groundRestitution: 0.35, groundFriction: 0.78, groundRollingDecelerationMps2: 4, integrationStepTicks: 2_000, restingVerticalSpeed: 0.5 };
  const material = { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.2 };
  const gloveProfile: BattedActorResponseProfile = { role: 'glove', pocketCenterOffset: v(0, 0, -0.08), bodyStability: 1,
    parameters: { ticksPerSecond: 1_000_000, ballMassKg: 0.145, ballRadiusMeters: 0.0366, pocketRadiusMeters: 0.2,
      centerRetentionCapacityJ: 1_000_000, captureDissipationPowerW: 1000,
      failedContactRestitution: 0.5, failedTangentialDamping: 0.25, failedSpinDamping: 0.2 } };
  const ratings = createDefensiveRatings({ positionSuitability: { P: .5, C: .5, '1B': .5, '2B': .5, '3B': .5, SS: .5, LF: .5, CF: .5, RF: .5 },
    firstStep: .5, acceleration: .5, battedBallRead: .5, routeEfficiency: .5, catching: .5, transfer: .5,
    armStrength: .5, throwingAccuracy: .5, situationalAwareness: .5, tagSkill: .5 });
  const inputs = { actualTrajectory, predictions: [{ predictionId: 'synthetic-lan-observation', observedTick: 102_514_647,
    availableTick: 102_524_647, validUntilTick: 103_314_647, trajectory: observedTrajectory }], decisionTick: 102_524_667,
    decision: nominal.batter_decision, motor: nominal.batter_motor, bodyReadyTick: 91_694_321, latestMotorStartTick: 103_464_647,
    repertoire: mode === 'original' ? nominal.batter_swing : lan01SwingCalibration().values,
    handedness: 'R' as const, centerOfMass: v(-0.78, 1, -0.16), batPhysical: equipment.batPhysical, ball: equipment.ball,
    plateZ: 0, strikeZone: { centerX: 0, halfWidth: .2, lowerY: 1.4, upperY: 1.8 },
    bodies, coverageThroughTick: 111_694_321, fieldParameters, material, gloveProfile, ratings,
    baseCenters: scene.originalBaseCenters, bags: scene.bags, throwValues: scene.throwScene.values, matchSeed: 19 };
  const prediction = selectPredictionAt(inputs.predictions, inputs.decisionTick);
  if (!prediction || prediction.validUntilTick < inputs.decisionTick) throw new Error('LAN observer unavailable');
  const planned = planAerodynamicCourseAwareSwingV1({ predictedTrajectory: prediction.trajectory,
    plateZ: inputs.plateZ, strikeZone: inputs.strikeZone, handedness: inputs.handedness, batterCenterOfMass: inputs.centerOfMass,
    physical: inputs.batPhysical, profile: inputs.repertoire.profiles[0].profile });
  if (!planned) throw new Error('LAN observer cannot plan swing');
  const preferred = shiftSwingKinematicsTrajectoryV1(planned.swingPlan.trajectory, inputs.motor.technicalTimingOffsetTicks);
  const motorStart = resolveMotorStart(preferred.startTick, inputs.decisionTick, inputs.bodyReadyTick, inputs.motor.motorLatencyTicks);
  if (motorStart > inputs.latestMotorStartTick) throw new Error('LAN motor window missed');
  const motorDelayTicks = motorStart - preferred.startTick;
  const trajectory = shiftSwingKinematicsTrajectoryV1(preferred, motorDelayTicks);
  assertSwingSpeedEnvelope(trajectory, inputs.motor.maximumSweetSpotSpeedMps);
  const match: CanonicalMatchState = { ruleProfileId: NPB_2026_RULE_PROFILE.id, playId: 8, inning: 1, half: 'top',
    outs: 0, balls: 0, strikes: 0, bases: { first: 'away-1', second: null, third: null }, score: { away: 0, home: 0 } };
  // The reserved match still has its original count; two prior takes put the
  // current pitch timeline at 0–2. This fixture starts directly at that count.
  const resolution = resolveAndRecordAerodynamicRigidPitchAgainstBatter(
    createCanonicalPlateAppearanceTimeline({ ...match, strikes: 2 }, actualTrajectory.start.tick), {
      action: { kind: 'swing', swing: createRigidBatSwingWindowFromKinematicsV1(trajectory, inputs.batPhysical) },
      trajectory: actualTrajectory, ball: inputs.ball,
      parameterResolver: k => resolveWoodBatSpeedResponse(NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1, k.normalApproachSpeedMps),
    });
  const contactEvent = resolution.timeline.events.at(-1);
  if (contactEvent?.kind !== 'BatBallContact') throw new Error('LAN swing did not make contact');
  const contact = contactEvent.payload.contact, start = contact.tick;
  const actors = bodies.flatMap(body => body.primitives.map(p => ({ playerId: body.playerId, primitive: {
    role: p.role, radius: p.radius, startTick: start, endTick: inputs.coverageThroughTick, ticksPerSecond: 1_000_000,
    startCenter: v(body.center.x + p.offset.x, body.center.y + p.offset.y, body.center.z + p.offset.z),
    startVelocity: v(0, 0, 0), acceleration: v(0, 0, 0) } })));
  const response: BattedBallContactResponseInput = { world: { flight: createBattedBallFlightEvidence({ contact,
    searchDurationTicks: 0, parameters: fieldParameters }), parameters: fieldParameters, actors, surfaces: [], throughTick: start },
    actors: actors.map(a => ({ playerId: a.playerId, profile: a.primitive.role === 'glove' ? gloveProfile : { role: a.primitive.role, material } })), surfaces: [] };
  const ray = (p: { x: number; z: number }) => ({ x: p.x / Math.hypot(p.x, p.z), z: p.z / Math.hypot(p.x, p.z) });
  const field = createFairTerritoryWedge({ homePlate: { x: 0, z: 0 }, firstBaseLineUnit: ray(inputs.baseCenters.first), thirdBaseLineUnit: ray(inputs.baseCenters.third) });
  const bag = (center: { x: number; z: number }) => ({ region: { center, halfSize: inputs.bags.halfSize, rotationRadians: 0 }, surfaceHeightMeters: inputs.bags.surfaceHeightMeters });
  const baseModel = { bottomY: 0, material };
  const geometry = createBattedWorldFieldGeometry({ baseGeometry: { field, bases: { home: bag(field.homePlate),
    first: bag(inputs.baseCenters.first), second: bag(inputs.baseCenters.second), third: bag(inputs.baseCenters.third) } },
    baseModels: { home: baseModel, first: baseModel, second: baseModel, third: baseModel } });
  const adopted = deriveBattedWorldFieldMotionAdoption({ response, geometry, actors, carrierPlayerId: null,
    cursor: { moment: { originTick: start, elapsedSeconds: 0, ball: response.world.flight.initialBall }, previousContacts: [] },
    availableAtTick: start, coverageThroughTick: inputs.coverageThroughTick,
    commands: actors.map(a => ({ playerId: a.playerId, role: a.primitive.role, acceleration: a.primitive.acceleration })) });
  const viewReference = fixtureReference('pa_lifecycle_v1_execution_views', 'lan01:synthetic:view');
  const launchReference = fixtureReference('pa_physical_v1_launches', 'lan01:synthetic:pitch');
  const enrollmentReference = fixtureReference('same_pa_enrollments', 'lan01:synthetic:enrollment');
  // Structural host projection inputs only. No Native owner or SQLite store is
  // opened, and these references never purport to authenticate accepted work.
  const root: SamePaPhysicalFieldRoot = { kind: 'same_pa_physical_field_root_v1', stage: 'field',
    source: { sourceId: 'lan01:synthetic:field-root', sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_field_root_v1',
      viewReference, launchReference, previousOperationReference: fixtureReference('pa_physical_v1_resolutions', 'lan01:synthetic:resolution'),
      resolutionReference: fixtureReference('pa_physical_v1_resolutions', 'lan01:synthetic:resolution'),
      postureReference: fixtureReference('batting_observation_v1_postures', 'lan01:synthetic:posture'),
      fieldInputs: { kind: 'fresh_physical_field_calibration_v1', calibrationReference: fixtureReference('pa_physical_v1_field_calibrations', 'lan01:synthetic:field-calibration') },
      parameters: fieldParameters, throughTick: start, commands: bodies.map(b => ({ playerId: b.playerId, bodyAcceleration: v(0, 0, 0),
        primitiveMotions: b.primitives.map(p => ({ role: p.role, offsetVelocity: v(0, 0, 0), offsetAcceleration: v(0, 0, 0) })) })) },
    lineage: { enrollmentReference, actorReference: fixtureReference('physical_plate_appearance_actors', 'lan01:synthetic:actor'),
      careerId: 'synthetic-career', gameId: 'synthetic-game', playId: match.playId, firstPhysicalPitchSourceId: launchReference.sourceId, participantReferences: [] },
    physicalPitchSourceId: launchReference.sourceId, pitchOrdinal: 3, operationOrdinal: 1, evaluationTick: start, viewReference,
    timeline: resolution.timeline, response, geometry, field: adopted, geometryBindingHash: hash(geometry) };
  const fields: Field[] = [root];
  const source = (action?: SamePaPhysicalFieldStepSource['action'], throughTick = fields.at(-1)!.evaluationTick,
    sourceId = 'lan01:synthetic:step' + fields.length): SamePaPhysicalFieldStepSource => ({ sourceId, sourceVersion: 'fixture-only-v1',
    capability: 'same_pa_physical_field_step_v1', viewReference, launchReference,
    previousOperationReference: fieldReference(fields.at(-1)!), previousFieldReference: fieldReference(fields.at(-1)!),
    fieldRootReference: reference('pa_physical_v1_field_roots', root), throughTick, ...(action ? { action } : {}) });
  const append = (s: SamePaPhysicalFieldStepSource, value: Pick<SamePaPhysicalFieldStep, 'field' | 'evaluationTick'> & Partial<Pick<SamePaPhysicalFieldStep, 'actionResult'>>) => {
    const step: SamePaPhysicalFieldStep = { kind: 'same_pa_physical_field_step_v1', stage: 'field', source: s,
      lineage: root.lineage, physicalPitchSourceId: root.physicalPitchSourceId, pitchOrdinal: root.pitchOrdinal,
      operationOrdinal: fields.at(-1)!.operationOrdinal + 1, viewReference, timeline: root.timeline, ...value };
    fields.push(step); return step;
  };
  if (!adopted.motion.cursor) throw new Error('LAN initial field has an unresolved contact');
  const initialStepSource = source(undefined, start + 2_000_000);
  const firstField = advanceBattedWorldFieldMotionCheckpoint({ response, geometry, actors: adopted.motion.actors,
    cursor: adopted.motion.cursor, carrierPlayerId: null, checkpointThroughTick: initialStepSource.throughTick });
  const first = append(initialStepSource, { field: firstField, evaluationTick: firstField.motion.world.moment.ball.tick });
  const runner = bodies.find(b => b.playerId === 'away-1')!;
  const hold: SamePaStationaryHoldBasis = { source: { sourceId: 'lan01:synthetic:original-hold', sourceVersion: 'fixture-only-v1',
    playerId: runner.playerId, enrollmentReference, coverageThroughTick: inputs.coverageThroughTick }, startingBase: 1,
    setup: { position: { x: runner.center.x, z: runner.center.z } }, body: { actor: { bodyOriginHeightMeters: runner.center.y, primitives: runner.primitives } } };
  return { inputs, motorDelayTicks, match, defenderIds, root, first, fields, source, append, hold };
};

/** One finite original-geometry chain; no alternative poses or result injection. */
export const continueLAN01SwingPhysicalChain = (h: ReturnType<typeof lan01SwingPhysicalFixture>) => {
  const { root, inputs } = h;
  const capture = () => {
    const previous = h.fields.at(-1)!;
    const plan = prepareBattedWorldScheduledFieldAcquisition({ response: root.response, geometry: root.geometry, field: previous.field });
    const s = h.source({ kind: 'capture_checkpoint_v1', candidateReference: fieldReference(previous), throughElapsedSeconds: plan.fenceElapsedSeconds }, plan.candidateSecureTick);
    return h.append(s, deriveSamePaPhysicalFieldCapture(s, root, previous, previous));
  };
  const secured = capture(), thrower = member('p2');
  const indicationSource = h.source({ kind: 'appeal_indication_v1', member: thrower, defenderId: 'home-1', runnerId: 'away-1', base: 'first', contact: 'base' });
  const indicated = h.append(indicationSource, { field: secured.field, evaluationTick: secured.evaluationTick,
    actionResult: deriveSamePaLiveAppealIndication(indicationSource, root, secured, h.match, h.defenderIds) });
  const planSource = h.source({ kind: 'throw_plan_v1', member: thrower,
    calibrationReference: fixtureReference('pa_lifecycle_v1_execution_calibrations', 'lan01:synthetic:throw-calibration'),
    receiverPlayerId: 'home-1', coverageThroughTick: inputs.coverageThroughTick,
    appealIndicationReference: reference('pa_physical_v1_field_steps', indicated) }, indicated.evaluationTick, 'lan01:appeal-throw:3');
  const boundIndication = bindSamePaAppealThrow(planSource, h.fields);
  // These are the minimal read-only action/model views consumed by the pure
  // throw adapter, following LAP02. They are never admitted by a Native writer.
  const defenders = h.defenderIds.map(playerId => ({ playerId }));
  const action = { physicalPitchSourceId: root.physicalPitchSourceId, source: { nominalPitch: { delivery: { matchSeed: inputs.matchSeed } } },
    actor: { binding: { playerId: 'away-2' }, match: h.match, defenderBindings: defenders,
      world: { defenders, runners: [{ playerId: h.hold.source.playerId }] } } };
  const model = { source: { playerId: 'p2', ratings: inputs.ratings } };
  const planned = h.append(planSource, deriveSamePaPhysicalThrowPlan(planSource, root, indicated, action, model, inputs.throwValues));
  if (planned.actionResult?.kind !== 'throw_plan_v1') throw new Error('LAN throw plan missing');
  const plan = planned.actionResult.plan;
  const checkpoint = (throughElapsedSeconds: number) => {
    const s = h.source({ kind: 'throw_checkpoint_v1', planReference: reference('pa_physical_v1_field_steps', planned), throughElapsedSeconds },
      quantizeEventTick(root.evaluationTick, throughElapsedSeconds, inputs.fieldParameters.ticksPerSecond));
    return h.append(s, deriveSamePaPhysicalThrowCheckpoint(s, root, h.fields.at(-1)!, h.fields));
  };
  const transfer = checkpoint((plan.input.cursor.moment.elapsedSeconds + plan.releaseElapsedSeconds) / 2);
  const released = checkpoint(plan.releaseElapsedSeconds), motion = released.field.motion;
  if (!motion.cursor) throw new Error('LAN released cursor missing');
  const receptionSource = h.source(undefined, released.evaluationTick + 100_000);
  const receptionField = advanceBattedWorldFieldMotionCheckpoint({ response: root.response, geometry: root.geometry,
    actors: motion.actors, cursor: motion.cursor, carrierPlayerId: null, checkpointThroughTick: receptionSource.throughTick });
  const reception = h.append(receptionSource, { field: receptionField, evaluationTick: receptionField.motion.world.moment.ball.tick });
  const received = capture();
  const appealSource = h.source({ kind: 'appeal_contact_v1', indicationReference: reference('pa_physical_v1_field_steps', indicated),
    throwPlanReference: reference('pa_physical_v1_field_steps', planned) });
  const appeal = deriveSamePaLiveAppealContact(appealSource, root, received, h.fields, h.match, h.defenderIds, 'away-2');
  h.append(appealSource, { field: received.field, evaluationTick: received.evaluationTick, actionResult: appeal });
  const evidence = deriveSamePaFieldRuleEvidence({ fields: h.fields, batterRunnerId: 'away-2', defenderIds: h.defenderIds,
    occupiedRunnerIds: ['away-1'], outsAtStart: h.match.outs });
  const occupiedRunners = deriveSamePaStationaryOccupiedRunners({ match: h.match, root, holds: [h.hold], evidence });
  if (occupiedRunners.kind !== 'same_pa_stationary_occupied_runners_v1') throw new Error('LAN original stationary hold proof missing');
  const fairCatch = deriveSamePaFairCatchRuleBasis({ originalMatch: h.match, originalTimeline: root.timeline, evidence, occupiedRunners });
  return { secured, boundIndication, transfer, released, reception, received, appeal, evidence, occupiedRunners, fairCatch };
};
