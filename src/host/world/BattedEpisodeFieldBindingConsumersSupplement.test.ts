// Supplemental integration tests prepared by source inspection only.
// Copy beside the other host/world tests only after the consumer RED/GREEN gate permits it.
// Every real fixture uses a newly created directory under the system temporary directory.
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteBattedEpisodeFieldBindingStore } from './SqliteBattedEpisodeFieldBindingStore';
import { battedWorldFieldEvidenceFromSqlite, withBattedWorldFieldReadTraversal,
  type AcceptedBattedWorldFieldAction, type DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { battedWorldFieldTerritoryFromPrefix } from './BattedWorldFieldTerritoryFromPrefix';

type Fixture = ReturnType<typeof battedWorldFieldFixture>;
type BindingReference = Readonly<{ version: 'batted_episode_field_binding_v1'; sourceId: string }>;
type FieldSource = AcceptedBattedWorldFieldAction & { episodeFieldBinding?: BindingReference };
const resources: { directory: string; fixture: Fixture; closed: boolean }[] = [];
afterEach(() => {
  for (const resource of resources.splice(0).reverse()) {
    try { if (!resource.closed) resource.fixture.f.close(); }
    finally { rmSync(resource.directory, { recursive: true, force: true }); }
  }
});
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'episode-binding-consumer-supplement-'));
  let x: Fixture;
  try { x = battedWorldFieldFixture(join(directory, 'world.sqlite')); }
  catch (error) { rmSync(directory, { recursive: true, force: true }); throw error; }
  const resource = { directory, fixture: x, closed: false };
  resources.push(resource);
  return { x, resource };
};
const bind = (x: Fixture) => {
  const source = { sourceId: 'episode-binding', sourceVersion: 'fixture-v1',
    version: 'batted_episode_field_binding_v1' as const, responseSourceId: x.response.source.sourceId,
    fieldCalibrationSourceId: x.geometrySource.sourceId };
  const store = x.f.track(openSqliteBattedEpisodeFieldBindingStore(x.f.path,
    { readAcceptedBinding: id => id === source.sourceId ? source : null }));
  const value = store.accept(source.sourceId);
  const reference: BindingReference = { version: source.version, sourceId: source.sourceId };
  return { source, store, value, reference };
};
const admitPair = (x: Fixture, reference: BindingReference | null) => {
  const source = { ...x.source, ...(reference ? { episodeFieldBinding: reference } : {}) };
  x.sources.set(source.sourceId, source as never);
  const first = x.fields.accept(source.sourceId);
  const next = { ...source, sourceId: 'field-motion-2', previousFieldSourceId: first.source.sourceId,
    throughTick: first.field.motion.world.moment.ball.tick + 1000 };
  x.sources.set(next.sourceId, next as never);
  const second = x.fields.accept(next.sourceId);
  return { first, second };
};
const calibrationRows = (x: Fixture) => json(['batted_world_base_geometries', 'batted_world_field_geometries']
  .map(table => ({ table, rows: x.f.db.prepare(`SELECT * FROM main.${table} ORDER BY source_id`).all() })));
const sourceWithoutBinding = (source: FieldSource): AcceptedBattedWorldFieldAction => {
  const { episodeFieldBinding: _binding, ...legacy } = source;
  return legacy as AcceptedBattedWorldFieldAction;
};

it('continues two genuine bound field actions and reopens their complete immutable prefix', () => {
  const { x, resource } = fixture(), bound = bind(x), oldCalibration = calibrationRows(x);
  const { first, second } = admitPair(x, bound.reference);
  const firstBytes = json(first), secondBytes = json(second);
  expect(first).toMatchObject({ rootKind: 'episode_field_binding_v1', episodeFieldBinding: bound.value });
  expect(second).toMatchObject({ rootKind: 'episode_field_binding_v1', episodeFieldBinding: bound.value, revision: 2 });
  expect(second.history).toEqual([first.source, second.source]);
  expect(second.field.motion.world.moment.elapsedSeconds).toBeGreaterThan(first.field.motion.world.moment.elapsedSeconds);
  expect(json(x.fields.read(first.source.sourceId))).toBe(firstBytes);
  expect(json(x.fields.read(second.source.sourceId))).toBe(secondBytes);
  expect(calibrationRows(x)).toBe(oldCalibration);
  expect(x.f.db.prepare('SELECT count(DISTINCT physical_pitch_source_id) AS n FROM main.batted_world_field_actions').get()!.n).toBe(1);
  expect(x.f.db.prepare('SELECT count(*) AS n FROM main.batted_episode_field_bindings').get()!.n).toBe(1);
  const projected = battedWorldFieldPhysicalPrefix({ baseField: second, fields: [first, second], executions: [] });
  expect(projected.field.evidence.field).toEqual(bound.value.geometry.baseGeometry.field);
  const firstTerritory = x.fields.interpret(first.source.sourceId);
  const secondTerritory = x.fields.interpret(second.source.sourceId);
  expect(firstTerritory?.territory).toMatchObject({ kind: 'resolved', territory: 'fair' });
  expect(secondTerritory?.horizon).toEqual(second.field.motion.world.moment);

  const path = x.f.path;
  x.f.close(); resource.closed = true;
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const reopened = new DatabaseSync(path, { readOnly: true });
  try {
    const own = battedWorldFieldEvidenceFromSqlite(reopened);
    expect(json(own.read(first.source.sourceId))).toBe(firstBytes);
    expect(json(own.read(second.source.sourceId))).toBe(secondBytes);
    reopened.exec('BEGIN');
    try {
      withBattedWorldFieldReadTraversal(reopened, () => {
        expect(json(own.read(first.source.sourceId))).toBe(firstBytes);
        expect(json(own.read(second.source.sourceId))).toBe(secondBytes);
        expect(json(own.read(first.source.sourceId))).toBe(firstBytes);
        expect(own.interpret(first.source.sourceId)).toEqual(firstTerritory);
        expect(own.interpret(second.source.sourceId)).toEqual(secondTerritory);
      });
      expect(reopened.isTransaction).toBe(true);
    } finally { reopened.exec('ROLLBACK'); }
  } finally { reopened.close(); }
}, 60_000);

it.each(['legacy_to_bound', 'bound_to_legacy', 'changed_binding_id'] as const)(
  'rejects a canonically hashed %s field Source after a warm read in the same private traversal', mode => {
    const { x } = fixture(), bound = bind(x);
    const { first, second } = admitPair(x, mode === 'legacy_to_bound' ? null : bound.reference);
    const source = second.source as FieldSource;
    const changed = mode === 'bound_to_legacy' ? sourceWithoutBinding(source)
      : { ...source, episodeFieldBinding: mode === 'changed_binding_id'
        ? { ...bound.reference, sourceId: 'missing-binding-owner' } : bound.reference };
    // Start with two actions admitted by the real physical writer. Corrupt only
    // the second action's Source and the corresponding archived Source copies.
    // Its original root is deliberately left in place. No pitch, binding owner,
    // flight, actor, calibration, result, or physical horizon is fabricated.
    const corrupt = { ...second, source: changed, history: [first.source, changed] };
    x.f.db.prepare(`UPDATE main.batted_world_field_actions SET source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?
      WHERE source_id=?`).run(json(changed), hash(changed), json(corrupt), hash(corrupt), second.source.sourceId);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM main.batted_episode_field_bindings').get()!.n).toBe(1);
    const own = battedWorldFieldEvidenceFromSqlite(x.f.db);
    expect(() => own.read(second.source.sourceId)).toThrow();
    expect(own.read(first.source.sourceId)).toEqual(first);
    const queryOnly = x.f.db.prepare('PRAGMA query_only').get()!.query_only;
    for (const nestedWarm of [false, true]) {
      x.f.db.exec('BEGIN');
      try {
        withBattedWorldFieldReadTraversal(x.f.db, () => {
          const warm = () => expect(own.read(first.source.sourceId)).toEqual(first);
          if (nestedWarm) withBattedWorldFieldReadTraversal(x.f.db, warm); else warm();
          // This is intentionally read -> read. derive() creates a fresh root
          // and cannot expose a traversal.roots lookup that omits the mode/id.
          expect(() => own.read(second.source.sourceId)).toThrow();
          expect(own.read(first.source.sourceId)).toEqual(first);
        });
        expect(x.f.db.isTransaction).toBe(true);
        expect(x.f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(queryOnly);
      } finally { x.f.db.exec('ROLLBACK'); }
    }
  }, 60_000);

it.each(['missing_earlier_receipt', 'changed_earlier_binding_id', 'changed_earlier_source_mode', 'changed_earlier_receipt_version'] as const)(
  'rejects %s in both physical and territory pure prefixes', mode => {
    const { x } = fixture(), bound = bind(x), { first, second } = admitPair(x, bound.reference);
    const boundFirst = first as DurableBattedWorldFieldAction & { rootKind: string; episodeFieldBinding: typeof bound.value };
    let changed: DurableBattedWorldFieldAction;
    if (mode === 'missing_earlier_receipt') {
      const { rootKind: _kind, episodeFieldBinding: _receipt, ...withoutReceipt } = boundFirst;
      changed = withoutReceipt as DurableBattedWorldFieldAction;
    } else if (mode === 'changed_earlier_binding_id') {
      changed = { ...boundFirst, episodeFieldBinding: { ...bound.value,
        source: { ...bound.value.source, sourceId: 'missing-binding-owner' } } } as DurableBattedWorldFieldAction;
    } else if (mode === 'changed_earlier_receipt_version') {
      changed = { ...boundFirst, episodeFieldBinding: { ...bound.value, source: { ...bound.value.source, sourceVersion: 'changed-version' } } };
    } else {
      changed = { ...boundFirst, source: sourceWithoutBinding(first.source as FieldSource) } as DurableBattedWorldFieldAction;
    }
    // Keep generic history equality intact so the intended mode/receipt
    // mismatch, rather than an unrelated history mismatch, must reject.
    changed = { ...changed, history: [changed.source] } as DurableBattedWorldFieldAction;
    const last = { ...second, history: [changed.source, second.source] } as DurableBattedWorldFieldAction;
    const fields = [changed, last];
    expect(() => battedWorldFieldPhysicalPrefix({ baseField: last, fields, executions: [] })).toThrow();
    expect(() => battedWorldFieldTerritoryFromPrefix(fields)).toThrow();
  }, 60_000);
