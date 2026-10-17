import type { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BattedWorldFieldMotionAdoptionInput } from '../../core/sim/ball/BattedWorldFieldMotion';
import { fixture as catchFixture } from '../../core/sim/ball/BattedWorldScheduledFieldThrow.test-support';
import { sourceFieldV3Fixture } from '../../core/sim/ball/SourceBattedFieldMotionV3.test-support';
import { deriveSourceBattedFieldMotionV3 } from '../../core/sim/ball/SourceBattedFieldMotionV3';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { deriveFieldIntegerBoundaryV1 } from '../../core/sim/ball/SourceFieldIntegerBoundaryV1';
import { recordBatBallContact } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION as ROOT, SAME_PA_AERO_GROUND_ESCAPE_FIELD_STEP_SOURCE_VERSION as OLD,
  SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION as NEW, assertSamePaFieldBallPhysicsStep } from './SamePlateAppearanceBallPhysics';
import { deriveSamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalFieldCalculation';
import { deriveSamePaPhysicalFieldAction } from './SamePlateAppearancePhysicalFieldActionFromSqlite';
import { samePaPhysicalFieldActionInput, type SamePaPhysicalFieldAction } from './SamePlateAppearancePhysicalFieldAction';
import { deriveSamePaSourceFieldMetadataV3, samePaSourceFieldSolverEvidenceV3 } from './SamePlateAppearanceSourceFieldV3';
import { deriveSamePaSourceIntegerCheckpointV1 as checkpoint } from './SamePlateAppearanceSourceIntegerCheckpointV1';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
const ref = (field: Field) => reference(field.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', field);
const metadata = ['defender_observation_v1', 'defender_decision_v1', 'defender_candidate_set_v1', 'defender_team_selection_v1', 'defender_actor_selection_v1'];

// Real Core trajectory with structural calculation references. This is not a
// Native Source admission fixture and grants no body/custody/rules authority.
const fixture = (wallDuringWait = false, original: BattedWorldFieldMotionAdoptionInput = sourceFieldV3Fixture()) => {
  const x = { ...original, response: { ...original.response, world: { ...original.response.world,
    surfaces: original.response.world.surfaces.filter(() => false) }, surfaces: original.response.surfaces.filter(() => false) } };
  if (wallDuringWait) {
    const ground = deriveSourceBattedFieldMotionV3({ initial: x, throughTicks: [812345] }).field.motion.cursor!;
    const target = deriveFieldIntegerBoundaryV1({ originTick: ground.moment.originTick, elapsedSeconds: ground.moment.elapsedSeconds, ticksPerSecond: 1_000_000 });
    const centerX = ground.moment.ball.position.x + x.cursor.sourceCurve!.profile.ground.radiusM + ground.moment.ball.velocity.x * target.waitSeconds / 2;
    const surfaceId = 'wall-before-integer';
    x.response.world.surfaces = [{ surfaceId, start: { x: centerX, z: -10 }, end: { x: centerX, z: 10 }, minimumHeight: 0, maximumHeight: 20 }];
    x.response.surfaces = [{ surfaceId, material: { restitution: .5, tangentialDamping: .25, spinDamping: .2 } }];
  }
  const trace = deriveSourceBattedFieldMotionV3({ initial: x, throughTicks: [] });
  const launchReference = { owner: 'pa_physical_v1_launches', sourceId: 'launch', sourceHash: hash('launch'), snapshotHash: hash('launch') };
  const root = { kind: 'same_pa_physical_field_root_v1', stage: 'field', physicalPitchSourceId: 'pitch', operationOrdinal: 0,
    pitchOrdinal: 3, lineage: { playId: 1 }, source: { sourceId: 'root', sourceVersion: ROOT, launchReference,
      throughTick: x.availableAtTick, parameters: x.response.world.parameters, ballPhysics: x.cursor.sourceCurve!.profile,
      commands: [...new Set(x.actors.map(a => a.playerId))].map(playerId => ({ playerId, bodyAcceleration: { x: 0, y: 0, z: 0 },
        primitiveMotions: x.actors.filter(a => a.playerId === playerId).map(a => ({ role: a.primitive.role,
          offsetVelocity: { x: 0, y: 0, z: 0 }, offsetAcceleration: { x: 0, y: 0, z: 0 } })) })) },
    response: x.response, geometry: x.geometry, field: trace.field, ballSolverEvidence: samePaSourceFieldSolverEvidenceV3(trace),
    evaluationTick: x.availableAtTick, timeline: recordBatBallContact({ playId: 1, startedAtTick: 0, lastEventTick: 0, nextSequence: 0,
      events: [], status: { kind: 'active', count: { balls: 0, strikes: 0 } } }, x.response.world.flight.contact)
  } as unknown as SamePaPhysicalFieldRoot;
  const source = (previous: Field, version = NEW): SamePaPhysicalFieldStepSource => ({ sourceId: 'step' + (previous.operationOrdinal + 1),
    sourceVersion: version, capability: 'same_pa_physical_field_step_v1', launchReference: launchReference as never,
    fieldRootReference: ref(root) as never, previousFieldReference: ref(previous), previousOperationReference: ref(previous),
    viewReference: { owner: 'pa_lifecycle_v1_execution_views', sourceId: 'view', sourceHash: hash('view'), snapshotHash: hash('view') },
    throughTick: previous.evaluationTick, action: { kind: 'source_integer_boundary_checkpoint_v1' } });
  const firstSource = { ...source(root, OLD), throughTick: 812345 }; delete firstSource.action;
  const first = deriveSamePaPhysicalFieldStep(firstSource, root, root, root.evaluationTick, true, [root]);
  const physical = { ...root, ...first, source: firstSource, kind: 'same_pa_physical_field_step_v1', operationOrdinal: 1 } as SamePaPhysicalFieldStep;
  const history: Field[] = [root, physical];
  for (const kind of metadata) {
    const previous = history.at(-1)!, s = { ...source(previous, OLD), action: { kind } as never };
    const result = deriveSamePaSourceFieldMetadataV3(s, root, previous, history);
    history.push({ ...previous, ...result, source: s, kind: 'same_pa_physical_field_step_v1', operationOrdinal: previous.operationOrdinal + 1,
      actionResult: { kind } as never } as SamePaPhysicalFieldStep);
  }
  return { root, history, previous: history.at(-1)!, source };
};
const record = (previous: Field, source: SamePaPhysicalFieldStepSource, result: ReturnType<typeof checkpoint>): SamePaPhysicalFieldStep => ({
  ...previous, ...result, evaluationTick: result.field.motion.world.moment.ball.tick, kind: 'same_pa_physical_field_step_v1',
  source, operationOrdinal: previous.operationOrdinal + 1,
});

it('branches from the full original v3 metadata prefix and executes same-tick positive physical time on its original Source', () => {
  const h = fixture(), source = h.source(h.previous), bytes = JSON.stringify(h.history);
  const result = checkpoint({ ...h, source }), before = h.previous.field.motion.cursor!, after = result.field.motion.cursor!;
  expect(result.actionResult.status).toBe('checkpoint_reached');
  expect(result.actionResult.boundary.waitSeconds).toBeGreaterThan(0);
  expect(after.moment.ball.tick).toBe(before.moment.ball.tick);
  expect(after.moment.elapsedSeconds).toBe(result.actionResult.boundary.boundaryElapsedSeconds);
  expect(after.moment.ball.position).not.toEqual(before.moment.ball.position);
  expect(after.moment.ball.velocity).not.toEqual(before.moment.ball.velocity);
  expect(after.moment.ball.spin).not.toEqual(before.moment.ball.spin);
  expect(after.sourceCurve!.initial).toEqual(before.sourceCurve!.initial);
  expect(after.sourceCurve!.profile).toEqual(before.sourceCurve!.profile);
  expect(result.field.motion.actors).toEqual(h.previous.field.motion.actors);
  expect(after.moment).toEqual(createSourceFreeBallKernel(after.sourceCurve!).evaluateAt(after.moment.elapsedSeconds, after.sourceSide).moment);
  expect(JSON.stringify(h.history)).toBe(bytes);
});

it('routes the dedicated action through the owner calculation without relaxing the ordinary stale-step guard', () => {
  const h = fixture(), view = { source: { sourceId: 'view' }, cut: { evaluationTick: h.previous.evaluationTick } };
  const source = { ...h.source(h.previous), viewReference: reference('pa_lifecycle_v1_execution_views', view as never) };
  const action = { physicalPitchSourceId: h.root.physicalPitchSourceId };
  const result = deriveSamePaPhysicalFieldAction({} as DatabaseSync, source, h.root, h.previous, action as never,
    { view } as never, h.history, false);
  expect(result.actionResult.kind).toBe('source_integer_boundary_checkpoint_v1');
  expect(result.evaluationTick).toBe(h.previous.evaluationTick);
  expect(result.timeline).toEqual(h.previous.timeline);
  expect(result.timeline.status.kind).toBe('batted_ball_pending');
  expect(result.timeline.events.filter(event => event.kind === 'BattedBallFirstGroundContact')).toHaveLength(1);
  expect(JSON.stringify(result.timeline)).toBe(JSON.stringify(h.previous.timeline));
  expect(result.field.motion.world.moment.elapsedSeconds).toBeGreaterThan(h.previous.field.motion.world.moment.elapsedSeconds);
  const ordinary = { ...source }; delete ordinary.action;
  expect(() => deriveSamePaPhysicalFieldStep(ordinary, h.root, h.previous, h.previous.evaluationTick, false, h.history)).toThrow();
});

it('retains the new branch for later metadata/free steps and rejects returning to the old version', () => {
  const h = fixture(), source = h.source(h.previous), first = record(h.previous, source, checkpoint({ ...h, source }));
  const history = [...h.history, first];
  for (const kind of metadata) {
    const previous = history.at(-1)!, s = { ...h.source(previous), action: { kind } as never };
    const result = deriveSamePaSourceFieldMetadataV3(s, h.root, previous, history);
    expect(result.ballSolverEvidence).toEqual(previous.ballSolverEvidence);
    history.push({ ...previous, ...result, source: s, operationOrdinal: previous.operationOrdinal + 1, actionResult: { kind } as never } as SamePaPhysicalFieldStep);
  }
  const previous = history.at(-1)!, advance = { ...h.source(previous), throughTick: previous.evaluationTick + 1_000 }; delete advance.action;
  const next = deriveSamePaPhysicalFieldStep(advance, h.root, previous, previous.evaluationTick, false, history);
  expect(next.field.motion.world.kind).toBe('moving');
  expect(next.field.motion.cursor!.sourceCurve!.initial).toEqual(first.field.motion.cursor!.sourceCurve!.initial);
  expect(() => assertSamePaFieldBallPhysicsStep({ ...advance, sourceVersion: OLD }, h.root.source, previous.source, false)).toThrow('original version');
  const metadataEntry = { ...h.source(h.previous), action: { kind: metadata[0] } as never };
  expect(() => assertSamePaFieldBallPhysicsStep(metadataEntry, h.root.source, h.previous.source, false)).toThrow('initial positive checkpoint');
});

it('rejects exact-zero waits, different ticks, marker/result injection, unsupported motor/custody and legacy roots', () => {
  const h = fixture(), source = h.source(h.previous);
  for (const tick of [source.throughTick - 1, source.throughTick + 1]) expect(() => checkpoint({ ...h, source: { ...source, throughTick: tick } })).toThrow();
  expect(() => checkpoint({ ...h, previous: h.root, history: [h.root], source: h.source(h.root) })).toThrow();
  expect(() => checkpoint({ ...h, source: { ...source, action: { kind: 'source_integer_boundary_checkpoint_v1', boundary: {} } as never } })).toThrow();
  for (const kind of ['defender_motion_v1', 'capture_checkpoint_v1', 'throw_plan_v1', 'retained_quantizer_checkpoint_v1']) {
    expect(() => checkpoint({ ...h, source: { ...source, action: { kind } as never } })).toThrow();
  }
  const legacy = { ...h.root.source, sourceVersion: 'same_pa_field_root_aero_ground_continuous_v2' };
  expect(() => assertSamePaFieldBallPhysicsStep(source, legacy, legacy, true)).toThrow('original version');
  expect(() => samePaPhysicalFieldActionInput({ kind: 'source_integer_boundary_checkpoint_v1', elapsedSeconds: .1 } as never)).toThrow();
});

it('rejects forged prefix refs, metadata, Source side/state, actors and saved checkpoint diagnostics', () => {
  const h = fixture(), source = h.source(h.previous);
  const c = h.previous.field.motion.cursor!, motion = h.previous.field.motion;
  const changed = [
    { ...h.previous, evaluationTick: h.previous.evaluationTick + 1 },
    { ...h.previous, field: { ...h.previous.field, motion: { ...motion, cursor: { ...c, sourceSide: 'incoming' as const } } } },
    { ...h.previous, field: { ...h.previous.field, motion: { ...motion, carrierPlayerId: 'fielder' } } },
    { ...h.previous, field: { ...h.previous.field, motion: { ...motion, cursor: { ...c, moment: { ...c.moment, ball: { ...c.moment.ball, spin: { x: 999, y: 0, z: 0 } } } } } } },
    { ...h.previous, field: { ...h.previous.field, motion: { ...motion, actors: motion.actors.map(a => ({ ...a, primitive: { ...a.primitive, acceleration: { x: 1, y: 0, z: 0 } } })) } } },
    { ...h.previous, timeline: { ...h.previous.timeline, nextSequence: 99 } },
  ];
  for (const bad of changed) expect(() => checkpoint({ ...h, previous: bad, history: [...h.history.slice(0, -1), bad], source: h.source(bad) })).toThrow();
  expect(() => checkpoint({ ...h, source: { ...source, previousFieldReference: { ...source.previousFieldReference, snapshotHash: hash('forged') } } })).toThrow();
  const accepted = record(h.previous, source, checkpoint({ ...h, source }));
  const forged = { ...accepted, actionResult: { ...accepted.actionResult!, status: 'physical_boundary' } } as SamePaPhysicalFieldStep;
  const metadataSource = { ...h.source(forged), action: { kind: metadata[0] } as never };
  expect(() => deriveSamePaSourceFieldMetadataV3(metadataSource, h.root, forged, [...h.history, forged])).toThrow();
});

it('retains an earlier real impulse as a physical boundary, then rederives its private escape before another wait', () => {
  const h = fixture(true), source = h.source(h.previous), first = checkpoint({ ...h, source });
  expect(first.actionResult.status).toBe('physical_boundary');
  expect(first.field.motion.response.kind).toBe('rebound');
  const cursor = first.field.motion.cursor!;
  expect(cursor.moment.elapsedSeconds).toBeLessThan(first.actionResult.boundary.boundaryElapsedSeconds);
  expect(cursor.sourceCurve!.initial).toEqual(cursor.moment);
  expect(cursor.moment.originTick).toBe(h.previous.field.motion.cursor!.moment.originTick);
  const accepted = record(h.previous, source, first), next = checkpoint({ ...h, previous: accepted,
    history: [...h.history, accepted], source: h.source(accepted) });
  expect(next.actionResult.status).toBe('checkpoint_reached');
  expect(next.ballSolverEvidence.escapedIntervals).toHaveLength(1);
  expect(next.field.motion.cursor!.sourceCurve!.initial).toEqual(cursor.sourceCurve!.initial);
});

it('accepts a bounded 50-primitive nine-defender metadata collection while each original record keeps the inert size limit', () => {
  const initial = sourceFieldV3Fixture(), roles = ['body', 'glove', 'tag_hand', 'left_foot', 'right_foot'] as const;
  const zero = { x: 0, y: 0, z: 0 }, material = { restitution: .5, tangentialDamping: .25, spinDamping: .2 };
  const actors = Array.from({ length: 10 }, (_, i) => roles.map((role, j) => ({ playerId: 'p' + i, primitive: {
    ...initial.actors[0].primitive, role, startCenter: { x: 1000 + i * 5, y: 1 + j * .2, z: 1000 } } }))).flat();
  const originalGlove = catchFixture().response.actors[0].profile;
  if (originalGlove.role !== 'glove') throw new Error('missing glove fixture');
  const glove = { ...originalGlove, parameters: { ...originalGlove.parameters, ballRadiusMeters: initial.response.world.parameters.ballRadius } };
  const response = { ...initial.response, world: { ...initial.response.world, actors }, actors: actors.map(a => ({ playerId: a.playerId,
    profile: a.primitive.role === 'glove' ? glove : { role: a.primitive.role, material } })) };
  const h = fixture(false, { ...initial, response, actors, commands: actors.map(a => ({ playerId: a.playerId, role: a.primitive.role, acceleration: zero })) });
  h.history.splice(2); h.previous = h.history.at(-1)!;
  const member = (playerId: string) => ({ playerId, bindingHash: hash(playerId), personHash: hash(playerId + 'person'), baselineSourceId: 'baseline',
    reservedRevision: 0, reservedStateHash: hash('state'), projectedStateHash: hash('projected') });
  const calibration = (playerId: string) => ({ owner: 'pa_lifecycle_v1_execution_calibrations' as const,
    sourceId: playerId + ':calibration', sourceHash: hash(playerId + ':cal'), snapshotHash: hash(playerId + ':cal') });
  // Source shapes/refs and physical snapshots are validated here. Metadata
  // result bodies stand in for the independent owner; this is not Native nine.
  const append = (action: SamePaPhysicalFieldAction, playerId?: string) => {
    samePaPhysicalFieldActionInput(action);
    const source = { ...h.source(h.previous, OLD), action };
    const value = { ...h.previous, source, kind: 'same_pa_physical_field_step_v1', operationOrdinal: h.previous.operationOrdinal + 1,
      actionResult: { kind: action.kind, ...(playerId ? { playerId } : {}) } as never } as SamePaPhysicalFieldStep;
    h.history.push(value); h.previous = value; return value;
  };
  const candidates = Array.from({ length: 9 }, (_, i) => {
    const playerId = 'p' + (i + 1), m = member(playerId);
    const observed = append({ kind: 'defender_observation_v1', member: m, calibrationReference: calibration(playerId),
      previousObservationReference: null, view: { poseVersion: 'shape-fixture', bodyRelativeEyeOffset: zero, forward: { x: 0, y: 0, z: 1 }, attentionTarget: { kind: 'ball' } } }, playerId);
    const decision = append({ kind: 'defender_decision_v1', member: m, calibrationReference: calibration(playerId), observationReference: ref(observed) as never,
      priorities: { ballPursuitPriority: 1, baseCoverPriorities: [], relayPriority: 0, backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0 } }, playerId);
    return append({ kind: 'defender_candidate_set_v1', originalDecisionReference: ref(decision) as never }, playerId);
  });
  const team = append({ kind: 'defender_team_selection_v1', candidateReferences: candidates.map(c => ref(c) as never), requireBallHandler: true });
  for (let i = 1; i <= 9; i++) append({ kind: 'defender_actor_selection_v1', teamSelectionReference: ref(team) as never, member: member('p' + i) }, 'p' + i);
  const input = { root: h.root, previous: h.previous, history: h.history, source: h.source(h.previous) };
  expect(h.root.field.motion.actors).toHaveLength(50);
  expect(() => cloneInert(input)).toThrow('size limits');
  for (const row of h.history) expect(() => cloneInert(row)).not.toThrow();
  const result = checkpoint(input);
  expect(result.actionResult.status).toBe('checkpoint_reached');
  expect(result.field.motion.actors).toEqual(h.previous.field.motion.actors);
  expect(result.field.motion.cursor!.sourceCurve!.initial).toEqual(h.previous.field.motion.cursor!.sourceCurve!.initial);
}, 30_000);

it('rejects active envelopes/records, exotic prototypes, sparse or excessive histories and oversized individual records', () => {
  const h = fixture(), input = { root: h.root, previous: h.previous, history: h.history, source: h.source(h.previous) };
  let reads = 0;
  expect(() => checkpoint({ ...input, get history() { reads++; return h.history; } })).toThrow('properties');
  const rows = [...h.history]; Object.defineProperty(rows, '0', { get() { reads++; return h.root; }, enumerable: true });
  expect(() => checkpoint({ ...input, history: rows })).toThrow('records');
  const active = { ...h.root, get field() { reads++; return h.root.field; } };
  expect(() => checkpoint({ ...input, root: active })).toThrow('accessors');
  expect(reads).toBe(0);
  expect(() => checkpoint(Object.assign(new Date(), input))).toThrow('envelope');
  expect(() => checkpoint({ ...input, history: new Array(2) })).toThrow('records');
  expect(() => checkpoint({ ...input, history: Array.from({ length: 513 }, () => h.root) })).toThrow('records');
  expect(() => checkpoint({ ...input, root: { ...h.root, excessive: Array.from({ length: 100_001 }, () => 0) } as never })).toThrow('size limits');
  let deep: unknown = 0; for (let i = 0; i < 65; i++) deep = { nested: deep };
  expect(() => checkpoint({ ...input, root: { ...h.root, deep } as never })).toThrow('size limits');
});
