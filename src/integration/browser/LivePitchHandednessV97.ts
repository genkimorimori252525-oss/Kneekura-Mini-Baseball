import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import { multiplyQuaternions, type Quaternion } from '../../core/sim/pitching/BaseballOrientation';
import { resolvePitcherRepertoireV78, validatePitchRepertoireV78, type PitchAuthoringPhysicalV78, type PitchRepertoireV78 } from './LivePitchAuthoringV78';
import type { PitchRepertoireV77 } from './LivePitchAuthoringV77';

export type PitchHandV97 = 'R' | 'L';
export type MirroredPitcherPhysicalV97<T> = Omit<T, 'pitchRepertoire' | 'pitchRepertoireV78'> & Readonly<{
  pitchRepertoire?: PitchRepertoireV77; pitchRepertoireV78?: PitchRepertoireV78;
}>;
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const mirrorSpin = (spin: Vec3): Vec3 => ({ x: spin.x, y: -spin.y, z: -spin.z });
// Same S*R*B reflection as V78 presets. The seam curve is invariant under
// body x/y exchange B, so reflecting quaternion y/z alone is insufficient.
const mirrorOrientation = (q: Quaternion): Quaternion => multiplyQuaternions(
  { w: q.w, x: q.x, y: -q.y, z: -q.z }, { w: Math.SQRT1_2, x: 0, y: 0, z: Math.SQRT1_2 },
);

/** Explicit authoring transaction only; reading/importing a world-space pitch
 * never mirrors it. Materialize the old repertoire before reflecting its owned
 * copies, including the baseline fastball. Retain canonical baseline SI so new
 * preset candidates do not inherit a second handedness reflection. */
export function mirrorPitcherPhysicalHandV97<T extends PitchAuthoringPhysicalV78>(
  raw: T, fromThrows: PitchHandV97, toThrows: PitchHandV97,
): MirroredPitcherPhysicalV97<T> {
  if (!['R', 'L'].includes(fromThrows) || !['R', 'L'].includes(toThrows)) throw Error('pitch handedness v97: invalid throwing side');
  const physical = cloneInert(raw), rows = resolvePitcherRepertoireV78(physical, fromThrows);
  if (fromThrows === toThrows) return freeze(physical);
  const pitches = rows.map(({ authored: _authored, ...row }) => ({ ...row,
    spinRadPerSecond: mirrorSpin(row.spinRadPerSecond),
    ...(row.releaseOrientation === undefined ? {} : { releaseOrientation: mirrorOrientation(row.releaseOrientation) }),
    ...(row.movementV92 === undefined ? {} : { movementV92: { ...row.movementV92,
      referenceSpinRadPerSecond: mirrorSpin(row.movementV92.referenceSpinRadPerSecond) } }),
  }));
  const { pitchRepertoire: _legacy, pitchRepertoireV78: _prior, ...rest } = physical,
    result = { ...rest, pitchRepertoireV78: validatePitchRepertoireV78({ version: 'pitch_repertoire_v78', pitches }, physical.maximumPitchSpeedMps) };
  return freeze(result);
}
