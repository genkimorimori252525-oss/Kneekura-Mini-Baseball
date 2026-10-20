import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { validateBatterCourseProfileV79, type BatterCourseProfileV79, type BatterCourseZoneV79 } from './BatterCourseProfileV79';

/** Catcher's view: high-left to low-right, then outside upper-left/right and lower-left/right. */
export const PUBLIC_COURSE_IDS_V87 = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14] as const);
export type PublicCourseIdV87 = typeof PUBLIC_COURSE_IDS_V87[number];
/** Author's course-response references, never a hit-probability roll or perceptual accuracy. */
export type BatterCourseProfileV87 = Readonly<{
  version: 'batter_course_profile_v87'; referenceAverages: readonly number[]; effectScale: number;
  directionWeights?: readonly number[];
}>;
export type PublicCourseClassificationV87 = Readonly<{ publicZoneId: PublicCourseIdV87; courseIndex: number; insideStrikeZone: boolean }>;
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
function assert(value: unknown, message: string): asserts value { if (!value) throw Error('batter course v87: ' + message); }
const bounded = (value: unknown, lo: number, hi: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= lo && value <= hi;

export function createNeutralBatterCourseProfileV87(): BatterCourseProfileV87 {
  return freeze({ version: 'batter_course_profile_v87', referenceAverages: Array(13).fill(.25), effectScale: 1 });
}
export function validateBatterCourseProfileV87(raw: unknown): BatterCourseProfileV87 {
  const value = cloneInert(raw);
  assert(value && typeof value === 'object' && !Array.isArray(value), 'profile object required');
  const profile = value as Record<string, unknown>, required = ['version', 'referenceAverages', 'effectScale'];
  assert(required.every(key => Object.hasOwn(profile, key))
    && Object.keys(profile).every(key => required.includes(key) || key === 'directionWeights'), 'unknown or missing profile fields');
  assert(profile.version === 'batter_course_profile_v87' && bounded(profile.effectScale, 0, 3), 'invalid profile version or effect scale');
  assert(Array.isArray(profile.referenceAverages) && profile.referenceAverages.length === 13
    && profile.referenceAverages.every(value => bounded(value, 0, 1)), '13 finite reference averages required');
  if (Object.hasOwn(profile, 'directionWeights')) assert(Array.isArray(profile.directionWeights) && profile.directionWeights.length === 5
    && profile.directionWeights.every(value => bounded(value, 0, 1))
    && Math.abs(profile.directionWeights.reduce((sum, weight) => sum + weight, 0) - 1) <= 1e-9, 'five normalized direction weights required');
  return freeze(profile as unknown as BatterCourseProfileV87);
}

/** Ball-centre classification, independent from radius-aware official strike adjudication.
 * Finite positions beyond the old 63-cell grid remain known outside positions. */
export function classifyPublicCourseV87(input: Readonly<{ position: Readonly<{ x: number; y: number }>; zone: BatterCourseZoneV79 }>): PublicCourseClassificationV87 {
  const { position, zone } = input, centerX = zone.centerX ?? 0;
  assert(Number.isFinite(centerX) && Number.isFinite(zone.halfWidth) && zone.halfWidth > 0
    && Number.isFinite(zone.lowerY) && Number.isFinite(zone.upperY) && zone.upperY > zone.lowerY, 'finite nonempty zone required');
  assert(Number.isFinite(position.x) && Number.isFinite(position.y), 'finite course position required');
  const left = centerX - zone.halfWidth, right = centerX + zone.halfWidth,
    insideStrikeZone = position.x >= left && position.x <= right && position.y >= zone.lowerY && position.y <= zone.upperY;
  if (insideStrikeZone) {
    const col = Math.min(2, Math.floor((position.x - left) / (right - left) * 3)),
      row = Math.min(2, Math.floor((position.y - zone.lowerY) / (zone.upperY - zone.lowerY) * 3)),
      publicZoneId = ((2 - row) * 3 + col + 1) as PublicCourseIdV87;
    return { publicZoneId, courseIndex: publicZoneId - 1, insideStrikeZone };
  }
  const publicZoneId = ((position.y >= (zone.lowerY + zone.upperY) / 2 ? 11 : 13) + (position.x >= centerX ? 1 : 0)) as PublicCourseIdV87;
  return { publicZoneId, courseIndex: publicZoneId - 2, insideStrikeZone };
}

type Rect = Readonly<{ left: number; right: number; bottom: number; top: number }>;
const unitZone = Object.freeze({ centerX: 0, halfWidth: .5, lowerY: 0, upperY: 1 });
const cells = Array.from({ length: 63 }, (_, i): Rect => ({ left: -.9 + Math.floor(i / 7) * .2, right: -.9 + (Math.floor(i / 7) + 1) * .2, bottom: -.2 + i % 7 * .2, top: -.2 + (i % 7 + 1) * .2 }));
const intersect = (a: Rect, b: Rect): number => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom));
const inside: Rect = { left: -.5, right: .5, bottom: 0, top: 1 };
const regionRects: readonly Rect[] = PUBLIC_COURSE_IDS_V87.map(id => id <= 9
  ? { left: -.5 + (id - 1) % 3 / 3, right: -.5 + ((id - 1) % 3 + 1) / 3, bottom: (2 - Math.floor((id - 1) / 3)) / 3, top: (3 - Math.floor((id - 1) / 3)) / 3 }
  : { left: id % 2 ? -.9 : 0, right: id % 2 ? 0 : .9, bottom: id <= 12 ? .5 : -.2, top: id <= 12 ? 1.2 : .5 });
/** Overlap-area conversion is intentionally lossy at 5-by-5 versus 3-by-3 boundaries.
 * The original profile is never rewritten. No MLB data is used here. */
const overlap = cells.map(cell => regionRects.map((region, i) => {
  const area = intersect(cell, region);
  if (i < 9) return area;
  const clipped = { left: Math.max(region.left, inside.left), right: Math.min(region.right, inside.right), bottom: Math.max(region.bottom, inside.bottom), top: Math.min(region.top, inside.top) };
  return Math.max(0, area - intersect(cell, clipped));
}));
const weighted = (values: readonly number[], weights: readonly number[]) => {
  const entries = values.map((value, i) => ({ value, weight: weights[i] })).filter(entry => entry.weight > 1e-14);
  assert(entries.length > 0, 'nonempty course conversion required');
  if (entries.every(entry => entry.value === entries[0].value)) return entries[0].value;
  return entries.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / entries.reduce((sum, entry) => sum + entry.weight, 0);
};
export function expandBatterCourseProfileV87ToV79(raw: BatterCourseProfileV87): BatterCourseProfileV79 {
  const profile = validateBatterCourseProfileV87(raw);
  return validateBatterCourseProfileV79({ ...profile, version: 'batter_course_profile_v79', referenceAverages: overlap.map(weights => weighted(profile.referenceAverages, weights)) });
}
export function projectBatterCourseProfileV79ToV87(raw: BatterCourseProfileV79): BatterCourseProfileV87 {
  const profile = validateBatterCourseProfileV79(raw);
  return validateBatterCourseProfileV87({ ...profile, version: 'batter_course_profile_v87', referenceAverages: PUBLIC_COURSE_IDS_V87.map((_, i) => weighted(profile.referenceAverages, overlap.map(weights => weights[i]))) });
}
export function resolveBatterCourseProfileV87(physical: Readonly<{ batterCourseProfileV87?: BatterCourseProfileV87; batterCourseProfileV79?: BatterCourseProfileV79 }> = {}): BatterCourseProfileV87 {
  return physical.batterCourseProfileV87 !== undefined ? validateBatterCourseProfileV87(physical.batterCourseProfileV87)
    : physical.batterCourseProfileV79 !== undefined ? projectBatterCourseProfileV79ToV87(physical.batterCourseProfileV79) : createNeutralBatterCourseProfileV87();
}
const internalGroups = PUBLIC_COURSE_IDS_V87.map(id => Object.freeze(cells.flatMap((cell, i) => classifyPublicCourseV87({ position: { x: (cell.left + cell.right) / 2, y: (cell.bottom + cell.top) / 2 }, zone: unitZone }).publicZoneId === id ? [(Math.floor(i / 7) + 1) * 10 + i % 7] : [])));
export function getInternalCourseIdsV87(publicZoneId: number): readonly number[] {
  const index = (PUBLIC_COURSE_IDS_V87 as readonly number[]).indexOf(publicZoneId); assert(index >= 0, 'invalid public course ID'); return internalGroups[index];
}
export function getRepresentativeCourseIdV87(publicZoneId: number): number {
  const ids = getInternalCourseIdsV87(publicZoneId); return ids[Math.floor(ids.length / 2)];
}
/** Existing 63-cell practice commands select the public region containing their centre. */
export function publicCourseIndexForInternalIdV87(courseId: number): number {
  const column = Math.floor(courseId / 10), row = courseId % 10;
  assert(Number.isInteger(courseId) && column >= 1 && column <= 9 && row >= 0 && row <= 6, 'invalid internal course ID');
  const cell = cells[(column - 1) * 7 + row];
  return classifyPublicCourseV87({ position: { x: (cell.left + cell.right) / 2, y: (cell.bottom + cell.top) / 2 }, zone: unitZone }).courseIndex;
}
