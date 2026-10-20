import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BattedWorldFieldMotion, BattedWorldFieldMotionAdoptionInput } from '../../core/sim/ball/BattedWorldFieldMotion';
import { deriveSourceBattedFieldMotionV3, type SourceBattedFieldMotionTraceV3 } from '../../core/sim/ball/SourceBattedFieldMotionV3';
import { deriveFieldIntegerBoundaryV1 } from '../../core/sim/ball/SourceFieldIntegerBoundaryV1';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { assertSamePaFieldBallPhysicsStep, samePaSourceFieldMetadataActionV3,
  SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION, SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION } from './SamePlateAppearanceBallPhysics';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
type Input = Readonly<{ source: SamePaPhysicalFieldStepSource; root: SamePaPhysicalFieldRoot; previous: Field; history: readonly Field[] }>;
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('same-PA integer checkpoint original history differs'); };
const ref = (field: Field) => reference(field.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', field);
const isCheckpoint = (source: SamePaPhysicalFieldStepSource) => source.action?.kind === 'source_integer_boundary_checkpoint_v1';
const evidence = (trace: SourceBattedFieldMotionTraceV3, stepIndex = trace.steps.length - 1) => ({ solverVersion: trace.solverVersion,
  impulseCertificates: trace.impulseCertificates.filter(c => c.afterStepIndex <= stepIndex),
  escapedIntervals: trace.escapedIntervals.filter(c => c.stepIndex <= stepIndex) });

const free = (root: SamePaPhysicalFieldRoot, field: BattedWorldFieldMotion) => {
  const motion = field.motion, cursor = motion.cursor, curve = cursor?.sourceCurve, original = root.response.world.sourceCurve;
  if (motion.carrierPlayerId !== null || !cursor || !curve || !original || !['incoming', 'outgoing'].includes(cursor.sourceSide ?? '')
    || !['moving', 'resting', 'ground', 'rolling_stop', 'rebound'].includes(motion.response.kind)
    || cursor.moment.originTick !== original.initial.originTick || curve.initial.originTick !== original.initial.originTick
    || cursor.moment.elapsedSeconds !== motion.world.moment.elapsedSeconds || cursor.moment.originTick !== motion.world.moment.originTick
    || cursor.moment.ball.tick !== motion.world.moment.ball.tick) throw new Error('same-PA integer checkpoint requires an exact resolved free Source');
  same(curve.profile, original.profile);
  same(createSourceFreeBallKernel(curve).evaluateAt(cursor.moment.elapsedSeconds, cursor.sourceSide).moment, cursor.moment);
  return cursor;
};

const checkpointResult = (source: SamePaPhysicalFieldStepSource, root: SamePaPhysicalFieldRoot, prior: BattedWorldFieldMotion,
  priorTick: number, after: BattedWorldFieldMotion) => {
  const start = free(root, prior), end = free(root, after);
  if (!isCheckpoint(source) || Object.keys(source.action!).join('|') !== 'kind') throw new Error('invalid same-PA Source integer checkpoint action');
  const boundary = deriveFieldIntegerBoundaryV1({ originTick: start.moment.originTick, elapsedSeconds: start.moment.elapsedSeconds,
    ticksPerSecond: root.response.world.parameters.ticksPerSecond });
  if (source.throughTick !== priorTick || start.moment.ball.tick !== priorTick || boundary.boundaryTick !== priorTick || !(boundary.waitSeconds > 0)
    || end.moment.ball.tick !== priorTick || !(end.moment.elapsedSeconds > start.moment.elapsedSeconds)
    || end.moment.elapsedSeconds > boundary.boundaryElapsedSeconds) throw new Error('same-PA integer checkpoint requires same-tick positive physical wait');
  same(after.motion.actors, prior.motion.actors);
  const physicalBoundary = after.motion.world.kind === 'boundary';
  if (!physicalBoundary) {
    if (end.moment.elapsedSeconds !== boundary.boundaryElapsedSeconds) throw new Error('same-PA integer checkpoint endpoint differs');
    same(end.sourceCurve!.initial, start.sourceCurve!.initial); same(end.sourceCurve!.profile, start.sourceCurve!.profile);
  }
  return { kind: 'source_integer_boundary_checkpoint_v1' as const, boundary,
    status: physicalBoundary ? 'physical_boundary' as const : 'checkpoint_reached' as const };
};

/** The Native owner authenticates every original row/ref/Source/current cut on
 * its pinned read phase before entering here. This additionally replays all
 * physical horizons and checks every retained field and diagnostic, including
 * pre-branch metadata. Stored cursors/certificates never restore the session. */
const replay = ({ source, root, previous, history }: Input, mode: 'checkpoint' | 'metadata' | 'advance') => {
  if (source.sourceVersion !== SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION
    || root.source.sourceVersion !== SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION || !history.length) {
    throw new Error('same-PA integer branch requires its original v3 root/history');
  }
  same(history[0], root); same(history.at(-1), previous);
  const links = (current: SamePaPhysicalFieldStepSource, prior: Field) => {
    assertSamePaFieldBallPhysicsStep(current, root.source, prior.source, prior.kind === 'same_pa_physical_field_root_v1');
    same(current.fieldRootReference, ref(root)); same(current.previousFieldReference, ref(prior));
    same(current.previousOperationReference, current.previousFieldReference); same(current.launchReference, root.source.launchReference);
  };
  const curve = root.response.world.sourceCurve;
  if (!curve || curve.initial.elapsedSeconds !== 0 || curve.initial.originTick !== root.response.world.flight.initialBall.tick) {
    throw new Error('same-PA integer branch original Source basis missing');
  }
  same(curve.profile, root.source.ballPhysics); same(curve.initial.ball, root.response.world.flight.initialBall);
  same(root.response.world.parameters, root.source.parameters);
  const initial: BattedWorldFieldMotionAdoptionInput = { response: root.response, geometry: root.geometry, actors: root.response.world.actors,
    carrierPlayerId: null, cursor: { moment: curve.initial, sourceCurve: curve, sourceSide: 'incoming', previousContacts: [] },
    availableAtTick: curve.initial.ball.tick, coverageThroughTick: Math.min(...root.response.world.actors.map(a => a.primitive.endTick)),
    commands: root.source.commands.flatMap(c => c.primitiveMotions.map(p => ({ playerId: c.playerId, role: p.role,
      acceleration: { x: c.bodyAcceleration.x + p.offsetAcceleration.x, y: c.bodyAcceleration.y + p.offsetAcceleration.y,
        z: c.bodyAcceleration.z + p.offsetAcceleration.z } }))) };
  const horizons: number[] = root.source.throughTick > curve.initial.ball.tick ? [root.source.throughTick] : [];
  for (let i = 1; i < history.length; i++) {
    const current = history[i], prior = history[i - 1];
    if (current.kind !== 'same_pa_physical_field_step_v1' || current.operationOrdinal !== prior.operationOrdinal + 1
      || current.physicalPitchSourceId !== root.physicalPitchSourceId) throw new Error('same-PA integer branch original prefix is not consecutive');
    links(current.source, prior); same(current.lineage, root.lineage);
    if (!samePaSourceFieldMetadataActionV3(current.source.action)) horizons.push(current.source.throughTick);
  }
  links(source, previous);
  if (mode === 'metadata') {
    if (!samePaSourceFieldMetadataActionV3(source.action) || source.throughTick !== previous.evaluationTick) {
      throw new Error('same-PA integer branch metadata cannot advance physical time');
    }
  } else {
    if (mode === 'checkpoint' ? !isCheckpoint(source) : Object.hasOwn(source, 'action') || source.throughTick <= previous.evaluationTick) {
      throw new Error('invalid same-PA integer branch physical request');
    }
    horizons.push(source.throughTick);
  }
  if (horizons.length > 256) throw new Error('same-PA integer branch exceeds physical replay limits');
  const trace = deriveSourceBattedFieldMotionV3({ initial, throughTicks: horizons });
  const fields = [trace.initial, ...trace.steps.map(s => s.field)];
  let index = root.source.throughTick > curve.initial.ball.tick ? 1 : 0;
  for (let i = 0; i < history.length; i++) {
    const current = history[i], prior = history[i - 1];
    if (i > 0) {
      if (current.kind !== 'same_pa_physical_field_step_v1') throw new Error('same-PA integer branch field kind differs');
      if (samePaSourceFieldMetadataActionV3(current.source.action)) {
        if (current.source.throughTick !== prior.evaluationTick || current.evaluationTick !== prior.evaluationTick
          || current.actionResult?.kind !== current.source.action?.kind) throw new Error('same-PA integer branch metadata changed its cut');
        same(current.field, prior.field); same(current.timeline, prior.timeline); same(current.ballSolverEvidence, prior.ballSolverEvidence);
      } else {
        index++;
        if (isCheckpoint(current.source)) same(current.actionResult, checkpointResult(current.source, root, fields[index - 1], prior.evaluationTick, fields[index]));
        else if (Object.hasOwn(current.source, 'action') || current.actionResult !== undefined || current.source.throughTick <= prior.evaluationTick) {
          throw new Error('same-PA integer branch physical history changed its request');
        }
      }
    }
    same(current.field, fields[index]); same(current.ballSolverEvidence, evidence(trace, index - 1));
    if (current.evaluationTick !== fields[index].motion.world.moment.ball.tick) throw new Error('same-PA integer branch field clock differs');
    free(root, fields[index]);
  }
  if (index !== horizons.length - (mode === 'metadata' ? 0 : 1)) throw new Error('same-PA integer branch history extent differs');
  return { trace, prior: fields[index] };
};

/** A history is a bounded collection of separately owner-authenticated records.
 * Keep the original 100k-node/64-depth inert limit for EACH record, rather than
 * combining nine defenders' repeated snapshots into one oversized Source. */
const copied = (raw: Input): Input => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.getOwnPropertySymbols(raw).length
    || ![Object.prototype, null].includes(Object.getPrototypeOf(raw))) throw new Error('invalid same-PA integer replay envelope');
  const descriptors: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(raw);
  if (Object.keys(descriptors).sort().join('|') !== 'history|previous|root|source'
    || Object.values(descriptors).some(d => !('value' in d) || !d.enumerable)) throw new Error('invalid same-PA integer replay properties');
  const rows = descriptors.history.value;
  if (!Array.isArray(rows) || Object.getOwnPropertySymbols(rows).length) throw new Error('invalid same-PA integer replay history');
  const entries = Object.getOwnPropertyDescriptors(rows) as unknown as Record<string, PropertyDescriptor>, length = entries.length.value;
  if (!Number.isSafeInteger(length) || length < 1 || length > 512 || Object.keys(entries).length !== length + 1
    || Array.from({ length }, (_, i) => entries[String(i)]).some(d => !d || !('value' in d) || !d.enumerable)) {
    throw new Error('invalid same-PA integer replay records');
  }
  return { source: cloneInert(descriptors.source.value), root: cloneInert(descriptors.root.value), previous: cloneInert(descriptors.previous.value),
    history: Array.from({ length }, (_, i) => cloneInert(entries[String(i)].value)) };
};

export const deriveSamePaSourceIntegerCheckpointV1 = (raw: Input) => {
  const input = copied(raw), { trace, prior } = replay(input, 'checkpoint');
  return freeze({ field: trace.field, ballSolverEvidence: evidence(trace),
    actionResult: checkpointResult(input.source, input.root, prior, input.previous.evaluationTick, trace.field) });
};
export const deriveSamePaSourceIntegerMetadataV1 = (raw: Input) => {
  const input = copied(raw), { trace } = replay(input, 'metadata');
  return freeze({ ballSolverEvidence: evidence(trace) });
};
export const deriveSamePaSourceIntegerFieldStepV1 = (raw: Input) => {
  const input = copied(raw), { trace } = replay(input, 'advance');
  free(input.root, trace.field);
  return freeze({ field: trace.field, ballSolverEvidence: evidence(trace) });
};
