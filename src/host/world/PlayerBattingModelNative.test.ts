import { expect, it } from 'vitest';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { registeredBatterBodyFixture, battingModelStanceFixture as fixture, modelRows, originalRows,
  unchangedOriginal, ref, type BattingModelAuthority } from './NativeBattingModelStanceFixtures.test-support';

it('constructs the genuine registered batter body prerequisite without a batting or legacy pitch result', () => {
  const f = registeredBatterBodyFixture();
  try {
    expect(f.receipt.source.role).toBe('batter');
    expect(f.receipt.body).toEqual(f.body);
    expect(f.receipt.pose).toEqual(f.pose);
    expect(f.receipt.reachCalibration).toEqual(f.reach);
    expect(f.materializations.read(f.request.sourceId)).toEqual(f.receipt);
    expect(f.x.pitches.readProgress(f.actor.source.gameId, f.actor.match.playId)).toBeNull();
  } finally { f.close(); }
});

it('accepts the original Person-bound batting model with exact independently accepted inputs and nested body receipt', () => {
  const f = fixture();
  try {
    const before = originalRows(f), value = f.modelStore.accept(f.source.sourceId);
    expect(value).toEqual({ source: f.source, person: f.person, bodyMaterialization: f.receipt,
      capability: f.capability, repertoire: f.repertoire, decisionModel: f.decision, equipment: f.equipment,
      observationCalibration: f.observation, predictionCalibration: f.prediction });
    expect(value.source.bodyMaterializationRef).toEqual(ref(f.receipt.source));
    expect(value.source.bodyRef).toEqual(ref(f.receipt.body));
    expect(value.source.poseRef).toEqual(ref(f.receipt.pose));
    expect(value.source.bodyMaterializationRef).not.toHaveProperty('revision');
    expect(value).not.toHaveProperty('predictions');
    expect(value).not.toHaveProperty('currentEmotion');
    expect(Object.isFrozen(value.repertoire.values.profiles[0].profile)).toBe(true);
    expect(f.modelStore.read(f.source.sourceId)).toEqual(value);
    expect(f.modelStore.selectAtDay(f.scope.careerId, f.scope.playerId, f.day)).toEqual(value);
    const rows = modelRows(f);
    expect(rows).toHaveLength(1);
    expect(rows[0].source_json).toBe(json(f.source));
    expect(rows[0].source_hash).toBe(hash(f.source));
    expect(rows[0].snapshot_json).toBe(json(value));
    expect(rows[0].snapshot_hash).toBe(hash(value));
    unchangedOriginal(f, before);
  } finally { f.close(); }
});

it('reopens and retries the original model without invoking any live authority or rewriting bytes', () => {
  const f = fixture();
  try {
    const value = f.modelStore.accept(f.source.sourceId), bytes = modelRows(f), before = originalRows(f);
    const offline = f.x.f.track(f.openModel(f.x.f.path));
    expect(offline.read(f.source.sourceId)).toEqual(value);
    expect(offline.accept(f.source.sourceId)).toEqual(value);
    expect(offline.selectAtDay(f.scope.careerId, f.scope.playerId, f.day)).toEqual(value);
    expect(modelRows(f)).toEqual(bytes);
    let calls = 0;
    const unavailable = (): never => { calls++; throw new Error('unexpected live model callback'); };
    const authority: BattingModelAuthority = { readAcceptedModel: unavailable, readAcceptedCapability: unavailable,
      readAcceptedRepertoire: unavailable, readAcceptedDecisionModel: unavailable, readAcceptedEquipment: unavailable,
      readAcceptedObservationCalibration: unavailable, readAcceptedPredictionCalibration: unavailable };
    const readOnly = f.x.f.track(f.openModel(f.x.f.path, authority));
    expect(readOnly.read(f.source.sourceId)).toEqual(value);
    expect(calls).toBe(0);
    unchangedOriginal(f, before);
  } finally { f.close(); }
});

it('keeps two registered Persons own body and distinct explicit capability/repertoire inputs separate', () => {
  const f = fixture();
  try {
    const first = f.modelStore.accept(f.source.sourceId), other = f.x.f.links.readLink('intake-away-2')!;
    expect(other.playerId).toBe('away-2');
    const scope = { careerId: other.careerId, playerId: other.playerId, personId: other.personId, personLinkSourceId: other.sourceId };
    const body = { ...f.body, ...scope, sourceId: 'other-batting-body', physicalProfile: { heightMeters: 1.9 } };
    const pose = { ...f.pose, ...scope, sourceId: 'other-batting-pose', bodyRef: ref(body) };
    const request = { ...f.request, ...scope, sourceId: 'other-body-materialization', bodyRef: ref(body), poseRef: ref(pose) };
    f.bodies.set(body.sourceId, body); f.poses.set(pose.sourceId, pose); f.requests.set(request.sourceId, request);
    const result = f.materializations.accept(request.sourceId);
    expect(result.kind).toBe('materialized');
    if (result.kind !== 'materialized') throw new Error('BODY_PREREQUISITE: second original Person body is pending');
    const capability = { ...f.capability, ...scope, sourceId: 'other-batting-capability', sourceVersion: 'other-test-motor-v1',
      values: { ...f.capability.values, motorLatencyTicks: 25_000, technicalTimingOffsetTicks: 10_000 } };
    const repertoire = { ...f.repertoire, ...scope, sourceId: 'other-batting-repertoire', sourceVersion: 'other-test-repertoire-v1',
      values: { ...f.repertoire.values, repertoireId: 'other-explicit-test-repertoire', profiles: f.repertoire.values.profiles.map(row => ({
        ...row, profile: { ...row.profile, profileId: 'other-explicit-test-course', baseContactSweetSpotSpeedMps: 32 } })) } };
    const decision = { ...f.decision, ...scope, sourceId: 'other-batting-decision' };
    const equipment = { ...f.equipment, ...scope, sourceId: 'other-batting-equipment' };
    const observation = { ...f.observation, ...scope, sourceId: 'other-batting-observation-calibration' };
    const prediction = { ...f.prediction, ...scope, sourceId: 'other-batting-prediction-calibration' };
    f.capabilities.set(capability.sourceId, capability); f.repertoires.set(repertoire.sourceId, repertoire);
    f.decisions.set(decision.sourceId, decision); f.equipments.set(equipment.sourceId, equipment);
    f.observations.set(observation.sourceId, observation); f.predictions.set(prediction.sourceId, prediction);
    const source = { ...f.source, ...scope, sourceId: 'other-batting-model', bodyMaterializationRef: ref(result.value.source),
      bodyRef: ref(body), poseRef: ref(pose), capabilityRef: ref(capability), repertoireRef: ref(repertoire),
      decisionModelRef: ref(decision), equipmentRef: ref(equipment), observationCalibrationRef: ref(observation), predictionCalibrationRef: ref(prediction) };
    f.models.set(source.sourceId, source);
    const second = f.modelStore.accept(source.sourceId);
    expect(second.person).toEqual(other);
    expect(second.bodyMaterialization).toEqual(result.value);
    expect(second.capability).toEqual(capability);
    expect(second.repertoire).toEqual(repertoire);
    expect(second.capability.values).not.toEqual(first.capability.values);
    expect(f.modelStore.read(first.source.sourceId)).toEqual(first);
    const swapped = { ...f.source, sourceId: 'swapped-real-person-model', bodyMaterializationRef: ref(result.value.source), bodyRef: ref(body), poseRef: ref(pose) };
    f.models.set(swapped.sourceId, swapped);
    const before = modelRows(f);
    expect(() => f.modelStore.accept(swapped.sourceId)).toThrow();
    expect(modelRows(f)).toEqual(before);
  } finally { f.close(); }
});

it.each(['person', 'body', 'pose', 'materialization-version', 'future', 'before-intake'] as const)
('rejects a model with foreign or inapplicable %s evidence before saving any row', kind => {
  const f = fixture();
  try {
    const source = kind === 'person' ? { ...f.source, personId: 'person-away-2' }
      : kind === 'body' ? { ...f.source, bodyRef: { ...f.source.bodyRef, sourceId: 'unowned-body' } }
      : kind === 'pose' ? { ...f.source, poseRef: { ...f.source.poseRef, sourceId: 'unowned-pose' } }
      : kind === 'materialization-version' ? { ...f.source, bodyMaterializationRef: { ...f.source.bodyMaterializationRef, sourceVersion: 'other-version' } }
      : kind === 'future' ? { ...f.source, acceptedAtDay: f.day - 1 }
      : { ...f.source, acceptedAtDay: f.person.acceptedAtDay - 1 };
    f.models.set(source.sourceId, source);
    const before = originalRows(f);
    expect(() => f.modelStore.accept(source.sourceId)).toThrow();
    expect(modelRows(f)).toEqual([]);
    unchangedOriginal(f, before);
  } finally { f.close(); }
});

it.each(['capability', 'repertoire', 'decision', 'equipment', 'observation', 'prediction'] as const)
('rejects a missing nonnull accepted %s input instead of filling a fixture default', kind => {
  const f = fixture();
  try {
    const maps = { capability: f.capabilities, repertoire: f.repertoires, decision: f.decisions,
      equipment: f.equipments, observation: f.observations, prediction: f.predictions };
    maps[kind].clear();
    const before = originalRows(f);
    expect(() => f.modelStore.accept(f.source.sourceId)).toThrow();
    expect(modelRows(f)).toEqual([]);
    unchangedOriginal(f, before);
  } finally { f.close(); }
});

it.each(['foreign-capability', 'future-repertoire', 'zero-motor-delay', 'zero-sensory-delay'] as const)
('rejects %s without changing original body or actor evidence', kind => {
  const f = fixture();
  try {
    if (kind === 'foreign-capability') f.capabilities.set(f.capability.sourceId, { ...f.capability, playerId: 'away-2', personId: 'person-away-2' });
    if (kind === 'future-repertoire') f.repertoires.set(f.repertoire.sourceId, { ...f.repertoire, acceptedAtDay: f.day + 1 });
    if (kind === 'zero-motor-delay') f.capabilities.set(f.capability.sourceId, { ...f.capability, values: { ...f.capability.values, motorLatencyTicks: 0 } });
    if (kind === 'zero-sensory-delay') f.observations.set(f.observation.sourceId, { ...f.observation, values: { ...f.observation.values, deliveryLatencyTicks: 0 } });
    const before = originalRows(f);
    expect(() => f.modelStore.accept(f.source.sourceId)).toThrow();
    expect(modelRows(f)).toEqual([]);
    unchangedOriginal(f, before);
  } finally { f.close(); }
});

it('rejects caller prediction and display fields without evaluating an accessor', () => {
  const f = fixture();
  try {
    let evaluations = 0;
    const poisoned = { ...f.source, displayRating: 99 };
    Object.defineProperty(poisoned, 'predictions', { enumerable: true, get() { evaluations++; return []; } });
    f.models.set(f.source.sourceId, poisoned);
    expect(() => f.modelStore.accept(f.source.sourceId)).toThrow();
    expect(evaluations).toBe(0);
    expect(modelRows(f)).toEqual([]);
  } finally { f.close(); }
});

it('rejects changed same-ID model or parameter bytes while preserving the original immutable archive', () => {
  const f = fixture();
  try {
    const value = f.modelStore.accept(f.source.sourceId), bytes = modelRows(f);
    f.models.set(f.source.sourceId, { ...f.source, sourceVersion: 'changed-model-version' });
    expect(() => f.modelStore.accept(f.source.sourceId)).toThrow();
    f.models.set(f.source.sourceId, f.source);
    f.capabilities.set(f.capability.sourceId, { ...f.capability, values: { ...f.capability.values, technicalTimingOffsetTicks: 1 } });
    expect(() => f.modelStore.accept(f.source.sourceId)).toThrow();
    expect(f.modelStore.read(f.source.sourceId)).toEqual(value);
    expect(modelRows(f)).toEqual(bytes);
  } finally { f.close(); }
});

it('selects later explicitly accepted capability history while reading and retrying original model bytes', () => {
  const f = fixture();
  try {
    const original = f.modelStore.accept(f.source.sourceId), oldBytes = modelRows(f)[0];
    const laterCapability = { ...f.capability, sourceId: 'batting-capability-later', sourceVersion: 'test-motor-v2', acceptedAtDay: f.day + 1,
      values: { ...f.capability.values, technicalTimingOffsetTicks: 10_000 } };
    const later = { ...f.source, sourceId: 'batting-model-later', sourceVersion: 'native-batting-model-v2',
      acceptedAtDay: f.day + 1, capabilityRef: ref(laterCapability) };
    f.capabilities.set(laterCapability.sourceId, laterCapability); f.models.set(later.sourceId, later);
    const accepted = f.modelStore.accept(later.sourceId);
    expect(accepted.capability).toEqual(laterCapability);
    expect(accepted.repertoire).toEqual(original.repertoire);
    expect(f.modelStore.selectAtDay(f.scope.careerId, f.scope.playerId, f.day)).toEqual(original);
    expect(f.modelStore.selectAtDay(f.scope.careerId, f.scope.playerId, f.day + 1)).toEqual(accepted);
    expect(f.modelStore.read(original.source.sourceId)).toEqual(original);
    expect(f.modelStore.accept(original.source.sourceId)).toEqual(original);
    expect(modelRows(f).find(row => row.source_id === original.source.sourceId)).toEqual(oldBytes);
  } finally { f.close(); }
});

it('rejects a moved SQL identity whose original source and snapshot still claim the requested model', () => {
  const f = fixture();
  try {
    f.modelStore.accept(f.source.sourceId);
    f.x.f.db.prepare('UPDATE world_player_batting_models SET source_id=? WHERE source_id=?').run('moved-model-index', f.source.sourceId);
    const bytes = modelRows(f);
    expect(() => f.modelStore.read(f.source.sourceId)).toThrow();
    expect(() => f.modelStore.accept(f.source.sourceId)).toThrow();
    expect(modelRows(f)).toEqual(bytes);
  } finally { f.close(); }
});

it.each(['sql-scope', 'sql-day', 'sql-version', 'source-scope', 'snapshot-scope'] as const)
('rejects a model with corrupt %s mirrors even when supplied hashes match the changed JSON', kind => {
  const f = fixture();
  try {
    const value = f.modelStore.accept(f.source.sourceId), before = originalRows(f);
    if (kind === 'sql-scope') f.x.f.db.prepare('UPDATE world_player_batting_models SET player_id=? WHERE source_id=?')
      .run('away-2', f.source.sourceId);
    if (kind === 'sql-day') f.x.f.db.prepare('UPDATE world_player_batting_models SET accepted_at_day=? WHERE source_id=?')
      .run(f.day + 1, f.source.sourceId);
    if (kind === 'sql-version') f.x.f.db.prepare('UPDATE world_player_batting_models SET source_version=? WHERE source_id=?')
      .run('tampered-model-version', f.source.sourceId);
    if (kind === 'source-scope') {
      const changed = { ...f.source, personId: 'person-away-2' };
      f.x.f.db.prepare('UPDATE world_player_batting_models SET source_json=?,source_hash=? WHERE source_id=?')
        .run(json(changed), hash(changed), f.source.sourceId);
    }
    if (kind === 'snapshot-scope') {
      const changed = { ...value, source: { ...value.source, personId: 'person-away-2' } };
      f.x.f.db.prepare('UPDATE world_player_batting_models SET snapshot_json=?,snapshot_hash=? WHERE source_id=?')
        .run(json(changed), hash(changed), f.source.sourceId);
    }
    const corruptBytes = modelRows(f);
    expect(() => f.modelStore.read(f.source.sourceId)).toThrow();
    expect(() => f.modelStore.accept(f.source.sourceId)).toThrow();
    expect(() => f.modelStore.selectAtDay(f.scope.careerId, f.scope.playerId, f.day)).toThrow();
    expect(modelRows(f)).toEqual(corruptBytes);
    unchangedOriginal(f, before);
  } finally { f.close(); }
});

it('rolls back model insertion when a trigger deletes its original body dependency, then retries once', () => {
  const f = fixture();
  try {
    const before = originalRows(f);
    f.x.f.db.exec(`CREATE TRIGGER corrupt_batting_model_body AFTER INSERT ON world_player_batting_models
      BEGIN DELETE FROM world_player_body_materializations WHERE source_id='batting-body-materialization'; END`);
    expect(() => f.modelStore.accept(f.source.sourceId)).toThrow();
    expect(modelRows(f)).toEqual([]);
    unchangedOriginal(f, before);
    f.x.f.db.exec('DROP TRIGGER corrupt_batting_model_body');
    const accepted = f.modelStore.accept(f.source.sourceId);
    expect(accepted.bodyMaterialization).toEqual(f.receipt);
    const reopened = f.x.f.track(f.openModel(f.x.f.path));
    expect(reopened.read(f.source.sourceId)).toEqual(accepted);
  } finally { f.close(); }
});
