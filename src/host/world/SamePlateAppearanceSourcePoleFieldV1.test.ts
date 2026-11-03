import { expect, it } from 'vitest';
import { sourceFieldV3Fixture } from '../../core/sim/ball/SourceBattedFieldMotionV3.test-support';
import { deriveSourceBattedFieldMotionV145 } from '../../core/sim/ball/SourceBattedFieldMotionV145';
import { deriveSourceBattedFieldMotionV3 } from '../../core/sim/ball/SourceBattedFieldMotionV3';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { AcceptedSamePaParkEquipmentV145 } from './SamePlateAppearanceParkEquipmentV145';
import { SAME_PA_SOURCE_POLE_FIELD_ROOT_V1 as ROOT, SAME_PA_SOURCE_POLE_FIELD_STEP_V1 as STEP,
  deriveSamePaSourcePoleFieldStepV1, deriveSamePaSourcePoleFieldMetadataV1,
  type SamePaSourcePoleFieldRootV1, type SamePaSourcePoleFieldStepV1, type SamePaSourcePoleFieldStepSourceV1,
  type SamePaSourcePoleMetadataKindV1 } from './SamePlateAppearanceSourcePoleFieldV1';

// Declared structural replay values only. The initial contact/body/equipment are
// synthetic; real Core queries run, but no Native row, admission or Rule adoption
// is claimed and no full Native fixture is cast into an authentication proof.
const ref = <O extends string>(owner: O, sourceId: string): SamePaReference<O> => ({ owner, sourceId, sourceHash: hash(sourceId), snapshotHash: hash(sourceId) });
type Field = SamePaSourcePoleFieldRootV1 | SamePaSourcePoleFieldStepV1;
const fieldRef = (field: Field) => reference(field.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', field);
const setup = (poleX = 2, rootThroughTick?: number) => {
  const initial = sourceFieldV3Fixture(), equipment: AcceptedSamePaParkEquipmentV145 = { version: 'same_pa_park_equipment_v145', sourceId: 'declared-equipment', sourceVersion: 'synthetic-v1',
    gameId: 'declared-game', playId: 1, physicalPitchSourceId: 'declared-pitch', fixtureEventId: 'declared-fixture', venueId: 'declared-venue',
    baseFieldSourceId: 'declared-root', worldModelSourceId: 'declared-model', worldModelSourceVersion: 'synthetic-v1', availableAtDay: 1,
    fenceSurfaceIds: ['right-wall'], equipment: { version: 'source_park_equipment_v145', poles: [{ geometry: { surfaceId: 'declared-pole', center: { x: poleX, z: 0 }, minimumHeight: 0, maximumHeight: 3, radiusM: 0.1 },
      material: { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.2 } }] } };
  const throughTick = rootThroughTick ?? initial.availableAtTick;
  const groundRollingDecelerationMps2 = initial.response.world.parameters.groundRollingDecelerationMps2;
  if (groundRollingDecelerationMps2 === undefined) throw Error('declared test fixture lacks its explicit ground parameter');
  const trace = deriveSourceBattedFieldMotionV145({ initial, throughTicks: throughTick > initial.availableAtTick ? [throughTick] : [], parkEquipment: equipment.equipment });
  const root: SamePaSourcePoleFieldRootV1 = { kind: 'same_pa_physical_field_root_v1', stage: 'field', physicalPitchSourceId: 'declared-pitch', operationOrdinal: 6, pitchOrdinal: 3,
    lineage: { enrollmentReference: ref('same_pa_enrollments', 'declared-enrollment'), actorReference: ref('physical_plate_appearance_actors', 'declared-actor'), careerId: 'declared-career',
      gameId: 'declared-game', playId: 1, firstPhysicalPitchSourceId: 'declared-first-pitch', participantReferences: [] },
    source: { sourceId: 'declared-root', sourceVersion: ROOT, capability: 'same_pa_physical_field_root_v1', viewReference: ref('pa_lifecycle_v1_execution_views', 'declared-pre-root-view'),
      launchReference: ref('pa_physical_v1_launches', 'declared-pitch'), previousOperationReference: ref('pa_physical_v1_resolutions', 'declared-resolution'),
      resolutionReference: ref('pa_physical_v1_resolutions', 'declared-resolution'), postureReference: ref('batting_observation_v1_postures', 'declared-posture'),
      fieldInputs: { kind: 'fresh_physical_field_calibration_v1', calibrationReference: ref('pa_physical_v1_field_calibrations', 'declared-calibration') },
      throughTick, parameters: { ...initial.response.world.parameters, groundRollingDecelerationMps2 }, ballPhysics: initial.cursor.sourceCurve.profile, parkEquipment: equipment,
      commands: initial.actors.map(a => ({ playerId: a.playerId, bodyAcceleration: { x: 0, y: 0, z: 0 }, primitiveMotions: [{ role: a.primitive.role,
        offsetVelocity: { x: 0, y: 0, z: 0 }, offsetAcceleration: { x: 0, y: 0, z: 0 } }] })) },
    geometryBindingHash: hash('declared-geometry'), parkEquipmentBinding: { equipmentHash: hash(equipment), geometryBindingHash: hash('declared-geometry'),
      fixtureHash: hash('declared-fixture'), worldModelHash: hash('declared-model'), responseModelHash: hash('declared-response') },
    response: initial.response, geometry: initial.geometry, field: trace.field,
    evaluationTick: trace.field.motion.world.moment.ball.tick,
    ballSolverEvidence: { solverVersion: trace.solverVersion, impulseCertificates: trace.impulseCertificates, escapedIntervals: trace.escapedIntervals },
    timeline: { playId: 1, startedAtTick: initial.availableAtTick, lastEventTick: initial.availableAtTick, nextSequence: 0, events: [], status: { kind: 'active', count: { balls: 0, strikes: 0 } } } };
  const source = (previous: Field, horizon = 212345): SamePaSourcePoleFieldStepSourceV1 => ({ sourceId: 'declared-step-' + (previous.operationOrdinal + 1), sourceVersion: STEP,
    capability: 'same_pa_physical_field_step_v1', viewReference: ref('pa_lifecycle_v1_execution_views', 'declared-view-' + previous.operationOrdinal), launchReference: root.source.launchReference,
    previousOperationReference: fieldRef(previous), previousFieldReference: fieldRef(previous), fieldRootReference: reference('pa_physical_v1_field_roots', root), throughTick: horizon });
  const advance = (previous: Field, history: readonly Field[], horizon = 212345): SamePaSourcePoleFieldStepV1 => {
    const s = source(previous, horizon), result = deriveSamePaSourcePoleFieldStepV1(s, root, previous, history);
    return { kind: 'same_pa_physical_field_step_v1', stage: 'field', physicalPitchSourceId: root.physicalPitchSourceId, pitchOrdinal: root.pitchOrdinal,
      lineage: root.lineage, operationOrdinal: previous.operationOrdinal + 1, source: s, evaluationTick: result.field.motion.world.moment.ball.tick,
      field: result.field, ballSolverEvidence: result.ballSolverEvidence, timeline: previous.timeline };
  };
  return { initial, root, source, advance };
};

it('PF218-01 replays the actual earliest pole and departure with the original unrounded Source clock', () => {
  const h = setup(), before = structuredClone(h.root), first = h.advance(h.root, [h.root]), next = h.advance(first, [h.root, first]);
  expect(first.field.motion.world).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'surface', surfaceId: 'declared-pole' }] });
  expect(first.field.motion.response.kind).toBe('rebound'); expect(next.field.motion.world.kind).toBe('moving');
  expect(first.field.motion.world.moment.elapsedSeconds).not.toBe((first.evaluationTick - h.initial.availableAtTick) / 1e6);
  expect(next.ballSolverEvidence.solverVersion).toBe('source_field_pole_contact_escape_v145');
  expect(next.ballSolverEvidence.impulseCertificates).toHaveLength(1); expect(next.ballSolverEvidence.escapedIntervals).toHaveLength(1);
  expect(h.root).toEqual(before); expect(next).not.toHaveProperty('nativeAccepted'); expect(next).not.toHaveProperty('officialResult');
});

it('PF218-02 retains an earlier wall ahead of a farther pole and matches v3 physical fields with explicit empty equipment', () => {
  const h = setup(20), first = h.advance(h.root, [h.root]);
  expect(first.field.motion.world).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'surface', surfaceId: 'right-wall' }] });
  const empty = { ...h.root.source.parkEquipment, equipment: { ...h.root.source.parkEquipment.equipment, poles: [] } };
  const root: SamePaSourcePoleFieldRootV1 = { ...h.root, source: { ...h.root.source, parkEquipment: empty }, parkEquipmentBinding: { ...h.root.parkEquipmentBinding, equipmentHash: hash(empty) } };
  const source = { ...h.source(root), fieldRootReference: reference('pa_physical_v1_field_roots', root), previousFieldReference: fieldRef(root), previousOperationReference: fieldRef(root) };
  const actual = deriveSamePaSourcePoleFieldStepV1(source, root, root, [root]);
  expect(actual.field).toEqual(deriveSourceBattedFieldMotionV3({ initial: h.initial, throughTicks: [source.throughTick] }).field);
});

it('PF218-03 accepts only the five same-cut metadata envelopes without adding a Core horizon', () => {
  const h = setup(), first = h.advance(h.root, [h.root]), history: Field[] = [h.root, first];
  const kinds: SamePaSourcePoleMetadataKindV1[] = ['defender_observation_v1', 'defender_decision_v1', 'defender_candidate_set_v1', 'defender_team_selection_v1', 'defender_actor_selection_v1'];
  for (const kind of kinds) {
    const previous = history.at(-1)!, source = { ...h.source(previous, previous.evaluationTick), action: { kind } };
    const result = deriveSamePaSourcePoleFieldMetadataV1(source, h.root, previous, history);
    expect(result).toEqual({ ballSolverEvidence: previous.ballSolverEvidence });
    const metadata: SamePaSourcePoleFieldStepV1 = { ...first, source, operationOrdinal: previous.operationOrdinal + 1, actionResult: { kind }, ...result };
    history.push(metadata);
  }
  expect(h.advance(history.at(-1)!, history).field).toEqual(h.advance(first, [h.root, first]).field);
});

it('PF218-04 retains a positive-time Root horizon and evidence indexing through metadata', () => {
  const h = setup(2, 112345), source = { ...h.source(h.root, h.root.evaluationTick), action: { kind: 'defender_observation_v1' as const } };
  const result = deriveSamePaSourcePoleFieldMetadataV1(source, h.root, h.root, [h.root]); expect(result.ballSolverEvidence).toEqual(h.root.ballSolverEvidence);
  const metadata: SamePaSourcePoleFieldStepV1 = { kind: 'same_pa_physical_field_step_v1', stage: 'field', physicalPitchSourceId: h.root.physicalPitchSourceId,
    lineage: h.root.lineage, pitchOrdinal: h.root.pitchOrdinal, operationOrdinal: h.root.operationOrdinal + 1, source, evaluationTick: h.root.evaluationTick,
    field: h.root.field, timeline: h.root.timeline, actionResult: { kind: 'defender_observation_v1' }, ...result };
  expect(h.advance(metadata, [h.root, metadata]).field).toEqual(h.advance(h.root, [h.root]).field);
});

it('PF218-05 rejects missing, spliced or altered history instead of trusting saved cursor and solver diagnostics', () => {
  const h = setup(), first = h.advance(h.root, [h.root]);
  expect(() => h.advance(first, [first])).toThrow();
  for (const changed of [{ ...first, operationOrdinal: first.operationOrdinal + 1 }, { ...first, pitchOrdinal: 4 },
    { ...first, ballSolverEvidence: { ...first.ballSolverEvidence, impulseCertificates: [] } },
    { ...first, evaluationTick: first.evaluationTick + 1 }]) expect(() => h.advance(changed, [h.root, changed])).toThrow();
  const c = first.field.motion.cursor!;
  const changed = { ...first, field: { ...first.field, motion: { ...first.field.motion, cursor: { ...c, moment: { ...c.moment, ball: { ...c.moment.ball, spin: { x: 999, y: 0, z: 0 } } } } } } };
  expect(() => h.advance(changed, [h.root, changed])).toThrow();
});

it('PF218-06 rejects metadata time, physical field, timeline or evidence changes and custody', () => {
  const h = setup(), first = h.advance(h.root, [h.root]), source = { ...h.source(first, first.evaluationTick), action: { kind: 'defender_observation_v1' as const } };
  expect(() => deriveSamePaSourcePoleFieldMetadataV1({ ...source, throughTick: source.throughTick + 1 }, h.root, first, [h.root, first])).toThrow();
  const result = deriveSamePaSourcePoleFieldMetadataV1(source, h.root, first, [h.root, first]);
  const metadata: SamePaSourcePoleFieldStepV1 = { ...first, source, operationOrdinal: first.operationOrdinal + 1, actionResult: { kind: 'defender_observation_v1' }, ...result };
  for (const changed of [{ ...metadata, timeline: { ...metadata.timeline, nextSequence: 99 } },
    { ...metadata, ballSolverEvidence: { ...metadata.ballSolverEvidence, impulseCertificates: [] } },
    { ...metadata, field: { ...metadata.field, motion: { ...metadata.field.motion, carrierPlayerId: 'fielder' } } }])
    expect(() => h.advance(changed, [h.root, first, changed])).toThrow();
});

it('PF218-07 rejects an old/mixed family, wrong fullrefs, invalid equipment binding and nonstationary commands', () => {
  const h = setup(), source = h.source(h.root);
  expect(() => deriveSamePaSourcePoleFieldStepV1({ ...source, previousFieldReference: { ...source.previousFieldReference, snapshotHash: hash('foreign') } }, h.root, h.root, [h.root])).toThrow();
  const foreignRoot = { ...h.root, source: { ...h.root.source, sourceVersion: 'same_pa_field_root_aero_ground_escape_v3' as typeof ROOT } };
  expect(() => deriveSamePaSourcePoleFieldStepV1(source, foreignRoot, foreignRoot, [foreignRoot])).toThrow();
  const invalidEquipment = { ...h.root, parkEquipmentBinding: { ...h.root.parkEquipmentBinding, equipmentHash: hash('foreign') } };
  const moving = { ...h.root, source: { ...h.root.source, commands: h.root.source.commands.map(c => ({ ...c, bodyAcceleration: { x: 1, y: 0, z: 0 } })) } };
  for (const [root, reason] of [[invalidEquipment, /equipment/], [moving, /stationary/]] as const) {
    const s = { ...source, fieldRootReference: reference('pa_physical_v1_field_roots', root), previousFieldReference: fieldRef(root), previousOperationReference: fieldRef(root) };
    expect(() => deriveSamePaSourcePoleFieldStepV1(s, root, root, [root])).toThrow(reason);
  }
});

it('PF218-08 rejects actual simultaneous contacts and unsupported motion, expiry and action envelopes', () => {
  const h = setup(), firstPole = h.root.source.parkEquipment.equipment.poles[0];
  const equipment = { ...h.root.source.parkEquipment, equipment: { ...h.root.source.parkEquipment.equipment,
    poles: [firstPole, { ...firstPole, geometry: { ...firstPole.geometry, surfaceId: 'second-declared-pole' } }] } };
  const trace = deriveSourceBattedFieldMotionV145({ initial: h.initial, throughTicks: [212345], parkEquipment: equipment.equipment });
  expect(trace.field.motion.world).toMatchObject({ kind: 'boundary', contacts: [{ surfaceId: 'declared-pole' }, { surfaceId: 'second-declared-pole' }] });
  expect(trace.impulseCertificates).toHaveLength(0);
  const root = { ...h.root, source: { ...h.root.source, parkEquipment: equipment }, parkEquipmentBinding: { ...h.root.parkEquipmentBinding, equipmentHash: hash(equipment) } };
  const s = { ...h.source(root), fieldRootReference: reference('pa_physical_v1_field_roots', root) };
  expect(() => deriveSamePaSourcePoleFieldStepV1(s, root, root, [root])).toThrow();
  const source = { ...h.source(h.root, h.root.evaluationTick), action: { kind: 'defender_motion_v1' as SamePaSourcePoleMetadataKindV1 } };
  expect(() => deriveSamePaSourcePoleFieldMetadataV1(source, h.root, h.root, [h.root])).toThrow();
  expect(() => h.advance(h.root, [h.root], h.initial.coverageThroughTick + 1)).toThrow();
  expect(() => deriveSamePaSourcePoleFieldStepV1({ ...h.source(h.root), action: { kind: 'defender_observation_v1' as const } }, h.root, h.root, [h.root])).toThrow();
});
