import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
import { completeSamePaLifecycleFixtureCalibrations } from './SamePlateAppearanceLifecycleFixture.test-support';
import { appendPhysicalFieldFixtureStep } from './SamePlateAppearancePhysicalFieldFixture.test-support';
import { completeSamePaPhysicalLifecycleFromCutFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';

const boundary = vi.hoisted(() => ({
  replay: vi.fn(() => { throw new Error('completed owner replayed'); }),
  calibration: vi.fn(), operation: vi.fn(), advance: vi.fn(),
}));
vi.mock('./SqliteReadTransaction.test-support', () => ({ withSqliteReadTransaction: boundary.replay }));
vi.mock('./SamePlateAppearanceLifecycleFromSqlite', () => ({ readCurrentSamePaLifecycleViewFromSqlite: boundary.replay }));
vi.mock('./SqliteSamePlateAppearanceLifecycleStore', () => ({ openSqliteSamePlateAppearanceLifecycleStore: boundary.replay }));
vi.mock('./SqliteBattingPerceptionStore', () => ({ openSqliteBattingPerceptionStore: () => ({ acceptPosture: boundary.replay }) }));
vi.mock('./SamePlateAppearancePhysicalEpisodeFromSqlite', () => ({
  openSqliteSamePlateAppearancePhysicalEpisodeStore: () => ({ acceptAction: boundary.replay, acceptRight: boundary.replay, acceptOperation: boundary.operation }),
}));

// Finite call-boundary declarations only. These values and mocked owners never
// authenticate a retained DB or claim that a Native calibration/field ran.
const inputs = () => {
  const record = (sourceId: string, values: any = {}) => ({ ...values, source: { sourceId, ...values.source } });
  const second = record('lan01:occupied:second-pitch', { lineage: { participantReferences: [] } });
  const identities = [
    ['pa_take_successor_v1_pitch_actions', second.source.sourceId], ['pa_physical_v1_launches', 'lan01:swing:launch'],
    ['pa_physical_v1_cuts', 'lan01:swing:capture-cut'], ['batting_observation_v1_observations', 'lan01:swing:capture'],
    ['pa_physical_v1_cuts', 'lan01:swing:delivery-cut'], ['batting_observation_v1_deliveries', 'lan01:swing:delivery'],
    ['batting_prediction_v1_predictions', 'lan01:swing:forecast'], ['batting_emotion_execution_v1_executions', 'lan01:swing:emotion'],
    ['pa_physical_v1_cuts', 'lan01:swing:decision-cut'], ['pa_physical_v1_commitments', 'lan01:swing:commitment'],
    ['pa_physical_v1_resolutions', 'lan01:swing:resolution'], ['pa_physical_v1_field_roots', 'lan01:field:field-root'],
  ] as const;
  const eventReferences = identities.map(([owner, id], index) => reference(owner, index === 0 ? second : record(id)));
  const prefix = record('lan01:occupied:cut12:prefix', { source: { eventReferences } });
  const prefixReference = reference('pa_lifecycle_v1_work_prefixes', prefix);
  const view = record('lan01:occupied:cut12:view', { source: { prefixReference }, cut: { physicalOperationReference: eventReferences.at(-1) } });
  const viewReference = reference('pa_lifecycle_v1_execution_views', view);
  const roleRoutes: readonly (readonly [string, readonly string[]])[] = [
    ['away-2', ['batter_observation', 'batter_decision', 'batter_motor', 'batter_swing']],
    ['p2', ['pitch_delivery', 'defender_observation', 'defender_decision', 'defender_locomotion']],
    ...Array.from({ length: 8 }, (_, index): readonly [string, readonly string[]] => [`home-${index + 1}`, ['defender_observation', 'defender_decision', 'defender_locomotion']]),
  ];
  const members = [...roleRoutes.map(([playerId]) => ({ playerId, cut: 12 })), { playerId: 'away-1', cut: 12 }];
  const calibrations = roleRoutes.flatMap(([playerId, routes]) => routes.map(route => record(`lan01:occupied:calibration:${playerId}:${route}`, {
    source: { route, member: { playerId }, provenance: { assessmentSourceId: `assessment:${playerId}:${route}` },
      response: { kind: 'accepted_execution_values_v1', values: { declared: `${playerId}:${route}` } } },
  })));
  const accepted = new Map<string, unknown>();
  const owner = { acceptPrefix: boundary.replay, acceptTotalSet: boundary.replay, acceptView: boundary.replay, acceptCalibrationSet: boundary.calibration };
  const totals = members.map(member => ({ sourceId: `lan01:occupied:cut12:total:${member.playerId}` }));
  const prepared = { owner, accepted, prefixSource: prefix.source, prefix, prefixReference, totals,
    totalSet: { kind: 'same_pa_lifecycle_total_set', totals, participantTotalReferences: [] }, viewSource: view.source, view, viewReference, basis: { members } };
  const f = { db: {}, path: '/unused/source-contract-only.sqlite', acceptedCalibrations: { calibrations }, acceptedAction: { source: {} },
    x: { f: { track: <T>(value: T) => value } } };
  const complete = () => completeSamePaLifecycleFixtureCalibrations(f as unknown as Parameters<typeof completeSamePaLifecycleFixtureCalibrations>[0],
    'lan01:occupied:cut12', prepared as unknown as Parameters<typeof completeSamePaLifecycleFixtureCalibrations>[2]);
  const cut = { first: second, second, anchor: {}, basis: prepared, eventReferences };
  const restore = (value = cut, label = 'lan01:occupied') => completeSamePaPhysicalLifecycleFromCutFixture(
    f as unknown as Parameters<typeof completeSamePaPhysicalLifecycleFromCutFixture>[0], accepted,
    value as unknown as Parameters<typeof completeSamePaPhysicalLifecycleFromCutFixture>[2], {}, label);
  return { f, prepared, complete, restore, cut, eventReferences, calibrations, accepted, viewReference, members };
};

beforeEach(() => {
  boundary.replay.mockClear(); boundary.calibration.mockReset(); boundary.operation.mockReset(); boundary.advance.mockReset();
});

it('enters the exact R7 call15 calibration32 as its first writer without prefix, TOTAL, view or basis replay', () => {
  const x = inputs();
  boundary.calibration.mockImplementation((ids: string[]) => ({ kind: 'same_pa_lifecycle_calibration_set',
    calibrations: ids.map(id => ({ source: x.accepted.get(id) })) }));
  const completed = x.complete();
  expect(boundary.calibration).toHaveBeenCalledTimes(1);
  expect(boundary.calibration.mock.calls[0][0]).toHaveLength(32);
  expect(createHash('sha256').update(JSON.stringify(boundary.calibration.mock.calls[0])).digest('hex'))
    .toBe('f3bcf512bce0a0727213fd030e508dc720796a93a694d5a5c17b541d4c960434');
  expect(completed.calibrationSet.calibrations).toHaveLength(32);
  expect(completed.calibrations.map(source => source.response)).toEqual(x.calibrations.map(value => value.source.response));
  expect(completed.calibrations.every(source => source.viewReference === x.viewReference && x.members.some(member => Object.is(member, source.member)))).toBe(true);
  expect(completed.calibrations.map(source => source.provenance.assessmentSourceId))
    .toEqual(x.calibrations.map(value => 'lan01:occupied:cut12:' + value.source.provenance.assessmentSourceId));
  expect(completed.prefix).toBe(x.prepared.prefix); expect(completed.totalSet).toBe(x.prepared.totalSet);
  expect(completed.view).toBe(x.prepared.view); expect(completed.basis).toBe(x.prepared.basis);
  expect(boundary.replay).not.toHaveBeenCalled(); expect(boundary.operation).not.toHaveBeenCalled(); expect(boundary.advance).not.toHaveBeenCalled();
});

it('does not return a placeholder calibration set when the first unperformed acceptance is pending', () => {
  const x = inputs(); boundary.calibration.mockReturnValue({ kind: 'pending' });
  expect(x.complete).toThrow('real lifecycle32 calibration set pending');
  expect(boundary.calibration).toHaveBeenCalledTimes(1); expect(boundary.replay).not.toHaveBeenCalled();
  expect(boundary.operation).not.toHaveBeenCalled(); expect(boundary.advance).not.toHaveBeenCalled();
});

it('restores only the exact twelve admitted events without replaying their writers', () => {
  const x = inputs(), h = x.restore();
  expect(h.events).toEqual(x.eventReferences); expect(h.current()).toBe(x.prepared);
  expect(boundary.replay).not.toHaveBeenCalled(); expect(boundary.calibration).not.toHaveBeenCalled(); expect(boundary.operation).not.toHaveBeenCalled();
  for (const changed of [
    { ...x.cut, eventReferences: [...x.eventReferences, x.eventReferences[11]] },
    { ...x.cut, eventReferences: x.eventReferences.map((pin, index) => index === 10 ? { ...pin, sourceId: 'other:resolution' } : pin) },
    { ...x.cut, eventReferences: x.eventReferences.map((pin, index) => index === 0 ? { ...pin, snapshotHash: 'changed' } : pin) },
    { ...x.cut, basis: { ...x.prepared, viewReference: { ...x.viewReference, sourceId: 'lan01:occupied:cut11:view' } } },
    { ...x.cut, basis: { ...x.prepared, view: { ...x.prepared.view, cut: { physicalOperationReference: x.eventReferences[10] } } } },
  ]) expect(() => x.restore(changed)).toThrow('exact LAN delivery-cut prefix or accepted-input prefix or field-root prefix');
  expect(() => x.restore(x.cut, 'physical-fixture')).toThrow('exact LAN delivery-cut prefix');
  expect(boundary.replay).not.toHaveBeenCalled(); expect(boundary.operation).not.toHaveBeenCalled();
});

it('starts the shared field-step writer at the admitted root and advances only the new step', () => {
  const x = inputs(), saved = new Map<string, any>();
  const resolution = { source: { launchReference: x.eventReferences[1] }, contact: { tick: 123_000 } };
  const root = { source: { sourceId: 'lan01:field:field-root' }, field: { motion: { cursor: {} } } };
  const rootReference = reference('pa_physical_v1_field_roots', root);
  const h = { save: <T extends { sourceId: string }>(source: T) => { saved.set(source.sourceId, source); return source; },
    physical: { acceptOperation: boundary.operation }, current: () => x.prepared, advance: boundary.advance };
  boundary.operation.mockImplementation((id: string) => ({ kind: 'same_pa_physical_field_step_v1', source: saved.get(id) }));
  const field = appendPhysicalFieldFixtureStep(h as unknown as Parameters<typeof appendPhysicalFieldFixtureStep>[0],
    resolution as unknown as Parameters<typeof appendPhysicalFieldFixtureStep>[1], root as unknown as Parameters<typeof appendPhysicalFieldFixtureStep>[2], rootReference, 'lan01:field');
  expect(boundary.operation.mock.calls).toEqual([['lan01:field:field-step']]);
  expect(saved.get('lan01:field:field-step')).toEqual({ sourceId: 'lan01:field:field-step', sourceVersion: 'fixture-only-v1',
    capability: 'same_pa_physical_field_step_v1', viewReference: x.viewReference, launchReference: x.eventReferences[1],
    previousOperationReference: rootReference, fieldRootReference: rootReference, previousFieldReference: rootReference, throughTick: 2_123_000 });
  expect(field.root).toBe(root); expect(field.rootReference).toBe(rootReference);
  expect(boundary.advance.mock.calls).toEqual([[field.stepReference]]);
  expect(boundary.operation.mock.invocationCallOrder[0]).toBeLessThan(boundary.advance.mock.invocationCallOrder[0]);
  expect(boundary.replay).not.toHaveBeenCalled(); expect(boundary.calibration).not.toHaveBeenCalled();
});

it('shares the byte-identical original calibration and field-step tails with fresh calls', () => {
  const lifecycle = readFileSync(new URL('./SamePlateAppearanceLifecycleFixture.test-support.ts', import.meta.url), 'utf8');
  const seam = lifecycle.slice(lifecycle.indexOf('export const completeSamePaLifecycleFixtureCalibrations='));
  const body = seam.slice(seam.indexOf('  const calibrations=f.acceptedCalibrations.calibrations.map'), seam.indexOf('\n};'));
  expect(Buffer.byteLength(body)).toBe(1689);
  expect(createHash('sha256').update(body).digest('hex')).toBe('796b515dc242458f154e9ab173ad21143e44a3e916eaf564b298ab8d7795e1a0');
  expect(lifecycle).toContain('return completeSamePaLifecycleFixtureCalibrations(f,label,{owner,accepted,prefixSource,prefix,prefixReference,totals,totalSet,viewSource,view,viewReference,basis},');
  expect(seam).not.toMatch(/acceptPrefix\(|acceptTotalSet\(|acceptView\(|readCurrentSamePaLifecycleViewFromSqlite\(|withSqliteReadTransaction\(|new DatabaseSync\(/);
  const field = readFileSync(new URL('./SamePlateAppearancePhysicalFieldFixture.test-support.ts', import.meta.url), 'utf8');
  const stepSeam = field.slice(field.indexOf('export const appendPhysicalFieldFixtureStep='));
  const stepBody = stepSeam.slice(stepSeam.indexOf('    if(!root.field.motion.cursor)'), stepSeam.indexOf('\n};'));
  expect(Buffer.byteLength(stepBody)).toBe(823);
  expect(createHash('sha256').update(stepBody).digest('hex')).toBe('d6a1247f18ded05892b9140158b53d91f415de02950dfab983f7f46e40e18aec');
  expect(field).toContain("const rootReference=reference('pa_physical_v1_field_roots',root);h.advance(rootReference);\n    return appendPhysicalFieldFixtureStep(h,resolution,root,rootReference,label);");
  expect(stepSeam).not.toMatch(/acceptModel\(|acceptFieldCalibration\(|advance\(rootReference\)|acceptOperation\(rootSource/);
});
