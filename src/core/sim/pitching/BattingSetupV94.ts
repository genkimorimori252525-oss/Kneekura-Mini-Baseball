import type { Vec3 } from '../../model/geometry';
import { resolveLandmarkStrikeZoneRegion } from './RulebookStrikeZone';
import { createStrikeZoneVolumeV94 } from './StrikeZoneVolumeV94';

export type NormalBattingPoseRatiosV94 = Readonly<{ shoulderTopRatio: number; uniformPantsTopRatio: number; kneecapBottomRatio: number }>;
export type BattingSetupV94 = Readonly<{
  boxPosition?: 'front' | 'middle' | 'back';
  normalPose?: NormalBattingPoseRatiosV94;
  footSeparationMeters?: number; footLengthMeters?: number; footWidthMeters?: number; strideMeters?: number;
}>;
export type BattingFootRectangleV94 = Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }>;

/** Local reduced-order normal-pose and support-foot defaults, not measurements
 * of named players. The provisional pose preserves the old .535/.27 heights. */
export const BATTING_SETUP_DEFAULTS_V94 = Object.freeze({
  normalPose: Object.freeze({ shoulderTopRatio: .65, uniformPantsTopRatio: .42, kneecapBottomRatio: .27 }),
  footSeparationMeters: .55, footLengthMeters: .27, footWidthMeters: .11, strideMeters: .18,
});
const ownFields = (value: unknown, names: readonly string[], required: readonly string[] = []): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => names.includes(key)) && required.every(key => Object.hasOwn(value, key));

export function validateBattingSetupV94(raw: unknown): asserts raw is BattingSetupV94 {
  if (!ownFields(raw, ['boxPosition', 'normalPose', 'footSeparationMeters', 'footLengthMeters', 'footWidthMeters', 'strideMeters']))
    throw Error('invalid V94 batting setup fields');
  if (Object.hasOwn(raw, 'boxPosition') && !['front', 'middle', 'back'].includes(raw.boxPosition as string)) throw Error('invalid V94 box position');
  if (Object.hasOwn(raw, 'normalPose')) {
    const pose = raw.normalPose;
    if (!ownFields(pose, ['shoulderTopRatio', 'uniformPantsTopRatio', 'kneecapBottomRatio'], ['shoulderTopRatio', 'uniformPantsTopRatio', 'kneecapBottomRatio'])
      || !Object.values(pose).every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1.25)
      || !((pose.shoulderTopRatio as number) > (pose.uniformPantsTopRatio as number) && (pose.uniformPantsTopRatio as number) > (pose.kneecapBottomRatio as number)))
      throw Error('invalid V94 normal batting pose ratios');
  }
  for (const [key, minimum, maximum] of [['footSeparationMeters', .1, 1.5], ['footLengthMeters', .1, .5], ['footWidthMeters', .05, .3], ['strideMeters', 0, .6]] as const) {
    const value = raw[key];
    if (Object.hasOwn(raw, key) && (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum))
      throw Error('invalid V94 batting support dimension: ' + key);
  }
  const separation = raw.footSeparationMeters as number | undefined ?? BATTING_SETUP_DEFAULTS_V94.footSeparationMeters,
    width = raw.footWidthMeters as number | undefined ?? BATTING_SETUP_DEFAULTS_V94.footWidthMeters,
    stride = raw.strideMeters as number | undefined ?? BATTING_SETUP_DEFAULTS_V94.strideMeters;
  if (separation + width + stride > 1.8288) throw Error('V94 support feet and stride cannot fit the batter box');
}

export function resolveLiveBattingSetupV94(input: Readonly<{ heightMeters: number; bats: 'R' | 'L'; contactDepthMeters?: number; battingSetupV94?: BattingSetupV94 }>) {
  if (!Number.isFinite(input.heightMeters) || input.heightMeters <= 0 || !['R', 'L'].includes(input.bats)
    || input.contactDepthMeters !== undefined && (!Number.isFinite(input.contactDepthMeters) || input.contactDepthMeters < .001 || input.contactDepthMeters > 2))
    throw Error('invalid V94 batter height, side or contact depth');
  const source = input.battingSetupV94;
  if (source !== undefined) validateBattingSetupV94(source);
  const ratios = { ...(source?.normalPose ?? BATTING_SETUP_DEFAULTS_V94.normalPose) }, h = input.heightMeters,
    landmarks = { shoulderTopY: ratios.shoulderTopRatio * h, uniformPantsTopY: ratios.uniformPantsTopRatio * h, kneecapBottomY: ratios.kneecapBottomRatio * h },
    region = resolveLandmarkStrikeZoneRegion({ plateCenterX: 0, landmarks }), volume = createStrikeZoneVolumeV94(region),
    footSeparationMeters = source?.footSeparationMeters ?? BATTING_SETUP_DEFAULTS_V94.footSeparationMeters,
    footLengthMeters = source?.footLengthMeters ?? BATTING_SETUP_DEFAULTS_V94.footLengthMeters,
    footWidthMeters = source?.footWidthMeters ?? BATTING_SETUP_DEFAULTS_V94.footWidthMeters,
    strideMeters = source?.strideMeters ?? BATTING_SETUP_DEFAULTS_V94.strideMeters,
    legalBox = { minX: input.bats === 'R' ? -1.5875 : .3683, maxX: input.bats === 'R' ? -.3683 : 1.5875, minZ: -.6985, maxZ: 1.1303 },
    legalBodyRangeZ = { min: legalBox.minZ + footSeparationMeters / 2 + footWidthMeters / 2,
      max: legalBox.maxZ - footSeparationMeters / 2 - footWidthMeters / 2 - strideMeters },
    boxPosition = source?.boxPosition ?? 'legacy',
    bodyZ = boxPosition === 'back' ? legalBodyRangeZ.min : boxPosition === 'front' ? legalBodyRangeZ.max
      : boxPosition === 'middle' ? (legalBodyRangeZ.min + legalBodyRangeZ.max) / 2 : -.2,
    bodyPosition: Vec3 = { x: input.bats === 'R' ? -.85 : .85, y: 0, z: bodyZ }, stanceOffsetZ = bodyZ + .2,
    foot = (z: number): BattingFootRectangleV94 => ({ minX: bodyPosition.x - footLengthMeters / 2, maxX: bodyPosition.x + footLengthMeters / 2,
      minZ: z - footWidthMeters / 2, maxZ: z + footWidthMeters / 2 }),
    readyFeet = [foot(bodyZ - footSeparationMeters / 2), foot(bodyZ + footSeparationMeters / 2)] as const,
    contactFeet = [readyFeet[0], foot(bodyZ + footSeparationMeters / 2 + strideMeters)] as const;
  if ([...readyFeet, ...contactFeet].some(rect => rect.minX < legalBox.minX - 1e-12 || rect.maxX > legalBox.maxX + 1e-12
    || rect.minZ < legalBox.minZ - 1e-12 || rect.maxZ > legalBox.maxZ + 1e-12)) throw Error('V94 ' + boxPosition + ' support feet exceed the batter box');
  return { version: 94 as const, boxPosition, bodyPosition, bodyZ, stanceOffsetZ,
    plateRearZ: Math.min(...volume.platePolygon.map(point => point.z)), plateFrontZ: Math.max(...volume.platePolygon.map(point => point.z)),
    contactPlaneZ: (input.contactDepthMeters ?? .15) + stanceOffsetZ,
    cameraOffsetZ: stanceOffsetZ, region, volume, normalPose: { ratios, landmarks,
      basis: source?.normalPose === undefined ? 'PROVISIONAL_LEGACY_HEIGHT_FALLBACK' as const : 'AUTHORED_NORMAL_BATTING_POSE' as const },
    legalBox, legalBodyRangeZ, readyFeet, contactFeet, support: { footSeparationMeters, footLengthMeters, footWidthMeters, strideMeters } };
}
