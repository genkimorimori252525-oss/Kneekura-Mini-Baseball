import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { fnv1a32 } from '../../rng/DeterministicRng';
import { projectReleaseHeightTier, resolvePitcherReleasePosition,
  type ArmSlotClass, type PitcherBodyReleaseModel, type PitcherReleaseGeometryProfile } from '../../sim/pitch/PitcherReleaseGeometry';
import { createDevelopmentRandom } from './DevelopmentRandom';
import { derivePlayerPersonSeed } from './PlayerPersonPriors';

export const PITCHER_RELEASE_GENERATION_VERSION = 'pitcher-release-generation-v1' as const;
const dimensions = ['releaseHeightRatio', 'releaseLateralRatio', 'releaseExtensionRatio', 'armSlotElevationDeg', 'armSlotAzimuthDeg'] as const;
type Dimension = typeof dimensions[number];
export type PitcherReleaseBody = Omit<PitcherBodyReleaseModel, 'moundReference'>;
export type PitcherReleaseSlotPrior = Readonly<{
  armSlotClass: ArmSlotClass; weight: number;
  ranges: Readonly<Record<Dimension, Readonly<{ min: number; max: number }>>>;
}>;
export type PitcherReleaseGenerationPolicy = Readonly<{
  policyId: string; version: string; availableAtDay: number;
  maximumAttempts: number; tierBoundaries: readonly number[];
  slots: readonly PitcherReleaseSlotPrior[];
}>;
export type PitcherReleaseGenerationInput = Readonly<{
  careerId: string; playerId: string; createdAtDay: number;
  careerSeed: number; body: PitcherReleaseBody; policy: PitcherReleaseGenerationPolicy;
}>;
export type GeneratedPitcherReleaseGeometry = Readonly<{
  careerId: string; playerId: string; createdAtDay: number;
  body: PitcherReleaseBody; profile: PitcherReleaseGeometryProfile; tierBoundaries: readonly number[];
  /** World creation provenance; Match consumes the frozen profile, not this seed. */
  generation: Readonly<{ version: typeof PITCHER_RELEASE_GENERATION_VERSION;
    policyId: string; policyVersion: string; playerSeed: number; attempts: number }>;
}>;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const fields = (value: unknown, names: readonly string[]): boolean => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name));

/** Once per newly accepted Pitcher, using explicit priors, never per Match pitch. */
export const generatePitcherReleaseGeometry = (raw: PitcherReleaseGenerationInput): GeneratedPitcherReleaseGeometry => {
  const input = cloneInert(raw);
  if (!fields(input, ['careerId', 'playerId', 'createdAtDay', 'careerSeed', 'body', 'policy'])
    || !id(input.careerId) || !id(input.playerId) || !day(input.createdAtDay)) throw new Error('invalid Pitcher generation scope');
  const playerSeed = derivePlayerPersonSeed(input.careerId, input.playerId, input.careerSeed);
  const { policy, body } = input;
  if (!fields(policy, ['policyId', 'version', 'availableAtDay', 'maximumAttempts', 'tierBoundaries', 'slots'])
    || !id(policy.policyId) || !id(policy.version) || !day(policy.availableAtDay) || policy.availableAtDay > input.createdAtDay
    || !Number.isSafeInteger(policy.maximumAttempts) || policy.maximumAttempts < 1 || policy.maximumAttempts > 1024
    || !Array.isArray(policy.tierBoundaries) || !Array.isArray(policy.slots) || policy.slots.length < 1 || policy.slots.length > 4
    || new Set(policy.slots.map((slot) => slot?.armSlotClass)).size !== policy.slots.length) throw new Error('invalid Pitcher generation policy');
  if (!fields(body, ['heightMeters', 'shoulderHeightMeters', 'armReachMeters', 'postureDropMeters', 'throwingSide'])) throw new Error('invalid Pitcher generation body');
  const reference = { ...body, moundReference: { x: 0, y: 0, z: 0 } };
  const probeRatio = body.shoulderHeightMeters / body.heightMeters;
  const probe: PitcherReleaseGeometryProfile = { armSlotClass: 'OVERHAND', releaseHeightTier: projectReleaseHeightTier(probeRatio, policy.tierBoundaries),
    releaseHeightRatio: probeRatio, releaseLateralRatio: 0, releaseExtensionRatio: 0, armSlotElevationDeg: 0, armSlotAzimuthDeg: 0 };
  resolvePitcherReleasePosition(reference, probe);
  for (const slot of policy.slots) {
    if (!fields(slot, ['armSlotClass', 'weight', 'ranges']) || !['OVERHAND', 'THREE_QUARTER', 'SIDEARM', 'UNDERHAND'].includes(slot.armSlotClass)
      || !Number.isFinite(slot.weight) || slot.weight < 0 || !fields(slot.ranges, dimensions)) throw new Error('invalid Pitcher slot prior');
    for (const name of dimensions) {
      const range = slot.ranges[name];
      if (!fields(range, ['min', 'max']) || !Number.isFinite(range.min) || !Number.isFinite(range.max)
        || range.max < range.min || !Number.isFinite(range.max - range.min)
        || name.startsWith('release') && range.min < 0) throw new Error('invalid Pitcher geometry range');
    }
  }
  const weight = policy.slots.reduce((sum, slot) => sum + slot.weight, 0);
  if (!Number.isFinite(weight) || weight <= 0) throw new Error('invalid Pitcher slot prior weight');
  const random = createDevelopmentRandom(playerSeed, fnv1a32(PITCHER_RELEASE_GENERATION_VERSION));
  const roll = random() * weight;
  let cumulative = 0;
  const slot = policy.slots.find((prior) => { cumulative += prior.weight; return roll < cumulative; });
  if (!slot) throw new Error('invalid Pitcher slot prior selection');
  // Keep the selected class. Reject an impossible prior instead of silently changing its weight.
  for (let attempt = 1; attempt <= policy.maximumAttempts; attempt++) {
    const values = Object.fromEntries(dimensions.map((name) => { const range = slot.ranges[name];
      return [name, range.min + (range.max - range.min) * random()]; })) as Record<Dimension, number>;
    const profile: PitcherReleaseGeometryProfile = { ...values, armSlotClass: slot.armSlotClass,
      releaseHeightTier: projectReleaseHeightTier(values.releaseHeightRatio, policy.tierBoundaries) };
    try {
      const point = resolvePitcherReleasePosition(reference, profile);
      if (!Object.values(point).every(Number.isFinite)) continue;
    } catch { continue; }
    return Object.freeze({ careerId: input.careerId, playerId: input.playerId, createdAtDay: input.createdAtDay,
      body: Object.freeze(body), profile: Object.freeze(profile), tierBoundaries: Object.freeze([...policy.tierBoundaries]),
      generation: Object.freeze({ version: PITCHER_RELEASE_GENERATION_VERSION, policyId: policy.policyId, policyVersion: policy.version, playerSeed, attempts: attempt }) });
  }
  throw new Error('selected Pitcher release prior produced no plausible body geometry within its attempt budget');
};
