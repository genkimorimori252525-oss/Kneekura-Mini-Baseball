import { expect, it } from 'vitest';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { sampleBatRadius } from '../../core/sim/contact/RigidBatBallContact';
import { battingCapabilityValuesInput, battingDecisionValuesInput, battingRepertoireValuesInput } from '../../host/world/PlayerBattingExecutionCalibration';
import { createWorkbenchPlayer, defaultWorkbenchPlayer, exportWorkbenchPlayerSources, previewLeagueRatings,
  WORKBENCH_TICKS_PER_SECOND, type WorkbenchLeagueId, type WorkbenchPlayer } from './WorkbenchPlayer';

const draft = () => structuredClone(defaultWorkbenchPlayer()) as {
  -readonly [K in keyof WorkbenchPlayer]: { -readonly [P in keyof WorkbenchPlayer[K]]: WorkbenchPlayer[K][P] }
} & { schemaVersion: number };
const member = (playerId: string, leagueId: WorkbenchLeagueId, speed: number, error = 0.01): WorkbenchPlayer => {
  const value = structuredClone(defaultWorkbenchPlayer());
  return createWorkbenchPlayer({ ...value, identity: { ...value.identity, playerId, leagueId },
    capability: { ...value.capability, maximumSweetSpotSpeedMps: speed, positionErrorMeters: error },
    swing: { ...value.swing, speedMps: Math.min(value.swing.speedMps, speed) } });
};

it('retains the measured six-inch-from-tip sweet spot instead of the old image-only 78-percent bound', () => {
  const value=draft(); value.bat.lengthM=.8636; value.bat.sweetSpotT=(.8636-.1524)/.8636;
  const player=createWorkbenchPlayer(value), pack=exportWorkbenchPlayerSources(player);
  expect(player.bat.sweetSpotT).toBe(value.bat.sweetSpotT);
  expect(battingRepertoireValuesInput(pack.repertoire).profiles[0].profile.sweetSpotT).toBe(value.bat.sweetSpotT);
  expect(createWorkbenchPlayer(JSON.parse(JSON.stringify(player)))).toEqual(player);
});

it('starts a detached generic reference, without fabricated named-player abilities or a league population', () => {
  const player = defaultWorkbenchPlayer();
  expect(player.identity).toEqual({ playerId: 'workbench-new-player', name: '新規選手', leagueId: 'CUSTOM', bats: 'R', throws: 'R' });
  expect(player.swing.speedMps).toBe(31);
  expect(player.capability.maximumSweetSpotSpeedMps).toBe(45);
  expect(player.capability.motorLatencyTicks / WORKBENCH_TICKS_PER_SECOND).toBe(0.14);
  expect(player.traits.labels).toEqual([]);
  expect(previewLeagueRatings(player, [], 'NLB')).toMatchObject({ sampleCount: 0, available: false });
});

it('round-trips every authoring value as JSON and deeply freezes a detached copy', () => {
  const value = draft();
  value.identity.name = '独自選手'; value.identity.bats = 'L'; value.traits.labels = ['独自技術'];
  const player = createWorkbenchPlayer(value), imported = createWorkbenchPlayer(JSON.parse(JSON.stringify(player)));
  expect(imported).toEqual(player); expect(imported).not.toBe(player);
  value.identity.name = '変更'; expect(player.identity.name).toBe('独自選手');
  expect(Object.isFrozen(player)).toBe(true); expect(Object.isFrozen(player.traits.labels)).toBe(true);
  expect(() => { (player.identity as { name: string }).name = '改変'; }).toThrow();
});

it.each([
  (value: ReturnType<typeof draft>) => { value.capability.maximumSweetSpotSpeedMps = NaN; },
  (value: ReturnType<typeof draft>) => { value.body.massKg = Infinity; },
  (value: ReturnType<typeof draft>) => { value.bat.sweetSpotT = 1; },
  (value: ReturnType<typeof draft>) => { value.bat.sweetSpotT = 0.5; },
  (value: ReturnType<typeof draft>) => { value.capability.motorLatencyTicks = 140_000.5; },
  (value: ReturnType<typeof draft>) => { value.capability.positionErrorMeters = -0.1; },
  (value: ReturnType<typeof draft>) => { value.traits.badBallControl = 1.01; },
  (value: ReturnType<typeof draft>) => { value.swing.speedMps = value.capability.maximumSweetSpotSpeedMps + 1; },
  (value: ReturnType<typeof draft>) => { value.schemaVersion = 2; },
])('rejects invalid numerical domains, clock units, schema and explicit swing speed ceilings', change => {
  const value = draft(); change(value); expect(() => createWorkbenchPlayer(value)).toThrow();
});

it('rejects unknown fields, duplicate labels, accessors and cyclic data without invoking a getter', () => {
  expect(() => createWorkbenchPlayer({ ...defaultWorkbenchPlayer(), power: 250 })).toThrow(/fields/);
  const value = draft(); value.traits.labels = ['同じ', '同じ'];
  expect(() => createWorkbenchPlayer(value)).toThrow(/duplicate/);
  let called = 0;
  const active = { ...defaultWorkbenchPlayer() };
  Object.defineProperty(active, 'body', { enumerable: true, get() { called++; return {}; } });
  expect(() => createWorkbenchPlayer(active)).toThrow(/accessor/); expect(called).toBe(0);
  const cyclic = { ...defaultWorkbenchPlayer(), cycle: null as unknown }; cyclic.cycle = cyclic;
  expect(() => createWorkbenchPlayer(cyclic)).toThrow(/cycles/);
});

it('computes mean/population SD from the supplied current league and reverses error orientation', () => {
  const player = member('candidate', 'CUSTOM', 40, 0.01);
  const population = [member('npb-a', 'NPB', 30, 0.02), member('npb-b', 'NPB', 40, 0.04), member('mlb-a', 'MLB', 80, 0.9)];
  const result = previewLeagueRatings(player, population, 'NPB');
  expect(result).toMatchObject({ sampleCount: 2, available: true, policyId: 'workbench-population-preview-v1' });
  expect(result.metrics.find(metric => metric.key === 'maximumSweetSpotSpeedMps'))
    .toMatchObject({ actual: 40, mean: 35, stddev: 5, rating: 70, unit: 'm/s' });
  expect(result.metrics.find(metric => metric.key === 'positionErrorMeters')!.rating).toBeCloseTo(90);
  expect(result.metrics.find(metric => metric.key === 'pitchSpeedMps')!.rating).toBeNull();
  const changed = previewLeagueRatings(player, [...population, member('npb-c', 'NPB', 60, 0.06)], 'NPB');
  expect(changed.sampleCount).toBe(3);
  expect(changed.metrics[0].mean).toBeCloseTo(130 / 3);
  expect(changed.metrics[0].rating).not.toBe(result.metrics[0].rating);
});

it('does not invent a reference from one member or zero variance and rejects duplicate population identities', () => {
  const player = defaultWorkbenchPlayer();
  expect(previewLeagueRatings(player, [member('a', 'NLB', 45)], 'NLB').metrics.every(metric => metric.rating === null)).toBe(true);
  const flat = previewLeagueRatings(player, [member('a', 'KBO', 45), member('b', 'KBO', 45)], 'KBO');
  expect(flat.available).toBe(false); expect(flat.metrics.every(metric => metric.rating === null)).toBe(true);
  expect(() => previewLeagueRatings(player, [member('a', 'NPB', 30), member('a', 'NPB', 40)], 'NPB')).toThrow(/duplicate/);
});

it('keeps above-100 authoring previews and identical physical inputs while switching preview leagues', () => {
  const player = defaultWorkbenchPlayer(), before = JSON.stringify(player), sources = exportWorkbenchPlayerSources(player);
  const population = [member('a', 'NPB', 10), member('b', 'NPB', 11), member('c', 'MLB', 80), member('d', 'MLB', 81)];
  const npb = previewLeagueRatings(player, population, 'NPB'), mlb = previewLeagueRatings(player, population, 'MLB');
  expect(npb.metrics[0].rating).toBe(1430); expect(mlb.metrics[0].rating).toBe(0);
  expect(JSON.stringify(player)).toBe(before); expect(exportWorkbenchPlayerSources(player)).toEqual(sources);
  expect(npb.metrics[0].actual).toBe(mlb.metrics[0].actual);
});

it('exports exact Native parameter value shapes and keeps external acceptance and actor context explicit', () => {
  const player = defaultWorkbenchPlayer(), pack = exportWorkbenchPlayerSources(player);
  expect(pack.boundary).toBe('AUTHORING_VALUES_NOT_ACCEPTED_NATIVE_SOURCE');
  expect(pack.ticksPerSecond).toBe(WORKBENCH_TICKS_PER_SECOND);
  expect(battingCapabilityValuesInput(pack.capability)).toEqual(pack.capability);
  expect(battingRepertoireValuesInput(pack.repertoire)).toEqual(pack.repertoire);
  expect(battingDecisionValuesInput(pack.decision)).toEqual(pack.decision);
  expect(pack.equipment.ball).toMatchObject({ massKg: 0.145, radiusM: 0.0366, rotationalInertiaFactor: 0.378 });
  expect(pack.authoring).toEqual(player);
  expect(pack).not.toHaveProperty('personId'); expect(pack).not.toHaveProperty('sourceId');
  expect(pack.equipment.batPhysical.radiusProfile.knots.map(knot => knot.t)).toEqual([0, 0.04, 0.30, 0.65, 0.78, 1]);
  expect(sampleBatRadius(pack.equipment.batPhysical.radiusProfile, 0.78)).toBeGreaterThan(sampleBatRadius(pack.equipment.batPhysical.radiusProfile, 0.04));
});

it('derives generic solid-bat inertia from actual length/mass and preserves unsupported knobs in authoring', () => {
  const player = defaultWorkbenchPlayer(), before = exportWorkbenchPlayerSources(player);
  const changed = createWorkbenchPlayer({ ...player, bat: { ...player.bat, lengthM: player.bat.lengthM * 1.2, massKg: player.bat.massKg * 2 },
    traits: { badBallControl: 0.8, labels: ['独自技術'] }, swing: { ...player.swing, loadAngleDeg: -50, handTravelM: 0.3 } });
  const after = exportWorkbenchPlayerSources(changed);
  expect(after.equipment.batPhysical.axialMomentOfInertiaKgM2).toBeCloseTo(before.equipment.batPhysical.axialMomentOfInertiaKgM2 * 2);
  expect(after.equipment.batPhysical.transverseMomentOfInertiaKgM2).toBeGreaterThan(before.equipment.batPhysical.transverseMomentOfInertiaKgM2 * 2);
  expect(after.equipment.batPhysical.centerOfMassT).toBeCloseTo(before.equipment.batPhysical.centerOfMassT);
  expect(after.authoring.traits.badBallControl).toBe(0.8); expect(after.authoring.swing.handTravelM).toBe(0.3);
  expect(cloneInert(after)).toEqual(after);
});

it('accepts experimental bat dimensions without narrowing existing workbench inputs', () => {
  for (const [lengthM, massKg] of [[.2, .05], [3, 5]]) {
    const value = draft(); Object.assign(value.bat, { lengthM, massKg });
    const before = structuredClone(value), player = createWorkbenchPlayer(value);
    expect(player.bat).toMatchObject({ lengthM, massKg }); expect(value).toEqual(before);
    expect(exportWorkbenchPlayerSources(player).repertoire.profiles[0].profile.batLengthM).toBe(lengthM);
  }
  for (const [key, values] of [['lengthM', [0, 3.0001, NaN, Infinity]], ['massKg', [0, 5.0001, NaN, Infinity]]] as const) {
    for (const number of values) {
      const value = draft(); value.bat[key] = number; const before = structuredClone(value);
      expect(() => createWorkbenchPlayer(value)).toThrow(); expect(value).toEqual(before);
    }
  }
});
