import { CURVE_SHAPES, DEVELOPMENT_DOMAINS,
  MATURITY_TIMINGS,
  type CurveShape, type DevelopmentDomain,
  type DevelopmentTrajectoryProfile,
  type MaturityTiming } from './DevelopmentTrajectory';

export type DevelopmentReceptivityKnot = Readonly<{
  ageYears: number;
  receptivity: number;
  declinePressure: number;
}>;
export type DevelopmentReceptivityPolicy = Readonly<{
  policyId: string;
  version: string;
  profileVersion: string;
  availableAtDay: number;
  templateCurves: Readonly<Record<MaturityTiming,
    Readonly<Record<CurveShape,
      readonly DevelopmentReceptivityKnot[]>>>>;
}>;
export type DevelopmentReceptivityPrior = Readonly<{
  careerId: string;
  playerId: string;
  atDay: number;
  ageYears: number;
  effectiveAgeYears: number;
  timing: MaturityTiming;
  shape: CurveShape;
  domain: DevelopmentDomain;
  receptivity: number;
  declinePressure: number;
  policyId: string;
  policyVersion: string;
  profileVersion: string;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const fields = (value: unknown, names: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === names.length
    && names.every((name) => Object.hasOwn(value, name));

const validateCurves = (
  curves: DevelopmentReceptivityPolicy['templateCurves'],
): void => {
  if (!fields(curves, MATURITY_TIMINGS)) {
    throw new Error('invalid development template curve keys');
  }
  for (const timing of MATURITY_TIMINGS) {
    if (!fields(curves[timing], CURVE_SHAPES)) {
      throw new Error('invalid development template curve keys');
    }
    for (const shape of CURVE_SHAPES) {
      const knots = curves[timing][shape];
      if (!Array.isArray(knots) || knots.length < 2) {
        throw new Error('invalid development template curve');
      }
      let previousAge = -1;
      for (const knot of knots) {
        if (!fields(knot, ['ageYears', 'receptivity',
          'declinePressure'])
          || !Number.isFinite(knot.ageYears)
          || knot.ageYears < 0
          || knot.ageYears <= previousAge) {
          throw new Error('invalid development template curve ages');
        }
        if (knot.receptivity <= 0
          || knot.receptivity > 1
          || !Number.isFinite(knot.receptivity)) {
          throw new Error('invalid development receptivity prior');
        }
        if (!Number.isFinite(knot.declinePressure)
          || knot.declinePressure < 0
          || knot.declinePressure > 1) {
          throw new Error('invalid development decline pressure');
        }
        previousAge = knot.ageYears;
      }
    }
  }
};

const sample = (knots: readonly DevelopmentReceptivityKnot[],
  effectiveAgeYears: number): Readonly<{
    receptivity: number; declinePressure: number }> => {
  if (effectiveAgeYears <= knots[0].ageYears) return knots[0];
  for (let index = 1; index < knots.length; index += 1) {
    const later = knots[index];
    if (effectiveAgeYears <= later.ageYears) {
      const earlier = knots[index - 1];
      const share = (effectiveAgeYears - earlier.ageYears)
        / (later.ageYears - earlier.ageYears);
      return {
        receptivity: earlier.receptivity
          + share * (later.receptivity - earlier.receptivity),
        declinePressure: earlier.declinePressure
          + share * (later.declinePressure - earlier.declinePressure),
      };
    }
  }
  return knots[knots.length - 1];
};

/** A calibrated timing prior only. Training, health and opportunity own actual adaptation. */
export const evaluateDevelopmentReceptivity = (
  profile: DevelopmentTrajectoryProfile,
  domain: DevelopmentDomain,
  ageYears: number,
  atDay: number,
  policy: DevelopmentReceptivityPolicy,
): DevelopmentReceptivityPrior => {
  if (!id(profile?.careerId) || !id(profile.playerId)
    || !day(profile.createdAtDay) || !day(atDay)
    || atDay < profile.createdAtDay
    || !DEVELOPMENT_DOMAINS.includes(domain)
    || !MATURITY_TIMINGS.includes(profile.maturityTiming)
    || !CURVE_SHAPES.includes(profile.curveShape)
    || !fields(profile.domainOffsets, DEVELOPMENT_DOMAINS)
    || DEVELOPMENT_DOMAINS.some((key) =>
      !Number.isSafeInteger(profile.domainOffsets[key]))
    || !Number.isFinite(ageYears) || ageYears < 0) {
    throw new Error('invalid development domain, age or profile');
  }
  if (!fields(policy, ['policyId', 'version', 'profileVersion',
    'availableAtDay', 'templateCurves'])
    || !id(policy.policyId) || !id(policy.version)
    || !id(policy.profileVersion)) {
    throw new Error('invalid development receptivity policy');
  }
  if (policy.profileVersion !== profile.profileVersion) {
    throw new Error('development profile version mismatch');
  }
  if (!day(policy.availableAtDay)
    || policy.availableAtDay > profile.createdAtDay) {
    throw new Error('future development receptivity policy');
  }
  validateCurves(policy.templateCurves);
  const effectiveAgeYears = ageYears - profile.domainOffsets[domain];
  const prior = sample(policy.templateCurves[profile.maturityTiming][
    profile.curveShape], effectiveAgeYears);
  return Object.freeze({ careerId: profile.careerId,
    playerId: profile.playerId, atDay, ageYears, effectiveAgeYears,
    timing: profile.maturityTiming, shape: profile.curveShape,
    domain, receptivity: prior.receptivity,
    declinePressure: prior.declinePressure,
    policyId: policy.policyId, policyVersion: policy.version,
    profileVersion: profile.profileVersion,
  });
};
