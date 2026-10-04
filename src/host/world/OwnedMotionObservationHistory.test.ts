import { expect, it } from 'vitest';
import { actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { ownedBattedWorldMotionFixture as fixture } from './OwnedBattedWorldMotionFixtures.test-support';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
it('retains the exact legacy observation hash convention when later physical rows opt into owned motion', () => {
  const x = fixture();
  try {
    const o = installSyntheticObservation(x, 'p2', x.first.source.sourceId);
    const legacy = o.observations.accept(o.observationSource.sourceId);
    expect(legacy).not.toHaveProperty('physicalPrefixHashConvention');
    expect(legacy.physicalPrefixHash).toBe(actorHash(x.prefix(x.first.source.sourceId)));
    const before = x.f.db.prepare('SELECT * FROM actual_field_observations WHERE source_id=?').get(legacy.source.sourceId);
    const owned = x.retain(x.first.source.sourceId, x.at + 200, 'owned-after-legacy-observation');
    x.sources.set(owned.sourceId, owned); x.executions.accept(owned.sourceId);
    const next = { ...o.observationSource, sourceId: 'observation-after-owned-opt-in', executionSourceId: owned.sourceId,
      previousObservationSourceId: legacy.source.sourceId };
    o.observationSources.set(next.sourceId, next);
    expect(o.observations.accept(next.sourceId).physicalPrefixHashConvention).toBe('owned_motion_observation_prefix_manifest_v1');
    expect(o.observations.read(legacy.source.sourceId)).toEqual(legacy);
    expect(o.observations.accept(legacy.source.sourceId)).toEqual(legacy);
    expect(x.f.db.prepare('SELECT * FROM actual_field_observations WHERE source_id=?').get(legacy.source.sourceId)).toEqual(before);
  } finally { x.f.close(); }
});

it('observes a legitimate longer owned command prefix without treating repeated snapshot size as a causal-cycle limit', () => {
  const x = fixture();
  try {
    let previous = x.first.source.sourceId;
    for (let i = 0; i < 7; i++) {
      const source = x.retain(previous, x.at + 200 + i * 100, `owned-observation-prefix-${i}`);
      x.sources.set(source.sourceId, source); x.executions.accept(source.sourceId); previous = source.sourceId;
    }
    const o = installSyntheticObservation(x, 'p2', previous), observed = o.observations.accept(o.observationSource.sourceId);
    expect(observed.source.executionSourceId).toBe(previous);
    expect(observed.physicalPrefixHashConvention).toBe('owned_motion_observation_prefix_manifest_v1');
    const p = x.prefix(previous), reference = (owner: string, snapshot: { source: { sourceId: string; sourceVersion: string }; revision: number }) => ({
      owner, sourceId: snapshot.source.sourceId, sourceVersion: snapshot.source.sourceVersion, revision: snapshot.revision,
      sourceHash: actorHash(snapshot.source), snapshotHash: actorHash(snapshot),
    });
    const manifest = { version: 'owned_motion_observation_prefix_manifest_v1', physicalPitchSourceId: observed.source.physicalPitchSourceId,
      cut: { baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: previous },
      baseField: reference('batted_world_field_actions', p.baseField), fields: p.fields.map(s => reference('batted_world_field_actions', s)),
      executions: p.executions.map(s => reference('batted_world_field_executions', s)) };
    expect(observed.physicalPrefixHash).toBe(actorHash(manifest));
    expect(observed.physicalPrefixHash).not.toBe(actorHash({ ...manifest, executions: [...manifest.executions].reverse() }));
    expect(observed.receipt.at.tick).toBe(x.at + 800);
    expect(o.observations.read(observed.source.sourceId)).toEqual(observed);
    expect(o.observations.accept(observed.source.sourceId)).toEqual(observed);
    const future = x.retain(previous, x.at + 900, 'owned-observation-future');
    x.sources.set(future.sourceId, future); x.executions.accept(future.sourceId);
    const next = { ...o.observationSource, sourceId: 'owned-observation-trigger', executionSourceId: future.sourceId,
      previousObservationSourceId: observed.source.sourceId };
    o.observationSources.set(next.sourceId, next);
    const physicalRows = x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all();
    const observationRows = x.f.db.prepare('SELECT * FROM actual_field_observations ORDER BY revision').all();
    x.f.db.exec(`CREATE TRIGGER corrupt_owned_observation_prefix AFTER INSERT ON actual_field_observations BEGIN
      UPDATE batted_world_field_executions SET snapshot_hash='uncommitted-owned-observation-corruption'
        WHERE source_id='owned-observation-prefix-0'; END;`);
    expect(() => o.observations.accept(next.sourceId)).toThrow(/corrupt|changed/);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all()).toEqual(physicalRows);
    expect(x.f.db.prepare('SELECT * FROM actual_field_observations ORDER BY revision').all()).toEqual(observationRows);
    x.f.db.exec('DROP TRIGGER corrupt_owned_observation_prefix');
    expect(o.observations.accept(next.sourceId).source).toEqual(next);
    x.f.db.prepare("UPDATE batted_world_field_executions SET source_json='opaque-future',snapshot_json='opaque-future' WHERE source_id=?").run(future.sourceId);
    expect(o.observations.read(observed.source.sourceId)).toEqual(observed);
    expect(() => o.observations.read(next.sourceId)).toThrow();
    x.f.db.prepare('UPDATE batted_world_field_execution_heads SET revision=revision+1').run();
    expect(() => o.observations.read(observed.source.sourceId)).toThrow(/head/);
  } finally { x.f.close(); }
});
