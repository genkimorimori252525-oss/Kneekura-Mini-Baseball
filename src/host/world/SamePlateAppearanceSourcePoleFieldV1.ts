import { isDeepStrictEqual } from 'node:util';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { deriveSourceBattedFieldMotionV145, type SourceBattedFieldMotionTraceV145 } from '../../core/sim/ball/SourceBattedFieldMotionV145';
import type { BattedWorldFieldMotionAdoptionInput } from '../../core/sim/ball/BattedWorldFieldMotion';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldRootSource, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import { samePaParkEquipmentInputV145, type AcceptedSamePaParkEquipmentV145, type SamePaParkEquipmentBindingV145 } from './SamePlateAppearanceParkEquipmentV145';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaFields as fields, samePaHash } from './SamePlateAppearanceWorkPrefix';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

// Reserved prospective replay family only. No existing parser, Root writer,
// clock verifier or field-action executor selects these versions yet.
export const SAME_PA_SOURCE_POLE_FIELD_ROOT_V1 = 'same_pa_field_root_aero_ground_pole_escape_v1';
export const SAME_PA_SOURCE_POLE_FIELD_STEP_V1 = 'same_pa_field_step_aero_ground_pole_escape_v1';
export type SamePaSourcePoleMetadataKindV1 = 'defender_observation_v1' | 'defender_decision_v1' | 'defender_candidate_set_v1'
  | 'defender_team_selection_v1' | 'defender_actor_selection_v1';
type MetadataEnvelope = Readonly<{ kind: SamePaSourcePoleMetadataKindV1 }>;
type Evidence = Pick<SourceBattedFieldMotionTraceV145, 'solverVersion' | 'impulseCertificates' | 'escapedIntervals'>;
type Basis = Pick<SamePaPhysicalFieldRoot, 'stage' | 'lineage' | 'pitchOrdinal' | 'operationOrdinal' | 'evaluationTick' | 'physicalPitchSourceId' | 'timeline' | 'field'>;
export type SamePaSourcePoleFieldRootSourceV1 = Omit<SamePaPhysicalFieldRootSource, 'sourceVersion' | 'ballPhysics' | 'parkEquipment'> & Readonly<{
  sourceVersion: typeof SAME_PA_SOURCE_POLE_FIELD_ROOT_V1; ballPhysics: NonNullable<SamePaPhysicalFieldRootSource['ballPhysics']>;
  parkEquipment: AcceptedSamePaParkEquipmentV145;
}>;
/** Replay envelopes intentionally do not certify a sensory/decision payload.
 * The future normal owner must validate each complete action and receipt. */
export type SamePaSourcePoleFieldStepSourceV1 = Omit<SamePaPhysicalFieldStepSource, 'sourceVersion' | 'action'> & Readonly<{
  sourceVersion: typeof SAME_PA_SOURCE_POLE_FIELD_STEP_V1; action?: MetadataEnvelope;
}>;
/** These are structural replay inputs, not Native acceptance receipts. A future
 * normal reader supplies the complete actual records; this pure calculation
 * cannot authenticate a DB row, fixture, Person, Rule Source or Root adoption. */
export type SamePaSourcePoleFieldRootV1 = Basis & Pick<SamePaPhysicalFieldRoot, 'kind' | 'response' | 'geometry' | 'geometryBindingHash'> & Readonly<{
  source: SamePaSourcePoleFieldRootSourceV1; parkEquipmentBinding: SamePaParkEquipmentBindingV145; ballSolverEvidence: Evidence;
}>;
export type SamePaSourcePoleFieldStepV1 = Basis & Pick<SamePaPhysicalFieldStep, 'kind'> & Readonly<{
  source: SamePaSourcePoleFieldStepSourceV1; ballSolverEvidence: Evidence; actionResult?: MetadataEnvelope;
}>;
type Field = SamePaSourcePoleFieldRootV1 | SamePaSourcePoleFieldStepV1;
function fail(detail: string): never { throw Error('same-PA prospective pole replay ' + detail); }
const same = (left: unknown, right: unknown) => { if (!isDeepStrictEqual(left, right)) fail('original field, Source or history differs'); };
const fieldReference = (field: Field) => reference(field.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', field);
const metadata = (value: unknown): value is MetadataEnvelope => value !== null && typeof value === 'object' && 'kind' in value
  && typeof value.kind === 'string' && ['defender_observation_v1', 'defender_decision_v1', 'defender_candidate_set_v1', 'defender_team_selection_v1', 'defender_actor_selection_v1'].includes(value.kind);
const evidence = (trace: SourceBattedFieldMotionTraceV145, index = Infinity): Evidence => ({ solverVersion: trace.solverVersion,
  impulseCertificates: trace.impulseCertificates.filter(c => c.afterStepIndex <= index), escapedIntervals: trace.escapedIntervals.filter(c => c.stepIndex <= index) });

const assertFreeSource = (root: SamePaSourcePoleFieldRootV1, field: Pick<Field, 'field' | 'evaluationTick'>) => {
  const motion = field.field.motion, cursor = motion.cursor, curve = cursor?.sourceCurve, original = root.response.world.sourceCurve;
  if (motion.carrierPlayerId !== null || !cursor || !curve || !original || !['incoming', 'outgoing'].includes(cursor.sourceSide ?? '')
    || !['moving', 'resting', 'ground', 'rolling_stop', 'rebound'].includes(motion.response.kind)
    || curve.initial.originTick !== original.initial.originTick || cursor.moment.originTick !== original.initial.originTick
    || cursor.moment.originTick !== motion.world.moment.originTick || cursor.moment.elapsedSeconds !== motion.world.moment.elapsedSeconds
    || field.evaluationTick !== cursor.moment.ball.tick || field.evaluationTick !== motion.world.moment.ball.tick) fail('requires an exact free Source cursor');
  same(curve.profile, original.profile);
  same(createSourceFreeBallKernel(curve).evaluateAt(cursor.moment.elapsedSeconds, cursor.sourceSide).moment, cursor.moment);
};
const assertStep = (source: SamePaSourcePoleFieldStepSourceV1, root: SamePaSourcePoleFieldRootV1, previous: Field) => {
  if (root.source.sourceVersion !== SAME_PA_SOURCE_POLE_FIELD_ROOT_V1 || source.sourceVersion !== SAME_PA_SOURCE_POLE_FIELD_STEP_V1
    || root.source.capability !== 'same_pa_physical_field_root_v1' || source.capability !== 'same_pa_physical_field_step_v1'
    || previous.source.sourceVersion !== (previous.kind === 'same_pa_physical_field_root_v1' ? SAME_PA_SOURCE_POLE_FIELD_ROOT_V1 : SAME_PA_SOURCE_POLE_FIELD_STEP_V1)) fail('algorithm family differs');
  same(source.fieldRootReference, reference('pa_physical_v1_field_roots', root));
  same(source.previousFieldReference, fieldReference(previous)); same(source.previousOperationReference, source.previousFieldReference);
  same(source.launchReference, root.source.launchReference);
  if (!Number.isSafeInteger(source.throughTick) || source.throughTick < previous.evaluationTick) fail('checkpoint horizon backdates its cut');
};
const equipmentFor = (root: SamePaSourcePoleFieldRootV1) => {
  const equipment = samePaParkEquipmentInputV145(root.source.parkEquipment), binding = root.parkEquipmentBinding;
  if (!binding || !fields(binding, ['equipmentHash', 'fixtureHash', 'worldModelHash', 'responseModelHash', 'geometryBindingHash'])
    || !Object.values(binding).every(samePaHash) || binding.equipmentHash !== hash(equipment) || binding.geometryBindingHash !== root.geometryBindingHash
    || equipment.baseFieldSourceId !== root.source.sourceId || equipment.physicalPitchSourceId !== root.physicalPitchSourceId
    || equipment.physicalPitchSourceId !== root.source.launchReference.sourceId || equipment.gameId !== root.lineage.gameId || equipment.playId !== root.lineage.playId
    || equipment.fenceSurfaceIds.some(id => root.response.world.surfaces.filter(s => s.surfaceId === id).length !== 1)) fail('original equipment binding differs');
  return equipment;
};

/** Rebuild one fresh private Core session from the original contact initial.
 * Saved cursors/certificates are compared after replay; none restore a session. */
const replay = (root: SamePaSourcePoleFieldRootV1, previous: Field, history: readonly Field[], nextThroughTick?: number) => {
  if (root.source.sourceVersion !== SAME_PA_SOURCE_POLE_FIELD_ROOT_V1 || !history.length) fail('original root/history missing');
  same(history[0], root); same(history.at(-1), previous);
  const equipment = equipmentFor(root), curve = root.response.world.sourceCurve;
  if (!curve || curve.initial.elapsedSeconds !== 0 || curve.initial.originTick !== root.response.world.flight.initialBall.tick
    || curve.profile.air.ticksPerSecond !== root.response.world.parameters.ticksPerSecond
    || curve.profile.ground.ticksPerSecond !== root.response.world.parameters.ticksPerSecond) fail('original contact initial or clock missing');
  same(curve.initial.ball, root.response.world.flight.initialBall); same(curve.profile, root.source.ballPhysics); same(root.response.world.parameters, root.source.parameters);
  if (root.source.commands.some(c => Object.values(c.bodyAcceleration).some(n => n !== 0)
    || c.primitiveMotions.some(p => [...Object.values(p.offsetVelocity), ...Object.values(p.offsetAcceleration)].some(n => n !== 0)))) fail('supports stationary commands only');
  const horizons: number[] = [];
  if (root.source.throughTick < curve.initial.ball.tick) fail('Root horizon backdates its contact');
  if (root.source.throughTick > curve.initial.ball.tick) horizons.push(root.source.throughTick);
  for (let i = 1; i < history.length; i++) {
    const field = history[i], prior = history[i - 1];
    if (field.kind !== 'same_pa_physical_field_step_v1' || field.operationOrdinal !== prior.operationOrdinal + 1
      || field.physicalPitchSourceId !== root.physicalPitchSourceId || field.pitchOrdinal !== root.pitchOrdinal || field.stage !== 'field') fail('prefix is not consecutive');
    assertStep(field.source, root, prior); same(field.lineage, root.lineage);
    if (Object.hasOwn(field.source, 'action')) {
      if (!metadata(field.source.action) || field.source.throughTick !== prior.evaluationTick || field.evaluationTick !== prior.evaluationTick
        || field.actionResult?.kind !== field.source.action.kind) fail('metadata changed physical time or action');
      same(field.field, prior.field); same(field.timeline, prior.timeline); same(field.ballSolverEvidence, prior.ballSolverEvidence); assertFreeSource(root, field);
    } else {
      if (field.actionResult !== undefined || field.source.throughTick <= prior.evaluationTick) fail('free checkpoint action or horizon differs');
      horizons.push(field.source.throughTick);
    }
  }
  const initial: BattedWorldFieldMotionAdoptionInput = { response: root.response, geometry: root.geometry, actors: root.response.world.actors, carrierPlayerId: null,
    cursor: { moment: curve.initial, sourceCurve: curve, sourceSide: 'incoming', previousContacts: [] }, availableAtTick: curve.initial.ball.tick,
    coverageThroughTick: Math.min(...root.response.world.actors.map(a => a.primitive.endTick)), commands: root.source.commands.flatMap(c => c.primitiveMotions.map(p => ({ playerId: c.playerId, role: p.role,
      acceleration: { x: c.bodyAcceleration.x + p.offsetAcceleration.x, y: c.bodyAcceleration.y + p.offsetAcceleration.y, z: c.bodyAcceleration.z + p.offsetAcceleration.z } }))) };
  // V145 searches actors/walls/bases/poles together. Do not issue a positive-time
  // pole-blind v3 query before this call or reconstruct contact from rounded ticks.
  const trace = deriveSourceBattedFieldMotionV145({ initial, throughTicks: nextThroughTick === undefined ? horizons : [...horizons, nextThroughTick], parkEquipment: equipment.equipment });
  const physical = [trace.initial, ...trace.steps.map(s => s.field)];
  let index = root.source.throughTick > curve.initial.ball.tick ? 1 : 0;
  for (const [i, field] of history.entries()) {
    if (i > 0 && field.kind === 'same_pa_physical_field_step_v1' && !metadata(field.source.action)) index++;
    same(field.field, physical[index]); same(field.evaluationTick, physical[index].motion.world.moment.ball.tick); same(field.ballSolverEvidence, evidence(trace, index - 1));
  }
  if (index !== horizons.length) fail('original history extent differs');
  return trace;
};

export const deriveSamePaSourcePoleFieldStepV1 = (source: SamePaSourcePoleFieldStepSourceV1, root: SamePaSourcePoleFieldRootV1,
  previous: Field, history: readonly Field[]) => {
  assertStep(source, root, previous);
  if (Object.hasOwn(source, 'action') || source.throughTick <= previous.evaluationTick) fail('physical replay requires a positive free checkpoint');
  const trace = replay(root, previous, history, source.throughTick);
  assertFreeSource(root, { field: trace.field, evaluationTick: trace.field.motion.world.moment.ball.tick });
  return { field: trace.field, ballSolverEvidence: evidence(trace) };
};

export const deriveSamePaSourcePoleFieldMetadataV1 = (source: SamePaSourcePoleFieldStepSourceV1, root: SamePaSourcePoleFieldRootV1,
  previous: Field, history: readonly Field[]) => {
  assertStep(source, root, previous);
  if (!metadata(source.action) || source.throughTick !== previous.evaluationTick) fail('metadata cannot advance physical time');
  const trace = replay(root, previous, history); assertFreeSource(root, previous);
  return { ballSolverEvidence: evidence(trace) };
};
