import { createAeroGroundBallPhysicsProfile, type AeroGroundBallPhysicsV1 } from './VersionedBattedBallPhysics';

/** Lift curves a match can take in place of the seam-averaged Lyu (2022) lift. Only the lift coefficient at each spin knot is
 * replaced; the drag knots, the Reynolds correction and every other input stay as they are.
 * nathan2017: C_L = 1.12 S / (0.583 + 2.333 S), Nathan's 2017 fit to TrackMan batted balls. Fitting 2024 Statcast pitches
 * it leaves about one four-seamer in twelve beyond full active spin (Lyu: six in ten) and moves batted-ball carry by under
 * half a point (tools/pitching/lift-profiles.ts, 2026-11-05). */
export type LiftCurveV1 = 'nathan2017';
export const LIFT_CURVES_V1: Readonly<Record<LiftCurveV1, (spinFactor: number) => number>> = Object.freeze({
  nathan2017: (s: number) => (s <= 0 ? 0 : 1.12 * s / (.583 + 2.333 * s)),
});

export function withLiftCurveV1(physics: AeroGroundBallPhysicsV1, curve: LiftCurveV1): AeroGroundBallPhysicsV1 {
  const lift = LIFT_CURVES_V1[curve], air = physics.air, aero = air.aerodynamics, profile = aero.coefficientProfile;
  if (!lift) throw Error('lift curve v1: unknown curve ' + String(curve));
  if (!profile) throw Error('lift curve v1: the physics has no coefficient profile to replace');
  return createAeroGroundBallPhysicsProfile({ ...physics, air: { ...air, aerodynamics: { ...aero, coefficientProfile: { ...profile,
    profileId: `${profile.profileId}-lift-${curve}`, spinKnots: profile.spinKnots.map(knot => ({ ...knot, liftCoefficient: lift(knot.spinFactor) })) } } } });
}
