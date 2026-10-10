import { expect, it } from 'vitest';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battingModelStanceFixture as fixture, modelRows, originalRows, unchangedOriginal, ref,
  type BattingModelFixture } from './NativeBattingModelStanceFixtures.test-support';
import type { DurablePlayerBattingModelV1 } from './PlayerBattingModel';
import { openSqlitePlayerBattingModelStore } from './SqlitePlayerBattingModelStore';

/** Real original Person/body/model, with an intentionally unauthenticated future
 * row as a corruption control. No completed game or learning proof is forged. */
const missingExposureModel = (f: BattingModelFixture, original: DurablePlayerBattingModelV1): DurablePlayerBattingModelV1 => {
  const capability = { ...original.capability, sourceId: 'explicit-later-capability', acceptedAtDay: f.day + 1,
    values: { ...original.capability.values, technicalTimingOffsetTicks: 4_000 } };
  return { ...original, capability, source: { ...original.source, sourceId: 'explicit-later-model', acceptedAtDay: f.day + 1,
    capabilityRef: ref(capability), developmentProvenance: { kind: 'accepted_batting_capability_development_v1',
      originalModelRef: ref(original.source), originalModelSourceHash: hash(original.source), originalModelSnapshotHash: hash(original),
      exposureRef: { sourceId: 'missing-exposure', sourceVersion: 'explicit-test-v1' },
      exposureSourceHash: hash('missing-source'), exposureSnapshotHash: hash('missing-snapshot'),
      assessmentRef: { sourceId: 'accepted-capability-assessment', sourceVersion: 'explicit-test-v1' },
      calibrationRef: { sourceId: 'accepted-capability-calibration', sourceVersion: 'explicit-test-v1' },
      replacementCapabilityHash: hash(capability) } } };
};
const insertCorruptControl = (f: BattingModelFixture, value: DurablePlayerBattingModelV1): void => {
  const s = value.source;
  f.x.f.db.prepare('INSERT INTO world_player_batting_models VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(s.sourceId, s.sourceVersion,
    s.careerId, s.playerId, s.personId, s.personLinkSourceId, s.acceptedAtDay, json(s), hash(s), json(value), hash(value));
};

it('replays an earlier original model without recursively treating a future shared-parameter row as its evidence', () => {
  const f = fixture();
  try {
    const original = f.modelStore.accept(f.source.sourceId), originalBytes = modelRows(f)[0], before = originalRows(f);
    const future = missingExposureModel(f, original);
    insertCorruptControl(f, future);
    expect(f.modelStore.read(original.source.sourceId)).toEqual(original);
    expect(f.modelStore.accept(original.source.sourceId)).toEqual(original);
    const offline = f.x.f.track(openSqlitePlayerBattingModelStore(f.x.f.path));
    expect(offline.read(original.source.sourceId)).toEqual(original);
    // Direct access to the tagged row must still replay the original exposure;
    // its locally consistent snapshot/hash never stands in for that proof.
    expect(() => offline.read(future.source.sourceId)).toThrow();
    expect(() => offline.accept(future.source.sourceId)).toThrow();
    expect(() => offline.selectAtDay(f.scope.careerId, f.scope.playerId, future.source.acceptedAtDay)).toThrow();
    expect(modelRows(f).find(row => row.source_id === original.source.sourceId)).toEqual(originalBytes);
    unchangedOriginal(f, before);
  } finally { f.close(); }
});

it('rejects a fresh tagged model without original exposure evidence before saving any capability history', () => {
  const f = fixture();
  try {
    const original = f.modelStore.accept(f.source.sourceId), value = missingExposureModel(f, original);
    f.models.set(value.source.sourceId, value.source); f.capabilities.set(value.capability.sourceId, value.capability);
    const bytes = modelRows(f), before = originalRows(f);
    expect(() => f.modelStore.accept(value.source.sourceId)).toThrow();
    expect(modelRows(f)).toEqual(bytes); unchangedOriginal(f, before);
  } finally { f.close(); }
});

it('keeps shared parameter immutability checks while avoiding future evidence recursion', () => {
  const f = fixture();
  try {
    const original = f.modelStore.accept(f.source.sourceId), future = missingExposureModel(f, original);
    const changed = { ...future, equipment: { ...future.equipment,
      values: { ...future.equipment.values, batPhysical: { ...future.equipment.values.batPhysical, massKg: 1.1 } } } };
    insertCorruptControl(f, changed);
    expect(() => f.modelStore.read(original.source.sourceId)).toThrow('Source was reused with different bytes');
  } finally { f.close(); }
});
