import { expect, it } from 'vitest';
import { createNeutralBatterCourseProfileV79 } from './BatterCourseProfileV79';
import { applyLivePhysicalRosterV1 } from './LivePhysicalRosterV1';
import { PUBLIC_COURSE_IDS_V87, classifyPublicCourseV87, createNeutralBatterCourseProfileV87,
  expandBatterCourseProfileV87ToV79, getInternalCourseIdsV87, getRepresentativeCourseIdV87,
  projectBatterCourseProfileV79ToV87, resolveBatterCourseProfileV87, validateBatterCourseProfileV87 } from './BatterCourseProfileV87';

const zone = { centerX: .1, halfWidth: .3, lowerY: .5, upperY: 1.4 };
const classify = (x: number, y: number) => classifyPublicCourseV87({ position: { x, y }, zone });
it('validates thirteen detached averages and preserves legacy author input', () => {
  const profile = createNeutralBatterCourseProfileV87();
  expect(profile.referenceAverages).toEqual(Array(13).fill(.25));
  expect(Object.isFrozen(profile.referenceAverages)).toBe(true);
  for (const bad of [null, { ...profile, referenceAverages: Array(12).fill(.25) }, { ...profile, referenceAverages: Array(13) },
    { ...profile, extra: 1 }, { ...profile, effectScale: NaN }, { ...profile, effectScale: 3.1 },
    { ...profile, referenceAverages: Array(13).fill(1.01) }, { ...profile, directionWeights: [1, 0, 0, 0] }])
    expect(() => validateBatterCourseProfileV87(bad)).toThrow();
  const legacy = { ...createNeutralBatterCourseProfileV79(), referenceAverages: Array.from({ length: 63 }, (_, i) => i / 100) };
  const before = JSON.stringify(legacy), projected = projectBatterCourseProfileV79ToV87(legacy);
  expect(resolveBatterCourseProfileV87({ batterCourseProfileV79: legacy })).toEqual(projected);
  expect(resolveBatterCourseProfileV87({ batterCourseProfileV87: profile, batterCourseProfileV79: legacy })).toEqual(profile);
  expect(JSON.stringify(legacy)).toBe(before);
});
it('classifies catcher-view central nine and four unbounded outside regions including exact boundaries', () => {
  expect(PUBLIC_COURSE_IDS_V87).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14]);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++)
    expect(classify(-.2 + (col + .5) * .2, 1.4 - (row + .5) * .3).publicZoneId).toBe(row * 3 + col + 1);
  expect(classify(zone.centerX - zone.halfWidth, zone.lowerY)).toMatchObject({ publicZoneId: 7, insideStrikeZone: true });
  expect(classify(zone.centerX + zone.halfWidth, zone.upperY)).toMatchObject({ publicZoneId: 3, insideStrikeZone: true });
  for (const [x, y, id] of [[-100, 100, 11], [100, 100, 12], [-100, -100, 13], [100, -100, 14], [.1, 2, 12]])
    expect(classify(x, y)).toMatchObject({ publicZoneId: id, insideStrikeZone: false });
  expect(() => classify(NaN, 1)).toThrow();
  expect(() => classifyPublicCourseV87({ position: { x: 0, y: 1 }, zone: { ...zone, halfWidth: 0 } })).toThrow();
});
it('uses overlap area for conversion, not cell counts, without changing directions or source arrays', () => {
  const old = { ...createNeutralBatterCourseProfileV79(), referenceAverages: Array(63).fill(0), directionWeights: [.1, .2, .4, .2, .1] };
  // Old x-cell 4 contributes two thirds of the new top-left region width.
  old.referenceAverages[3 * 7 + 5] = 1;
  expect(projectBatterCourseProfileV79ToV87(old).referenceAverages[0]).toBeCloseTo(.24, 12);
  const neutral = createNeutralBatterCourseProfileV87();
  expect(projectBatterCourseProfileV79ToV87(expandBatterCourseProfileV87ToV79(neutral))).toEqual(neutral);
  expect(expandBatterCourseProfileV87ToV79({ ...neutral, directionWeights: old.directionWeights }).directionWeights).toEqual(old.directionWeights);
  const all = PUBLIC_COURSE_IDS_V87.flatMap(id => getInternalCourseIdsV87(id));
  expect(new Set(all).size).toBe(63); expect(all).toHaveLength(63);
  for (const id of PUBLIC_COURSE_IDS_V87) expect(getInternalCourseIdsV87(id)).toContain(getRepresentativeCourseIdV87(id));
});
it('accepts an optional V87 physical profile without materializing it on old players', () => {
  const players = [{ playerId: 'p', name: 'P', bats: 'R' as const, heightMeters: 1.8 }];
  const roster = { version: 'live_physical_roster_v1', sourceId: 'test', entries: [{ playerId: 'p', sourceId: 'p', physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', batterCourseProfileV87: createNeutralBatterCourseProfileV87() } }] };
  expect(applyLivePhysicalRosterV1({ players, roster }).players[0].physical.batterCourseProfileV87).toEqual(createNeutralBatterCourseProfileV87());
  expect(applyLivePhysicalRosterV1({ players, roster: { ...roster, entries: [] } }).players[0].physical).not.toHaveProperty('batterCourseProfileV87');
});
