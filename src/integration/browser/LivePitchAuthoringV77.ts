import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';

export const LIVE_PITCH_TYPES_V77 = ['fastball', 'slider', 'curve', 'changeup', 'cutter', 'sinker', 'splitter'] as const;
export type LivePitchTypeV77 = typeof LIVE_PITCH_TYPES_V77[number];
export type PitchRepertoireEntryV77 = Readonly<{ pitchType: LivePitchTypeV77; releaseSpeedMps: number; spinRadPerSecond: Vec3 }>;
export type PitchRepertoireV77 = readonly PitchRepertoireEntryV77[];
/** Authored presentation on the existing delivery clock, not measured biomechanics. */
export type PitchingMotionV77 = Readonly<{ preparationMs: number; headMotionScale: number }>;
const norm = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const bounded = (n: unknown, low: number, high: number): n is number => typeof n === 'number' && Number.isFinite(n) && n >= low && n <= high;
function assert(value: unknown, message: string): asserts value { if (!value) throw Error('pitch authoring: ' + message); }
function fields(raw: unknown, keys: readonly string[]): asserts raw is Record<string, unknown> {
  assert(raw && typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length === keys.length
    && Object.keys(raw).every(k => keys.includes(k)), 'unknown or missing fields');
}
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
function spinVector(raw: unknown): asserts raw is Vec3 {
  fields(raw, ['x', 'y', 'z']); assert(Object.values(raw).every(n => typeof n === 'number' && Number.isFinite(n)) && norm(raw as Vec3) <= 1200, 'invalid spin vector');
}
export function validatePitchRepertoireV77(raw: unknown, maximumPitchSpeedMps?: number): PitchRepertoireV77 {
  const rows = cloneInert(raw);
  assert(maximumPitchSpeedMps === undefined || bounded(maximumPitchSpeedMps, 15, 85), 'invalid maximum pitch speed');
  assert(Array.isArray(rows) && rows.length >= 1 && rows.length <= 7, 'one to seven pitch entries required');
  const seen = new Set<string>();
  for (const row of rows) {
    fields(row, ['pitchType', 'releaseSpeedMps', 'spinRadPerSecond']);
    assert(typeof row.pitchType === 'string' && (LIVE_PITCH_TYPES_V77 as readonly string[]).includes(row.pitchType) && !seen.has(row.pitchType), 'unsupported or duplicate pitch');
    seen.add(row.pitchType);
    assert(bounded(row.releaseSpeedMps, 15, 85) && row.releaseSpeedMps <= (maximumPitchSpeedMps ?? 85), 'pitch speed exceeds individual limit');
    spinVector(row.spinRadPerSecond);
  }
  return freeze(rows as unknown as PitchRepertoireV77);
}
export function validatePitchingMotionV77(raw: unknown): PitchingMotionV77 {
  const value = cloneInert(raw); fields(value, ['preparationMs', 'headMotionScale']);
  assert(bounded(value.preparationMs, 500, 4000) && bounded(value.headMotionScale, 0, 2), 'invalid authored delivery motion');
  return freeze(value as unknown as PitchingMotionV77);
}
const factors: Record<LivePitchTypeV77, number> = { fastball: 1, slider: .91, curve: .8, changeup: .82, cutter: .95, sinker: .96, splitter: .89 };
const axes: Record<Exclude<LivePitchTypeV77, 'fastball'>, Vec3> = { slider: { x: .25, y: -.8, z: .55 }, curve: { x: -1, y: 0, z: .1 }, changeup: { x: .65, y: .2, z: .25 },
  cutter: { x: .7, y: -.45, z: .25 }, sinker: { x: .55, y: .5, z: .2 }, splitter: { x: -.15, y: .15, z: .3 } };
export function resolvePitcherRepertoireV77(raw: Readonly<{ releaseSpeedMps: number; spinRadPerSecond: Vec3; maximumPitchSpeedMps?: number; pitchRepertoire?: PitchRepertoireV77 }>) {
  const physical = cloneInert(raw);
  assert(bounded(physical.releaseSpeedMps, 15, 85) && (physical.maximumPitchSpeedMps === undefined || bounded(physical.maximumPitchSpeedMps, 15, 85)), 'invalid baseline pitch speed'); spinVector(physical.spinRadPerSecond);
  const authored = physical.pitchRepertoire === undefined ? [] : validatePitchRepertoireV77(physical.pitchRepertoire, physical.maximumPitchSpeedMps);
  return freeze(LIVE_PITCH_TYPES_V77.map(pitchType => {
    const entry = authored.find(row => row.pitchType === pitchType); if (entry) return { ...entry, authored: true };
    const factor = factors[pitchType], spinMagnitude = norm(physical.spinRadPerSecond),
      scale = pitchType === 'fastball' ? 1 : spinMagnitude * (pitchType === 'changeup' ? .7 : 1) / norm(axes[pitchType]),
      axis = pitchType === 'fastball' ? physical.spinRadPerSecond : axes[pitchType];
    return { pitchType, releaseSpeedMps: Math.min(physical.releaseSpeedMps, physical.maximumPitchSpeedMps ?? Infinity) * factor,
      spinRadPerSecond: pitchType === 'fastball' ? axis : { x: axis.x * scale, y: axis.y * scale, z: axis.z * scale }, authored: false };
  }));
}
export function pitchSpinFromControlsV77(raw: Readonly<{ spinRpm: number; breakDirectionDegrees: number; gyroFraction: number }>): Vec3 {
  const controls = cloneInert(raw); fields(controls, ['spinRpm', 'breakDirectionDegrees', 'gyroFraction']);
  assert(bounded(controls.spinRpm, 0, 1200 * 60 / (2 * Math.PI)) && bounded(controls.breakDirectionDegrees, -360, 360)
    && bounded(controls.gyroFraction, -1, 1), 'invalid spin controls');
  const speed = controls.spinRpm * 2 * Math.PI / 60, theta = controls.breakDirectionDegrees * Math.PI / 180,
    transverse = speed * Math.sqrt(Math.max(0, 1 - controls.gyroFraction ** 2));
  // Looking from catcher toward mound: 0=up, 90=world +x. Magnus = omega x velocity.
  return freeze({ x: transverse * Math.cos(theta), y: -transverse * Math.sin(theta), z: speed * controls.gyroFraction });
}
export function pitchSpinToControlsV77(raw: Vec3) {
  const spin = cloneInert(raw); spinVector(spin); const speed = norm(spin);
  return freeze({ spinRpm: speed * 60 / (2 * Math.PI), breakDirectionDegrees: speed === 0 ? 0 : (Math.atan2(-spin.y, spin.x) * 180 / Math.PI + 360) % 360,
    gyroFraction: speed === 0 ? 0 : spin.z / speed });
}
