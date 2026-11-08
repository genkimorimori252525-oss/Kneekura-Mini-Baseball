import { afterEach, expect, it, vi } from 'vitest';
import * as entry from './native-field-preparation-v198';
import * as bodyStore from '../../src/host/world/SqlitePlayerBodyCapabilityMaterializationStore';
import { bodyMaterializationFixture, materialized } from '../../src/host/world/PlayerBodyCapabilityMaterializationFixtures.test-support';
import { prepareFreshPhysicalFieldCalibrationFixture, prepareFreshPhysicalFieldFixture } from '../../src/host/world/SamePlateAppearancePhysicalFieldFixture.test-support';
import type { BodyMaterializationReceipt, BodyMaterializationRequest, BattedBodyModelAssembly } from '../../src/host/world/PlayerBodyCapabilityMaterialization';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import type { SamePaPhysicalFieldCalibrationSource } from '../../src/host/world/SamePlateAppearancePhysicalFieldCalibration';

type Declaration = Pick<BodyMaterializationReceipt, 'body' | 'pose' | 'reachCalibration'> & { request: BodyMaterializationRequest };
type Prepare = (path: string, original: BodyMaterializationReceipt, day: number, declaration: Declaration,
  emit: (name: string, value?: unknown) => void) => { receipt: BodyMaterializationReceipt; reference: SamePaReference<'world_player_body_materializations'> };
const prepare = () => {
  const candidate = (entry as unknown as { prepareNativeFieldBatterV198?: Prepare }).prepareNativeFieldBatterV198;
  expect(typeof candidate, 'V198 must normally accept a new match-day receipt without retagging the original').toBe('function');
  return candidate!;
};
const declaration = (original: BodyMaterializationReceipt, day: number): Declaration => ({
  request: { ...original.source, sourceId: 'native-spin-neutral-field-v198:batter-body-at-game-day', atDay: day },
  body: original.body, pose: original.pose, reachCalibration: original.reachCalibration,
});
afterEach(() => vi.restoreAllMocks());

it('V198 R01 normally accepts a later-day batter receipt, preserving original pins, actor and old row', () => {
  const run = prepare(), f = bodyMaterializationFixture();
  try {
    f.requests.set(f.request.sourceId, { ...f.request, role: 'batter', fieldingModelRef: null });
    const original = materialized(f), originalRow = f.db.prepare('SELECT * FROM world_player_body_materializations WHERE source_id=?').get(original.source.sourceId);
    const declared = declaration(original, 40), events: { name: string; value: unknown; count: unknown }[] = [];
    const result = run(f.path, original, 40, declared, (name, value) => events.push({ name, value,
      count: f.db.prepare('SELECT count(*) n FROM world_player_body_materializations').get()?.n }));
    expect(result.receipt.source).toStrictEqual(declared.request);
    expect(result.receipt.actor).toStrictEqual(original.actor);
    expect(result.receipt.body).toStrictEqual(original.body); expect(result.receipt.pose).toStrictEqual(original.pose);
    expect(result.receipt.reachCalibration).toStrictEqual(original.reachCalibration);
    expect(result.reference.owner).toBe('world_player_body_materializations');
    expect(result.reference.sourceId).toBe(declared.request.sourceId);
    expect(events.map(e => e.name)).toStrictEqual(['match-day-batter-source-declared-before-acceptance', 'normal-match-day-batter-materialization-accepted']);
    expect(events.map(e => e.count)).toStrictEqual([1, 2]);
    expect(f.db.prepare('SELECT * FROM world_player_body_materializations WHERE source_id=?').get(original.source.sourceId)).toStrictEqual(originalRow);
    expect(f.materializations.read(original.source.sourceId)).toStrictEqual(original);
    const reader = bodyStore.openSqlitePlayerBodyCapabilityMaterializationStore(f.path);
    try { expect(reader.read(result.reference.sourceId)).toStrictEqual(result.receipt); } finally { reader.close(); }
    expect(original.source.atDay).toBe(20); expect(declared).toStrictEqual(declaration(original, 40));
  } finally { f.close(); }
});

it('V198 R02 rejects a changed declared physical parameter or forged original before new receipt acceptance', () => {
  const run = prepare(), f = bodyMaterializationFixture();
  try {
    f.requests.set(f.request.sourceId, { ...f.request, role: 'batter', fieldingModelRef: null });
    const original = materialized(f), declared = declaration(original, 40);
    const changed = { ...declared, body: { ...declared.body, physicalProfile: { heightMeters: 1.9 } } };
    expect(() => run(f.path, original, 40, changed, () => {})).toThrow();
    expect(() => run(f.path, { ...original, actor: { ...original.actor, heightMeters: 1.9 } }, 40,
      declaration(original, 40), () => {})).toThrow();
    expect(f.db.prepare('SELECT count(*) n FROM world_player_body_materializations').get()?.n).toBe(1);
  } finally { f.close(); }
});

// These tiny owner mocks prove fixture routing/default compatibility only.
// They carry no Native authority and do not simulate a physical outcome.
it('V198 R03 keeps wrapper/default payloads exact and changes only the explicit assembly batter ref', () => {
  const body = (id: string, day: number) => ({ source: { sourceId: id, sourceVersion: 'fixture-only-v1', playerId: id, atDay: day },
    person: { personId: 'person-' + id }, actor: { playerId: id, personId: 'person-' + id, heightMeters: 1.8, bodyOriginHeightMeters: 0.9, primitives: [] } });
  const batter = body('batter', 1), scene = Array.from({ length: 9 }, (_, i) => body('defender-' + i, 40));
  const posture = { model: { bodyMaterialization: batter }, sceneBodies: scene } as unknown as Parameters<typeof prepareFreshPhysicalFieldCalibrationFixture>[2];
  const prepared = { action: { baseCenters: { first: { x: 27, z: 27 }, second: { x: 0, z: 54 }, third: { x: -27, z: 27 } } }, actionReference: { owner: 'pa_physical_v1_action_plans', sourceId: 'action' } } as unknown as Parameters<typeof prepareFreshPhysicalFieldCalibrationFixture>[1];
  const postureRef = { owner: 'batting_observation_v1_postures', sourceId: 'posture', sourceHash: 'a', snapshotHash: 'b' } as const;
  let assembly: BattedBodyModelAssembly;
  const declarations: unknown[] = [];
  vi.spyOn(bodyStore, 'openSqlitePlayerBodyCapabilityMaterializationStore').mockImplementation((_path, authority) => ({
    acceptModel: id => {
      assembly = authority!.readAcceptedModelAssembly!(id)!; declarations.push(structuredClone(assembly));
      return { ...assembly, actors: [batter, ...scene].map(b => b.actor), materializationSourceId: assembly.sourceId };
    }, read: () => null, accept: () => { throw Error('unexpected actor acceptance'); }, readAcceptedModel: () => null, close: () => {},
  }));
  const sources: SamePaPhysicalFieldCalibrationSource[] = [];
  const h = { f: { db: { prepare: () => ({ get: () => ({ venue_id: 'venue' }) }) }, path: 'synthetic-only',
    actor: { source: { gameId: 'game' }, binding: { careerId: 'career', fixtureEventId: 'fixture', gameDay: 40 } }, x: { f: { track: (owner: unknown) => owner } } },
    current: () => ({ viewReference: { owner: 'pa_lifecycle_v1_execution_views', sourceId: 'view' } }),
    save: (source: typeof sources[number]) => { sources.push(source); return source; },
    physical: { acceptFieldCalibration: () => ({ kind: 'same_pa_physical_field_calibration_prepared_v1', source: sources.at(-1), calibration: { model: { ...assembly!, actors: [batter, ...scene].map(b => b.actor) } } }) },
  } as unknown as Parameters<typeof prepareFreshPhysicalFieldCalibrationFixture>[0];
  prepareFreshPhysicalFieldCalibrationFixture(h, prepared, posture, postureRef, 'same');
  const defaultAssembly = declarations[0], defaultSource = structuredClone(sources[0]);
  prepareFreshPhysicalFieldFixture(h as unknown as Parameters<typeof prepareFreshPhysicalFieldFixture>[0], prepared as Parameters<typeof prepareFreshPhysicalFieldFixture>[1], posture, postureRef, 'same');
  expect(declarations[1]).toStrictEqual(defaultAssembly); expect(sources[1]).toStrictEqual(defaultSource);
  const matchDay = { ...batter, source: { ...batter.source, sourceId: 'new-day40', atDay: 40 } } as unknown as BodyMaterializationReceipt;
  const invoke = prepareFreshPhysicalFieldCalibrationFixture as unknown as (...args: unknown[]) => unknown;
  invoke(h, prepared, posture, postureRef, 'same', {}, matchDay);
  const explicit = declarations[2] as BattedBodyModelAssembly, original = defaultAssembly as BattedBodyModelAssembly;
  expect(explicit.actors[0].materializationRef).toStrictEqual({ sourceId: 'new-day40', sourceVersion: 'fixture-only-v1' });
  expect(explicit.actors.slice(1)).toStrictEqual(original.actors.slice(1));
  expect({ ...explicit, actors: original.actors }).toStrictEqual(original);
  expect(posture.model.bodyMaterialization).toBe(batter);
  expect(defaultSource.parameters).toStrictEqual({ ticksPerSecond: 1_000_000, gravityY: -9.81, ballRadius: 0.0366,
    groundRestitution: 0.35, groundFriction: 0.78, groundRollingDecelerationMps2: 4, integrationStepTicks: 2_000, restingVerticalSpeed: 0.5 });
});
