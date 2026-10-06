import { expect, it } from 'vitest';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battingModelStanceFixture as fixture, modelRows, originalRows, unchangedOriginal, ref,
  type BattingModelFixture } from './NativeBattingModelStanceFixtures.test-support';

const freshParameters = (f: BattingModelFixture, prefix: string) => {
  const capability = { ...f.capability, sourceId: prefix + '-capability' };
  const repertoire = { ...f.repertoire, sourceId: prefix + '-repertoire' };
  const decision = { ...f.decision, sourceId: prefix + '-decision' };
  const equipment = { ...f.equipment, sourceId: prefix + '-equipment' };
  const observation = { ...f.observation, sourceId: prefix + '-observation' };
  const prediction = { ...f.prediction, sourceId: prefix + '-prediction' };
  f.capabilities.set(capability.sourceId, capability); f.repertoires.set(repertoire.sourceId, repertoire);
  f.decisions.set(decision.sourceId, decision); f.equipments.set(equipment.sourceId, equipment);
  f.observations.set(observation.sourceId, observation); f.predictions.set(prediction.sourceId, prediction);
  return { capability, repertoire, decision, equipment, observation, prediction };
};

const acceptOtherRegisteredModel = (f: BattingModelFixture) => {
  const person = f.x.f.links.readLink('intake-away-2')!;
  expect(person.playerId).toBe('away-2');
  const scope = { careerId: person.careerId, playerId: person.playerId, personId: person.personId, personLinkSourceId: person.sourceId };
  const body = { ...f.body, ...scope, sourceId: 'guard-other-body' };
  const pose = { ...f.pose, ...scope, sourceId: 'guard-other-pose', bodyRef: ref(body) };
  const request = { ...f.request, ...scope, sourceId: 'guard-other-materialization', bodyRef: ref(body), poseRef: ref(pose) };
  f.bodies.set(body.sourceId, body); f.poses.set(pose.sourceId, pose); f.requests.set(request.sourceId, request);
  const result = f.materializations.accept(request.sourceId);
  expect(result.kind).toBe('materialized');
  if (result.kind !== 'materialized') throw new Error('BODY_PREREQUISITE: second original Person body is pending');
  const raw = freshParameters(f, 'guard-other');
  const capability = { ...raw.capability, ...scope }, repertoire = { ...raw.repertoire, ...scope };
  const decision = { ...raw.decision, ...scope }, equipment = { ...raw.equipment, ...scope };
  const observation = { ...raw.observation, ...scope }, prediction = { ...raw.prediction, ...scope };
  f.capabilities.set(capability.sourceId, capability); f.repertoires.set(repertoire.sourceId, repertoire);
  f.decisions.set(decision.sourceId, decision); f.equipments.set(equipment.sourceId, equipment);
  f.observations.set(observation.sourceId, observation); f.predictions.set(prediction.sourceId, prediction);
  const source = { ...f.source, ...scope, sourceId: 'guard-other-model', bodyMaterializationRef: ref(result.value.source),
    bodyRef: ref(body), poseRef: ref(pose), capabilityRef: ref(capability), repertoireRef: ref(repertoire), decisionModelRef: ref(decision),
    equipmentRef: ref(equipment), observationCalibrationRef: ref(observation), predictionCalibrationRef: ref(prediction) };
  f.models.set(source.sourceId, source);
  const value = f.modelStore.accept(source.sourceId);
  expect(value.person).toEqual(person); expect(value.bodyMaterialization).toEqual(result.value);
  return value;
};

const rejected = (operation: () => unknown): boolean => {
  try { operation(); return false; } catch (error) { if (!(error instanceof Error)) throw error; return true; }
};

it.each(['body', 'pose'] as const)('rejects a hidden foreign model whose nested %s claims the original Player history', key => {
  const f = fixture();
  try {
    const original = f.modelStore.accept(f.source.sourceId), other = acceptOtherRegisteredModel(f);
    expect(f.modelStore.selectAtDay(f.scope.careerId, f.scope.playerId, f.day)).toEqual(original);
    const before = originalRows(f);
    const changed = { ...other, bodyMaterialization: { ...other.bodyMaterialization,
      [key]: { ...other.bodyMaterialization[key], ...f.scope } } };
    f.x.f.db.prepare('UPDATE world_player_batting_models SET snapshot_json=?,snapshot_hash=? WHERE source_id=?')
      .run(json(changed), hash(changed), other.source.sourceId);
    const bytes = modelRows(f);
    expect(rejected(() => f.modelStore.selectAtDay(f.scope.careerId, f.scope.playerId, f.day)),
      `BATTING_MODEL_NESTED_${key.toUpperCase()}_HISTORY_GUARD_MISSING: genuine original models accepted before conflicting nested ownership`).toBe(true);
    expect(modelRows(f)).toEqual(bytes); unchangedOriginal(f, before);
  } finally { f.close(); }
});

it('rejects a same-day new model with fresh parameter IDs after the original SQL Player identity moved', () => {
  const f = fixture();
  try {
    const original = f.modelStore.accept(f.source.sourceId);
    expect(f.modelStore.read(original.source.sourceId)).toEqual(original);
    const parameters = freshParameters(f, 'guard-new');
    const source = { ...f.source, sourceId: 'guard-new-model', capabilityRef: ref(parameters.capability),
      repertoireRef: ref(parameters.repertoire), decisionModelRef: ref(parameters.decision), equipmentRef: ref(parameters.equipment),
      observationCalibrationRef: ref(parameters.observation), predictionCalibrationRef: ref(parameters.prediction) };
    f.models.set(source.sourceId, source);
    f.x.f.db.prepare('UPDATE world_player_batting_models SET player_id=? WHERE source_id=?').run('away-2', f.source.sourceId);
    const before = originalRows(f), bytes = modelRows(f);
    expect(rejected(() => f.modelStore.accept(source.sourceId)),
      'BATTING_MODEL_CURRENT_HISTORY_GUARD_MISSING: original model accepted before moved SQL scope and fresh same-day inputs').toBe(true);
    expect(modelRows(f)).toEqual(bytes); unchangedOriginal(f, before);
  } finally { f.close(); }
});

it('rejects an explicitly negative prediction viscosity without a coefficient profile after genuine model acceptance', () => {
  const f = fixture();
  try {
    const original = f.modelStore.accept(f.source.sourceId), before = originalRows(f), bytes = modelRows(f);
    const prediction = { ...f.prediction, sourceId: 'guard-invalid-viscosity', acceptedAtDay: f.day + 1,
      values: { ...f.prediction.values, parameters: { ...f.prediction.values.parameters,
        aerodynamics: { ...f.prediction.values.parameters.aerodynamics, airKinematicViscosityM2PerSecond: -1 } } } };
    expect(prediction.values.parameters.aerodynamics).not.toHaveProperty('coefficientProfile');
    const source = { ...f.source, sourceId: 'guard-invalid-viscosity-model', acceptedAtDay: f.day + 1, predictionCalibrationRef: ref(prediction) };
    f.predictions.set(prediction.sourceId, prediction); f.models.set(source.sourceId, source);
    expect(rejected(() => f.modelStore.accept(source.sourceId)),
      'BATTING_MODEL_EXPLICIT_VISCOSITY_GUARD_MISSING: genuine original model accepted before explicit invalid prior input').toBe(true);
    expect(f.modelStore.read(original.source.sourceId)).toEqual(original);
    expect(modelRows(f)).toEqual(bytes); unchangedOriginal(f, before);
  } finally { f.close(); }
});
