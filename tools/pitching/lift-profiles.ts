// Lift curves to compare with the match's Lyu 2022 profile, measurement only (the match default is not changed).
// lyu: the match's own knots. sawicki: C_L = 1 / (2.32 + 0.4 / S) (Sawicki, Hubbard and Stronge 2003, the form Nathan used
// for pitches). nathan2017: C_L = 1.12 S / (0.583 + 2.333 S) (Nathan's 2017 fit to TrackMan batted balls).
// Only the lift is swapped; the drag knots stay Lyu's, so a drag scale can still be fitted on top.
import { LIVE_MATCH_PHYSICS_V1 } from '../../src/integration/browser/LiveBaseballMatchV1';

export type LiftName = 'lyu' | 'sawicki' | 'nathan2017';
const curves: Record<Exclude<LiftName, 'lyu'>, (s: number) => number> = {
  sawicki: s => (s === 0 ? 0 : 1 / (2.32 + .4 / s)),
  nathan2017: s => (s === 0 ? 0 : 1.12 * s / (.583 + 2.333 * s)),
};
/** The match physics with the named lift and the drag scaled by k (1 = the match's own drag). */
export function physicsWithLift(name: LiftName = 'lyu', k = 1) {
  const base = LIVE_MATCH_PHYSICS_V1 as any, aero = base.air.aerodynamics, prof = aero.coefficientProfile;
  if (name === 'lyu' && k === 1) return base;
  const lift = name === 'lyu' ? null : curves[name];
  return { ...base, air: { ...base.air, aerodynamics: { ...aero, dragCoefficient: aero.dragCoefficient * k,
    coefficientProfile: { ...prof, profileId: `${prof.profileId}-${name}-drag${k}`,
      spinKnots: prof.spinKnots.map((x: any) => ({ ...x, dragCoefficientAtReferenceRe: x.dragCoefficientAtReferenceRe * k,
        liftCoefficient: lift ? lift(x.spinFactor) : x.liftCoefficient })) } } } };
}
