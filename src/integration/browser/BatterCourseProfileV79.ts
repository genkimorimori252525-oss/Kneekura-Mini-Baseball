import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';

/** Local authored motor consistency and fixed-field direction intention.
 * Reference averages are targets for adaptation, never hit probabilities. */
export type BatterCourseProfileV79 = Readonly<{
  version: 'batter_course_profile_v79'; referenceAverages: readonly number[]; effectScale: number;
  /** Left field, left-centre, centre, right-centre, right field. */
  directionWeights?: readonly number[];
}>;
export type BatterCourseZoneV79 = Readonly<{ centerX?: number; halfWidth: number; lowerY: number; upperY: number }>;
export type BatterCourseClassificationV79 = Readonly<{
  courseId: number | null; courseIndex: number | null; publicZoneId: number | null; insideStrikeZone: boolean;
}>;
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
function assert(value: unknown, message: string): asserts value { if (!value) throw Error('batter course v79: ' + message); }
const bounded = (value: unknown, lo: number, hi: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= lo && value <= hi;

export function createNeutralBatterCourseProfileV79(): BatterCourseProfileV79 {
  return freeze({ version: 'batter_course_profile_v79', referenceAverages: Array(63).fill(.25), effectScale: 1 });
}
export function validateBatterCourseProfileV79(raw: unknown): BatterCourseProfileV79 {
  const value = cloneInert(raw);
  assert(value && typeof value === 'object' && !Array.isArray(value), 'profile object required');
  const profile = value as Record<string, unknown>, required = ['version', 'referenceAverages', 'effectScale'];
  assert(required.every(key => Object.hasOwn(profile, key))
    && Object.keys(profile).every(key => required.includes(key) || key === 'directionWeights'), 'unknown or missing profile fields');
  assert(profile.version === 'batter_course_profile_v79' && bounded(profile.effectScale, 0, 3), 'invalid profile version or effect scale');
  assert(Array.isArray(profile.referenceAverages) && profile.referenceAverages.length === 63
    && profile.referenceAverages.every(value => bounded(value, 0, 1)), '63 finite reference averages required');
  if (Object.hasOwn(profile, 'directionWeights')) assert(Array.isArray(profile.directionWeights) && profile.directionWeights.length === 5
    && profile.directionWeights.every(value => bounded(value, 0, 1))
    && Math.abs(profile.directionWeights.reduce((sum, weight) => sum + weight, 0) - 1) <= 1e-9, 'five normalized direction weights required');
  return freeze(profile as unknown as BatterCourseProfileV79);
}

/** Continuous centre-position description, separate from ball-radius strike
 * adjudication. Columns 1..9 run left to right; rows 0..6 run bottom to top. */
export function classifyBatterCourseV79(input: Readonly<{ position: Readonly<{ x: number; y: number }>; zone: BatterCourseZoneV79 }>): BatterCourseClassificationV79 {
  const { position, zone } = input, centerX = zone.centerX ?? 0;
  assert(Number.isFinite(centerX) && Number.isFinite(zone.halfWidth) && zone.halfWidth > 0
    && Number.isFinite(zone.lowerY) && Number.isFinite(zone.upperY) && zone.upperY > zone.lowerY, 'finite nonempty zone required');
  assert(Number.isFinite(position.x) && Number.isFinite(position.y), 'finite course position required');
  const left = centerX - zone.halfWidth, right = centerX + zone.halfWidth,
    cellWidth = zone.halfWidth * 2 / 5, cellHeight = (zone.upperY - zone.lowerY) / 5,
    gridLeft = left - 2 * cellWidth, gridRight = right + 2 * cellWidth,
    gridBottom = zone.lowerY - cellHeight, gridTop = zone.upperY + cellHeight,
    insideStrikeZone = position.x >= left && position.x <= right && position.y >= zone.lowerY && position.y <= zone.upperY;
  let publicZoneId: number | null = null;
  if (insideStrikeZone) {
    const publicColumn = Math.min(2, Math.floor((position.x - left) / (right - left) * 3)),
      publicRow = Math.min(2, Math.floor((position.y - zone.lowerY) / (zone.upperY - zone.lowerY) * 3));
    publicZoneId = (2 - publicRow) * 3 + publicColumn + 1;
  }
  if (position.x < gridLeft || position.x > gridRight || position.y < gridBottom || position.y > gridTop)
    return { courseId: null, courseIndex: null, publicZoneId, insideStrikeZone };
  // Anchor at the actual zone, so subtraction rounding at its lower edge
  // cannot move an inclusive strike-zone position into an outside cell.
  // Upper strike-zone edges belong to the last inside cell as well.
  const column = position.x === right ? 6 : Math.max(0, Math.min(8, Math.floor((position.x - left) / cellWidth) + 2)),
    row = position.y === zone.upperY ? 5 : Math.max(0, Math.min(6, Math.floor((position.y - zone.lowerY) / cellHeight) + 1));
  return { courseId: (column + 1) * 10 + row, courseIndex: column * 7 + row, publicZoneId, insideStrikeZone };
}
