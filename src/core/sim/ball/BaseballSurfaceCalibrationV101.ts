import type { BaseballGroundMaterial } from './BaseballGroundDynamics';

/** Provisional authored baselines, not measured MLB/stadium constants. Keep
 * surface response separate from airborne forces and player ability. Explicit
 * callers may provide their own full material without losing legacy replay. */
export const BASEBALL_SURFACES_V101: Readonly<Record<'grass' | 'dirt' | 'legacy', BaseballGroundMaterial>> = Object.freeze({
  grass: Object.freeze({ restitution: .48, slidingFriction: .24, rollingDecelerationMps2: 1.2, normalSpinDecayPerSecond: .18 }),
  dirt: Object.freeze({ restitution: .48, slidingFriction: .24, rollingDecelerationMps2: .65, normalSpinDecayPerSecond: .18 }),
  legacy: Object.freeze({ restitution: .48, slidingFriction: .24, rollingDecelerationMps2: .36, normalSpinDecayPerSecond: .18 }),
});
