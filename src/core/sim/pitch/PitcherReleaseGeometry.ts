import type { Vec3 } from '../../model/geometry';

export type ArmSlotClass = 'OVERHAND' | 'THREE_QUARTER' | 'SIDEARM' | 'UNDERHAND';
export type ReleaseHeightTier =
  | 'VERY_LOW' | 'LOW' | 'LOW_MID' | 'MID' | 'HIGH_MID' | 'HIGH' | 'VERY_HIGH';

export type PitcherReleaseGeometryProfile = Readonly<{
  armSlotClass: ArmSlotClass;
  releaseHeightTier: ReleaseHeightTier;
  releaseHeightRatio: number;
  releaseLateralRatio: number;
  releaseExtensionRatio: number;
  armSlotElevationDeg: number;
  armSlotAzimuthDeg: number;
}>;

export type PitcherBodyReleaseModel = Readonly<{
  heightMeters: number;
  shoulderHeightMeters: number;
  armReachMeters: number;
  postureDropMeters: number;
  throwingSide: 'LEFT' | 'RIGHT';
  moundReference: Vec3;
}>;

const tiers: readonly ReleaseHeightTier[] = [
  'VERY_LOW', 'LOW', 'LOW_MID', 'MID', 'HIGH_MID', 'HIGH', 'VERY_HIGH',
];
const slots: readonly ArmSlotClass[] = ['OVERHAND', 'THREE_QUARTER', 'SIDEARM', 'UNDERHAND'];

const finite = (name: string, value: number): void => {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
};

export const projectReleaseHeightTier = (
  releaseHeightRatio: number,
  boundaries: readonly number[],
): ReleaseHeightTier => {
  finite('releaseHeightRatio', releaseHeightRatio);
  if (boundaries.length !== tiers.length - 1) {
    throw new Error('release height tier projection requires six boundaries');
  }
  let previous = -Infinity;
  for (const boundary of boundaries) {
    finite('release height tier boundary', boundary);
    if (boundary <= previous) throw new Error('release height tier boundaries must increase');
    previous = boundary;
  }
  let index = 0;
  while (index < boundaries.length && releaseHeightRatio >= boundaries[index]) index += 1;
  return tiers[index];
};

export const resolvePitcherReleasePosition = (
  body: PitcherBodyReleaseModel,
  profile: PitcherReleaseGeometryProfile,
): Vec3 => {
  if (!slots.includes(profile.armSlotClass) || !tiers.includes(profile.releaseHeightTier)) {
    throw new Error('unknown release geometry classification');
  }
  for (const [name, value] of Object.entries({
    ...body.moundReference, heightMeters: body.heightMeters,
    shoulderHeightMeters: body.shoulderHeightMeters,
    armReachMeters: body.armReachMeters,
    postureDropMeters: body.postureDropMeters,
    releaseHeightRatio: profile.releaseHeightRatio,
    releaseLateralRatio: profile.releaseLateralRatio,
    releaseExtensionRatio: profile.releaseExtensionRatio,
    armSlotElevationDeg: profile.armSlotElevationDeg,
    armSlotAzimuthDeg: profile.armSlotAzimuthDeg,
  })) finite(name, value);
  if (
    body.heightMeters <= 0 || body.shoulderHeightMeters <= 0
    || body.shoulderHeightMeters > body.heightMeters || body.armReachMeters <= 0
    || body.postureDropMeters < 0 || body.postureDropMeters >= body.shoulderHeightMeters
    || (body.throwingSide !== 'LEFT' && body.throwingSide !== 'RIGHT')
    || profile.releaseLateralRatio < 0 || profile.releaseExtensionRatio < 0
  ) throw new Error('invalid pitcher body or release geometry');

  const side = body.throwingSide === 'RIGHT' ? 1 : -1;
  const position = Object.freeze({
    x: body.moundReference.x + side * body.armReachMeters * profile.releaseLateralRatio,
    y: body.moundReference.y + body.heightMeters * profile.releaseHeightRatio
      - body.postureDropMeters,
    z: body.moundReference.z - body.armReachMeters * profile.releaseExtensionRatio,
  });
  const shoulderY = body.moundReference.y + body.shoulderHeightMeters
    - body.postureDropMeters;
  const reachSquared = (position.x - body.moundReference.x) ** 2
    + (position.y - shoulderY) ** 2
    + (position.z - body.moundReference.z) ** 2;
  if (reachSquared > body.armReachMeters ** 2 + 1e-12 || position.y < body.moundReference.y) {
    throw new Error('release point exceeds the body reach envelope');
  }
  return position;
};
