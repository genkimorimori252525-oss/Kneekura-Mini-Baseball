import { beforeEach, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { fixture as captureFixture } from '../../core/sim/ball/BattedWorldScheduledFieldThrow.test-support';
import { acquisitionInput } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition.test-support';
import { prepareBattedWorldScheduledFieldAcquisition } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import { deriveBattedWorldFieldMotionAdoption } from '../../core/sim/ball/BattedWorldFieldMotion';
import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import { playerDecisionCalibrationFixture } from '../../core/sim/fielding/PlayerDecisionCalibrationFixtures.test-support';
import { playerLocomotionCalibrationFixture } from '../../core/sim/fielding/PlayerLocomotionCalibrationFixtures.test-support';
import { createDefensiveRatings } from '../../core/model/DefensiveRatings';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaPhysicalEpisodeSourceInput as parse, type SamePaPhysicalAction, type SamePaPhysicalFieldRoot, type SamePaPhysicalFieldStep, type SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import { deriveSamePaPhysicalFieldCapture } from './SamePlateAppearancePhysicalFieldCapture';
import { deriveSamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalFieldCalculation';
import { deriveSamePaPhysicalQuantizerCheckpoint } from './SamePlateAppearancePhysicalQuantizerCheckpoint';
import { deriveQuantizerClosedGenerationBoundary } from '../../core/sim/liveAction/QuantizerClosedGenerationBoundary';
import { deriveSamePaPhysicalFieldAction } from './SamePlateAppearancePhysicalFieldActionFromSqlite';
import type { SamePaPhysicalFieldAction } from './SamePlateAppearancePhysicalFieldAction';
import type { SamePaLifecycleViewBasis } from './SamePlateAppearanceLifecycle';
import { deriveSamePaPhysicalFieldMotor, samePaPhysicalDefenderSelf } from './SamePlateAppearancePhysicalFieldMotor';
import { deriveSamePaLiveWorkCensus } from './SamePlateAppearanceLiveWorkCensus';
import { deriveSamePaFieldRuleEvidence } from './SamePlateAppearanceFieldRuleEvidence';
const mocked = vi.hoisted(() => ({ calibrations: new Map<string, unknown>(), observations: new Map<string, unknown>(), decisions: new Map<string, unknown>(), locomotion: new Map<string, unknown>(), posture: null as unknown }));
vi.mock('./SamePlateAppearanceLifecycleFromSqlite', () => ({ readSamePaLifecycleCalibrationFromSqlite: (_db: unknown, r: { sourceId: string }) => mocked.calibrations.get(r.sourceId),
  readCurrentSamePaLifecycleCalibrationFromSqlite: (_db: unknown, r: { sourceId: string }) => mocked.calibrations.get(r.sourceId) }));
vi.mock('./SqlitePlayerObservationModelStore', () => ({ playerObservationModelEvidenceFromSqlite: () => ({ read: (id: string) => mocked.observations.get(id) }) }));
vi.mock('./SqlitePlayerDecisionModelStore', () => ({ playerDecisionModelEvidenceFromSqlite: () => ({ read: (id: string) => mocked.decisions.get(id) }) }));
vi.mock('./SqlitePlayerLocomotionModelStore', () => ({ playerLocomotionModelEvidenceFromSqlite: () => ({ read: (id: string) => mocked.locomotion.get(id) }) }));
vi.mock('./SqliteBattingPerceptionStore', () => ({ readBattingPerceptionFromSqlite: () => mocked.posture }));
const ref = (owner: string, sourceId = owner) => ({ owner, sourceId, sourceHash: hash(sourceId), snapshotHash: hash('snapshot:' + sourceId) });
const fieldRef = (r: SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep) => reference(r.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', r);
const base = (previous: SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep, root: SamePaPhysicalFieldRoot, throughTick: number): SamePaPhysicalFieldStepSource => ({
  sourceId: 'step:' + (previous.operationOrdinal + 1), sourceVersion: 'author-fixture-only-v1', capability: 'same_pa_physical_field_step_v1',
  viewReference: ref('pa_lifecycle_v1_execution_views') as SamePaPhysicalFieldStepSource['viewReference'], launchReference: ref('pa_physical_v1_launches') as SamePaPhysicalFieldStepSource['launchReference'],
  previousOperationReference: fieldRef(previous), previousFieldReference: fieldRef(previous), fieldRootReference: reference('pa_physical_v1_field_roots', root), throughTick });
// Only the calculation graph is exercised here. These structural owners and
// mocked model reads provide no Native admission or full fixture evidence.
const rootOf = (input = acquisitionInput()): SamePaPhysicalFieldRoot => ({ source: { sourceId: 'field-root', sourceVersion: 'fixture-only-v1' },
  kind: 'same_pa_physical_field_root_v1', stage: 'field', physicalPitchSourceId: 'pitch', operationOrdinal: 0,
  response: input.response, geometry: input.geometry, field: input.field, evaluationTick: input.field.motion.world.moment.ball.tick,
  timeline: { playId: 1, startedAtTick: 0, lastEventTick: 0, nextSequence: 0, events: [], status: { kind: 'active', count: { balls: 0, strikes: 0 } } }, lineage: { playId: 1 } } as unknown as SamePaPhysicalFieldRoot);
const stepOf = (previous: SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep, source: SamePaPhysicalFieldStepSource, value: ReturnType<typeof deriveSamePaPhysicalFieldCapture> | ReturnType<typeof deriveSamePaPhysicalFieldAction>): SamePaPhysicalFieldStep => ({
  ...previous, ...value, kind: 'same_pa_physical_field_step_v1', source, operationOrdinal: previous.operationOrdinal + 1 } as SamePaPhysicalFieldStep);
beforeEach(() => { mocked.calibrations.clear(); mocked.observations.clear(); mocked.decisions.clear(); mocked.locomotion.clear(); mocked.posture = null; });
it('FA01 capture Source contains only original reference and exact requested horizon', () => {
  const root = rootOf(), action = { kind: 'capture_checkpoint_v1' as const, candidateReference: fieldRef(root), throughElapsedSeconds: 0.01 };
  const source = { ...base(root, root, 10_000), action };
  expect(parse(source)).toEqual(source);
  for (const changed of [{ ...action, secured: true }, { ...action, cursor: {} }, { ...action, candidateReference: ref('batted_world_field_actions') },
    { ...action, throughElapsedSeconds: NaN }, { kind: 'defender_motion_v1', selections: [] }]) expect(() => parse({ ...source, action: changed })).toThrow();
  expect(() => parse({ ...source, action: undefined })).toThrow();
});
it('FA02 capture remains unowned until the original energy and recorded-tick fence complete, then permits carried continuation', () => {
  const root = rootOf(), plan = prepareBattedWorldScheduledFieldAcquisition({ response: root.response, geometry: root.geometry, field: root.field });
  const firstSource = { ...base(root, root, 10_000), action: { kind: 'capture_checkpoint_v1' as const, candidateReference: fieldRef(root), throughElapsedSeconds: 0.01 } };
  const first = stepOf(root, firstSource, deriveSamePaPhysicalFieldCapture(firstSource, root, root, root));
  expect(first.actionResult?.kind).toBe('capture_checkpoint_v1'); expect(first.field.motion.response.kind).toBe('capture_pending');
  expect(first.field.motion.carrierPlayerId).toBeNull(); expect(first.field.motion.cursor).toBeNull();
  expect(() => deriveSamePaPhysicalFieldStep(base(first, root, 20_000), root, first, first.evaluationTick)).toThrow(/concrete acquisition/);
  const secureSource = { ...base(first, root, plan.candidateSecureTick), action: { ...firstSource.action, throughElapsedSeconds: plan.fenceElapsedSeconds } };
  const secure = stepOf(first, secureSource, deriveSamePaPhysicalFieldCapture(secureSource, root, first, root));
  expect(secure.field.motion.carrierPlayerId).toBe('carrier'); expect(secure.field.motion.response.kind).toBe('carried');
  const moved = deriveSamePaPhysicalFieldStep(base(secure, root, secure.evaluationTick + 1000), root, secure, secure.evaluationTick);
  expect(moved.field.motion.carrierPlayerId).toBe('carrier'); expect(moved.field.motion.cursor!.moment.ball.position.x).toBeGreaterThan(secure.field.motion.cursor!.moment.ball.position.x);
  expect(() => deriveSamePaPhysicalFieldCapture({ ...secureSource, throughTick: secureSource.throughTick + 1 }, root, first, root)).toThrow(/exact horizon/);
  expect(() => deriveSamePaPhysicalFieldCapture(secureSource, root, secure, root)).toThrow(/prior is terminal/);
});
it('FA03 a real bag interruption cannot become possession or a generic field cursor', () => {
  const root = rootOf(acquisitionInput(captureFixture(0, 0.02))), source = { ...base(root, root, 4_000_000),
    action: { kind: 'capture_checkpoint_v1' as const, candidateReference: fieldRef(root), throughElapsedSeconds: 4 } };
  const value = deriveSamePaPhysicalFieldCapture(source, root, root, root);
  expect(value.actionResult.kind).toBe('capture_checkpoint_v1'); expect(value.field.motion.response.kind).toBe('capture_interrupted');
  expect(value.field.baseContacts[0].baseId).toBe('first'); expect(value.field.motion.carrierPlayerId).toBeNull(); expect(value.field.motion.cursor).toBeNull();
});
const member = (playerId: string) => ({ playerId, bindingHash: hash(playerId + ':binding'), personHash: hash(playerId + ':person'), baselineSourceId: playerId + ':baseline',
  reservedRevision: 0, reservedStateHash: hash(playerId + ':reserved'), projectedStateHash: hash(playerId + ':projected') });
const authorFixture = () => {
  const raw = captureFixture(0, 1, 5, 5), roles = ['body', 'glove', 'tag_hand', 'left_foot', 'right_foot'] as const;
  const bodies = Array.from({ length: 10 }, (_, i) => ({ source: { playerId: 'p' + i }, actor: { playerId: 'p' + i, personId: 'person' + i,
    heightMeters: 6, bodyOriginHeightMeters: 5, primitives: roles.map((role, j) => ({ role, radius: 0.1, offset: { x: 0, y: j * 0.4, z: 0 } })) } }));
  const actors = bodies.flatMap((b, i) => b.actor.primitives.map(shape => ({ playerId: b.source.playerId, primitive: { role: shape.role, radius: shape.radius,
    startTick: 0, endTick: 5_000_000, ticksPerSecond: 1_000_000, startCenter: { x: 30 + i * 3, y: 5 + shape.offset.y, z: 5 + i * 3 }, startVelocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } })));
  const response = { ...raw.response, world: { ...raw.response.world, actors }, actors: actors.map(a => ({ playerId: a.playerId,
    profile: a.primitive.role === 'glove' ? raw.response.actors[0].profile : { role: a.primitive.role, material: { restitution: 0.5, tangentialDamping: 0, spinDamping: 0 } } })) };
  const initial = response.world.flight.initialBall, field = deriveBattedWorldFieldMotionAdoption({ response, geometry: raw.geometry, actors, carrierPlayerId: null,
    cursor: { moment: { originTick: 0, elapsedSeconds: 0, ball: initial }, previousContacts: [] }, availableAtTick: 0, coverageThroughTick: 5_000_000,
    commands: actors.map(a => ({ playerId: a.playerId, role: a.primitive.role, acceleration: a.primitive.acceleration })) });
  const root = rootOf({ response, geometry: raw.geometry, field }), m = member('p1'), members = bodies.map(b => member(b.source.playerId));
  const action = { physicalPitchSourceId: 'pitch', source: { nominalPitch: { delivery: { matchSeed: 19 } } }, actor: { binding: { playerId: 'p0' },
    world: { runners: [] },
    defenderBindings: bodies.slice(1).map(b => ({ playerId: b.source.playerId, personId: b.actor.personId, personLinkSourceId: b.source.playerId + ':link', gameDay: 1 })) } } as unknown as SamePaPhysicalAction;
  const view = { source: { sourceId: 'author-view', sourceVersion: 'fixture-only-v1' }, cut: { evaluationTick: 0 } };
  let basis = { view, members } as unknown as SamePaLifecycleViewBasis;
  const ratings = createDefensiveRatings({ positionSuitability: { P: 0.5, C: 0.5, '1B': 0.5, '2B': 0.5, '3B': 0.5, SS: 0.5, LF: 0.5, CF: 0.5, RF: 0.5 },
    firstStep: 0.5, acceleration: 0.5, battedBallRead: 0.5, routeEfficiency: 0.5, catching: 0.5, transfer: 0.5, armStrength: 0.5, throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 });
  const fieldingModel = { source: { ratings }, person: { personId: 'person1' } };
  const observationModel = { source: { sourceId: 'observation-model', sourceVersion: 'fixture-only-v1' }, fieldingModel };
  mocked.observations.set('observation-model', observationModel);
  const decisionModel = { source: { sourceId: 'decision-model', sourceVersion: 'fixture-only-v1' }, fieldingModel };
  const locomotionModel = { source: { sourceId: 'motion-model', sourceVersion: 'fixture-only-v1', playerId: 'p1', personLinkSourceId: 'p1:link', acceptedAtDay: 1 }, fieldingModel };
  mocked.decisions.set('decision-model', decisionModel); mocked.locomotion.set('motion-model', locomotionModel);
  mocked.posture = { kind: 'batting_invocation_posture', sceneBodies: bodies.slice(1) };
  const observationValues = playerObservationCalibrationFixture(), obs = { ...observationValues,
    memoryDecayParameters: { ...observationValues.memoryDecayParameters, ticksPerSecond: 1_000_000 },
    errorParameters: { minimumDetectionQuality: 0, minimumPositionErrorMeters: 0, maximumPositionErrorMeters: 0, minimumVelocityErrorMps: 0, maximumVelocityErrorMps: 0 } };
  const values = { defender_observation: obs, defender_decision: playerDecisionCalibrationFixture(), defender_locomotion: { ...playerLocomotionCalibrationFixture(), maxIntegrationStepTicks: 100_000 } };
  const calibrate = (route: keyof typeof values, playerId = 'p1') => {
    const suffix = playerId === 'p1' ? '' : ':' + playerId;
    const ownFieldingModel = { ...fieldingModel, person: { personId: 'person' + playerId.slice(1) } };
    const ownObservation = { ...observationModel, source: { ...observationModel.source, sourceId: 'observation-model' + suffix }, fieldingModel: ownFieldingModel };
    const ownDecision = { ...decisionModel, source: { ...decisionModel.source, sourceId: 'decision-model' + suffix }, fieldingModel: ownFieldingModel };
    const ownLocomotion = { ...locomotionModel, source: { ...locomotionModel.source, sourceId: 'motion-model' + suffix,
      playerId, personLinkSourceId: playerId + ':link' }, fieldingModel: ownFieldingModel };
    mocked.observations.set(ownObservation.source.sourceId, ownObservation); mocked.decisions.set(ownDecision.source.sourceId, ownDecision);
    mocked.locomotion.set(ownLocomotion.source.sourceId, ownLocomotion);
    const id = 'calibration:' + route + suffix, nominalReference = route === 'defender_decision' ? reference('world_player_decision_models', ownDecision)
      : route === 'defender_locomotion' ? reference('world_player_locomotion_models', ownLocomotion) : reference('world_player_observation_models', ownObservation);
    mocked.calibrations.set(id, { lineage: root.lineage, source: { member: member(playerId), viewReference: reference('pa_lifecycle_v1_execution_views', basis.view),
      route, nominalReference, response: { kind: 'accepted_execution_values_v1', values: values[route] } } });
    return ref('pa_lifecycle_v1_execution_calibrations', id) as Extract<SamePaPhysicalFieldAction, { kind: 'defender_observation_v1' }>['calibrationReference'];
  };
  const prefix: (SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep)[] = [root];
  const run = (request: SamePaPhysicalFieldAction, throughTick = prefix.at(-1)!.evaluationTick) => {
    const previous = prefix.at(-1)!, source = { ...base(previous, root, throughTick), viewReference: reference('pa_lifecycle_v1_execution_views', basis.view), action: request };
    const value = deriveSamePaPhysicalFieldAction({} as DatabaseSync, source, root, previous, action, basis, prefix, false);
    const step = stepOf(previous, source, value); prefix.push(step); basis = { ...basis, view: { ...basis.view, cut: { ...basis.view.cut, evaluationTick: step.evaluationTick } } };
    return step;
  };
  const observe = (playerId = 'p1') => run({ kind: 'defender_observation_v1', member: member(playerId), calibrationReference: calibrate('defender_observation', playerId), previousObservationReference: null,
    view: { poseVersion: 'explicit-author-v1', bodyRelativeEyeOffset: { x: 0, y: 0, z: 0 }, forward: { x: -1, y: 0, z: 0 }, attentionTarget: { kind: 'ball' } } });
  const decide = (observation: SamePaPhysicalFieldStep) => run({ kind: 'defender_decision_v1', member: m, calibrationReference: calibrate('defender_decision'),
    observationReference: reference('pa_physical_v1_field_steps', observation), priorities: { ballPursuitPriority: 1, baseCoverPriorities: [], relayPriority: 0, backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0.1 } });
  const waitUntil = (tick: number) => { const previous = prefix.at(-1)!, source = base(previous, root, tick), result = deriveSamePaPhysicalFieldStep(source, root, previous, previous.evaluationTick);
    const step = JSON.parse(JSON.stringify({ ...previous, ...result, source, actionResult: undefined, kind: 'same_pa_physical_field_step_v1', operationOrdinal: previous.operationOrdinal + 1 })) as SamePaPhysicalFieldStep;
    prefix.push(step); basis = { ...basis, view: { ...basis.view, cut: { ...basis.view.cut, evaluationTick: step.evaluationTick } } }; return step; };
  return { root, action, basis, values, m, calibrate, prefix, run, observe, decide, waitUntil };
};
it('FQ01 executes the exact retained quantizer suffix without changing command ownership or declaring an end', () => {
  const h=authorFixture(), previous=h.waitUntil(100), before=JSON.stringify(previous.field.motion.actors);
  const sealed=h.run({kind:'retained_quantizer_checkpoint_v1'}), boundary=deriveQuantizerClosedGenerationBoundary({originTick:0,throughTick:100,ticksPerSecond:1_000_000});
  expect(sealed.actionResult).toEqual({kind:'retained_quantizer_checkpoint_v1',boundary,status:'checkpoint_reached'});
  expect(sealed.evaluationTick).toBe(100);expect(sealed.field.motion.world.moment.elapsedSeconds).toBe(boundary.lastIncludedElapsedSeconds);
  expect(sealed.field.motion.world.moment.elapsedSeconds).toBeGreaterThan(previous.field.motion.world.moment.elapsedSeconds);
  expect(JSON.stringify(sealed.field.motion.actors)).toBe(before);expect(sealed.timeline).toEqual(previous.timeline);
  expect(sealed).not.toHaveProperty('playEnd');expect(sealed).not.toHaveProperty('completion');
  expect(()=>h.run({kind:'retained_quantizer_checkpoint_v1'})).toThrow(/interval/);
});
it('FS01 source-backed relay, backup and deep coverage execute the rated motor into the same physical checkpoint', () => {
  for (const role of ['relay', 'backup', 'deep_coverage'] as const) {
    const h = authorFixture(), observed = h.observe();
    const priorities = { ballPursuitPriority: 0, baseCoverPriorities: [], relayPriority: 0, backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0.01,
      [role === 'deep_coverage' ? 'deepCoveragePriority' : role + 'Priority']: 1 };
    const selected = h.run({ kind: 'defender_decision_v1', member: h.m, calibrationReference: h.calibrate('defender_decision'),
      observationReference: reference('pa_physical_v1_field_steps', observed), priorities,
      supportGeometry: { kind: 'perceived_ball_support_geometry_v1', base: 1 } });
    if (selected.actionResult?.kind !== 'defender_decision_v1') throw new Error('support decision missing');
    expect(selected.actionResult.calculation.selected.intent.kind).toBe(role);
    h.waitUntil(selected.actionResult.calculation.scheduling.movementStartTick);
    const previous = h.prefix.at(-1)!, moved = h.run({ kind: 'defender_motion_v1', selections: [{ member: h.m,
      decisionReference: reference('pa_physical_v1_field_steps', selected), calibrationReference: h.calibrate('defender_locomotion') }] }, previous.evaluationTick + 1000);
    if (moved.actionResult?.kind !== 'defender_motion_v1') throw new Error('support motor missing');
    const motor = moved.actionResult.motors[0];
    expect(motor.intent.kind).toBe(role); expect(Math.hypot(motor.segment.acceleration.x, motor.segment.acceleration.z)).toBeGreaterThan(0);
    const model = (mocked.posture as any).sceneBodies.find((b: any) => b.source.playerId === 'p1').actor;
    const after = samePaPhysicalDefenderSelf(h.action, h.root, moved, model);
    expect(Math.hypot(after.root.position.x - motor.self.root.position.x, after.root.position.z - motor.self.root.position.z)).toBeGreaterThan(0);
    expect(Math.hypot(after.root.velocity.x, after.root.velocity.z)).toBeGreaterThan(0);
    expect(moved.field.motion.carrierPlayerId).toBeNull(); expect(moved.timeline.events).toEqual(previous.timeline.events);
  }
});
it('FS02 all nine original defenders execute including cover after a genuinely moved and locally perceived handler', () => {
  const h = authorFixture(), handler = h.decide(h.observe());
  if (handler.actionResult?.kind !== 'defender_decision_v1') throw new Error('handler missing');
  h.waitUntil(handler.actionResult.calculation.scheduling.movementStartTick);
  const handlerMotor = h.run({ kind: 'defender_motion_v1', selections: [{ member: h.m,
    decisionReference: reference('pa_physical_v1_field_steps', handler), calibrationReference: h.calibrate('defender_locomotion') }] }, h.prefix.at(-1)!.evaluationTick + 1000);
  const roles = ['base_cover', 'relay', 'backup', 'deep_coverage', 'hold', 'relay', 'backup', 'deep_coverage'] as const;
  const decisions = roles.map((role, index) => {
    const playerId = 'p' + (index + 2), observed = h.observe(playerId);
    const priorities = { ballPursuitPriority: 0, baseCoverPriorities: role === 'base_cover' ? [{ base: 1 as const, priority: 1 }] : [],
      relayPriority: role === 'relay' ? 1 : 0, backupPriority: role === 'backup' ? 1 : 0, deepCoveragePriority: role === 'deep_coverage' ? 1 : 0,
      holdPriority: role === 'hold' ? 1 : 0.01 };
    const decision = h.run({ kind: 'defender_decision_v1', member: member(playerId), calibrationReference: h.calibrate('defender_decision', playerId),
      observationReference: reference('pa_physical_v1_field_steps', observed), priorities,
      supportGeometry: { kind: 'perceived_ball_support_geometry_v1', base: 1,
        ...(role === 'base_cover' ? { teammateMotionReference: reference('pa_physical_v1_field_steps', handlerMotor) } : {}) } });
    if (decision.actionResult?.kind !== 'defender_decision_v1') throw new Error('support decision missing');
    expect(decision.actionResult.calculation.selected.intent.kind).toBe(role);
    return decision;
  });
  const due = Math.max(...decisions.map(d => d.actionResult?.kind === 'defender_decision_v1' ? d.actionResult.calculation.scheduling.movementStartTick : 0));
  h.waitUntil(due);
  const before = h.prefix.at(-1)!, selections = [handler, ...decisions].map(d => {
    if (d.actionResult?.kind !== 'defender_decision_v1') throw new Error('decision missing');
    return { member: member(d.actionResult.playerId), decisionReference: reference('pa_physical_v1_field_steps', d),
      calibrationReference: h.calibrate('defender_locomotion', d.actionResult.playerId) };
  });
  const moved = h.run({ kind: 'defender_motion_v1', selections }, before.evaluationTick + 1000);
  if (moved.actionResult?.kind !== 'defender_motion_v1') throw new Error('nine motors missing');
  expect(moved.actionResult.motors).toHaveLength(9);
  expect(new Set(moved.actionResult.motors.map(m => m.intent.kind)).size).toBe(6);
  for (const motor of moved.actionResult.motors) {
    if (motor.intent.kind === 'hold') expect(motor.segment.acceleration).toEqual({ x: 0, z: 0 });
    else {
      expect(Math.hypot(motor.segment.acceleration.x, motor.segment.acceleration.z)).toBeGreaterThan(0);
      const model = (mocked.posture as any).sceneBodies.find((b: any) => b.source.playerId === motor.self.playerId).actor;
      const after = samePaPhysicalDefenderSelf(h.action, h.root, moved, model);
      expect(Math.hypot(after.root.position.x - motor.self.root.position.x, after.root.position.z - motor.self.root.position.z)).toBeGreaterThan(0);
    }
  }
  expect(moved.field.motion.actors).toHaveLength(50); expect(moved.field.motion.carrierPlayerId).toBeNull();
  expect(moved.field.motion.actors.filter(a => a.playerId === 'p0').every(a => Object.values(a.primitive.acceleration).every(n => n === 0))).toBe(true);
});
it('FS03 support policy admits references only and legacy motor still rejects the additional roles', () => {
  const h = authorFixture(), observed = h.observe(), request: SamePaPhysicalFieldAction = { kind: 'defender_decision_v1', member: h.m,
    calibrationReference: h.calibrate('defender_decision'), observationReference: reference('pa_physical_v1_field_steps', observed),
    priorities: { ballPursuitPriority: 0, baseCoverPriorities: [], relayPriority: 1, backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0.01 },
    supportGeometry: { kind: 'perceived_ball_support_geometry_v1', base: 1 } };
  const source = { ...base(observed, h.root, observed.evaluationTick), action: request };
  expect(parse(source)).toMatchObject({ action: request });
  for (const supportGeometry of [{ ...request.supportGeometry, target: { x: 10, z: 10 } }, { ...request.supportGeometry, base: 5 },
    { ...request.supportGeometry, teammateMotionReference: ref('foreign') }, { ...request.supportGeometry, kind: 'hypothetical_team_plan' }]) {
    expect(() => parse({ ...source, action: { ...request, supportGeometry } })).toThrow(/decision Source/);
  }
  expect(() => h.run({ ...request, supportGeometry: { ...request.supportGeometry!, teammateMotionReference: reference('pa_physical_v1_field_steps', observed) } })).toThrow(/executed handler motor/);
  expect(() => h.run({ ...request, supportGeometry: { ...request.supportGeometry!, teammateMotionReference: ref('pa_physical_v1_field_steps', 'foreign') as never } })).toThrow(/outside the original prefix/);
  const decision = h.run(request);
  if (decision.actionResult?.kind !== 'defender_decision_v1') throw new Error('decision missing');
  const decisionResult = decision.actionResult;
  h.waitUntil(decisionResult.calculation.scheduling.movementStartTick);
  const moved = h.run({ kind: 'defender_motion_v1', selections: [{ member: h.m, decisionReference: reference('pa_physical_v1_field_steps', decision),
    calibrationReference: h.calibrate('defender_locomotion') }] }, h.prefix.at(-1)!.evaluationTick + 1000);
  if (moved.actionResult?.kind !== 'defender_motion_v1') throw new Error('motor missing');
  const m = moved.actionResult.motors[0], model = mocked.locomotion.get('motion-model') as never;
  expect(() => deriveSamePaPhysicalFieldMotor({ sourceId: decision.source.sourceId, playerId: m.self.playerId, physicalPitchSourceId: 'pitch',
    selected: decisionResult.calculation.selected, target: m.target, ticksPerSecond: m.self.ticksPerSecond,
    availability: decisionResult.availability, scheduling: decisionResult.calculation.scheduling,
    lifecycle: { status: 'issued', issuedAt: m.issuedAt, issuedBySourceId: decision.source.sourceId } }, model, m.self, h.values.defender_locomotion)).toThrow(/unsupported/);
});
it('FT01 team actor selections drive nine real motor calculations using the team choice, preserving the original body curves', () => {
  const h = authorFixture(), decisions = Array.from({ length: 9 }, (_, i) => {
    const playerId = `p${i + 1}`, observation = h.observe(playerId);
    return h.run({ kind: 'defender_decision_v1', member: member(playerId), calibrationReference: h.calibrate('defender_decision', playerId),
      observationReference: fieldRef(observation) as any, priorities: { ballPursuitPriority: 1, baseCoverPriorities: [],
        relayPriority: 0, backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0.1 } });
  });
  // These metadata rows are structural seams. The separate SQLite candidate
  // owner tests/proofs, not this mocked-model fixture, authenticate their values.
  const append = (request: any, actionResult: any) => {
    const previous = h.prefix.at(-1)!, source = { ...base(previous, h.root, previous.evaluationTick), action: request };
    const step = stepOf(previous, source, { field: previous.field, timeline: previous.timeline, evaluationTick: previous.evaluationTick, actionResult });
    h.prefix.push(step); return step;
  };
  const team = append({ kind: 'defender_team_selection_v1' }, { kind: 'defender_team_selection_v1', movementAdmission: false, plan: {
    assignments: decisions.map(decision => ({ playerId: (decision.actionResult as any).playerId })) } });
  const actors = decisions.map((decision, index) => {
    if (decision.actionResult?.kind !== 'defender_decision_v1') throw Error('original decision missing');
    const d = decision.actionResult, candidate = index === 0 ? d.calculation.selected : { ...d.calculation.selected, intent: { kind: 'hold' } };
    return append({ kind: 'defender_actor_selection_v1', teamSelectionReference: fieldRef(team), member: member(d.playerId) }, {
      kind: 'defender_actor_selection_v1', movementAdmission: false, playerId: d.playerId, teamSelectionReference: fieldRef(team), originalDecisionReference: fieldRef(decision),
      observationReference: d.observationReference, fieldingModelHash: d.fieldingModelHash, availability: d.availability,
      scheduling: d.calculation.scheduling, candidate, target: index === 0 ? d.target : null });
  });
  const due = Math.max(...decisions.map(decision => (decision.actionResult as any).calculation.scheduling.movementStartTick));
  h.waitUntil(due); const before = h.prefix.at(-1)!;
  const moved = h.run({ kind: 'defender_motion_v1', selections: actors.map(actor => ({ member: member((actor.actionResult as any).playerId),
    decisionReference: fieldRef(actor) as any, calibrationReference: h.calibrate('defender_locomotion', (actor.actionResult as any).playerId) })) }, before.evaluationTick + 1000);
  if (moved.actionResult?.kind !== 'defender_motion_v1') throw Error('team motors missing');
  expect(moved.actionResult.motors).toHaveLength(9);
  expect(moved.actionResult.motors.map(motor => motor.intent.kind)).toEqual(['ball_handler', ...Array(8).fill('hold')]);
  expect(moved.actionResult.motors.slice(1).every(motor => motor.segment.acceleration.x === 0 && motor.segment.acceleration.z === 0)).toBe(true);
  expect(moved.field.motion.actors).toHaveLength(50);
  expect(moved.timeline.events).toEqual(before.timeline.events); expect(moved.field.motion.carrierPlayerId).toBeNull();
  const rule = deriveSamePaFieldRuleEvidence({ fields: h.prefix, batterRunnerId: 'p0',
    defenderIds: h.action.actor.defenderBindings.map(binding => binding.playerId), outsAtStart: 0 });
  const input = { fields: h.prefix, participantIds: ['p0', ...h.action.actor.defenderBindings.map(binding => binding.playerId)],
    possessionEvidence: rule.rule.possessionEvidence, observationPolicies: h.prefix.flatMap(field => field.kind === 'same_pa_physical_field_step_v1'
      && field.actionResult?.kind === 'defender_observation_v1' ? [{ observationReference: fieldRef(field) as any,
        refreshPolicy: { attendedIntervalTicks: 10, peripheralIntervalTicks: 40 } }] : []) };
  const census = deriveSamePaLiveWorkCensus(input);
  expect(census.defenderDecisions.pending).toHaveLength(0); expect(census.defenderDecisions.consumed).toHaveLength(9);
  expect(census.defenderDecisions.consumed.map(value => value.decisionReference)).toEqual(decisions.map(fieldRef));
  expect(census.defenderDecisions.consumed.every(value => value.consumerReference.sourceId === moved.source.sourceId)).toBe(true);
  const tampered = structuredClone(moved);
  if (tampered.actionResult?.kind !== 'defender_motion_v1') throw Error('team motors missing');
  (tampered.actionResult.motors[1] as any).intent = { kind: 'ball_handler' };
  expect(() => deriveSamePaLiveWorkCensus({ ...input, fields: [...h.prefix.slice(0, -1), tampered] })).toThrow(/candidate differs/);
});
it('FS04 a late support decision cannot reuse a sensory cut from before physical progress', () => {
  const h = authorFixture(), observed = h.observe();
  h.waitUntil(100);
  expect(() => h.run({ kind: 'defender_decision_v1', member: h.m, calibrationReference: h.calibrate('defender_decision'),
    observationReference: reference('pa_physical_v1_field_steps', observed),
    priorities: { ballPursuitPriority: 0, baseCoverPriorities: [], relayPriority: 1, backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0.01 },
    supportGeometry: { kind: 'perceived_ball_support_geometry_v1', base: 1 } })).toThrow(/current original cut/);
});
it('FQ02 rejects caller end, time, replacement commands and a checkpoint beyond expired role coverage', () => {
  const h=authorFixture(), previous=h.waitUntil(100), source={...base(previous,h.root,100),action:{kind:'retained_quantizer_checkpoint_v1' as const}};
  expect(parse(source)).toEqual(source);
  for(const extra of [{playEnd:true},{throughElapsedSeconds:1},{actors:[]},{completed:true}])expect(()=>parse({...source,action:{...source.action,...extra}})).toThrow();
  const expired={...previous,field:{...previous.field,motion:{...previous.field.motion,actors:previous.field.motion.actors.map(a=>({...a,primitive:{...a.primitive,endTick:100}}))}}};
  expect(()=>deriveSamePaPhysicalQuantizerCheckpoint(source,h.root,expired)).toThrow(/coverage/);
  expect(()=>deriveSamePaPhysicalQuantizerCheckpoint({...source,throughTick:101},h.root,previous)).toThrow(/current original/);
});
it('FA04 actual-cut perception, existing decision latency and effective movement preserve all ten physical contributors', () => {
  const h = authorFixture(), observation = h.observe();
  expect(observation.actionResult?.kind).toBe('defender_observation_v1');
  if (observation.actionResult?.kind !== 'defender_observation_v1') throw new Error('observation');
  expect(observation.actionResult.receipt.samples.ball).not.toBeNull(); expect(observation.field).toEqual(h.root.field);
  const decision = h.decide(observation); if (decision.actionResult?.kind !== 'defender_decision_v1') throw new Error('decision');
  expect(decision.actionResult.calculation.selected.intent.kind).toBe('ball_handler');
  const motion = () => ({ kind: 'defender_motion_v1' as const, selections: [{ member: h.m, decisionReference: reference('pa_physical_v1_field_steps', decision), calibrationReference: h.calibrate('defender_locomotion') }] });
  expect(() => h.run(motion(), 100)).toThrow(/first step is not due/);
  h.waitUntil(decision.actionResult.calculation.scheduling.movementStartTick);
  const previous = h.prefix.at(-1)!, moved = h.run(motion(), previous.evaluationTick + 1000);
  expect(moved.actionResult?.kind).toBe('defender_motion_v1'); expect(moved.field.motion.actors).toHaveLength(50);
  const selected = moved.field.motion.actors.filter(a => a.playerId === 'p1'); expect(selected.every(a => a.primitive.acceleration.x < 0)).toBe(true);
  expect(moved.field.motion.actors.filter(a => a.playerId !== 'p1').every(a => Object.values(a.primitive.acceleration).every(n => n === 0))).toBe(true);
  expect(moved.field.motion.cursor!.moment.ball.tick).toBe(previous.evaluationTick + 1000);
  const changed = structuredClone(motion()); changed.selections[0].member.projectedStateHash = hash('wrong fatigue');
  expect(() => h.run(changed, moved.evaluationTick + 1)).toThrow(/dependency differs/);
});
it('FA05 stale observation chains, transported decisions and foreign capture candidates are rejected', () => {
  const h = authorFixture(), observation = h.observe(); expect(() => h.observe()).toThrow(/dependency differs/);
  const request = { kind: 'defender_decision_v1' as const, member: h.m, calibrationReference: h.calibrate('defender_decision'),
    observationReference: ref('pa_physical_v1_field_steps', 'foreign') as SamePaPhysicalFieldStepSource['previousFieldReference'] & { owner: 'pa_physical_v1_field_steps' },
    priorities: { ballPursuitPriority: 1, baseCoverPriorities: [], relayPriority: 0, backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0.1 } };
  expect(() => h.run(request)).toThrow(/outside the original prefix/);
  const source = { ...base(observation, h.root, 0), action: { ...request, observationReference: reference('pa_physical_v1_field_steps', observation), target: { x: 10, z: 10 } } };
  expect(() => parse(source)).toThrow(/decision Source/);
});
it('FA06 energy dissipation alone never creates possession before the recorded-tick fence', () => {
  const root = rootOf(acquisitionInput(captureFixture(0, 0.0625 / 0.0625001))), plan = prepareBattedWorldScheduledFieldAcquisition({ response: root.response, geometry: root.geometry, field: root.field });
  const source = { ...base(root, root, plan.candidateSecureTick), action: { kind: 'capture_checkpoint_v1' as const, candidateReference: fieldRef(root), throughElapsedSeconds: plan.secureElapsedSeconds } };
  const pending = stepOf(root, source, deriveSamePaPhysicalFieldCapture(source, root, root, root));
  if (pending.actionResult?.kind !== 'capture_checkpoint_v1') throw new Error('capture');
  expect(pending.actionResult.progress.kind).toBe('fence_pending'); expect(pending.actionResult.progress.transport.remainingEnergyJ).toBe(0);
  expect(pending.field.motion.cursor).toBeNull(); expect(pending.field.motion.carrierPlayerId).toBeNull();
  const finish = { ...base(pending, root, plan.candidateSecureTick), action: { ...source.action, throughElapsedSeconds: plan.fenceElapsedSeconds } };
  expect(deriveSamePaPhysicalFieldCapture(finish, root, pending, root).field.motion.carrierPlayerId).toBe('carrier');
});
it('FA07 locomotion consumes the current effective calibration without replacing its nominal model', () => {
  const run = (acceleration: number) => {
    const h = authorFixture(); h.values.defender_locomotion.accelerationRatingCalibration = { lowestAbilityAccelerationMps2: acceleration, highestAbilityAccelerationMps2: acceleration };
    const decision = h.decide(h.observe()); if (decision.actionResult?.kind !== 'defender_decision_v1') throw new Error('decision');
    h.waitUntil(decision.actionResult.calculation.scheduling.movementStartTick);
    const moved = h.run({ kind: 'defender_motion_v1', selections: [{ member: h.m, decisionReference: reference('pa_physical_v1_field_steps', decision), calibrationReference: h.calibrate('defender_locomotion') }] }, h.prefix.at(-1)!.evaluationTick + 1000);
    if (moved.actionResult?.kind !== 'defender_motion_v1') throw new Error('movement');
    return Math.hypot(moved.actionResult.motors[0].segment.acceleration.x, moved.actionResult.motors[0].segment.acceleration.z);
  };
  expect(run(2)).toBeCloseTo(2); expect(run(4)).toBeCloseTo(4);
});
