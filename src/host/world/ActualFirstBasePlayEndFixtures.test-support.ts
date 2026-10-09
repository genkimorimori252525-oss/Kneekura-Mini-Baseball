import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { sampleBatterSwingState } from '../../core/sim/contact/BatBallContact';
import { projectDefenderBodyKinematicsSegment, sampleDefenderBodyKinematicsSegment } from '../../core/sim/fielding/DefenderBodyKinematics';
import { firstBaseFixtureFootAcceleration } from './ActualFirstBaseFixtureCalibration.test-support';
import { openSqliteActualLivePlayRuntimeStore } from './SqliteActualLivePlayRuntimeStore';
import { openSqliteBattedWorldFieldExecutionStore, battedWorldFieldExecutionEvidenceFromSqlite,
  type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { ownedMotionKnownWorkFromSqlite } from './OwnedMotionKnownWorkFromSqlite';
import type { OwnedMotionV2Action } from './OwnedScheduledBattedWorldMotion';
import { installOwnedScheduledDecision } from './OwnedScheduledMotionDecisionFixtures.test-support';
import { ownedScheduledMotionPhase as phase } from './OwnedScheduledMotionTiming.test-support';

type FirstBaseFieldRoot = ReturnType<typeof battedWorldFieldFixture>;
type FirstBaseWorldRoot = Parameters<NonNullable<NonNullable<Parameters<typeof battedWorldFieldFixture>[4]>['world']>>[0];
export type ActualFirstBaseWorldInputs = Pick<FirstBaseWorldRoot, 'flight' | 'model' | 'models' | 'source' | 'sources'>;
export type ActualFirstBaseFieldRoot = Pick<FirstBaseFieldRoot, 'worldContact' | 'flight' | 'response' | 'source' | 'sources' | 'fields'> &
  Readonly<{ f: Pick<FirstBaseFieldRoot['f'], 'path' | 'db' | 'track' | 'close'> }>;

/** Forecast calibration is accepted before the original contact Source. The
 * registered pitcher identity comes from the original frame, including National roots. */
export const calibrateActualFirstBaseWorldInputs = (world: ActualFirstBaseWorldInputs,
  acceptedFirstBase?: Readonly<{ x: number; z: number }>): number => {
  const flight = world.flight, p = flight.source.execution.ballFlightParameters, frame = flight.physicalPitch.frame;
  const predicted = createBattedBallFlightEvidence({ contact: flight.flight.contact, parameters: p, searchDurationTicks: 2_000_000 });
  const ground = predicted.firstGroundContact;
  if (!ground) throw new Error('explicit first-base fixture forecast has no ground contact');
  const forecastGroundElapsedSeconds = (ground.tick - flight.flight.initialBall.tick) / p.ticksPerSecond;
  const originalModel = world.models.get(world.model.sourceId)!, pitcher = frame.world.defenders.find(d => d.registeredPosition === 'P')!;
  const dt = (ground.tick - frame.world.tick) / p.ticksPerSecond;
  const model = { ...originalModel, actors: originalModel.actors.map(actor => actor.playerId !== pitcher.playerId ? actor : { ...actor,
    primitives: actor.primitives.map(primitive => primitive.role !== 'glove' ? primitive : { ...primitive, offset: {
      x: ground.state.position.x - pitcher.position.x - pitcher.velocity.x * dt, y: p.ballRadius + 0.02,
      z: ground.state.position.z + 0.12 - pitcher.position.z - pitcher.velocity.z * dt,
    } }) }) };
  world.models.set(model.sourceId, model);
  const at = flight.flight.contact.tick, batter = frame.batterActor!, action = flight.physicalPitch.source.request.batter.action;
  if (action.kind !== 'swing') throw new Error('original first-base fixture swing missing');
  const swing = sampleBatterSwingState(action.swing.stateAtStart, at - action.swing.startTick, action.swing.ticksPerSecond);
  const bag = acceptedFirstBase ?? frame.initialWorld?.source.worldSetup.baseCenters.first;
  if (!bag) throw new Error('first-base calibration requires the original accepted base center');
  const source = world.sources.get(world.source.sourceId)!;
  world.sources.set(source.sourceId, { ...source, commands: source.commands.map(command => {
    if (command.playerId !== pitcher.playerId && command.playerId !== batter.binding.playerId) return command;
    const actor = model.actors.find(a => a.playerId === command.playerId)!, foot = actor.primitives.find(p => p.role === 'left_foot')!;
    const motor = command.primitiveMotions.find(p => p.role === 'left_foot')!;
    const defender = frame.world.defenders.find(d => d.playerId === command.playerId);
    const body = defender ? sampleDefenderBodyKinematicsSegment(projectDefenderBodyKinematicsSegment({ startTick: frame.world.tick,
      endTick: at, ticksPerSecond: p.ticksPerSecond, startPosition: defender.position, startVelocity: defender.velocity,
      acceleration: { x: command.bodyAcceleration.x, z: command.bodyAcceleration.z }, target: null }, actor.bodyOriginHeightMeters), at)
      : { position: { x: swing.pose.grip.x - model.batterGripOffset.x, y: swing.pose.grip.y - model.batterGripOffset.y,
        z: swing.pose.grip.z - model.batterGripOffset.z }, velocity: swing.linearVelocity };
    const position = { x: body.position.x + foot.offset.x, y: body.position.y + foot.offset.y, z: body.position.z + foot.offset.z };
    const velocity = { x: body.velocity.x + motor.offsetVelocity.x, y: body.velocity.y + motor.offsetVelocity.y, z: body.velocity.z + motor.offsetVelocity.z };
    const seconds = forecastGroundElapsedSeconds + (command.playerId === pitcher.playerId ? 0.24 : 0.28);
    const acceleration = firstBaseFixtureFootAcceleration(position, velocity, command.bodyAcceleration, { ...bag, y: 0.1 }, seconds);
    return { ...command, primitiveMotions: command.primitiveMotions.map(m => m.role !== 'left_foot' ? m : { ...m, offsetAcceleration: acceleration }) };
  }) });
  return forecastGroundElapsedSeconds;
};

export const calibrateActualFirstBaseCaptureResponse = (value: Pick<FirstBaseFieldRoot, 'responseModel' | 'responseModels'>): void => {
  value.responseModels.set(value.responseModel.sourceId, { ...value.responseModel,
    actors: value.responseModel.actors.map(actor => ({ ...actor, primitives: actor.primitives.map(profile => profile.role !== 'glove' ? profile
      : { ...profile, parameters: { ...profile.parameters, captureDissipationPowerW: 100_000_000 } }) })) });
};

/** Accepted fixture inputs, never injected outcomes. The actual ground,
 * contact, capture, foot histories and rule remain owner outputs. */
export const actualFirstBasePlayEndFixture = (path: string, originalProfile?: NonNullable<Parameters<typeof battedWorldFieldFixture>[4]>['originalProfile']) => {
  let forecastGroundElapsedSeconds = NaN;
  const x = phase('first-base:original-pitch-and-inputs', () => battedWorldFieldFixture(path, true, false, undefined, {
    originalProfile,
    world(world) { forecastGroundElapsedSeconds = calibrateActualFirstBaseWorldInputs(world); },
    response: calibrateActualFirstBaseCaptureResponse,
  }));
  return attachActualFirstBasePlayEndFixture(path, x, forecastGroundElapsedSeconds);
};

/** Attach the original all-ten owner chain before its first field output. The
 * caller supplies its independently accepted original response and field inputs. */
export const attachActualFirstBasePlayEndFixture = <T extends ActualFirstBaseFieldRoot>(
  path: string, x: T, forecastGroundElapsedSeconds: number,
) => {
  try {
    if (x.worldContact.result.kind !== 'airborne' || x.flight.source.searchDurationTicks !== 0) throw new Error('original zero-horizon fixture input changed');
    const pitchId = x.response.touch.worldContact.flight.source.physicalPitchSourceId;
    const runtimeSource = { sourceId: 'live-play-runtime', sourceVersion: 'fixture-v1',
      capability: 'causal_original_live_play_runtime_v1' as const, physicalPitchSourceId: pitchId };
    const runtime = phase('first-base:register-original-runtime', () => x.f.track(openSqliteActualLivePlayRuntimeStore(path,
      { readAcceptedRuntime: id => id === runtimeSource.sourceId ? runtimeSource : null })).accept(runtimeSource.sourceId));
    const firstField = phase('first-base:actual-ground', () => x.fields.accept(x.source.sourceId));
    if (firstField.field.motion.world.kind !== 'boundary' || !firstField.field.motion.world.contacts.some(c => c.kind === 'ground')) {
      throw new Error('first-base fixture did not reach actual ground before fielder contact');
    }
    let baseField = firstField;
    for (let index = 0; index < 12 && baseField.field.motion.response.kind !== 'capture_candidate'; index++) {
      const source = { ...x.source, sourceId: `field-race-candidate-${index}`, previousFieldSourceId: baseField.source.sourceId };
      x.sources.set(source.sourceId, source); baseField = phase(`first-base:actual-contact-${index}`, () => x.fields.accept(source.sourceId));
    }
    if (baseField.field.motion.response.kind !== 'capture_candidate') throw new Error('first-base fixture has no actual capture candidate');
    const playerIds = x.source.commands.map(c => c.playerId), tps = x.response.touch.worldContact.flight.source.execution.ballFlightParameters.ticksPerSecond;
    const origin = x.response.touch.worldContact.flight.flight.initialBall.tick;
    const sources = new Map<string, AcceptedBattedWorldFieldExecution>();
    const authority = { readAcceptedExecution: (id: string) => sources.get(id) ?? null };
    const executions = x.f.track(openSqliteBattedWorldFieldExecutionStore(path, x.fields, authority));
    const prefix = (through: string | null) => ({ baseField, fields: battedWorldFieldEvidenceFromSqlite(x.f.db).scope(baseField, baseField.source.sourceId),
      executions: battedWorldFieldExecutionEvidenceFromSqlite(x.f.db).scope(baseField, through) });
    const knownWork = () => ownedMotionKnownWorkFromSqlite(x.f.db, pitchId, playerIds);
    const accept = (sourceId: string, previousExecutionSourceId: string | null, action: AcceptedBattedWorldFieldExecution['action']) => {
      const source = { sourceId, sourceVersion: 'fixture-v1', baseFieldSourceId: baseField.source.sourceId, previousExecutionSourceId, action };
      sources.set(sourceId, source); return phase(`first-base:accept:${sourceId}`, () => executions.accept(sourceId));
    };
    const step = (sourceId: string, previous: string, checkpoint: OwnedMotionV2Action['checkpoint'], selectedPlayers: readonly string[] = []) => {
      const known = knownWork(), action: OwnedMotionV2Action = { kind: 'owned_motion_v2', checkpoint, knownWork: known,
        contributions: actualPlayersKinematicsFromPrefix(playerIds, prefix(previous)).map(self => selectedPlayers.includes(self.playerId)
          ? { kind: 'motor', playerId: self.playerId, motorSourceId: known.find(w => w.playerId === self.playerId)!.motorSourceId! }
          : { kind: 'retained', playerId: self.playerId, command: self.activeCommand }) };
      return accept(sourceId, previous, action);
    };
    const planned = accept('field-race-acquisition', null, { kind: 'owned_acquisition_plan_v1', knownWork: knownWork() });
    if (planned.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('first-base owned acquisition plan');
    const plan = planned.execution.plan;
    const initialized = step('field-race-capture-initialized', planned.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.contactMoment.elapsedSeconds });
    const damping = step('field-race-capture-fence', initialized.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.fenceElapsedSeconds });
    if (damping.execution.kind !== 'owned_motion_v2' || damping.execution.operation?.kind !== 'acquisition'
      || damping.execution.operation.progress.kind !== 'fence_pending') throw new Error('first-base owned acquisition damping');
    const captured = step('field-race-capture-confirmed', damping.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.fenceElapsedSeconds });
    if (captured.execution.kind !== 'owned_motion_v2' || captured.execution.operation?.kind !== 'acquisition'
      || captured.execution.operation.progress.kind !== 'secured') throw new Error('first-base actual confirmed capture');
    const feet = step('field-race-feet', captured.source.sourceId,
      { kind: 'motion', throughTick: origin + Math.ceil((forecastGroundElapsedSeconds + 0.30) * tps) });
    const actor = x.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.defenderBindings
      .find(b => b.playerId !== plan.acquirerPlayerId)!.playerId;
    const decision = installOwnedScheduledDecision({ f: x.f, baseField }, actor, feet.source.sourceId, 0, 1_000_000);
    const motor = decision.issue(feet.source.sourceId);
    const adopted = step('field-race-real-motor', feet.source.sourceId,
      { kind: 'motion', throughTick: feet.execution.field.motion.world.moment.ball.tick + 1 }, [actor]);
    const quantized = step('field-race-quantizer-tail', adopted.source.sourceId,
      { kind: 'retained_quantizer_bucket_v1', throughTick: adopted.execution.field.motion.world.moment.ball.tick });
    const source: AcceptedBattedWorldFieldExecution = { sourceId: 'field-first-base-race', sourceVersion: 'fixture-v1',
      baseFieldSourceId: baseField.source.sourceId, previousExecutionSourceId: quantized.source.sourceId,
      action: { kind: 'first_base_race', custodyPolicy: 'release_exclusive_v1' } };
    sources.set(source.sourceId, source);
    return { ...(x as Omit<T, 'source' | 'sources' | 'authority'>), runtime, pitchId, firstField, baseField, playerIds, prefix, knownWork, sources, authority, executions,
      source, planned, initialized, damping, captured, feet, decision, motor, adopted, quantized,
      fieldSource: x.source, fieldSources: x.sources, fixtureInputs: { forecastGroundElapsedSeconds, defenderOffsetSeconds: .24,
        batterOffsetSeconds: .28, physicalCutOffsetSeconds: .30, captureDissipationPowerW: 100_000_000 } };
  } catch (error) { x.f.close(); throw error; }
};
